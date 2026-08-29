"use strict";

const $ = (id) => document.getElementById(id);
const LS_PROFILE = "aura:profile";
const LS_SYMPTOMS = "aura:symptoms";

const STRETCH_ICONS = { menstrual: "🌙", follicular: "🌱", ovulatory: "✨", early_luteal: "🌊", late_luteal: "🌀" };
const STRETCH_COLORS = { menstrual: "#A25A61", follicular: "#2E7FA1", ovulatory: "#F2B996", early_luteal: "#C56F4F", late_luteal: "#5B5366" };
const STRETCH_NAMES = { menstrual: "Rest & Renew", follicular: "Follicular Rise", ovulatory: "Ovulation Glow", early_luteal: "Luteal Flow", late_luteal: "Reflect & Rest" };
const STRETCH_TAGLINES = { menstrual: "rest, release, begin again", follicular: "estrogen climbs, energy returns", ovulatory: "peak power, magnetic energy", early_luteal: "progesterone rises, the shift inward", late_luteal: "slow down, tie up loose ends" };
const SYMPTOM_OPTIONS = ["cramps", "bloating", "headache", "fatigue", "nausea", "mood", "cravings", "insomnia"];

const SIGNS = {
  aries: { name: "Aries", emoji: "♈", element: "Fire", trait: "boldness and a quick-start instinct", shadow: "impatience and burnout" },
  taurus: { name: "Taurus", emoji: "♉", element: "Earth", trait: "steadiness and a love of comfort", shadow: "inertia and over-indulgence" },
  gemini: { name: "Gemini", emoji: "♊", element: "Air", trait: "curiosity and quick wit", shadow: "scattered focus and restlessness" },
  cancer: { name: "Cancer", emoji: "♋", element: "Water", trait: "intuition and a nurturing instinct", shadow: "mood swings and withdrawal" },
  leo: { name: "Leo", emoji: "♌", element: "Fire", trait: "confidence and warmth", shadow: "pride and craving the spotlight" },
  virgo: { name: "Virgo", emoji: "♍", element: "Earth", trait: "precision and a keen eye", shadow: "overthinking and self-criticism" },
  libra: { name: "Libra", emoji: "♎", element: "Air", trait: "a knack for harmony and charm", shadow: "indecision and people-pleasing" },
  scorpio: { name: "Scorpio", emoji: "♏", element: "Water", trait: "intensity and focus", shadow: "jealousy and brooding" },
  sagittarius: { name: "Sagittarius", emoji: "♐", element: "Fire", trait: "adventure and honesty", shadow: "restlessness and bluntness" },
  capricorn: { name: "Capricorn", emoji: "♑", element: "Earth", trait: "discipline and ambition", shadow: "workaholism and rigidity" },
  aquarius: { name: "Aquarius", emoji: "♒", element: "Air", trait: "independence and inventiveness", shadow: "detachment and contrarianism" },
  pisces: { name: "Pisces", emoji: "♓", element: "Water", trait: "empathy and imagination", shadow: "escapism and porous boundaries" },
};

// Concrete, sign-specific action per week (strength + shadow → one "do this" line).
const SIGN_ACTIONS = {
  aries: {
    menstrual: "Rest is your hardest lift — don't sprint through the low week.",
    follicular: "Your quick-start instinct is fuel — launch ONE thing, not five.",
    ovulatory: "Boldness peaks — book the pitch, the date, the stage now.",
    early_luteal: "Aim your drive at finishing — sprint the last mile, then stop.",
    late_luteal: "Impatience is loudest — don't quit, launch, or decide big this week.",
  },
  taurus: {
    menstrual: "Comfort is medicine — slow food, warm baths, no forcing.",
    follicular: "Your steady build is a superpower — start the long project now.",
    ovulatory: "Enjoy the glow without over-indulging — treat yourself, don't undo yourself.",
    early_luteal: "Keep the steady pace — finish what you already started.",
    late_luteal: "Inertia is loudest — a tiny daily step beats waiting for motivation.",
  },
  gemini: {
    menstrual: "Give your racing mind a single thread — one book, one show, rest.",
    follicular: "Curiosity launches best when focused — pick one new skill, not six.",
    ovulatory: "Your wit is magnetic — network, pitch, talk to everyone.",
    early_luteal: "Scatter is the enemy — one task, closed, then the next.",
    late_luteal: "Restlessness peaks — don't scroll or start; edit and wind down.",
  },
  cancer: {
    menstrual: "Nurture yourself first — warm food, soft plans, early nights.",
    follicular: "Intuition plus rising energy — trust the hunch and act on it.",
    ovulatory: "Your warmth is magnetic — host, connect, deepen bonds.",
    early_luteal: "Nest and finish — home + detail work fit this week.",
    late_luteal: "Withdrawal is loudest — schedule rest, not isolation.",
  },
  leo: {
    menstrual: "Let the spotlight rest — recharge so you can shine again.",
    follicular: "Confidence is your launch fuel — create boldly, show your work.",
    ovulatory: "Shine week — the stage, the pitch, the room is yours.",
    early_luteal: "Spend pride on craft — polish your best work.",
    late_luteal: "Don't chase applause this week — it won't land the same.",
  },
  virgo: {
    menstrual: "Self-criticism is loudest when tired — gentleness, not perfection.",
    follicular: "Your precision is a weapon — plan and build the thing.",
    ovulatory: "Let the keener eye shine — present your best, then stop editing.",
    early_luteal: "Detail week is YOUR week — audit, refine, close loops.",
    late_luteal: "Overthinking peaks — log it, don't ruminate; decide next week.",
  },
  libra: {
    menstrual: "Harmony starts inside — say no to the crowd and rest.",
    follicular: "Charm plus energy — meet people, broker, pitch the partnership.",
    ovulatory: "Your diplomacy peaks — negotiate, date, host the room.",
    early_luteal: "Decide and close — balance is finishing, not endless weighing.",
    late_luteal: "People-pleasing is loudest — protect your no, keep it small.",
  },
  scorpio: {
    menstrual: "Your intensity needs rest too — a deep reset, not brooding.",
    follicular: "Focus plus rising power — go deep on the thing that matters.",
    ovulatory: "Magnetism peaks — the room feels you; use it deliberately.",
    early_luteal: "Finish with surgical focus — cut scope, close the loop.",
    late_luteal: "Brooding is loudest — journal and release, don't spiral.",
  },
  sagittarius: {
    menstrual: "Adventure can wait — a quiet reset recharges the explorer.",
    follicular: "Restlessness plus energy — go big, travel, learn, expand.",
    ovulatory: "Your honesty charms here — pitch, speak, tell the truth kindly.",
    early_luteal: "Aim the wanderlust at finishing — close loops before the next horizon.",
    late_luteal: "Bluntness is loudest — pause before you burn a bridge.",
  },
  capricorn: {
    menstrual: "Discipline includes rest — unplug and let the machine cool.",
    follicular: "Ambition plus energy — climb hard, set the goal, go.",
    ovulatory: "Your command peaks — lead the room, close the deal.",
    early_luteal: "Finish strong — but don't chain yourself to the desk.",
    late_luteal: "Workaholism is loudest — schedule rest like a meeting.",
  },
  aquarius: {
    menstrual: "Detach on purpose — rest, reflect, let ideas simmer.",
    follicular: "Inventiveness ignites — build the weird idea now.",
    ovulatory: "Your vision is magnetic — pitch the future, rally allies.",
    early_luteal: "Detachment helps finishing — ship it, don't over-iterate.",
    late_luteal: "Contrarianism is loudest — don't pick fights; write it down.",
  },
  pisces: {
    menstrual: "Your empathy needs a day off — rest, don't absorb everyone.",
    follicular: "Imagination plus momentum — create, dream, make it real.",
    ovulatory: "Your charm is dreamy — connect deeply, but keep boundaries.",
    early_luteal: "Ground the dream — finish the concrete step, then float.",
    late_luteal: "Escapism is loudest — protect the calendar and your energy.",
  },
};

