# Dogfood run 2 — pinmeto.com re-run (Opus, skill v0.8.1, rubric 2.11.0-skill.1)

**Date:** 2026-08-09 · **Host:** Claude Code (in-app Browser, PinMeTo MCP, Artifact tool)
**Scope:** whole brand, no country filter · **Artifact:** https://claude.ai/code/artifact/966d9878-4366-4164-8cdb-5064b3fa60aa (updated in place)
**Wall clock:** ~37 min (11:47 → 12:24) · **Tokens:** ~170k primary context + 67k in one Haiku subagent

This is the first test of the **re-run path**. The previous scan (same day, rubric 2.9.0-skill.1)
scored 62 / C.

---

## (a) Run summary and what moved

| | First scan (2.9.0) | This scan (2.11.0) | Δ | Cause |
| --- | --- | --- | --- | --- |
| **Overall** | 62 (C) | **64 (C)** | +2 | rubric + measurement only |
| SEO | 23 | **33** | +10 | **100% rubric** (dual-pass rendering credit) |
| GEO | 78 | **75** | −3 | **100% rubric** (connection downgrade + parity slot, minus special-hours relief) |
| AIO | 88 | **89** | +1 | measurement correction (markdown probe) |
| Agent readiness | 65 | **62** | −3 | measurement correction (prior run scored one probe two ways) |
| pass / warn / fail | 30 / 2 / 27 | 30 / 3 / 26 | | `geo.photos_5_plus` moved fail→warn |

**Nothing on the site changed between the two scans.** All five sampled location pages return the
same 294,657-byte shell with an identical SHA; robots.txt, `llms.txt`, `llms-full.txt`, the sitemaps
and the `Link:` header are byte-identical; `/.well-known/mcp-server-card` and `/.well-known/api-catalog`
still 301-then-404. Every point of movement is attributable to the rubric or to a measurement fix, and
the report says so in the trend callout, the hero sub-line and the summary. The top 3 fixes are the
same 3 as last time.

Breakdown of the +10 SEO: `canonical_present`, `meta_title_unique`, `h1_unique_has_location`,
`og_twitter_per_location` each moved 0 → 0.5 under the new dual-pass policy (2.5 + 2.5 + 2.5 + 2.5 =
10.0 pillar points = +3.0 overall). `meta_description_unique` did **not** move — it fails in both
passes because Oslo and Mumbai carry an identical `shortDescription` in PinMeTo — and
`localbusiness_jsonld_present`/`_richness` did not move because the hydrated node's `@type` is
`"Internet marketing service"` (a GBP category, not a schema.org type), so there is nothing valid to
credit even after rendering. That non-movement is the honest part of the story and the report leads
with it.

Breakdown of the −3 GEO: `geo.special_hours_set` now scores from PinMeTo's `specialOpenHours`
(3 of 5 locations pass) which *helped*; against that, the 2.10 downgrade rule turns Helsinki's and
Oslo's Apple connections into fails (the connected listing shows an address, phone and pin PinMeTo
does not hold), and the parity slot now counts the brand-wide parity fail once in the Google column
of **every** sampled location. Net −3 on unchanged listings.

The −3 on Agent readiness is the ugliest finding about the *skill*, not the site: the first scan
recorded `ar.markdown_content_negotiation` as `pass / 1.0` while recording the identical probe as
`fail / 0.5` under `aio.markdown_content_negotiation`. `agent-readiness-checks.md` says in as many
words that "the two must never disagree". They did. Both now read 0.667 (2 of 3 page types).

GEO sub-group detail this run: A = 61.4, B = 83.5, C = 100.0.

---

## (b) Friction

### The re-run path

**1. `WebFetch` on the artifact ignored the prompt and dumped ~11k tokens of frame runtime.**
`artifact-report.md` says "fetch the published page, parse the `pmt-scan-history` JSON". I asked
WebFetch to reproduce the block verbatim; it answered nothing and instead streamed the head of the
208 KB document into my context — the entire claude.ai frame-runtime bundle, the whole stylesheet,
the hero, the first eight SEO accordion rows. What actually saved the run is that the tool *also*
writes the full HTML to a local path, which I then parsed with six lines of Python for ~200 tokens.

