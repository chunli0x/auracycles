"""Aura Cycles — The Aura Engine: deterministic cycle, stage, and recommendation engine.

This is the TRUST LAYER: pure functions, no I/O, no LLM, no side effects.
Period dates + a short lifestyle profile in -> cycle day, stretch, a color-coded
calendar, and personalized recommendations out. Nothing here can hallucinate.

NOT medical advice. This is a wellness / life-planning tool. For anything
clinical — especially perimenopause, menopause, or irregular bleeding — a
doctor's guidance always wins.

The engine is deliberately split into two halves:
  1. Computation (cycle math + stage) — deterministic and unit-tested.
  2. Recommendation copy — rule-based text keyed on stretch, stage, and profile.

That split is what lets a future LLM "coach" layer sit on top later without
ever being able to mis-state the user's stretch: the model talks about what the
engine computes, not the other way around.
"""

from __future__ import annotations

from datetime import date, timedelta
from statistics import mean
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Stretches (28-day-normalized frame; generalized below with a fixed ~14-day luteal)
# ---------------------------------------------------------------------------

STRETCHES: dict[str, dict[str, Any]] = {
    "menstrual": {
        "label": "Rest & Renew",
        "emoji": "🌙",
        "color": "#D1188B",
        "blurb": "Rest and recover. Low impact, review, and admin — not new launches.",
    },
    "follicular": {
        "label": "Follicular Rise",
        "emoji": "🌱",
        "color": "#00B7C9",
        "blurb": "Rising energy. Your boldest window — create, learn, launch, push.",
    },
    "ovulatory": {
        "label": "Ovulation Glow",
        "emoji": "🔥",
        "color": "#FF6AD5",
        "blurb": "BOSS MODE. Peak energy, confidence, and magnetism. High-stakes everything.",
    },
    "early_luteal": {
        "label": "Luteal Flow",
        "emoji": "🍂",
        "color": "#8B5CF6",
        "blurb": "Execution and finishing. Detail work and error-catching — steady, not max.",
    },
    "late_luteal": {
        "label": "Reflect & Rest",
        "emoji": "🌀",
        "color": "#3B82F6",
        "blurb": "Protect the calendar. Editing and admin only. Rest, de-load, go inward.",
    },
}

# Fixed luteal length (well-established physiology) used to place ovulation.
LUTEAL_DAYS = 14

# Fertility window (TTC): sperm survive up to ~5 days and the egg ~12-24h, so
# the fertile window is the 6 days ending on ovulation day. Peak = the day
# before + day of ovulation (highest conception probability).
FERTILE_LEAD_DAYS = 5
PEAK_LEAD_DAYS = 1

# CEMCOR (Dr. Jerilynn Prior, Centre for Menstrual Cycle and Ovulation Research)
# "very early perimenopause" criteria: cycles may still be regular (21-35 days),
# but any 3 of these 9 characteristic changes is enough to consider it started.
# Source: https://cemcor.ubc.ca/resources/how-can-i-tell-i-am-perimenopause/
PERI_SYMPTOMS: dict[str, str] = {
    "heavy_flow": "New heavy and/or longer menstrual flow",
    "shorter_cycle": "Shorter cycles (25 days or fewer)",
    "breast_changes": "New sore, swollen, or lumpy breasts",
    "cramps": "New or increased menstrual cramps",
    "mid_sleep": "New mid-sleep wakening",
    "night_sweats": "Night sweats, especially around your period",
    "migraine": "New or much worse migraine headaches",
    "mood_swings": "New or worse premenstrual mood swings",
    "weight_gain": "Weight gain without changing food or exercise",
}

# STRAW+10 defines the "menopause transition" as cycle length varying by 7+ days.
PERI_VARIABILITY_DAYS = 7
# Cycles of 25 days or fewer are themselves one of CEMCOR's early-peri markers.
PERI_SHORT_CYCLE_DAYS = 25


# ---------------------------------------------------------------------------
# Reproductive stage
# ---------------------------------------------------------------------------

def infer_stage(age: int) -> str:
    """Population-average guess from age alone. A soft default, never a diagnosis."""
    if age < 40:
        return "regular"
    if age < 50:
        return "perimenopause"
    return "menopause"