const WORK_WEEK = {
  menstrual:    { best: ["Routine admin", "Review & planning"], avoid: ["Pitching / fundraising", "Sales meetings", "Presentations"] },
  follicular:   { best: ["Creative work", "Analysis & learning", "Outreach & launches"], avoid: [] },
  ovulatory:    { best: ["Pitching / fundraising", "Presentations", "Sales meetings", "Social & networking"], avoid: ["Accounting", "Deep solo focus"] },
  early_luteal: { best: ["Analysis work", "Accounting & admin", "Finishing & detail"], avoid: ["Cold outreach", "Big launches"] },
  late_luteal:  { best: ["Accounting & admin", "Editing", "Wrapping up"], avoid: ["Pitching / fundraising", "Sales meetings", "Presentations", "Creative launches"] },
};

const WORK_TYPES = [
  { type: "Analysis work", stretch: "early_luteal" },
  { type: "Sales meetings", stretch: "ovulatory" },
  { type: "Presentations", stretch: "ovulatory" },
  { type: "Pitching / raising money", stretch: "ovulatory" },
  { type: "Accounting / admin", stretch: "early_luteal" },
  { type: "Creative work", stretch: "follicular" },
  { type: "Charisma Week / Rizz Maxxing", stretch: "ovulatory" },
];

const STRETCH_BEST = {
  menstrual:    { icon: "🌙", label: "Rest & admin" },
  follicular:   { icon: "🎨", label: "Create & launch" },
  ovulatory:    { icon: "🎤", label: "Pitch & social" },
  early_luteal: { icon: "🧠", label: "Analyze & finish" },
  late_luteal:  { icon: "📝", label: "Edit & wrap" },
};

const TRAINING_TYPES = {
  lift:   { icon: "🏋️", label: "Lifting" },
  yoga:   { icon: "🤸", label: "Yoga / Pilates" },
  cardio: { icon: "🏃", label: "Cardio" },
};

const STRETCH_DIET = {
  menstrual:    { icon: "🍲", label: "Soup & iron-rich food" },
  follicular:   { icon: "🥗", label: "Light & fresh" },
  ovulatory:    { icon: "⚡", label: "High-energy food" },
  early_luteal: { icon: "🍠", label: "Complex carbs" },
  late_luteal:  { icon: "🍫", label: "Comfort carbs" },
};

const STRETCH_SOCIAL = {
  menstrual:    { icon: "🏠", label: "Rest & stay in" },
  follicular:   { icon: "💬", label: "Social & new people" },
  ovulatory:    { icon: "💃", label: "Dates & parties" },
  early_luteal: { icon: "🤝", label: "Close friends" },
  late_luteal:  { icon: "🧘", label: "Protect energy" },
};

let lastData = null;
let justSaved = false;

const form = $("form");

