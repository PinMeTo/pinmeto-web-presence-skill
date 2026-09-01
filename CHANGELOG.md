# Changelog

Skill releases, newest first. The version is the `version:` field in `SKILL.md`; a release is
cut by tagging `vX.Y.Z`, which triggers `.github/workflows/release.yml`.

**`references/rubric.md` is the authority on scoring changes.** Its own "Changes in X" section
carries the before/after for every rubric version; entries here only name which rubric a
release ships and what moved at the skill level. When the two disagree, the rubric wins.

A rubric bump is required whenever a change moves scores, because the re-run attribution rule
in `references/rubric.md` can only separate rubric drift from real customer progress if the
version moved with the rules.

## v0.12.1 · 2026-08-18 · rubric 2.14.0-skill.1

Coding-agent handoffs are now context-free; scoring is unchanged.

- `Goal` names the production host and affected route/template scope
- `Issue` includes representative URLs or an exact route pattern plus the concrete observed and
  expected values, instead of relying on sample counts or report terminology
- `Fix` explains how to locate the implementation surface and provides standalone acceptance
  tests that can be run from the target repository
- A context-free handoff test rejects prompts that require access to the report to understand

## v0.12.0 · 2026-08-18 · rubric 2.14.0-skill.1

Coding-agent fix briefs now use a strict five-field handoff format; scoring is unchanged.

- Every copied prompt is ordered as `Goal`, `Issue`, `Fix`, `Skill`, and `Docs`
- Prompts retain the existing acceptance-criteria and verification requirements inside `Fix`
- Skill links are limited to approved skills, including exact links surfaced by the audited
  host's Is It Agent Ready report; unverified or guessed skill URLs are forbidden
- Documentation links must be verified primary standards or official best-practice sources

## v0.11.0 · 2026-08-18 · rubric 2.14.0-skill.1

Host-native report delivery; scoring is unchanged.

- ChatGPT and Codex now build and publish the presence report as a Site using the Sites build
  and hosting workflows, with the deployed Site URL as the primary deliverable
- Claude retains the self-contained HTML artifact path
- Re-runs preserve report identity and history while updating the same Sites project or
  artifact URL; scoped reports remain separate living reports
- Report links validate data-derived URL schemes before rendering
- Re-runs use a single-writer/version check, never silently reset malformed history, and leave
  the live report unchanged when a scheduled run lacks its required PinMeTo baseline

## v0.10.2 · 2026-08-09 · rubric 2.14.0-skill.1

