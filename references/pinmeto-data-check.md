# PinMeTo baseline — pull, judge, sample

PinMeTo is the source of truth. Everything on the live web (landing pages, Google Maps,
Apple Maps) is checked *against* this baseline.

## Pull

| Tool | Use for |
| --- | --- |
| `pinmeto_get_locations` | Canonical NAP, categories, opening hours, per-location URLs, coordinates |
| `pinmeto_get_google_ratings`, `pinmeto_get_facebook_ratings` | Reputation signal per location and in aggregate |
| `pinmeto_get_google_keywords` | Queries Google already ties to the locations — context for the report narrative |
| `pinmeto_get_google_insights` / `_facebook_insights` / `_apple_insights` | Visibility/action context (default `total` aggregation is fine) |

Fetch locations first; the set defines what to expect on the live site and the map platforms.

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

Record the canonical record per location:
`{name, street, zip, city, country, phone, primaryCategory, hours, url, lat, lng}` —
**plus the platform connections** from the record's `network` object:

- `network.google.placeId` and `network.google.link` (maps.google.com `?cid=` deep link)
- `network.apple.link` (`maps.apple.com/place?auid=…`)
- `network.bing.link` (unscored, but keep it for evidence)

These deep links are how Stage 4 opens the exact claimed listing instead of searching blind
(see `geo-browser-checks.md`). A location **missing** a `network.google` or `network.apple`
entry is itself a finding: the location is not connected/claimed on that platform through
PinMeTo, which usually foreshadows a parity gap on the map surface.

## Deterministic sampling (must match across runs)

- **Sample size:** 5 locations when the brand has <20; 10 when ≥20.
- **Minimum:** 3 locations with usable records. Below that, stop and tell the user the fleet
  is too small/incomplete to score meaningfully; offer a qualitative check instead.
- **Selection:** sort all locations by `"{street} {zip} {city}"` lowercase, and take evenly
  spaced entries (index `floor(i × N / sample_size)`). This is stable run-over-run as long as
  the fleet doesn't change, which is what makes trend lines honest.
- **Geographic diversity:** for multi-country brands, first guarantee ≥1 location per country
  (picking each country's first location in the same sort), then fill the remainder by the
  even-spacing rule.
- **Never hand-pick** "good" or "bad" locations — that biases the score. If the user asks to
  include a specific location, add it as an *extra, unscored* case study in the report.
- **Re-runs:** reuse the previous scan's sample (from the report's history block) when the
  fleet still contains those locations; replace departed locations by the selection rule and
  note the substitution in the report.
