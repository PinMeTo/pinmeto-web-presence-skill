# Changelog

Skill releases, newest first. The version is the `version:` field in `SKILL.md`; a release is
cut by tagging `vX.Y.Z`, which triggers `.github/workflows/release.yml`.

**`references/rubric.md` is the authority on scoring changes.** Its own "Changes in X" section
carries the before/after for every rubric version; entries here only name which rubric a
release ships and what moved at the skill level. When the two disagree, the rubric wins.

A rubric bump is required whenever a change moves scores, because the re-run attribution rule
in `references/rubric.md` can only separate rubric drift from real customer progress if the
version moved with the rules.

## v0.16.1 · 2026-09-16 · rubric 2.15.0-skill.1

Two Claude Desktop symptoms from the first v0.16.0 runs, no score moved. The scan opened a
separate Chrome instead of using the built-in browser, and it hit Desktop's per-session
tool-call cap.

- **The built-in browser is the stated preference.** `SKILL.md` and `geo-browser-checks.md`
  listed the in-app Browser, Claude in Chrome and "another browser automation surface" as
  equals. Now: use the host's built-in browser tool when one exists, launch or attach a Chrome
  only when the host has none, and never launch one to get around a busy built-in browser.
  Rule 4's profile-in-use advice is scoped to that launched-Chrome case.
- **PageSpeed rung 2 reads the rendered number first.** The v0.16.0 recipe led with pulling
  the Lighthouse JSON out of the browser's network log, which only a DevTools MCP has, so the
  model picked that browser for the whole scan. The rendered read (navigate, wait, one
  `javascript_tool` read of the mobile-tab LCP) is now the primary path; the network-log
  recipe stays as the DevTools-only variant. Same Lighthouse run either way.
- **Rule 7: expect the tool-call cap.** A full scan lands above Desktop's per-session cap, so
  the "continue" prompt is normal. Evidence goes to the location file after each platform and
  "continue" resumes from the last recorded lookup instead of restarting the stage.

## v0.16.0 · 2026-09-10 · rubric 2.15.0-skill.1

The two PageSpeed checks stop being the ones that never run. `seo.lcp_sample` and
`seo.mobile_friendly` came back `warn` in every dogfood scan because the anonymous PageSpeed
quota is per-IP and always exhausted — three calls a scan that always failed, and a Theme
(`fast-on-phones`) that could never appear.

- **`seo.mobile_friendly` leaves PageSpeed entirely.** Its procedure read the Lighthouse
  `viewport`, `tap-targets` and `font-size` audits and **none of the three still exists**:
  a live `pagespeed.web.dev` run on 2026-09-10 returned Lighthouse 13.4.1 with an SEO category
  of `is-crawlable, document-title, meta-description, http-status-code, link-text,
  crawlable-anchors, robots-txt, image-alt, hreflang, canonical, structured-data`. The check
  now reads `<meta name="viewport">` off the sampled pages' served HTML, which the scan already
  fetches — deterministic, engine-free, and measurable even on a browser-less run. `source`
  moves from `pagespeed` to `html` and the id joins `dual_pass_checks`.
- **`seo.lcp_sample` gets an engine ladder**: the API when `$PAGESPEED_API_KEY` or
  `$PSI_API_KEY` is already in the environment · else `pagespeed.web.dev` driven in the
  browser, which needs no key · else, with neither, a standing `warn` recorded **without
  calling anything**. Both measuring rungs are the same engine (Lighthouse on Google's
  infrastructure), so scans stay comparable across rungs. Running Lighthouse locally was
  considered and rejected: a lab number off the scanning machine moves with its CPU, which is
  the drift the pinned sample exists to prevent.
- **It scores the lab LCP, always.** Preferring CrUX field data "when present" mixed two
  different measurements inside one three-URL ratio, since most location pages have no field
  data. Field LCP is now evidence beside the lab number.
- **`scripts/pagespeed.mjs`** (new, stock Node, no dependencies) is the API rung: one attempt
  per URL, 60 s hard timeout, **no retries**, and it **stops after the first 429** because the
  remaining URLs share the refused quota. It prints one JSON line per URL including the ones it
  did not call, so the attempted denominator the rubric requires cannot silently shrink, and it
  never prints the key — the endpoint appears as `key=REDACTED`.
- **The browser rung's recipe is verified, not assumed.** `pagespeed.web.dev` delivers the full
  Lighthouse JSON in a `batchexecute` response; `seo-checks.md` gives the extraction, including
  the two traps a live run exposed: the chunk-length prefixes count bytes while the body is
  UTF-16 text, and `form_factor=mobile` only selects the tab — the page runs both form factors,
  so the payload must be picked by `configSettings.formFactor` or a desktop number gets scored
  as mobile (733 ms vs 2927 ms on the same page).
- **The key is no longer an up-front question.** `SKILL.md` asks for one only on a browser-less
  run, where it is the difference between measuring and not, and takes "skip" without pressing.