// ---- tab / view switching ----
function switchView(name) {
  ["today", "calendar", "insights", "you"].forEach((v) => {
    const el = document.getElementById("view-" + v);
    if (el) el.hidden = v !== name;
  });
  document.querySelectorAll(".tabbar a, .nav-app a").forEach((a) => {
    a.classList.toggle("active", a.dataset.view === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- storage helpers (everything lives in the user's browser) ----
function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ---- today, browser-local (the source of truth for "today") ----
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- form <-> profile ----
function gather() {
  const starts = ["start1", "start2", "start3"].map((id) => $(id).value).filter(Boolean);
  return {
    age: parseInt($("age").value, 10) || 35,
    stage: $("stage").value,
    peri_symptoms: Array.from(document.querySelectorAll('input[name="peri_symptom"]:checked')).map((c) => c.value),
    period_starts: starts,
    period_length: parseInt($("period_length").value, 10) || 5,
    cycle_length: $("cycle_length").value ? parseInt($("cycle_length").value, 10) : null,
    workout_frequency: $("workout_frequency").value,
    training: $("training").value,
    diet: $("diet").value,
    social: $("social").value,
    relationship: $("relationship").value,
    ttc: $("ttc").value,
    hrt: $("hrt").value,
    glp1: $("glp1").value,
    sign: $("sign").value,
    today: localToday(),
  };
}

function restoreForm(p) {
  if (!p) return;
  if (p.age) $("age").value = p.age;
  if (p.stage) $("stage").value = p.stage;
  (p.peri_symptoms || []).forEach((k) => {
    const c = document.querySelector('input[name="peri_symptom"][value="' + k + '"]');
    if (c) c.checked = true;
  });
  (p.period_starts || []).forEach((s, i) => { $("start" + (i + 1)).value = s; });
  if (p.period_length) $("period_length").value = p.period_length;
  if (p.cycle_length) $("cycle_length").value = p.cycle_length;
  if (p.workout_frequency) $("workout_frequency").value = p.workout_frequency;
  if (p.training) $("training").value = p.training;
  if (p.diet) $("diet").value = p.diet;
  if (p.social) $("social").value = p.social;
  if (p.relationship) $("relationship").value = p.relationship;
  if (p.ttc) $("ttc").value = p.ttc;
  if (p.hrt) $("hrt").value = p.hrt;
  if (p.glp1) $("glp1").value = p.glp1;
  if (p.sign) $("sign").value = p.sign;
  toggleHRT();
}

function toggleHRT() {
  $("hrt-field").hidden = false; // always ask — HRT applies across stages, not just peri/menopause
}

// ---- fetch + render ----
async function submitRead() {
  switchView("today");
  const todayEl = document.getElementById("view-today");
  if (todayEl) todayEl.innerHTML = '<div class="loading">Reading your cycle…</div>';
  const profile = gather();
  profile.first_time = !loadJSON(LS_PROFILE, null);
  saveJSON(LS_PROFILE, profile);
  try {
    let data;
    if (window.AuraEngine) {
      data = window.AuraEngine.read(profile);
    } else {
      const res = await fetch("/api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("API " + res.status);
      data = await res.json();
    }
    data.peri_symptom_count = (profile.peri_symptoms || []).length;
    lastData = data;
    render(lastData);
    const landing = document.querySelector(".landing");
    if (landing) landing.style.display = "none";
    const nl = document.querySelector(".nav-landing");
    if (nl) nl.hidden = true;
    const na = document.querySelector(".nav-app");
    if (na) na.hidden = false;
    document.getElementById("app-main").hidden = false;
    document.querySelector(".tabbar").hidden = false;
    switchView("calendar");
  } catch (err) {
    if (todayEl) todayEl.innerHTML = '<div class="loading">Something went wrong: ' + escapeHtml(String(err)) + "</div>";
  }
}

form.addEventListener("submit", (e) => { e.preventDefault(); submitRead(); });

// ---- render ----
function render(data) {
  const symptoms = loadJSON(LS_SYMPTOMS, {});
  const AFFIRM = "I trust my timing. I follow my flow. I create my magic.";

  // ---- Today view: status + today's guidance + log ----
  const today = [];
  if (data.stretch_meta) {
    const p = data.stretch_meta;
    today.push(`
      <div class="banner">
        <span class="stretch-emoji">${STRETCH_ICONS[data.stretch] || p.emoji}</span>
        <h1>${escapeHtml(data.recommendations.headline)}</h1>
        <div class="blurb">${escapeHtml(p.blurb)}</div>
        <div class="affirm">“${AFFIRM}”</div>
      </div>`);
  } else {
    today.push(`
      <div class="banner">
        <span class="stretch-emoji">🌿</span>
        <h1>${escapeHtml(data.recommendations.headline)}</h1>
        <div class="blurb">No active cycle to match — here's steady-state guidance for your stage.</div>
        <div class="affirm">“${AFFIRM}”</div>
      </div>`);
  }

  const facts = [];
  if (data.cycle_day != null) facts.push(fact("Cycle day", data.cycle_day));
  if (data.next_period) facts.push(fact("Next period", fmtDate(data.next_period)));
  if (data.overdue_days > 0) facts.push(fact("Period late", data.overdue_days + "d"));
  if (data.days_to_next != null && data.days_to_next >= 0) facts.push(fact("Days to go", data.days_to_next));
  facts.push(fact("Cycle length", data.cycle_length + "d"));
  facts.push(fact("Stage", titleCase(data.stage)));
  facts.push(fact("Confidence", titleCase(data.confidence)));
  if (facts.length) today.push(`<div class="facts">${facts.join("")}</div>`);

  if (data.stage === "very_early_perimenopause") {
    today.push(`<div class="peri-note"><strong>Very early perimenopause.</strong> Your cycles may still be regular, but changes are starting — track symptoms so you can spot the pattern. <strong>Not a diagnosis</strong> — confirm with a clinician.</div>`);
  } else if (data.stage === "perimenopause") {
    today.push(`<div class="peri-note"><strong>Perimenopause.</strong> Cycles are shifting — ovulation gets less predictable, so treat your stretch as a best-guess and plan by how you actually feel, not just the day number.</div>`);
  } else if (data.peri_signals && data.peri_signals.length) {
    today.push(`<div class="peri-note">Perimenopause may be starting — ${escapeHtml(data.peri_signals.join("; "))}. <strong>Not a diagnosis.</strong> Your cycle timing is a best-guess here; trust how you actually feel day to day.</div>`);
  }
  const periCount = data.peri_symptom_count != null ? data.peri_symptom_count : 0;
  today.push(`<div class="peri-src-line">Selected ${periCount} of 9 changes — based on the "very early perimenopause" criteria from CeMCOR, the Centre for Menstrual Cycle and Ovulation Research (UBC).</div>`);

  const sign = $("sign").value;
  today.push(renderAstroToday(data, sign));

  const r = data.recommendations;
  const cards = [
    ["💪", "Training", r.training],
    ["🥗", "Diet", r.diet],
    ["💞", "Social & Love", r.social_love],
    ["🧠", "Work & Focus", r.work_focus],
    ["🩺", "Wellness", r.wellness],
  ]
    .filter(([, , items]) => items && items.length)
    .map(
      ([icon, title, items]) => `
        <div class="rec">
          <h4>${icon} ${title}</h4>
          <ul>${items.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
        </div>`
    )
    .join("");
  if (cards) today.push(`<div class="recs">${cards}</div>`);

  today.push(logPanel(data, symptoms));
  document.getElementById("view-today").innerHTML = today.join("");

  // ---- Calendar view (the primary output: your cycle map + export) ----
  const cal = [];
  cal.push(savedNote());
  cal.push(renderWellness(data));
  if (data.calendar && data.calendar.length) cal.push(renderCalendar(data.calendar, symptoms, data.workout_types, data.stretch));
  cal.push(renderFertility(data));
  cal.push(renderFullCycle(data));
  cal.push(renderWorkWeeks(data));
  cal.push(renderExport(data));
  cal.push(installCard());
  cal.push(renderSocialProof(data));
  document.getElementById("view-calendar").innerHTML = cal.join("");

  // ---- Insights view ----
  const ins = [];
  ins.push(renderHistory(data, symptoms));
  if (sign && sign !== "skip") ins.push(renderAstrology(data, sign));
  document.getElementById("view-insights").innerHTML = ins.join("");

  wireLog(data);
  wireExport(data);
}

function fact(k, v) {
  return `<div class="fact"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(String(v))}</div></div>`;
}

// ---- astrology: your sign woven into each week ----
function renderAstroToday(data, sign) {
  const s = SIGNS[sign];
  if (!s || sign === "skip") return "";
  const act = (SIGN_ACTIONS[sign] || {})[data.stretch];
  if (!act) return "";
  return `<div class="astro-card">
    <div class="astro-card-badge">${s.emoji} ${s.name} · ${s.element}</div>
    <div class="astro-card-line">${act}</div>
    <div class="astro-card-sub">${s.trait} · watch your ${s.shadow}</div>
  </div>`;
}

function renderAstrology(data, sign) {
  const s = SIGNS[sign];
  if (!s) return "";
  const act = SIGN_ACTIONS[sign] || {};
  const st = data.stretch;
  const weeks = ["menstrual", "follicular", "ovulatory", "early_luteal", "late_luteal"];
  let today = "";
  if (st && act[st]) {
    today = `
      <div class="astro-today">
        <strong>This week (${stretchName(st)}):</strong>
        <div>${act[st]}</div>
      </div>`;
  }
  const weekList = weeks
    .map((p) => {
      const cur = p === st ? " now" : "";
      const a = act[p] || "";
      return `<div class="astro-week${cur}">
        <span class="aw-stretch" style="background:${STRETCH_COLORS[p]}">${stretchName(p)}</span>
        <span class="aw-note">${a}</span>
      </div>`;
    })
    .join("");
  return `<div class="cal astro">
    <h3>✨ Astro Sync · ${s.emoji} ${s.name}</h3>
    <div class="astro-sign">Sun in ${s.name} · ${s.element} — ${s.trait} · shadow: ${s.shadow}</div>
    ${today}
    <div class="astro-weeks">
      <div class="aw-title">What to do each week, by your sign</div>
      ${weekList}
    </div>
  </div>`;
}

// ---- symptom history + patterns ----
function renderHistory(data, symptoms) {
  const entries = Object.entries(symptoms);
  const meta = {};
  (data.calendar || []).forEach((d) => { meta[d.date] = { cd: d.cycle_day, st: d.stretch }; });
  entries.sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const rows = entries
    .map(([date, e]) => {
      const m = meta[date] || {};
      const badge = m.st ? `<span class="stretch-badge" style="background:${STRETCH_COLORS[m.st]}">${stretchName(m.st)}</span>` : "";
      const cd = m.cd ? `<span class="cd-tag">D${m.cd}</span>` : "";
      const chips = (e.symptoms || []).map((x) => `<span class="chip mini">${x}</span>`).join("");
      const energy = e.energy ? `<span class="energy-tag">${e.energy}</span>` : "";
      const note = e.note ? `<div class="hist-note">${escapeHtml(e.note)}</div>` : "";
      return `<div class="hist-row">
        <div class="hist-head"><span class="hist-date">${fmtFull(date)}</span>${cd}${badge}${energy}</div>
        <div class="hist-tags">${chips}</div>${note}
      </div>`;
    })
    .join("");

  let patterns = "";
  if (entries.length >= 2) {
    const collapsed = {};
    entries.forEach(([date, e]) => {
      const st = (meta[date] || {}).st || "unknown";
      (e.symptoms || []).forEach((sym) => {
        (collapsed[sym] = collapsed[sym] || {})[st] = (collapsed[sym][st] || 0) + 1;
      });
    });
    patterns = Object.entries(collapsed)
      .map(([sym, stretches]) => {
        const top = Object.entries(stretches).sort((a, b) => b[1] - a[1])[0];
        return `<span class="pattern">${sym} → ${stretchName(top[0])} ${top[1]}×</span>`;
      })
      .join("");
  }

  const emptyState = entries.length
    ? ""
    : `<div class="hist-empty">No logs yet — tap a day on the calendar to log energy, symptoms, and notes.</div>`;

  return `<div class="cal hist">
    <div class="hist-head-row">
      <h3>📜 Your history</h3>
      ${entries.length ? `<button type="button" class="xbtn" id="clear-history">Clear history</button>` : ""}
    </div>
    ${patterns ? `<div class="patterns">${patterns}</div>` : ""}
    <div class="hist-list">${rows || emptyState}</div>
  </div>`;
}

// ---- plan your weeks (which weeks are best for which kind of work) ----
function renderWorkWeeks(data) {
  const st = data.stretch;
  if (!st || !WORK_WEEK[st]) return "";
  const cur = WORK_WEEK[st];
  const rows = WORK_TYPES.map((w) => {
    const now = w.stretch === st;
    return `<div class="wk-row${now ? " now" : ""}">
      <span class="wk-type">${w.type}</span>
      <span class="wk-stretch" style="background:${STRETCH_COLORS[w.stretch]}">${stretchName(w.stretch)}</span>
      ${now ? '<span class="wk-nowtag">this week</span>' : ""}
    </div>`;
  }).join("");
  return `<div class="cal work">
    <h3>🗓️ Plan your weeks</h3>
    <div class="wk-nowbox">
      <strong>This week (${stretchName(st)})</strong>
      <div class="wk-best">✅ Best for: ${cur.best.join(" · ")}</div>
      ${cur.avoid && cur.avoid.length ? `<div class="wk-avoid">🚫 Avoid: ${cur.avoid.join(" · ")}</div>` : ""}
    </div>
    <div class="aw-title">Best week for each</div>
    <div class="wk-list">${rows}</div>
  </div>`;
}

// ---- saved-on-this-device reassurance (no login needed) ----
function savedNote() {
  return `<div class="saved-note">✓ Saved on this device — no login needed. Aura remembers your cycle and shows you the current week automatically each time you open it.</div>`;
}

// ---- wellness (HRT / GLP-1) — surfaced on the calendar so it's never missed ----
function renderWellness(data) {
  const w = data.recommendations && data.recommendations.wellness;
  if (!w || !w.length) return "";
  return `<div class="cal wellness">
    <h3>🩺 Wellness — HRT &amp; GLP-1</h3>
    <p class="wellness-sub">Because you told us about your hormonal context, here's what to keep in mind this week:</p>
    <ul>${w.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
    <div class="wellness-note">General guidance, not medical advice — your clinician's input always wins.</div>
  </div>`;
}

// ---- social proof: anonymous community counter ----
function renderSocialProof(data) {
  if (data.social_proof == null) return "";
  return `<div class="social-proof">✨ Another strong female protagonist just took charge of her cycle and is now rizz maxxing. That's <strong>${data.social_proof}</strong> so far.</div>`;
}

// ---- add to home screen (shown after setup, in the Calendar view) ----
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

function installCard() {
  // Don't show if already running in standalone (installed) mode.
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) return "";
  const ios = isIOS();
  if (ios) {
    return `<div class="install-card ios">
      <div class="install-icon">📲</div>
      <div class="install-body">
        <strong>Add Aura Cycles to your home screen</strong>
        <p>Tap the <strong>Share</strong> button (the square with an up arrow) in Safari's bottom bar, then <strong>Add to Home Screen</strong>. It installs like an app — full screen, one tap to open, no store needed.</p>
      </div>
    </div>`;
  }
  return `<div class="install-card">
    <div class="install-icon">📱</div>
    <div class="install-body">
      <strong>Install Aura Cycles</strong>
      <p>Install it like an app for one-tap access and a full-screen home icon.</p>
    </div>
    <button type="button" class="cta small install-btn" id="install-now">Install</button>
  </div>`;
}

// ---- full cycle: actionable guidance for every week ----
function renderFertility(data) {
  const f = data.fertility;
  if (!f || !f.enabled) return "";
  const fmtD = (iso) => (iso ? fmtDate(iso) : "");
  const range = f.next_fertile_start && f.next_fertile_end
    ? `${fmtD(f.next_fertile_start)} – ${fmtD(f.next_fertile_end)}`
    : "";
  const peak = (f.peak_dates || []).map(fmtD).join(", ");
  return `<div class="cal fertility">
    <h3>🔥 Fertility window</h3>
    <p class="fert-sub">Your most likely days to conceive, if you're trying to get pregnant.</p>
    <div class="fert-meta">
      <div class="fert-row"><span class="fert-k">Next ovulation</span><span class="fert-v">${fmtD(f.next_ovulation)}</span></div>
      <div class="fert-row"><span class="fert-k">Fertile window</span><span class="fert-v">${range}</span></div>
      <div class="fert-row"><span class="fert-k">Peak days</span><span class="fert-v">${peak}</span></div>
    </div>
    <p class="fert-note">${escapeHtml(f.note)}</p>
    <div class="fert-legend"><span class="fert-swatch peak"></span> Peak</div>
    <div class="fert-legend"><span class="fert-swatch"></span> Fertile window</div>
    <div class="fert-legend"><span class="fert-dot"></span> Ovulation day</div>
    <p class="fert-warn">This is an estimate based on your cycle — not a guarantee, and not a method of birth control. For irregular cycles or a clinical question, a doctor or ovulation test is more reliable.</p>
  </div>`;
}

function renderFullCycle(data) {
  const plan = data.cycle_plan || {};
  const weeks = ["menstrual", "follicular", "ovulatory", "early_luteal", "late_luteal"];
  if (!weeks.some((p) => plan[p])) return "";
  const st = data.stretch;
  const rows = weeks.map((p) => {
    const wt = data.workout_types && data.workout_types[p] ? TRAINING_TYPES[data.workout_types[p]] : null;
    const diet = STRETCH_DIET[p] || null;
    const wk = WORK_WEEK[p] || null;
    const now = p === st;
    const bits = [];
    if (wt) bits.push(`<span class="fc-item">${wt.icon} ${wt.label}</span>`);
    if (diet) bits.push(`<span class="fc-item">${diet.icon} ${diet.label}</span>`);
    if (wk) {
      bits.push(`<span class="fc-item">✅ ${wk.best.slice(0, 2).join(", ")}</span>`);
      if (wk.avoid && wk.avoid.length) bits.push(`<span class="fc-item fc-avoid">🚫 ${wk.avoid.slice(0, 2).join(", ")}</span>`);
    }
    return `<div class="fc-row${now ? " now" : ""}">
      <div class="fc-head"><span class="fc-emoji">${STRETCH_ICONS[p]}</span><strong>${stretchName(p)}</strong>${now ? ' <span class="wk-nowtag">this week</span>' : ""}</div>
      <div class="fc-bits">${bits.join("")}</div>
    </div>`;
  }).join("");
  return `<div class="cal fullcycle">
    <h3>🔁 Your full cycle at a glance</h3>
    <p class="fc-sub">Every week — exercise, food, and what to schedule or avoid.</p>
    ${rows}
  </div>`;
}

// ---- export ----
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function isIOS() {
  // iOS Safari and iPadOS (which reports as MacIntel desktop) both need this.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && !window.MSStream)
  );
}

function downloadICS(filename, content) {
  // iOS Safari only opens a .ics in Calendar on a plain navigation whose final
  // URL ends in ".ics". A form submit → server 303 redirect → /ics/<token>.ics
  // keeps it a single user-gesture navigation chain (which iOS follows to the
  // Calendar app). fetch + window.location.href fails because iOS blocks the
  // async programmatic navigation and renders the JSON response instead.
  if (isIOS()) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/export/ics";
    form.style.display = "none";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "ics";
    input.value = content;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    form.remove();
    return;
  }
  download(filename, content, "text/calendar;charset=utf-8");
}

function buildMarkdown(data, symptoms) {
  const r = data.recommendations;
  const L = [];
  L.push(`# Aura Cycles — ${r.headline}`);
  L.push("");
  const facts = [];
  if (data.cycle_day != null) facts.push(`cycle day ${data.cycle_day}`);
  if (data.next_period) facts.push(`next period ${fmtDate(data.next_period)}`);
  facts.push(`${data.cycle_length}-day cycle`);
  if (data.stage) facts.push(titleCase(data.stage));
  L.push(`**${facts.join(" · ")}**`);
  L.push("");
  const sections = [["💪 Training", r.training], ["🥗 Diet", r.diet], ["💞 Social & Love", r.social_love], ["🧠 Work & Focus", r.work_focus], ["🩺 Wellness", r.wellness]];
  for (const [title, items] of sections) {
    if (!items || !items.length) continue;
    L.push(`## ${title}`);
    items.forEach((t) => L.push(`- ${t}`));
    L.push("");
  }
  if (data.stretch && WORK_WEEK[data.stretch]) {
    const wk = WORK_WEEK[data.stretch];
    L.push("## 🗓️ Plan your weeks");
    L.push(`This week (${stretchName(data.stretch)}): best for ${wk.best.join(", ")}${wk.avoid.length ? " — avoid " + wk.avoid.join(", ") : ""}.`);
    WORK_TYPES.forEach((w) => L.push(`- ${w.type} → ${stretchName(w.stretch)}`));
    L.push("");
  }
  const plan = data.cycle_plan || {};
  const planWeeks = ["menstrual", "follicular", "ovulatory", "early_luteal", "late_luteal"];
  if (planWeeks.some((p) => plan[p])) {
    L.push("## 🔁 Full cycle at a glance");
    planWeeks.forEach((p) => {
      const wt = data.workout_types && data.workout_types[p] ? TRAINING_TYPES[data.workout_types[p]] : null;
      const diet = STRETCH_DIET[p];
      const wk = WORK_WEEK[p];
      const line = [];
      if (wt) line.push(`${wt.icon} ${wt.label}`);
      if (diet) line.push(`${diet.icon} ${diet.label}`);
      if (wk) line.push(`schedule: ${wk.best.join(", ")}${wk.avoid.length ? " · avoid " + wk.avoid.join(", ") : ""}`);
      L.push(`- **${STRETCH_ICONS[p]} ${stretchName(p)}** — ${line.join(" · ")}`);
    });
    L.push("");
  }
  const sign = $("sign").value;
  if (sign && sign !== "skip" && SIGNS[sign]) {
    const s = SIGNS[sign];
    const act = SIGN_ACTIONS[sign] || {};
    L.push(`## ✨ Astro Sync · ${s.name} (${s.element})`);
    L.push(`Sun in ${s.name} — ${s.trait}. Shadow: ${s.shadow}.`);
    const weeks = ["menstrual", "follicular", "ovulatory", "early_luteal", "late_luteal"];
    weeks.forEach((p) => { if (act[p]) L.push(`- ${STRETCH_ICONS[p]} ${stretchName(p)}: ${act[p]}`); });
    L.push("");
  }
  if (data.fertility && data.fertility.enabled) {
    const f = data.fertility;
    L.push("## 🔥 Fertility window");
    if (f.next_ovulation) L.push(`Next ovulation: ${fmtDate(f.next_ovulation)}`);
    if (f.next_fertile_start && f.next_fertile_end) L.push(`Fertile window: ${fmtDate(f.next_fertile_start)} – ${fmtDate(f.next_fertile_end)}`);
    if (f.peak_dates && f.peak_dates.length) L.push(`Peak days: ${f.peak_dates.map(fmtDate).join(", ")}`);
    L.push(`> ${f.note}`);
    L.push("");
  }
  const entries = Object.entries(symptoms);
  if (entries.length) {
    L.push("## 📜 Log");
    entries.sort((a, b) => (a[0] < b[0] ? 1 : -1)).forEach(([date, e]) => {
      const parts = [];
      if (e.energy) parts.push(e.energy);
      if (e.symptoms && e.symptoms.length) parts.push(e.symptoms.join(", "));
      L.push(`- ${fmtFull(date)}: ${parts.join(" · ") || "logged"}${e.note ? ` — ${e.note}` : ""}`);
    });
    L.push("");
  }
  L.push("— Aura Cycles · Connect with inner guidance, leverage your cycle.");
  return L.join("\n");
}

function buildCalendarHTML(data) {
  const days = data.calendar || [];
  if (!days.length) return "";
  const months = [];
  let cur = null;
  for (const d of days) {
    const key = d.date.slice(0, 7);
    if (!cur || cur.key !== key) { cur = { key, label: monthLabel(key), days: [] }; months.push(cur); }
    cur.days.push(d);
  }
  let html = `<h2>📅 Calendar</h2>`;
  for (const m of months) {
    const offset = new Date(m.days[0].date + "T00:00:00").getDay();
    let cells = "";
    for (let i = 0; i < offset; i++) cells += `<div class="cal-cell blank"></div>`;
    for (const d of m.days) {
      const tint = d.stretch ? `background:${stretchTint(STRETCH_COLORS[d.stretch] || "#C56F4F")};` : "";
      const best = d.stretch ? (STRETCH_BEST[d.stretch] || null) : null;
      const wt = d.stretch && data.workout_types ? (data.workout_types[d.stretch] ? TRAINING_TYPES[data.workout_types[d.stretch]] : null) : null;
      const diet = d.stretch ? (STRETCH_DIET[d.stretch] || null) : null;
      const social = d.stretch ? (STRETCH_SOCIAL[d.stretch] || null) : null;
      const marks = [best, wt, diet, social].filter(Boolean).map((m) => m.icon).join("");
      const marksHtml = marks ? `<span class="cal-best">${marks}</span>` : "";
      const cd = d.cycle_day ? `<span class="cal-cd">D${d.cycle_day}</span>` : "";
      cells += `<div class="cal-cell" style="${tint}">${cd}<span class="cal-dnum">${d.day}</span>${marksHtml}</div>`;
    }
    html += `<div class="cal-month"><h3>${m.label}</h3><div class="cal-wd">${["S", "M", "T", "W", "T", "F", "S"].map((w) => `<span>${w}</span>`).join("")}</div><div class="cal-grid">${cells}</div></div>`;
  }
  const legend = Object.entries(STRETCH_BEST).map(([, b]) => `<span class="cal-legend-item">${b.icon} ${b.label}</span>`).join("");
  const dietLegend = Object.entries(STRETCH_DIET).map(([, b]) => `<span class="cal-legend-item">${b.icon} ${b.label}</span>`).join("");
  const socialLegend = Object.entries(STRETCH_SOCIAL).map(([, b]) => `<span class="cal-legend-item">${b.icon} ${b.label}</span>`).join("");
  html += `<p class="cal-legend">${legend}</p><p class="cal-legend">🏋️ Lifting · 🤸 Yoga / Pilates · 🏃 Cardio</p><p class="cal-legend">${dietLegend}</p><p class="cal-legend">${socialLegend}</p>`;
  return html;
}

function buildHTML(data, symptoms) {
  const r = data.recommendations;
  let out = `<h1>Aura Cycles — ${escapeHtml(r.headline)}</h1>`;
  const facts = [];
  if (data.cycle_day != null) facts.push(`<strong>cycle day ${data.cycle_day}</strong>`);
  if (data.next_period) facts.push(`next period ${fmtDate(data.next_period)}`);
  facts.push(`${data.cycle_length}-day cycle`);
  if (data.stage) facts.push(titleCase(data.stage));
  out += `<p>${facts.join(" · ")}</p>`;
  out += buildCalendarHTML(data);
  const sections = [["💪 Training", r.training], ["🥗 Diet", r.diet], ["💞 Social & Love", r.social_love], ["🧠 Work & Focus", r.work_focus], ["🩺 Wellness", r.wellness]];
  for (const [title, items] of sections) {
    if (!items || !items.length) continue;
    out += `<h2>${title}</h2><ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
  }
  if (data.stretch && WORK_WEEK[data.stretch]) {
    const wk = WORK_WEEK[data.stretch];
    out += `<h2>🗓️ Plan your weeks</h2><p><strong>This week (${stretchName(data.stretch)}):</strong> best for ${wk.best.join(", ")}${wk.avoid.length ? " — avoid " + wk.avoid.join(", ") : ""}.</p><ul>${WORK_TYPES.map((w) => `<li>${w.type} → ${stretchName(w.stretch)}</li>`).join("")}</ul>`;
  }
  const plan = data.cycle_plan || {};
  const planWeeks = ["menstrual", "follicular", "ovulatory", "early_luteal", "late_luteal"];
  if (planWeeks.some((p) => plan[p])) {
    out += `<h2>🔁 Full cycle at a glance</h2><ul>`;
    planWeeks.forEach((p) => {
      const wt = data.workout_types && data.workout_types[p] ? TRAINING_TYPES[data.workout_types[p]] : null;
      const diet = STRETCH_DIET[p];
      const wk = WORK_WEEK[p];
      const line = [];
      if (wt) line.push(`${wt.icon} ${wt.label}`);
      if (diet) line.push(`${diet.icon} ${diet.label}`);
      if (wk) line.push(`schedule: ${wk.best.join(", ")}${wk.avoid.length ? " · avoid " + wk.avoid.join(", ") : ""}`);
      out += `<li><strong>${STRETCH_ICONS[p]} ${stretchName(p)}</strong> — ${line.join(" · ")}</li>`;
    });
    out += `</ul>`;
  }
  const sign = $("sign").value;
  if (sign && sign !== "skip" && SIGNS[sign]) {
    const s = SIGNS[sign];
    const act = SIGN_ACTIONS[sign] || {};
    out += `<h2>✨ Astro Sync · ${s.name} (${s.element})</h2><p>Sun in ${s.name} — ${s.trait}. Shadow: ${s.shadow}.</p><ul>`;
    const weeks = ["menstrual", "follicular", "ovulatory", "early_luteal", "late_luteal"];
    weeks.forEach((p) => { if (act[p]) out += `<li>${STRETCH_ICONS[p]} ${stretchName(p)}: ${escapeHtml(act[p])}</li>`; });
    out += `</ul>`;
  }
  if (data.fertility && data.fertility.enabled) {
    const f = data.fertility;
    out += `<h2>🔥 Fertility window</h2><ul>`;
    if (f.next_ovulation) out += `<li>Next ovulation: ${fmtDate(f.next_ovulation)}</li>`;
    if (f.next_fertile_start && f.next_fertile_end) out += `<li>Fertile window: ${fmtDate(f.next_fertile_start)} – ${fmtDate(f.next_fertile_end)}</li>`;
    if (f.peak_dates && f.peak_dates.length) out += `<li>Peak days: ${f.peak_dates.map(fmtDate).join(", ")}</li>`;
    out += `</ul><p><em>${escapeHtml(f.note)}</em></p>`;
  }
  const entries = Object.entries(symptoms);
  if (entries.length) {
    out += `<h2>📜 Log</h2><ul>`;
    entries.sort((a, b) => (a[0] < b[0] ? 1 : -1)).forEach(([date, e]) => {
      const parts = [];
      if (e.energy) parts.push(e.energy);
      if (e.symptoms && e.symptoms.length) parts.push(e.symptoms.join(", "));
      out += `<li>${fmtFull(date)}: ${parts.join(" · ") || "logged"}${e.note ? ` — ${escapeHtml(e.note)}` : ""}</li>`;
    });
    out += `</ul>`;
  }
  out += `<p>— Aura Cycles · Connect with inner guidance, leverage your cycle.</p>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Aura Cycles</title><style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.6}h1{font-size:28px}h2{font-size:20px;margin-top:26px}ul{padding-left:20px}li{margin:6px 0}.cal-month{margin-top:18px;page-break-inside:avoid}.cal-month h3{font-size:16px;margin:0 0 6px}.cal-wd{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}.cal-wd span{font-size:9px;color:#999;text-align:center}.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}.cal-cell{min-height:36px;border:1px solid #e4e0f0;border-radius:4px;padding:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:#333}.cal-cell.blank{border:none}.cal-dnum{font-weight:700}.cal-cd{font-size:8px;color:#777}.cal-best{font-size:12px;line-height:1}.cal-legend{margin-top:10px;font-size:11px;color:#555}.cal-legend-item{margin-right:12px;white-space:nowrap}</style></head><body>${out}</body></html>`;
}

function icsEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function foldICS(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  let out = "";
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curLen + b > 74) { out += cur + "\r\n"; cur = " " + ch; curLen = 1 + b; }
    else { cur += ch; curLen += b; }
  }
  return out + cur;
}

function nextDayISO(iso) {
  // Pure-UTC date arithmetic: return the ISO date one day after `iso`.
  // Avoids new Date()/toISOString() local-timezone drift (off-by-one for
  // users east of UTC).
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}

function buildICS(data) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aura Cycles//Aura Cycles//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Aura Cycles",
    "X-WR-CALDESC:Aura Cycles — your cycle map, week by week.",
  ];
  const cal = data.calendar || [];
  let run = null;
  const flush = () => {
    if (!run) return;
    const startStr = run.first.replace(/-/g, "");
    const endStr = nextDayISO(run.last);
    const name = stretchName(run.stretch);
    const wk = WORK_WEEK[run.stretch];
    const wt = data.workout_types && data.workout_types[run.stretch] ? TRAINING_TYPES[data.workout_types[run.stretch]] : null;
    const diet = STRETCH_DIET[run.stretch];
    let desc = `Aura Cycles — ${name}`;
    if (wt) desc += ` · Exercise: ${wt.label}`;
    if (diet) desc += ` · Eat: ${diet.label}`;
    if (wk) {
      if (wk.best && wk.best.length) desc += ` · Best for: ${wk.best.join(", ")}`;
      if (wk.avoid && wk.avoid.length) desc += ` · Avoid: ${wk.avoid.join(", ")}`;
    }
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${run.first}-${run.stretch}@aura-cycles`);
    lines.push(`DTSTART;VALUE=DATE:${startStr}`);
    lines.push(`DTEND;VALUE=DATE:${endStr}`);
    lines.push(`SUMMARY:${STRETCH_ICONS[run.stretch] || ""} ${name}`);
    lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    lines.push("END:VEVENT");
    run = null;
  };
  for (const d of cal) {
    if (!d.stretch) { flush(); continue; }
    if (run && run.stretch === d.stretch) run.last = d.date;
    else { flush(); run = { stretch: d.stretch, first: d.date, last: d.date }; }
  }
  flush();
  if (data.fertility && data.fertility.enabled) {
    const f = data.fertility;
    const nextDayDash = (iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    };
    const runs = (dates) => {
      const out = [];
      let s = null, prev = null;
      for (const d of dates) {
        if (s == null) { s = d; prev = d; }
        else if (prev && nextDayDash(prev) === d) { prev = d; }
        else { out.push([s, prev]); s = d; prev = d; }
      }
      if (s != null) out.push([s, prev]);
      return out;
    };
    const idate = (s) => s.replace(/-/g, "");
    runs(f.fertile_dates || []).forEach(([a, b]) => {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:fertile-${a}@aura-cycles`);
      lines.push(`DTSTART;VALUE=DATE:${idate(a)}`);
      lines.push(`DTEND;VALUE=DATE:${idate(nextDayISO(b))}`);
      lines.push("SUMMARY:✨ Fertile window");
      lines.push(`DESCRIPTION:${icsEscape("Aura Cycles — fertile window (sperm live up to 5 days)")}`);
      lines.push("END:VEVENT");
    });
    runs(f.peak_dates || []).forEach(([a, b]) => {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:peak-${a}@aura-cycles`);
      lines.push(`DTSTART;VALUE=DATE:${idate(a)}`);
      lines.push(`DTEND;VALUE=DATE:${idate(nextDayISO(b))}`);
      lines.push("SUMMARY:🔥 Peak fertility");
      lines.push(`DESCRIPTION:${icsEscape("Aura Cycles — peak fertility day")}`);
      lines.push("END:VEVENT");
    });
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldICS).join("\r\n");
}

function renderExport(data) {
  const hasCal = data.calendar && data.calendar.length;
  return `<div class="cal export">
    <h3>📤 Take your calendar with you</h3>
    <p class="export-sub">Your cycle map, week-by-week guidance, and daily plan — exported so you can live by it in whatever tool you already use.</p>
    <div class="export-btns">
      ${hasCal ? '<button class="xbtn" data-x="ics">📅 Apple / Google Calendar</button>' : ""}
      <button class="xbtn" data-x="pdf">🖨️ PDF</button>
      <button class="xbtn" data-x="md">🧾 Notion</button>
      <button class="xbtn" data-x="html">📝 Google Doc</button>
    </div>
    <div class="export-note">The .ics imports into Apple, Google, or Outlook. Notion imports the .md. The PDF is print-ready; the .html opens in Google Docs or Word.</div>
    <div class="export-save-hint"><strong>Important:</strong> when you import the calendar, save it under its own name — <em>Aura Cycles</em> (or any name you like) — so it stays a separate calendar you can toggle on and off. On iPhone: open the file → Add All → choose or create a new calendar. On Google Calendar: Settings → Import &amp; export → Import → pick "New calendar".</div>
  </div>`;
}

function wireExport(data) {
  const symptoms = loadJSON(LS_SYMPTOMS, {});
  document.querySelectorAll(".xbtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.dataset.x;
      if (k === "ics") downloadICS("aura-cycles.ics", buildICS(data));
      else if (k === "md") download("aura-cycles.md", buildMarkdown(data, symptoms), "text/markdown");
      else if (k === "html") download("aura-cycles.html", buildHTML(data, symptoms), "text/html");
      else if (k === "pdf") {
        const w = window.open("", "_blank");
        if (!w) return;
        w.document.write(buildHTML(data, symptoms));
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 300);
      }
    });
  });
}

// ---- daily log panel ----
function logPanel(data, symptoms) {
  const t = data.today;
  const entry = symptoms[t] || { energy: null, symptoms: [], note: "" };
  const chips = SYMPTOM_OPTIONS.map(
    (s) => `<label class="chip${entry.symptoms.includes(s) ? " on" : ""}" data-s="${s}">${s}</label>`
  ).join("");
  const energyBtns = ["low", "medium", "high"]
    .map((e) => `<button type="button" class="energy-btn${entry.energy === e ? " on" : ""}" data-e="${e}">${e}</button>`)
    .join("");
  const saved = justSaved ? "saved ✓" : "";
  justSaved = false;
  return `
    <div class="log" id="log-panel">
      <h4>💬 How do you feel today?</h4>
      <div class="log-meta">${fmtFull(t)} · saved in your browser only</div>
      <div class="log-row"><span class="lbl">Energy</span><div class="energy">${energyBtns}</div></div>
      <div class="log-row"><span class="lbl">Symptoms</span><div class="symptom-chips">${chips}</div></div>
      <div class="log-row"><span class="lbl">Note</span><textarea id="log-note" rows="2" placeholder="optional — how today actually feels">${escapeHtml(entry.note)}</textarea></div>
      <div class="log-actions">
        <button type="button" id="log-save" class="cta secondary">Save log</button>
        <span class="log-saved" id="log-saved">${saved}</span>
      </div>
    </div>`;
}

function wireLog(data) {
  const panel = $("log-panel");
  if (!panel) return;
  panel.querySelectorAll(".energy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      panel.querySelectorAll(".energy-btn").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
    });
  });
  panel.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => chip.classList.toggle("on"));
  });
  $("log-save").addEventListener("click", () => {
    const symptoms = loadJSON(LS_SYMPTOMS, {});
    const energy = (panel.querySelector(".energy-btn.on") || {}).dataset?.e || null;
    const chosen = [...panel.querySelectorAll(".chip.on")].map((c) => c.dataset.s);
    const note = $("log-note").value.trim();
    symptoms[data.today] = { energy, symptoms: chosen, note };
    saveJSON(LS_SYMPTOMS, symptoms);
    justSaved = true;
    render(lastData);
  });
}

// ---- calendar ----
function renderCalendar(days, symptoms, workoutTypes, currentStretch) {
  // ---- hero header: current stretch name + tagline ----
  let hero = "";
  const today = days.find((d) => d.is_today);
  const st = (today && today.stretch) || currentStretch;
  if (st) {
    const icon = STRETCH_ICONS[st] || "";
    const name = stretchName(st);
    const tag = STRETCH_TAGLINES[st] || "";
    hero = `<div class="cal-hero">
      <div class="cal-hero-icon">${icon}</div>
      <h2 class="cal-hero-title">${escapeHtml(name)}</h2>
      <p class="cal-hero-desc">${escapeHtml(tag)}</p>
    </div>`;
  }
  // ---- stretch legend (colored squares) ----
  const stretchLegend = ["menstrual", "follicular", "ovulatory", "early_luteal", "late_luteal"]
    .map((k) => `<span class="cal-legend-swatch" style="background:${STRETCH_COLORS[k]}"></span> ${stretchName(k)}`)
    .join("<span class=\"cal-legend-sep\">·</span>");
  // ---- calendar grid ----
  const months = [];
  let cur = null;
  for (const d of days) {
    const key = d.date.slice(0, 7);
    if (!cur || cur.key !== key) {
      cur = { key, label: monthLabel(key), days: [] };
      months.push(cur);
    }
    cur.days.push(d);
  }
  const html = months
    .map((m) => {
      const offset = new Date(m.days[0].date + "T00:00:00").getDay();
      let cells = "";
      for (let i = 0; i < offset; i++) cells += '<div class="day blank"></div>';
      for (const d of m.days) cells += dayCell(d, symptoms, workoutTypes);
      return `<div class="month"><h4>${m.label}</h4>
        <div class="weekdays">${["S", "M", "T", "W", "T", "F", "S"].map((w) => `<div>${w}</div>`).join("")}</div>
        <div class="days">${cells}</div></div>`;
    })
    .join("");
  return `<div class="cal">${hero}<div class="cal-legend-stretches">${stretchLegend}</div>${html}</div>`;
}

function dayCell(d, symptoms, workoutTypes) {
  const cls = ["day"];
  if (d.is_start) cls.push("is-start");
  if (d.is_today) cls.push("today");
  if (d.fertile) cls.push("fertile");
  if (d.peak) cls.push("fertile-peak");
  if (d.ovulation) cls.push("ovulation");
  if (symptoms[d.date]) cls.push("has-log");
  const style = d.stretch ? `background:${stretchTint(STRETCH_COLORS[d.stretch] || "#C56F4F")};` : "";
  const st = d.stretch;
  const best = st ? (STRETCH_BEST[st] || null) : null;
  const wt = st && workoutTypes && workoutTypes[st] ? (TRAINING_TYPES[workoutTypes[st]] || null) : null;
  const diet = st ? (STRETCH_DIET[st] || null) : null;
  const social = st ? (STRETCH_SOCIAL[st] || null) : null;
  const titleParts = [];
  if (best) titleParts.push(`work: ${best.label}`);
  if (wt) titleParts.push(`training: ${wt.label}`);
  if (diet) titleParts.push(`diet: ${diet.label}`);
  if (social) titleParts.push(`social: ${social.label}`);
  const title = st ? `${stretchName(st)} — ${titleParts.join(" · ")}` : "";
  return `<div class="${cls.join(" ")}" style="${style}" title="${escapeHtml(title)}">
    <span class="dnum">${d.day}</span>
    ${d.cycle_day ? `<span class="cday">D${d.cycle_day}</span>` : ""}
  </div>`;
}

// ---- helpers ----
function stretchTint(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.85)`;
}

function monthLabel(key) {
  const d = new Date(key + "-01T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtFull(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function titleCase(s) {
  if (!s) return "";
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function stretchName(p) {
  return STRETCH_NAMES[p] || titleCase(p);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ---- init: restore saved data and auto-open today's read ----
// device detection: mobile app shell vs web layout
(function detectDevice() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  document.body.classList.add(coarse || touch ? "mobile" : "web");
})();

// tab navigation → switch views (bottom tab bar + desktop app nav)
document.querySelectorAll(".tabbar a, .nav-app a").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    switchView(a.dataset.view || "calendar");
  });
});

