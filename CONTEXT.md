# PinMeTo Web Presence Skill

This repo packages the `pinmeto-web-presence` agent skill: it scans a multi-location brand's
findability across four pillars against the PinMeTo MLPR rubric and maintains living,
updatable reports. The glossary below is the canonical vocabulary; the mechanics live in
`SKILL.md` and `references/`.

## Language

### Subject

**Brand**:
The customer organization whose web presence is being measured; owns one PinMeTo account and one or more reports.
_Avoid_: client, company

**Location**:
A physical place managed in PinMeTo, identified by its `storeId`. The unit of sampling and of GEO evaluation. Fixed strings in the report always say location; per-scan prose may use the brand's own kind-specific noun when every sampled location shares one primary category.
_Avoid_ (except in that per-scan prose): store, branch, place

**Listing**:
One map platform's public entry for a location (on Google, Apple, or Bing Maps).
_Avoid_: profile, place page, map entry

**Fleet**:
The open (not permanently closed) locations within a report's scope. An unscoped report's fleet is the whole account.
_Avoid_: all locations, estate, portfolio

**Scope**:
The market slice a report covers: the whole brand, or one country/region. Part of report identity; scoped reports live and update independently.

**Baseline**:
The PinMeTo location data treated as the source of truth that the live web is checked against.
_Avoid_: ground truth, reference data

**Canonical record**:
The per-location extract of baseline fields (NAP, hours, category, URL, coordinates, `network` platform links) kept for each sampled location.

**Sample**:
The deterministically selected locations a scan actually checks. Once recorded in a report's history it is **pinned**: re-runs reuse the same storeIds so the trend measures change, not sampling noise.
_Avoid_: selection, subset

### Measurement

**Check**:
A single rubric-defined test with an id and a weight, listed in `references/rubric.md`. The rubric is the closed set: no invented checks, no reweighting.
_Avoid_: rule, criterion, audit point

**CheckResult**:
The recorded outcome of one check in one scan: `{id, status, ratio?, evidence, why, fixSteps?, agentPrompt?, …}`.
_Avoid_: finding (findings are the report-facing narration of failing results)

**warn**:
The status meaning *could not be measured* (fetch failed, no browser, consent wall). An evidence gap, never a real failure; reported under "could not be measured".
_Avoid_: warning (as in "minor problem"), soft fail

**Rendered-only credit**:
The half credit a dual-pass check earns when a value exists only after JS rendering. A real half-failure with evidence and a fix brief — the opposite of a `warn`, despite sharing the number 0.5.

**Measurement engine**:
What produced a PageSpeed number: the PageSpeed Insights API (`psi`) or `pagespeed.web.dev`
driven in the browser (`psi-web`). Both run Lighthouse on Google's infrastructure, so results
are comparable; recorded per scan as `lcpEngine` so a future third engine cannot be compared
against them silently.
_Avoid_: measurement method, tool

**Observation**:
In GEO, one evaluation of a check at a single location × platform. Many observations exist per GEO check id.

**Rollup**:
The mean of a GEO check's observation ratios, reported once per check id in history and counts. A reporting convenience only; it never enters a pillar score.
_Avoid_: collapsed score, check score

**Lookup state**:
The tri-state result of seeking one listing: `observed` (read it), `not_found` (measured absence, scores 0), `unobserved` (never looked, scores as evidence gap). Conflating the last two publishes claims about listings nobody saw.

### Scoring

**Pillar**:
One of the four scored dimensions — SEO, GEO, AIO, Agent Readiness — each 0–100 and weighted into the overall score.

**Sub-group**:
One of GEO's three internal components: A (per-platform quality), B (cross-platform consistency), C (platform-to-page agreement).

**Dominant answer**:
For sub-group C, the majority value across a location's observed platforms; Google wins ties.

**Grade**:
The letter A–F read from the rounded overall score. Decided once at scoring time and stored in history; never recomputed retroactively.

**Status band**:
The label shown on the hero and under each pillar score — Strong, Healthy, Needs work, Critical — mapped from the grade thresholds.

