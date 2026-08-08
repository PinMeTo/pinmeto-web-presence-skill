# Scoring and prioritization

## Severity

Assign each finding a severity from its customer impact:

| Severity | Meaning | Examples |
| --- | --- | --- |
| **Critical** | Actively misleads customers or blocks discovery | AI states wrong hours/address; store pages `noindex`; locator uncrawlable |
| **Major** | Materially weakens local/AI visibility | NAP mismatch vs PinMeTo; missing `LocalBusiness` schema; no per-store URLs |
| **Minor** | Real but lower-leverage | Thin meta descriptions; missing `sameAs`; no hreflang on a single-market brand |
| **Info** | Observation / opportunity, not a defect | "Add FAQ content to improve answer-shaped coverage" |

## Lens scores

Score each lens **SEO**, **AIO**, **GEO** on 0–100. Start at 100 and subtract per finding
(Critical −25, Major −10, Minor −3), floored at 0. Report the three lens scores plus a headline
average. Scores are a communication device for tracking movement run-over-run, not a
scientific metric — say so.

## Prioritized actions

Roll findings into an ordered action list by **impact ÷ effort**:

- **Impact** ≈ severity, weighted up when the finding hits many locations at once (a broken
  page template beats a single typo).
- **Effort** is your best estimate: template/schema fixes that fix every location at once are
  high-leverage; per-location manual edits are lower.

Lead the report with the top 3–5 actions. A fix that resolves a Major finding across the whole
location set is almost always the #1 action, because it is one change with fleet-wide payoff.