- **`lcpEngine`** joins the scan-history entry (optional, `"psi"` / `"psi-web"` / `null`) so a
  later scan knows what measured the number it is comparing against. `results.json` carries it
  and `scripts/score.py` copies it through; omit it and the entry omits it, because a scan from
  before the ladder is unknown rather than `null`.
- **The deterministic scripts learn the new signals**: `scripts/analyze_served.py` records each
  page's `viewport` in `served.json`, which is what `seo.mobile_friendly` now scores.
- **Scores move**: a re-run of a report whose PageSpeed checks were `warn` on quota can swing up
  to 15 SEO points in either direction. That is the rubric bump, not customer progress —
  weights, thresholds and the `warn`/`fail` precedence are otherwise unchanged.

## v0.15.0 · 2026-09-10 · rubric 2.14.0-skill.1

The deterministic half of a scan ships as scripts instead of being re-authored from the
reference prose every run. No rubric change: the rubric stays `2.14.0-skill.1`, and
`scripts/score.py` reproduces the 2026-09-07 pinmeto.com scan to the digit (SEO 42.75, GEO
79.80 from A 67.82 / B 90 / C 100, AIO 84.97, Agent Readiness 96.67, overall 72.51 → 73,
grade C, the same seven Themes and worth).

- **`scripts/fetch.sh`** — one concurrent burst of every URL Stages 2–3 need, headers, body
  and meta captured per key. Concurrency 3, with retries on the transport failures a CDN
  hands out under load; at `-P 8` BunnyCDN reset 9 of 26 connections. Separate lists for the
  `--max-redirs 0` probes (the `.well-known` 301 → HTML 404 trap) and the markdown
  negotiation probes.
- **`scripts/analyze_served.py`** — served-pass extraction into `served.json`.
- **`scripts/crawl.py`** — the `seo.internal_linking_depth` BFS as `seo-checks.md` defines
  it, fetching each depth level concurrently and stopping once every sampled URL is reached.
  The ordering rule fixes the URL set, not the fetch timing, so the verdict is unchanged:
  50 pages in 18 seconds against 8 minutes sequential.
- **`scripts/score.py`** — the arithmetic in `scoring.md` and the Theme ranking in
  `artifact-report.md`, reading the rubric and Theme mapping out of the reference Markdown
  and refusing to run when their pinned versions disagree. Implements the sub-group B and C
  exclusions with their redistribution weights, and the "GEO could not be observed" path.
- **`scripts/diff_history.py`** — the mechanical `checks` diff between the last two scans,
  pre-labelled "rubric change" when the rubric version moved and left unclassified
  otherwise, because separating a measurement correction from real customer progress needs
  the evidence behind both scans.
- **`scripts/README.md`** — the `results.json` contract, so the renderer and the model
  author the same shape. `results.json` gains `pageObs` (sub-group C, per location) and
  `notes`; a location is excluded from C when no platform was `observed`, whatever
  `dominant` says.
- **`scripts/htmlmini.py`** — a small tolerant HTML tree on `html.parser`, so the scripts
  need nothing installed. `beautifulsoup4` and `lxml` are absent from a stock Mac running
  Claude Code, and an install step that fails mid-scan is worse than a parser we control.
- **Tests** — `tests/scoring.test.mjs` pins the 2026-09-07 numbers as a fixture and covers
  the tri-state lookup, the parity exemption, both redistributions and the degraded path;
  `tests/htmlmini.test.mjs` covers the parser against the markup that has broken checks
  before.
- `SKILL.md` rules 1 and 5 name the scripts instead of describing what a script should do,
  and Requirements names the shell they need.

## v0.14.0 · 2026-09-05 · rubric 2.14.0-skill.1

The Presence Report's Layer 1 is redesigned as a briefing document that says what to fix
first. Presentation only: the rubric stays `2.14.0-skill.1`, no check weight, ratio or procedure
moved, the history-block schema and every Layer 2 data contract are untouched. Chosen from six
prototyped variants (branch `prototype/layer1-focus`, never merged).

- **A document, not a dashboard.** White page, one column, hairlines instead of cards, no
  gradients, no shadows, no colour-coded score numbers, no uppercase kickers, no middle-dot
  meta strings. The masthead carries the official logo, shipped as `assets/pinmeto-logo.svg`.
- **Eleven Layer 1 sections in reading order of importance**: hero with the summary beside
  the score, pillar scores (with per-pillar deltas), the new **points bar**, trend, Themes, the
  NAP summary line, the expander, next steps, methodology, footer.
- **The points bar** shows how far from 100 the brand is and what closes the gap: the earned
  part solid muted green, one hatched segment per open Theme (the top Theme in orange), a
  dotted segment for points held by `warn` checks, computed from their weights rather than by
  subtraction. Its legend links to the top Theme and the list.
- **Theme rows replace Theme cards.** The top Theme is the one expanded row and carries the
  page's only filled button; every other Theme is one compact line. The Themes h2 is "What to
  fix, in this order" and the old data-driven h2 becomes the lede.
