# Rubric — vendored from PinMeTo MLPR rubric v2.8.0

This is the scoring contract. Check IDs, weights, thresholds, and grade bands are **identical**
to the PinMeTo MLPR product rubric (source of truth:
`pinmeto-www-reports/docs/rubric.md`, DRI Marcus), so a skill-produced score is comparable
with a product-produced score. Do not add, drop, or reweight checks in a run; if the rubric
needs changing, that happens upstream with a version bump.

When re-running an existing report, keep using the rubric version recorded in that report's
history for delta narration, and note it if this file has moved on since.

## Machine-readable rubric

```json
{
  "rubric_version": "2.8.0",
  "pillar_weights": { "seo": 30, "geo": 30, "aio": 25, "agent_readiness": 15 },
  "grade_thresholds": { "A": 90, "B": 75, "C": 60, "D": 45 },
  "severity_scoring": { "pass": 1, "warn": 0.5, "fail": 0 },
  "sample_size": {
    "small_brand_locations_lt": 20,
    "small_brand_sample": 5,
    "large_brand_sample": 10
  },
  "min_locations_for_report": 3,
  "pillars": {
    "seo": {
      "name": "SEO",
      "checks": [
        { "id": "seo.localbusiness_jsonld_present", "weight": 15, "threshold": "present on >=80% of sampled pages", "source": "html" },
        { "id": "seo.localbusiness_jsonld_richness", "weight": 10, "threshold": "gradient 0-100, see richness_rule", "source": "html" },
        { "id": "seo.canonical_present", "weight": 5, "threshold": "present, resolves 200", "source": "http+html" },
        { "id": "seo.meta_title_unique", "weight": 5, "threshold": "no duplicates across sample", "source": "html" },
        { "id": "seo.h1_unique_has_location", "weight": 5, "threshold": ">=80% of sample", "source": "html" },
        { "id": "seo.hreflang_correct", "weight": 5, "threshold": "self-ref + reciprocal (multi-market only)", "source": "html" },
        { "id": "seo.sitemap_lists_locations", "weight": 5, "threshold": ">=80% of discovered locations", "source": "sitemap.xml" },
        { "id": "seo.robots_allows_locations", "weight": 5, "threshold": "all sampled URLs accessible", "source": "robots.txt" },
        { "id": "seo.og_twitter_per_location", "weight": 5, "threshold": ">=80% present", "source": "html" },
        { "id": "seo.lcp_sample", "weight": 10, "threshold": "LCP <2.5s on >=80% of 3 sampled URLs", "source": "pagespeed" },
        { "id": "seo.mobile_friendly", "weight": 5, "threshold": "pass on all sampled", "source": "pagespeed" },
        { "id": "seo.image_alt_text", "weight": 5, "threshold": ">=90% present", "source": "html" },
        { "id": "seo.meta_description_unique", "weight": 5, "threshold": "no duplicates", "source": "html" },
        { "id": "seo.internal_linking_depth", "weight": 10, "threshold": "all within 3 clicks of homepage", "source": "crawl" },
        { "id": "seo.breadcrumbs_structured", "weight": 5, "threshold": "BreadcrumbList schema + visible breadcrumb", "source": "html" }
      ],
      "richness_rule": {
        "precondition": "JSON-LD parses with no schema errors (else score = 0)",
        "base_required_props": { "weight": 40, "props": ["name", "address", "geo", "url", "telephone"] },
        "bonus_props": [
          { "prop": "openingHoursSpecification", "weight": 10 },
          { "prop": "image[logo+cover]", "weight": 10 },
          { "prop": "areaServed", "weight": 5 },
          { "prop": "paymentAccepted", "weight": 5 },
          { "prop": "amenityFeature", "weight": 5 },
          { "prop": "hasOfferCatalog|makesOffer", "weight": 5 },
          { "prop": "review|aggregateRating", "weight": 10 },
          { "prop": "sameAs", "weight": 5 },
          { "prop": "contactPoint", "weight": 5 }
        ]
      }
    },
    "geo": {
      "name": "GEO",
      "sub_groups": {
        "a_per_platform": {
          "weight_inside_geo": 55,
          "platform_weights": { "google": 60, "apple": 40 },
          "accuracy_checks": [
            { "id": "geo.name_matches_site", "platforms": ["google", "apple"], "normalization": "case+punctuation+legal_suffix" },
            { "id": "geo.address_matches_site", "platforms": ["google", "apple"], "normalization": "postal" },
            { "id": "geo.phone_matches_site", "platforms": ["google", "apple"], "normalization": "e164" },
            { "id": "geo.website_url_on_listing", "platforms": ["google"] },
            { "id": "geo.coords_within_50m", "platforms": ["google", "apple"] },
            { "id": "geo.location_platform_parity", "platforms": ["google", "apple"], "notes": "brand-wide rollup: site-vs-platform existence gaps, Google duplicate listings, stale permanently-closed pages" }
          ],
          "richness_checks": [
            { "id": "geo.hours_present", "platforms": ["google"] },
            { "id": "geo.special_hours_set", "platforms": ["google"] },
            { "id": "geo.photos_5_plus", "platforms": ["google"] },
            { "id": "geo.services_attributes", "platforms": ["google"] },
            { "id": "geo.menu_order_reservations", "platforms": ["google"], "conditional": "category-applicable" },
            { "id": "geo.recent_reviews_180d", "platforms": ["google"] },
            { "id": "geo.consumer_alerts_clear", "platforms": ["google"], "notes": "present alert = real failure, not evidence gap" }
          ]
        },
        "b_cross_platform_consistency": {
          "weight_inside_geo": 25,
          "fields": [
            { "id": "consistency.name", "weight": 35 },
            { "id": "consistency.address", "weight": 35 },
            { "id": "consistency.coords_50m_cluster", "weight": 30 }
          ],
          "scoring_rule": "100 if both platforms agree after normalization, 0 otherwise"
        },
        "c_platform_to_page_agreement": {
          "weight_inside_geo": 20,
          "dominant_platform_rule": "majority vote across Google + Apple after normalization; Google wins ties",
          "fields": [
            { "id": "page.jsonld_name_matches_dominant", "weight": 20 },
            { "id": "page.jsonld_telephone_matches_dominant", "weight": 20 },
            { "id": "page.jsonld_geo_within_50m_dominant", "weight": 20 },
            { "id": "page.opening_hours_matches_dominant", "weight": 20 },
            { "id": "page.visible_nap_matches_dominant", "weight": 20 }
          ]
        }
      },
      "catastrophic_fail_rule": "If a platform has no listing for a location, that platform contributes 0 to sub-group A for that location AND is excluded from sub-group B's agreement math for that location."
    },
    "aio": {
      "name": "AIO",
      "checks": [
        { "id": "aio.faqpage_schema_2_types", "weight": 10, "source": "json-ld" },
        { "id": "aio.quick_answer_first_200w", "weight": 10, "source": "html_heuristic" },
        { "id": "aio.speakable_specification", "weight": 5, "source": "json-ld" },
        { "id": "aio.entity_consistent_brand_naming", "weight": 5, "source": "homepage+sample" },
        { "id": "aio.eeat_article_signals", "weight": 10, "source": "article_schema" },
        { "id": "aio.graph_jsonld_pattern", "weight": 5, "source": "html" },
        { "id": "aio.inlanguage_matches_html_lang", "weight": 5, "source": "html+jsonld" },
        { "id": "aio.organization_schema_complete", "weight": 10, "source": "homepage", "required_props": ["sameAs", "logo", "contactPoint", "knowsAbout"] },
        { "id": "aio.breadcrumblist_matches_visible_nav", "weight": 5, "source": "html" },
        { "id": "aio.canonical_homepage_resolvable", "weight": 5, "source": "http" },
        { "id": "aio.haspart_about_mentions_enrichment", "weight": 10, "source": "json-ld" },
        { "id": "aio.llms_txt_present", "weight": 10, "source": "/llms.txt" },
        { "id": "aio.markdown_content_negotiation", "weight": 10, "source": "http_accept_markdown" }
      ]
    },
    "agent_readiness": {
      "name": "Agent Readiness",
      "checks": [
        { "id": "ar.content_signals_robots", "weight": 15, "spec": "draft-romm-aipref-contentsignals" },
        { "id": "ar.mcp_server_card", "weight": 15, "spec": "SEP-2127", "path": "/.well-known/mcp-server-card" },
        { "id": "ar.webmcp_tools_registered", "weight": 10, "spec": "webmachinelearning.github.io/webmcp" },
        { "id": "ar.agent_skills_discovery", "weight": 10, "spec": "Cloudflare Agent Skills RFC", "path": "/.well-known/skills/index.json" },
        { "id": "ar.api_catalog", "weight": 10, "spec": "RFC 9727", "path": "/.well-known/api-catalog" },
        { "id": "ar.llms_txt_full", "weight": 10, "spec": "community convention", "paths": ["/llms.txt", "/llms-full.txt"] },
        { "id": "ar.markdown_content_negotiation", "weight": 10, "spec": "HTTP Accept" },
        { "id": "ar.rfc8288_link_headers", "weight": 10, "spec": "RFC 8288", "expects": ["api-catalog", "describedby", "service-desc"] },
        { "id": "ar.jsonld_present_valid", "weight": 5, "spec": "Schema.org" },
        { "id": "ar.xml_sitemap", "weight": 5, "spec": "sitemaps.org" }
      ]
    }
  }
}
```