def resolve_stage(stage: str, age: int) -> tuple[str, str]:
    """Return (stage, reasoning). 'auto' resolves to an age-based guess."""
    if stage not in ("regular", "perimenopause", "very_early_perimenopause", "menopause"):
        stage = infer_stage(age)
        reasoning = f"Guessed from age {age} (population average — confirm for yourself)."
    else:
        reasoning = "Provided by you."
    return stage, reasoning


# ---------------------------------------------------------------------------
# Cycle math
# ---------------------------------------------------------------------------

def _sort_starts(starts: list[str]) -> list[date]:
    ds = sorted({date.fromisoformat(s) for s in starts if s})
    return ds


def avg_cycle_length(starts: list[date]) -> Optional[float]:
    """Mean gap between consecutive period starts, or None if <2 starts."""
    if len(starts) < 2:
        return None
    gaps = [(starts[i + 1] - starts[i]).days for i in range(len(starts) - 1)]
    return mean(g for g in gaps if 15 <= g <= 45) if gaps else None


def cycle_variability(starts: list[date]) -> Optional[float]:
    """Spread (max − min) of consecutive cycle gaps, or None if <3 starts.

    Variability needs at least two gaps to be meaningful; a single gap can't
    tell you whether cycles are getting longer or shorter.
    """
    if len(starts) < 3:
        return None
    gaps = [g for g in ((starts[i + 1] - starts[i]).days for i in range(len(starts) - 1)) if 15 <= g <= 45]
    if len(gaps) < 2:
        return None
    return max(gaps) - min(gaps)


def detect_perimenopause(
    age: int,
    peri_symptoms: Optional[list[str]],
    cycle_length: Optional[float],
    cycle_variance: Optional[float],
) -> tuple[bool, list[str]]:
    """CEMCOR-based perimenopause signal detection.

    Returns (is_peri, signals). Fires on ANY of:
      1. 3+ of the 9 characteristic changes selected (subjective self-report)
      2. measured cycle length ≤ 25 days (objective)
      3. cycle-to-cycle variability ≥ 7 days (objective; STRAW+10 menopause transition)
    """
    signals: list[str] = []
    selected = [s for s in (peri_symptoms or []) if s in PERI_SYMPTOMS]
    if len(selected) >= 3:
        signals.append(f"{len(selected)} of 9 characteristic changes")
    if cycle_length is not None and cycle_length <= PERI_SHORT_CYCLE_DAYS:
        signals.append(f"cycle length {cycle_length:.0f} days (≤ {PERI_SHORT_CYCLE_DAYS})")
    if cycle_variance is not None and cycle_variance >= PERI_VARIABILITY_DAYS:
        signals.append(f"cycle length varies {cycle_variance:.0f}+ days")
    return bool(signals), signals


def detect_stage(
    age: int,
    stage_choice: str,
    peri_symptoms: Optional[list[str]] = None,
    starts: Optional[list[date]] = None,
) -> tuple[str, str, list[str]]:
    """Resolve reproductive stage.

    Priority: explicit user choice > CEMCOR symptom/cycle evidence > age guess.
    Returns (stage, reasoning, peri_signals).
    """
    # 1. Explicit choice wins — the user knows their body.
    if stage_choice in ("regular", "perimenopause", "very_early_perimenopause", "menopause"):
        return stage_choice, "Provided by you.", []

    starts = starts or []
    avg = avg_cycle_length(starts)
    variability = cycle_variability(starts)

    # 2. CEMCOR "very early perimenopause": 3+ of the 9 characteristic changes,
    #    even while cycles are still regular.
    selected = [s for s in (peri_symptoms or []) if s in PERI_SYMPTOMS]
    if len(selected) >= 3:
        reasoning = (
            'CEMCOR "very early perimenopause": '
            f"{len(selected)} of 9 characteristic changes present. "
            "Not a diagnosis — confirm with a clinician."
        )
        return "very_early_perimenopause", reasoning, [f"{len(selected)} of 9 characteristic changes"]

    # 3. Irregular / short cycles -> perimenopause (early transition).
    is_peri, signals = detect_perimenopause(age, peri_symptoms, avg, variability)
    if is_peri:
        reasoning = (
            "Signs of perimenopause: " + "; ".join(signals)
            + ". Not a diagnosis — confirm with a clinician."
        )
        return "perimenopause", reasoning, signals

    # 4. Age-based soft guess (population average).
    return infer_stage(age), f"Guessed from age {age} (population average — confirm for yourself).", []


