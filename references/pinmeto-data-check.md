# PinMeTo baseline — what to pull and how to judge it

PinMeTo is the source of truth. Everything on the live web is checked *against* this baseline.

## Pull

| Tool | Use for |
| --- | --- |
| `pinmeto_get_locations` | Canonical NAP, categories, opening hours, per-location URLs, coordinates |
| `pinmeto_get_google_ratings`, `pinmeto_get_facebook_ratings` | Reputation signal per location and in aggregate |
| `pinmeto_get_google_keywords` | Queries Google already ties to the locations — seeds Stage 4 |
| `pinmeto_get_google_insights` / `_facebook_insights` / `_apple_insights` | Visibility/action context (default `total` aggregation is fine) |

Fetch locations first; it defines the set of pages to expect on the live site.

## Completeness checks (gaps here are findings)

For the location set, flag when:

- **Missing website URL** on a location — you can't verify a landing page that isn't declared.
- **Missing or generic category** — weakens local relevance and AI entity typing.
- **Empty/!default opening hours** — hours are a top local-SEO and AI-answer signal.
- **Missing coordinates** — hurts map surfacing.
- **Long tail of zero-rating locations** — either genuinely new or disconnected profiles.

## Consistency baseline

Record, per location, the canonical `{name, street, zip, city, country, phone, primaryCategory,
hours, url}`. Stage 3 compares each live landing page to this record; any divergence
(abbreviations, old phone, wrong hours, different category wording) is a **Major** finding —
inconsistent NAP is the single most common cause of weak local visibility and of AI assistants
citing stale or conflicting details.
