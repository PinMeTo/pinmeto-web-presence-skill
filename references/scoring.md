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
absent = 0), and the rendered-only 0.5 is legal on **every check id listed in
`dual_pass_checks`** regardless of the `gradient_checks` whitelist — it is the policy's fixed
credit, not a measured ratio. A check that is not in `dual_pass_checks` never earns rendered
credit; add it to that list in `rubric.md` first.
Never conflate the two: one says "we don't know", the other says "half your audience can't
see this".

## 2. Pillar scores (0–100)

Compute in full precision; round **only** at the points named in §3. "Round half up" means
`floor(x + 0.5)` — do **not** use a language's default rounding (Python's `round()` is
banker's rounding: `round(22.5) == 22`, while JS gives 23; that discrepancy already produced
a report whose hero said 22 and whose history said 23).

**SEO / AIO / Agent Readiness:** `pillar = Σ (check_weight × ratio)` — the weights in
`rubric.md` already sum to 100 per pillar.

**GEO:** three sub-groups, then `geo = 0.55·A + 0.25·B + 0.20·C`:

- **A (per-platform):** per location, per platform: `Σ ratio over the platform's
  applicable_checks ÷ count of those checks` (the lists are machine-readable in
  `rubric.md`; a conditional check excluded for this location leaves the denominator).
  A `warn` inside that sum contributes 0.5, a `fail` 0, a `pass` 1. **No listing on a
  platform → that platform scores 0 for that location** (a measured absence, not a warn).
  Location score = 0.55·google + 0.30·apple + 0.15·bing. A = mean across sampled
  locations × 100.
- **B (consistency):** per location with **≥2 observed listings**: `0.35·name +
  0.35·address + 0.30·coords`. Score each field against the **PinMeTo record as the
  reference value**: every observed platform matches it = 1 · exactly one platform deviates
  = 0.5 · two or more deviate = 0. (Using the record as reference removes the two-platform
  ambiguity — with two listings that disagree, whichever one deviates from PinMeTo is the
  deviant; if both deviate, 0.) Locations with fewer than two observed listings are excluded
  from B. B = mean × 100; if no location qualifies, B is excluded and its 25 is redistributed
  to A and C in proportion (A 0.733, C 0.267) — note the reweight in the report.
- **C (page agreement):** per location: mean of the five 20-point field checks vs the
  dominant platform answer (majority across Google/Apple/Bing, Google wins ties).
  C = mean × 100. If no platform observation exists for a location, that location is
  excluded from C; if no location qualifies, C is excluded and its 20 is redistributed to
  A and B in proportion (A 0.688, B 0.312).

### When GEO could not be observed at all

If **no sampled location produced an observation on any platform** — no browser available,
every lookup blocked by a consent wall — do **not** compute a GEO score from warns. A
pillar assembled entirely from 0.5s prints a mid-50s number for listings nobody looked at,
under a PinMeTo logo. Instead:

- render GEO as **"Not measured"** in the scorecard, with the reason,
- **exclude it from the overall**, reweighting the other three pillars proportionally
  (SEO 0.43, AIO 0.357, Agent Readiness 0.214), and say in the hero sub-line and the
  methodology that the overall covers three pillars,
- record `"geo": null` in the history block for that scan so the trend never plots it as a
  drop, and flag the run as degraded in `notes`.

Partial observation (some locations or platforms seen) scores normally — the unseen parts
are `warn` at 0.5 and are listed under "could not be measured".

## 3. Overall score and grade

`overall = 0.30·seo + 0.30·geo + 0.25·aio + 0.15·agent_readiness`, computed from the
**unrounded** pillar values, then rounded half up to an integer. Round the pillar values
half up for display only. The grade is read from the rounded overall, so a 74.5 becomes 75
and grades B — decide it once, here, and store both the rounded numbers and the grade in the
history block so the report renders from them rather than recomputing.

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

…expressed in overall-score points. For GEO, a sub-group A check's effective weight is
`(1 ÷ count of that platform's applicable_checks) × platform_weight × 0.55 × 0.30`, and a
sub-group B/C field's is `field_share × subgroup_weight × 0.30`. Group related checks that one fix resolves (e.g. a
template change fixing H1 + title + description) and sum their points — the report's "Fix
these first" section shows the **three highest-point fixes**, each with its combined point
value ("Worth ~4 points"), a plain-English headline, and the coding-agent brief.

Tie-breakers: fleet-wide template fixes beat per-location manual edits; person-tasks (claim a
listing) rank on points but are labeled as not-a-code-change.

## 4b. Collapsing GEO results to one value per check id

A GEO check like `geo.name_matches_site` produces up to (locations × platforms) results, but
the history block, the accordion result labels, the pass/warn/fail counts and the trend diff
all consume **one value per check id**. Collapse by the **mean of its effective ratios
across every location × platform where the check was applicable** (a platform with no
listing contributes 0 for that location; a location where the check was unmeasurable
contributes 0.5). Status from the collapsed ratio: `pass` ≥0.8 · `warn` only when *every*
contributing observation was unmeasurable · `fail` otherwise. Record the collapsed value in
history and show the underlying spread in the row's evidence ("13 of 15 platform checks
matched; Apple Oslo and Apple Helsinki differ").

This collapsed value is a **reporting rollup across observations, not a check ratio** — it
never enters a pillar score. GEO is scored only by the sub-group A/B/C arithmetic in §2, where
each individual observation is still the binary 1 / 0.5 / 0 that `rubric.md`'s `gradient_checks`
rule requires. The rollup exists so the history block, the pass/warn/fail counts and the trend
diff have one number per check id; store it there labelled as an observation mean.

## 5. Honesty in numbers

- Report integers; don't imply decimal precision.
- `warn` checks are listed under "could not be measured" with their 0.5 credit stated — never
  silently folded into pass or fail counts.
- When a re-run changes the rubric version, recompute nothing retroactively: old scans keep
  their scores; the trend note names the rubric change.