def compute_cycle(
    starts: list[date],
    today: date,
    cycle_length_override: Optional[int] = None,
    period_length: int = 5,
) -> dict[str, Any]:
    """Given period-start dates and today, compute cycle position."""
    starts = _sort_starts([d.isoformat() for d in starts])
    if not starts:
        return {
            "cycling": True,
            "cycle_day": None,
            "cycle_length": cycle_length_override or 28,
            "period_length": period_length,
            "next_period": None,
            "days_to_next": None,
            "overdue_days": None,
            "confidence": "low",
        }

    last = starts[-1]
    avg = avg_cycle_length(starts)
    cycle_length = cycle_length_override or int(round(avg)) if avg else 28

    # Confidence from spread of observed gaps.
    if avg is None:
        confidence = "low"  # only one start known
    else:
        gaps = [g for g in ((starts[i + 1] - starts[i]).days for i in range(len(starts) - 1))]
        spread = max(gaps) - min(gaps) if gaps else 0
        confidence = "high" if spread <= 2 else ("medium" if spread <= 5 else "low")

    cycle_day = (today - last).days + 1
    if cycle_day < 1:
        cycle_day = None  # today is before the earliest known start

    next_period = last + timedelta(days=cycle_length)
    days_to_next = (next_period - today).days
    overdue_days = max(0, (today - next_period).days)

    return {
        "cycling": True,
        "cycle_day": cycle_day,
        "cycle_length": cycle_length,
        "period_length": period_length,
        "next_period": next_period.isoformat(),
        "days_to_next": days_to_next,
        "overdue_days": overdue_days,
        "confidence": confidence,
    }


def stretch_for(cycle_day: int, cycle_length: int, period_length: int) -> Optional[str]:
    """Classify a cycle day into a stretch (fixed ~14-day luteal model)."""
    if cycle_day is None or cycle_day < 1 or cycle_day > cycle_length + 14:
        return None
    ovu = cycle_length - LUTEAL_DAYS  # ovulation day (fixed luteal)
    if cycle_day <= period_length:
        return "menstrual"
    if cycle_day < ovu - 1:
        return "follicular"
    if ovu - 1 <= cycle_day <= ovu + 1:
        return "ovulatory"
    if cycle_day < cycle_length - 5:
        return "early_luteal"
    return "late_luteal"


def fertility_flags(cycle_day: Optional[int], cycle_length: int) -> tuple[bool, bool, bool]:
    """Return (fertile, peak, ovulation) for a cycle day, or all-False when
    there's no valid day / ovulation can't be placed.

    Fertile = the 6 days ending on ovulation day (sperm ~5 days + egg ~24h).
    Peak = the day before + day of ovulation (highest conception probability).
    """
    if cycle_day is None or cycle_day < 1:
        return (False, False, False)
    ovu = cycle_length - LUTEAL_DAYS
    if ovu < 1:
        return (False, False, False)
    fertile = ovu - FERTILE_LEAD_DAYS <= cycle_day <= ovu
    peak = ovu - PEAK_LEAD_DAYS <= cycle_day <= ovu
    return (fertile, peak, cycle_day == ovu)


# ---------------------------------------------------------------------------
# Calendar projection
# ---------------------------------------------------------------------------

def build_calendar(
    starts: list[date],
    cycle_length: int,
    period_length: int,
    today: date,
    months: int = 2,
) -> list[dict[str, Any]]:
    """Color-coded day grid for the current month + `months`-1 following months."""
    starts = _sort_starts([d.isoformat() for d in starts])
    # Known + projected period starts.
    all_starts: list[date] = list(starts)
    if starts:
        last = starts[-1]
        cursor = last + timedelta(days=cycle_length)
        horizon = today + timedelta(days=months * 31)
        while cursor <= horizon:
            all_starts.append(cursor)
            cursor += timedelta(days=cycle_length)
    all_starts = sorted(set(all_starts))

    first = date(today.year, today.month, 1)
    last_day = (first.replace(month=first.month + months) - timedelta(days=1))
    last_day = date(last_day.year, last_day.month, last_day.day)

    days: list[dict[str, Any]] = []
    d = first
    while d <= last_day:
        # Most recent start <= d
        prior = [s for s in all_starts if s <= d]
        is_start = d in all_starts
        if prior:
            s = max(prior)
            cd = (d - s).days + 1
            cd = cd if cd <= cycle_length + 14 else None
        else:
            cd = None
        stretch = stretch_for(cd, cycle_length, period_length) if cd else None
        fertile, peak, ovulation = fertility_flags(cd, cycle_length)
        days.append(
            {
                "date": d.isoformat(),
                "day": d.day,
                "weekday": d.strftime("%a")[0],
                "cycle_day": cd,
                "stretch": stretch,
                "fertile": fertile,
                "peak": peak,
                "ovulation": ovulation,
                "is_today": d == today,
                "is_start": is_start,
                "is_projected": is_start and d not in starts,
            }
        )
        d += timedelta(days=1)
    return days