- **Trend** loses the per-pillar strip (the deltas sit beside the pillar scores) and folds
  "What moved" into a collapsed disclosure; the chart anchors its first and last date labels
  inward so neither clips.
- `scripts/check-references.mjs` pins the new section list and requires the glossary terms
  "Points bar" and "Theme row".

## v0.13.0 · 2026-09-04 · rubric 2.14.0-skill.1

The Presence Report is two layers now, the marketer's work list first and the full audit behind
one expander. This is a presentation-only release. Scoring is unchanged: the rubric stays
`2.14.0-skill.1`, no check weight, ratio or procedure moved, and the history-block schema is
untouched. A score difference between a `0.12.x` run and a `0.13.0` run of the same brand is real
movement on the web, not this release.

- **Themes replace "Fix these first"** as the Layer 1 work list. A Theme is a fixed cross-pillar
  group of checks that one fix and one owner resolve, ranked by summed points returned, carrying a
  "Worth ~N points" pill, a plain-language name, an effort label, pillar tags and, from the second
  scan on, an "Open since" cell. Themes with nothing failing are absent, so the list stays a work
  list
- **The Theme brief** opens from a card and from a `theme-<slug>` hash, and stacks the unchanged
  per-check fix briefs of every failing member, ordered by points returned, behind one
  "Copy all N briefs" control that concatenates the five-field blocks separated by `---` lines.
  Members with no drawer (the GEO sub-group B and C fields, `consistency.*` and `page.*`) render
  as pointers into the NAP matrix
- **The Theme mapping** is a machine-readable JSON block in `references/artifact-report.md`, pinned
  to rubric `2.14.0-skill.1`, putting every point-bearing id in exactly one of ten Themes. A
  pre-publish check blocks publishing when the pinned version, the union of member ids, a
  duplicated id or an effort label outside the closed set disagrees with the rubric, and there is
  no "Other" catch-all, so mapping drift fails loudly instead of hiding. The rubric's version-bump
  guidance now requires updating the mapping with it
- **Two-layer section order**: hero, summary card, scorecards, trend, Themes and the NAP summary
  chip, then the full audit (scan-history table, sticky section nav and filter, per-pillar
  sections, location breakdown, NAP consistency matrix, listing content table) behind one
  collapsed "Full audit detail" expander, then "What to do next", Methodology and the footer. The
  pillar weights moved from the scorecards to Methodology, and any link into Layer 2 expands it
  first
- **Layer 1 is the print view**, with the audit detail printing only when the reader expanded it
  and Theme briefs and per-check drawers never printing
- **Writing style** is a baseline for every reader-facing string plus exact Layer 1 templates for
  the summary card, the Theme summary, the Themes heading, the trend headline and subline, and the
  Themes-cleared line. The eight effort labels are enumerated in one place, and the mapping is
  checked against that enumeration
- **The trend card tells the since-first-scan story**: a headline for movement since the first scan
  with its date, a subline since the previous scan (dropped at exactly two scans), a "Themes
  cleared since your first scan" line (omitted at zero), and reopened Themes named in "What moved".
  Cleared, reopened and "Open since" are computed against the current mapping only, treating ids
  absent from an older scan as unknown, so rubric drift cannot invent a reopened Theme
- **The glossary** (`CONTEXT.md`) defines Theme, Theme mapping, Theme brief, Effort label, Cleared,
  Reopened, Layer 1 and Layer 2, so every future ticket uses the same words
- **A reference-consistency script** (`scripts/check-references.mjs`, 92 unit tests) checks that the
  shipped references agree with each other: skill version against the newest changelog heading,
  mapping totality against the rubric, the closed effort-label set and its single home, the
  two-layer section order, the trend templates in both of their homes, the required glossary terms,
  and retired vocabulary absent from the entry point, the glossary, the README and every reference.
  Its default mode runs on every push and pull request as a repo gate, checking all of the above.
  A `--scan` mode runs only the checks that read files a skill payload ships (the references plus
  `SKILL.md`): mapping totality, the effort-label set and its home, the section order, the trend
  templates and retired vocabulary in the references. That is the pre-publish gate a scanning agent
  runs from inside an installed skill, where the repo-only files (`CHANGELOG.md`, `CONTEXT.md`,
  `README.md`) are absent by design
- **Four gaps the dogfood scan of `pinmeto.com` found in the new prose**, all presentation and none
  of them scoring: data-driven strings now render the singular at one (the scan printed
  "Worth ~1 points", "1 checks" and "Copy all 1 briefs"); the NAP summary chip omits its green chip
  when no location agrees on every field, rather than printing "0 of 5" in a pass colour; a
  category-conditional check excluded for every sampled location is omitted from the history
  `checks` map and named in `notes` instead of being recorded as a `warn` nobody attempted, and it
  reads "not applicable" rather than "could not be verified" in a Theme brief's footer; and the
  pre-publish copy-button check reads the payload from the DOM, because a browser denies clipboard
  writes on a `file://` origin while a handler can still report success. The two records are under
  `docs/test-runs/`

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
