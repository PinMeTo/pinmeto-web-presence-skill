#!/usr/bin/env node
// Reference-consistency check: do the shipped files agree with each other?
//
// Runs with stock Node, no dependencies:  node scripts/check-references.mjs
// Exit 0 when every assertion holds; otherwise one line per violation
// ("<file>: <property that failed>") and exit 1. CI runs it on every push and
// pull request (.github/workflows/check-references.yml).
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
//   6. Retired vocabulary (RETIRED_VOCABULARY: the wording the Themes work
//      list replaced) is absent from SKILL.md, CONTEXT.md and every file under
//      references/. Matching ignores case, treats any whitespace run,
//      including a line wrap, as one space, and stops at word boundaries
//      ("desktop fixture" is not "top fix"; "top fixes" is).
//
// Every assertion is about an externally observable property of the shipped
// files, never about how the markdown is laid out.
//
// To add an assertion: write a pure function `(fileContents...) => string[]`
// that returns one "<file>: <what failed>" line per violation, add it to
// `checkReferences`, cover it in tests/check-references.test.mjs with a
// passing and a failing input, and extend the list above.

import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_GLOSSARY_TERMS = [
  "Fix brief",
  "Points returned",
  "Report",
  "Theme",
  "Theme mapping",
  "Theme brief",
  "Effort label",
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

/** `referenceMds` maps `references/<file>.md` to its contents for every file under references/. */
export function checkReferences({ skillMd, changelogMd, contextMd, referenceMds }) {
  const rubricMd = referenceMds["references/rubric.md"] ?? "";
  const reportMd = referenceMds["references/artifact-report.md"] ?? "";
  return [
    ...checkVersionMatchesChangelog(skillMd, changelogMd),
    ...checkRubricJson(rubricMd),
    ...checkGlossaryTerms(contextMd),
    ...checkThemeMapping(reportMd, rubricMd),
    ...checkEffortLabelsHome(reportMd),
    ...checkRetiredVocabulary({ "SKILL.md": skillMd, "CONTEXT.md": contextMd, ...referenceMds }),
  ];
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const missing = [];
  const read = (rel) => {
    try {
      return readFileSync(join(root, rel), "utf8");
    } catch {
      missing.push(`${rel}: file is missing`);
      return "";
    }
  };
  const referenceMds = {};
  let referenceNames = [];
  try {
    referenceNames = readdirSync(join(root, "references"), { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    missing.push("references/: directory is missing");
  }
  for (const name of ["rubric.md", "artifact-report.md"]) {
    if (!referenceNames.includes(name)) missing.push(`references/${name}: file is missing`);
  }
  for (const name of referenceNames) referenceMds[`references/${name}`] = read(`references/${name}`);
  const contents = {
    skillMd: read("SKILL.md"),
    changelogMd: read("CHANGELOG.md"),
    contextMd: read("CONTEXT.md"),
    referenceMds,
  };
  const violations = missing.length > 0 ? missing : checkReferences(contents);
  for (const line of violations) console.error(line);
  if (violations.length > 0) process.exit(1);
  console.log("references consistent");
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