Eight contract fixes, found when CodeRabbit re-read the shipped `2.13.0` files as the vendored
copy in `claude-plugins` ([#3](https://github.com/PinMeTo/pinmeto-web-presence-skill/pull/3)).
Fixed at source: the vendored tree is a snapshot of the release, so edits there would be
reverted by the next sync.

Scoring behaviour:

- **Three-state platform lookup** (`observed` / `not_found` / `unobserved`) replaces the `found`
  boolean. Only `not_found` is a measured absence scoring 0; `unobserved` scores 0.5, drops out
  of sub-group B, and can never satisfy the parity check's fail clause. A blocked Apple lookup
  previously scored the same as a brand with no Apple listing, turning an evidence gap into a fix
  brief for an unverified problem. Runs with partially blocked platforms score higher than under
  2.13.0 — that is a rubric change, not customer progress
- `geo.listing_connected_pinmeto`'s browser downgrade is now encoded in the machine-readable
  entry as `browser_downgrade`, with its conditions and the two mismatches that do *not* trigger
  it. 2.13.0 added it to prose only, which left a JSON-consuming scorer returning `pass` where
  the procedure requires `fail`
- `seo.lcp_sample` and `seo.mobile_friendly` name which three URLs they measure (the first three
  of the pinned sample, listed in evidence). 2.13.0 fixed the denominator at three without
  saying which three, so a re-run could move the score with no site change
- `geo.location_platform_parity` gains explicit precedence for a run with no observations, which
  satisfied both its fail clause and its warn clause
- Multi-country sampling is pinned to one global slot budget; per-country offsets could select
  the full sample size *per country*
- `SKILL.md`'s Stage 1 summary states `min(5, N)` and open locations only, instead of
  contradicting the rule 2.13.0 introduced

Documentation of existing behaviour, no score moves:

- The history schema documents nullable `pillars.geo` and the reweighted overall for a degraded
  run, so a renderer cannot plot an unmeasurable scan as a collapse
- The no-duplicate-artifact rule is scoped to the exact report identity, rather than forbidding
  the several-living-reports design the report spec permits
- History supplies prior scores to diff against, not a data baseline

## v0.10.1 · 2026-08-09 · rubric 2.13.0-skill.1

Twelve CodeRabbit review threads, all cross-file contract inconsistencies where two documents
specified the same behaviour differently ([`70d428f`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/70d428f)).

- `geo.listing_connected_pinmeto`: the browser downgrade rule now lives in `rubric.md` too, so
  it and `geo-browser-checks.md` can no longer return different results from identical evidence
- Rendered-only 0.5 credit restricted to the `dual_pass_checks` list (it read "any html/json-ld
  check", which let undeclared checks earn it)
- `seo.lcp_sample` scores over a fixed attempted-URL denominator, so a partial PageSpeed sample
  can no longer pass as `1/1`; a measurement gap warns instead of failing, but a URL that
  returned over 2.5s outranks an errored sibling and keeps the check at `fail`
- Small-fleet sample capped at `min(5, N)`: the even-spacing index repeats below five locations
- The no-browser GEO path is applied per check, not by warning every GEO check
- §4b's GEO collapse labelled an evidence-only reporting rollup, reconciling it with the
  `gradient_checks` whitelist (no score moves; it never entered a pillar score)

## v0.10.0 · 2026-08-09 · rubric 2.12.0-skill.1

Twelve determinism holes found by an adversarial read hunting for "two runs, same site,
different score" ([`6f95a39`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/6f95a39)).

- `warn` was undefined in all three GEO sub-groups, so a browser-less or consent-walled run
  could publish a mid-50s GEO score under a PinMeTo logo for listings nobody looked at. `warn`
  now contributes 0.5 inside sub-group A, unobserved locations are excluded from B and C with
  defined reweights, and a run with no observation at all renders GEO as "Not measured",
  excludes it from the overall, and stores `null` so the trend never plots it as a drop
- Dual-pass scope keyed off an explicit `dual_pass_checks` list instead of the `source` string,
  which had excluded six markup checks it obviously covers (~11 overall points)
- Sub-group B scored against the PinMeTo record as reference value, removing the two-platform tie
- Rounding and GEO-collapse rules made explicit

## v0.9.0 · 2026-08-09

Fifteen edits from the second dogfood, which exercised the re-run path
([`79d6a90`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/79d6a90)). Artifact
discovery, history parsing, pinned-sample reuse and the trend section all worked; scores moved
62 to 64 purely from rubric and measurement corrections on a byte-identical site, and the
report said so.

- Unambiguous re-run rule: always score with the current file's rubric version, never recompute
  prior scans, attribute every changed check to rubric / measurement / real change
- Machine-readable `applicable_checks` per platform (13 Google, 5 Apple, 6 Bing, plus
  conditional). Sub-group A's denominator had been prose only, and was the largest source of
  GEO drift between runs
- `scoring.md` gained the table separating warn-0.5 from rendered-only-0.5

## v0.8.1 · 2026-08-09

Parallelism guidance ([`bbc7ee5`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/bbc7ee5)):
start the slow PageSpeed calls in the background first, fetch site pages concurrently inside
the script, and run the HTTP-only stages alongside the browser-bound GEO stage where background
subagents exist. The browser stays one driver per surface; parallel automation against the map
platforms trips bot detection and costs more than it saves.

## v0.8.0 · 2026-08-09

Scripts, delegation and model-choice guidance
([`c3c6d1f`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/c3c6d1f)): route work
to the cheapest correct executor. Deterministic work (fetch/parse, scoring, HTML generation)
runs as scripts at zero model cost, mechanical recipe-following stages may go to a small fast
model, and judgment (normalization, severity, briefs, prose) stays on the primary model.

## v0.7.0 · 2026-08-09

Report changes from a review of the dogfood output
([`f796fcc`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/f796fcc)).

- NAP matrix cells show one chip per platform with observed-vs-PinMeTo tooltips, instead of one
  flattened glyph; "Pin" renamed "Map pin" and defined in the legend
- New listing-content table per location: displayed category vs the category PinMeTo pushes,
  photo count, latest owner post, newest review
- `geo.website_url_on_listing` now demands the right page: after stripping tracking params and
  following redirects, the final URL must be that location's own landing page

## v0.6.1 · 2026-08-09

Escape data-derived strings in the report, plus pre-publish sanity checks
([`42ac261`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/42ac261)). The dogfood
artifact's accordions and drawers were dead: an evidence note quoted a literal `<title>` tag
unescaped, and the contents of a `<title>` element are parsed as RCDATA, so the parser
silently swallowed the rest of the document (remaining drawers, the scan-history JSON, the
interactivity script) as inert text.

## v0.6.0 · 2026-08-09 · rubric 2.11.0-skill.1

Dual-pass rendering policy
([`0a42629`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/0a42629)). Googlebot,
Bingbot and agentic browsers render JS; the AI crawlers that feed training and retrieval
(GPTBot, ClaudeBot, PerplexityBot) do not. Served-only
scoring over-punished client-rendered sites and rendered-only would have hidden the
non-rendering-crawler gap, so markup checks now run both passes: served HTML earns full credit,
rendered-DOM-only earns `rendered_only_credit` (0.5) with provenance in the evidence, absent
scores 0.

## v0.5.0 · 2026-08-09 · rubric 2.10.0-skill.1

Twenty-two edits from the first Opus dogfood, which scored pinmeto.com 62/C and surfaced real
spec gaps ([`76d96e5`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/76d96e5)).

- Rendering policy pinned to served HTML (it had been an undocumented ±12-point judgment call)
- `geo.location_platform_parity` given a defined arithmetic slot: the brand-wide result counts
  once, in the Google column only
- `geo.listing_connected_pinmeto` downgraded when the surface contradicts the record
- `geo.special_hours_set` scored from PinMeTo `specialOpenHours` outside the holiday window
- The PageSpeed "no key needed" claim replaced with the per-IP quota reality

## v0.4.0 · 2026-08-09

Fleet-scale token strategy, pinned samples and scoped reports
([`a7c40be`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/a7c40be)).

- Stage 1 stays token-lean from 10 to 10,000 locations: size via `totalCount`, minimal MCP
  fields, even-offset selection for large fleets, full records for sampled locations only
- The sample is pinned in the report history and reused verbatim on re-runs, so trends measure
  change rather than sampling noise
- Scoped reports (country or region filter in the title and history block), so a large brand can
  keep several living reports that update independently

## v0.3.0 · 2026-08-09 · rubric 2.9.0-skill.1

Skill-line fork of MLPR 2.8.0
([`ce1fa92`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/ce1fa92)). Upstream
dropped Bing over the Enterprise API retirement, which is irrelevant when reading
`bing.com/maps` in a browser and PinMeTo supplies the YPID deep link.

- GEO sub-group A platform weights: Google 55, Apple 30, Bing 15
- Bing scored on existence, NAP, website and pin, with a browser procedure
- New `geo.listing_connected_pinmeto` check per platform, judged from the MCP record's `network`
  object (managed through PinMeTo)
- Map listings opened via the PinMeTo `network` deep links, removing matching ambiguity
  ([`63f2da4`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/63f2da4))
- GEO scores are no longer 1:1 comparable with the product; SEO, AIO and Agent Readiness stay
  identical to 2.8.0

## v0.2.0 · 2026-08-09 · rubric 2.8.0

Four-pillar methodology: SEO, GEO, AIO and Agent Readiness
([`6dae93b`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/6dae93b)).

- Vendored the MLPR rubric 2.8.0 (same check ids, weights and grades) so skill scores are
  comparable with the product
- GEO evidence gathered from the real Google and Apple Maps surfaces in a browser, replacing
  Places API and MapKit, which unlocks the checks the product marks "runner pending"
- Report spec matching the Presence Report design handoff, including the fix-brief drawer with
  coding-agent prompts and the embedded `pmt-scan-history` JSON that makes a re-run update the
  same artifact with a trend section

## v0.1.0 · 2026-08-08

Initial scaffold
([`0668cb7`](https://github.com/PinMeTo/pinmeto-web-presence-skill/commit/0668cb7)).
