# Dogfood run: pinmeto-web-presence v0.13.0, rubric 2.14.0-skill.1

**Date:** 2026-09-04 · **Model:** Opus 5, Claude Code (headless) · **Target:** pinmeto.com (whole brand, first scan)
**Report:** `docs/test-runs/2026-09-04-report-scan1.html` (324 KB, committed next to this record)

This is the first scan run **entirely from the rewritten two-layer references** (#17, #18, #19,
#22 to #26). Its job is to prove the rendering contract in `references/artifact-report.md`, so the
by-eye checklist from #20 is in section (f) and the reference fixes it produced are in section (g).

---

## (a) Run summary

Executed stages 0 to 6. Stage 7 (monitoring) was not run: this environment has no scheduler, and
`references/monitoring.md` says to tell the user runs are on-demand rather than to improvise one.

**What I did**

| Stage | Action |
| --- | --- |
| 0 | `pinmeto_get_locations({limit:1, fields:["storeId"], permanentlyClosed:false})` confirmed the MCP and returned `totalCount: 5`. **No host artifact surface exists here** (no Artifact tool, no Sites workflow), so this is a fresh report identity rendered as a self-contained HTML file rather than published: same title, favicon, history block and update-in-place contract, different delivery path. Recorded so a later run does not read the file as an existing report to append to |
| 1 | Fleet = 5 open locations, down from 7 in the 2026-08-09 run (Oslo and one other left the account). Sample = `min(5, N)` = **all five**, so sampling is total this scan. Selection order by the `{street} {zip} {city}` sort rule: `MUMBAI, 1337, GDANSK, 666, 171206`. Five `pinmeto_get_location` calls for the `network` deep links |
| 2 | One `curl` script, 15 URLs concurrently: homepage, both office finders, five office pages, robots.txt, three sitemaps, `/llms.txt`, `/llms-full.txt`, one blog article, one product page. PSI attempted on three URLs first, in the background. Then the **rendered pass** in the browser on all five office pages plus both hubs |
| 3 | AIO and Agent Readiness over the same fetches plus three `.well-known` paths, one skill-file spot-check, `Link:` header target resolution, `Accept: text/markdown` on three page types, and `/scripts/webmcp.js` |
| 4 | Browser GEO: **all five locations × all three platforms**, 15 lookups. Google by Place ID plus a search pass, reviews re-sorted newest-first, About tab, photo grid, expanded weekly hours. Apple by `auid` where PinMeTo has one, two query variants where it does not. Bing by `ypid`. Did not need the reduced-coverage budget |
| 5 | Scored in a Python scratch script under `/tmp`, not committed. It caught two arithmetic slips in my head-math on the Google column before they reached the report |
| 6 | Rendered from a Python template script holding the results as data. The generator asserts the pre-publish checks and refuses to write a document that fails them |

**Scores**

```
SEO    50.00 -> 50   Critical      GEO    74.40 -> 74   Needs work
AIO    80.00 -> 80   Healthy       Agent  96.67 -> 97   Strong
OVERALL 71.82 -> 72   Grade C · Needs work
GEO sub-groups: A 60.95 · B 83.50 · C 100.00
Counts: 34 pass · 2 warn · 23 fail (59 check ids; the 60th, geo.menu_order_reservations, was excluded)
Themes with worth above 0: 8, worth ~23 points together
```

**Headline findings** (all evidenced in the report)

1. **The office pages exist twice.** All five `/locations/<storeId>` URLs and both office-finder
   pages return a byte-identical 129,523-byte shell (md5 `12de4a41…`) with no canonical, no `h1`,
   no per-location title or description and no LocalBusiness node. After hydration every page is
   complete and correct. Ten of the fifteen SEO checks and one AIO check land on rendered-only half
   credit because of that one template, which is why four of the eight Themes are one template
   change.
2. **Both hub pages serve zero links to any office page.** `/locations` serves 121 anchors and
   `/locator/` 112, none matching `/locations/<storeId>`. A deterministic served-HTML crawl from the
   homepage to depth 3 reaches 0 of 5. After rendering both hubs list all five.
3. **Agent readiness is genuinely strong now.** In August `/.well-known/mcp-server-card` and
   `/.well-known/api-catalog` both 301'd into an HTML 404 while the homepage `Link:` header
   advertised them. Today all three advertised targets resolve with correct content types, the
   skills index resolves and its `SKILL.md` returns `text/markdown`, and robots.txt carries content
   signals for seventeen named AI crawlers. Nine of ten AR checks pass.
4. **Apple is the weak platform, in three different ways.** Mumbai and Gdańsk have no Apple listing
   at all (two query variants each: one returned "No matching places found", the others resolved to
   the *city*). Malmö's stored `auid` resolves to an old **Lund** address with the pin **16.5 km**
   away, named "PinMeTo - Headquarters". Helsinki's resolves to Firdonkatu 2 with the pin **11.6 km**
   away, a phone the record does not hold, and a **"Claim This Place"** banner. Both of those trip
   the `geo.listing_connected_pinmeto` downgrade on address and pin.
5. **Four of five Google and Bing listings send map visitors to the homepage.** Only Malmö links to
   its own office page. This is faithful publishing of a wrong record: four of the five PinMeTo
   records hold `contact.homepage` pointing at `/` or `/pl/`. The `{{network}}` and `{{storeid}}`
   placeholders resolve correctly on the live listings, so the templating works and the target is
   simply wrong.
6. **Stockholm and Helsinki share one meta description**, byte-identical in both passes, because
   both records carry the same short description. The only SEO check that fails at ratio 0 rather
   than half credit.
7. **No office holds a future holiday-hours entry.** The three that have any are all April and May
   2026, now past. Scored from the record per the rubric, since Google surfaces holiday hours only
   near the date.
8. **Google's weekly hours match the record exactly at all five offices**, split Monday in Malmö
   included. Worth naming because the August run inferred this from two pages; this run expanded all
   five tables.

---

## (b) Friction points

### F1: the browser was already taken, and the reference frames that as a per-agent problem

`chrome-devtools` could not start: another live Claude Code session on this machine held the shared
Chrome profile, and every call returned "The browser is already running for
`…/chrome-devtools-mcp/chrome-profile`". `SKILL.md` rule 4 ("One browser, one driver") is written
about the scanning agent's own subagents, so it gave no guidance for this, and the tempting move
(kill the process) would have silently broken somebody else's work. I started my own Chrome on a
separate user-data directory instead and drove it sequentially. **Fixed** in `SKILL.md` rule 4.

### F2: three data-driven Layer 1 strings printed the plural at one

The rendered report said **"Worth ~1 points"**, **"1 checks · Content task · one fix, pays in 1
pillar"** and **"Copy all 1 briefs"**. All three come from templates written in the plural in
`artifact-report.md` (`Worth ~N points`, `<check count> checks`, `Copy all N briefs`), and three of
the eight Themes are worth 1 point, so a marketer meets this on the first read. The Themes h2 has
the same shape and would print "One themes, worth …" for a single remaining Theme. **Fixed**: one
rule in the writing-style Numbers bullet, covering all of them.

### F3: the NAP summary chip has no rule for zero matches

Not one of the five offices agrees with the record on every matrix field, because the URL field
disagrees at four of them. The contract says the card "carries … one green chip with the count that
agrees everywhere" and only tells you what to do when *everything* agrees. Rendering it literally
gives a green, pass-coloured chip reading "0 of 5 locations match everywhere". The report already
solves exactly this shape elsewhere ("never print 0 themes cleared"). **Fixed**: omit the green chip
at zero and let the orange chip stand alone.

### F4: a category-conditional check excluded for the whole sample has nowhere to live

All five offices are categorised "Internet marketing service", so `geo.menu_order_reservations` is
excluded from the GEO denominator at every location and produces no result. But the history contract
says `checks` records "every check", and the Theme brief's footer rule only covers `warn` members.
Every option was wrong: recording it `warn` puts it in the "could not be measured" count and claims
somebody tried, recording it `fail` invents a failure, and omitting it silently loses the fact that
it was deliberately excluded. It also makes the Theme brief header read "4 of 7 checks already pass"
with a seventh member unaccounted for. The August run hit this and only noticed because the previous
history map "happened to omit the id". **Fixed** in both places: omit from `checks`, name the
exclusion in `notes`, and give it its own footer clause worded "not applicable" rather than "could
not be verified".

### F5: the pre-publish copy-button check passes on a copy that did not happen

The pre-publish list says to click one copy button. Chrome **denies `navigator.clipboard.writeText`
on a `file://` origin**, and my handler resolved its feedback on both branches, so the button said
"Copied" over a rejected write and the click-through check passed. `readText` then returned an empty
string. The payload itself was correct; I verified it by reading the element the button copies from,
which is what #20 offers as the alternative. **Fixed**: the check now says to read the payload from
the DOM and count blocks there, and to serve over `http://localhost` if you want the round-trip.

### F6: Apple's generic chrome looks exactly like a claim banner

Every Apple place page carries "Have a Business on Maps? Manage Your Business" in its chrome, on
claimed listings too. My first claim-state regex matched that and flagged all three observed Apple
listings as unclaimed, which would have downgraded `geo.listing_connected_pinmeto` on Stockholm as
well, wrongly. The real signal is the literal "Claim This Place" string inside the listing's own
detail block, which appears on Helsinki only. `geo-browser-checks.md` names the right string but not
the decoy. **Fixed**, in the same shape as the file's existing reviewer-profile trap.

### F7: Bing's `cp=` is absent for the first seconds, and what you find instead is plausible

The reference says to read `cp=<lat>~<lng>` "once the card has centered the map", which is correct.
The trap is what an early read gives you: my first pass searched the page for a latitude and
longitude and got **55.5755/12.9707 for all five locations**, the browser's own geolocated position.
That is a perfectly plausible pin. Identical coordinates across two different locations is the only
tell. **Fixed**: say to wait for it, name the failure mode, and point at the directions link
(`pos.<lat>_<lng>_…`) as a cross-check.

### F8: "if the grid will not open" does not cover "opened, but truncated" (not fixed)

Mumbai's Google photo grid opened and showed **two** tiles under Google's own "Du ser en begränsad
vy av Google Maps" (you are seeing a limited view) notice, with a "show more photos" control that
loaded nothing on two attempts. Read literally, that is a count, and `geo.photos_5_plus` fails. But
scoring a fail against a surface that announces it is incomplete publishes a fix brief for an
unverified problem, which is the exact failure the tri-state lookup design exists to prevent. I
scored **warn** and said so in the evidence and in the methodology. **Not fixed in the references**,
because moving that case from fail to warn moves a score, and this release is presentation-only.
Worth its own ticket.

### F9: the 50-page crawl cap and "within 3 clicks" can disagree (not fixed)

`seo.internal_linking_depth` prescribes strict BFS, lexicographic within a level, "cap at exactly 50
fetched pages and record that the cap was hit". The homepage serves 130 anchors, so the cap is
exhausted inside depth 1 and depth 2 is never reached. The file says what to record but not what the
cap *means* for the verdict: is "not reached because we stopped looking" a fail or an evidence gap?
It did not change the answer here (both hub pages serve zero office links, so the offices are
genuinely unreachable in served HTML, and the reference's rendered-hub clause then puts the check at
0.5), but on a site with a real served link at depth 2 it would decide the check. **Not fixed**:
same reason as F8.

### F10: `seo.lcp_sample`'s URL choice is ambiguous when the declared URL is not a landing page (not fixed)

The rule is to "take the landing pages of the first three locations that declare a URL, skipping any
whose PinMeTo record has none". Four of the five records declare a URL, and that URL is the brand
homepage. So all five "declare a URL", but four of them do not declare *their own page*. I used the
site's per-location pattern for the first three sample entries and listed the chosen URLs in the
evidence, which is reproducible. It cost nothing this run because PSI returned 429 on every call,
but it decides which pages get measured. **Not fixed**: it is a measurement-scope question.

### F11: `seo.h1_unique_has_location` does not say which baseline fields count (not fixed)

The check wants a heading "containing the location's name or city (compare against the PinMeTo
baseline record)". Helsinki's record has `name: "PinMeTo"`, `city: "Vantaa"` and
`locationDescriptor: "Helsinki"`; the page heading is "PinMeTo (Helsinki)". Strictly, neither the
name nor the city appears. I counted it satisfied, reading `locationDescriptor` as part of "the
location's name", and said so. A different run could read it the other way. **Not fixed**: naming the
eligible fields changes scores.