# ---------------------------------------------------------------------------
# Recommendation copy (rule-based)
# ---------------------------------------------------------------------------

BASE_RECS: dict[str, dict[str, list[str]]] = {
    "menstrual": {
        "training": [
            "De-load — low impact, walking, gentle mobility over heavy lifts.",
            "Don't chase PRs while you're bleeding; recovery is the win this week.",
        ],
        "diet": [
            "Eat warm, iron-rich food (soups, stews, leafy greens, red meat) — you're losing iron with your period.",
            "Magnesium for cramps, and hydrate with electrolytes.",
        ],
        "social_love": [
            "Social battery is lower — keep plans light and low-key.",
            "Rest is productive here; you don't owe anyone peak-you.",
        ],
        "work_focus": [
            "Review, admin, and planning — not new launches or cold outreach.",
            "Let ideas percolate; execution energy returns soon.",
        ],
    },
    "follicular": {
        "training": [
            "Your strength window — progressive overload, heavier lifts, more volume.",
            "Energy and recovery are rising; push intensity now.",
        ],
        "diet": [
            "Body tolerates lighter, varied food — lots of veg and lean protein.",
            "Appetite is steadier here; a good window for clean-eating momentum.",
        ],
        "social_love": [
            "Outgoing and magnetic — great for new connections and saying yes.",
            "A strong window for dates and meeting new people.",
        ],
        "work_focus": [
            "Launch, create, learn, cold outreach — your boldest window.",
            "New projects and pitches land well now.",
        ],
    },
    "ovulatory": {
        "training": [
            "Peak performance — max effort, test your PRs, compete if you do.",
            "Power and coordination are at their highest all cycle.",
        ],
        "diet": [
            "Light, fresh, high-energy food — you're firing on all cylinders.",
            "Keep protein up to recover from hard sessions.",
        ],
        "social_love": [
            "BOSS MODE — your most confident, articulate, magnetic days.",
            "Book the big meeting, the pitch, the date, the party.",
        ],
        "work_focus": [
            "High-stakes everything: pitch, negotiate, present, network.",
            "This is your extrovert window — front-load the scary stuff.",
        ],
    },
    "early_luteal": {
        "training": [
            "Shift to moderate weights, higher volume, lower max.",
            "Energy is still good but trending down — maintain, don't max.",
        ],
        "diet": [
            "Progesterone is rising — steady blood sugar helps mood and cravings.",
            "Complex carbs + magnesium are your friends this week.",
        ],
        "social_love": [
            "Still social, but starting to prefer familiar company.",
            "Good for deepening connections rather than new crowds.",
        ],
        "work_focus": [
            "Execution, finishing, detail work, error-catching.",
            "Wrap things already in motion; hold new high-stakes conversations.",
        ],
    },
    "late_luteal": {
        "training": [
            "De-load week — steady cardio, mobility, lighter lifts.",
            "Progesterone raises injury risk (joint laxity) — protect tendons.",
        ],
        "diet": [
            "Carb cravings are normal — lean into complex carbs, don't fight them.",
            "Magnesium + electrolytes; ease caffeine if sleep is dipping.",
        ],
        "social_love": [
            "Protect your calendar — social battery is low.",
            "Honor the inward pull; rest now and re-emerge next week.",
        ],
        "work_focus": [
            "Editing and admin only — no big decisions or cold outreach.",
            "Guard against decision fatigue; push major moves to next week.",
        ],
    },
}