That local-file escape hatch is the only cheap way to do this, and the reference does not mention it.
Worse, the naive alternatives both fail: a markdown-converting fetcher strips
`<script type="application/json">` entirely, and `curl` on a claude.ai artifact URL gets the SPA shell
or a 403. **This is the single biggest re-run cost and it is undocumented.**

> Suggested text for `artifact-report.md` § Re-run flow: "WebFetch the artifact URL once. Do not ask
> the fetch prompt to transcribe the history block — it will not, and the head dump costs ~10k tokens.
> The tool saves the full HTML locally; read that file and extract the block with
> `re.search(r'<script type="application/json" id="pmt-scan-history">(.*?)</script>', h, re.S)`.
> Never `curl` an artifact URL and never use a markdown-converting fetcher for this."

**2. Artifact discovery itself was frictionless.** `action:"list"` returned three artifacts, the exact
title matched on the first row, and the URL was right there. No improvisation needed. Good.

**3. Pinned-sample reuse was frictionless.** `pinmeto-data-check.md` step 2 worked verbatim: read the
five storeIds from history, `pinmeto_get_location` on exactly those, no discovery pagination, no
substitutions needed. This is the part of the re-run design that clearly works.

**4. Rubric-version ambiguity — the most important fix in this log.** `rubric.md` lines 32–33:

> "When re-running an existing report, keep using the rubric version recorded in that report's history
> for delta narration, and note it if this file has moved on since."

On a first read this says *score with the old rubric*, which would make the whole dual-pass change
invisible and defeat the point of re-running. I read it as "score with the current rubric; narrate the
delta with awareness of the old version" — but I had to make that call, and a different run could
plausibly make the other one. Two runs of the same skill would then produce non-comparable numbers,
which is exactly what the rubric section exists to prevent.

> Suggested replacement: "A re-run always scores with the rubric version in *this* file. Prior scans
> keep the scores they were computed with and are never recomputed. When the version has moved, the
> trend section must attribute the movement: for every check whose ratio changed, state whether the
> cause is (i) a rubric change, (ii) a measurement correction, or (iii) real change on the site. Do
> not present a rubric-caused delta as customer progress."

**5. Nothing tells you what to do when the previous scan was wrong.** `scoring.md` §5 says old scans
keep their scores — correct — but there is no third category between "rubric changed" and "the site
changed". I had to invent "measurement correction" for the markdown-probe contradiction and for
re-probing `/blog/` vs a blog article. Every re-run of a real brand will hit this.

**6. The previous artifact contradicted itself.** Its hero scorecard rendered SEO as **22**; its
`pmt-scan-history` block recorded SEO as **23**. Two sources of truth for the same number inside one
document. I trusted the history block (it is the machine contract) and the trend table now says 23,
which will not match a stakeholder's memory of the page they read.

> Suggested: `artifact-report.md` should require the hero, the scorecards and the trend table to be
> rendered *from* the history entry for that scan, never computed separately.

**7. Trend section: spec is good, has no template, and is undefined at n=2.** §4 lists the five
required parts and I built all five, but the inline SVG line chart had to be hand-rolled, and with two
same-day scans it is two dots and a nearly flat segment — visually thin, and the x-axis labels
("9 Aug (1st)", "9 Aug (2nd)") are my invention because the spec assumes distinct dates. Also nothing
says the "What moved" bullets should be *derived from the diff of the two `checks` maps* — which is the
obvious mechanical way to do it and the reason that map is stored at all. I did it by hand.

### Things changed since v0.4.0

**8. Dual-pass credit vs. the `gradient_checks` whitelist — a live contradiction.** `rubric.md`:
"Only the check ids in `gradient_checks` may carry a measured ratio. Every other check scores exactly
1 / 0.5 / 0." But the rendering policy hands `seo.canonical_present` and `seo.meta_title_unique` —
neither of which is on the whitelist — a 0.5. Legal by the letter (0.5 is in the allowed set) but it
means **0.5 now denotes two different things**: "could not measure" (warn) and "rendered-only half
credit" (a real half-failure). `scoring.md` §1 flags this in one sentence; it needs to be much louder,
because a reader scanning the whitelist will conclude the rendered-only credit is illegal on those
checks.

