# Dogfood run — pinmeto-web-presence v0.4.0, rubric 2.9.0-skill.1

**Date:** 2026-08-09 · **Model:** Opus 5 (1M ctx), Claude Code subagent · **Target:** pinmeto.com (whole brand, first scan)
**Artifact:** https://claude.ai/code/artifact/966d9878-4366-4164-8cdb-5064b3fa60aa

---

## (a) Run summary

Executed all seven stages except Stage 7 (monitoring setup was intentionally skipped per the test
brief; I would have offered a weekly scan at the end of the report).

**What I did**

| Stage | Action |
| --- | --- |
| 0 | `pinmeto_get_locations(limit:1)` to confirm MCP; `Artifact action:"list"` returned 2 unrelated artifacts → confirmed first scan |
| 1 | Fleet = 7 open locations. Sample 5 by the address-sort even-spacing rule → `MUMBAI, 1337, GDANSK, 7, 171206`. Full records for those 5. |
| 2 | `curl` for robots.txt, both sitemaps, homepage, locator, 5 landing pages, 3 other page types. PSI attempted on 3 URLs. |
| 3 | AIO + Agent Readiness over the same fetches plus `/llms.txt`, `/llms-full.txt`, 4 `.well-known` paths, Link headers, `Accept: text/markdown` probes, `navigator.modelContext` in-browser |
| 4 | Browser GEO: **all 5 locations × all 3 platforms** (15 lookups, 2 Apple search fallbacks × 2 query variants each). Did not need the 3-of-5 budget escape hatch. |
| 5 | Scored in a Python scratch script (deterministic, re-runnable) |
| 6 | Generated the artifact from a Python template script; published with favicon 📍, title `PinMeTo Web Presence — pinmeto.com` |

**Scores**

```
SEO   22.5 → 23   Critical     GEO   77.6 → 78   Healthy
AIO   87.5 → 88   Healthy      Agent 65.0 → 65   Needs work
OVERALL 61.6 → 62   Grade C · Needs work
GEO sub-groups: A 66.7 · B 83.5 · C 100
Counts: 30 pass · 2 warn · 27 fail (59 distinct check ids)
```

**Headline findings** (all real, all evidenced)

1. Every URL under `/locations/` returns a byte-identical 294,657-byte SPA shell (md5 `c74da3b7…`),
   including the locator itself. No canonical, no H1, no per-location title/description, no
   LocalBusiness JSON-LD in the served HTML. The hydrated JSON-LD uses
   `"@type": "Internet marketing service"` — a GBP category string, not a schema.org type.
2. The store locator is orphaned: 127 anchors in the rendered homepage DOM, **zero** to `/locations/`.
3. Apple Maps: Gdańsk and Mumbai have no listing (2 query variants each); Oslo's listing shows
   Ruseløkkveien 34 / +47 930 03 930 / pin 3.7 km off; Helsinki's shows Firdonkatu 2 / +358 40 590 1866
   / pin 11.5 km off. Both Apple pages display "Claim This Place" despite PinMeTo holding an `auid`.
4. `/.well-known/mcp-server-card` and `/.well-known/api-catalog` both 301 to a trailing-slash URL that
   serves the HTML 404 — while the homepage `Link:` header advertises both.
5. Bing Helsinki address is "Aviabulevardi Vantaa" — no street number, no postcode.

---

## (b) Friction points

### F1 — `pinmeto-data-check.md` line 27 recommends a `fields` value the MCP tool rejects

> `fields: ["storeId","name","locationDescriptor","address","location","contact","network","permanentlyClosed"]`

`network` is **not** in the `pinmeto_get_locations` `fields` enum. The enum offers
`google` and `fb` but no `network`. Passing the documented array would have errored. I dropped
`network` and paid for 5 separate `pinmeto_get_location` calls instead.

**Worse:** the `network` object — which the skill needs for `geo.listing_connected_pinmeto` and for the
deep links that drive all of Stage 4 — is **only** available from `pinmeto_get_location`, whose response
has no `fields` parameter at all. So the single most token-expensive thing in Stage 1 (5 × ~1,300-token
full records) is unavoidable, and the file's "token-lean by design" framing oversells what is achievable.

### F2 — the "size the fleet first" instruction is a token trap

> "Size the fleet first: `pinmeto_get_locations` with `limit: 1` … and read `totalCount`"

`limit: 1` **without** `fields` returns one complete location record — ~2,500 tokens including
`networkAttributes`, `longDescription`, `customData`, and the full `network` object for eight platforms —
purely to read a single integer. For a fleet-sizing call this is the worst possible shape. The instruction
should be `limit: 1, fields: ["storeId"]`.

