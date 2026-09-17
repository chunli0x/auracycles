"""Tests for the deterministic engine — the trust layer must be exactly right."""

from datetime import date

import pytest

import engine


# --- stage inference ---

def test_infer_stage_boundaries():
    assert engine.infer_stage(30) == "regular"
    assert engine.infer_stage(39) == "regular"
    assert engine.infer_stage(45) == "perimenopause"
    assert engine.infer_stage(49) == "perimenopause"
    assert engine.infer_stage(55) == "menopause"


def test_resolve_stage_auto_vs_explicit():
    assert engine.resolve_stage("auto", 45)[0] == "perimenopause"
    assert engine.resolve_stage("regular", 45)[0] == "regular"
    assert engine.resolve_stage("menopause", 30)[0] == "menopause"


# --- perimenopause detection (CEMCOR) ---

def test_detect_perimenopause_three_symptoms():
    is_peri, signals = engine.detect_perimenopause(
        42, ["heavy_flow", "night_sweats", "mid_sleep"], 28, None
    )
    assert is_peri is True
    assert any("3 of 9" in s for s in signals)


def test_detect_perimenopause_short_cycle():
    is_peri, signals = engine.detect_perimenopause(38, [], 24, None)
    assert is_peri is True
    assert any("≤ 25" in s for s in signals)


def test_detect_perimenopause_high_variability():
    is_peri, signals = engine.detect_perimenopause(40, [], 30, 9)
    assert is_peri is True
    assert any("varies" in s for s in signals)


def test_detect_perimenopause_none():
    is_peri, signals = engine.detect_perimenopause(35, ["mood_swings"], 28, 3)
    assert is_peri is False
    assert signals == []


def test_detect_stage_symptoms_override_age():
    # A 35-year-old with 3 peri symptoms should be flagged very early
    # perimenopause (CEMCOR), not guessed "regular" from age alone.
    stage, reasoning, signals = engine.detect_stage(
        35, "auto", ["heavy_flow", "night_sweats", "mid_sleep"], None
    )
    assert stage == "very_early_perimenopause"
    assert signals
    assert any("3 of 9" in s for s in signals)


def test_detect_stage_two_symptoms_not_vemp():
    # Two symptoms is below CEMCOR's 3-of-9 threshold -> not flagged.
    stage, _, signals = engine.detect_stage(35, "auto", ["heavy_flow", "mid_sleep"], None)
    assert stage == "regular"
    assert signals == []


def test_detect_stage_explicit_vemp():
    stage, reasoning, signals = engine.detect_stage(
        35, "very_early_perimenopause", [], None
    )
    assert stage == "very_early_perimenopause"
    assert reasoning == "Provided by you."
    assert signals == []


def test_detect_stage_explicit_wins_over_symptoms():
    stage, _, signals = engine.detect_stage(
        35, "regular", ["heavy_flow", "night_sweats", "mid_sleep"], None
    )
    assert stage == "regular"
    assert signals == []


def test_read_auto_detects_peri_from_symptoms():
    out = engine.read(
        {
            "age": 36,
            "stage": "auto",
            "peri_symptoms": ["heavy_flow", "night_sweats", "mid_sleep"],
            "period_starts": ["2026-07-23", "2026-06-26"],
            "period_length": 5,
            "today": "2026-08-13",
        }
    )
    assert out["stage"] == "very_early_perimenopause"
    assert out["peri_signals"]
    # Perimenopause guidance still rides on top of the stretch recs.
    assert any("shifting" in t for t in out["recommendations"]["training"])


def test_read_auto_detects_peri_from_short_cycle():
    # Two starts 25 days apart -> cycle length 25 -> peri, even with no symptoms.
    out = engine.read(
        {
            "age": 40,
            "stage": "auto",
            "peri_symptoms": [],
            "period_starts": ["2026-07-23", "2026-06-28"],
            "period_length": 5,
            "today": "2026-08-13",
        }
    )
    assert out["stage"] == "perimenopause"
    assert any("≤ 25" in s for s in out["peri_signals"])


def test_cycle_variability():
    starts = [date(2026, 5, 1), date(2026, 5, 25), date(2026, 6, 23)]
    assert engine.cycle_variability(starts) == pytest.approx(5)  # 24 vs 29


def test_cycle_variability_needs_three_starts():
    assert engine.cycle_variability([date(2026, 5, 1), date(2026, 5, 29)]) is None


# --- cycle math ---

def test_avg_cycle_length():
    starts = [date(2026, 5, 29), date(2026, 6, 26), date(2026, 7, 23)]
    assert engine.avg_cycle_length(starts) == pytest.approx((28 + 27) / 2)


def test_avg_cycle_length_single_start_is_none():
    assert engine.avg_cycle_length([date(2026, 7, 23)]) is None