// multi-step onboarding navigation
(function initSteps() {
  const steps = Array.from(document.querySelectorAll("#form .step"));
  if (!steps.length) return;
  const dots = document.querySelectorAll("#form .step-dot");
  const label = document.getElementById("step-label");
  let current = 0;

  function show(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((s, idx) => { s.hidden = idx !== current; });
    dots.forEach((d, idx) => {
      d.classList.toggle("active", idx === current);
      d.classList.toggle("done", idx < current);
    });
    if (label) label.textContent = `Step ${current + 1} of ${steps.length}`;
    const form = document.getElementById("form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.querySelectorAll("#form [data-next]").forEach((b) =>
    b.addEventListener("click", () => show(current + 1))
  );
  document.querySelectorAll("#form [data-back]").forEach((b) =>
    b.addEventListener("click", () => show(current - 1))
  );

  show(0);
})();

const savedProfile = loadJSON(LS_PROFILE, null);
if (savedProfile && (savedProfile.period_starts || []).length) {
  restoreForm(savedProfile);
  submitRead();
} else {
  switchView("you");
}

const gotoSetup = document.getElementById("goto-setup");
if (gotoSetup) gotoSetup.addEventListener("click", () => switchView("you"));

$("stage").addEventListener("change", toggleHRT);
$("age").addEventListener("input", toggleHRT);
toggleHRT();

function updatePeriCount() {
  const total = document.querySelectorAll('input[name="peri_symptom"]').length;
  const sel = document.querySelectorAll('input[name="peri_symptom"]:checked').length;
  const el = document.getElementById("peri-count");
  if (el) el.textContent = `Selected ${sel} of ${total} — based on CeMCOR's "very early perimenopause" criteria (Centre for Menstrual Cycle and Ovulation Research, UBC).`;
}
document.querySelectorAll('input[name="peri_symptom"]').forEach((c) => c.addEventListener("change", updatePeriCount));
updatePeriCount();

$("clear").addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem(LS_PROFILE);
  localStorage.removeItem(LS_SYMPTOMS);
  // Clear everything, then send the user to the main website (landing page),
  // not back into the app shell (which would just show the empty setup form).
  location.replace("/");
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("#clear-history");
  if (!btn) return;
  e.preventDefault();
  if (confirm("Clear all your logged symptoms and notes? Your profile stays saved.")) {
    localStorage.removeItem(LS_SYMPTOMS);
    if (lastData) render(lastData);
  }
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("#install-now");
  if (!btn) return;
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => { deferredInstallPrompt = null; });
  } else {
    // Fallback: show manual instructions (non-Chrome browsers).
    alert("Use your browser menu → \"Add to Home Screen\" (iPhone: Share → Add to Home Screen).");
  }
});