# Cross-cutting modifiers keyed by (dimension, value). Each adds stretch-aware notes.
MODIFIERS: dict[str, dict[str, dict[str, list[str]]]] = {
    "training": {
        "heavy": {
            "follicular": ["This is your PR window — load up and go heavy."],
            "late_luteal": ["You can still lift, but back max effort off ~10–15% to protect joints."],
        },
        "light": {
            "follicular": ["Your low-impact base is great — add a little strength now for bone health."],
        },
        "cardio": {
            "late_luteal": ["Steady-state cardio suits this stretch of the cycle perfectly — keep it easy."],
        },
    },
    "workout_frequency": {
        "daily": {
            "late_luteal": ["You train a lot — this de-load week is non-negotiable for recovery."],
        },
        "5x": {
            "late_luteal": ["Five days a week is a lot — protect one as a true recovery day this week."],
        },
        "1x": {
            "follicular": ["Even one solid strength session this week beats two scattered ones later."],
        },
    },
    "diet": {
        "low-carb": {
            "late_luteal": ["Luteal carb cravings may hit harder — allow clean complex carbs; don't white-knuckle it."],
        },
        "vegan": {
            "menstrual": ["Plant iron + vitamin C matters most now; consider B12 if you don't already."],
        },
        "vegetarian": {
            "menstrual": ["Keep iron up while bleeding — pair leafy greens with vitamin C; eggs and dairy cover B12."],
        },
        "pescatarian": {
            "menstrual": ["Omega-3s from fish can ease cramps, and seafood iron helps during your period."],
        },
        "gluten-free": {
            "late_luteal": ["Cravings will hit — stock gluten-free complex carbs (oats, rice, sweet potato) ahead of time."],
        },
        "if": {
            "late_luteal": ["Consider loosening your fasting window — hunger cues rise late-cycle."],
        },
        "high-protein": {
            "late_luteal": ["You're already nailing protein — keep it up through luteal for satiety."],
        },
    },
    "social": {
        "rarely": {
            "ovulatory": ["The easiest time to stretch your social comfort zone — use it."],
            "follicular": ["A good week to schedule the one social thing you've been putting off."],
        },
        "daily": {
            "late_luteal": ["Protect this week; it's okay to say no without guilt."],
        },
    },
    "relationship": {
        "single": {
            "ovulatory": ["Your best window for meeting people and dating — put yourself out there."],
            "follicular": ["High-confidence days — good for first dates."],
        },
        "relationship": {
            "ovulatory": ["Libido peaks here — plan quality time now."],
            "late_luteal": ["Libido dips late-cycle — don't read the dip as distance; it's hormonal."],
        },
    },
}

STAGE_OVERRIDES: dict[str, dict[str, list[str]]] = {
    "perimenopause": {
        "training": [
            "Cycles are shifting — plan by how you feel, not strictly by the day number.",
            "Ovulation gets less predictable in perimenopause, so treat your stretch as a best-guess, not a rule.",
            "Strength training is your best friend now for bone + muscle retention.",
        ],
        "diet": [
            "New GI symptoms can appear — log them to spot patterns vs. one-offs.",
        ],
        "social_love": [
            "Hot flashes or sleep dips can hit anytime — keep evenings flexible.",
        ],
        "work_focus": [
            "Block deep work around your real energy, not a fixed calendar.",
        ],
    },
    "menopause": {
        "training": [
            "Strength training becomes non-negotiable — bone density and muscle.",
            "Moderate cardio for heart health, plus balance and mobility work.",
        ],
        "diet": [
            "Protein at every meal, calcium + vitamin D, and plenty of fiber.",
        ],
        "social_love": [
            "Energy is steadier now — no hormonal swings to schedule around.",
            "Routine and consistency serve you well.",
        ],
        "work_focus": [
            "No monthly swing — you can schedule consistently.",
            "Protect sleep and stress; they matter more now than any monthly swing ever did.",
        ],
    },
}