def test_compute_cycle_day():
    starts = [date(2026, 5, 29), date(2026, 6, 26), date(2026, 7, 23)]
    out = engine.compute_cycle(starts, date(2026, 8, 13))
    assert out["cycle_day"] == 22  # (Aug 13 - Jul 23) + 1
    assert out["cycle_length"] == 28  # round(27.5)
    assert out["confidence"] == "high"  # 28 vs 27 -> spread 1


def test_compute_cycle_overdue():
    starts = [date(2026, 7, 23)]
    out = engine.compute_cycle(starts, date(2026, 8, 30))
    assert out["overdue_days"] >= 1


# --- stretch classification (28-day, 5-day period) ---

@pytest.mark.parametrize(
    "day,expected",
    [
        (1, "menstrual"),
        (5, "menstrual"),
        (6, "follicular"),
        (12, "follicular"),
        (13, "ovulatory"),
        (14, "ovulatory"),
        (15, "ovulatory"),
        (16, "early_luteal"),
        (22, "early_luteal"),
        (23, "late_luteal"),
        (28, "late_luteal"),
    ],
)
def test_stretch_for_28day(day, expected):
    assert engine.stretch_for(day, 28, 5) == expected


def test_stretch_for_irregular_long_cycle():
    # A 35-day cycle still has a ~14-day luteal -> ovulation around day 21.
    assert engine.stretch_for(21, 35, 5) == "ovulatory"
    assert engine.stretch_for(26, 35, 5) == "early_luteal"
    assert engine.stretch_for(30, 35, 5) == "late_luteal"  # last ~6 days


# --- full read() orchestration ---

LISA = {
    "age": 47,
    "stage": "perimenopause",
    "period_starts": ["2026-05-29", "2026-06-26", "2026-07-23"],
    "period_length": 5,
    "cycle_length": None,
    "training": "moderate",
    "workout_frequency": "3x",
    "diet": "balanced",
    "social": "weekly",
    "relationship": "single",
    "today": "2026-08-13",
}


def test_read_lisa():
    out = engine.read(dict(LISA))
    assert out["stage"] == "perimenopause"
    assert out["cycle_day"] == 22
    assert out["stretch"] == "early_luteal"
    assert out["next_period"] == "2026-08-20"
    assert out["recommendations"]["headline"].startswith("Luteal Flow")
    # perimenopause override text rides on top of the stretch recs
    assert any("shifting" in t for t in out["recommendations"]["training"])
    assert len(out["calendar"]) > 28


def test_read_menopause_no_calendar():
    out = engine.read(
        {"age": 54, "stage": "menopause", "period_starts": [], "today": "2026-08-13"}
    )
    assert out["stage"] == "menopause"
    assert out["stretch"] is None
    assert out["calendar"] == []
    assert "strength" in out["recommendations"]["training"][0].lower()


def test_read_regular_cycle():
    out = engine.read(
        {
            "age": 30,
            "stage": "regular",
            "period_starts": ["2026-07-23", "2026-06-26"],
            "period_length": 5,
            "today": "2026-08-13",
        }
    )
    assert out["stage"] == "regular"
    assert out["stretch"] in engine.STRETCHES
    assert out["stretch_meta"]["color"].startswith("#")


def test_glp1_biases_strength_and_protein():
    base = {
        "age": 32,
        "stage": "regular",
        "period_starts": ["2026-07-23", "2026-06-26"],
        "period_length": 5,
        "training": "mix",
        "diet": "balanced",
        "today": "2026-08-13",
    }
    off = engine.read(dict(base, glp1="no"))["recommendations"]
    on = engine.read(dict(base, glp1="yes"))["recommendations"]
    starting = engine.read(dict(base, glp1="starting"))["recommendations"]

    # No GLP-1 -> no GLP-1 guidance anywhere.
    assert not any(t.startswith("On a GLP-1") or t.startswith("Starting a GLP-1") for t in off["training"])
    assert not any(d.startswith("On a GLP-1") or d.startswith("Starting a GLP-1") for d in off["diet"])

    # Currently on a GLP-1 -> phase-specific strength + protein guidance.
    assert any(t.startswith("On a GLP-1") for t in on["training"])
    assert any(d.startswith("On a GLP-1") for d in on["diet"])

    # Starting -> phase-specific front-load guidance.
    assert any(t.startswith("Starting a GLP-1") for t in starting["training"])
    assert any(d.startswith("Starting a GLP-1") for d in starting["diet"])


def test_read_no_starts_still_returns_structure():
    out = engine.read({"age": 30, "stage": "regular", "period_starts": []})
    assert out["cycling"] is False
    assert out["stretch"] is None
    assert "disclaimer" in out