### F12: things the references already answered, worth recording as answered

- **How rendered-only credit composes with a measured gradient ratio.** Richness measured 55/100
  and exists only after rendering. `scoring.md` §1 settles it: the rendered-only 0.5 "is the
  policy's fixed credit, not a measured ratio", so the page contributes a flat 0.5. The August run
  had to guess at this class of thing; this one just read it.
- **Google serving a Swedish UI regardless of the location's country.** Helsinki rendered as
  "Karhumäkivägen 3, 01530 Vanda". The normalization section names this exact case and says to treat
  a translated street or city for the same place as a match. Followed, and noted in the evidence.
- **The reviewer-profile photo trap.** Gdańsk's card innerText contains "Local Guide · 53 recensioner
  · 21 foton". The file's warning is why I opened the grid instead of believing it.
- **`geo.location_platform_parity`'s slot in the arithmetic.** One brand-wide result counted once in
  the Google column per location, exempt from the `unobserved` fallback. Unambiguous, and worth 0.70
  overall points on its own.

---

## (c) Token and time observations

| Stage | Cost | Why |
| --- | --- | --- |
| 1, baseline | Low | `limit:1, fields:["storeId"]` for sizing is ~40 tokens against the ~2,500 the old shape cost. Five full records for `network` remain unavoidable and are the whole cost of the stage |
| 2–3, HTTP | Low | One concurrent `curl` script, then extraction scripts that print only facts. Reading `/blog/2/` as a blog *article* wasted one probe: it is a paginated index, and it 404s under `Accept: text/markdown` while returning 200 as HTML. Real articles live at `/blog/<slug>/` and do serve markdown |
| 2–3, rendered pass | Moderate | Seven page loads in the browser, one targeted extraction each. This is what turns "the site is broken" into "the site is fine for renderers and empty for everyone else", so it is the highest-value browser work in the scan |
| 4, GEO | **Highest, roughly half the run** | 15 lookups plus four extra Google passes (reviews sorted newest, About tab, photo grid, expanded hours). Targeted JS extraction per listing kept each read at a few hundred tokens. The four extra passes are the price of the richness checks and they are worth it: they moved three checks off inherited evidence |
| 5, scoring | Trivial | And it earned its keep twice: my hand arithmetic on the Google column was wrong for two of the five locations (I read 9.5/13 as 9.5 where the script read 8.5/13, and 11/13 where it read 10/13). `scoring.md`'s insistence on a script is not a style preference |
| 6, report | Moderate, one-shot | ~700 lines of generator holding the data. 59 accordion rows, 59 drawers, 8 Theme cards and 8 Theme briefs, produced deterministically; regenerating after the plural fix took under a second |

