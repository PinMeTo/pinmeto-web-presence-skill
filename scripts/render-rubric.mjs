#!/usr/bin/env node
// Renders docs/rubric.md, the human-readable rubric page, from the machine-readable
// JSON block in references/rubric.md and the Theme mapping in
// references/artifact-report.md. Stock Node, no dependencies.
//
//   node scripts/render-rubric.mjs          # rewrite docs/rubric.md
//   node scripts/render-rubric.mjs --check  # exit 1 if docs/rubric.md is stale
//
// The page is generated so it cannot drift from the scoring contract: weights,
// thresholds, sources, platforms, sub-group structure and Theme membership all
// come from the JSON. The only hand-written part is PLAIN_LANGUAGE below, one
// sentence per check id saying what the check looks for in words a marketer
// reads. scripts/check-references.mjs fails when a rubric id has no sentence
// here or when docs/rubric.md differs from this script's output, so a rubric
// bump forces both to move with it.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const RUBRIC_PAGE_PATH = "docs/rubric.md";

/** One plain-language sentence per point-bearing rubric id. */
export const PLAIN_LANGUAGE = {
  // SEO
  "seo.localbusiness_jsonld_present": "Each location page carries LocalBusiness structured data (JSON-LD) in the HTML the server sends.",
  "seo.localbusiness_jsonld_richness": "That structured data is complete: name, address, coordinates, URL and phone, plus hours, images, reviews and other optional fields.",
  "seo.canonical_present": "Each location page names itself as the canonical URL, and that URL answers with 200.",
  "seo.meta_title_unique": "No two sampled location pages share the same title.",
  "seo.h1_unique_has_location": "Each page's main heading is unique and names the location.",
  "seo.hreflang_correct": "Multi-market sites link each page to its language versions, including itself, and the links are reciprocal.",
  "seo.sitemap_lists_locations": "The XML sitemap lists the location pages the crawl discovered.",
  "seo.robots_allows_locations": "robots.txt does not block any sampled location page.",
  "seo.og_twitter_per_location": "Each location page has its own Open Graph and Twitter preview tags.",
  "seo.lcp_sample": "The main content of a location page appears within 2.5 seconds on a phone, measured by PageSpeed Insights on three sampled pages.",
  "seo.mobile_friendly": "Each sampled page declares a mobile viewport in its served HTML.",
  "seo.image_alt_text": "Images on the location pages carry alt text.",
  "seo.meta_description_unique": "No two sampled location pages share the same meta description.",
  "seo.internal_linking_depth": "Every location page is reachable within three clicks of the homepage.",
  "seo.breadcrumbs_structured": "Location pages show a breadcrumb trail and describe it with BreadcrumbList structured data.",
  // GEO, sub-group A
  "geo.listing_connected_pinmeto": "The location's listing on this platform is connected and managed through PinMeTo, and the listing on the map does not contradict the PinMeTo record.",
  "geo.name_matches_site": "The listing's name matches the location page, ignoring case, punctuation and legal suffixes.",
  "geo.address_matches_site": "The listing's address matches the location page after postal normalization.",
  "geo.phone_matches_site": "The listing's phone number matches the location page in international format.",
  "geo.website_url_on_listing": "The listing links to the right location page, not just the homepage.",
  "geo.coords_within_50m": "The map pin sits within 50 metres of the location's recorded coordinates.",
  "geo.location_platform_parity": "Brand-wide: every location has a listing on each platform, with no duplicates and no stale permanently-closed pages.",
  "geo.hours_present": "The Google listing shows opening hours.",
  "geo.special_hours_set": "Holiday hours are set, read from Google near a holiday and otherwise from the PinMeTo record.",
  "geo.photos_5_plus": "The Google listing has at least five photos.",
  "geo.services_attributes": "The Google listing lists services or attributes.",
  "geo.menu_order_reservations": "For restaurants, cafes, hotels, salons and clinics: the Google listing offers a menu, ordering or reservations link.",
  "geo.recent_reviews_180d": "The Google listing has a review from the last 180 days.",
  "geo.consumer_alerts_clear": "The Google listing shows no consumer alert.",
  // GEO, sub-group B
  "consistency.name": "The location's name agrees across Google, Apple and Bing, with the PinMeTo record as the reference.",
  "consistency.address": "The location's address agrees across the three platforms, with the PinMeTo record as the reference.",
  "consistency.coords_50m_cluster": "The three platforms' pins sit within 50 metres of each other and of the PinMeTo coordinates.",
  // GEO, sub-group C
  "page.jsonld_name_matches_dominant": "The name in the location page's structured data matches the name the map platforms agree on.",
  "page.jsonld_telephone_matches_dominant": "The phone in the page's structured data matches the platforms' phone.",
  "page.jsonld_geo_within_50m_dominant": "The coordinates in the page's structured data sit within 50 metres of the platforms' pin.",
  "page.opening_hours_matches_dominant": "The page's opening hours match the platforms' hours.",
  "page.visible_nap_matches_dominant": "The name, address and phone a visitor reads on the page match the platforms.",
  // AIO
  "aio.faqpage_schema_2_types": "Pages carry FAQPage structured data with at least two question types AI answers can quote.",
  "aio.quick_answer_first_200w": "Each page answers its main question in the first 200 words.",
  "aio.speakable_specification": "Pages mark up the passages suited to being read aloud (speakable).",
  "aio.entity_consistent_brand_naming": "The brand is named the same way on the homepage and every sampled page.",
  "aio.eeat_article_signals": "Articles carry author, date and publisher signals (experience, expertise, authority, trust).",
  "aio.graph_jsonld_pattern": "The page's structured data is one connected @graph rather than disconnected fragments.",
  "aio.inlanguage_matches_html_lang": "The language declared in structured data matches the page's HTML language.",
  "aio.organization_schema_complete": "The homepage's Organization structured data includes sameAs, logo, contactPoint and knowsAbout.",
  "aio.breadcrumblist_matches_visible_nav": "The BreadcrumbList structured data matches the breadcrumb a visitor sees.",
  "aio.canonical_homepage_resolvable": "The homepage's canonical URL resolves.",
  "aio.haspart_about_mentions_enrichment": "Structured data links pages to what they are about (hasPart, about, mentions).",
  "aio.llms_txt_present": "The site publishes /llms.txt, a plain-text guide for AI assistants.",
  "aio.markdown_content_negotiation": "Pages return Markdown when a client asks for it (Accept: text/markdown).",
  // Agent Readiness
  "ar.content_signals_robots": "robots.txt states what AI agents may do with the content (Content Signals).",
  "ar.mcp_server_card": "The site publishes an MCP server card at /.well-known/mcp-server-card.",
  "ar.webmcp_tools_registered": "Pages register WebMCP tools that an agent in the browser can call.",
  "ar.agent_skills_discovery": "The site publishes an agent skills index at /.well-known/skills/index.json.",
  "ar.api_catalog": "The site publishes an API catalog at /.well-known/api-catalog (RFC 9727).",
  "ar.llms_txt_full": "The site publishes /llms.txt and /llms-full.txt.",
  "ar.markdown_content_negotiation": "Pages return Markdown when a client asks for it (Accept: text/markdown).",
  "ar.rfc8288_link_headers": "HTTP responses carry Link headers pointing agents to the API catalog and service descriptions (RFC 8288).",
  "ar.jsonld_present_valid": "Pages carry valid Schema.org structured data.",
  "ar.xml_sitemap": "The site publishes an XML sitemap.",
};

