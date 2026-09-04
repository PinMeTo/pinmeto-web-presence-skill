# Dogfood run 2: pinmeto.com re-run (Opus, skill v0.13.0, rubric 2.14.0-skill.1)

**Date:** 2026-09-04 · **Host:** Claude Code (headless), PinMeTo MCP, own isolated Chrome
**Scope:** whole brand, no country filter · **Report:** `docs/test-runs/2026-09-04-report-scan2.html`
(327 KB, committed next to this record; scan 1's history carried forward inside it)

This is the first test of the **re-run path against the two-layer references**. The first scan of
the same day scored 72 / C. Both scans share a date, which turned out to be useful: it exercises the
chart's same-date ordinal labelling, and it puts the trend card at exactly two scans, where the
subline must be dropped.

The re-run was genuine, not a re-render: the PinMeTo baseline was re-pulled with `forceRefresh`, the
15-URL concurrent burst and both markdown-negotiation probes were re-fetched, PageSpeed was
re-attempted, and **all 15 GEO lookups were re-observed in the browser**. The reduced-coverage
budget was not needed.

---

## (a) Run summary and what moved

| | First scan | This scan | Δ | Cause |
| --- | --- | --- | --- | --- |
| **Overall** | 72 (C) | **73 (C)** | +1 | one observation changed |
| SEO | 50 | **50** | 0 | nothing moved |
| GEO | 74 | **78** | +4 | one Apple listing |
| AIO | 80 | **80** | 0 | nothing moved |
| Agent readiness | 97 | **97** | 0 | nothing moved |
| pass / warn / fail | 34 / 2 / 23 | **36 / 2 / 21** | | two checks moved fail to pass |
| Themes, worth | 8, ~23 | **8, ~22** | −1 | `same-details-everywhere` 3 to 2 |
| GEO sub-groups | A 60.95 · B 83.50 · C 100 | **A 64.55 · B 90.00 · C 100** | | |

**Everything on the site is byte-identical.** All five office pages and both office finders return
the same 129,523-byte shell with the same md5 as the first scan; robots.txt, both llms files, the
three sitemaps, the three `.well-known` payloads and the homepage `Link:` header are unchanged;
PageSpeed returned HTTP 429 again. Fourteen of the fifteen platform lookups returned the same facts.

**One thing moved, and it moved five rollups.** The Apple listing reached through the Malmö office's
stored `auid` changed between the two scans:

| | Scan 1 | Scan 2 (and five further reads) |
| --- | --- | --- |
| Apple `place-id` | `I438588C9E3847888` | `I438588C9E3847888` (**same place**) |
| Address | Brunnsgatan 30, 224 57 **Lund** | Adelgatan 9, 211 22 **Malmö** |
| Pin distance from the record | **16,507 m** | **about 0 m** |
| Claim banner | none | none |
| Phone | matches | matches |

That took Apple/Malmö's sub-group A column from 2 of 5 to 5 of 5, lifted Malmö's sub-group B from
0.675 to 1.0, and moved five check-id rollups: `geo.coords_within_50m` and `consistency.address`
crossed from fail to pass, `consistency.coords_50m_cluster` rose 0.80 to 0.90 inside pass, and
`geo.listing_connected_pinmeto` and `geo.address_matches_site` rose from 0.67 to 0.73 while staying
fail (Helsinki and the two missing Apple listings still hold them down).

**How it is classified, and what I could not settle.** The rubric version did not move, so the
re-run rule leaves rubric change out and forces a choice between *measurement correction* and *real
change*. I recorded it as a real change **in the observation** and said so in the report's own
callout, together with what cannot be told apart: either Apple's data for that place was corrected
in the window between the scans, or my first read returned a stale copy of it. The place identifier
being the same both times rules out a different listing being resolved; it does not rule out a stale
response. The report credits nobody for the move, which is what the writing-style rule requires.
Recorded in the history entry's `notes` so a third scan does not have to re-derive it.

The report's trend callout leads with that concrete cause and the caveat, then lists the five
mechanical bullets from the checks diff. Getting the mechanical part for free from the diff is
exactly what the `checks` map is for; without it, this run would have said "GEO up 4" and meant
nothing by it.

---

## (b) Friction on the re-run path

**1. Re-running is cheap now, and reading the previous history was trivial.** No artifact surface
exists in this environment, so the "read the published report" step was a regex over the local file,
which is the shape `artifact-report.md` already recommends for the Sites path ("extract
`<script type="application/json" id="pmt-scan-history">…</script>` from the saved full HTML rather
than asking a markdown converter to transcribe it"). It cost about 200 tokens. The prior run's
friction point about WebFetch dumping the document head did not recur because there was no fetch.
**What this run therefore did not test:** the Claude artifact-aware read and the Sites project
lookup. Both are still unexercised since v0.8.1.

**2. The pinned sample worked verbatim, and its edge case showed up.** The fleet is five open
locations and the sample is `min(5, N)` = all five, so the sample is total and pinning is a no-op
this scan. That is worth naming because it means **this pair of scans cannot test sample drift at
all**. A brand where the sample is a real subset would exercise step 2 of
`pinmeto-data-check.md` (replace departed locations, name the substitution); here there was nothing
to replace. The fleet had already dropped from 7 to 5 since the August run, which is a >20% change
and would have triggered the `monitoring.md` comparability flag had those runs shared a report
identity. They do not: this is a fresh report.

**3. The trend card at exactly two scans is the case the spec is sharpest about, and it held.** The
headline names the first scan and its date; the subline is dropped. Both scans share a date, so the
chart labels its points "4 September (1st)" and "4 September (2nd)", which is the collision rule
from #12. With two points the chart is a nearly flat segment, as the reference warns, and it is
still correct.

**4. The trend headline had the plural bug too, and the first scan could not have found it.** The
first render printed "Worth ~1 points" and "1 checks"; the re-run printed **"Up 1 points since your
first scan"**, because a one-point delta is the first thing a re-run can produce and the first scan
has no trend card at all. Same root cause as the scan-1 finding, one more surface. **Fixed** by
extending the same writing-style rule to the trend headline, the subline and the Themes h2 (which
would have printed "One themes, worth ~4 points together" for a single remaining Theme).

**5. "What moved" is mechanical but not concrete, and the reference wants both.** The diff gives you
*which* checks moved and by how much; it cannot give you *what changed on the platform*. §4 asks for
bullets that are "concrete and honest" and its own worked examples ("the MCP server card went live")
are narrations no diff produces. Read strictly as "derive the bullets mechanically", you get five
bullets that say five different rollups changed and never mention Apple or Malmö. I led the callout
with the observed cause and kept the mechanical bullets under it. The reference already supports
this reading; it is worth knowing the two sentences pull in different directions on a first read.

**6. Five rollups moving from one listing reads like five findings.** Related to 5. The reader sees
"The same address across platforms", "Map pins clustered within 50 m", "Listing address matches the
record", "Map pin within 50 m of the record" and "Listings connected through PinMeTo" all move, and
nothing in the mechanical bullets says they are one thing. The lead bullet now says so in as many
words. A Layer 2 reader gets the detail; a Layer 1 reader should not have to infer it.

**7. "Open since <date> · N scans" means "first seen failing", not "open without a break".** Proven
on the reopened fixture below: a Theme that failed in scan 1, cleared in scan 3 and failed again in
scan 4 renders "Open since 4 September 2026 · 4 scans". That is exactly what the reference
specifies (earliest scan in which any current member was `fail`, counted to now inclusive), and the
"reopened" wording in the callout carries the nuance, so the two together are honest. But the cell
alone reads as continuous, and a marketer quoting it would be slightly wrong. Recorded, not fixed:
changing it is a design call for a future ticket, not a dogfood repair.

**8. Nothing cleared and nothing reopened in the real pair, so I proved those two paths on a
labelled fixture.** With one observation moving and no Theme emptying, the real re-run correctly
shows **no** Themes-cleared line and **no** reopened wording, which is a pass on the "omitted where
not applicable" half of the contract but proves nothing about the other half. I therefore built two
synthetic histories, ran the real generator against them, and threw them away. They are **not
committed and are not scans of the site**; they exist only to exercise rendering:

| Fixture | Construction | What it rendered |
| --- | --- | --- |
| 3 scans | scan 3 = scan 2 with `aio.haspart_about_mentions_enrichment` forced to pass, so `answers-on-page` empties | Headline "Up 2 points since your first scan on 4 September 2026". Subline **appears** at three scans: "+1 since 4 September 2026". Cleared line: "**One theme** cleared since your first scan on 4 September 2026: Answer customers' questions on the page itself", singular, name verbatim from the mapping, plain text with no anchor because the card is gone. The card **is** gone, and the h2 recounted to "Seven themes, worth ~21 points together" |
| 4 scans | scan 4 = the same check failing again | Subline "−1 since 4 September 2026" with the correct minus sign. Cleared line **omitted**, rather than printing "0 themes cleared", because the only Theme that had cleared is now reopened. "What moved" names it: "Answer customers' questions on the page itself **reopened**: 1 member check is failing again", in the same words as progress. The card is back in the work list with "Open since 4 September 2026 · 4 scans" |

---

## (c) Delegation and parallelism

No subagents. `SKILL.md` rule 2 offers a small model for the identity-and-position reads, and the
prior run's finding was that the boundary was drawn wrong: it saved tokens on the verifiable half
and cost eight minutes re-verifying the Google richness half. With a five-location sample the
delegation saving is small and the coordination cost is not, so I drove everything myself.

Rule 5 (parallelize everything that is not the browser) worked as written, and its documented caveat
is real: the rendered pass of stages 2 and 3 needs the same browser as stage 4, so the sequence was
concurrent served fetches, then the rendered pass, then GEO. PageSpeed first in the background cost
nothing and gained nothing, again, because the quota was gone.

Rule 4's new machine-wide clause is the one that mattered. `chrome-devtools` could not start at all
in either scan: another live session on this machine held the shared Chrome profile. I ran my own
browser on a separate user-data directory, one driver, sequentially. Wall clock for the 15 GEO
lookups plus the four extra Google passes was about eleven minutes, roughly half the run, same as
the first scan.

---

## (d) Correctness worries

1. **The Apple/Malmö classification is the whole delta.** If the first read was stale rather than
   the listing being wrong, then the honest reading is that GEO was 78 all along and the first scan
   under-reported it by 4. The report says this plainly instead of choosing. Everything else in the
   +1 follows from it.
2. **`geo.address_matches_site` and `geo.listing_connected_pinmeto` moved 0.67 to 0.73 and stayed
   fail.** Correct arithmetic, and it means a reader watching the accordion result label sees "10 of
   15" become "11 of 15" with no status change. The rollup is doing its job; a status-only view of
   the trend would have shown nothing.
3. **Two scans on one date.** Legal, handled by the chart's ordinal rule, and the reference is
   explicit about it. But `dh(date)` is all the scan-history table shows, so its two rows read
   "4 September 2026 / First scan" and "4 September 2026 / Re-run" and are told apart only by the
   label column. That is what the label is for, and it works.
4. **The re-run inherits every scan-1 judgment call.** Mumbai's photo warn, Helsinki's
   `consistency.address` zero, the `locationDescriptor` reading for the Helsinki h1, and the
   rendered-only credit reading are all unchanged and all still mine. A re-run cannot audit them;
   it can only be consistent with them, which it is, deliberately, because inconsistency there
   would print as customer movement.
5. **`consistency.coords_50m_cluster` reads "pass 0.80 to pass 0.90"** in the callout. Honest, and
   slightly odd to a reader who does not know that the rollup is a mean over locations rather than a
   verdict. The bullet gives both numbers, which is the best available.

---

## (e) Suggested edits

**Fixed on this branch** (all prose, no scoring; the full list with files is in section (g) of the
first-scan record):

1. `artifact-report.md`: the singular rule now covers the trend headline, the trend subline and the
   Themes h2, not only the card strings (friction 4).

**Own ticket:**

2. `artifact-report.md` §4: say explicitly that the "What moved" callout is a concrete narration of
   the observed cause **plus** the mechanical bullets from the diff, and that several rollups moving
   from one observation should be named as one thing (friction 5 and 6). The current text can be read
   as diff-only, and the section's own examples cannot come from a diff.
3. `artifact-report.md`: decide whether the "Open since" cell should measure first-seen-failing or
   continuously-failing, and say which (friction 7). Today it is the former and reads as the latter.
4. `monitoring.md`: the re-run path's history read is documented for Sites and for Claude artifacts.
   Add the third case this environment is: no host artifact surface, report rendered to a file, read
   the block back from that file. It is the cheapest of the three and it is the one a headless run
   will hit.

---

## (f) The #20 by-eye checklist, re-run half

Verified in a browser against `docs/test-runs/2026-09-04-report-scan2.html`.

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | **Since-first-scan headline** | **PASS** | "Up 1 point since your first scan on 4 September 2026". Correct template, first scan's date, no adjectives, and the **singular** at one point after the fix |
| 2 | **Subline omitted at exactly two scans** | **PASS** | No `.subline` element exists in the document. The 3-scan fixture renders "+1 since 4 September 2026" and the 4-scan fixture "−1 since 4 September 2026", so the omission is conditional, not a missing feature |
| 3 | **"Open since <date> · N scans" cells** | **PASS** | All 8 Theme cards carry it, e.g. "5 checks · One developer task · one fix, pays in 2 pillars · Open since 4 September 2026 · 2 scans". Absent on the first scan's cards, as required |
| 4 | **Themes-cleared line only where applicable** | **PASS** | Absent here: nothing cleared. Present and correct on the 3-scan fixture: "One theme cleared since your first scan on 4 September 2026: Answer customers' questions on the page itself", and absent again on the 4-scan fixture where that Theme reopened, rather than printing "0 themes cleared" |
| 5 | **Reopened wording where applicable** | **PASS** | Absent here. On the 4-scan fixture: "Answer customers' questions on the page itself reopened: 1 member check is failing again", named in "What moved" by the mapping name verbatim |
| 6 | **Hero, scorecards, chart and Layer 2 table agree** | **PASS** | History holds 72 (50/74/80/97) then 73 (50/78/80/97). Hero reads **73**; scorecards read **50 / 78 / 80 / 97**; the chart's point labels read **72** and **73** over "4 September (1st)" and "4 September (2nd)"; the Layer 2 scan-history table's two rows read `4 September 2026 · First scan · 50 · 74 · 80 · 97 · 72` and `4 September 2026 · Re-run · 50 · 78 · 80 · 97 · 73`. Count tags "21 failing / 2 could not be measured / 36 passing" equal `counts`. Four surfaces, one source |
| 7 | Theme card contract, re-checked | **PASS** | All 8 headlines and effort labels still verbatim against the mapping. Worth pills 7, 4, 4, 2, 2, 1, 1, 1 summing to the h2's ~22. Rank badges on the top three only, orange fill with navy numeral. No orange border on any card side; the one hit in a naive computed-style sweep is `outline-color` on the orange kicker text, where `outline-style` is `none` and `outline-width` renders nothing |
| 8 | "Copy all N briefs", re-checked | **PASS** | All 8 themes: N blocks separated by lines containing only `---`, N equal to the label, separators N−1, every block five-field and starting with `Goal:`. `answers-on-page` now reads "Copy all 1 **brief**" |
| 9 | Printing gives Layer 1 only, re-checked | **PASS** | With Layer 2 collapsed: hero, summary, scorecards, **trend**, Themes, NAP chip and "What to do next" render; the expander is absent including its summary; an open Theme brief and the scrim do not render; zero `.np` elements render. Expanded: Layer 2 contents print, the brief still does not |
| 10 | NAP summary chip at a non-zero match count | **PASS** | The first scan had 0 of 5 matching and correctly showed the orange chip alone. This scan Malmö agrees on every field, so the green chip appears: "1 of 5 locations match everywhere" beside "12 mismatches across 5 locations". Both ends of the fixed rule exercised |
| 11 | Structure and embedded state | **PASS** | One `<title>`, two `<script>` elements (history JSON first, interactivity last), zero inline handlers, `lang="en"`, history parses with **both** scans present and the older entry byte-preserved, 4 `notes` entries on the new scan including the Apple attribution |

---

## What worked well, unprompted

- **The `checks` map earned the whole re-run.** Five rollups moving from one listing, each with a
  before and after ratio, derived mechanically. Nothing about the attribution needed a guess except
  the one thing that genuinely cannot be known from two readings.
- **Theme worth is stable where it should be and moves where it should.** Seven of the eight Themes
  hold their worth to the point; only `same-details-everywhere` drops, from ~3 to ~2, and it drops
  for a reason a reader can name. The h2 total follows the pills, so the heading and the cards never
  disagreed across four renders.
- **Themes with nothing failing stayed absent through both scans.** `fast-on-phones` (both members
  warn) and `agent-front-door` (all six pass) never appeared, and the cleared Theme in the fixture
  left the list the moment it emptied. The work list stayed a work list without any per-scan
  judgment.
- **The generator asserting the pre-publish checks before writing** caught a stale reference during
  the scan-2 build (the prose-override hook landed after its first use) instead of producing a
  half-rendered report. Recommending that inversion in the reference would be a real improvement:
  check, then write, rather than write, then check.
- **The same-date collision rule.** Two scans an hour apart is the awkward case, and the chart's
  ordinal labels handled it without any special-casing on my side beyond what #12 specifies.