### F3 — the geographic-diversity sampling rule is unsatisfiable for this brand

> "for multi-country brands (unscoped runs), first guarantee ≥1 location per country … then fill the
> remainder by the even-spacing rule"

PinMeTo has **6 countries** (SE×2, FI, NO, PT, PL, IN) and a **5-location sample**. The guarantee is
arithmetically impossible. The file gives no tie-break. I fell back to pure even-spacing, which happened to
yield 5 distinct countries (Portugal excluded) — but that was luck, not instruction. The rule needs a
clause: *when countries > sample size, take one per country by the sort rule until the sample is full and
name the excluded markets in the report.*

### F4 — **the biggest one: the skill never says whether to evaluate served HTML or rendered DOM**

`seo-checks.md` says "Fetch the locator, sitemap, robots.txt, and each sampled landing page" and the rubric
says `"source": "html"`. Neither ever addresses the case where the two disagree — which is the single most
consequential fact about this site. The delta:

| Evaluated on | SEO score |
| --- | --- |
| Served HTML (what I did) | **23** |
| Rendered DOM | ~63 |

That is **12 points of overall score** riding on an undocumented judgment call. I chose served HTML and
wrote a "How SEO was judged" paragraph into the methodology section, but a different Claude on a re-run
could plausibly choose the other way, and the trend line would show a phantom +12 with nothing changed on
the site. For a skill whose whole premise is *"deviations from the rubric make runs incomparable"*, this is
the flaw most likely to bite a real customer.

`geo-browser-checks.md` sub-group C *does* say "the visible NAP on the **rendered** page", which is the only
place rendering is mentioned anywhere — and it points the opposite way from my SEO reading. I honoured both
(SEO on served HTML, sub-group C on rendered), and had to explain that split to the reader.

### F5 — `geo.location_platform_parity` has no defined place in the arithmetic

`rubric.md` lists it inside `sub_groups.a_per_platform.accuracy_checks` with
`"platforms": ["google","apple","bing"]`. `geo-browser-checks.md` then says it is
"**one brand-wide result**, not per-location". Sub-group A's formula is *per location, per platform: share
of applicable checks passed*. A brand-wide boolean has no slot in that.

I improvised: counted it as one extra applicable check in every platform's per-location list, with the same
brand-wide result. That drags every platform score down by 1/n uniformly — arguably it double-counts the
Apple gaps that already zero those platforms. Another Claude would reasonably exclude it from the math and
report it as prose, producing a **~6-point higher GEO score**. Same incomparability problem as F4.

### F6 — `aio.markdown_content_negotiation` and `ar.markdown_content_negotiation` are declared identical but define different page sets

- `aio-checks.md`: "Request **the homepage and one sampled page**"
- `agent-readiness-checks.md`: "**Same probe** … (reuse the result): `Accept: text/markdown` honored on
  **homepage + one deep page**"

On pinmeto.com they diverge: homepage/blog/product return `text/markdown`; the sampled *location* pages
return `text/html`. So "reuse the result" is impossible — one check passes and the other fails on the same
probe. I scored each by its own written criterion (AR pass 1.0, AIO fail 0.5) and noted it in the report,
which reads slightly incoherent to a customer looking at both pillars.

### F7 — "no key needed at low volume" for PageSpeed is wrong

`rubric.md` line 179: *"no key needed at low volume"*. All three requests returned
`Quota exceeded for quota metric 'Queries' and limit 'Queries per day'` on the **first** attempt of the day
from this host. Anonymous PSI quota is per-IP and shared across every tool on the machine — it is routinely
already exhausted. The skill's `warn` fallback worked correctly, but **15 of SEO's 100 points became a
coin-flip 0.5** with no measurement, on what is likely the *common* case rather than the exception. The
skill should either tell the user to supply a PSI key or drop these checks to a lower weight.

### F8 — no guidance on non-gradient checks that are partially true

Several checks are written as binary but landed half-satisfied:

- `aio.haspart_about_mentions_enrichment` — "Any systematic use = pass; none = fail." The homepage
  WebPage node has `about`; nothing else has anything. Is one node systematic?
- `seo.og_twitter_per_location` — all four tags present, none location-specific. Threshold says
  "≥80% present" *and* "specific to the location". Present = 100%, specific = 0%.
- `geo.photos_5_plus` on Mumbai — four categories missing from the strip, gallery not opened.

I invented ratios (0.5, 0, 0.5). `scoring.md` only sanctions measured ratios for "gradient/threshold
checks" and does not say which those are. Every invented ratio is a re-run comparability hazard.

