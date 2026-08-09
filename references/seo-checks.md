# SEO checks — procedures (15 checks, pillar weight 30%)

Run against: the homepage, the store locator, `robots.txt`, the XML sitemap(s), and every
sampled landing page. Fetch each URL once and reuse the response across checks. Record the
HTTP status, final URL after redirects, and fetch date for evidence.

## Rendering policy (read this first — it decides scores)

The audience for these checks is split, and the policy models that split:

| Fetcher | Renders JS? |
| --- | --- |
| Googlebot, Bingbot (search indexing) | Yes — evergreen Chromium |
| Agentic browsing (ChatGPT browse, Perplexity live, Claude with a browser) | Yes — at query time |
| AI training/index crawlers (GPTBot, ClaudeBot, PerplexityBot, most LLM fetchers) | **No — raw HTML only** |

So every `source: html` / `json-ld` check runs as a **dual pass**:

1. **Served pass** — the raw HTTP response (plain `curl`/fetch). A value present here is
   visible to everyone: **full credit**.
2. **Rendered pass** — only needed when the served pass misses. If a sampled page's served
   HTML lacks the expected signals (no unique title, no H1, no JSON-LD, no canonical — the
   classic SPA-shell fingerprint, e.g. byte-identical bodies across different location
   URLs), load that page in the **real browser** and re-extract the same signals from the
   rendered DOM (one `javascript_tool` read per page: `document.title`, canonical href,
   meta/OG tags, H1s, serialized `ld+json` blocks, anchor list).
3. **Credit rule:** present in served HTML = ratio counts fully · present **only after
   rendering** = that page/value contributes at `rendered_only_credit` = **0.5** ·
   absent in both = 0. Evidence rows carry the provenance: "client-rendered only — visible
   to Google and agent browsers, invisible to non-rendering AI crawlers (half credit)".

This is deterministic (same site → same split → same score), it stops punishing sites that
Google indexes perfectly well, and it keeps the pressure on server-rendering — the fix
brief for any rendered-only finding is still "serve it in the HTML", because half the AI
audience never runs the JS. Never score from the rendered DOM without recording the served
result first; the delta between the passes *is* the finding.

**Uniqueness checks under dual-pass** (`seo.meta_title_unique`,
`seo.meta_description_unique`): these are set properties, not value-presence, so score the
*set* in each pass — unique across the sample in the served HTML = 1 · identical in served
but unique after rendering = 0.5 · duplicated in both passes = 0. (A site whose location
pages all serve the locator's title but hydrate distinct ones lands on 0.5; one that ships
the same description either way lands on 0.)

`seo.internal_linking_depth` under this policy: crawl served-HTML anchors as the primary
graph; where a hub page (homepage, locator) is a JS shell, render it once, add its rendered
anchors to the graph, and count locations reachable only through rendered links at 0.5.
Site-level checks (`robots.txt`, sitemap, PSI) have no rendered pass — they are what they
are. GEO sub-group C's "visible NAP" is always scored on the rendered page
(see `geo-browser-checks.md`).

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
against the PinMeTo baseline record, case-insensitive). Per page 1.0 when all three hold,
else 0 (0.5 if satisfied only in the rendered pass). Ratio = mean across pages; pass at ≥0.8.

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
(homepage = 0). **Deterministic order:** strict BFS; within a depth level visit URLs in
ascending lexicographic order of the absolute URL; dedupe by URL without fragment; cap at
exactly **50 fetched pages** and record that the cap was hit. (Fuzzy ordering here makes two
runs crawl different subsets and report different depths.) Pass if every sampled location URL is reached by depth ≤3;
ratio = reached / sampled. JS-only links (buttons, `onclick`) do not count — that is the
point of the check.

### seo.breadcrumbs_structured (5)
On sampled pages: `BreadcrumbList` JSON-LD **and** a visible breadcrumb trail whose labels
match the JSON-LD items. Both or fail.

## PageSpeed checks (3 URLs max)

### seo.lcp_sample (10) · seo.mobile_friendly (5)
Call the public PageSpeed Insights API (`strategy=mobile`) for up to 3 sampled URLs. LCP:
ratio = URLs with LCP <2.5s ÷ **URLs attempted** (the fixed 3-URL sample, or fewer only when
the brand has fewer sampled URLs) — a URL that failed to return stays in the denominator and
contributes 0, so two failed calls can never let one fast URL pass as `1/1`. Pass at ≥0.8 (use
the lab LCP from Lighthouse; prefer field data when present). If any attempted URL did not
return the check cannot `pass`: score `warn` when every URL that *did* return was under 2.5s
(evidence gap, not a verdict), `fail` when any returned URL was over. If none return, `warn`.
Mobile-friendly: pass when the viewport is configured and there are no
tap-target/font-size audit failures. API error, 403 from the site, or rate limiting →
`warn` for both checks, with the HTTP error as evidence and an unblocking fix brief
(allow `Chrome-Lighthouse` / `Google-InspectionTool` user agents).