**9. Uniqueness checks are underspecified under dual-pass.** The policy is written for
value-present/value-absent. `seo.meta_title_unique` is a *set* property: served = five identical,
rendered = five distinct. I scored 0.5. `seo.meta_description_unique` fails in both passes → 0. Neither
is stated anywhere; both are defensible and a different run could score the first one 0 or 1.

**10. The Google "applicable checks" list is not written down.** Sub-group A is "share of applicable
checks passed", and `geo-browser-checks.md` describes the members in prose across three paragraphs. I
had to assemble the 13-item Google column (connected, name, address, phone, website, coords, parity,
hours, special hours, photos, attributes, recent reviews, alerts), 5-item Apple column and 6-item Bing
column myself — and got the sum wrong by hand before the script caught it. `menu_order_reservations`
is "category-applicable"; I excluded it for "Internet marketing service", and I only know that matches
the last run because its history map happened to omit the id. **This is the single largest source of
run-to-run drift in GEO and it should be a machine-readable list in `rubric.md`.**

**11. The parity slot is a bigger lever than it looks.** Counting one brand-wide parity fail once per
location in the Google column costs 1/13 of the Google column on every sampled location — which the
nested weights carry through as ≈4.2 points of sub-group A (×0.55 Google), ≈2.3 points of GEO (×0.55
sub-group A weight), ≈0.7 overall points (×0.30 GEO pillar weight). The original note conflated
sub-group A with GEO. That is deliberate per 2.10, but it deserves a sentence saying so, because it is
most of why GEO fell here.

**12. The connection downgrade rule has no threshold.** "listing data that is plainly stale against
PinMeTo" — I applied it where address *and* phone *and* pin all disagreed. Does a wrong phone alone
trigger it? Unspecified, and it flips a check that is worth real points.

**13. The listing-content table asks for a photo count Google does not give you.** Both my extraction
and the subagent's read a reviewer-profile line ("Local Guide · 52 reviews · 21 photos") as the
listing's photo count. The Gdańsk "21 photos" in my first pass was that. The photo grid would not open
via `javascript_tool` or a button click in this host. I ended up scoring `geo.photos_5_plus` as
**warn**. The reference should warn about the reviewer-profile trap explicitly and prescribe the
fallback (open `/photos` view, or record warn — never infer from an innerText number).

