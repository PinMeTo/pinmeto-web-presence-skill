# Scoring — from check results to the score on the report

Deterministic arithmetic over the `CheckResult` list. Given the same results, every host must
compute the same numbers. Record the check results as a data structure and compute the
pillar scores with a small script (Python/Node) when a shell is available — keep the script;
it is the audit trail for the next run. Only fall back to a hand-worked scratch table when
no runtime exists. Only checks listed in the rubric's `gradient_checks` may carry a measured
ratio; everything else is exactly 1 / 0.5 / 0.

## 1. Effective ratio per check

| Status | Ratio |
| --- | --- |
| `pass` | 1.0, or the measured ratio for gradient/threshold checks (e.g. 0.9 alt-text coverage) |
| `warn` | 0.5 — always, regardless of what little was measured |
| `fail` | 0, or the measured ratio for gradient checks (partial credit below threshold) |

### The two meanings of 0.5 — keep them apart

| 0.5 as… | Status | Means | In the report |
| --- | --- | --- | --- |
| **warn** | `warn` | We could not measure it (fetch failed, quota, no browser, consent wall) | Counted under "could not be measured"; never in the failing count |
| **rendered-only credit** | `fail` (or `pass` if the check's threshold is met at 0.5+) | We measured it: present after JS hydration, absent from the served HTML | A **real half-failure** — listed with its evidence and a fix brief |

Both come from the dual-pass policy in `seo-checks.md` (served = 1, rendered-only = 0.5,
absent = 0), and the rendered-only 0.5 is legal on **any** html/json-ld check regardless of
the `gradient_checks` whitelist — it is the policy's fixed credit, not a measured ratio.
Never conflate the two: one says "we don't know", the other says "half your audience can't
see this".

## 2. Pillar scores (0–100, round half up to integers at the end only)

**SEO / AIO / Agent Readiness:** `pillar = Σ (check_weight × ratio)` — the weights in
`rubric.md` already sum to 100 per pillar.

**GEO:** three sub-groups, then `geo = 0.55·A + 0.25·B + 0.20·C`:

- **A (per-platform):** per location, per platform: share of applicable checks passed
  (connected-in-PinMeTo + accuracy + richness for Google; connected + existence/NAP/pin for
  Apple; connected + existence/NAP/website/pin for Bing). No listing on a platform → that
  platform scores 0 for that location. Location score = 0.55·google + 0.30·apple +
  0.15·bing. A = mean across sampled locations × 100.
- **B (consistency):** per location with ≥2 listings: `0.35·name + 0.35·address +
  0.30·coords`, each field scored across the present platforms — all agree = 1, exactly one
  disagrees = 0.5, all disagree = 0. Locations with fewer than two listings are excluded
  from B. B = mean × 100 (if no location qualifies, B is excluded and A/C reweighted
  proportionally — note this in the report).
- **C (page agreement):** per location: mean of the five 20-point field checks vs the
  dominant platform answer (majority across Google/Apple/Bing, Google wins ties).
  C = mean × 100.

## 3. Overall score and grade

`overall = 0.30·seo + 0.30·geo + 0.25·aio + 0.15·agent_readiness`, rounded to an integer.

| Grade | Overall |
| --- | --- |
| A | ≥90 |
| B | ≥75 |
| C | ≥60 |
| D | ≥45 |
| F | <45 |

Status bands (used for the hero tag and the pillar scorecards) map onto the grade
thresholds: **Strong** ≥90 · **Healthy** ≥75 · **Needs work** ≥60 · **Critical** <60.

## 4. Top fixes — ranked by points returned

For each failing (not warn) check:

`points_returned = check_weight × (1 − ratio) × pillar_weight / 100`

…expressed in overall-score points. For GEO, treat a sub-group field's effective weight as
`field_share × subgroup_weight × 0.30`. Group related checks that one fix resolves (e.g. a
template change fixing H1 + title + description) and sum their points — the report's "Fix
these first" section shows the **three highest-point fixes**, each with its combined point
value ("Worth ~4 points"), a plain-English headline, and the coding-agent brief.

Tie-breakers: fleet-wide template fixes beat per-location manual edits; person-tasks (claim a
listing) rank on points but are labeled as not-a-code-change.

## 5. Honesty in numbers

- Report integers; don't imply decimal precision.
- `warn` checks are listed under "could not be measured" with their 0.5 credit stated — never
  silently folded into pass or fail counts.
- When a re-run changes the rubric version, recompute nothing retroactively: old scans keep
  their scores; the trend note names the rubric change.
