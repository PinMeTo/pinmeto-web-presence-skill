---
name: pinmeto-web-presence
description: This skill should be used when the user asks to "check our web presence", "audit or monitor our SEO / AIO / GEO / agent readiness", "how do we look in AI search / ChatGPT / Gemini", "are our locations correct on Google, Apple, and Bing Maps", "run a presence scan", "update the presence report", or otherwise requests an SEO, AI-visibility (AIO), generative-engine (GEO), or agent-readiness analysis of a multi-location brand's website and map listings. Scores the brand against the PinMeTo MLPR rubric, produces an updatable report as a Site in ChatGPT/Codex or an HTML artifact in Claude, and can set up scheduled monitoring. Requires the PinMeTo Location MCP server; GEO checks use a browser against the real Google, Apple, and Bing Maps.
version: 0.16.0
license: Proprietary - (c) PinMeTo AB. See LICENSE.
---

# PinMeTo Web Presence Scan (SEO / AIO / GEO / Agent Readiness)

Scan a multi-location brand's online findability across **four pillars**, score it against the
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
fork (v2.15.0-skill.1) of the PinMeTo MLPR product rubric v2.8.0 that re-adds Bing as a scored
GEO platform and adds a PinMeTo-connection check; SEO/AIO/Agent Readiness are identical to
the product. Do not invent checks or reweight; deviations from the rubric make scans
incomparable.

## Requirements

- **PinMeTo Location MCP** server (the `.mcpb` Desktop Extension, or the npm package in Claude
  Code) with its `pinmeto_*` tools connected. Confirm by calling
  `pinmeto_get_locations({limit: 1, fields: ["storeId"]})` before anything else — never with
  no arguments, which returns fifty complete location records (~125k tokens) just to prove
  the server answers. If it fails or is missing, stop and run the
  `pinmeto-setup` flow first — the scan is meaningless without the PinMeTo baseline.
- **A browser tool** — for GEO always, and for SEO/AIO whenever the site client-renders:
  the in-app Browser, Claude in Chrome, or another browser automation surface. GEO evidence
  comes from the *real* Google, Apple, and Bing Maps pages — never from the Places API or
  MapKit — and JS-shell pages get their rendered pass in the same browser (see the
  rendering policy in `references/seo-checks.md`). If no browser is available, run the
  site pillars on served HTML only — a `dual_pass_checks` id whose served pass missed is
  `warn`, not a scored absence (without the second pass you cannot tell client-rendered
  from genuinely missing) — and apply the GEO degraded path **per check**:
  `geo.listing_connected_pinmeto` still scores `pass`/`fail` from the PinMeTo `network`
  object, `geo.special_hours_set` still scores from `specialOpenHours`, and every check
  that needs a map surface is `warn` (evidence gap) with a note explaining why. If no GEO
  observation is possible at all, follow the "GEO could not be observed" path in
  `references/scoring.md`. A browser-less run is also the only one that needs a PageSpeed
  API key: the keyless path for `seo.lcp_sample` drives `pagespeed.web.dev` in the browser
  (`references/seo-checks.md`).
- **Web fetch** for SEO / AIO / Agent Readiness checks against the brand's site.
- **A shell with `curl` and `python3`** for the scripts in `scripts/` (see rule 1). Nothing
  to install — they are stdlib only. Without a shell the scan still runs, but every
  deterministic step falls back to model reasoning, which is slower and less reproducible.

## Inputs to gather from the user

Ask only for what is not obvious, one thing at a time:

1. **Brand / PinMeTo account** — confirm which account's data to use (the scan uses whatever
   the connected server is scoped to).
2. **Website root and store locator URL** — e.g. `https://brand.com` and `/stores`. Often
   derivable from the PinMeTo location records' `url` fields; confirm rather than ask cold.
3. **Scope** — the whole brand, or one country/region. Scoped scans produce **separate,
   independently updatable reports** (own Site or artifact, own sample, own schedule); for brands
   with more than ~1,000 locations, recommend per-country reports outright — a 10-location
   sample of a 10,000-location fleet only catches template-level issues.
4. **Target markets / languages**, if multi-country (affects hreflang and sampling).
5. Whether this is a **first scan** or a **re-run** of an existing report (re-runs update the
   same Site or artifact and reuse its pinned location sample — see Output below).
6. **A PageSpeed API key — only when this run has no browser.** Do not ask otherwise: the
   scan uses `$PAGESPEED_API_KEY` / `$PSI_API_KEY` when the host already has one, and
   otherwise measures through `pagespeed.web.dev` in the browser, which needs no key. With
   no browser and no key, `seo.lcp_sample` (10 SEO points) is a standing `warn`; say that,
   offer the free key, and accept "skip" without pressing. The full ladder is in
   `references/seo-checks.md`.

## Workflow

