# SEO checks — procedures (15 checks, pillar weight 30%)

Run against: the homepage, the store locator, `robots.txt`, the XML sitemap(s), and every
sampled landing page. Fetch each URL once and reuse the response across checks. Record the
HTTP status, final URL after redirects, and fetch date for evidence.

## Rendering policy (read this first — it decides scores)

Evaluate every `source: html` check against the **raw served HTTP response**, never against
a browser-rendered DOM. When a value is absent from the served HTML but appears after
JS hydration, the check **fails**, and the evidence row records the rendered value with the
words "client-rendered only". Rationale: non-rendering AI crawlers (GPTBot, ClaudeBot,
PerplexityBot) are a first-class audience for this rubric, and a fixed policy is what keeps
re-runs comparable — the served-vs-rendered choice can swing SEO by tens of points. The one
deliberate exception is GEO sub-group C's "visible NAP", which is explicitly scored on the
rendered page (see `geo-browser-checks.md`).

## Fetch tooling

Use plain HTTP tooling — `curl` or a small fetch script in the shell when available,
capturing headers and the exact body. Do **not** use a markdown-converting fetch tool for
these checks: canonical tags, JSON-LD blocks, meta/OG tags, and `Link:` headers do not
survive markdown conversion, and those are precisely what the checks read. Extract facts
from the responses; never quote whole HTML documents into the conversation.

For every check, produce a `CheckResult` with concrete evidence rows (`{url, note}`). For
failing checks, also write `fixSteps` (3–4 imperative steps) and `agentPrompt` (a
self-contained brief a developer can paste into a coding agent — name the template/file kind
of change, the acceptance condition, and ask for proof; see `artifact-report.md`).

## Per-page checks (evaluate on each sampled landing page)

### seo.localbusiness_jsonld_present (15)
Parse every `<script type="application/ld+json">` block (including `@graph` members). Pass a
page if any node has `@type` of `LocalBusiness` or a subtype (`Store`, `Restaurant`,
`BankOrCreditUnion`, …). Check passes at ≥80% of sampled pages; ratio = pages-with / sampled.

### seo.localbusiness_jsonld_richness (10) — gradient
Only pages that have LocalBusiness JSON-LD. Precondition: the JSON parses and has no invalid
structure (wrong types, empty required values) — else 0. Then score per the richness rule in
`rubric.md`: 40 points when all of `name`, `address`, `geo`, `url`, `telephone` are present,
plus bonuses (`openingHoursSpecification` 10, logo+cover `image` 10, `areaServed` 5,
`paymentAccepted` 5, `amenityFeature` 5, `hasOfferCatalog|makesOffer` 5,
`review|aggregateRating` 10, `sameAs` 5, `contactPoint` 5). Average across pages; ratio =
average/100. List the missing props per page as evidence.

### seo.canonical_present (5)
`<link rel="canonical">` exists, is an absolute URL, and resolves 200. Flag canonicals that
point at a different page (e.g. the locator root) — that is a fail for the page.

### seo.meta_title_unique (5)
Collect `<title>` across the sample. Any duplicate pair fails the check. Evidence: the
duplicated string and the URLs sharing it.

### seo.meta_description_unique (5)
Same procedure for `<meta name="description">`. Missing descriptions also count against
uniqueness (two missing = duplicate empty).

### seo.h1_unique_has_location (5)
Exactly one `<h1>`, unique across the sample, containing the location's name or city (compare
against the PinMeTo baseline record, case-insensitive). Pass at ≥80% of pages.

### seo.og_twitter_per_location (5)
`og:title`, `og:description`, `og:image`, and `twitter:card` all present, with og values
specific to the location (not identical across the sample). Per page: 1.0 when all four are
present and location-specific, 0.5 when all four are present but generic/identical across
the sample, 0 when any tag is missing. Ratio = mean across pages; pass at ≥0.8.

### seo.image_alt_text (5)
Count `<img>` elements with non-empty `alt` across sampled pages (ignore `role="presentation"`
and tracking pixels). Pass at ≥90%; ratio = with-alt / total.

### seo.hreflang_correct (5)
Multi-market brands only — for single-market sites, mark `pass` with a "not applicable"
evidence note. Each page needs a self-referencing `hreflang` and every alternate must link
back (spot-check one alternate per page).

## Site-level checks

### seo.sitemap_lists_locations (5)
Find the sitemap via `robots.txt` `Sitemap:` lines, else try `/sitemap.xml`. Expand sitemap
indexes. Count how many sampled/known location URLs appear. Pass at ≥80% of the locations
discovered in Stage 1; ratio = listed / expected. An empty or missing sitemap is a fail with
ratio 0, not a warn — absence is a real signal.

### seo.robots_allows_locations (5)
Parse `robots.txt`; evaluate each sampled URL against the rules for `*` and for
`Googlebot`. Also fail any sampled page served with `noindex` (meta or `X-Robots-Tag`).

### seo.internal_linking_depth (10)
Breadth-first crawl of `<a href>` links from the homepage, same host only, up to depth 3
(homepage = 0). Cap the crawl at ~50 pages — prioritize nav links and anything whose URL
looks like a locator/index. Pass if every sampled location URL is reached by depth ≤3;
ratio = reached / sampled. JS-only links (buttons, `onclick`) do not count — that is the
point of the check.

### seo.breadcrumbs_structured (5)
On sampled pages: `BreadcrumbList` JSON-LD **and** a visible breadcrumb trail whose labels
match the JSON-LD items. Both or fail.

## PageSpeed checks (3 URLs max)

### seo.lcp_sample (10) · seo.mobile_friendly (5)
Call the public PageSpeed Insights API (`strategy=mobile`) for up to 3 sampled URLs. LCP:
pass if <2.5s on ≥80% of measured URLs (use the lab LCP from Lighthouse; prefer field data
when present). Mobile-friendly: pass when the viewport is configured and there are no
tap-target/font-size audit failures. API error, 403 from the site, or rate limiting →
`warn` for both checks, with the HTTP error as evidence and an unblocking fix brief
(allow `Chrome-Lighthouse` / `Google-InspectionTool` user agents).
