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
A physical place managed in PinMeTo, identified by its `storeId`. The unit of sampling and of GEO evaluation.
_Avoid_: store, branch, place

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
The label shown on the hero and scorecards — Strong, Healthy, Needs work, Critical — mapped from the grade thresholds.

**Points returned**:
The overall-score points a fix would recover (`check_weight × (1 − ratio) × pillar_weight / 100`). The ranking key for the report's top fixes.
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

**Theme**:
A fixed cross-pillar group of checks that one fix and one owner resolve, defined by the Theme mapping in the report delivery reference. The unit of the Layer 1 work list; a Theme card's headline is the Theme's name from the mapping, verbatim. Themes are presentation only; the rubric stays the closed set.
_Avoid_: focus area, opportunity, category, bucket, issue group

**Theme mapping**:
The fixed table assigning every point-bearing check id (pillar checks and GEO sub-group B/C fields) to exactly one Theme, pinned to a rubric version. Publishing fails when the mapping and the rubric disagree.
_Avoid_: grouping, categorisation, bucket list

**Effort label**:
One of the closed set of eight fixed strings in the Theme mapping naming the size of a Theme's fix and who does it; never rewritten per scan.
_Avoid_: difficulty, cost, complexity

**Schedule**:
A recurring host automation that triggers scans of exactly one report, named by its exact title.
_Avoid_: monitor, cron (as a domain term)