def test_cycle_plan_covers_all_stretches_with_glp1():
    base = {
        "age": 32,
        "stage": "regular",
        "period_starts": ["2026-07-23", "2026-06-26"],
        "period_length": 5,
        "training": "mix",
        "diet": "balanced",
        "glp1": "yes",
        "today": "2026-08-13",
    }
    out = engine.read(dict(base))
    plan = out["cycle_plan"]
    assert set(plan.keys()) == set(engine.STRETCHES)
    # GLP-1 guidance lands on both training and diet in every week.
    for stretch, rec in plan.items():
        assert any(t.startswith("On a GLP-1") for t in rec["training"])
        assert any(d.startswith("On a GLP-1") for d in rec["diet"])


def test_glp1_guidance_varies_by_stretch():
    base = {
        "age": 32,
        "stage": "regular",
        "period_starts": ["2026-07-23", "2026-06-26"],
        "period_length": 5,
        "training": "mix",
        "diet": "balanced",
        "glp1": "yes",
        "today": "2026-08-13",
    }
    plan = engine.read(dict(base))["cycle_plan"]
    # The GLP-1 training and diet lines differ from one stretch to the next.
    train_lines = {s: next(t for t in plan[s]["training"] if t.startswith("On a GLP-1")) for s in plan}
    diet_lines = {s: next(d for d in plan[s]["diet"] if d.startswith("On a GLP-1")) for s in plan}
    assert len(set(train_lines.values())) == 5
    assert len(set(diet_lines.values())) == 5


def test_cycle_plan_empty_when_not_cycling():
    # Menopause -> no stretch map.
    out = engine.read({"age": 54, "stage": "menopause", "period_starts": [], "today": "2026-08-13"})
    assert out["cycle_plan"] == {}
    # Regular but no period data -> no stretch map either.
    out2 = engine.read({"age": 30, "stage": "regular", "period_starts": [], "today": "2026-08-13"})
    assert out2["cycle_plan"] == {}


# --- fertility window (TTC) ---

def test_fertility_flags_28day():
    # Ovulation = cycle_length - 14 = day 14. Fertile = days 9-14, peak = 13-14.
    assert engine.fertility_flags(8, 28) == (False, False, False)   # before window
    assert engine.fertility_flags(9, 28) == (True, False, False)    # fertile, not peak
    assert engine.fertility_flags(13, 28) == (True, True, False)    # peak, not ovulation
    assert engine.fertility_flags(14, 28) == (True, True, True)     # ovulation day
    assert engine.fertility_flags(15, 28) == (False, False, False)  # after window


def test_fertility_flags_guard_none_and_short():
    assert engine.fertility_flags(None, 28) == (False, False, False)
    assert engine.fertility_flags(0, 28) == (False, False, False)
    # cycle_length too short to place ovulation -> all False
    assert engine.fertility_flags(1, 10) == (False, False, False)


def test_fertility_off_by_default():
    out = engine.read(
        {
            "age": 30,
            "stage": "regular",
            "period_starts": ["2026-07-20", "2026-08-17"],
            "period_length": 5,
            "cycle_length": 28,
            "today": "2026-08-22",
        }
    )
    assert out["fertility"] is None


def test_fertility_ttc_yes_28day():
    out = engine.read(
        {
            "age": 30,
            "stage": "regular",
            "period_starts": ["2026-07-20", "2026-08-17"],
            "period_length": 5,
            "cycle_length": 28,
            "today": "2026-08-22",
            "ttc": "yes",
        }
    )
    f = out["fertility"]
    assert f["enabled"] is True
    assert f["ovulation_day_of_cycle"] == 14
    assert f["next_ovulation"] == "2026-08-30"
    assert f["next_fertile_start"] == "2026-08-25"
    assert f["next_fertile_end"] == "2026-08-30"
    assert "2026-08-30" in f["peak_dates"]
    assert "2026-08-29" in f["peak_dates"]
    assert f["today_in_window"] is False
    assert "5 days" in f["note"]


def test_fertility_menopause_returns_none():
    out = engine.read(
        {"age": 54, "stage": "menopause", "period_starts": [], "today": "2026-08-22", "ttc": "yes"}
    )
    assert out["fertility"] is None


def test_fertility_perimenopause_note_hedges():
    out = engine.read(
        {
            "age": 47,
            "stage": "perimenopause",
            "period_starts": ["2026-07-20", "2026-08-17"],
            "period_length": 5,
            "cycle_length": 28,
            "today": "2026-08-22",
            "ttc": "yes",
        }
    )
    assert "predictable" in out["fertility"]["note"]


def test_calendar_days_carry_fertility_flags():
    out = engine.read(
        {
            "age": 30,
            "stage": "regular",
            "period_starts": ["2026-07-20", "2026-08-17"],
            "period_length": 5,
            "cycle_length": 28,
            "today": "2026-08-22",
            "ttc": "yes",
        }
    )
    ovu_day = next(d for d in out["calendar"] if d["date"] == "2026-08-30")
    assert ovu_day["fertile"] is True
    assert ovu_day["peak"] is True
    assert ovu_day["ovulation"] is True
    non_fertile = next(d for d in out["calendar"] if d["date"] == "2026-08-20")
    assert non_fertile["fertile"] is False