# GLP-1 guidance that follows the phase of the cycle, not a single blanket
# rule. GLP-1s blunt appetite and accelerate muscle loss, so both the food and
# the training advice change with what the body is already doing that week.
GLP1_NOTES: dict[str, dict[str, dict[str, list[str]]]] = {
    "yes": {
        "menstrual": {
            "training": ["On a GLP-1, keep strength light this week — protein and rest protect muscle more than pushing through."],
            "diet": ["On a GLP-1, appetite is lowest now — make iron-rich food count with protein at each small meal."],
            "wellness": ["On a GLP-1, appetite is lowest now; small, frequent meals beat forcing big ones."],
        },
        "follicular": {
            "training": ["On a GLP-1, this is your strength week — progressive overload is your best muscle-preserver."],
            "diet": ["On a GLP-1, appetite is steadier now — an easy week to hit your protein target."],
            "wellness": ["On a GLP-1, appetite is steadier now; a good week to establish regular meal timing."],
        },
        "ovulatory": {
            "training": ["On a GLP-1, ride the energy peak — max effort now, but keep protein timing tight around sessions."],
            "diet": ["On a GLP-1, keep meals light but protein-forward — digestion can be sensitive at peak."],
            "wellness": ["On a GLP-1, digestion can be sensitive at peak; keep meals light and hydrated."],
        },
        "early_luteal": {
            "training": ["On a GLP-1, maintain moderate weights — you still have strength; protect it."],
            "diet": ["On a GLP-1, steady blood sugar matters — pair protein with complex carbs."],
            "wellness": ["On a GLP-1, steady blood sugar helps; pair protein with complex carbs."],
        },
        "late_luteal": {
            "training": ["On a GLP-1, honor the de-load — muscle is built in recovery, not by grinding this week."],
            "diet": ["On a GLP-1, carb cravings and low appetite can clash — protein first, then clean carbs."],
            "wellness": ["On a GLP-1, bloating and cravings can overlap with low appetite; eat small and often."],
        },
    },
    "starting": {
        "menstrual": {
            "training": ["Starting a GLP-1 — ease into strength now so it's a habit before appetite drops."],
            "diet": ["Starting a GLP-1 — build the protein habit now; this week is about routine, not perfection."],
            "wellness": ["Starting a GLP-1 — a gentler week to begin; keep meals small and routine."],
        },
        "follicular": {
            "training": ["Starting a GLP-1 — the gentlest week to begin; add strength before appetite drops."],
            "diet": ["Starting a GLP-1 — front-load protein now so muscle isn't the first thing to go."],
            "wellness": ["Starting a GLP-1 — the calmest week to start; your stomach will thank you."],
        },
        "ovulatory": {
            "training": ["Starting a GLP-1 — your strongest week; add strength now while energy is high."],
            "diet": ["Starting a GLP-1 — lock in the protein habit while appetite is still steady."],
            "wellness": ["Starting a GLP-1 — energy is high but start slow; digestion can be sensitive at peak."],
        },
        "early_luteal": {
            "training": ["Starting a GLP-1 — maintain strength now before the late-cycle de-load."],
            "diet": ["Starting a GLP-1 — protein first; steady blood sugar will soften the transition."],
            "wellness": ["Starting a GLP-1 — steady now; build the small-meal habit before late-cycle bloat."],
        },
        "late_luteal": {
            "training": ["Starting a GLP-1 — a tough week to begin; if starting now, keep it gentle."],
            "diet": ["Starting a GLP-1 — if you can, start in a calmer week; protein first either way."],
            "wellness": ["Starting a GLP-1 — if you can, wait for a calmer week; this is the hardest window to begin."],
        },
    },
}

_GLP1_GENERIC: dict[str, tuple[list[str], list[str]]] = {
    "yes": (
        ["On a GLP-1, make strength training your backbone — it protects muscle mass as weight comes off."],
        ["On a GLP-1, lead with protein (about 1.6 g per kg of body weight a day) to hold onto muscle in a deficit."],
    ),
    "starting": (
        ["Starting a GLP-1 — add strength training now, so you protect muscle from the very first week."],
        ["Starting a GLP-1 — front-load protein now so muscle isn't the first thing to go."],
    ),
}


def _wellness(profile: dict[str, Any], stretch: Optional[str] = None) -> list[str]:
    """Extra clinician-aligned notes for HRT and GLP-1 use."""
    notes: list[str] = []
    hrt = profile.get("hrt", "no")
    glp1 = profile.get("glp1", "no")
    if hrt == "yes":
        notes.append("On HRT — symptoms may feel steadier, but still plan around how you actually feel.")
    elif hrt == "considering":
        notes.append("Considering HRT — log symptoms for a few weeks; it's the best data to bring to a clinician.")
    if glp1 in GLP1_NOTES and stretch in GLP1_NOTES[glp1]:
        notes.append(GLP1_NOTES[glp1][stretch]["wellness"][0])
    elif glp1 == "yes":
        notes.append("On a GLP-1 — appetite and digestion can shift; small, regular meals and steady hydration help.")
    elif glp1 == "starting":
        notes.append("Starting a GLP-1 — begin in a week your stomach is calm (follicular is gentlest; avoid the late-cycle bloat window).")
    return notes