The pre-publish assertions live **inside** the generator, so a document that fails them is never
written. That inverts the reference's ordering (render, then check) into something stronger, and it
is worth recommending: the generator refused to emit a file three times during development, twice on
the two-script rule and once on the history block ordering.

---

## (d) Correctness worries

Ranked by score at stake.

1. **Mumbai's photo count is a warn I argued for (F8), not one the reference granted.** Read
   literally the check fails. One Google-column check at one location is ~0.05 overall points, so
   the score impact is negligible; the precedent is not.
2. **`seo.image_alt_text` passes at 100% on a degenerate sample.** The served office pages hold two
   images each and both carry alt text. The rendered pages hold four and all four do. Technically a
   clean pass, substantively meaningless, and the August run flagged the same thing. Worth 1.5
   overall points.
3. **`aio.quick_answer_first_200w` at 0.583 rests on my reading of five office pages.** The homepage
   answers plainly. The office pages, after rendering, open with "PinMeTo (Malmö) Open · Closes 5:00
   PM · Adelgatan 9 …" then an About paragraph. I counted that a concrete declarative answer at half
   credit for rendered-only. A stricter reading would score the pages 0 and drop the check below its
   0.5 threshold.
4. **`page.jsonld_name_matches_dominant` compares "PinMeTo (Malmö)" against "PinMeTo".** The page
   carries the city descriptor and no listing does. I read the brand as matching and the descriptor
   as naming the same city; the normalization rule's worked example ("PinMeTo Malmö" vs "Pinmeto AB -
   Malmö") supports it but does not cover a descriptor on one side only. Sub-group C is 20% of GEO
   and scored a clean 100.