## Skill adaptations (evidence source only — never scoring)

The product gathers GEO evidence through the Google Places API and Apple MapKit Server API.
This skill gathers the **same facts from the real map surfaces in a browser** (see
`geo-browser-checks.md`). Consequences:

- **Checks the product marks "runner pending" are runnable here.** `geo.special_hours_set`,
  `geo.menu_order_reservations`, and `geo.recent_reviews_180d` are visible on a real Google
  Maps listing. Evaluate them normally.
- **`geo.website_url_on_listing` stays Google-only** even though Apple's web UI sometimes
  shows a URL — keeping the platform split identical to the product keeps scores comparable.
  If you see a wrong URL on Apple, record it as evidence prose, not as a scored check.
- **`seo.lcp_sample` / `seo.mobile_friendly`**: use the public PageSpeed Insights API
  (`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=...&strategy=mobile`, no
  key needed at low volume) on up to 3 sampled URLs. If it errors or is rate-limited → `warn`.
- Anything unmeasurable in the current host (no browser, blocked fetch, consent wall you
  cannot decline) → `warn`, with the reason in evidence. Never guess a value to avoid a warn.

## Severity semantics

| Status | Effective ratio | Meaning |
| --- | --- | --- |
| `pass` | 1.0 (or the check's own measured ratio if the threshold is a gradient) | Evaluated, passed |
| `warn` | 0.5 | Evidence gap — could not be evaluated |
| `fail` | 0 (or the measured ratio for gradient checks) | Evaluated, failed |

Gradient example: `seo.localbusiness_jsonld_richness` at 55/100 contributes ratio 0.55 —
status `fail` (below threshold) but partial credit still flows into the pillar score.
