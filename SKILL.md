---
name: pinmeto-web-presence
description: This skill should be used when the user asks to "check our web presence", "audit or monitor our SEO / AIO / GEO / agent readiness", "how do we look in AI search / ChatGPT / Gemini", "are our locations correct on Google, Apple, and Bing Maps", "run a presence scan", "update the presence report", or otherwise requests an SEO, AI-visibility (AIO), generative-engine (GEO), or agent-readiness analysis of a multi-location brand's website and map listings. Scores the brand against the PinMeTo MLPR rubric, produces an updatable HTML report artifact, and can set up scheduled monitoring. Requires the PinMeTo Location MCP server; GEO checks use a browser against the real Google, Apple, and Bing Maps.
version: 0.6.0
license: Proprietary - (c) PinMeTo AB. See LICENSE.
---

# PinMeTo Web Presence Audit (SEO / AIO / GEO / Agent Readiness)

Audit a multi-location brand's online findability across **four pillars**, score it against the
PinMeTo MLPR rubric, and produce a prioritized, **updatable** report:

- **SEO** (30%) — the store locator and per-location landing pages: crawlability, structured
  data, titles, sitemaps, performance.
- **GEO** (30%) — the brand's real listings on **Google, Apple, and Bing Maps**: existence,
  NAP accuracy, richness, cross-platform consistency, agreement with the landing pages.
- **AIO** (25%) — whether generative answers (ChatGPT, Claude, Gemini, Perplexity) can ground
  on the brand: liftable schema, answer-shaped content, `llms.txt`, entity consistency.
- **Agent Readiness** (15%) — whether AI agents acting for a customer can use the site:
  MCP server card, agent skills discovery, API catalog, content signals, markdown negotiation.

Everything is cross-checked against the source of truth in **PinMeTo** (the brand's managed
location data), because most local-SEO and AI-visibility failures are NAP (name/address/phone)
and structured-data inconsistencies between PinMeTo and the live web.

The scoring rubric is defined in [references/rubric.md](references/rubric.md) — a skill-line
fork (v2.11.0-skill.1) of the PinMeTo MLPR product rubric v2.8.0 that re-adds Bing as a scored
GEO platform and adds a PinMeTo-connection check; SEO/AIO/Agent Readiness are identical to
the product. Do not invent checks or reweight; deviations from the rubric make runs
incomparable.

## Requirements

- **PinMeTo Location MCP** server (the `.mcpb` Desktop Extension, or the npm package in Claude
  Code) with its `pinmeto_*` tools connected. Confirm by calling `pinmeto_get_locations` with
  no arguments before anything else. If it fails or is missing, stop and run the
  `pinmeto-setup` flow first — the audit is meaningless without the PinMeTo baseline.
- **A browser tool** — for GEO always, and for SEO/AIO whenever the site client-renders:
  the in-app Browser, Claude in Chrome, or another browser automation surface. GEO evidence
  comes from the *real* Google, Apple, and Bing Maps pages — never from the Places API or
  MapKit — and JS-shell pages get their rendered pass in the same browser (see the
  rendering policy in `references/seo-checks.md`). If no browser is available, run the
  site pillars on served HTML only (rendered-only values score as absent, noted as such)
  and mark every GEO check `warn` (evidence gap) with a note explaining why.
- **Web fetch** for SEO / AIO / Agent Readiness checks against the brand's site.

## Inputs to gather from the user

Ask only for what is not obvious, one thing at a time:

1. **Brand / PinMeTo account** — confirm which account's data to use (the audit uses whatever
   the connected server is scoped to).
2. **Website root and store locator URL** — e.g. `https://brand.com` and `/stores`. Often
   derivable from the PinMeTo location records' `url` fields; confirm rather than ask cold.
3. **Scope** — the whole brand, or one country/region. Scoped runs produce **separate,
   independently updatable reports** (own artifact, own sample, own schedule); for brands
   with more than ~1,000 locations, recommend per-country reports outright — a 10-location
   sample of a 10,000-location fleet only catches template-level issues.
4. **Target markets / languages**, if multi-country (affects hreflang and sampling).
5. Whether this is a **first scan** or a **re-run** of an existing report (re-runs update the
   same artifact and reuse its pinned location sample — see Output below).

## Workflow

Work through the stages in order. Every check produces a `CheckResult`:
`{id, status: pass|warn|fail, ratio?, evidence: [{url, note}], why, fixSteps?, agentPrompt?}`.
`warn` means *could not measure* (fetch failed, no browser, consent wall) — never use it for a
real failure. The full result list feeds scoring and the report.