Work through the stages in order. Every check produces a `CheckResult`:
`{id, status: pass|warn|fail, ratio?, evidence: [{url, note}], why, fixSteps?, agentPrompt?, skillLinks?, docLinks?}`.
`warn` means *could not measure* (fetch failed, no browser, consent wall) — never use it for a
real failure. The full result list feeds scoring and the report.

### Stage 1 — PinMeTo baseline and sampling

Pull the canonical location data and select the deterministic sample per
[references/pinmeto-data-check.md](references/pinmeto-data-check.md) — **token-lean**: the
fleet can be 10 or 10,000 locations, and the budget must survive to the report either way.

- Size the fleet from `totalCount` (limit 1, with the scope's country/city filters); never
  paginate the whole fleet into context, and never echo raw location JSON.
- Sample: `min(5, N)` open locations if the fleet has <20, 10 if ≥20, minimum 3 to
  score at all. Count only `permanentlyClosed: false` records — the exact rule and the
  selection order live in `references/pinmeto-data-check.md`; do not restate it differently.
  On re-runs the sample is **pinned** — reuse the storeIds recorded in the report's history
  block. Full records (`pinmeto_get_location`) are fetched for sampled locations only.

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
[references/scoring.md](references/scoring.md). Then compute points returned per failing check
(check weight × pillar weight × how far from passing) and rank **Themes** by summed points
returned, per the Theme mapping in [references/artifact-report.md](references/artifact-report.md).

### Stage 6 — Report (host-native, updatable)

Produce the report per [references/artifact-report.md](references/artifact-report.md), matching
the PinMeTo Presence Report contract: a briefing document on a white page, two layers, the
marketer's sections first (hero with the summary beside the score, pillar scores, the points
bar, trend, Themes with the top Theme expanded, the NAP summary line), then the full audit
behind one collapsed "Full audit detail" expander, then "What to do next", Methodology and the
footer. Include a fix-brief drawer (with a copy-paste
coding-agent prompt) for every failing check, plus a Theme brief per Theme row that stacks
those drawers unchanged behind one copy-all control (members without a drawer, the GEO
sub-group B/C fields, appear as evidence pointers). Choose the delivery path from the host,
identified from the runtime context (the product named in the system prompt and the
first-party tool surface) — never inferred from which workflow happens to load:

- **ChatGPT / Codex:** use the `sites-building` workflow and then `sites-hosting`. Build and
  publish an actual Site; do not return a standalone HTML artifact or file as the primary
  deliverable. If either Sites workflow or its required hosting capability is unavailable,
  stop and tell the user that Sites must be enabled; do not fall back to an artifact. Re-runs
  update and redeploy the same Site project.
- **Claude:** publish the report as a single self-contained HTML artifact, preserving the
  existing artifact workflow.

**Updatability is not optional.** The report embeds its own scan history JSON (including its
scope and pinned sample); on a re-run, find the existing report by its **exact title** (scoped
reports have the scope in the title), read its history, append the new scan, and publish a new
version to the **same Site project or artifact URL**. A brand can keep several living reports
at once — global plus per-country/region — and a re-run must update the right one, never a
different-scope one.

### Stage 7 — Offer monitoring

After delivering the report, offer to set up a recurring scan (weekly or monthly) using the
host's scheduling capability. Mechanics in [references/monitoring.md](references/monitoring.md).

## Scripts, delegation, and falsifiability

Route each kind of work to the cheapest thing that does it correctly:

1. **Scripts beat any model.** The deterministic work ships in `scripts/`. Run them; do not
   re-author them from the prose in `references/`, which costs ~25 minutes a scan and lets
   the arithmetic come out differently each time. They are Python 3 and bash, stdlib only,
   nothing to install, and every one takes `--workdir DIR` and touches nothing outside it:

   | Script | Does | Writes |
   | --- | --- | --- |
   | `scripts/fetch.sh` | one concurrent burst of every URL Stages 2–3 need, including the no-redirect and markdown-negotiation probes | `fetch/<key>.{h,b,m}` |
   | `scripts/analyze_served.py` | served-pass extraction: title, meta, canonical, h1, og/twitter, hreflang, lang, robots, alt counts, anchors, JSON-LD graph, first 200 words | `served.json` |
   | `scripts/crawl.py` | the `seo.internal_linking_depth` BFS exactly as `seo-checks.md` defines it | `crawl.json` |
   | `scripts/pagespeed.mjs` | rung 1 of the `seo.lcp_sample` engine ladder: PageSpeed for up to 3 URLs, one attempt each, stopping on the first 429 | JSON Lines on stdout |
   | `scripts/score.py` | the arithmetic in `scoring.md` and the Theme ranking in `artifact-report.md` | `scores.json` |
   | `scripts/diff_history.py` | the mechanical `checks` diff between the last two scans | `diff.json` |

   You assemble `results.json` between `crawl.py` and `score.py` — that is where your
   judgment calls enter. Its shape is fixed: **`scripts/README.md` is the contract**, and
   the renderer reads the same one. Producing the report from that data structure is
   likewise a script, not hand-authored markup (`artifact-report.md`): on the Claude
   artifact path emit the HTML from a template script; on the Sites path write the results
   and history into a data module the Site's components render.
