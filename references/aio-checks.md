# AIO checks — procedures (13 checks, pillar weight 25%)

AIO measures whether generative engines can **ground on the brand**: liftable structured
data, answer-shaped content, and the emerging AI-consumption conventions. Run against the
homepage, the sampled landing pages, and 1–2 key content pages (an article/FAQ page if the
site has them). Reuse Stage 2 fetches.

### aio.faqpage_schema_2_types (10)
`FAQPage` JSON-LD present on at least **two different page types** (e.g. a location page and
a support/FAQ page). One page type = ratio 0.5.

### aio.quick_answer_first_200w (10)
Heuristic: within the first ~200 words of main content, does the page state the direct answer
to its own topic (who/what/where, e.g. an intro block naming what the business is and does)?
Marketing slogans don't count; a concrete declarative sentence does. Evaluate homepage +
sampled pages; pass at a majority.

### aio.speakable_specification (5)
`speakable` (SpeakableSpecification) present in JSON-LD on homepage or key pages.

### aio.entity_consistent_brand_naming (5)
Compare the brand string across homepage `<title>`/Organization schema and 3 sampled pages
(JSON-LD `name`, og:site_name, visible header). One consistent form (same casing,
same suffix usage) = pass.

### aio.eeat_article_signals (10)
If the site publishes articles/blog: `Article` schema with `author` (a `Person` with a name),
`datePublished`, and `publisher`. No article section at all → evaluate on the nearest
equivalent (news/press); if the site genuinely has no article content, `fail` with a note —
absence of citable expertise content is the signal, not an evidence gap.

### aio.graph_jsonld_pattern (5)
Site emits connected JSON-LD via `@graph` (or equivalently `@id`-linked nodes) rather than
disconnected duplicate blocks.

### aio.inlanguage_matches_html_lang (5)
`<html lang>` present and JSON-LD `inLanguage` (where declared) agrees with it on sampled
pages.

### aio.organization_schema_complete (10)
Homepage `Organization` JSON-LD with **all** of `sameAs` (≥2 profile links), `logo`,
`contactPoint`, `knowsAbout`. Partial = ratio present/4.

### aio.breadcrumblist_matches_visible_nav (5)
Where `BreadcrumbList` exists, its item names match the visible breadcrumb/nav labels
(same strings). No BreadcrumbList anywhere → fail (it is also hit by
`seo.breadcrumbs_structured`; that is intentional — the two pillars price the same defect
differently).

### aio.canonical_homepage_resolvable (5)
The homepage canonical resolves 200 over https without redirect loops, and the apex/`www`
variants converge on it.

### aio.haspart_about_mentions_enrichment (10)
JSON-LD uses entity enrichment: `hasPart`, `about`, or `mentions` linking pages to the
things they cover (services, locations, topics). "Systematic" means **at least two distinct
page templates** use any of the three properties: two+ templates = pass (1.0), exactly one
template = 0.5, none = fail (0).

### aio.llms_txt_present (10)
`GET /llms.txt` returns 200 with plausible markdown content (a title line and links). An
HTML 200 (SPA fallback serving the app shell) is a **fail**, not a pass — check the
content-type and body.

### aio.markdown_content_negotiation (10)
One probe, shared verbatim with `ar.markdown_content_negotiation` (run once, score both
identically): request three pages with `Accept: text/markdown` — the homepage, one content
page (blog/product), and one sampled location page. A page passes if the server returns
markdown (content-type `text/markdown` or an obviously-markdown body); a 200 that ignores
the Accept header and returns HTML fails. Ratio = passing/3 for both checks; pass at 3/3.
