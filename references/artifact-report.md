# The report artifact — PinMeTo Presence Report design

One self-contained HTML artifact. A stakeholder opens the link, not the chat — it must stand
alone. The layout below reproduces the approved PinMeTo "Presence Report" design; follow it
section by section rather than improvising. If the host provides an artifact-design skill,
load it first, then apply this spec on top.

**Generate, don't hand-write.** A full report is ~60 accordion rows and ~30 drawers;
hand-authoring that much repeated markup drifts. When a shell is available, hold the
`CheckResult`s and scan history as a data structure and emit the HTML from a small template
script (this pairs naturally with the scoring script in `scoring.md`).

**HTML-escape every data-derived string** — check names, why/cost prose, fix steps,
evidence notes, agent prompts. Evidence routinely *quotes literal markup* (a duplicated
`<title>`, a missing `<link rel=canonical>`, a JSON-LD snippet); one unescaped RCDATA tag
like `<title>` in a drawer swallows the entire rest of the document as inert text —
accordions, drawer, and history block all die silently with no console error. If prose
needs inline code styling, escape first and re-allow only `<code>`/`</code>`.

**Pre-publish sanity checks** (cheap, catch the whole failure class):
- exactly **one** `<title>` tag in the file (the page's own);
- exactly the expected `<script>` tags (the `pmt-scan-history` block + one interactivity
  script), with the interactivity script last;
- the history block parses as JSON;
- interactivity uses `addEventListener` on `data-*` hooks — never inline `onclick=`
  attributes (hostile to CSP) — and the script sits at the end of the body;
- when a local browser is available, serve the file and click one accordion, one drawer
  button, and one filter before publishing (`document.scripts.length` being 0 is the
  instant tell that markup swallowed the script);
- escape non-ASCII inside CSS `content:` rules as `\00B7`-style escapes — a served page
  without a charset header renders raw bytes there as mojibake.

After publishing, **verify via a web fetch of the artifact URL** — the in-app browser is
not signed in to claude.ai and will show a 404; keep the verification narrow (title,
score, history block), the page is 200 KB+.

## Identity (what makes re-runs update instead of fork)

- **Title:** `PinMeTo Web Presence — <brand domain>` for a whole-brand report, or
  `PinMeTo Web Presence — <brand domain> — <Scope>` for a scoped one (e.g.
  `… — hm.com — Sweden`, `… — hm.com — DACH`). The title is the identity: exact,
  stable across runs, scope label capitalized consistently.
- **Favicon:** `📍`, never changed.
- **Re-run flow:** list existing artifacts → match the **exact** title for the requested
  scope → fetch the published page, parse the `pmt-scan-history` JSON (below), append the
  new scan, republish **to the same URL** (pass the artifact URL when publishing). Only
  create fresh when no artifact matches that exact title. If the user says "update the
  report" ambiguously and several presence reports exist for the brand, ask which one (or
  update all on a scheduled run that says so).
- **Reading the previous history block, cheaply.** Fetch the artifact URL **once** with the
  host's web-fetch tool. Do not ask the fetch prompt to transcribe the history block — it
  won't, and the response dumps ~10k tokens of page head into context. The fetch tool saves
  the full HTML to a local path; read *that file* and extract the block with a regex —
  `re.search(r'<script type="application/json" id="pmt-scan-history">(.*?)</script>', html, re.S)`
  — for a couple of hundred tokens. Never `curl` an artifact URL (you get the SPA shell or
  a 403) and never use a markdown-converting fetcher (it strips
  `<script type="application/json">` entirely).

## Scoped reports (country / region)

A brand can hold **several living reports at once** — one global, one per country, one per
region — each with its own artifact, sample, history, and schedule:

- The scope is a filter over the PinMeTo fleet: `country` (maps directly onto
  `pinmeto_get_locations` filters) or a named region = an explicit list of countries or
  cities. Sampling (5/10, min 3) applies **within the scope**, so a scoped report of a big
  brand has real coverage where a global one is thin.
- The scope is stored in the history block (`scope` field below) so a scheduled or re-run
  invocation can reconstruct the exact filter without asking.
- Keep scopes **disjoint** when possible; if a location appears in overlapping reports,
  that is fine (each report is self-consistent) but say so when the user sets it up.
- A scoped report never silently widens or narrows: if the user asks for a different scope,
  that is a **new report** with a new title, not a mutation of an existing one.

## Brand look (deliberately single-theme)

The page commits to the PinMeTo light design — set explicit colors on every surface so it
renders identically in light and dark viewers.

- Page bg `#F2F3F4` · card bg `#fff` · hairlines `#E2E6EA` · navy `#000050` (headings, dark
  surfaces) · blue `#3399FF` / link blue `#1E7FE0` · orange accent `#FF8854` (kickers,
  highlights — decoration only) · body text `#333` · muted `#6A6F76` · soft blue wash
  `#EAF4FF`.
