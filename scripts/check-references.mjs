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
//      a `rubric_version`, and its pillar check ids are unique. Check ids are
//      the `id` of every object inside an array whose key ends in `checks`
//      under `pillars` (seo/aio/agent_readiness `checks`, GEO
//      `accuracy_checks` and `richness_checks`).
//   3. Every term in REQUIRED_GLOSSARY_TERMS has a `**Term**:` entry in
//      CONTEXT.md.
//
// Every assertion is about an externally observable property of the shipped
// files, never about how the markdown is laid out.
//
// To add an assertion: write a pure function `(fileContents...) => string[]`
// that returns one "<file>: <what failed>" line per violation, add it to
// `checkReferences`, cover it in tests/check-references.test.mjs with a
// passing and a failing input, and extend the list above.

import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_GLOSSARY_TERMS = ["Fix brief", "Points returned", "Report"];

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

/** Contents of the first ```json fence in a markdown file, or null when there is none. */
function firstJsonBlock(markdown) {
  return markdown.match(/^```json[ \t]*\r?\n([\s\S]*?)^```/m)?.[1] ?? null;
}

/**
 * Check ids: the `id` of every object in an array whose key ends in `checks`,
 * anywhere under `pillars`. Other `id` fields (browser-downgrade reasons and
 * the like) are not check ids and may legitimately repeat.
 */
function collectCheckIds(pillars) {
  const ids = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key.endsWith("checks") && Array.isArray(value)) {
        for (const entry of value) {
          if (entry && typeof entry === "object" && "id" in entry) ids.push(String(entry.id));
        }
      }
      walk(value);
    }
  };
  walk(pillars);
  return ids;
}

export function checkRubricJson(rubricMd) {
  const file = "references/rubric.md";
  const block = firstJsonBlock(rubricMd);
  if (block === null) return [`${file}: no \`\`\`json block found`];
  let rubric;
  try {
    rubric = JSON.parse(block);
  } catch (error) {
    return [`${file}: JSON block does not parse (${error.message})`];
  }
  if (rubric === null || typeof rubric !== "object" || Array.isArray(rubric)) {
    return [`${file}: JSON block is not an object`];
  }
  const violations = [];
  if (typeof rubric.rubric_version !== "string" || rubric.rubric_version === "") {
    violations.push(`${file}: JSON block has no \`rubric_version\` string`);
  }
  const occurrences = new Map();
  for (const id of collectCheckIds(rubric.pillars ?? {})) {
    occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
  }
  for (const [id, count] of occurrences) {
    if (count > 1) violations.push(`${file}: check id \`${id}\` appears ${count} times`);
  }
  return violations;
}

/** A glossary entry is a line of the form `**Term**:` in CONTEXT.md. */
export function checkGlossaryTerms(contextMd, requiredTerms = REQUIRED_GLOSSARY_TERMS) {
  const escape = (term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return requiredTerms
    .filter((term) => !new RegExp(`^\\*\\*${escape(term)}\\*\\*:`, "m").test(contextMd))
    .map((term) => `CONTEXT.md: glossary has no entry for \`${term}\``);
}

export function checkReferences({ skillMd, changelogMd, rubricMd, contextMd }) {
  return [
    ...checkVersionMatchesChangelog(skillMd, changelogMd),
    ...checkRubricJson(rubricMd),
    ...checkGlossaryTerms(contextMd),
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
  const contents = {
    skillMd: read("SKILL.md"),
    changelogMd: read("CHANGELOG.md"),
    rubricMd: read("references/rubric.md"),
    contextMd: read("CONTEXT.md"),
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
