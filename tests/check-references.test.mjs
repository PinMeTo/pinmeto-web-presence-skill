import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkVersionMatchesChangelog,
  checkRubricJson,
  checkGlossaryTerms,
} from "../scripts/check-references.mjs";

const skill = (version) => `---\nname: pinmeto-web-presence\nversion: ${version}\n---\n# Title\n`;
const changelog = (newest) =>
  `# Changelog\n\nIntro prose.\n\n## v${newest} · 2026-08-18 · rubric 2.14.0-skill.1\n\n- a change\n\n## v0.1.0 · 2026-01-01 · rubric 1.0.0\n`;

test("skill version equal to the newest changelog heading passes", () => {
  assert.deepEqual(checkVersionMatchesChangelog(skill("0.12.1"), changelog("0.12.1")), []);
});

test("skill version differing from the newest changelog heading names the mismatch", () => {
  const violations = checkVersionMatchesChangelog(skill("0.13.0"), changelog("0.12.1"));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /SKILL\.md/);
  assert.match(violations[0], /0\.13\.0/);
  assert.match(violations[0], /0\.12\.1/);
});

const rubricMd = (json) => `# Rubric\n\nProse first.\n\n\`\`\`json\n${json}\n\`\`\`\n\nMore prose.\n`;
const rubric = (overrides = {}) =>
  JSON.stringify({
    rubric_version: "2.14.0-skill.1",
    pillars: {
      seo: { name: "SEO", checks: [{ id: "seo.a", weight: 5 }, { id: "seo.b", weight: 5 }] },
      geo: {
        name: "GEO",
        sub_groups: {
          a: {
            applicable_checks: { google: ["geo.x", "geo.y"] },
            accuracy_checks: [{ id: "geo.x", browser_downgrade: { any_of: [{ id: "mismatch" }] } }],
            richness_checks: [{ id: "geo.y", browser_downgrade: { any_of: [{ id: "mismatch" }] } }],
          },
        },
      },
    },
    ...overrides,
  });

test("a well-formed rubric block passes (repeated downgrade-reason ids are not check ids)", () => {
  assert.deepEqual(checkRubricJson(rubricMd(rubric())), []);
});

test("a rubric block that does not parse is one violation naming the file", () => {
  const violations = checkRubricJson(rubricMd('{ "rubric_version": "1", trailing }'));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /references\/rubric\.md/);
  assert.match(violations[0], /parse/i);
});

test("a rubric block whose JSON is not an object is one violation, not a crash", () => {
  const violations = checkRubricJson(rubricMd("null"));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /references\/rubric\.md/);
});

test("a rubric block without a json fence is a violation", () => {
  assert.match(checkRubricJson("# Rubric\n\nno block here\n")[0], /references\/rubric\.md/);
});

test("a rubric block without rubric_version is a violation", () => {
  const violations = checkRubricJson(rubricMd(rubric({ rubric_version: undefined })));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /rubric_version/);
});

test("a duplicated check id across pillars is a violation naming the id", () => {
  const dup = JSON.parse(rubric());
  dup.pillars.seo.checks.push({ id: "geo.x", weight: 1 });
  const violations = checkRubricJson(rubricMd(JSON.stringify(dup)));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /geo\.x/);
});

const glossary = `# Skill\n\n## Language\n\n### Deliverable\n\n**Report**:\nThe living scorecard.\n_Avoid_: audit\n\n**Fix brief**:\nThe drawer.\n`;

test("every required term with a glossary entry passes", () => {
  assert.deepEqual(checkGlossaryTerms(glossary, ["Report", "Fix brief"]), []);
});

test("a required term without a glossary entry is one violation naming the term", () => {
  const violations = checkGlossaryTerms(glossary, ["Report", "Theme brief"]);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /CONTEXT\.md/);
  assert.match(violations[0], /Theme brief/);
});

test("a term mentioned only in prose, not as an entry, does not count", () => {
  const prose = glossary + "\nThe Theme brief is discussed elsewhere.\n";
  assert.equal(checkGlossaryTerms(prose, ["Theme brief"]).length, 1);
});