- **Status colors:** dots/fills may use orange `#FF8854` (fail), grey `#6A6F76` (warn), green
  `#1FA971` (pass) — but **text** uses the accessible equivalents: fail `#B5481E`, warn
  `#6A6F76`, pass `#137A50`. Orange and mid-blue are never type on white.
- Type: `font-family:'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  (no external font loads — the fallback stack must look right). Black weights (800–900) for
  scores and headlines, tight letter-spacing (−0.02em) on big numbers; 13px uppercase
  kickers with `.14em` tracking in orange.
- Cards: 14–22px radius, 1px `#E2E6EA` border, subtle shadow `0 1px 2px rgba(0,0,80,.06)`.
- Max width 1080px, centered; wide tables scroll inside their own `overflow-x:auto` container.
- Print: hide interactive chrome (`.np` class + `@media print`), `break-inside: avoid` on
  cards.

## Section order

1. **Hero** (navy radial-gradient header, white text): kicker "Multi-location presence
   report" in orange · brand domain as the h1 · meta row (N locations · scan date · rubric
   version) · right side: the overall score huge (84px, 900), a delta pill vs the previous
   scan (↑/↓ and points, green/orange), "out of 100, since <previous scan date>", and a grade
   band tag (Strong / Healthy / Needs work / Critical). First run: no delta pill.
2. **Summary card**: 2 short paragraphs, written for a marketer — what is strong, what holds
   the score back, what kind of effort fixes it (template-level vs manual). Then three count
   tags: `N failing checks` / `N could not be measured` / `N passing`.
3. **Pillar scorecards**: 4 linked cards (SEO, GEO, AIO, Agent readiness) — name + weight %,
   the pillar score big (46px, colored by band), a slim progress bar, and the band word.
   Each links to its pillar section.
4. **Trend** *(from the second scan onward; omit entirely on the first run)*:
   - headline stating the total movement ("Up 25 points in six months"),
   - an inline SVG line chart of overall score across scans (grid lines at 0/50/100, score
     labels above points, dates below, last point emphasized in orange),
   - a per-pillar now/±delta strip,
   - a scan-history table (date, label, SEO, GEO, AIO, Agent, Overall),
   - a "What moved since <last scan>" callout (soft blue wash card): derive the bullets
     **mechanically from a diff of the previous and current `checks` maps** (that is why
     the map stores every check), and classify each one as **rubric change**,
     **measurement correction**, or **real change** per the re-run rule in `rubric.md`.
     Concrete and honest: "Agent readiness gained 12 points — the MCP server card went
     live" (real) vs "SEO gained 10 points because the rubric now gives half credit for
     client-rendered values; nothing changed on the site" (rubric).

   Rendering rules for this section: the hero score, the pillar scorecards and the trend
   table must all render **from the history entries**, never from separately computed
   numbers — a report that disagrees with its own embedded state (hero 22, history 23) is
   worse than no trend at all. When two scans share a date, label the chart points with
   date **and** ordinal ("9 Aug (1st)", "9 Aug (2nd)"). With only two points the chart is
   thin but still correct — keep it.
5. **Fix these first**: the top 3 fixes by points returned (scoring.md §4). Each row: rank ·
   pillar · "Worth ~N points" · plain-English headline (a change, not a check name) · 1–2
   sentence summary · a "How to fix" button opening the drawer.
6. **Sticky section nav**: pill links (Trend · SEO n · GEO n · AIO n · Agent n · Locations)
   plus a filter toggle (All / Needs attention / Passing) that shows/hides check rows.
7. **Per-pillar sections** (SEO, GEO, AIO, Agent readiness): section header with kicker,
   pillar name, 1-line blurb, score + band tag, separated by a 2px navy rule. Then one
   accordion row per check: status dot (fail orange / warn grey / pass green) · human check
   name · the rubric `check.id` in small muted type · right-aligned result label (e.g. "0%",
   "3 / 5", "Pass") · chevron. Expanded: "Why this matters" prose, the cost of leaving it,
   and a button — "How to fix it" (fail) or "See evidence" (pass/warn) — opening the drawer.
8. **Location breakdown**: table of every *sampled* location — name, city, per-pillar
   mini-scores where applicable, overall. Note which fleet locations were not sampled.