5. **`consistency.address` for Helsinki scored 0**, both Apple and Bing deviating. Bing's
   "Aviabulevardi Vantaa" is the district rather than a wrong building: same area, no street number,
   no postcode. I called it a mismatch because the check compares street, number, postcode and city
   as facts and two of the four are absent. Calling it "one deviates" instead would lift sub-group B.
6. **Apple's name for Malmö is "PinMeTo - Headquarters" at a Lund address.** I scored
   `geo.name_matches_site` a match (the brand normalizes) and let the address and pin carry the
   failure. Scoring the name a mismatch too would double-count one stale listing.
7. **`ar.webmcp_tools_registered` passes on source, not on execution.** `navigator.modelContext` is
   `undefined` in Chrome 152 because the API is not shipped, so no registration could be observed
   anywhere. The check explicitly allows judging from source and saying how you judged, and I did,
   but this check will pass on any site that ships a well-formed loader until browsers implement the
   API.
8. **`aio.eeat_article_signals` passes on one article.** The sampled article is from 2017. The check
   asks for author, date and publisher, all present; it says nothing about freshness.

---

## (e) Suggested edits beyond what I fixed

**Own ticket, because each one moves a score and this release is presentation-only:**

1. `geo-browser-checks.md`: extend the photos fallback from "the grid will not open" to "the grid
   will not open, or opens truncated behind the platform's own incomplete-view notice" (F8).