### F9 — `geo.special_hours_set` is not actually observable in August

`rubric.md` line 166 claims special hours are "visible on a real Google Maps listing" and should be
"evaluated normally". Google surfaces holiday hours only near the date; in August, nothing. I scored it
from PinMeTo's `specialOpenHours` array instead (upcoming entries = pass, empty or expired = fail). That is
a *better* signal, but it is a silent switch from browser evidence to MCP evidence, undocumented, and it
changes what the check means.

Same problem, milder, for `geo.services_attributes`: clicking Google's "Om" tab did not change the
extracted page text, so I judged attributes from PinMeTo's `networkAttributes.google` push instead.

### F10 — `geo.listing_connected_pinmeto` can contradict the map surface, and the skill doesn't say what to do

Oslo and Helsinki both have `network.apple.link` in PinMeTo → the check **passes**. Both Apple pages
display **"Claim This Place"** and serve years-old data → the connection is plainly not functioning. The
rubric explicitly says to judge from the PinMeTo record only, so I passed the check and put the
contradiction in the evidence prose. A customer reading "connected ✓" next to "unclaimed, 11 km off" will
not find that credible. The check needs a documented downgrade path when the surface contradicts the record.

### F11 — browser mechanics the skill doesn't warn about

- `mcp__Claude_Browser__read_page` returned `(empty page)` and `Viewport: 0x0` on every Google/Bing page;
  `find` then fails with *"no read_page tree cached"*. `resize_window` did not fix it.
- `computer{action:"scroll"}` timed out at 30 s twice with *"The Browser pane is currently hidden"*, and the
  page did not move.
- Net effect: the documented read/click loop is unusable on map surfaces. I did the entire GEO stage through
  `javascript_tool`, which the tool description says is for **"DEBUGGING and INSPECTION only"**. I also used
  it to click Google's "Avvisa alla" consent button (after computing the coordinate scale factor by hand,
  since the screenshot is 0.625× the CSS viewport). `geo-browser-checks.md` should either bless
  `javascript_tool` for extraction or name the fallback.
- Google served **Swedish** UI from this host — Helsinki's address rendered as "Karhumäkivägen 3, 01530
  Vanda". A less careful run would score that a NAP mismatch. The file's normalization section covers
  street abbreviations but says nothing about locale-translated place names.

### F12 — `response_format: "markdown"` on `pinmeto_get_location` is silently ignored

Requested it twice hoping for a compact record; got raw JSON both times. Not a skill bug, but the skill's
token-lean advice would benefit from knowing this lever doesn't work.

### F13 — small spec bugs in `geo-browser-checks.md`

- **Duplicated step 3** under "Per location: Bing Maps" — there are two step-3 blocks, and the *second* one
  is actually the Apple instructions (it ends "…not scored for Apple"). Pasted into the wrong section.
- The Apple search fallback (`https://maps.apple.com/?q=…`) resolves to **cities and neighbourhoods**, not
  businesses — `?q=PinMeTo Gdansk` returned the city of Gdańsk. The file should say that a resolved
  non-business result counts as *not found* rather than as an ambiguous result to refine.
- "Budget: ~2–4 minutes per location per platform" is wall-clock advice with no token guidance, which is the
  actual constraint.

### F14 — `artifact-report.md` asks for a re-run flow that the first run can't fully rehearse

The re-run flow says "fetch the published page, parse the `pmt-scan-history` JSON". `Artifact action:"list"`
returns title/URL/date only — no way to check scope without a `WebFetch` per candidate artifact. For a brand
with a global report plus 20 country reports, disambiguating "update the report" costs 21 fetches of ~200 KB
pages. The scope should be encoded in the **title** (it is) *and* the list flow should stop there.

### F15 — the artifact preview couldn't be verified in-browser

`mcp__Claude_Browser__navigate` to the artifact URL got claude.ai's signed-out 404. Verification had to go
through `WebFetch`, which returns the full 206 KB HTML into context. The skill should tell the runner to
verify via WebFetch and to keep the verification prompt narrow.

---

## (c) Token / time observations