### Stage 1 — PinMeTo baseline and sampling

Pull the canonical location data and select the deterministic sample per
[references/pinmeto-data-check.md](references/pinmeto-data-check.md) — **token-lean**: the
fleet can be 10 or 10,000 locations, and the budget must survive to the report either way.

- Size the fleet from `totalCount` (limit 1, with the scope's country/city filters); never
  paginate the whole fleet into context, and never echo raw location JSON.
- Sample: 5 locations if the (scoped) fleet has <20, 10 if ≥20, minimum 3 to score at all.
  On re-runs the sample is **pinned** — reuse the storeIds recorded in the report's history
  block. Full records (`pinmeto_get_location`) are fetched for sampled locations only.
- Ratings/keywords/insights tools in aggregate for reputation and context.

Baseline gaps (missing URL, hours, category, coordinates) are findings in their own right.

### Stage 2 — SEO (site checks on the sample)

Fetch the locator, sitemap, robots.txt, and each sampled landing page — with plain HTTP
tooling (`curl`/fetch script), not a markdown-converting fetcher. Evaluate **dual-pass**
per the rendering policy in [references/seo-checks.md](references/seo-checks.md): served
HTML earns full credit; pages that turn out to be JS shells are re-read in the real
browser, and values present only after rendering earn half credit (Google and agent
browsers render; AI training crawlers don't). The policy applies to the html/json-ld
checks in Stage 3 as well. Run the 15 rubric checks per that file.

### Stage 3 — AIO and Agent Readiness (site + homepage checks)

Mostly homepage- and site-level: schema completeness, `llms.txt`, markdown content
negotiation, `.well-known` agent endpoints. Run per
[references/aio-checks.md](references/aio-checks.md) and
[references/agent-readiness-checks.md](references/agent-readiness-checks.md). Many checks
share fetches with Stage 2 — reuse responses instead of re-fetching.

### Stage 4 — GEO (browser lookups on real maps)

For each sampled location, look it up on Google, Apple, and Bing Maps **in the browser**,
extract the listing facts, and compare against the PinMeTo baseline and the landing page.
Procedure, URL patterns, extraction fields, and normalization rules in
[references/geo-browser-checks.md](references/geo-browser-checks.md). This is the slowest
stage — budget it, and record evidence as you go.

### Stage 5 — Score and prioritize

Compute pillar scores (0–100) and the weighted overall score + grade exactly per
[references/scoring.md](references/scoring.md). Then rank failing checks by points returned
(check weight × pillar weight × how far from passing) to pick the **top 3 fixes**.

### Stage 6 — Report (updatable artifact)

Produce the report per [references/artifact-report.md](references/artifact-report.md) — a
single self-contained HTML artifact matching the PinMeTo Presence Report design, with a
fix-brief drawer (including a copy-paste coding-agent prompt) for every failing check.

**Updatability is not optional.** The artifact embeds its own scan history JSON (including
its scope and pinned sample); on a re-run, find the existing artifact by its **exact title**
(scoped reports have the scope in the title), read its history, append the new scan, and
republish to the **same URL**. A brand can keep several living reports at once — global plus
per-country/region — and a re-run must update the right one, never a different-scope one.

### Stage 7 — Offer monitoring

After delivering the report, offer to set up a recurring scan (weekly or monthly) using the
host's scheduling capability. Mechanics in [references/monitoring.md](references/monitoring.md).

## Scope and honesty

- **Sample, don't boil the ocean.** Say explicitly which locations and pages were checked.
  Never imply full-site or full-fleet coverage.
- **Work compact.** The token budget must survive to Stage 6: request only the MCP `fields`
  you need, extract facts from fetched pages instead of quoting HTML, record evidence as
  short `{url, note}` rows as you go, and keep chat narration brief — the report artifact is
  the deliverable, not a running commentary.
- **Evidence over assertion.** Every non-pass finding cites what was observed: a URL, a missing
  field, a PinMeTo-vs-listing mismatch. No generic best-practice lectures.
- **`warn` is an evidence gap, not a failure.** The report must distinguish "we found a
  problem" from "we couldn't measure this" — they score differently (0.5 vs 0) and read
  differently to the customer.
- **Browser observations are point-in-time.** Maps surfaces personalize and change; record the
  date and what was actually on screen.
- **No ranking guarantees.** These pillars improve the odds of visibility; state
  recommendations as changes to make, not outcomes promised.
