---
name: pinmeto-web-presence
description: This skill should be used when the user asks to "audit our web presence", "run an SEO audit of our store locator", "check our local SEO", "how do we look in AI search / ChatGPT / Gemini", "AI visibility audit", "GEO/AEO audit", "check our landing pages", "are our store pages optimized", or otherwise requests an SEO, AI-visibility (AIO), or generative-engine (GEO) analysis of a multi-location brand's store locator, local landing pages, and PinMeTo data. Produces an updatable HTML report artifact. Requires the PinMeTo Location MCP server (>= 4.0.0) to be connected.
version: 0.1.0
license: Proprietary - (c) PinMeTo AB. See LICENSE.
---

# PinMeTo Web Presence Audit (SEO / AIO / GEO)

Audit a multi-location brand's online findability across three lenses and produce a
prioritized, **updatable** report:

- **SEO** — classic + local search: the store locator and per-location landing pages, their
  technical health, and their `LocalBusiness` structured data.
- **AIO** — AI visibility: whether AI assistants (ChatGPT, Claude, Gemini, Perplexity) surface
  the brand correctly for local intent.
- **GEO** — generative-engine optimization: the on-page and entity signals that make the brand
  citable by those assistants.

The audit cross-checks all of it against the source of truth in **PinMeTo** (the brand's
managed location data), because most local-SEO and AI-visibility failures are really
NAP (name/address/phone) and structured-data inconsistencies between PinMeTo and the live web.

## Requirements

Requires the **PinMeTo Location MCP** server (the `.mcpb` Desktop Extension, or the npm
package in Claude Code) with its twelve `pinmeto_*` tools connected. If the tools are missing,
run the `pinmeto-setup` flow first. Web fetching (for the locator and landing pages) uses the
host's web tools.

Before analyzing, confirm the tools resolve by calling `pinmeto_get_locations` with no
arguments. If it returns `UNAUTHORIZED` or is not found, stop and fix setup — the audit is
meaningless without the PinMeTo baseline.

## Inputs to gather from the user

Ask for whatever is not obvious, one thing at a time:

1. **Brand / PinMeTo account** — confirm which account's data to use (the audit uses whatever
   the connected server is scoped to).
2. **Store locator URL** — the brand's find-a-store page (e.g. `https://brand.com/stores`).
3. **A few representative landing-page URLs** — 2–5 individual location pages, ideally across
   markets, so the audit samples rather than crawls everything.
4. **Target markets / languages**, if the brand is multi-country (affects hreflang and GEO).
5. **Priority**, if any (e.g. "we care most about AI visibility this quarter").

## Workflow

Work through the five stages in order. Each stage writes findings into a running list of
`{area, check, severity, evidence, recommendation}` objects — that list becomes the report.

### Stage 1 — Establish the PinMeTo baseline

Pull the source-of-truth data with the MCP tools and note completeness gaps (a gap here is
itself a finding):

- `pinmeto_get_locations` — the canonical NAP, categories, hours, URLs for every location.
- `pinmeto_get_google_ratings` / `pinmeto_get_facebook_ratings` — reputation signals.
- `pinmeto_get_google_keywords` — the queries Google already associates with the locations.
- Google/Facebook/Apple insights tools — visibility and action metrics for context.

See [references/pinmeto-data-check.md](references/pinmeto-data-check.md) for exactly which
fields matter and how to judge "complete".

### Stage 2 — Store locator (technical + local SEO)

Fetch the locator and evaluate crawlability, per-store URL structure, indexability, internal
linking to location pages, and store-finder schema. Full rubric in
[references/seo-audit.md](references/seo-audit.md#store-locator).

### Stage 3 — Location landing pages (sample)

For each sampled page: title/meta, headings, `LocalBusiness`/`Store` JSON-LD, and — the
highest-value check — **NAP + hours + category consistency against the PinMeTo baseline from
Stage 1**. Divergence between PinMeTo and the live page is the most common, most damaging
finding. Rubric in [references/seo-audit.md](references/seo-audit.md#landing-pages).

### Stage 4 — AIO / GEO (AI visibility)

Assess how well the brand is positioned to be surfaced and cited by AI assistants for local
intent: entity consistency across the web, structured data an LLM can lift, review coverage,
and answer-shaped content. Where web tools allow, probe a few representative assistant-style
queries and record how the brand appears. Rubric in [references/aio-geo.md](references/aio-geo.md).

### Stage 5 — Score, prioritize, and report

Score each lens and roll findings up into a prioritized action list (impact × effort). Scoring
model in [references/scoring.md](references/scoring.md). Then produce the report artifact per
the next section.

## Output: an updatable report artifact

Produce the report as a single self-contained **HTML artifact** (not a chat dump), following
[references/artifact-report.md](references/artifact-report.md).

**Make it updatable across runs.** The report is meant to be re-run and refreshed, so it must
land on the *same* artifact each time rather than spawning a new one:

- Give the artifact a **stable title**: `PinMeTo Web Presence — <Brand>`.
- On every run, **first list existing artifacts and look for that title**; if found, update it
  in place (same URL) so the brand keeps one living scorecard. Only create a new artifact when
  none with that title exists.
- Put a visible "Last updated" date and a short "What changed since last run" note at the top
  when you are updating an existing report.

If the user wants the report to pull fresh data on its own (a live dashboard rather than a
snapshot), that needs artifact runtime capabilities — load the `artifact-capabilities` skill
before authoring, and confirm the capability is available to this user.

## Scope and honesty

- **Sample, don't boil the ocean.** Audit the locator plus a handful of representative pages;
  say explicitly which pages were and were not checked. Never imply full-site coverage.
- **Evidence over assertion.** Every finding cites what was observed (a URL, a missing schema
  field, a PinMeTo-vs-page mismatch), not a generic best-practice lecture.
- **This is not a ranking guarantee.** SEO/AIO/GEO improve the odds of visibility; they don't
  promise positions. State recommendations as changes to make, not outcomes promised.