| Stage | Cost | Why |
| --- | --- | --- |
| 1 — PinMeTo baseline | **High, avoidable** | The `limit:1` sizing call alone was ~2.5 k tokens (F2). Five `pinmeto_get_location` calls ≈ 6.5 k tokens, unavoidable because `network` has no `fields` route (F1). ~10 k for what is conceptually 5 rows × 12 fields. |
| 2–3 — SEO/AIO/AR | **Low** | Doing all fetching through `curl` + `python3` in Bash and printing only extracted facts kept this under ~6 k. `WebFetch` would have been far worse: it markdown-converts, which destroys `<link rel=canonical>`, JSON-LD, meta tags and `Link:` headers — the exact things every check needs. **The skill should say outright: use HTTP tooling, not WebFetch, for Stage 2/3.** |
| 4 — GEO browser | **Highest, ~40% of the run** | 15 navigations + 20 `javascript_tool` calls. The `get_page_text` calls on Google Maps were ~1.5 k each (reviews, "people also search for", nearby businesses); switching to targeted `javascript_tool` extractions cut that to ~200 tokens per listing. That trick is what made 5×3 coverage affordable — **it belongs in the reference file.** |
| 5 — Scoring | **Trivial** | One Python script. `scoring.md`'s "show your work in a scratch table" is good advice; doing it as a re-runnable script is better and should be suggested. |
| 6 — Report | **Moderate, one-shot** | I wrote a ~1,100-line Python generator holding the check data as structures and templating the rows/drawers, rather than hand-writing 59 accordion rows and 27 drawers. Hand-authoring the HTML for a spec this detailed would plausibly have cost 3–5× and produced inconsistencies. **`artifact-report.md` should recommend generating the HTML from a data structure.** |

Two `Read` calls of the reference files ran ~13 k tokens total. `rubric.md` (12 kB) is read in full for a
scoring contract that is 95% one JSON block — fine, but worth knowing.

Overall the "Work compact" rule held. The budget survived to Stage 6 with room, but only because I
deviated toward Bash/curl and `javascript_tool` — both of which the skill does not mention.

---

## (d) Correctness worries

Ranked by how much score is at stake.

1. **Served HTML vs rendered DOM (F4) — ±12 overall points.** My SEO 23 is the harshest defensible
   reading. Googlebot renders JS and would see a decent page. I justified it on the grounds that this
   skill's stated purpose is AI visibility and GPTBot/ClaudeBot/PerplexityBot do not render — but the
   rubric never says that, I did.
2. **`geo.location_platform_parity` in sub-group A (F5) — ±6 GEO points.** My inclusion choice is a guess.
3. **`geo.special_hours_set` scored from PinMeTo, not the browser (F9).** Defensible, undocumented, and it
   silently changes the check's meaning from "Google shows special hours" to "PinMeTo holds upcoming
   special hours".
4. **`geo.services_attributes` scored from PinMeTo's push data (F9).** Same class of substitution. Mumbai's
   empty `networkAttributes` is solid evidence; the other four "pass" on the assumption that a successful
   push means the attributes render.
5. **Sub-group C verified on 2 of 5 pages.** I rendered `/locations/1337/` and `/locations/7/` and confirmed
   both agree with the dominant platform on all five fields. The other three are inferred from an identical
   template driven by the same PinMeTo feed. Stated in the report's Limits paragraph, but it is an
   inference, and C = 100 is 20% of the GEO pillar.
6. **`consistency.address` for Helsinki scored 0** (all three platforms differ). Arguably Bing's
   "Aviabulevardi Vantaa" is the *same place* by a building name rather than a different address, which
   would make it "one disagrees" = 0.5. The normalization rules cover street abbreviations, not
   building/park names.
7. **`geo.name_matches_site`** — the check id says "matches **site**", but the served site pages carry no
   per-location name at all, so I compared to the PinMeTo baseline. That's what `geo-browser-checks.md`'s
   normalization section actually describes ("against the PinMeTo baseline **and** the landing page"), but
   the id is misleading.
8. **Bing website URL** — Bing wraps outbound links in `bing.com/alink/link?url=…`. I decoded the `url=`
   parameter to get the real target. The file says "the actual href, not the display text", which would
   have given the alink wrapper. Worth a sentence.
9. **`seo.image_alt_text` passes at 100% on 2 images per page** — a degenerate result, because the sampled
   "pages" are the locator shell. The check is technically satisfied and substantively meaningless here.

---

## (e) Suggested edits

**`references/pinmeto-data-check.md`**

1. Replace the `fields` array on line 27 — remove `network` (not in the enum). Add a line: *"`network`
   is only returned by `pinmeto_get_location`, which takes no `fields` — budget one full record per
   sampled location."*
2. Line 20: change the sizing call to `pinmeto_get_locations({limit: 1, fields: ["storeId"]})` and say
   explicitly *"never call `limit:1` without `fields` — a bare record is ~2,500 tokens."*
3. Add to "Geographic diversity": *"If the scope has more countries than sample slots, take one per
   country in sort order until the sample is full, and name the unrepresented markets in the report."*

