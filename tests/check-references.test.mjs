import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkVersionMatchesChangelog,
  checkRubricJson,
  checkGlossaryTerms,
  checkThemeMapping,
  checkRetiredVocabulary,
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

test("a sub-group field id that repeats a check id, or another field id, is a violation naming the id", () => {
  const dup = JSON.parse(rubric());
  dup.pillars.geo.sub_groups.b = { fields: [{ id: "seo.a", weight: 50 }, { id: "consistency.name", weight: 50 }] };
  dup.pillars.geo.sub_groups.c = { fields: [{ id: "consistency.name", weight: 100 }] };
  const violations = checkRubricJson(rubricMd(JSON.stringify(dup)));
  assert.equal(violations.length, 2);
  assert.ok(violations.some((v) => /seo\.a/.test(v)));
  assert.ok(violations.some((v) => /consistency\.name/.test(v)));
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

test("the default required glossary terms include Theme, Theme mapping, Theme brief and Effort label", () => {
  const violations = checkGlossaryTerms(glossary);
  for (const term of ["Theme", "Theme mapping", "Theme brief", "Effort label"]) {
    assert.ok(violations.some((v) => v.includes(`\`${term}\``)), `expected a violation for ${term}`);
  }
});

// --- Theme mapping -----------------------------------------------------------

const DEFAULT_LABELS = ['- "One template change"', '- "Content task"'].join("\n");
const reportMd = ({ json, labels = DEFAULT_LABELS }) =>
  `# Report delivery\n\nProse.\n\n\`\`\`html\n<script id="pmt-scan-history">{"schema":1}</script>\n\`\`\`\n\n## Theme mapping\n\n\`\`\`json\n${json}\n\`\`\`\n\n### Effort labels\n\nThe closed set:\n\n${labels}\n\n## Writing style inside the report\n\nSober.\n`;
const mapping = (overrides = {}) =>
  JSON.stringify({
    theme_mapping_for_rubric_version: "2.14.0-skill.1",
    themes: [
      { slug: "in-code", name: "Put details into the page code", description: "d", effort: "One template change", checks: ["seo.a", "geo.x"] },
      { slug: "listings", name: "Keep listings fresh", description: "d", effort: "Content task", checks: ["seo.b", "geo.y", "consistency.name", "page.name"] },
    ],
    ...overrides,
  });
// The test rubric gains sub-group B and C fields: point-bearing ids that are not pillar checks.
const themeRubric = () => {
  const base = JSON.parse(rubric());
  base.pillars.geo.sub_groups.b = { fields: [{ id: "consistency.name", weight: 50 }] };
  base.pillars.geo.sub_groups.c = { fields: [{ id: "page.name", weight: 50 }] };
  return rubricMd(JSON.stringify(base));
};
const withMapping = (mutate) => {
  const m = JSON.parse(mapping());
  mutate(m);
  return reportMd({ json: JSON.stringify(m) });
};

test("a mapping covering every point-bearing id once, pinned to the rubric version, passes", () => {
  assert.deepEqual(checkThemeMapping(reportMd({ json: mapping() }), themeRubric()), []);
});

test("(a) a pinned version differing from the rubric version names both versions", () => {
  const violations = checkThemeMapping(
    reportMd({ json: mapping({ theme_mapping_for_rubric_version: "2.13.0-skill.1" }) }),
    themeRubric(),
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /references\/artifact-report\.md/);
  assert.match(violations[0], /2\.13\.0-skill\.1/);
  assert.match(violations[0], /2\.14\.0-skill\.1/);
});

test("(b) a point-bearing id missing from the mapping names the missing id", () => {
  const md = withMapping((m) => (m.themes[1].checks = m.themes[1].checks.filter((id) => id !== "page.name")));
  const violations = checkThemeMapping(md, themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /page\.name/);
  assert.match(violations[0], /not in any Theme/);
});

test("(b) an id in the mapping that the rubric does not score names the unknown id", () => {
  const md = withMapping((m) => m.themes[0].checks.push("seo.retired"));
  const violations = checkThemeMapping(md, themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /seo\.retired/);
});

test("(c) an id present in two Themes names the id and both slugs", () => {
  const md = withMapping((m) => m.themes[1].checks.push("seo.a"));
  const violations = checkThemeMapping(md, themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /seo\.a/);
  assert.match(violations[0], /in-code/);
  assert.match(violations[0], /listings/);
});

test("(d) an effort outside the enumerated closed set names the label", () => {
  const md = withMapping((m) => (m.themes[1].effort = "Some manual work"));
  const violations = checkThemeMapping(md, themeRubric());
  // Two lines: the stray label, and the enumerated label it displaced now has no Theme.
  assert.equal(violations.length, 2);
  assert.ok(violations.some((v) => /"Some manual work"/.test(v) && /not one of/.test(v)), violations.join("\n"));
  assert.ok(violations.some((v) => /"Content task"/.test(v) && /no Theme/.test(v)), violations.join("\n"));
});

test("(d) an enumerated effort label no Theme uses is a violation naming the label", () => {
  const labels = DEFAULT_LABELS + '\n- "Performance work"';
  const violations = checkThemeMapping(reportMd({ json: mapping(), labels }), themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /Performance work/);
});

test("a label enumerated twice is a violation", () => {
  const labels = DEFAULT_LABELS + '\n- "Content task"';
  const violations = checkThemeMapping(reportMd({ json: mapping(), labels }), themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /duplicate/);
});

test("a Theme that reads as an Other catch-all is a violation naming the slug", () => {
  const md = withMapping((m) => ((m.themes[1].slug = "other"), (m.themes[1].name = "Other")));
  const violations = checkThemeMapping(md, themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /`other`/);
  assert.match(violations[0], /catch-all/);
});

test("a null Theme entry or a non-array checks field is a violation, not a crash", () => {
  let violations = checkThemeMapping(withMapping((m) => m.themes.push(null)), themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /index 2/);
  violations = checkThemeMapping(withMapping((m) => (m.themes[1].checks = { id: "seo.b" })), themeRubric());
  assert.ok(violations.some((v) => /`listings` has no `checks` array/.test(v)), violations.join("\n"));
  // Its ids are then unowned, reported as such rather than thrown.
  assert.ok(violations.some((v) => /`seo\.b` is not in any Theme/.test(v)), violations.join("\n"));
});

test("a report reference with no effort-label enumeration is a violation", () => {
  const md = reportMd({ json: mapping() }).replace(/### Effort labels[\s\S]*?(?=## Writing)/, "");
  const violations = checkThemeMapping(md, themeRubric());
  assert.ok(violations.some((v) => /effort label/i.test(v)), violations.join("\n"));
});

test("a duplicated slug is a violation naming the slug", () => {
  const md = withMapping((m) => (m.themes[1].slug = "in-code"));
  const violations = checkThemeMapping(md, themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /in-code/);
});

test("a slug that is missing or not a string is one violation naming the Theme's position, not a kebab-case pass", () => {
  for (const slug of [undefined, null, 42, true, ""]) {
    const md = withMapping((m) => {
      if (slug === undefined) delete m.themes[1].slug;
      else m.themes[1].slug = slug;
    });
    const violations = checkThemeMapping(md, themeRubric());
    assert.equal(violations.length, 1, `slug ${JSON.stringify(slug)}: ${violations.join("\n")}`);
    assert.match(violations[0], /index 1/);
    assert.match(violations[0], /slug/);
  }
});

test("a slug that is not kebab-case is a violation naming the slug", () => {
  const md = withMapping((m) => (m.themes[1].slug = "Fresh_Listings"));
  const violations = checkThemeMapping(md, themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /Fresh_Listings/);
});

test("a Theme name of thirteen words passes; fourteen is a violation naming the count", () => {
  const thirteen = "one two three four five six seven eight nine ten eleven twelve thirteen";
  assert.deepEqual(checkThemeMapping(withMapping((m) => (m.themes[0].name = thirteen)), themeRubric()), []);
  const violations = checkThemeMapping(withMapping((m) => (m.themes[0].name = thirteen + " fourteen")), themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /14 words/);
});

test("a Theme name carrying a check id is a violation naming the token", () => {
  for (const name of ["Fix seo.a on every page", "Fix seo.h1_unique_has_location, then re-scan"]) {
    const violations = checkThemeMapping(withMapping((m) => (m.themes[0].name = name)), themeRubric());
    assert.equal(violations.length, 1, name);
    assert.match(violations[0], /check id or file token/);
  }
});

test("a Theme name carrying a file token is a violation naming the token", () => {
  for (const name of ["Publish an llms.txt file", "Add /.well-known/mcp for agents", "Serve the .well-known files"]) {
    const violations = checkThemeMapping(withMapping((m) => (m.themes[0].name = name)), themeRubric());
    assert.equal(violations.length, 1, name);
    assert.match(violations[0], /check id or file token/);
  }
});

test("numbers and abbreviations in a Theme name are not check ids or file tokens", () => {
  const md = withMapping((m) => (m.themes[0].name = "Load in 2.5 seconds (e.g. on U.S. phones)"));
  assert.deepEqual(checkThemeMapping(md, themeRubric()), []);
});

test("an unrelated json fence before the mapping, even a broken one, is not mistaken for it", () => {
  const md = reportMd({ json: mapping() }).replace("## Theme mapping", "```json\n{ not the mapping\n```\n\n## Theme mapping");
  assert.deepEqual(checkThemeMapping(md, themeRubric()), []);
});

test("a report reference without a theme-mapping json block is one violation, not a crash", () => {
  const violations = checkThemeMapping("# Report\n\nno mapping here\n", themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /references\/artifact-report\.md/);
  assert.match(violations[0], /theme_mapping_for_rubric_version/);
});

test("a mapping block that does not parse is one violation naming the file", () => {
  const violations = checkThemeMapping(reportMd({ json: '{ "theme_mapping_for_rubric_version": nope' }), themeRubric());
  assert.equal(violations.length, 1);
  assert.match(violations[0], /references\/artifact-report\.md/);
  assert.match(violations[0], /parse/i);
});

test("an unreadable rubric is reported once by the mapping check, without cascading id violations", () => {
  const violations = checkThemeMapping(reportMd({ json: mapping() }), "# Rubric\n\nno json\n");
  assert.equal(violations.length, 1);
  assert.match(violations[0], /rubric/i);
});

// --- Retired vocabulary --------------------------------------------------------

const clean = {
  "SKILL.md": "# Skill\n\nRank Themes by summed points returned.\n",
  "references/scoring.md": "## 4. Points returned\n\nThemes rank by summed points returned.\n",
};

test("files free of retired vocabulary pass", () => {
  assert.deepEqual(checkRetiredVocabulary(clean), []);
});

test("each retired phrase is a violation naming the file, the phrase and the line", () => {
  const phrases = ["Fix these first", "top fix", "top 3 fixes", "three highest-point fixes"];
  for (const phrase of phrases) {
    const files = { ...clean, "references/monitoring.md": `# Monitoring\n\nStagnation on a ${phrase} matters.\n` };
    const violations = checkRetiredVocabulary(files);
    assert.equal(violations.length, 1, phrase);
    assert.match(violations[0], /^references\/monitoring\.md: /);
    assert.ok(violations[0].includes(phrase), violations[0]);
    assert.match(violations[0], /line 3/);
  }
});

test("retired vocabulary is caught regardless of case and of plural or line-wrapped spelling", () => {
  const files = {
    "a.md": 'The report\'s "Fix\nthese first" section.\n',
    "b.md": "## 4. Top fixes\n",
    "c.md": "the TOP FIX list\n",
  };
  const violations = checkRetiredVocabulary(files);
  assert.equal(violations.length, 3, violations.join("\n"));
  assert.match(violations[0], /^a\.md: /);
  assert.match(violations[1], /^b\.md: /);
  assert.match(violations[2], /^c\.md: /);
});

test("a phrase used several times in one file is one violation per occurrence", () => {
  const files = { "a.md": "top fix\n\ntop fix\n" };
  const violations = checkRetiredVocabulary(files);
  assert.equal(violations.length, 2);
  assert.match(violations[0], /line 1/);
  assert.match(violations[1], /line 3/);
});