def _glp1_muscle_notes(profile: dict[str, Any], stretch: Optional[str] = None) -> tuple[list[str], list[str]]:
    """GLP-1 guidance keyed to the current stretch (GLP-1s blunt appetite and
    accelerate muscle loss). Falls back to generic advice when there is no
    cycle to match (menopause / no data)."""
    glp1 = profile.get("glp1", "no")
    if glp1 in GLP1_NOTES and stretch in GLP1_NOTES[glp1]:
        entry = GLP1_NOTES[glp1][stretch]
        return list(entry["training"]), list(entry["diet"])
    if glp1 in _GLP1_GENERIC:
        train, diet = _GLP1_GENERIC[glp1]
        return list(train), list(diet)
    return [], []


def recommend(profile: dict[str, Any], stretch: Optional[str], stage: str) -> dict[str, Any]:
    """Assemble personalized recommendations for the current stretch + profile."""
    dims = ["training", "diet", "social_love", "work_focus"]

    if stage == "menopause" or stretch is None:
        # No cycle to match: stage-level guidance only.
        recs = {d: list(STAGE_OVERRIDES["menopause"][d]) for d in dims}
        glp1_train, glp1_diet = _glp1_muscle_notes(profile, stretch)
        recs["training"].extend(glp1_train)
        recs["diet"].extend(glp1_diet)
        headline = "Post-menopause: steady-state planning"
        result = {"headline": headline, **recs}
        wellness = _wellness(profile, stretch)
        if wellness:
            result["wellness"] = wellness
        return result

    base = {d: list(BASE_RECS[stretch][d]) for d in dims}

    # Apply profile modifiers for the current stretch.
    modifier_map = (
        ("training", "training", "training"),
        ("workout_frequency", "workout_frequency", "training"),
        ("diet", "diet", "diet"),
        ("social", "social", "social_love"),
        ("relationship", "relationship", "social_love"),
    )
    for mod_dim, key_field, target in modifier_map:
        table = MODIFIERS.get(mod_dim, {}).get(profile.get(key_field), {})
        for line in table.get(stretch, []):
            base[target].append(line)

    # Stage-level overrides append (perimenopause caveats ride on top of the stretch).
    if stage in ("perimenopause", "very_early_perimenopause"):
        for d in dims:
            base[d].extend(STAGE_OVERRIDES["perimenopause"][d])

    # GLP-1s accelerate muscle loss — bias toward strength training + protein.
    glp1_train, glp1_diet = _glp1_muscle_notes(profile, stretch)
    base["training"].extend(glp1_train)
    base["diet"].extend(glp1_diet)

    headline = STRETCHES[stretch]["label"]
    if stage in ("perimenopause", "very_early_perimenopause"):
        headline += " — but trust your body over the day number"
    result = {"headline": headline, **base}
    wellness = _wellness(profile, stretch)
    if wellness:
        result["wellness"] = wellness
    return result


def full_cycle_plan(profile: dict[str, Any], stage: str) -> dict[str, dict[str, Any]]:
    """Recommendations for every stretch of the cycle (not just today's), so the
    user can plan ahead and the print / Notion / ICS exports stay useful for
    any week. Callers must guard for a non-cycling user (menopause / no data)."""
    return {p: recommend(profile, p, stage) for p in STRETCHES}


