/* Aura Cycles — The Aura Engine (JS port of engine.py)
 *
 * Trust layer: pure functions, no I/O, no LLM, no side effects.
 * Period dates + a short lifestyle profile in -> cycle day, stretch, a
 * color-coded calendar, and personalized recommendations out. Nothing here
 * can hallucinate.
 *
 * NOT medical advice. Wellness / life-planning tool only.
 *
 * Dates are ISO strings "YYYY-MM-DD"; day arithmetic is done in UTC so the
 * engine is timezone-stable and matches engine.py exactly.
 */
(function (global) {
  "use strict";

  var DAY_MS = 86400000;

  // ---- date helpers (UTC midnight) ----
  function utcMidnight(iso) {
    var p = iso.split("-");
    return Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }
  function isoOf(ms) {
    var dt = new Date(ms);
    var y = dt.getUTCFullYear();
    var m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    var d = String(dt.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  function addDays(iso, n) {
    return isoOf(utcMidnight(iso) + n * DAY_MS);
  }
  function daysBetween(aIso, bIso) {
    return Math.round((utcMidnight(bIso) - utcMidnight(aIso)) / DAY_MS);
  }
  function weekdayLetter(iso) {
    return ["S", "M", "T", "W", "T", "F", "S"][new Date(utcMidnight(iso)).getUTCDay()];
  }
  function utcToday() {
    return isoOf(Date.now());
  }
  // Python's round() uses banker's rounding (ties to even) — match it exactly
  // so cycle_length is byte-identical to engine.py.
  function pyRound(x) {
    var f = Math.floor(x);
    var d = x - f;
    if (d < 0.5) return f;
    if (d > 0.5) return f + 1;
    return (f % 2 === 0) ? f : f + 1;
  }

  // -------------------------------------------------------------------------
  // Stretches (28-day-normalized frame; fixed ~14-day luteal)
  // -------------------------------------------------------------------------
  var STRETCHES = {
    menstrual: {
      label: "Rest & Renew",
      emoji: "🌙",
      color: "#D1188B",
      blurb: "Rest and recover. Low impact, review, and admin — not new launches.",
    },
    follicular: {
      label: "Follicular Rise",
      emoji: "🌱",
      color: "#00B7C9",
      blurb: "Rising energy. Your boldest window — create, learn, launch, push.",
    },
    ovulatory: {
      label: "Ovulation Glow",
      emoji: "🔥",
      color: "#FF6AD5",
      blurb: "BOSS MODE. Peak energy, confidence, and magnetism. High-stakes everything.",
    },
    early_luteal: {
      label: "Luteal Flow",
      emoji: "🍂",
      color: "#8B5CF6",
      blurb: "Execution and finishing. Detail work and error-catching — steady, not max.",
    },
    late_luteal: {
      label: "Reflect & Rest",
      emoji: "🌀",
      color: "#3B82F6",
      blurb: "Protect the calendar. Editing and admin only. Rest, de-load, go inward.",
    },
  };

  var LUTEAL_DAYS = 14;

  // Fertility window (TTC): sperm survive up to ~5 days and the egg ~12-24h,
  // so the fertile window is the 6 days ending on ovulation day. Peak = the
  // day before + day of ovulation (highest conception probability).
  var FERTILE_LEAD_DAYS = 5;
  var PEAK_LEAD_DAYS = 1;

  // CEMCOR "very early perimenopause" criteria — any 3 of 9 changes.
  var PERI_SYMPTOMS = {
    heavy_flow: "New heavy and/or longer menstrual flow",
    shorter_cycle: "Shorter cycles (25 days or fewer)",
    breast_changes: "New sore, swollen, or lumpy breasts",
    cramps: "New or increased menstrual cramps",
    mid_sleep: "New mid-sleep wakening",
    night_sweats: "Night sweats, especially around your period",
    migraine: "New or much worse migraine headaches",
    mood_swings: "New or worse premenstrual mood swings",
    weight_gain: "Weight gain without changing food or exercise",
  };
  var PERI_VARIABILITY_DAYS = 7;
  var PERI_SHORT_CYCLE_DAYS = 25;

  // -------------------------------------------------------------------------
  // Reproductive stage
  // -------------------------------------------------------------------------
  function infer_stage(age) {
    if (age < 40) return "regular";
    if (age < 50) return "perimenopause";
    return "menopause";
  }

  function resolve_stage(stage, age) {
    if (stage !== "regular" && stage !== "perimenopause" && stage !== "very_early_perimenopause" && stage !== "menopause") {
      stage = infer_stage(age);
      return [stage, "Guessed from age " + age + " (population average — confirm for yourself)."];
    }
    return [stage, "Provided by you."];
  }

  function cycle_variability(starts) {
    if (starts.length < 3) return null;
    var gaps = [];
    for (var i = 1; i < starts.length; i++) {
      var g = daysBetween(starts[i - 1], starts[i]);
      if (g >= 15 && g <= 45) gaps.push(g);
    }
    if (gaps.length < 2) return null;
    return Math.max.apply(null, gaps) - Math.min.apply(null, gaps);
  }

  function detect_perimenopause(age, peri_symptoms, cycle_length, cycle_variance) {
    var signals = [];
    var selected = (peri_symptoms || []).filter(function (s) {
      return Object.prototype.hasOwnProperty.call(PERI_SYMPTOMS, s);
    });
    if (selected.length >= 3) signals.push(selected.length + " of 9 characteristic changes");
    if (cycle_length != null && cycle_length <= PERI_SHORT_CYCLE_DAYS) {
      signals.push("cycle length " + Math.round(cycle_length) + " days (≤ " + PERI_SHORT_CYCLE_DAYS + ")");
    }
    if (cycle_variance != null && cycle_variance >= PERI_VARIABILITY_DAYS) {
      signals.push("cycle length varies " + Math.round(cycle_variance) + "+ days");
    }
    return [signals.length > 0, signals];
  }

  function detect_stage(age, stage_choice, peri_symptoms, starts) {
    if (stage_choice === "regular" || stage_choice === "perimenopause" || stage_choice === "very_early_perimenopause" || stage_choice === "menopause") {
      return [stage_choice, "Provided by you.", []];
    }
    starts = starts || [];
    var avg = avg_cycle_length(starts);
    var variability = cycle_variability(starts);
    var selected = (peri_symptoms || []).filter(function (s) {
      return Object.prototype.hasOwnProperty.call(PERI_SYMPTOMS, s);
    });
    if (selected.length >= 3) {
      var reasoning = 'CEMCOR "very early perimenopause": ' + selected.length
        + ' of 9 characteristic changes present. Not a diagnosis — confirm with a clinician.';
      return ["very_early_perimenopause", reasoning, [selected.length + " of 9 characteristic changes"]];
    }
    var dp = detect_perimenopause(age, peri_symptoms, avg, variability);
    if (dp[0]) {
      var reasoning = "Signs of perimenopause: " + dp[1].join("; ")
        + ". Not a diagnosis — confirm with a clinician.";
      return ["perimenopause", reasoning, dp[1]];
    }
    return [infer_stage(age), "Guessed from age " + age + " (population average — confirm for yourself).", []];
  }

  // -------------------------------------------------------------------------
  // Cycle math
  // -------------------------------------------------------------------------
  function _sort_starts(starts) {
    var out = [];
    (starts || []).forEach(function (s) {
      if (s && out.indexOf(s) === -1) out.push(s);
    });
    out.sort();
    return out;
  }

  function avg_cycle_length(starts) {
    if (starts.length < 2) return null;
    var gaps = [];
    for (var i = 1; i < starts.length; i++) gaps.push(daysBetween(starts[i - 1], starts[i]));
    var valid = gaps.filter(function (g) { return g >= 15 && g <= 45; });
    if (!valid.length) return null;
    return valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
  }

  function compute_cycle(starts, today, cycle_length_override, period_length) {
    if (period_length == null) period_length = 5;
    starts = _sort_starts(starts);
    if (!starts.length) {
      return {
        cycling: true,
        cycle_day: null,
        cycle_length: cycle_length_override || 28,
        period_length: period_length,
        next_period: null,
        days_to_next: null,
        overdue_days: null,
        confidence: "low",
      };
    }

    var last = starts[starts.length - 1];
    var avg = avg_cycle_length(starts);
    var cycle_length = avg ? (cycle_length_override || pyRound(avg)) : 28;

    var confidence;
    if (avg == null) {
      confidence = "low";
    } else {
      var gaps = [];
      for (var i = 1; i < starts.length; i++) gaps.push(daysBetween(starts[i - 1], starts[i]));
      var spread = gaps.length ? Math.max.apply(null, gaps) - Math.min.apply(null, gaps) : 0;
      confidence = spread <= 2 ? "high" : (spread <= 5 ? "medium" : "low");
    }

    var cycle_day = daysBetween(last, today) + 1;
    if (cycle_day < 1) cycle_day = null;

    var next_period = addDays(last, cycle_length);
    var days_to_next = daysBetween(today, next_period);
    var overdue_days = Math.max(0, daysBetween(next_period, today));

    return {
      cycling: true,
      cycle_day: cycle_day,
      cycle_length: cycle_length,
      period_length: period_length,
      next_period: next_period,
      days_to_next: days_to_next,
      overdue_days: overdue_days,
      confidence: confidence,
    };
  }

  function stretch_for(cycle_day, cycle_length, period_length) {
    if (cycle_day == null || cycle_day < 1 || cycle_day > cycle_length + 14) return null;
    var ovu = cycle_length - LUTEAL_DAYS;
    if (cycle_day <= period_length) return "menstrual";
    if (cycle_day < ovu - 1) return "follicular";
    if (ovu - 1 <= cycle_day && cycle_day <= ovu + 1) return "ovulatory";
    if (cycle_day < cycle_length - 5) return "early_luteal";
    return "late_luteal";
  }

  function fertility_flags(cycle_day, cycle_length) {
    if (cycle_day == null || cycle_day < 1) return [false, false, false];
    var ovu = cycle_length - LUTEAL_DAYS;
    if (ovu < 1) return [false, false, false];
    var fertile = ovu - FERTILE_LEAD_DAYS <= cycle_day && cycle_day <= ovu;
    var peak = ovu - PEAK_LEAD_DAYS <= cycle_day && cycle_day <= ovu;
    return [fertile, peak, cycle_day === ovu];
  }

  // -------------------------------------------------------------------------
  // Calendar projection
  // -------------------------------------------------------------------------
  function build_calendar(starts, cycle_length, period_length, today, months) {
    if (months == null) months = 2;
    starts = _sort_starts(starts);

    var all_starts = starts.slice();
    if (starts.length) {
      var cursor = addDays(starts[starts.length - 1], cycle_length);
      var horizon = addDays(today, months * 31);
      while (cursor <= horizon) {
        all_starts.push(cursor);
        cursor = addDays(cursor, cycle_length);
      }
    }
    var seen = {};
    var all_starts_sorted = [];
    all_starts.forEach(function (s) { if (!seen[s]) { seen[s] = true; all_starts_sorted.push(s); } });
    all_starts_sorted.sort();
    var startSet = {};
    starts.forEach(function (s) { startSet[s] = true; });

    var t = new Date(utcMidnight(today));
    var first = isoOf(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
    var last_day = addDays(isoOf(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + months, 1)), -1);

    var days = [];
    var d = first;
    while (d <= last_day) {
      var s = null;
      for (var k = 0; k < all_starts_sorted.length; k++) {
        if (all_starts_sorted[k] <= d) s = all_starts_sorted[k]; else break;
      }
      var is_start = seen[d] === true;
      var cd = null;
      if (s != null) {
        cd = daysBetween(s, d) + 1;
        if (cd > cycle_length + 14) cd = null;
      }
      var stretch = cd ? stretch_for(cd, cycle_length, period_length) : null;
      var ff = fertility_flags(cd, cycle_length);
      days.push({
        date: d,
        day: new Date(utcMidnight(d)).getUTCDate(),
        weekday: weekdayLetter(d),
        cycle_day: cd,
        stretch: stretch,
        fertile: ff[0],
        peak: ff[1],
        ovulation: ff[2],
        is_today: d === today,
        is_start: is_start,
        is_projected: is_start && !startSet[d],
      });
      d = addDays(d, 1);
    }
    return days;
  }

  // -------------------------------------------------------------------------
  // Recommendation copy (rule-based)
  // -------------------------------------------------------------------------
  var BASE_RECS = {
    menstrual: {
      training: [
        "De-load — low impact, walking, gentle mobility over heavy lifts.",
        "Don't chase PRs while you're bleeding; recovery is the win this week.",
      ],
      diet: [
        "Eat warm, iron-rich food (soups, stews, leafy greens, red meat) — you're losing iron with your period.",
        "Magnesium for cramps, and hydrate with electrolytes.",
      ],
      social_love: [
        "Social battery is lower — keep plans light and low-key.",
        "Rest is productive here; you don't owe anyone peak-you.",
      ],
      work_focus: [
        "Review, admin, and planning — not new launches or cold outreach.",
        "Let ideas percolate; execution energy returns soon.",
      ],
    },
    follicular: {
      training: [
        "Your strength window — progressive overload, heavier lifts, more volume.",
        "Energy and recovery are rising; push intensity now.",
      ],
      diet: [
        "Body tolerates lighter, varied food — lots of veg and lean protein.",
        "Appetite is steadier here; a good window for clean-eating momentum.",
      ],
      social_love: [
        "Outgoing and magnetic — great for new connections and saying yes.",
        "A strong window for dates and meeting new people.",
      ],
      work_focus: [
        "Launch, create, learn, cold outreach — your boldest window.",
        "New projects and pitches land well now.",
      ],
    },
    ovulatory: {
      training: [
        "Peak performance — max effort, test your PRs, compete if you do.",
        "Power and coordination are at their highest all cycle.",
      ],
      diet: [
        "Light, fresh, high-energy food — you're firing on all cylinders.",
        "Keep protein up to recover from hard sessions.",
      ],
      social_love: [
        "BOSS MODE — your most confident, articulate, magnetic days.",
        "Book the big meeting, the pitch, the date, the party.",
      ],
      work_focus: [
        "High-stakes everything: pitch, negotiate, present, network.",
        "This is your extrovert window — front-load the scary stuff.",
      ],
    },
    early_luteal: {
      training: [
        "Shift to moderate weights, higher volume, lower max.",
        "Energy is still good but trending down — maintain, don't max.",
      ],
      diet: [
        "Progesterone is rising — steady blood sugar helps mood and cravings.",
        "Complex carbs + magnesium are your friends this week.",
      ],
      social_love: [
        "Still social, but starting to prefer familiar company.",
        "Good for deepening connections rather than new crowds.",
      ],
      work_focus: [
        "Execution, finishing, detail work, error-catching.",
        "Wrap things already in motion; hold new high-stakes conversations.",
      ],
    },
    late_luteal: {
      training: [
        "De-load week — steady cardio, mobility, lighter lifts.",
        "Progesterone raises injury risk (joint laxity) — protect tendons.",
      ],
      diet: [
        "Carb cravings are normal — lean into complex carbs, don't fight them.",
        "Magnesium + electrolytes; ease caffeine if sleep is dipping.",
      ],
      social_love: [
        "Protect your calendar — social battery is low.",
        "Honor the inward pull; rest now and re-emerge next week.",
      ],
      work_focus: [
        "Editing and admin only — no big decisions or cold outreach.",
        "Guard against decision fatigue; push major moves to next week.",
      ],
    },
  };

  var MODIFIERS = {
    training: {
      heavy: {
        follicular: ["This is your PR window — load up and go heavy."],
        late_luteal: ["You can still lift, but back max effort off ~10–15% to protect joints."],
      },
      light: {
        follicular: ["Your low-impact base is great — add a little strength now for bone health."],
      },
      cardio: {
        late_luteal: ["Steady-state cardio suits this stretch of the cycle perfectly — keep it easy."],
      },
    },
    workout_frequency: {
      daily: {
        late_luteal: ["You train a lot — this de-load week is non-negotiable for recovery."],
      },
      "5x": {
        late_luteal: ["Five days a week is a lot — protect one as a true recovery day this week."],
      },
      "1x": {
        follicular: ["Even one solid strength session this week beats two scattered ones later."],
      },
    },
    diet: {
      "low-carb": {
        late_luteal: ["Luteal carb cravings may hit harder — allow clean complex carbs; don't white-knuckle it."],
      },
      vegan: {
        menstrual: ["Plant iron + vitamin C matters most now; consider B12 if you don't already."],
      },
      vegetarian: {
        menstrual: ["Keep iron up while bleeding — pair leafy greens with vitamin C; eggs and dairy cover B12."],
      },
      pescatarian: {
        menstrual: ["Omega-3s from fish can ease cramps, and seafood iron helps during your period."],
      },
      "gluten-free": {
        late_luteal: ["Cravings will hit — stock gluten-free complex carbs (oats, rice, sweet potato) ahead of time."],
      },
      "if": {
        late_luteal: ["Consider loosening your fasting window — hunger cues rise late-cycle."],
      },
      "high-protein": {
        late_luteal: ["You're already nailing protein — keep it up through luteal for satiety."],
      },
    },
    social: {
      rarely: {
        ovulatory: ["The easiest time to stretch your social comfort zone — use it."],
        follicular: ["A good week to schedule the one social thing you've been putting off."],
      },
      daily: {
        late_luteal: ["Protect this week; it's okay to say no without guilt."],
      },
    },
    relationship: {
      single: {
        ovulatory: ["Your best window for meeting people and dating — put yourself out there."],
        follicular: ["High-confidence days — good for first dates."],
      },
      relationship: {
        ovulatory: ["Libido peaks here — plan quality time now."],
        late_luteal: ["Libido dips late-cycle — don't read the dip as distance; it's hormonal."],
      },
    },
  };

  var STAGE_OVERRIDES = {
    perimenopause: {
      training: [
        "Cycles are shifting — plan by how you feel, not strictly by the day number.",
        "Ovulation gets less predictable in perimenopause, so treat your stretch as a best-guess, not a rule.",
        "Strength training is your best friend now for bone + muscle retention.",
      ],
      diet: [
        "New GI symptoms can appear — log them to spot patterns vs. one-offs.",
      ],
      social_love: [
        "Hot flashes or sleep dips can hit anytime — keep evenings flexible.",
      ],
      work_focus: [
        "Block deep work around your real energy, not a fixed calendar.",
      ],
    },
    menopause: {
      training: [
        "Strength training becomes non-negotiable — bone density and muscle.",
        "Moderate cardio for heart health, plus balance and mobility work.",
      ],
      diet: [
        "Protein at every meal, calcium + vitamin D, and plenty of fiber.",
      ],
      social_love: [
        "Energy is steadier now — no hormonal swings to schedule around.",
        "Routine and consistency serve you well.",
      ],
      work_focus: [
        "No monthly swing — you can schedule consistently.",
        "Protect sleep and stress; they matter more now than any monthly swing ever did.",
      ],
    },
  };

  function _wellness(profile) {
    var notes = [];
    var hrt = profile.hrt || "no";
    var glp1 = profile.glp1 || "no";
    if (hrt === "yes") {
      notes.push("On HRT — symptoms may feel steadier, but still plan around how you actually feel.");
    } else if (hrt === "considering") {
      notes.push("Considering HRT — log symptoms for a few weeks; it's the best data to bring to a clinician.");
    }
    if (glp1 === "yes") {
      notes.push("On a GLP-1 — appetite and digestion can shift; small, regular meals and steady hydration help.");
    } else if (glp1 === "starting") {
      notes.push("Starting a GLP-1 — begin in a week your stomach is calm (follicular is gentlest; avoid the late-cycle bloat window).");
    }
    return notes;
  }

  function _glp1_muscle_notes(profile) {
    var training = [];
    var diet = [];
    var glp1 = profile.glp1 || "no";
    if (glp1 === "yes") {
      training.push("On a GLP-1, make strength training your backbone — it protects muscle mass as weight comes off.");
      diet.push("On a GLP-1, lead with protein (about 1.6 g per kg of body weight a day) to hold onto muscle in a deficit.");
    } else if (glp1 === "starting") {
      training.push("Starting a GLP-1 — add strength training now, so you protect muscle from the very first week.");
      diet.push("Starting a GLP-1 — front-load protein now so muscle isn't the first thing to go.");
    }
    return [training, diet];
  }

  function recommend(profile, stretch, stage) {
    var dims = ["training", "diet", "social_love", "work_focus"];

    if (stage === "menopause" || stretch == null) {
      var recs = {};
      dims.forEach(function (d) { recs[d] = STAGE_OVERRIDES.menopause[d].slice(); });
      var g1 = _glp1_muscle_notes(profile);
      recs.training = recs.training.concat(g1[0]);
      recs.diet = recs.diet.concat(g1[1]);
      var result = { headline: "Post-menopause: steady-state planning" };
      Object.keys(recs).forEach(function (k) { result[k] = recs[k]; });
      var w = _wellness(profile);
      if (w.length) result.wellness = w;
      return result;
    }

    var base = {};
    dims.forEach(function (d) { base[d] = BASE_RECS[stretch][d].slice(); });

    var modifier_map = [
      ["training", "training", "training"],
      ["workout_frequency", "workout_frequency", "training"],
      ["diet", "diet", "diet"],
      ["social", "social", "social_love"],
      ["relationship", "relationship", "social_love"],
    ];
    modifier_map.forEach(function (row) {
      var mod_dim = row[0], key_field = row[1], target = row[2];
      var table = ((MODIFIERS[mod_dim] || {})[profile[key_field]]) || {};
      var lines = table[stretch] || [];
      lines.forEach(function (line) { base[target].push(line); });
    });

    if (stage === "perimenopause" || stage === "very_early_perimenopause") {
      dims.forEach(function (d) {
        base[d] = base[d].concat(STAGE_OVERRIDES.perimenopause[d]);
      });
    }

    var g2 = _glp1_muscle_notes(profile);
    base.training = base.training.concat(g2[0]);
    base.diet = base.diet.concat(g2[1]);

    var headline = STRETCHES[stretch].label;
    if (stage === "perimenopause" || stage === "very_early_perimenopause") headline += " — but trust your body over the day number";
    var result2 = { headline: headline };
    Object.keys(base).forEach(function (k) { result2[k] = base[k]; });
    var w2 = _wellness(profile);
    if (w2.length) result2.wellness = w2;
    return result2;
  }

  function full_cycle_plan(profile, stage) {
    var plan = {};
    Object.keys(STRETCHES).forEach(function (p) {
      plan[p] = recommend(profile, p, stage);
    });
    return plan;
  }

  function workout_type(stretch, training) {
    if (stretch === "menstrual") return "yoga";
    if (training === "light") return "yoga";
    if (training === "cardio") return "cardio";
    if (stretch === "late_luteal") return "cardio";
    return "lift";
  }

  // -------------------------------------------------------------------------
  // Orchestration
  // -------------------------------------------------------------------------
  function _fertility_summary(calendar, cycle_length, today, stage) {
    var ovu = cycle_length - LUTEAL_DAYS;
    var fertile_dates = [], peak_dates = [], ovu_dates = [];
    calendar.forEach(function (d) {
      if (d.fertile) fertile_dates.push(d.date);
      if (d.peak) peak_dates.push(d.date);
      if (d.ovulation) ovu_dates.push(d.date);
    });
    var upcoming = ovu_dates.filter(function (x) { return x >= today; });
    var next_ovu = upcoming.length ? upcoming[0] : (ovu_dates.length ? ovu_dates[ovu_dates.length - 1] : null);
    var next_fertile_start = null, next_fertile_end = null;
    if (next_ovu) {
      next_fertile_end = next_ovu;
      next_fertile_start = addDays(next_ovu, -FERTILE_LEAD_DAYS);
    }
    var note;
    if (stage === "perimenopause" || stage === "very_early_perimenopause") {
      note = "Ovulation is less predictable in perimenopause, so these are rough estimates, not a sure window. Ovulation tests (LH strips) or a clinician can confirm your actual fertile days.";
    } else {
      note = "Based on your average cycle. Sperm can live up to 5 days, so the window includes the 5 days before ovulation.";
    }
    return {
      enabled: true,
      ovulation_day_of_cycle: ovu,
      fertile_dates: fertile_dates,
      peak_dates: peak_dates,
      ovulation_dates: ovu_dates,
      next_ovulation: next_ovu,
      next_fertile_start: next_fertile_start,
      next_fertile_end: next_fertile_end,
      today_in_window: fertile_dates.indexOf(today) !== -1,
      today_peak: peak_dates.indexOf(today) !== -1,
      note: note,
    };
  }

  function read(profile) {
    var age = profile.age != null ? parseInt(profile.age, 10) : 35;
    if (isNaN(age)) age = 35;
    var starts = _sort_starts(profile.period_starts || []);
    var ds = detect_stage(age, profile.stage || "auto", profile.peri_symptoms, starts);
    var stage = ds[0], stage_reasoning = ds[1], peri_signals = ds[2];

    var today = profile.today || utcToday();

    var cycle = compute_cycle(
      starts,
      today,
      profile.cycle_length != null ? profile.cycle_length : null,
      profile.period_length != null ? parseInt(profile.period_length, 10) : 5
    );
    if (isNaN(cycle.period_length)) cycle.period_length = 5;

    var stretch, cycle_day;
    if (stage === "menopause" || !starts.length) {
      stretch = null;
      cycle_day = cycle.cycle_day;
    } else {
      cycle_day = cycle.cycle_day;
      stretch = cycle_day ? stretch_for(cycle_day, cycle.cycle_length, cycle.period_length) : null;
    }

    var calendar = (starts.length && stage !== "menopause")
      ? build_calendar(starts, cycle.cycle_length, cycle.period_length, today)
      : [];

    var recs = recommend(profile, stretch, stage);

    var workout_types = {};
    Object.keys(STRETCHES).forEach(function (p) {
      workout_types[p] = workout_type(p, profile.training || "mix");
    });

    var cycle_plan = (starts.length && stage !== "menopause")
      ? full_cycle_plan(profile, stage)
      : {};

    var ttc = profile.ttc === "yes";
    var fertility = null;
    if (ttc && starts.length && stage !== "menopause") {
      fertility = _fertility_summary(calendar, cycle.cycle_length, today, stage);
    }

    return {
      today: today,
      age: age,
      stage: stage,
      stage_reasoning: stage_reasoning,
      peri_signals: peri_signals,
      cycling: stage !== "menopause" && starts.length > 0,
      cycle_day: cycle_day,
      cycle_length: cycle.cycle_length,
      period_length: cycle.period_length,
      confidence: cycle.confidence,
      next_period: cycle.next_period,
      days_to_next: cycle.days_to_next,
      overdue_days: cycle.overdue_days,
      stretch: stretch,
      stretch_meta: stretch ? STRETCHES[stretch] : null,
      calendar: calendar,
      recommendations: recs,
      workout_types: workout_types,
      cycle_plan: cycle_plan,
      fertility: fertility,
      disclaimer: "General wellness guidance, not medical advice. Perimenopause and menopause in particular deserve a clinician's input.",
    };
  }

  // Expose the engine (both browser global and Node require()).
  var api = {
    STRETCHES: STRETCHES,
    LUTEAL_DAYS: LUTEAL_DAYS,
    PERI_SYMPTOMS: PERI_SYMPTOMS,
    infer_stage: infer_stage,
    resolve_stage: resolve_stage,
    cycle_variability: cycle_variability,
    detect_perimenopause: detect_perimenopause,
    detect_stage: detect_stage,
    _sort_starts: _sort_starts,
    avg_cycle_length: avg_cycle_length,
    compute_cycle: compute_cycle,
    stretch_for: stretch_for,
    fertility_flags: fertility_flags,
    build_calendar: build_calendar,
    BASE_RECS: BASE_RECS,
    MODIFIERS: MODIFIERS,
    STAGE_OVERRIDES: STAGE_OVERRIDES,
    _wellness: _wellness,
    _glp1_muscle_notes: _glp1_muscle_notes,
    recommend: recommend,
    full_cycle_plan: full_cycle_plan,
    workout_type: workout_type,
    _fertility_summary: _fertility_summary,
    read: read,
  };

  global.AuraEngine = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