2. **Delegate only falsifiable reads.** A read is **falsifiable** when the baseline can prove
   the value wrong, which is exactly the identity-and-position set: listing **existence,
   name, address, phone, website href, coordinates**. Delegate those to a subagent with the
   recipe and the evidence schema, require `null` plus a note when a field cannot be read,
   and **reject any value prefixed `~` or "approx"** on arrival. **Assume the subagent runs a
   small, fast model whatever you asked for.** The host decides that and can pin it:
   `CLAUDE_CODE_SUBAGENT_MODEL` outranks both a subagent's `model:` frontmatter and the Agent
   tool's `model` parameter, some hosts set it on every dispatch, and a subagent's own claim
   about which model it is running is not evidence. What is safe to delegate follows from the
   read, never from the model you believe you got.
3. **Keep judgment and every unfalsifiable read on the primary model:** the Google richness
   fields (weekly hours table, photo count, attribute chips, review recency), the
   `.well-known`/`llms.txt`/markdown-negotiation probes, normalization calls (does
   "Karhumäkivägen 3, Vanda" match "Karhumäentie 3, Vantaa"?), severity decisions, fix
   briefs, and all report prose. Richness fields are read off a localized UI with relative
   dates and have no baseline to check against, so a small model returns plausible-looking
   numbers there rather than nulls (a dogfood scan produced a *fabricated* ISO review date
   synthesized from "a year ago", and nulled five passing hours tables). The probes are cheap
   `curl` calls, and a delegated "200 JSON" for a path that actually 301s into an HTML 404 is
   an unfalsifiable pass that becomes a public claim that the brand implements a standard it
   doesn't: run them in the fetch script and read the status, content-type and first bytes
   yourself. Anything a wrong answer can silently corrupt stays here; this is not where to
   save tokens.
4. **One browser, one driver.** Subagents on most hosts share a single browser surface —
   do not run two browser-driving agents concurrently; delegate map lookups sequentially
   within that surface. Two independent surfaces (e.g. the in-app Browser *and* Claude in
   Chrome) may run one driver each. Do not go wider against the map platforms regardless:
   parallel automation from one IP invites bot detection and consent loops, which cost
   more time than they save. **The constraint is machine-wide, not per-agent.** Another
   session on the same machine may already hold the browser's profile, and the launch then
   fails with a profile-in-use error. Start your own browser on a separate profile or user
   data directory instead; do not terminate the running one, because you cannot tell from a
   process list whether somebody is working in it.
5. **Parallelize everything that is not the browser.** The wall-clock order that works:
   - Kick off the **PageSpeed calls first, in the background** — the slowest single fetches
     in the scan, and nothing depends on them until scoring. This applies to the keyed API
     path (`scripts/pagespeed.mjs`) only; the keyless `pagespeed.web.dev` path needs the
     single browser, so it sequences with the rendered pass and GEO instead of overlapping
     them.
   - Write the URL lists and run **`scripts/fetch.sh`** once: robots, sitemaps, sampled
     pages and `.well-known` probes go out in one concurrent burst against the brand's own
     site. Leave the concurrency at its default of **3**. Higher backfires — at `-P 8`
     against BunnyCDN, 9 of 26 connections came back reset, and a reset misread as a fetch
     failure turns a passing check into a `warn`. Resolve location-URL casing once from the
     sitemap or a redirect instead of fetching both `/GDANSK/` and `/gdansk/`.
   - **`scripts/crawl.py`** fetches each depth level concurrently and stops as soon as every
     sampled URL is reached. Neither changes the verdict — `seo-checks.md`'s ordering rule
     fixes the URL *set*, not the fetch timing — and 50 sequential curls took 8 minutes.
   - Where background subagents exist, run **the HTTP-only part of Stages 2–3 and Stage 4
     (browser) at the same time** — they share no state except the Stage 1 baseline, and
     join before Stage 5 scoring. **Caveat on client-rendered sites:** the rendered pass of
     Stages 2–3 needs the same single browser as Stage 4, so those two cannot overlap.
     Sequence there: concurrent served fetches → rendered pass → GEO.
6. **No subagent support?** Fine — the whole workflow runs single-agent; the scripts in
   rule 1 (including their concurrent fetching) are what keep that affordable, and the
   PageSpeed-first ordering still applies on the keyed path.

## Scope and honesty

- **Sample, don't boil the ocean.** Say explicitly which locations and pages were checked.
  Never imply full-site or full-fleet coverage.
- **Work compact.** The token budget must survive to Stage 6: request only the MCP `fields`
  you need, extract facts from fetched pages instead of quoting HTML, record evidence as
  short `{url, note}` rows as you go, and keep chat narration brief — the published report is
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
