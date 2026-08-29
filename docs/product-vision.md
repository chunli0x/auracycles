# Aura Cycles — Product Vision & App Description

> **Canonical description.** This is the source of truth for what Aura Cycles is, what it
> does, and where it's going. The meta description, hero copy, manifest, and roadmap all
> derive from here. Keep this current whenever the product changes.

## The app in one paragraph

Aura Cycles is a **women's health tracking app** that tracks her cycle and, based on
**which week she is in**, recommends:

- **Pilates or strength training** — whether she should take the pilates class or do strength training this week.
- **Speed dating** — whether she should go to the event during her **follicular or ovulation week** (and not her period week).
- **The super-important work meeting** — whether to schedule it **before or after her period**.

It also **takes into account special diets** — for example, **gluten-free but craving
carbs** — and **which week those cravings will hit**, so she can plan around them.

Built for women in **perimenopause and menopause**, not just their 20s.

## Coming later

1. **Peptide recommendations** — a dedicated section for peptides.
2. **GLP-1 start timing** — when to start the GLP-1: **during the luteal stretch, or after?**
3. **LLM coach** — takes all this data, plus the symptoms she tells it, and turns it into a
   **dynamic recommendation engine she can ask anytime**. (BYOK design: `docs/llm-coach.md`.)

## How it works today (actionable, week-by-week)

The app maps the cycle to five stretches — **Rest & Renew · Follicular Rise · Ovulation
Glow · Luteal Flow · Reflect & Rest** — and for each week recommends concrete actions across:

- **Exercise type** — pilates / yoga vs. strength / lifting vs. cardio, threaded through the
  user's own training preference.
- **Diet** — what to eat each week, and which week cravings hit (special diets included).
- **Scheduling** — social events, work meetings, launches: what to book vs. avoid.
- **Sun sign** — optional astrology overlay, if she wants it.

Privacy-first: a fully deterministic engine, data stays in the browser, no accounts, nothing
hallucinated.

## Design principles

- **Deterministic first** — nothing hallucinated; the engine is the trust layer.
- **Actionable, not informational** — every output answers "what do I actually do?"
- **Warm, feminine, celestial voice** — no clinical jargon; say "stretch of the cycle," never
  clinical terms.
