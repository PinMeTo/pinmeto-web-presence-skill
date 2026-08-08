# Web Presence skill v0.2.0 — four-pillar rubric, browser-based GEO, updatable report

**Date:** 2026-08-08 · **Author:** Claude (autonomous session, Marcus's request)

## Goal

Upgrade the `pinmeto-web-presence` skill from the v0.1.0 three-lens scaffold to the real
methodology used by the MLPR product (`pinmeto-www-reports`), so customers can **check and
monitor SEO, AIO, GEO and Agent Readiness** and get a report that matches the approved
"Presence Report" design in `local_assets/seo-and-agent-readiness-report/`.

Requirements from Marcus:

1. Four pillars — SEO, AIO, GEO, **Agent Readiness** — scored with the rubric defined in
   `pinmeto-www-reports/docs/rubric.md` (v2.8.0, locked).
2. Report artifact must look like the Presence Report design handoff.
3. Report must be **updatable**: re-runs refresh the same artifact and show trend across scans;
   optionally set up as a schedule.
4. **No Google Places API / Apple MapKit Server API.** GEO evidence comes from browsing the real
   Google Maps and Apple Maps in a browser (Claude's browser tools / Claude in Chrome).
5. PinMeTo Location MCP is the source-of-truth baseline.

## Approach chosen

Full rewrite of the skill content (SKILL.md + references), keeping the existing packaging and
release plumbing untouched. Rejected alternatives: (a) minimal patch of v0.1.0 — misses the
rubric, the report design, and Agent Readiness entirely; (b) porting the product's TypeScript
check engine into `scripts/` — the skill's value is that it runs anywhere Claude runs, with MCP
+ browser + web fetch; a code engine duplicates the product and can't do browser lookups anyway.

## Structure

```
SKILL.md                              orchestration: setup → baseline → scan → score → report → monitor
references/rubric.md                  vendored rubric 2.8.0 (machine-readable JSON + skill adaptation notes)
references/pinmeto-data-check.md      baseline pull, completeness checks, deterministic sampling
references/seo-checks.md              15 SEO checks: procedure + pass threshold each
references/geo-browser-checks.md      GEO via real Google Maps + Apple Maps in the browser
references/aio-checks.md              13 AIO checks
references/agent-readiness-checks.md  10 Agent Readiness checks
references/scoring.md                 severity → ratio, weights, grades, top-fix impact ranking
references/artifact-report.md         Presence Report design spec + embedded scan history contract
references/monitoring.md              re-run mechanics, schedule setup, change narrative
```

`references/seo-audit.md` and `references/aio-geo.md` are deleted (superseded). Version bumps
to 0.2.0. `package-skill.sh` already includes `references/` wholesale — no packaging change.

## Key decisions

- **Rubric fidelity.** Vendor rubric 2.8.0 verbatim (same IDs, weights, thresholds, grade bands,
  severity model) so skill scores are comparable with MLPR product scores. Where the skill's
  evidence source differs (browser instead of API), the check ID and weight stay the same; only
  the procedure differs. Checks the product marks "runner pending" (special hours, menu links,
  recent reviews) ARE runnable here because the browser sees the real listing UI.
- **GEO via browser.** Per sampled location: search Google Maps and Apple Maps (web) for the
  location, open the listing, extract NAP/website/hours/photos/attributes/reviews, capture
  coordinates from the share URL, and compare against the PinMeTo baseline and the landing page.
  Consent dialogs: decline non-essential. If a platform can't be reached, mark affected checks
  `warn` (evidence gap), never guess.
- **Scoring.** `pass`=1, `warn`=0.5, `fail`=0 (or explicit pass_ratio), weighted per check,
  pillar 0–100, overall = pillar scores × pillar weights, grade A–F. Deterministic given the
  check results; the reference shows the arithmetic so any host can compute it without code.
- **Report artifact.** Single self-contained HTML page reproducing the Presence Report design
  (PinMeTo palette: navy #000050, blue #3399FF, orange #FF8854, grey #F2F3F4; Montserrat with
  system fallback since artifacts can't load external fonts). Sections: hero, summary, pillar
  scorecards, trend (chart + history table + "what moved"), top 3 fixes, per-pillar check
  accordions, location breakdown, NAP consistency matrix, next steps, methodology, fix-brief
  drawer with copy-paste coding-agent prompt per failing check.
- **Updatability / trend state.** The artifact embeds its own scan history as
  `<script type="application/json" id="pmt-scan-history">` — a versioned array of
  `{date, rubricVersion, overall, pillars, checks}` snapshots. On re-run: list artifacts, find
  `PinMeTo Web Presence — <brand>`, fetch it, parse the history block, append the new scan,
  republish to the same URL. The artifact is both the report and the state, so monitoring works
  even on hosts with no persistent filesystem. A local `presence-history-<brand>.json` is
  written as a courtesy backup when a filesystem exists.
- **Scheduling.** After the first report, offer monitoring. On hosts with scheduling (Claude
  Code `/schedule`, scheduled-tasks tools, cron), create a recurring prompt: "Run the PinMeTo
  web presence scan for <brand> and update the existing report artifact." Weekly default,
  monthly for stable brands.
- **Finding schema.** Every non-pass check result carries: check id, status, effective ratio,
  why-it-matters, evidence rows `{url, note}`, fix steps, and a self-contained coding-agent
  prompt (the design's drawer contract).

## Honesty rules (kept from v0.1, extended)

Sampled coverage stated explicitly; evidence over assertion; browser lookups are a point-in-time
observation of live surfaces, not an API contract; scores communicate movement, not a ranking
guarantee; `warn` ≠ `fail` and the report says so.
