# SEO rubric — store locator and landing pages

Rate each check `pass` / `warn` / `fail` with the observed evidence (a URL, a snippet, a
missing field). Severity maps to scoring in [scoring.md](scoring.md).

## Store locator

Anchor: `store-locator`.

- **Crawlable store list.** Every location reachable by a normal link (`<a href>`), not only
  behind a JS-only map or a search box. A locator that renders stores only after interaction is
  effectively invisible to crawlers and to LLM fetchers → **Major**.
- **Stable, readable per-store URLs.** e.g. `/stores/<city>/<store>` rather than query-string
  IDs. One indexable URL per physical location, matching the PinMeTo location set.
- **Indexability.** Locator and store pages return 200, are not `noindex`, not blocked in
  `robots.txt`, and appear in an XML sitemap.
- **Internal linking.** The locator links to each store page; store pages link back and to
  nearby stores (helps crawl depth and entity association).
- **Store-finder structured data.** `ItemList` of locations where appropriate.
- **hreflang** for multi-country brands so the right market's page surfaces.

## Landing pages

Anchor: `landing-pages`.

For each sampled location page:

- **Title & meta description** include the location's brand + city/area and read as written for
  humans, not keyword-stuffed.
- **One clear `<h1>`** naming the location.
- **`LocalBusiness` (or a subtype like `Store`) JSON-LD** present and valid, with `name`,
  `address`, `telephone`, `openingHoursSpecification`, `geo`, and `sameAs` links to the brand's
  Google/Facebook/Apple profiles.
- **NAP + hours + category consistency vs the PinMeTo baseline** (the highest-value check —
  see [pinmeto-data-check.md](pinmeto-data-check.md)). Any mismatch → **Major**.
- **Unique local content** (not a templated page with only the address swapped): parking,
  transit, services, local specifics.
- **Embedded map + click-to-call**, mobile-friendly, reasonable Core Web Vitals.
- **Canonical** is self-referential (no accidental canonicalization to a generic page).
