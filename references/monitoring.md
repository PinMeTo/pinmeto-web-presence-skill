# Monitoring — re-runs and schedules

The report is a living scorecard. Two mechanics make that real: re-runs that update in
place, and an optional schedule that triggers them.

## Re-run mechanics

A re-run is the same workflow as a first scan, with three differences:

1. **Find the existing report first** — by the **exact** stable title: `PinMeTo Web
   Presence — <domain>` or, for a scoped report, `… — <domain> — <Scope>`. In ChatGPT/Codex,
   reopen the matching Sites project and reuse its `.openai/hosting.json` `project_id`; in
   Claude, open the matching artifact. Parse `#pmt-scan-history`. It supplies the scope filter,
   the pinned location sample
   (reuse it — see `pinmeto-data-check.md`), the **prior scores to diff against**, and the
   rubric version **those prior scores were computed under** — metadata for the comparison
   narrative, never the version to score with. This scan always scores with the rubric in the
   current `rubric.md`, and old scans are never recomputed. It is not a data baseline: a re-run re-pulls the
   PinMeTo record every time (that is why it is "the same workflow as a first scan"), so
   NAP, hours, coordinates and `network` always come from the MCP, never from history. When several reports exist for the brand and the request is
   ambiguous, ask which one; a scheduled scan updates only the report it was created for.
2. **Compute deltas, then narrate them.** The trend section needs: overall delta since last
   scan and since first scan, per-pillar deltas, and the concrete check-level changes
   (`fail→pass`, `pass→fail`, new warns). "What moved" lines come from the check diff, not
   from vibes. Checks that have never moved across ≥3 scans deserve a call-out — stagnation
   on a high-worth Theme is the most useful thing a monitor can say.
3. **Publish to the same URL.** Redeploy the same Site project in ChatGPT/Codex or republish
   the same artifact in Claude. Never mint a second deliverable for the **same report
   identity** — the exact title *and* scope matched in step 1; two living scorecards for one
   scope is worse than none. A brand legitimately holds several reports at once (global plus
   per-country or per-region, see `artifact-report.md`), so a different scope is a *new*
   report with its own Site or artifact, not a duplicate. Reuse a URL only after the identity
   matches.

Apply the per-report single-writer and pre-publish history check in `artifact-report.md` to
manual and scheduled scans alike. A scan that cannot prove it is appending to the latest history
must leave the live report unchanged rather than risk losing another scan.

If the user asks for a one-off comparison ("what changed since April?"), answer from the
history block — no new scan needed unless they want fresh data.

## Setting up a schedule

Offer after delivering the first report, once — don't nag. Weekly for brands actively
shipping fixes, monthly for steady-state monitoring. Use whatever the host provides, in
order of preference:

- **Scheduled tasks / routines** (ChatGPT/Codex automations, Claude Code `/schedule`,
  scheduled-task tools, or cron
  jobs): create a recurring task with a prompt like
  `Run the PinMeTo web presence scan for <domain>, scope <scope or "whole brand">, and
  update the existing report "PinMeTo Web Presence — <domain>[ — <Scope>]" in place. Reuse
  that report's pinned sample and scope filter from its history block. Compare against the
  last scan and lead with what changed.`
  **One schedule per report** — a brand with a global report plus three country reports has
  up to four schedules, each naming its exact report title. Stagger them (different days)
  rather than batching all scopes into one giant run.
- **No scheduler available** (e.g. plain Claude Desktop): tell the user plainly that runs
  are on-demand here, and give them the exact re-run sentence to say (the same one printed
  in the report's "What to do next" card).

Scheduled runs are non-interactive: they must not stall on questions. Reuse the pinned sample
and scope filter from the history block. Re-fetch NAP, hours, coordinates, and `network` from
the PinMeTo MCP for every scan. If the PinMeTo MCP is disconnected or its baseline call fails,
stop the scan, leave the report unchanged, and surface a setup-required failure; do not append
an unscorable scan. If the browser is unavailable or a site/map surface cannot be observed,
keep the documented `warn` degradation and add a visible banner naming the evidence gap.

## Guardrails for scheduled scans

- Respect the same evidence budget: sampled pages, 2–4 min per location per platform on maps.
- If the PinMeTo fleet changed materially (>20% locations added/removed), flag it in the
  report — the trend line's comparability is weakened. **The sample is still not re-drawn:**
  pinned locations that remain in the fleet stay in the sample (see `pinmeto-data-check.md`);
  only departed locations are replaced. Re-drawing would make the trend measure sampling
  noise while claiming to measure change. If the user wants coverage of the new locations,
  that is a *new* scoped report, not a mutation of this one.
- If two consecutive scheduled scans end mostly-warn (site unreachable, consent walls), stop
  the schedule and tell the user instead of accumulating junk scans in the history.
