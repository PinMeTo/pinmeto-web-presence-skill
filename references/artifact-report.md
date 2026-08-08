# The report artifact

Produce a single self-contained HTML artifact. It must be readable on its own — a stakeholder
opens the link, not the chat.

## Identity (so it stays updatable)

- **Title:** `PinMeTo Web Presence — <Brand>` (stable — this is how re-runs find and update the
  same artifact instead of spawning new ones).
- **Favicon:** a fixed emoji (e.g. `🔎`), kept the same across runs.
- Before creating, list existing artifacts and match the title; if present, **update in place**.

## Structure

1. **Header** — brand, "Last updated" date, and (when updating) a one-line "What changed since
   last run".
2. **Scorecard** — the three lens scores (SEO / AIO / GEO) and the headline average, with the
   previous run's numbers shown alongside when updating so movement is visible.
3. **Top actions** — the prioritized 3–5, each: what to change, which locations/pages, expected
   payoff, rough effort.
4. **Findings by lens** — grouped tables of `{check, severity, evidence, recommendation}`.
   Evidence is concrete (URL, missing field, PinMeTo-vs-page mismatch).
5. **Coverage & method** — which locator and pages were checked, which AI probes were run, and
   an explicit note of what was *not* covered. Never imply full-site coverage.

## Style

- Theme-aware (light/dark), responsive, no external requests (inline everything). Wide tables
  scroll inside their own container; the page body never scrolls horizontally.
- Follow the `dataviz` guidance for any charts/score meters.
- Sober and factual. This is a diagnostic, not a marketing page. No hype, no promised rankings.