def workout_type(stretch: str, training: str) -> str:
    """Best workout type for a stretch, adjusted to the user's program (lift | yoga | cardio)."""
    if stretch == "menstrual":
        return "yoga"          # everyone de-loads gently
    if training == "light":
        return "yoga"          # pilates / yoga program
    if training == "cardio":
        return "cardio"        # endurance program
    if stretch == "late_luteal":
        return "cardio"        # de-load week (heavy / moderate / mix)
    return "lift"              # follicular / ovulatory / early_luteal strength window


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def _fertility_summary(
    calendar: list[dict[str, Any]],
    cycle_length: int,
    today: date,
    stage: str,
) -> dict[str, Any]:
    """Aggregate the per-day fertility flags into a summary (TTC only)."""
    ovu = cycle_length - LUTEAL_DAYS
    fertile_dates = [d["date"] for d in calendar if d.get("fertile")]
    peak_dates = [d["date"] for d in calendar if d.get("peak")]
    ovu_dates = [d["date"] for d in calendar if d.get("ovulation")]
    today_s = today.isoformat()
    upcoming = [d for d in ovu_dates if d >= today_s]
    next_ovu = upcoming[0] if upcoming else (ovu_dates[-1] if ovu_dates else None)
    next_fertile_start = next_fertile_end = None
    if next_ovu:
        next_fertile_end = next_ovu
        next_fertile_start = (
            date.fromisoformat(next_ovu) - timedelta(days=FERTILE_LEAD_DAYS)
        ).isoformat()
    if stage in ("perimenopause", "very_early_perimenopause"):
        note = (
            "Ovulation is less predictable in perimenopause, so these are rough "
            "estimates, not a sure window. Ovulation tests (LH strips) or a "
            "clinician can confirm your actual fertile days."
        )
    else:
        note = (
            "Based on your average cycle. Sperm can live up to 5 days, so the "
            "window includes the 5 days before ovulation."
        )
    return {
        "enabled": True,
        "ovulation_day_of_cycle": ovu,
        "fertile_dates": fertile_dates,
        "peak_dates": peak_dates,
        "ovulation_dates": ovu_dates,
        "next_ovulation": next_ovu,
        "next_fertile_start": next_fertile_start,
        "next_fertile_end": next_fertile_end,
        "today_in_window": today_s in fertile_dates,
        "today_peak": today_s in peak_dates,
        "note": note,
    }


def read(profile: dict[str, Any]) -> dict[str, Any]:
    """Full engine entry point. `profile` is the raw API payload."""
    age = int(profile.get("age", 35))
    starts = _sort_starts(profile.get("period_starts", []) or [])
    stage, stage_reasoning, peri_signals = detect_stage(
        age,
        profile.get("stage", "auto"),
        profile.get("peri_symptoms"),
        starts,
    )

    # The client always sends its local 'today'; this fallback (server-local)
    # is only hit for direct API calls made without a `today` field.
    today = date.fromisoformat(profile["today"]) if profile.get("today") else date.today()

    cycle = compute_cycle(
        starts,
        today,
        cycle_length_override=profile.get("cycle_length"),
        period_length=int(profile.get("period_length", 5)),
    )

    if stage == "menopause" or not starts:
        # No active cycle -> no stretch calendar. Post-menopause guidance.
        stretch = None
        cycle_day = cycle["cycle_day"]
    else:
        cycle_day = cycle["cycle_day"]
        stretch = stretch_for(cycle_day, cycle["cycle_length"], cycle["period_length"]) if cycle_day else None

    calendar = build_calendar(
        starts, cycle["cycle_length"], cycle["period_length"], today
    ) if (starts and stage != "menopause") else []

    recs = recommend(profile, stretch, stage)
    workout_types = {p: workout_type(p, profile.get("training", "mix")) for p in STRETCHES}
    cycle_plan = full_cycle_plan(profile, stage) if (starts and stage != "menopause") else {}

    ttc = profile.get("ttc", "no") == "yes"
    fertility = None
    if ttc and starts and stage != "menopause":
        fertility = _fertility_summary(calendar, cycle["cycle_length"], today, stage)

    return {
        "today": today.isoformat(),
        "age": age,
        "stage": stage,
        "stage_reasoning": stage_reasoning,
        "peri_signals": peri_signals,
        "cycling": stage != "menopause" and bool(starts),
        "cycle_day": cycle_day,
        "cycle_length": cycle["cycle_length"],
        "period_length": cycle["period_length"],
        "confidence": cycle["confidence"],
        "next_period": cycle["next_period"],
        "days_to_next": cycle["days_to_next"],
        "overdue_days": cycle["overdue_days"],
        "stretch": stretch,
        "stretch_meta": STRETCHES[stretch] if stretch else None,
        "calendar": calendar,
        "recommendations": recs,
        "workout_types": workout_types,
        "cycle_plan": cycle_plan,
        "fertility": fertility,
        "disclaimer": (
            "General wellness guidance, not medical advice. Perimenopause and "
            "menopause in particular deserve a clinician's input."
        ),
    }
