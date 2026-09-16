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
Site-level checks (`robots.txt`, sitemap, PageSpeed) have no rendered pass — they are what
they are. (PageSpeed may *use* a browser on rung 2 below; that browser is the measurement
instrument, not a second pass over the brand's page.) GEO sub-group C's "visible NAP" is always scored on the rendered page
(see `geo-browser-checks.md`).

## Fetch tooling

Use plain HTTP tooling — `curl` or a small fetch script in the shell when available,
capturing headers and the exact body. Do **not** use a markdown-converting fetch tool for
these checks: canonical tags, JSON-LD blocks, meta/OG tags, and `Link:` headers do not
survive markdown conversion, and those are precisely what the checks read. Extract facts
from the responses; never quote whole HTML documents into the conversation.

For every check, produce a `CheckResult` with concrete evidence rows (`{url, note}`). For
failing checks, also write `fixSteps` (3–4 imperative steps) and `agentPrompt` (a
self-contained brief a developer can paste into a coding agent), plus `skillLinks` and
`docLinks` when verified references exist. Every `agentPrompt` must use the exact
`Goal` / `Issue` / `Fix` / `Skill` / `Docs` format and source rules in
`artifact-report.md`.

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

## seo.mobile_friendly (5) — the viewport tag, not PageSpeed

This check no longer uses PageSpeed. Its old procedure read three Lighthouse audits —
`viewport`, `tap-targets`, `font-size` — and **none of them exists any more**: a live
`pagespeed.web.dev` run on 2026-09-10 returned Lighthouse 13.4.1 with an SEO category of
`is-crawlable, document-title, meta-description, http-status-code, link-text,
crawlable-anchors, robots-txt, image-alt, hreflang, canonical, structured-data` and no
mobile-friendliness audits at all.

So read the signal directly, off pages the scan has already fetched — `scripts/analyze_served.py`
records it as `viewport` per page in `served.json`. Each sampled page needs a
`<meta name="viewport">` whose content sets `width=device-width` (an `initial-scale` is
conventional but not required; `user-scalable=no` or a `maximum-scale` below 2 is a fail —
it breaks pinch-zoom). This is a `dual_pass_checks` id: present in served HTML = 1, present
only in the rendered DOM = 0.5, absent in both = 0. Ratio = mean across sampled pages; pass at
1.0 — a viewport tag is one line of HTML in a shared template, so anything less than all pages
is a real template defect. `warn` only when a page could not be fetched at all.

Evidence: the tag's `content` string per page, or its absence. If a PageSpeed rung ran anyway
for `seo.lcp_sample` and its engine happens to return mobile-friendliness audits again, record
them as supporting evidence — never as the scored value, or two scans on different Lighthouse
versions would score differently on an unchanged page.

## seo.lcp_sample (10) — PageSpeed (3 URLs max)

**Which 3 URLs is fixed, not free choice** — walk the pinned sample in its recorded order and
take the landing pages of the **first three locations that declare a URL**, skipping any whose
PinMeTo record has none (that gap is already its own finding from Stage 1, so it must not also
consume a PageSpeed slot). Fewer than three only when the sample itself is smaller, or when
fewer than three sampled locations declare a URL at all — in which case the denominator is that
smaller count and the evidence says so. List the chosen URLs in the check's evidence so the next
scan can reproduce the selection exactly. Picking them freshly each run would let LCP move
without the site changing, which is exactly the drift the pinned sample exists to prevent.

**Score the mobile lab LCP, always.** CrUX field data belongs in evidence, not in the ratio: it
exists for high-traffic URLs and not for most location pages, so preferring it would mix two
different measurements inside one three-URL ratio and move between scans for reasons that have
nothing to do with the site.

### Which engine measures it

Walk this ladder in order and stop at the first rung that is available. Record which rung ran
as `lcpEngine` in the scan history and name it in the evidence rows.

1. **`psi` — the API, when a key is already in the environment.** Read `$PAGESPEED_API_KEY`,
   else `$PSI_API_KEY`. Do not ask the user for a key here: this rung is an optimization, not a
   requirement. It is the only rung that runs **off the browser**, so it goes in the background
   at the start of the scan.
2. **`psi-web` — `pagespeed.web.dev` in the browser, no key.** The default keyless path.
3. **Neither — the standing `warn`.** Only a run with no browser *and* no key lands here (see
   the input rule in `SKILL.md`, which asks for a key only in that case). **Make no call** and
   record the one-line reason *"not measured: this run had no browser and no PageSpeed API key;
   the anonymous PageSpeed quota is per-IP, shared machine-wide and routinely already
   exhausted."* Do not spend a minute proving that. A scan on this rung costs zero minutes here.

Rungs 1 and 2 are **the same measurement engine** — `pagespeed.web.dev` is a UI over the same
backend, running Lighthouse on Google's infrastructure, not on the user's machine. A scan
measured on one rung is comparable with a scan measured on the other. That is also why neither
rung runs Lighthouse locally: a lab number off the scanning machine moves with its CPU and
network, which would let LCP drift without the site changing.

### Rung 1 — the `psi` script

```sh
node scripts/pagespeed.mjs https://brand.com/a https://brand.com/b https://brand.com/c
```

The script's rules are the procedure:

- **One attempt per URL. No retries.** A retry spends another minute against the same quota
  that just refused the first call.
- **60 s hard timeout** per URL; a timeout is a non-return, scored like any other.
- **Stop after the first 429.** The remaining URLs share that quota, so they would fail the
  same way; they are reported as `skipped_after_quota` and **stay in the attempted
  denominator**, which keeps the precedence below unchanged. A 429 here does **not** fall
  through to rung 2: a keyed scan that hit its quota has already told you what it can, and the
  browser costs minutes.
- The script prints one JSON line per URL, in argument order, including the URLs it did not
  call. Score from those lines; never re-run it to "get a better sample".
- **The key is never quoted.** The script prints the endpoint as `key=REDACTED`; keep it that
  way in evidence rows, which end up in a published report.

Run it **first, in the background**, at the start of the scan (see the ordering rule in
`SKILL.md`): it is the slowest single fetch in the scan and nothing depends on it until Stage 5.

### Rung 2 — `psi-web` in the browser

Navigate to `https://pagespeed.web.dev/analysis?url=<encoded page URL>&form_factor=mobile`, one
URL at a time, and wait for the lab report to appear (allow up to 120 s; the run happens on
Google's side). It needs the **single browser**, so it cannot run in the background: sequence it
after the rendered pass and before Stage 4, and budget about two minutes per URL.

**Read the rendered number.** In the built-in browser this rung is three calls per URL:
navigate, wait for the lab report, one `javascript_tool` read. Make sure the **Mobile** tab is
the active one (`form_factor=mobile` selects it, but check — the page runs mobile *and*
desktop, and the desktop number is much smaller: 733 ms against 2927 ms on the same page on
2026-09-10), then read the "Largest Contentful Paint" value from the lab metrics list, a
localized string like "2.9 s" or "2,9 s". Convert it yourself: this is a localized-UI read of
the kind this skill keeps on the primary model and never delegates. Record the string as seen
and the milliseconds you derived. The mobile-tab field panel is where CrUX numbers appear when
the URL has them; record those as evidence only.

**DevTools variant — only when the browser exposes a network log.** A Chrome DevTools MCP can
read the full Lighthouse result instead of the rendered number; it is not a reason to pick that
browser over the built-in one (`SKILL.md`, browser prerequisite). The recipe, as verified on
2026-09-10:

1. The result arrives in a `POST` to `/_/PagespeedUi/data/batchexecute` (rpcid `LsX2he`). Poll
   responses come back first and are small; the one you want is over a megabyte.
2. Strip the `)]}'` guard line, then find the `[["wrb.fr"` array and parse it with a
   bracket-depth scan that respects strings. **Do not trust the chunk-length prefixes** — they
   count bytes while the body is UTF-16 text, so slicing by them truncates the JSON.
3. Take the `wrb.fr` row's third element, `JSON.parse` it, and inside it find the string
   element that contains `lighthouseVersion`. `JSON.parse` that too: it is the ordinary
   Lighthouse result object.
4. **`form_factor=mobile` only selects the tab — the page runs mobile *and* desktop.** Pick the
   payload whose `configSettings.formFactor === "mobile"`; taking the first one you find scores
   a desktop number as if it were mobile. On the run above, mobile read 2927 ms and desktop 733
   ms for the same page.
5. Read `audits['largest-contentful-paint'].numericValue`.

Both reads are the same Lighthouse run; a scan measured one way is comparable with a scan
measured the other.

**Same stop rule.** If the analysis errors, is rate-limited, or hits an interstitial or bot
check on the first URL, do not retry and do not walk the remaining URLs — record them as not
attempted, still in the denominator, with what was on screen. Never a guessed number.

### Scoring (identical whichever rung ran)

Ratio = URLs with lab LCP <2.5 s ÷ **URLs attempted** (the fixed 3-URL sample, or fewer only
when the brand has fewer sampled URLs) — a URL that did not return, whether it errored, timed
out or was skipped behind a quota stop, stays in the denominator and contributes 0, so two
failed calls can never let one fast URL pass as `1/1`. Pass at ≥0.8.

If any attempted URL did not return the check cannot `pass`: score `warn` when every URL that
*did* return was under 2.5 s (evidence gap, not a verdict), `fail` when any returned URL was
over. If none return, `warn`. A URL that returned over 2.5 s is a measurement, not a gap, so the
check stays `fail` however many sibling calls errored; `warn` applies only when nothing that
returned actually failed. A 403 from the site against `Chrome-Lighthouse` /
`Google-InspectionTool` is a non-return with an unblocking fix brief (allow those user agents).
