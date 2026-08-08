# Monitoring — re-runs and schedules

The report is a living scorecard. Two mechanics make that real: re-runs that update in
place, and an optional schedule that triggers them.

## Re-run mechanics

A re-run is the same workflow as a first scan, with three differences:

1. **Find the existing artifact first** (by the stable title `PinMeTo Web Presence —
   <domain>`), fetch it, and parse `#pmt-scan-history`. Its latest scan supplies the
   comparison baseline, the previous sample (reuse it — see `pinmeto-data-check.md`), and
   the rubric version to narrate against.
2. **Compute deltas, then narrate them.** The trend section needs: overall delta since last
   scan and since first scan, per-pillar deltas, and the concrete check-level changes
   (`fail→pass`, `pass→fail`, new warns). "What moved" lines come from the check diff, not
   from vibes. Checks that have never moved across ≥3 scans deserve a call-out — stagnation
   on a top fix is the most useful thing a monitor can say.
3. **Republish to the same URL.** Never mint a second artifact for the same brand; two
   living scorecards is worse than none.

If the user asks for a one-off comparison ("what changed since April?"), answer from the
history block — no new scan needed unless they want fresh data.

## Setting up a schedule

Offer after delivering the first report, once — don't nag. Weekly for brands actively
shipping fixes, monthly for steady-state monitoring. Use whatever the host provides, in
order of preference:

- **Scheduled tasks / routines** (Claude Code `/schedule`, scheduled-task tools, or cron
  jobs): create a recurring task with a prompt like
  `Run the PinMeTo web presence scan for <domain> and update the existing report artifact
  "PinMeTo Web Presence — <domain>". Compare against the last scan and lead with what
  changed.`
- **No scheduler available** (e.g. plain Claude Desktop): tell the user plainly that runs
  are on-demand here, and give them the exact re-run sentence to say (the same one printed
  in the report's "What to do next" card).

Scheduled runs are non-interactive: they must not stall on questions. Reuse the stored
sample and inputs from the history block; if something essential is missing (MCP
disconnected, no browser for GEO), produce the report anyway with the affected checks as
`warn` and a visible banner naming what needs fixing before the next run.

## Guardrails for scheduled runs

- Respect the same evidence budget: sampled pages, 2–4 min per location per platform on maps.
- If the PinMeTo fleet changed materially (>20% locations added/removed), flag it in the
  report — the trend line comparability is weakened and the sample was re-drawn.
- If two consecutive scheduled runs end mostly-warn (site unreachable, consent walls), stop
  the schedule and tell the user instead of accumulating junk scans in the history.
