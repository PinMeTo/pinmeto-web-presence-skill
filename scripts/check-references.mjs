#!/usr/bin/env node
// Reference-consistency check: do the shipped files agree with each other?
//
// Runs with stock Node, no dependencies:  node scripts/check-references.mjs
// Exit 0 when every assertion holds; otherwise one line per violation
// ("<file>: <property that failed>") and exit 1. CI runs it on every push and
// pull request (.github/workflows/check-references.yml).
//
// Two modes. The default (full) mode checks everything below and is the repo
// gate CI runs; it requires the repo-only files (CHANGELOG.md, CONTEXT.md,
// README.md, docs/rubric.md). `--scan` mode runs only the assertions that read files a skill
// payload ships (the references plus SKILL.md), so a scanning agent can run it
// before publishing from inside an unpacked `.skill`, where the repo-only files
// are absent by design. A missing *reference* still fails in both modes.
//
// Assertions made today:
//   1. The `version:` in SKILL.md equals the newest `## vX.Y.Z` heading in
//      CHANGELOG.md.
//   2. The machine-readable JSON block in references/rubric.md parses, carries
//      a `rubric_version`, and its point-bearing ids are unique. Those are the
//      `id` of every object inside an array whose key ends in `checks` under
//      `pillars` (seo/aio/agent_readiness `checks`, GEO `accuracy_checks` and
//      `richness_checks`) plus the GEO sub-group B and C `fields` ids.
//   3. Every term in REQUIRED_GLOSSARY_TERMS has a `**Term**:` entry in
//      CONTEXT.md.
//   4. The Theme mapping JSON block in references/artifact-report.md (the
//      object carrying `theme_mapping_for_rubric_version`) agrees with the
//      rubric: (a) its pinned version equals `rubric_version`; (b) the union
//      of its `checks` arrays equals the rubric's point-bearing ids (pillar
//      check ids plus GEO sub-group B and C `fields` ids); (c) no id sits in
//      two Themes; (d) every `effort` is one of the labels enumerated under
//      the reference's "Effort labels" heading (enumerated once each), and
//      every enumerated label is used. Slugs are unique and kebab-case, no
//      Theme is an "Other" catch-all; every `name` is at most NAME_WORD_LIMIT
//      words and carries no check id or file token. Any failure blocks
//      publishing: the report reference lists these as pre-publish checks.
//   5. The effort labels are enumerated under exactly one heading, and the
//      writing-style section encloses it, so the closed set has one home and
//      cannot drift between two copies. Headings inside fenced code blocks are
//      illustration, not structure, and are ignored here and in (d).
//   6. The two-layer contract in references/artifact-report.md: the "Section
//      order" section lists exactly the eleven Layer 1 sections (LAYER_1_SECTIONS)
//      in order; the "Full audit detail" section enumerates Layer 2's six items
//      (LAYER_2_ITEMS) in order and says the expander is collapsed; the "Pillar
//      scores" section gives no pillar weight as a percentage, because the
//      four weights live in "Methodology", which must name them.
//   7. The trend card's progress story in references/artifact-report.md: the
//      "Section order" section's Trend item frames the headline since the first
//      scan and the subline since the previous one, drops the subline at exactly
//      two scans, carries the Themes-cleared line with its zero rule, names a
//      Theme that fails again as reopened, credits no one for the movement, and
//      states the cross-scan rules (current mapping only, ids absent from an
//      older scan unknown rather than failing); the Themes item defines the
//      "Open since" meta cell; the Trend item and the writing-style section, the
//      two places #12 puts the templates, both carry TREND_TEMPLATES verbatim;
//      and the writing-style section's Summary bullet, not merely the
//      section, carries FIRST_SCAN_BASELINE_SENTENCE.
//   8. Retired vocabulary (RETIRED_VOCABULARY: the wording the Themes work
//      list replaced) is absent from SKILL.md, CONTEXT.md, README.md and every
//      file under references/. Matching ignores case, treats any whitespace run,
//      including a line wrap, as one space, and stops at word boundaries
//      ("desktop fixture" is not "top fix"; "top fixes" is).
//   9. docs/rubric.md, the human-readable rubric page, equals what
//      scripts/render-rubric.mjs renders from the rubric JSON and the Theme
//      mapping, and the renderer carries a plain-language sentence for every
//      point-bearing id. Repo-only, since the page is not in the skill payload.
//
// Every assertion is about an externally observable property of the shipped
// files, never about how the markdown is laid out. Which sections the report
// has, and in which order, is such a property: it is the contract a scanning
// agent renders from, so (6) reads the section names and their order and
// nothing else, not the hand-typed numerals and not the indentation.
//
// To add an assertion: write a pure function `(fileContents...) => string[]`
// that returns one "<file>: <what failed>" line per violation, add it to
// `checkReferences`, cover it in tests/check-references.test.mjs with a
// passing and a failing input, and extend the list above.

import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderRubricPage, RUBRIC_PAGE_PATH } from "./render-rubric.mjs";

const REQUIRED_GLOSSARY_TERMS = [
  "Fix brief",
  "Points returned",
  "Points bar",
  "Theme row",
  "Report",
  "Layer 1",
  "Layer 2",
  "Theme",
  "Theme mapping",
  "Theme brief",
  "Effort label",
  "Cleared",
  "Reopened",
];