**`references/seo-checks.md`**

4. **Add a "Rendering policy" section at the top** (this is the highest-value edit in the whole set):
   > Fetch the raw HTTP response and evaluate the rubric's `source: html` checks against **that**, not
   > against a rendered DOM. When a value is absent from the served HTML but present after hydration,
   > the check **fails**, and the evidence row records the rendered value plus the words "client-rendered
   > only". Non-rendering AI crawlers are a first-class audience for this rubric. The one exception is GEO
   > sub-group C, which is explicitly scored on the rendered page.
5. Add: *"Use plain HTTP tooling (`curl`, a fetch script) — not a markdown-converting fetch tool. Canonical
   tags, JSON-LD, meta tags and `Link:` headers do not survive markdown conversion."*
6. `seo.og_twitter_per_location`: state the ratio rule when tags are present but not location-specific.

**`references/rubric.md`**

7. Line 179: delete "no key needed at low volume". Replace with: *"The anonymous PSI quota is per-IP and
   frequently already exhausted; expect `warn`. Ask the user for a PSI API key if speed matters to them."*
8. Line 166: remove `geo.special_hours_set` from the "runnable in the browser" list, or add: *"Google only
   surfaces holiday hours near the date. Outside that window, score from the PinMeTo `specialOpenHours`
   array — non-empty with at least one future entry = pass — and say so in the evidence."*
9. Add a `gradient_checks` array to the machine-readable block naming exactly which check ids may carry a
   measured ratio. Everything else is 1 / 0.5 / 0.

**`references/geo-browser-checks.md`**

10. Delete the duplicated step 3 under "Per location: Bing Maps" — the second block is Apple's text.
11. Add an **extraction recipe** section: on Google/Bing/Apple, `read_page` returns an empty tree and
    `computer{scroll}` times out. Extract with one `javascript_tool` call per listing reading
    `location.href` (coords), `a[data-item-id="authority"].href`, `button[data-item-id="address"]`,
    `button[data-item-id^="phone"]`, `div.F7nice` (rating), and `document.body.innerText` slices. This is
    ~200 tokens per listing versus ~1,500 for `get_page_text`, and it is what makes a 10-location sample
    affordable.
12. Add to normalization: *"Map surfaces localize place names — Google served `Karhumäkivägen 3, Vanda`
    for `Karhumäentie 3, Vantaa`. Compare the numeric and postal components before calling a mismatch."*
13. Add: *"Bing wraps outbound links as `bing.com/alink/link?url=<encoded>` — decode the `url` parameter."*
14. Add: *"Apple's `?q=` search resolves to cities and neighbourhoods when no business matches. A result
    whose `name` parameter is a place name rather than the brand counts as **not found**."*
15. Resolve `geo.location_platform_parity` explicitly. Suggested: *"Parity is scored once, brand-wide, as
    a 6-point accuracy check inside sub-group A's Google column only — not repeated per platform."*
    (Any rule works; it just has to be written down.)
16. Add a downgrade clause to `geo.listing_connected_pinmeto`: *"If the platform surface contradicts the
    PinMeTo record — an unclaimed banner, or data years out of date — score `fail` and note that the
    connection exists in PinMeTo but is not taking effect."*

**`references/aio-checks.md` / `agent-readiness-checks.md`**

17. Make the two markdown-negotiation checks genuinely identical, or state that they differ deliberately
    and how each is scored. Right now "reuse the result" is impossible to obey.
18. `aio.haspart_about_mentions_enrichment`: define "systematic" — e.g. *"pass when at least two distinct
    page templates use `about`, `hasPart` or `mentions`; 0.5 for one; 0 for none."*

**`references/scoring.md`**

19. Add: *"Record the check results as a data structure and compute the pillar scores with a script, not
    by hand. Keep the script — it is the audit trail for the next run."*

**`references/artifact-report.md`**

20. Add: *"Generate the HTML from a data structure (one entry per `CheckResult`) rather than hand-writing
    the rows and drawers. A 59-check report is ~60 accordion rows and ~30 drawers; hand-authoring drifts."*
21. Add a verification step: *"After publishing, verify with `WebFetch` against the artifact URL — the
    in-app browser is not signed in to claude.ai and will show a 404. Keep the verification prompt
    narrow; the page is 200 KB+."*

**`SKILL.md`**

22. Stage 2 currently says "Fetch the locator, sitemap, robots.txt, and each sampled landing page."
    Add the tooling and rendering policy in one line each — those two sentences would have removed the
    two largest sources of ambiguity in this entire run.