function jsonBlocks(markdown) {
  return [...markdown.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
}

function parseFirstJson(markdown, file) {
  const block = jsonBlocks(markdown)[0];
  if (block === undefined) throw new Error(`${file}: no JSON block`);
  return JSON.parse(block);
}

function parseThemeMapping(reportMd) {
  for (const block of jsonBlocks(reportMd)) {
    try {
      const parsed = JSON.parse(block);
      if (parsed && typeof parsed.theme_mapping_for_rubric_version === "string") return parsed;
    } catch {
      // not this block
    }
  }
  throw new Error("references/artifact-report.md: no Theme mapping JSON block");
}

/** Every id the rubric awards points to, in document order. */
export function pointBearingIds(rubric) {
  const ids = [];
  for (const pillar of Object.values(rubric.pillars)) {
    for (const check of pillar.checks ?? []) ids.push(check.id);
    for (const group of Object.values(pillar.sub_groups ?? {})) {
      for (const key of ["accuracy_checks", "richness_checks", "fields"]) {
        for (const check of group[key] ?? []) ids.push(check.id);
      }
    }
  }
  return ids;
}

// Backslash first, so an escaped pipe is not itself re-escaped.
const cell = (text) => String(text ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");

function table(header, rows) {
  const line = (cells) => `| ${cells.map(cell).join(" | ")} |`;
  return [line(header), `| ${header.map(() => "---").join(" | ")} |`, ...rows.map(line)].join("\n");
}

const PILLAR_ORDER = ["seo", "geo", "aio", "agent_readiness"];

const PILLAR_BLURB = {
  seo: "The store locator and the per-location landing pages: can search engines crawl, understand and rank them?",
  geo: "The brand's real listings on Google, Apple and Bing Maps, read in a browser: do they exist, are they accurate, and do they agree with each other and with the page?",
  aio: "Whether generative answers (ChatGPT, Claude, Gemini, Perplexity) can ground on the brand's own pages.",
  agent_readiness: "Whether AI agents acting for a customer can discover what the site offers and what they are allowed to do.",
};

const PLATFORM_LABEL = { google: "Google", apple: "Apple", bing: "Bing" };

export function renderRubricPage({ rubricMd, reportMd }) {
  const rubric = parseFirstJson(rubricMd, "references/rubric.md");
  const mapping = parseThemeMapping(reportMd);

  const missing = pointBearingIds(rubric).filter((id) => !(id in PLAIN_LANGUAGE));
  if (missing.length > 0) {
    throw new Error(`scripts/render-rubric.mjs: PLAIN_LANGUAGE has no sentence for ${missing.join(", ")}`);
  }

  const themeOf = new Map();
  for (const theme of mapping.themes) for (const id of theme.checks) themeOf.set(id, theme);
  const themeName = (id) => themeOf.get(id)?.name ?? "";
  const plain = (id) => PLAIN_LANGUAGE[id];

  const out = [];
  const w = rubric.pillar_weights;
  out.push(`# PinMeTo web presence rubric, v${rubric.rubric_version}`);
  out.push("");
  out.push(
    `<!-- Generated by scripts/render-rubric.mjs from references/rubric.md and the Theme mapping in references/artifact-report.md. Do not edit by hand: run \`node scripts/render-rubric.mjs\` after changing either. -->`,
  );
  out.push("");
  out.push(
    `This page explains how the PinMeTo web presence scan scores a multi-location brand. It is the same contract the scan runs (\`references/rubric.md\`), laid out for reading. The rubric is derived from PinMeTo's MLPR product rubric (${rubric.derived_from}); the differences are listed at the end.`,
  );
  out.push("");
  out.push("## How the score is built");
  out.push("");
  out.push(
    "Every check returns a status: **pass**, **warn** or **fail**. Checks are weighted inside their pillar, pillars are weighted into the overall score, and the overall score maps to a grade.",
  );
  out.push("");
  out.push(
    table(
      ["Pillar", "Share of overall score", "What it covers"],
      PILLAR_ORDER.map((key) => [rubric.pillars[key].name, `${w[key]}%`, PILLAR_BLURB[key]]),
    ),
  );
  out.push("");
  const grades = Object.entries(rubric.grade_thresholds);
  out.push(
    table(
      ["Grade", "Overall score"],
      [...grades.map(([grade, min]) => [grade, `${min} and above`]), ["F", `below ${grades[grades.length - 1][1]}`]],
    ),
  );
  out.push("");
  const sev = rubric.severity_scoring;
  out.push(
    table(
      ["Status", "Points earned", "Meaning"],
      [
        ["pass", `${sev.pass * 100}% of the check's weight`, "Evaluated and passed."],
        ["warn", `${sev.warn * 100}%`, "Could not be measured (no browser, blocked fetch, consent wall). An evidence gap, not a failure."],
        ["fail", `${sev.fail * 100}%`, "Evaluated and failed."],
      ],
    ),
  );
  out.push("");
  out.push(
    `Two refinements. A **gradient** check earns its measured ratio instead of all or nothing (for example structured-data richness at 55 out of 100 earns 55% of its weight). A check that reads page markup and finds the value only after JavaScript runs earns **rendered-only credit** of ${rubric.rendered_only_credit * 100}%, because Google renders JavaScript but the crawlers that feed AI training and retrieval do not. Both sets of checks are marked in the tables below.`,
  );
  out.push("");
  const sample = rubric.sample_size;
  out.push(
    `**Sampling.** Brands with fewer than ${sample.small_brand_locations_lt} locations are scanned on ${sample.small_brand_sample} locations (or all of them, when there are fewer); larger brands on ${sample.large_brand_sample}. The sample is pinned and reused on every re-run so scores stay comparable. A report needs at least ${rubric.min_locations_for_report} locations.`,
  );
  out.push("");

  const gradient = new Set(rubric.gradient_checks);
  const dualPass = new Set(rubric.dual_pass_checks);
  const marks = (id) => [gradient.has(id) ? "gradient" : "", dualPass.has(id) ? "rendered-only credit" : ""].filter(Boolean).join(", ");

  for (const key of ["seo", "aio", "agent_readiness"]) {
    const pillar = rubric.pillars[key];
    out.push(`## ${pillar.name} (${w[key]}% of the overall score)`);
    out.push("");
    out.push(PILLAR_BLURB[key]);
    out.push("");
    out.push(
      table(
        ["Check", "Weight in pillar", "What it looks for", "Passes when", "Scoring notes", "Theme"],
        pillar.checks.map((check) => [
          `\`${check.id}\``,
          check.weight,
          plain(check.id),
          check.threshold ?? (check.spec ? `Conforms to ${check.spec}` : ""),
          marks(check.id),
          themeName(check.id),
        ]),
      ),
    );
    out.push("");
    if (key === "seo" && pillar.richness_rule) {
      const rule = pillar.richness_rule;
      out.push(`### How \`seo.localbusiness_jsonld_richness\` is scored`);
      out.push("");
      out.push(`${rule.precondition}. Then:`);
      out.push("");
      out.push(
        table(
          ["Properties", "Points out of 100"],
          [
            [`Required together: ${rule.base_required_props.props.join(", ")}`, rule.base_required_props.weight],
            ...rule.bonus_props.map((bonus) => [`\`${bonus.prop}\``, bonus.weight]),
          ],
        ),
      );
      out.push("");
    }
    if (key === "seo") {
      // GEO follows SEO in the pillar order.
      renderGeo(out, rubric, w.geo, plain, themeName);
    }
  }

  out.push("## Themes");
  out.push("");
  out.push(
    "The report groups failing checks into Themes: one plain-language issue that one fix and one owner resolve. Every point-bearing check belongs to exactly one Theme.",
  );
  out.push("");
  out.push(
    table(
      ["Theme", "Effort", "What it covers", "Checks"],
      mapping.themes.map((theme) => [theme.name, theme.effort, theme.description, theme.checks.length]),
    ),
  );
  out.push("");
  out.push("## How this differs from the PinMeTo product rubric");
  out.push("");
  out.push(
    `The scan is a skill-line fork of ${rubric.derived_from}. SEO, AIO and Agent Readiness are scored identically to the product. GEO differs in two ways, so GEO scores are not directly comparable with product scores:`,
  );
  out.push("");
  out.push(
    "- **Bing is a scored platform again.** The product dropped it because the Bing Maps Enterprise API is being retired; the skill reads the live bing.com/maps surface in a browser instead.",
  );
  out.push(
    "- **`geo.listing_connected_pinmeto` is new.** It measures whether each listing is connected and managed through PinMeTo, judged from the location record and downgraded when the map surface contradicts it.",
  );
  out.push("");
  out.push(
    "A re-run always scores with the current rubric version. Earlier scans keep the scores they were computed with, and the report attributes every moved check to a rubric change, a measurement correction, or a real change on the site or listing. The version history is in `references/rubric.md`.",
  );
  out.push("");
  return out.join("\n");
}

function renderGeo(out, rubric, weight, plain, themeName) {
  const geo = rubric.pillars.geo;
  const groups = geo.sub_groups;
  const a = groups.a_per_platform;
  const b = groups.b_cross_platform_consistency;
  const c = groups.c_platform_to_page_agreement;
  out.push(`## ${geo.name} (${weight}% of the overall score)`);
  out.push("");
  out.push(PILLAR_BLURB.geo);
  out.push("");
  out.push("GEO is scored in three sub-groups:");
  out.push("");
  out.push(
    table(
      ["Sub-group", "Share of GEO", "What it measures"],
      [
        ["A. Per platform", `${a.weight_inside_geo}%`, `Share of applicable checks passed on each platform, weighted ${Object.entries(a.platform_weights).map(([p, pw]) => `${PLATFORM_LABEL[p]} ${pw}`).join(" / ")}.`],
        ["B. Cross-platform consistency", `${b.weight_inside_geo}%`, "Whether the platforms agree with each other, with the PinMeTo record as the reference."],
        ["C. Platform-to-page agreement", `${c.weight_inside_geo}%`, `Whether the location page agrees with the platforms' dominant answer (${c.dominant_platform_rule}).`],
      ],
    ),
  );
  out.push("");
  out.push("### A. Per-platform checks");
  out.push("");
  const platformsOf = (check) => check.platforms.map((p) => PLATFORM_LABEL[p]).join(", ");
  out.push(
    table(
      ["Check", "Platforms", "What it looks for", "Theme"],
      [...a.accuracy_checks, ...a.richness_checks].map((check) => [`\`${check.id}\``, platformsOf(check), plain(check.id), themeName(check.id)]),
    ),
  );
  out.push("");
  out.push(
    "Each platform's score is the share of its applicable checks that passed. A listing that was searched for and not found scores zero on that platform. A listing nobody could look at (no browser, consent wall) scores as **warn** on every check instead, because the scan must not report a missing listing on evidence it does not have.",
  );
  out.push("");
  out.push("### B. Cross-platform consistency");
  out.push("");
  out.push(table(["Field", "Weight in sub-group", "What it looks for"], b.fields.map((f) => [`\`${f.id}\``, f.weight, plain(f.id)])));
  out.push("");
  out.push(b.scoring_rule);
  out.push("");
  out.push("### C. Platform-to-page agreement");
  out.push("");
  out.push(table(["Field", "Weight in sub-group", "What it looks for"], c.fields.map((f) => [`\`${f.id}\``, f.weight, plain(f.id)])));
  out.push("");
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const rubricMd = readFileSync(join(root, "references/rubric.md"), "utf8");
  const reportMd = readFileSync(join(root, "references/artifact-report.md"), "utf8");
  const rendered = renderRubricPage({ rubricMd, reportMd });
  const target = join(root, RUBRIC_PAGE_PATH);
  if (process.argv.includes("--check")) {
    let current = null;
    try {
      current = readFileSync(target, "utf8");
    } catch {
      // missing counts as stale
    }
    if (current !== rendered) {
      console.error(`${RUBRIC_PAGE_PATH} is stale; run: node scripts/render-rubric.mjs`);
      process.exit(1);
    }
    return;
  }
  writeFileSync(target, rendered);
  console.log(RUBRIC_PAGE_PATH);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