2. `seo-checks.md`: say what the 50-page crawl cap means for `seo.internal_linking_depth`'s verdict
   when a sampled URL is unreached and the cap was hit (F9).
3. `seo-checks.md`: for `seo.lcp_sample`, say whether "declares a URL" means any URL or that
   location's own landing page, and which URL to measure when the record declares the homepage (F10).
4. `seo-checks.md`: name the baseline fields that satisfy `seo.h1_unique_has_location`, and say
   whether `locationDescriptor` counts (F11).

**Smaller, no score at stake:**

5. `artifact-report.md`: the Theme brief renders each section's check name twice, once in the
   accordion one-line header and once as the brief's own heading. Both are in the contract (rule 7's
   header, and the fix-brief drawer's "status tag + `check.id` + check name"), so this is a design
   call rather than a defect, but it reads as a stutter in a five-section brief.
6. `pinmeto-data-check.md`: add "declared website URL points at the brand homepage rather than this
   location's page" to the completeness checks. Four of five records have it, it is the single
   largest GEO finding this scan, and Stage 1 could surface it before any browser work.
7. `aio-checks.md`: for `aio.markdown_content_negotiation`, say that a paginated index route
   (`/blog/2/`) is not the "content page" the probe wants, and to use an article or product URL.

---

## (f) The #20 by-eye checklist