**Points returned**:
The overall-score points a fix would recover (`check_weight × (1 − ratio) × pillar_weight / 100`). The ranking key for Themes (summed across a Theme's failing members) and for sections inside a Theme brief.
_Avoid_: impact, priority score

### Deliverable

**Report**:
The living scorecard for one scope, identified by its exact title plus scope. Holds the full scan history; a brand may keep several (global plus per-country) and each updates in place.
_Avoid_: audit, dashboard, deliverable

**Scan**:
One execution of the workflow, appending exactly one entry to a report's history block.
_Avoid_: run, audit, analysis

**Re-run**:
A scan that updates an existing report: same identity, pinned sample reused, fresh baseline pulled, published to the same Site or artifact URL.
_Avoid_: refresh, re-audit

**Site / Artifact**:
The host-specific delivery vehicle for a report (a Sites project in ChatGPT/Codex; a self-contained HTML artifact in Claude). The report is the identity; the vehicle is just where it renders.

**History block**:
The scan-history JSON embedded in the report (`#pmt-scan-history`): scope, pinned sample, rubric version, and every scan's stored scores. The state that makes reports updatable.
_Avoid_: state blob, metadata

**Fix brief**:
The drawer attached to a failing check in the report: plain-English why, fix steps, and a copy-paste coding-agent brief.
_Avoid_: recommendation, action item
_See also_: Theme brief

**Layer 1**:
Everything in a report except what sits inside the "Full audit detail" expander: the eleven sections the report delivery reference fixes, from the hero through the pillar scores, the Points bar, the trend, the Themes work list and the NAP summary line to "What to do next", Methodology and the footer. Written for a marketer, and the print view.
_Avoid_: overview, top of the page, executive summary

**Layer 2**:
The full audit, behind the report's one "Full audit detail" expander, collapsed until the reader opens it: scan-history table, section nav and filter, per-pillar check rows, location breakdown, NAP consistency matrix, listing content table. Demoted, never removed, and every item keeps its data contract.
_Avoid_: appendix, details section, the rest

**Theme**:
A fixed cross-pillar group of checks that one fix and one owner resolve, defined by the Theme mapping in the report delivery reference. The unit of the Layer 1 work list; a Theme row's headline is the Theme's name from the mapping, verbatim. Themes are presentation only; the rubric stays the closed set.
_Avoid_: focus area, opportunity, category, bucket, issue group

**Theme row**:
One Theme's entry in the Layer 1 work list: the top-ranked Theme as the one expanded row (rank badge, name, summary, effort, pays in, failing checks, status, worth, the page's one primary "How to fix" button), every other Theme as a compact line (rank, name, worth, effort, a text-link "How to fix"). Rows sit under hairlines; there are no cards.
_Avoid_: Theme card, tile

**Points bar**:
The Layer 1 chart that answers "how far from 100 am I, and what closes the gap": one bar from 0 to 100 whose earned part is a solid muted green and whose remaining parts are hatched (one segment per open Theme, the top Theme in orange) or dotted (points held by `warn` checks). Hatched and dotted mean unfinished; its hatched total equals the Themes lede's summed worth.
_Avoid_: progress bar, gap chart, missing-points bar

**Theme mapping**:
The fixed table assigning every point-bearing check id (pillar checks and GEO sub-group B/C fields) to exactly one Theme, pinned to a rubric version. Publishing fails when the mapping and the rubric disagree.
_Avoid_: grouping, categorisation, bucket list

**Theme brief**:
The drawer opened from a Theme row. Contains, unchanged, the fix brief of every failing member check (an evidence pointer into the NAP matrix for the GEO sub-group B/C fields, which have no drawer), ordered by points returned, plus a header with the Theme's worth, effort and a copy-all control. Never a merged brief: nothing in it is written per Theme per scan.
_Avoid_: theme drawer, combined brief, mega-prompt

**Effort label**:
One of the closed set of eight fixed strings in the Theme mapping naming the size of a Theme's fix and who does it; never rewritten per scan.
_Avoid_: difficulty, cost, complexity

**Cleared**:
The state of a Theme with no failing member check in the current scan that had one in an earlier scan of the same report. Measured on the web, not declared by a person, and computed against the current Theme mapping only.
_Avoid_: resolved, fixed, closed

**Reopened**:
A cleared Theme with a failing member check again in the current scan. Named in the trend card's "What moved" callout, in the same words as progress.
_Avoid_: regressed, broken again

**Schedule**:
A recurring host automation that triggers scans of exactly one report, named by its exact title.
_Avoid_: monitor, cron (as a domain term)