9. **NAP consistency matrix**: per sampled location × {Name, Address, Phone, Hours,
   Map pin, URL}. Each cell shows **one chip per platform** where the field applies and a
   listing exists — a small **G / A / B** (Google, Apple, Bing) letter chip, green
   `#D8F3E7` = matches the PinMeTo record, orange `#FFE0D1` = differs, grey `#F2F3F4` =
   no listing on that platform. So an Oslo/Address cell reads `G✓ A! B✓` at a glance
   instead of one flattened "!". Each orange chip carries a `title` tooltip with the
   observed value vs the PinMeTo value ("Apple: Ruseløkkveien 34 · PinMeTo: Dronning
   Eufemias gate 16"). Fields that are scored on fewer platforms show only those chips
   (Hours: G · URL: G/B · the rest: G/A/B). Legend underneath must explain the chips
   **and define Map pin** ("the platform's map-pin position — within 50 m of the PinMeTo
   coordinates counts as matching") **and what the Hours chip compares** ("Google's weekly
   hours table vs the PinMeTo record" — hours are a Google richness check and a
   page-agreement field, not a three-platform NAP comparison, so the single chip is
   correct and should not read as if Apple and Bing were checked and omitted). This is the money table for the PinMeTo pitch — it
   must be exactly right per the GEO evidence.
10. **Listing content table** (directly after the matrix): per sampled location, what the
    Google listing actually shows — {Category (vs the category PinMeTo pushes, from
    `network.google.categories.primaryCategory`), Photos (count, ≥5 target), Latest owner
    post (date or "none"), Newest review (date)}. Photos and review recency feed scored
    checks (`geo.photos_5_plus`, `geo.recent_reviews_180d`); category and owner posts are
    **observed, unscored** — label the columns so the distinction is visible. A stale or
    empty "latest owner post" is a natural talking point for PinMeTo's posting features;
    keep it factual, not salesy.
11. **What to do next** (navy card): "Ship the fixes, then scan again" — 3 numbered steps
    (hand briefs to a developer / any person-tasks like claiming an Apple listing / re-run),
    and a literal re-run prompt the customer can say to Claude:
    `"Re-run the presence scan for <domain> and show me what changed since <date>."`
12. **Methodology**: the four pillar weights with one-line descriptions, rubric version, scan
    date, and sources ("Google, Apple, and Bing Maps as observed in a browser, your website
    and store locator, PageSpeed Insights, PinMeTo location data"). State the sample
    explicitly: which locations, which pages, what was not covered. When any check used the
    rendered pass, include the one-paragraph explanation of the dual-pass policy (served =
    full credit, client-rendered = half, and why: Google renders, AI training crawlers
    don't) so the half-credit rows read as method, not error.
13. **Footer**: "Generated by the PinMeTo web presence skill · Rubric <version>".

## The fix-brief drawer

A fixed right-side drawer (or, if scripting is constrained, an anchored details section —
but prefer the drawer) opened from any check row or top fix. Contents, in order:

- status tag + `check.id` + check name,
- **why** (2–3 sentences, customer-priced: what it costs them today),
- **How to fix it** — numbered steps (3–4, imperative),
- **Copy to your coding agent** — a bordered block with a copy button and the
  `agentPrompt`: a fully self-contained brief naming the artifact to change ("our location
  page template…"), the exact acceptance criteria, and a demand for proof ("show me the
  diff and the check"). Written so pasting it into any coding agent produces the right PR.
  Person-tasks (e.g. claim a listing in Apple Business Connect) say "this one is not a code
  change" and give the operational steps instead.
- **What we found** — the evidence rows `{url, note}`, plus one reference link to the
  relevant spec/doc (schema.org, Google Search docs, RFC…).

## Embedded state — the scan history contract

The artifact carries its own memory. Embed exactly one block:

```html
<script type="application/json" id="pmt-scan-history">
{
  "schema": 1,
  "brand": "pinmeto.com",
  "scope": { "label": "Sweden", "filters": { "country": "Sweden" } },
  "scans": [
    {
      "date": "2026-08-09",
      "rubricVersion": "2.9.0-skill.1",
      "label": "Second scan",
      "overall": 63, "grade": "C",
      "pillars": { "seo": 47, "geo": 79, "aio": 45, "agent_readiness": 90 },
      "counts": { "pass": 40, "warn": 2, "fail": 14 },
      "sample": ["<locationId>", "…"],
      "checks": { "seo.h1_unique_has_location": { "status": "fail", "ratio": 0 } },
      "notes": ["ar.markdown_content_negotiation was recorded 1.0 here but 0.5 under the AIO id; corrected in the next scan"]
    }
  ]
}
</script>
```

- `scope` is `null` for a whole-brand report; otherwise `label` (what appears in the title)
  plus `filters` (machine-usable: `country`, or a list of countries/cities for a region) so
  re-runs and scheduled runs reconstruct the fleet filter without asking.
- `scans` is append-only, oldest first. Keep every prior scan verbatim — never recompute old
  numbers, even if the rubric version moved.
- `checks` records status+ratio for **every** check (compact but complete): it is what lets
  the next run say "internal linking hasn't moved across four scans" without guessing, and
  it is the input to the trend section's mechanical diff.
- `notes` (optional) records **measurement corrections** discovered about *that* scan — so
  a later run can see "this check was mis-scored" without re-deriving it. Append notes to
  the older entry when you find the error; never edit its scores.
- On re-run: fetch the live artifact, extract this block, append, republish. If the block is
  missing or unparseable (hand-edited artifact), say so, start a fresh history with the
  current scan, and keep the old visual sections out of the history math.

## Writing style inside the report

Sober and concrete; a diagnostic, not a marketing page. Headlines name the change ("Every
location page needs its own H1"), not the check. Evidence quotes what was observed. No hype,
no promised rankings, and the warn/fail distinction is always visible.