Verified in a browser against `docs/test-runs/2026-09-04-report-scan1.html`, by screenshot and by
reading the live DOM. Evidence files under `/tmp` are not committed; the numbers below are.

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | **Theme card contract**: worth pill | **PASS** | All 8 cards carry a "Worth ~N points" pill, integer, round half up: 7, 4, 4, 3, 2, 1, 1, 1. Sum equals the h2's ~23 |
| 2 | rank badge on the top three only | **PASS** | Badges "1", "2", "3" on the promoted cards; the other five have none. Fill `rgb(255,136,84)`, numeral `rgb(0,0,80)`, never white on orange |
| 3 | headline verbatim from the mapping | **PASS** | All 8 headlines compared string-for-string against the `name` values parsed out of the mapping JSON block: 8 of 8 exact. Effort labels likewise verbatim |
| 4 | meta line | **PASS** | `<n> checks · <effort> · one fix, pays in <N> pillars`, e.g. "5 checks · One developer task · one fix, pays in 2 pillars". No "Open since" cell, correct on a first scan |
| 5 | outline "How to fix" button | **PASS** | Computed style: background `rgb(255,255,255)`, text `rgb(30,127,224)`, border `rgb(226,230,234)` |
| 6 | no orange borders | **PASS** | Every card border on all four sides is `rgb(226,230,234)`. A document-wide sweep of computed border colours found no orange border anywhere. Adjacent pills never share a fill: badge orange, worth pill `#EAF4FF`, tags alternating `#F2F3F4` and white |
| 7 | **Theme brief opens from a card** | **PASS** | Clicking "How to fix" on `crawlable-site` opened `#theme-crawlable-site-brief` with the scrim. Header: "Worth ~7 points", "One developer task", the name, the mapping description, "4 of 9 checks already pass", "Copy all 5 briefs" |
| 8 | **and from a `#theme-<slug>` hash** | **PASS** | Loading the file at `#theme-unique-location-pages` scrolled the card into view and opened its brief, unclicked |
| 9 | brief section order and expansion | **PASS** | Sections ordered by points returned descending (1.5, 1.5, 1.5, 1.2, 0.8). Five sections, so the first is expanded and the rest collapsed to one-line headers, per rule 7 |
| 10 | **"Copy all N briefs" yields N blocks separated by `---`** | **PASS** | All 8 themes: the payload splits on `\n---\n` into exactly N blocks, N equals the button's label, separator lines equal N−1, and every block carries all five fields in order and starts with `Goal:`. Read from the DOM element the button copies from (see F5: the clipboard write is denied on `file://`) |
| 11 | **Printing gives Layer 1 only** | **PASS** | Emulating print media with Layer 2 collapsed: hero, summary, scorecards, Themes, NAP chip and "What to do next" all render; the expander is entirely absent, its summary line included; an **open** Theme brief and the scrim do not render; zero `.np` elements render. With Layer 2 expanded, its contents print (the NAP matrix renders) and the open brief still does not |
| 12 | **Hero, scorecards and Layer 2 table agree** | **PASS** | Hero 72 equals the history entry's `overall`. Scorecards 50 / 74 / 80 / 97 equal `pillars` exactly. Count tags "23 failing / 2 could not be measured / 34 passing" equal `counts`. Chart and scan-history table are correctly **absent** on a first scan; they are checked in the re-run record |
| 13 | Structure | **PASS** | Exactly one `<title>`, exactly two `<script>` elements (the `pmt-scan-history` JSON first, the interactivity script last in the body), zero inline `onclick`/`onload`, `<html lang="en">`, history block parses and its last scan's `overall` matches the hero |

The two-layer design paid off in a way worth recording: **`fast-on-phones` and `agent-front-door`
are absent from the Themes list**, the first because both members are `warn` (PSI quota) and the
second because all six members pass. The work list held 8 cards out of 10 mapped Themes without any
per-scan judgment, and a marketer reading Layer 1 never learns that `geo.menu_order_reservations`
exists.

---

## (g) Reference fixes made on this branch

Prose only. No scoring, rubric, weight or procedure changed; `node scripts/check-references.mjs`
prints `references consistent` and `node --test 'tests/*.test.mjs'` passes 85 of 85 after each.

| Fix | File | What |
| --- | --- | --- |
| F2 | `references/artifact-report.md` | Writing-style Numbers bullet: every data-driven string agrees with its own number, with the singular forms of the worth pill, check count, pillar count, copy-all label and cleared line spelled out |
| F3 | `references/artifact-report.md` | NAP summary chip: omit the green chip when no location agrees on every field, rather than printing "0 of 5" in a pass colour |
| F4 | `references/artifact-report.md` | History `checks` map: a category-conditional check excluded for every sampled location is omitted and named in `notes`, never recorded as `warn`. Theme brief rule 2: it joins the footer line as "not applicable", not "could not be verified", and stays inside the header's `K` |
| F5 | `references/artifact-report.md` | Pre-publish checks: verify a copy button by its payload read from the DOM, because a browser denies clipboard writes on a `file://` origin while a handler can still report success |
| F1 | `SKILL.md` | Rule 4: the one-browser constraint is machine-wide, not per-agent. Another session may hold the profile; start your own on a separate user-data directory rather than terminating theirs |
| F6 | `references/geo-browser-checks.md` | Apple's generic "Have a Business on Maps?" chrome is not a claim banner; the signal is the literal "Claim This Place" string in the listing's detail block |
| F7 | `references/geo-browser-checks.md` | Bing's `cp=` is absent for the first seconds and an early coordinate hunt returns the viewer's own position, identical across locations; wait for it and cross-check the directions link |

`CHANGELOG.md` records all seven under v0.13.0 as presentation fixes the dogfood found.
