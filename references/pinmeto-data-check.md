# PinMeTo baseline — pull, judge, sample

PinMeTo is the source of truth. Everything on the live web (landing pages, Google Maps,
Apple Maps) is checked *against* this baseline.

## Pull — token-lean by design

| Tool | Use for |
| --- | --- |
| `pinmeto_get_locations` | Fleet size, sampling, canonical NAP/hours/URLs/coordinates — **not** `network` (absent from the `fields` enum) |
| `pinmeto_get_location` | Full record for one sampled location by `storeId` — the only source of the `network` platform deep links |
| `pinmeto_get_google_ratings`, `pinmeto_get_facebook_ratings` | Reputation signal — aggregate only |
| `pinmeto_get_google_keywords` | Queries Google already ties to the locations — context for the report narrative |
| `pinmeto_get_google_insights` / `_facebook_insights` / `_apple_insights` | Visibility/action context (`total` aggregation only) |

The cardinal rule: **never enumerate the full fleet into context.** Only the sampled
locations ever need complete records; everything else is counting and selecting.

1. **Size the fleet first:** `pinmeto_get_locations` with `limit: 1` **and
   `fields: ["storeId"]`** (plus any scope filters — see Scoped reports in
   `artifact-report.md`) and read `totalCount`. Never call `limit: 1` without `fields` —
   one bare location record is ~2,500 tokens of attributes and descriptions, fetched just
   to read an integer. Filter `permanentlyClosed: false`.
2. **Re-run?** Skip discovery: take the `sample` storeIds from the existing report's
   history block and fetch exactly those with `pinmeto_get_location`. Replace only
   locations that are gone or permanently closed (by the selection rule below) and note
   the substitution in the report.
3. **First run, fleet ≤ ~50:** one or two pages with
   `fields: ["storeId","name","locationDescriptor","address","location","contact","permanentlyClosed"]`,
   then select the sample by the deterministic rule below. Note: `network` is **not** in
   the `fields` enum — the platform deep links only come back on the full record from
   `pinmeto_get_location` (which takes no `fields` parameter), so budget one full record
   (~1,300 tokens) per sampled location; that cost is unavoidable and is why full records
   are fetched for the sample only. `response_format: "markdown"` does not shrink it.
4. **First run, larger fleet:** do NOT paginate everything. Select by **even offsets**:
   for sample size s, fetch `offset = floor(i × totalCount / s)`, `limit: 1`, minimal
   `fields`, for i = 0…s−1 (the server's 5-minute cache keeps ordering stable within a
   scan). For multi-country brands the offsets run per `country` filter so every market is
   represented, but **`s` stays the whole report's budget, not a per-country one** — reserve
   one slot per country first, then spend the remaining slots by even spacing, and dedupe
   `storeId` before persisting. The exact rule is under Geographic diversity below; a 10-slot
   sample stays 10 locations however many countries the scope spans. The storeIds you pick get persisted in the report history — from
   then on the sample is pinned (step 2), so cross-run ordering stability of the API never
   matters.
5. **Full records for the sample only** (`pinmeto_get_location` per storeId), and don't
   echo raw location JSON into the conversation — extract the canonical record fields and
   move on.
6. **Aggregates, not per-location pulls,** for ratings/insights/keywords. Per-location
   reputation detail is only ever fetched for the sampled locations, and only when the
   narrative needs it.

## Fleet-size playbook

| Fleet size | Sample | Strategy |
| --- | --- | --- |
| 3–19 | `min(5, N)` | Fetch all (minimal fields), sample by sort rule |
| 20–200 | 10 | Fetch 1–4 pages minimal fields, sample by sort rule |
| 201–1,000 | 10 | Even-offset selection; recommend per-country scoped reports for coverage |
| 1,000+ | 10 per report | **Scope required in practice**: one report per country/region (each with its own 5/10 sample and artifact). A single global report is allowed but must state how thin 10-of-N coverage is |

A 10-of-10,000 sample is statistically honest for template-level findings (most checks are
template checks — one fix repairs every location) but blind to per-location listing drift.
Scoped reports are how large brands get real coverage: 20 country reports × 10 locations
beats one global report × 10, and each updates independently on its own schedule.

## Completeness checks (gaps here are findings)

Flag per location:

- **Missing website URL** — you can't verify a landing page that isn't declared.
- **Missing or generic category** — weakens local relevance, AI entity typing, and the
  category-conditional GEO richness checks.
- **Empty or default-only opening hours** — hours are a top local-SEO and AI-answer signal,
  and sub-group C compares them.
- **Missing coordinates** — breaks the ≤50 m pin checks; the pin comparison then runs
  baseline-less (page vs platform only) and says so.
- **Long tail of zero-rating locations** — either genuinely new or disconnected profiles.

`storeId` is case-sensitive to the MCP but sites often lowercase it in URLs
(`/locations/GDANSK/` → `/locations/gdansk/`): use the record's exact storeId for MCP calls
and the resolved URL for evidence rows.

Record the canonical record per location:
`{name, street, zip, city, country, phone, primaryCategory, hours, url, lat, lng}` —
**plus the platform connections** from the record's `network` object:

- `network.google.placeId` and `network.google.link` (maps.google.com `?cid=` deep link)
- `network.apple.link` (`maps.apple.com/place?auid=…`)
- `network.bing.link` (`bing.com/maps?ss=ypid.…`)

These deep links are how Stage 4 opens the exact claimed listing instead of searching blind
(see `geo-browser-checks.md`), and their presence/absence **is** the
`geo.listing_connected_pinmeto` check: a location missing a `network.<platform>` entry is
not connected/managed on that platform through PinMeTo, which both fails that check and
usually foreshadows a parity gap on the map surface.

## Deterministic sampling (must match across runs)

- **Sample size:** `min(5, N)` locations when the brand has <20 — a 3- or 4-location fleet
  samples every location, since the even-spacing index would otherwise repeat; 10 when ≥20.
- **Minimum:** 3 locations with usable records. Below that, stop and tell the user the fleet
  is too small/incomplete to score meaningfully; offer a qualitative check instead.
- **Selection (first run):** small fleets — sort the fetched locations by
  `"{street} {zip} {city}"` lowercase and take evenly spaced entries
  (index `floor(i × N / sample_size)`); large fleets — the even-offset fetch above *is* the
  selection. Either way the chosen storeIds are recorded in the report history, which pins
  them for every later run.
- **Geographic diversity:** for multi-country brands (unscoped runs), first guarantee ≥1
  location per country (each country's first location, or an offset-0 fetch per country
  filter), then fill the remainder by the even-spacing rule. **When the scope has more
  countries than sample slots**, take one location per country in sort order of country
  name until the sample is full, and name the unrepresented markets in the report's
  methodology section.
- **Never hand-pick** "good" or "bad" locations — that biases the score. If the user asks to
  include a specific location, add it as an *extra, unscored* case study in the report.
- **Re-runs: the sample is pinned.** Read the previous scan's `sample` storeIds from the
  report's history block and reuse them exactly — this is what makes the trend line measure
  *change*, not sampling noise. Replace only locations that left the fleet or closed
  permanently (by the selection rule), and name the substitution in the report.