**14. NAP matrix "Hours" column is a category error, mildly.** The spec puts Hours in the matrix with a
Google-only chip, but hours are not a per-platform NAP comparison in sub-group B — they are a Google
richness check plus a sub-group C page-agreement field. The chip is fine and useful; the legend should
say what it is comparing (Google's weekly table vs the PinMeTo record), otherwise it reads as if Apple
and Bing hours were checked and omitted.

**15. Pre-publish sanity checks: excellent, and they earned their keep.** I implemented all five as
assertions in the generator (one `<title>`, exactly two `<script>` tags with the history block first and
the plain interactivity script last, history JSON parses with both scans present, no inline `onclick`,
no stray `<title>` after the drawer) plus a local `http.server` run in the browser that clicked an
accordion, opened and closed a drawer, and toggled the filter (`scripts=2`, `titles=1`,
`filter attn: 30 of 59 visible`). This is the best-specified part of the whole reference set. One
addition worth making: serving the file locally without a charset header exposed a mojibake in a CSS
`content:" ·"` rule — worth telling the generator to escape non-ASCII inside CSS as `\00B7` rather than
chasing it at publish time.

---

## (c) Delegation and parallelism — was the guidance followable?

**Followable, mostly, and one rule is self-contradicting.**

What I did, mapped to SKILL.md "Scripts, delegation, and model choice":

| Rule | Applied? | Effect |
| --- | --- | --- |
| 1. Scripts beat any model | yes — `fetch.py`, `extract.py`, `gen.py` | 19 URLs concurrently in **6.0 s**; scoring arithmetic caught a hand-math error of mine (I had summed the Google column as 10.5/13 when it is 9.5/13, which would have inflated GEO by ~4 points) |
| 5. PSI first, in the background | yes | no benefit — quota exhausted again in 30 s — but no cost either |
| 2. Delegate mechanical stages to a small model | yes — one Haiku subagent for all five locations × three platforms | 67k tokens, 7 min, kept entirely out of my context |
| 4. One browser, one driver | yes — subagent run synchronously, nothing else touching the browser | no collisions |
| 5. Run Stages 2–3 and Stage 4 concurrently | **no — impossible here** | see below |

**Rule 5 contradicts rule 4 for any client-rendered site.** The advice is to run the HTTP-only stages
and the browser stage at the same time. But the dual-pass policy means Stages 2–3 *also* need the
browser for the rendered pass — so on a SPA there is exactly one browser and both stages want it. I
sequenced: served fetches (script) → rendered pass (me, 6 browser reads) → GEO (subagent). Fine, but
the guidance should say so instead of promising an overlap that a SPA makes impossible.

**What delegation actually bought, honestly:**

- **Saved:** ~67k tokens of map-surface noise that never entered my context, and it produced *correct*
  results for everything checkable against a baseline — 15 platform/location NAP triples, coordinates
  to 6 decimals, two correct "no Apple listing" findings, two correct wrong-address findings.
- **Cost:** every Google *richness* field came back null or wrong. `hours: null` on all five (all five
  actually publish full weekly tables that match PinMeTo exactly — that is a **passing** check the
  subagent would have zeroed). `photos: 2` on four of five (reviewer-profile misread). `attributes: []`
  (true, but unverified — it never opened the About tab). `newestReview: "~2025-08-09"` — a fabricated
  ISO date synthesised from Google's relative label "a year ago", which is precisely the "never invent a
  value" instruction I had given it in bold. It also reported the Oslo Apple pin as "~1.5 km" when it
  is 4.5 km.
- **Net:** I re-drove all five Google cards myself (~12 browser calls, ~8 min). Delegation saved tokens
  on the easy-to-verify half and cost time on the half that needed judgment — which is arguably exactly
  what rule 3 predicts, just drawn in the wrong place.

**vs. run 1 (~32 min / ~260k tokens):** this run was ~37 min / ~170k primary + 67k subagent. Wall clock
went *up* (the re-verification loop, plus generating a bigger report with a trend section); primary
context went down by roughly a third. If the delegation boundary were drawn correctly — see the
suggested edit below — I would have saved the 8 minutes of re-verification too.

---

## (d) Correctness worries

1. **`geo.photos_5_plus` is a warn, not a measurement.** Numerically identical to last run's 0.5, so
   GEO is unaffected, but the pass/warn/fail counts moved for a non-reason (30/2/27 → 30/3/26).
2. **`page.jsonld_telephone_matches_dominant` is inherited, not verified.** My rendered JSON-LD capture
   was truncated at 1400 chars and I never actually saw `telephone` in the Malmö node. The visible page
   shows the number. Passed on the prior run's evidence plus the visible NAP. Low confidence.
3. **Review recency is read off Google's *relative* labels, in Swedish.** Oslo's newest is "edited 6
   months ago" — 180 days is the threshold. A different day, or Google's rounding, could flip that
   check. I called it fail (outside 180 days) and said so in the evidence.
4. **Google served every card in a Swedish locale**, regardless of the location's country. So
   "Internetmarknadsföring" for the Mumbai and Gdańsk listings is Google translating, not a category
   mismatch — but "matches PinMeTo" in the listing-content table is therefore *my translation
   judgment*, not an observed string match. The report says this under the table; a future run in a
   different locale will observe different strings for the same underlying state.
5. **Bing's website check was verified by decoded href on Malmö only**; the other four are inferred from
   the displayed URL path. The subagent's raw reading ("https://www.pinmeto.com") was display-text
   truncation and would have failed the check wrongly had I taken it at face value.
6. **Sub-group C scored a clean 100** and I verified hours + visible NAP + name + geo on all five, but
   telephone on three. Partly inherited.
7. **`aio.speakable_specification` passes on the article template only.** The homepage and location
   pages have no `speakable`. The check says "homepage or key pages", so this is legal — but it is the
   kind of check where "key pages" will drift between runs.

---

## (e) Suggested edits, concrete

**High priority**

1. `rubric.md` lines 32–33 — replace the rubric-version sentence with the explicit re-run rule in
   friction point 4 above. This is the one that can make two runs incomparable.
2. `rubric.md` — add a machine-readable `applicable_checks` map per platform inside the GEO block
   (`google: [...13 ids...]`, `apple: [...5...]`, `bing: [...6...]`), and state which are conditional
   and on what. Sub-group A is unreproducible without it.
3. `artifact-report.md` § Re-run flow — add the WebFetch/local-file/regex recipe verbatim, plus "do not
   curl an artifact URL, do not use a markdown-converting fetcher".
4. `scoring.md` §1 — promote the "rendered-only 0.5 ≠ warn 0.5" note to its own short subsection, and
   add to `rubric.md`'s `gradient_checks` note: "the rendered-only 0.5 is permitted on any `html`/
   `json-ld` check regardless of this whitelist; it is not a measured ratio."
5. `SKILL.md` rule 2 — narrow the delegation boundary:
   > "Delegate the **identity and position** reads — existence, name, address, phone, website href,
   > coordinates — which are verifiable against the PinMeTo baseline. Keep the **Google richness** reads
   > (weekly hours table, photo count, review recency, attribute chips) on the primary model: they
   > require reading a localized UI and relative dates, and a small model returns plausible numbers
   > instead of nulls. Require the subagent's schema to use `null` plus a note; reject any value
   > prefixed `~` or `approx`."
6. `SKILL.md` rule 5 — add: "On a client-rendered site the rendered pass of Stages 2–3 needs the same
   browser as Stage 4, so those two cannot overlap. Sequence: concurrent served fetches → rendered pass
   → GEO."

**Medium**

7. `seo-checks.md` — one paragraph on uniqueness checks under dual-pass (`title`, `description`):
   unique only after rendering = 0.5; duplicated in both passes = 0; unique in served = 1.
8. `geo-browser-checks.md` — warn that Google's card innerText contains reviewer-profile strings of the
   form "N reviews · M photos" and that these are **not** the listing's photo count; prescribe the
   fallback (open the photo grid, else `warn`).
9. `geo-browser-checks.md` — give the connection-downgrade rule a threshold (e.g. "downgrade when the
   listing disagrees with the record on address **or** pin, or shows an unclaimed banner").
10. `artifact-report.md` §4 — say the "What moved" bullets are derived from a diff of the previous and
    current `checks` maps, and each bullet must classify the cause as rubric / measurement / real.
    Add guidance for n=2 (label the points with date *and* ordinal when dates collide).
11. `artifact-report.md` — require the hero score, scorecards and trend table to render from the
    history entry, so a report can never disagree with its own embedded state (the prior artifact
    showed 22 vs 23).
12. `artifact-report.md` §9 — legend should state what the Hours chip compares (Google's weekly table
    vs the PinMeTo record), since it is not a per-platform NAP comparison.

**Low**

13. `artifact-report.md` pre-publish checks — add "escape non-ASCII inside CSS `content:` rules as
    `\00B7`-style escapes" (mojibake when served without a charset header).
14. `pinmeto-data-check.md` — note that storeIds are case-sensitive to the MCP but the site may
    lowercase them in URLs (`/locations/GDANSK/` → `/locations/gdansk/`); use the record's storeId for
    MCP calls and the resolved URL for evidence rows.
15. Consider recording in the history block, per scan, a short `notes` array for measurement
    corrections, so the next run can see "this check was mis-scored in scan 1" without re-deriving it.

---

## What worked well, unprompted

- The `pmt-scan-history` contract. Storing status+ratio for **every** check is what made an honest
  rubric-vs-real attribution possible at all. Without it this run would have said "SEO up 10" and
  meant nothing by it.
- Pinned sampling. Zero ambiguity, zero re-selection, the trend genuinely measures the same five
  locations.
- The pre-publish sanity checks plus the local-server interactivity click-through. The prior run's
  unescaped-`<title>` bug is exactly the class this catches, and the generator's `code()` helper
  (escape everything, re-allow `<code>`/`<em>`/`<b>`) made it a non-issue — the report quotes
  `<title>`, `<h1>` and `<link rel=canonical>` literally in five places and still has
  `document.scripts.length === 2`.
- Generating the HTML from a data structure rather than hand-writing it. 59 accordion rows and 59
  drawers, 216 KB, produced deterministically; regenerating after a wording fix took 0.4 s.
- The G/A/B NAP chips are a real improvement on the flattened matrix. Helsinki's Address cell reading
  `G✓ A! B!` with hover values is the single most persuasive object in the report.