// Wording the Themes work list replaced (#16); "top fix" also catches "top fixes".
// Historical records under docs/ are not swept.
export const RETIRED_VOCABULARY = ["Fix these first", "top fix", "top 3 fixes", "three highest-point fixes"];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function checkVersionMatchesChangelog(skillMd, changelogMd) {
  const skillVersion = skillMd.match(/^version:[ \t]*(\S+)/m)?.[1];
  const changelogVersion = changelogMd.match(/^## v(\d+\.\d+\.\d+\S*)/m)?.[1];
  const violations = [];
  if (!skillVersion) violations.push("SKILL.md: no `version:` front-matter field");
  if (!changelogVersion) violations.push("CHANGELOG.md: no `## vX.Y.Z` release heading");
  if (skillVersion && changelogVersion && skillVersion !== changelogVersion) {
    violations.push(
      `SKILL.md: version ${skillVersion} does not match the newest CHANGELOG.md heading v${changelogVersion}`,
    );
  }
  return violations;
}

/** Contents of every ```json fence in a markdown file, in document order. */
function jsonBlocks(markdown) {
  return [...markdown.matchAll(/^```json[ \t]*\r?\n([\s\S]*?)^```/gm)].map((m) => m[1]);
}

/** Contents of the first ```json fence in a markdown file, or null when there is none. */
function firstJsonBlock(markdown) {
  return jsonBlocks(markdown)[0] ?? null;
}

/** Parse the rubric's JSON block, or return the one violation line that explains why not. */
function parseRubric(rubricMd) {
  const file = "references/rubric.md";
  const block = firstJsonBlock(rubricMd);
  if (block === null) return { violation: `${file}: no \`\`\`json block found` };
  let rubric;
  try {
    rubric = JSON.parse(block);
  } catch (error) {
    return { violation: `${file}: JSON block does not parse (${error.message})` };
  }
  if (rubric === null || typeof rubric !== "object" || Array.isArray(rubric)) {
    return { violation: `${file}: JSON block is not an object` };
  }
  return { rubric };
}

/** The `id` of every object in an array whose key satisfies `keyMatches`, anywhere under `node`. */
function collectIds(node, keyMatches) {
  const ids = [];
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (keyMatches(key) && Array.isArray(child)) {
        for (const entry of child) {
          if (entry && typeof entry === "object" && "id" in entry) ids.push(String(entry.id));
        }
      }
      walk(child);
    }
  };
  walk(node);
  return ids;
}


/**
 * Point-bearing ids: everything that can produce points returned, so everything
 * a Theme may need to own. That is the `id` of every object in an array whose
 * key ends in `checks` (pillar checks) plus the `id` of every object in a
 * `fields` array (GEO sub-group B and C, which scoring.md §4 gives an effective
 * weight). Other `id` fields (browser-downgrade reasons and the like) are not
 * point-bearing and may legitimately repeat.
 */
function collectPointBearingIds(pillars) {
  return collectIds(pillars, (key) => key.endsWith("checks") || key === "fields");
}

export function checkRubricJson(rubricMd) {
  const file = "references/rubric.md";
  const parsed = parseRubric(rubricMd);
  if (parsed.violation) return [parsed.violation];
  const { rubric } = parsed;
  const violations = [];
  if (typeof rubric.rubric_version !== "string" || rubric.rubric_version === "") {
    violations.push(`${file}: JSON block has no \`rubric_version\` string`);
  }
  // Point-bearing ids (pillar checks plus sub-group B and C fields) share one namespace.
  const occurrences = new Map();
  for (const id of collectPointBearingIds(rubric.pillars ?? {})) {
    occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
  }
  for (const [id, count] of occurrences) {
    if (count > 1) violations.push(`${file}: check id \`${id}\` appears ${count} times`);
  }
  return violations;
}

/** A glossary entry is a line of the form `**Term**:` in CONTEXT.md. */
export function checkGlossaryTerms(contextMd, requiredTerms = REQUIRED_GLOSSARY_TERMS) {
  return requiredTerms
    .filter((term) => !new RegExp(`^\\*\\*${escapeRegExp(term)}\\*\\*:`, "m").test(contextMd))
    .map((term) => `CONTEXT.md: glossary has no entry for \`${term}\``);
}

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Issue #15 asked for twelve, but the approved mapping (#13, landed verbatim) names
// `agent-front-door` in thirteen words. Thirteen is the smallest limit that admits it.
const NAME_WORD_LIMIT = 13;
/** A check-id shaped word: `seo.h1_unique_has_location`. Plain abbreviations (`e.g.`, `U.S.`) and numbers (`2.5`) are not. */
const CHECK_ID_SHAPE = /^[a-z]{2,}\.[a-z][a-z0-9_]{2,}$/i;
/** A file or path token: `llms.txt`, `robots.txt`, `sitemap.xml`, `/llms.txt`, `.well-known`, `/.well-known/mcp`. */
const FILE_TOKEN = /^(?:\/?[\w.-]*\.(?:txt|md|json|xml|html?|js)|\/[\w./-]*[a-z][\w./-]*|\.well-known(?:\/\S*)?)$/i;

/** The first word of `name` that reads as a rubric check id or a file token, or undefined. */
function idOrFileToken(words, pointBearingIds) {
  return words.find((word) => {
    const bare = word.replace(/^[("'“‘]+|[)"'”’.,;:!?]+$/g, "");
    return pointBearingIds.has(bare) || CHECK_ID_SHAPE.test(bare) || FILE_TOKEN.test(bare);
  });
}

/**
 * The markdown with every fenced code block blanked out, offsets and line
 * lengths preserved. A fenced block is illustration, not document structure: a
 * `### Effort labels` line inside a markdown example is not a heading, and its
 * quoted strings are not the closed set.
 */
function withoutFencedBlocks(markdown) {
  let fenceChar = null;
  return markdown
    .split("\n")
    .map((line) => {
      const blanked = " ".repeat(line.length);
      if (fenceChar === null) {
        const opening = line.match(/^[ \t]*(`{3,}|~{3,})/);
        if (opening === null) return line;
        fenceChar = opening[1][0];
        return blanked;
      }
      const closing = line.match(/^[ \t]*(`{3,}|~{3,})[ \t]*\r?$/);
      if (closing !== null && closing[1][0] === fenceChar) fenceChar = null;
      return blanked;
    })
    .join("\n");
}

/**
 * Every markdown heading, in document order: its level, its text, and the body
 * that follows it up to the next heading, fenced blocks excluded. One reading
 * of the document's structure, so the checks below cannot disagree about where
 * a section is.
 */
function headings(rawMarkdown) {
  const markdown = withoutFencedBlocks(rawMarkdown);
  const found = [...markdown.matchAll(/^(#{1,6})[ \t]+([^\n]*)\r?\n?/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].trim(),
    start: match.index,
    bodyStart: match.index + match[0].length,
  }));
  return found.map((heading, i) => ({
    ...heading,
    body: markdown.slice(heading.bodyStart, found[i + 1]?.start ?? markdown.length),
  }));
}

/** The headings that enclose the heading at `position` in `all`, outermost first. */
function ancestorsOf(position, all) {
  const ancestors = [];
  let level = all[position].level;
  for (let i = position - 1; i >= 0; i -= 1) {
    if (all[i].level < level) {
      ancestors.unshift(all[i]);
      level = all[i].level;
    }
  }
  return ancestors;
}

const WRITING_STYLE_HEADING = /writing style/i;
const EFFORT_LABEL_HEADING = /effort label/i;

/**
 * The effort labels have exactly one home, the writing-style section: that is
 * where the scanning agent reads its prose contract, and a second enumeration
 * elsewhere is how the closed set drifts out of step with the mapping
 * unnoticed. Checked structurally, on the headings rather than on the
 * enumeration's wording: exactly one heading names the effort labels, and the
 * writing-style section encloses it.
 */
export function checkEffortLabelsHome(reportMd) {
  const file = "references/artifact-report.md";
  const all = headings(reportMd);
  const positions = all.flatMap((heading, i) => (EFFORT_LABEL_HEADING.test(heading.text) ? [i] : []));
  if (positions.length === 0) {
    return [`${file}: no heading enumerating the closed set of effort labels`];
  }
  const violations = [];
  if (positions.length > 1) {
    const named = positions.map((i) => `"${all[i].text}"`).join(", ");
    violations.push(
      `${file}: the effort labels are enumerated under ${positions.length} headings (${named}); the writing-style section is their one home`,
    );
  }
  // The first enumeration is the one `enumeratedEffortLabels` below reads as the closed set.
  const home = all[positions[0]];
  const ancestors = ancestorsOf(positions[0], all);
  if (!ancestors.some((heading) => WRITING_STYLE_HEADING.test(heading.text))) {
    const under = ancestors.length > 0 ? `"${ancestors[ancestors.length - 1].text}"` : "no section";
    violations.push(`${file}: the "${home.text}" heading sits under ${under}, not the writing-style section`);
  }
  return violations;
}

/**
 * The closed set of effort labels: every double-quoted string in the body of
 * the first heading whose text names the effort labels. Keep that section
 * terse; any quoted string in it is read as a label.
 */
function enumeratedEffortLabels(reportMd) {
  const home = headings(reportMd).find((heading) => EFFORT_LABEL_HEADING.test(heading.text));
  if (home === undefined) return null;
  return [...home.body.matchAll(/"([^"\n]+)"/g)].map((m) => m[1]);
}

/** Pre-publish conditions (a) to (d) plus the slug and name rules; see the header comment. */
export function checkThemeMapping(reportMd, rubricMd) {
  const file = "references/artifact-report.md";
  // The mapping is the json fence that mentions the pin key; other fences in the file are not ours.
  const KEY = "theme_mapping_for_rubric_version";
  const mappingBlock = jsonBlocks(reportMd).find((block) => block.includes(KEY));
  if (mappingBlock === undefined) return [`${file}: no \`\`\`json block with \`${KEY}\` found`];
  let mapping;
  try {
    mapping = JSON.parse(mappingBlock);
  } catch (error) {
    return [`${file}: Theme mapping JSON block does not parse (${error.message})`];
  }
  if (mapping === null || typeof mapping !== "object" || Array.isArray(mapping)) {
    return [`${file}: Theme mapping JSON block is not an object`];
  }

  const parsedRubric = parseRubric(rubricMd);
  if (parsedRubric.violation) return [`${file}: Theme mapping cannot be checked, ${parsedRubric.violation}`];
  const { rubric } = parsedRubric;
  const pointBearing = new Set(collectPointBearingIds(rubric.pillars ?? {}));

  const violations = [];
  if (mapping.theme_mapping_for_rubric_version !== rubric.rubric_version) {
    violations.push(
      `${file}: Theme mapping is pinned to rubric ${mapping.theme_mapping_for_rubric_version} but the rubric is ${rubric.rubric_version}`,
    );
  }
  if (!Array.isArray(mapping.themes)) {
    violations.push(`${file}: Theme mapping has no \`themes\` array`);
    return violations;
  }

  const labels = enumeratedEffortLabels(reportMd);
  if (labels === null) violations.push(`${file}: no "Effort labels" heading enumerating the closed set`);
  const labelSet = new Set(labels ?? []);
  if (labelSet.size !== (labels ?? []).length) {
    violations.push(`${file}: the enumerated effort labels contain a duplicate`);
  }
  const usedEfforts = new Set();
  const slugs = new Map();
  const themesById = new Map();
  mapping.themes.forEach((theme, index) => {
    if (theme === null || typeof theme !== "object" || Array.isArray(theme)) {
      violations.push(`${file}: Theme at index ${index} is not an object`);
      return;
    }
    // A missing, empty or non-string slug is its own violation; String(42) would pass the kebab-case test.
    const hasSlug = typeof theme.slug === "string" && theme.slug !== "";
    // Later violation lines name the Theme by slug, or by position when it has none.
    const slug = hasSlug ? theme.slug : `at index ${index}`;
    if (hasSlug) {
      slugs.set(slug, (slugs.get(slug) ?? 0) + 1);
      if (!KEBAB_CASE.test(slug)) violations.push(`${file}: Theme slug \`${slug}\` is not kebab-case`);
    } else {
      violations.push(`${file}: Theme at index ${index} has no non-empty string \`slug\``);
    }
    if (!Array.isArray(theme.checks)) {
      violations.push(`${file}: Theme \`${slug}\` has no \`checks\` array`);
    }

    const name = String(theme.name ?? "");
    // No "Other" catch-all: it would hide exactly the drift conditions (b) and (c) exist to catch.
    if (/^(other|misc|miscellaneous|catch-all|uncategori[sz]ed)$/i.test(slug) || /^(other|miscellaneous)$/i.test(name.trim())) {
      violations.push(`${file}: Theme \`${slug}\` reads as a catch-all; every id belongs to a real Theme`);
    }
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length > NAME_WORD_LIMIT) {
      violations.push(`${file}: Theme \`${slug}\` name is ${words.length} words, the limit is ${NAME_WORD_LIMIT} words`);
    }
    const token = idOrFileToken(words, pointBearing);
    if (token) violations.push(`${file}: Theme \`${slug}\` name carries the check id or file token \`${token}\``);

    usedEfforts.add(theme.effort);
    if (labels !== null && !labelSet.has(theme.effort)) {
      violations.push(`${file}: Theme \`${slug}\` effort "${theme.effort}" is not one of the enumerated effort labels`);
    }
    for (const id of Array.isArray(theme.checks) ? theme.checks : []) {
      if (!themesById.has(id)) themesById.set(id, []);
      themesById.get(id).push(slug);
    }
  });
  for (const [slug, count] of slugs) {
    if (count > 1) violations.push(`${file}: Theme slug \`${slug}\` appears ${count} times`);
  }
  for (const label of labels ?? []) {
    if (!usedEfforts.has(label)) violations.push(`${file}: enumerated effort label "${label}" is used by no Theme`);
  }
  for (const [id, themes] of themesById) {
    if (themes.length > 1) {
      violations.push(`${file}: check id \`${id}\` is in ${themes.length} Themes (${themes.join(", ")})`);
    }
  }
  for (const id of pointBearing) {
    if (!themesById.has(id)) violations.push(`${file}: rubric id \`${id}\` is not in any Theme`);
  }
  for (const id of themesById.keys()) {
    if (!pointBearing.has(id)) violations.push(`${file}: Theme id \`${id}\` is not a point-bearing id in the rubric`);
  }
  return violations;
}

const SECTION_ORDER_HEADING = /^section order$/i;

/** Layer 1's eleven sections, in the order #13 approved, #17 landed and the variant-D redesign reordered. */
export const LAYER_1_SECTIONS = [
  "Hero",
  "Summary",
  "Pillar scores",
  "Points bar",
  "Trend",
  "Themes",
  "NAP summary line",
  "Full audit detail",
  "What to do next",
  "Methodology",
  "Footer",
];

/** Layer 2's contents, in the order they sit inside the "Full audit detail" expander. */
export const LAYER_2_ITEMS = [
  "Scan-history table",
  "Sticky section nav",
  "Per-pillar sections",
  "Location breakdown",
  "NAP consistency matrix",
  "Listing content table",
];

/**
 * `1. **Title**` at the start of a line, optionally indented (an indented item
 * is nested inside the section above it, which is how Layer 2 sits inside the
 * "Full audit detail" section).
 */
const numberedItemPattern = (nested) => new RegExp(`^${nested ? "[ \\t]+" : ""}\\d+\\.[ \\t]+\\*\\*([^*]+)\\*\\*`, "gm");

/** Numbered items with a bold title, as `{ title, body }`, `body` running to the next match. */
function numberedItems(section, { nested }) {
  const matches = [...section.matchAll(numberedItemPattern(nested))];
  return matches.map((match, index) => ({
    title: match[1].trim(),
    body: section.slice(match.index, matches[index + 1]?.index ?? section.length),
  }));
}

/**
 * A numbered item's own sentences: its text up to its first nested item, so a
 * rule about the item is not satisfied by wording inside one of its children.
 */
function expanderLead(body) {
  return body.split(numberedItemPattern(true))[0];
}

/**
 * An affirmative collapsed state. "not collapsed" and "never collapsed" do not
 * match, and "uncollapsed" fails the word boundary.
 */
const COLLAPSED_STATE = /(?<!\b(?:not|never|isn't|n't)\s)\bcollapsed\b/i;

/** A weight given as a percentage: "weight %", "40% weight", "weight, 40 per cent". */
const WEIGHT_PERCENTAGE = /weight[^.\n]{0,40}(?:%|per ?cent)|(?:%|per ?cent)[^.\n]{0,40}weight/i;

/** One violation line per position where `items` and `expected` disagree, plus a count line. */
function compareOrder(file, items, expected, { label, listedIn }) {
  const violations = [];
  if (items.length !== expected.length) {
    violations.push(
      `${file}: "${listedIn}" lists ${items.length} ${label}s, the contract has ${expected.length}`,
    );
  }
  for (const [index, title] of expected.entries()) {
    const found = items[index];
    if (!found) {
      violations.push(`${file}: ${label} ${index + 1} is missing, the contract has "${title}"`);
    } else if (found.title.toLowerCase() !== title.toLowerCase()) {
      violations.push(`${file}: ${label} ${index + 1} is "${found.title}", the contract has "${title}"`);
    }
  }
  return violations;
}

/**
 * The two-layer contract (#17): "Section order" lists exactly the eleven Layer 1
 * sections in order, the "Full audit detail" section enumerates Layer 2's six
 * items in order, the "Pillar scores" section gives no pillar weight as a
 * percentage (those live in Methodology) and the "Methodology" section names
 * the weights.
 */
/**
 * The "Section order" section's numbered Layer 1 items, or null when the file
 * has no such section. One reading of the section list, so the checks below
 * cannot disagree about which item is which.
 */
function layer1Items(headingList) {
  const home = headingList.find((heading) => SECTION_ORDER_HEADING.test(heading.text));
  return home === undefined ? null : numberedItems(home.body, { nested: false });
}

export function checkSectionOrder(reportMd) {
  const file = "references/artifact-report.md";
  const layer1 = layer1Items(headings(reportMd));
  if (layer1 === null) return [`${file}: no "Section order" heading`];

  const violations = compareOrder(file, layer1, LAYER_1_SECTIONS, {
    label: "Layer 1 section",
    listedIn: "Section order",
  });

  const named = (title) => layer1.find((item) => item.title.toLowerCase() === title.toLowerCase());
  const expander = named("Full audit detail");
  if (expander) {
    violations.push(
      ...compareOrder(file, numberedItems(expander.body, { nested: true }), LAYER_2_ITEMS, {
        label: "Layer 2 item",
        listedIn: "Full audit detail",
      }),
    );
    // Demoted, not just enumerated: a Layer 2 that renders open is the audit-first report again.
    // Read the expander's own sentences, not its items' prose, and only an affirmative
    // "collapsed" counts, so "not collapsed" is a violation rather than a match.
    if (!COLLAPSED_STATE.test(expanderLead(expander.body))) {
      violations.push(
        `${file}: the Full audit detail section does not say the expander is collapsed when the page loads`,
      );
    }
  }

  // Methodology is the only section that gives the pillar weights (#13: they moved off the scorecards).
  for (const item of layer1) {
    if (item.title.toLowerCase() === "methodology") continue;
    if (WEIGHT_PERCENTAGE.test(item.body)) {
      violations.push(
        `${file}: the ${item.title} section gives a pillar weight as a percentage; Methodology is the only place the weights appear`,
      );
    }
  }
  // The values themselves are not asserted: Methodology names the weights, the scan renders
  // them from the rubric, so a number here would be a second source of truth.
  const methodology = named("Methodology");
  if (methodology && !/pillar weights?/i.test(methodology.body)) {
    violations.push(`${file}: the Methodology section does not carry the four pillar weights`);
  }
  return violations;
}

/**
 * A heading's body plus the bodies of every heading nested under it, so a rule
 * about a section is not defeated by the section having subsections (the
 * writing-style section keeps its templates one level down).
 */
function sectionWithSubsections(headingList, index) {
  const parts = [headingList[index].body];
  for (let i = index + 1; i < headingList.length && headingList[i].level > headingList[index].level; i += 1) {
    parts.push(headingList[i].body);
  }
  return parts.join("\n");
}

/**
 * Prose with markdown emphasis and code ticks dropped and every whitespace run
 * collapsed to one space, so a rule matches a template the file wraps across
 * lines or sets in backticks. The rules below read this form, never the layout.
 */
const normalizeProse = (text) => text.replace(/[`*_]/g, " ").replace(/\s+/g, " ").trim();

/**
 * The template bullets of a writing-style section, as `{ lead, prose }`: a
 * `- **Lead.** …` item and its normalized text, running to the next such item.
 * A rule about one template reads its own bullet, so a sentence that moved to a
 * neighbouring template cannot satisfy it.
 */
function templateBullets(sectionText) {
  const matches = [...sectionText.matchAll(/^[ \t]*-[ \t]+\*\*([^*]+)\*\*/gm)];
  return matches.map((match, index) => ({
    lead: match[1].trim(),
    prose: normalizeProse(sectionText.slice(match.index, matches[index + 1]?.index ?? sectionText.length)),
  }));
}

/** #12's Layer 1 trend templates, verbatim. Up and down share one template; no adjectives. */
export const TREND_TEMPLATES = [
  "Up <n> points since your first scan on <date>",
  "Down <n> points since your first scan on <date>",
  "Unchanged since your first scan on <date>",
  "+<n> since <previous scan date>",
  "−<n> since <previous scan date>",
  "No change since <previous scan date>",
  "<count> themes cleared since your first scan on <date>: <name>, <name>",
];

/** The sentence the summary's second paragraph ends with on a first scan (#12 decision 9). */
export const FIRST_SCAN_BASELINE_SENTENCE = "This scan is your baseline; the next one shows what moved.";

/** What the trend card's own contract has to say (#12's §4 and its cross-scan rules). */
const TREND_ITEM_RULES = [
  ["frame the headline since the first scan", /headline[ ,]{1,3}since the first scan/i],
  ["frame the subline since the previous scan", /subline[ ,]{1,3}since the previous scan/i],
  ["drop the subline when the report has exactly two scans", /(?:omit|drop)[^.]{0,80}exactly two scans/i],
  ["frame the Themes-cleared line since the first scan", /themes cleared[ ,]{1,3}since the first scan/i],
  ["omit the Themes-cleared line when nothing has cleared", /zero cleared[^.]{0,80}omit/i],
  // #12 decision 3 fixes "reopened" as the word a Theme failing again gets, so progress and
  // its opposite read alike. The naming has to be there, not just the word: the cross-scan
  // paragraph mentions "reopened" too, and a bare /reopened/ would pass on that alone.
  ["name a Theme that fails again as reopened", /nam(?:ed|ing)[^.]{0,30}\breopened\b/i],
  ["credit no one, PinMeTo included, for the movement", /\bnothing\b[^.]{0,80}\bcredits\b/i],
  ["compute Theme progress against the current mapping only", /\bcurrent mapping[^.]{0,40}\bonly\b/i],
  ["treat ids absent from an older scan as unknown, never failing", /\bunknown\b[^.]{0,40}never failing/i],
  // Variant D folds "What moved" into a disclosure that loads collapsed; an always-open callout
  // is the old trend card.
  ['fold "What moved" into a collapsed disclosure', /collapsed[^.]{0,20}what moved[^.]{0,80}disclosure/i, "affirmative"],
];

/**
 * Polarity. A rule that only looks for a phrase accepts "do not use a collapsed disclosure"
 * and rejects "do not repeat the per-pillar strip". So a rule tagged "affirmative" holds only
 * when the sentence carrying the phrase does not negate it before the phrase, and a prohibited
 * phrase counts only when its sentence states it affirmatively. Sentences are split on ". ",
 * which is how normalizeProse leaves them.
 */
const NEGATION = /\b(?:not|never|no|nor|without)\b/i;
function sentenceAround(prose, pattern) {
  const match = pattern.exec(prose);
  if (match === null) return null;
  const start = prose.lastIndexOf(". ", match.index) + 1;
  return { before: prose.slice(start, match.index) };
}
/** True when `pattern` occurs in `prose` in a sentence that does not negate it first. */
export function statesAffirmatively(prose, pattern) {
  const found = sentenceAround(prose, pattern);
  return found !== null && !NEGATION.test(found.before);
}

/** Wording the variant-D trend retired; its presence means the old trend card came back. */
const TREND_ITEM_FORBIDDEN = [
  ["repeat the per-pillar deltas as a strip (they sit beside the pillar scores)", /per-pillar[^.]{0,20}\bstrip\b/i],
];

/**
 * The Theme row contract (#12 decision 7, variant D): the "Open since" status the row gains
 * from the second scan on, and the one expanded row at the top of the list.
 */
const THEME_ROW_RULES = [
  ["render the top Theme as the one expanded row", /\bone expanded row\b/i, "affirmative"],
  // The cell itself, not the phrase: the item also says a first scan has no "Open since" cell,
  // and a bare /open since/ would pass on that sentence after the cell was deleted.
  ['carry an "Open since" status on the Theme row', /open since <date>[^.]{0,20}<n> scans/i],
  ["define its date as the earliest scan with a failing member", /earliest scan[^.]{0,80}fail/i],
  ["count the scans from that one to now inclusive", /counts? the scans[^.]{0,40}\binclusive\b/i],
];

/**
 * The trend card tells the since-first-scan story (#12, #19): the "Section
 * order" section's Trend item states the two framings, the subline's two-scan
 * drop, the Themes-cleared line with its zero rule, the reopened wording, the
 * no-credit rule and the cross-scan rules; the Themes item defines the "Open
 * since" cell; and the writing-style section carries the first-scan baseline
 * sentence.
 *
 * #12 puts the templates in two places, its §4 and the writing-style templates
 * list, so both copies are pinned to TREND_TEMPLATES: one violation per
 * template, naming the section or sections that lack it. A template that lived
 * in only one of them could drift in the other unnoticed.
 */
export function checkTrendContract(reportMd) {
  const file = "references/artifact-report.md";
  const headingList = headings(reportMd);
  const violations = [];

  const layer1 = layer1Items(headingList);
  if (layer1 === null) {
    violations.push(`${file}: no "Section order" heading, so the trend card contract cannot be read`);
  }
  const item = (title) => (layer1 ?? []).find((entry) => entry.title.toLowerCase() === title.toLowerCase());

  const checkRules = (prose, label, rules) => {
    for (const [requirement, pattern, polarity] of rules) {
      const holds = polarity === "affirmative" ? statesAffirmatively(prose, pattern) : pattern.test(prose);
      if (!holds) violations.push(`${file}: the ${label} does not ${requirement}`);
    }
  };
  /** The sections that must each carry every template, by label and normalized prose. */
  const templateHomes = [];

  const trend = item("Trend");
  if (trend === undefined) {
    violations.push(`${file}: the "Section order" section has no **Trend** item`);
  } else {
    const prose = normalizeProse(trend.body);
    checkRules(prose, "Trend section", TREND_ITEM_RULES);
    for (const [requirement, pattern] of TREND_ITEM_FORBIDDEN) {
      // "Do not repeat the per-pillar strip" is the contract, not a breach of it.
      if (statesAffirmatively(prose, pattern)) violations.push(`${file}: the Trend section must not ${requirement}`);
    }
    templateHomes.push({ label: "Trend section", prose });
  }

  const themes = item("Themes");
  if (themes === undefined) {
    violations.push(`${file}: the "Section order" section has no **Themes** item`);
  } else {
    // The Theme row carries the "Open since" status, not the trend templates.
    checkRules(normalizeProse(themes.body), "Theme row contract", THEME_ROW_RULES);
  }

  const stylePosition = headingList.findIndex((heading) => WRITING_STYLE_HEADING.test(heading.text));
  if (stylePosition === -1) {
    violations.push(`${file}: no writing-style section to carry the trend templates`);
  } else {
    const section = sectionWithSubsections(headingList, stylePosition);
    templateHomes.push({ label: "writing-style section", prose: normalizeProse(section) });
    // The sentence has to sit in the Summary template, not merely somewhere in the
    // section: #12 amends the summary's second paragraph, and a sentence that drifted
    // into a neighbouring template would leave the summary without it.
    // Exactly "Summary": the retired "Summary card" lead must not satisfy the new contract.
    const summaryCard = templateBullets(section).find((bullet) => /^summary\.?$/i.test(bullet.lead));
    if (summaryCard === undefined) {
      violations.push(`${file}: the writing-style section has no **Summary** template bullet`);
    } else if (!summaryCard.prose.includes(normalizeProse(FIRST_SCAN_BASELINE_SENTENCE))) {
      violations.push(
        `${file}: the Summary template does not end a first scan's second paragraph with the baseline sentence "${FIRST_SCAN_BASELINE_SENTENCE}"`,
      );
    }
  }

  for (const template of TREND_TEMPLATES) {
    const missing = templateHomes.filter((home) => !home.prose.includes(normalizeProse(template)));
    if (missing.length > 0) {
      const where = missing.map((home) => `the ${home.label}`).join(" and ");
      violations.push(`${file}: the trend template \`${template}\` is missing from ${where}`);
    }
  }
  return violations;
}

/**
 * Retired vocabulary must be absent from every swept file. `filesByPath` maps a
 * repo-relative path to its contents. Case-insensitive; a whitespace run in the
 * phrase matches any whitespace run in the file, so a phrase wrapped across
 * lines is still caught; the match starts and ends at a word boundary, with an
 * optional plural "es" ("top fixes"). One line per occurrence, with the line
 * number where the phrase starts.
 */
export function checkRetiredVocabulary(filesByPath, phrases = RETIRED_VOCABULARY) {
  const patterns = phrases.map((phrase) => ({
    phrase,
    regex: new RegExp(`\\b${phrase.trim().split(/\s+/).map(escapeRegExp).join("\\s+")}(?:es)?\\b`, "gi"),
  }));
  const violations = [];
  for (const [path, contents] of Object.entries(filesByPath)) {
    for (const { phrase, regex } of patterns) {
      for (const match of contents.matchAll(regex)) {
        const line = contents.slice(0, match.index).split("\n").length;
        violations.push(`${path}: uses retired vocabulary "${phrase}" (line ${line})`);
      }
    }
  }
  return violations;
}

/**
 * `referenceMds` maps `references/<file>.md` to its contents for every file under
 * references/. Every field is required: an omitted one reads as an empty file, so
 * its assertions would silently pass.
 */
/**
 * The reference-only checks: every assertion that reads only files a skill
 * payload ships (references/ plus SKILL.md), so it is meaningful at scan time
 * inside an unpacked `.skill`. Scan mode runs exactly these; full mode adds the
 * repo-only checks below.
 */
function referenceOnlyChecks({ skillMd, referenceMds }) {
  const rubricMd = referenceMds["references/rubric.md"] ?? "";
  const reportMd = referenceMds["references/artifact-report.md"] ?? "";
  return [
    ...checkRubricJson(rubricMd),
    ...checkThemeMapping(reportMd, rubricMd),
    ...checkEffortLabelsHome(reportMd),
    ...checkSectionOrder(reportMd),
    ...checkTrendContract(reportMd),
    ...checkRetiredVocabulary({ "SKILL.md": skillMd, ...referenceMds }),
  ];
}

/**
 * docs/rubric.md is generated from the rubric JSON and the Theme mapping by
 * scripts/render-rubric.mjs. It must equal what the renderer produces today,
 * and the renderer must have a plain-language sentence for every point-bearing
 * id, so a rubric bump cannot leave the readable page describing the old rules.
 */
export function checkRubricPage(rubricPageMd, rubricMd, reportMd) {
  let rendered;
  try {
    rendered = renderRubricPage({ rubricMd, reportMd });
  } catch (error) {
    return [error.message];
  }
  if (rubricPageMd !== rendered) {
    return [`${RUBRIC_PAGE_PATH}: differs from the renderer's output; run \`node scripts/render-rubric.mjs\``];
  }
  return [];
}

/**
 * The repo-only checks: they read files a skill payload does not contain
 * (CHANGELOG.md, CONTEXT.md, README.md), so they are meaningful only in the
 * repo, where CI runs the full check on every push.
 */
function repoOnlyChecks({ skillMd, changelogMd, contextMd, readmeMd, rubricPageMd, referenceMds }) {
  return [
    ...checkVersionMatchesChangelog(skillMd, changelogMd),
    ...checkRubricPage(rubricPageMd, referenceMds["references/rubric.md"] ?? "", referenceMds["references/artifact-report.md"] ?? ""),
    ...checkGlossaryTerms(contextMd),
    // Retired vocabulary in the two repo-only prose files; SKILL.md and the
    // references are already swept by the reference-only check.
    ...checkRetiredVocabulary({ "CONTEXT.md": contextMd, "README.md": readmeMd }),
  ];
}

export function checkReferences(contents, { scanTime = false } = {}) {
  const referenceOnly = referenceOnlyChecks(contents);
  return scanTime ? referenceOnly : [...repoOnlyChecks(contents), ...referenceOnly];
}

/**
 * Run the reference check over an injected filesystem, so the mode split is
 * unit-testable without a subprocess. `readFile(rel)` returns a file's contents
 * or null when it does not exist; `listReferences()` returns the
 * `references/*.md` names or null when the directory is missing. `--scan` in
 * `argv` selects scan mode (reference-only checks; the repo-only files are not
 * required, so their absence never pre-empts the reference checks — the defect
 * #27 fixes); the default full mode also requires and checks the repo-only
 * files, so a genuinely deleted CONTEXT.md still fails CI. Returns one
 * "<file>: <what failed>" line per violation, empty when the mode's checks all
 * hold. A missing required file short-circuits: checking over an absent file
 * would only cascade noise.
 */
export function runCheck({ readFile, listReferences, argv = [] }) {
  const scanTime = argv.includes("--scan");
  const missing = [];
  const read = (rel) => {
    const text = readFile(rel);
    if (text === null) {
      missing.push(`${rel}: file is missing`);
      return "";
    }
    return text;
  };

  const referenceMds = {};
  const referenceNames = listReferences();
  if (referenceNames === null) {
    missing.push("references/: directory is missing");
  } else {
    for (const name of ["rubric.md", "artifact-report.md"]) {
      if (!referenceNames.includes(name)) missing.push(`references/${name}: file is missing`);
    }
    for (const name of referenceNames) referenceMds[`references/${name}`] = read(`references/${name}`);
  }

  const contents = {
    skillMd: read("SKILL.md"),
    changelogMd: "",
    contextMd: "",
    readmeMd: "",
    rubricPageMd: "",
    referenceMds,
  };
  if (!scanTime) {
    contents.changelogMd = read("CHANGELOG.md");
    contents.contextMd = read("CONTEXT.md");
    contents.readmeMd = read("README.md");
    contents.rubricPageMd = read(RUBRIC_PAGE_PATH);
  }

  return missing.length > 0 ? missing : checkReferences(contents, { scanTime });
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const argv = process.argv.slice(2);
  const violations = runCheck({
    readFile: (rel) => {
      try {
        return readFileSync(join(root, rel), "utf8");
      } catch {
        return null;
      }
    },
    listReferences: () => {
      try {
        return readdirSync(join(root, "references"), { recursive: true })
          .map(String)
          .filter((f) => f.endsWith(".md"))
          .sort();
      } catch {
        return null;
      }
    },
    argv,
  });
  for (const line of violations) console.error(line);
  if (violations.length > 0) process.exit(1);
  console.log(argv.includes("--scan") ? "references consistent (scan mode)" : "references consistent");
}

// Compare real paths: on macOS /tmp is a symlink, and import.meta.url is already resolved.
const invokedAsScript = (() => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();
if (invokedAsScript) main();
