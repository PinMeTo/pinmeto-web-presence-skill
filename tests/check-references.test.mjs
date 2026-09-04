import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkVersionMatchesChangelog,
  checkRubricJson,
  checkGlossaryTerms,
  checkThemeMapping,
  checkRetiredVocabulary,
  checkEffortLabelsHome,
  checkSectionOrder,
  RETIRED_VOCABULARY,
  LAYER_1_SECTIONS,
  LAYER_2_ITEMS,
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

test("the default required glossary terms include the Themes and two-layer vocabulary", () => {
  const violations = checkGlossaryTerms(glossary);
  for (const term of ["Theme", "Theme mapping", "Theme brief", "Effort label", "Layer 1", "Layer 2"]) {
    assert.ok(violations.some((v) => v.includes(`\`${term}\``)), `expected a violation for ${term}`);
  }
});

// --- Theme mapping -----------------------------------------------------------

const DEFAULT_LABELS = ['- "One template change"', '- "Content task"'].join("\n");
// The effort labels are enumerated inside the writing-style section, which is their one home (#18).
const reportMd = ({ json, labels = DEFAULT_LABELS }) =>
  `# Report delivery\n\nProse.\n\n\`\`\`html\n<script id="pmt-scan-history">{"schema":1}</script>\n\`\`\`\n\n## Theme mapping\n\n\`\`\`json\n${json}\n\`\`\`\n\n## Writing style inside the report\n\nSober.\n\n### Layer 1 templates\n\nTemplates.\n\n### Effort labels\n\nThe closed set:\n\n${labels}\n`;
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
  const md = reportMd({ json: mapping() }).replace(/### Effort labels[\s\S]*$/, "");
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

test("the retired vocabulary is the four phrases #16 swept", () => {
  assert.deepEqual(RETIRED_VOCABULARY, ["Fix these first", "top fix", "top 3 fixes", "three highest-point fixes"]);
});

test("each retired phrase is a violation naming the file, the phrase and the line", () => {
  for (const phrase of RETIRED_VOCABULARY) {
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
  assert.match(violations[0], /^a\.md: .*line 1\)$/);
  assert.match(violations[1], /^b\.md: /);
  assert.match(violations[2], /^c\.md: /);
});

test("a retired phrase inside another word is not a match", () => {
  const files = { "a.md": "A desktop fixture; stop fixing it; the laptop fix.\n" };
  assert.deepEqual(checkRetiredVocabulary(files), []);
});

test("a phrase used several times in one file is one violation per occurrence", () => {
  const files = { "a.md": "top fix\n\ntop fix\n" };
  const violations = checkRetiredVocabulary(files);
  assert.equal(violations.length, 2);
  assert.match(violations[0], /line 1/);
  assert.match(violations[1], /line 3/);
});

// --- Effort labels have one home ---------------------------------------------

test("an effort-label enumeration inside the writing-style section passes", () => {
  assert.deepEqual(checkEffortLabelsHome(reportMd({ json: mapping() })), []);
});

test("an enumeration nested deeper inside the writing-style section still passes", () => {
  const md = reportMd({ json: mapping() }).replace("### Effort labels", "#### Effort labels");
  assert.deepEqual(checkEffortLabelsHome(md), []);
});

test("an enumeration outside the writing-style section names the section it sits under", () => {
  const md = reportMd({ json: mapping() })
    .replace(/### Effort labels[\s\S]*$/, "")
    .replace("## Writing style inside the report", '### Effort labels\n\nThe closed set:\n\n- "One template change"\n\n## Writing style inside the report');
  const violations = checkEffortLabelsHome(md);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /references\/artifact-report\.md/);
  assert.match(violations[0], /Theme mapping/);
});

test("a second enumeration heading is a violation: the writing-style section is the one home", () => {
  const md = reportMd({ json: mapping() }) + '\n## Effort labels (again)\n\n- "Content task"\n';
  const violations = checkEffortLabelsHome(md);
  assert.equal(violations.length, 1);
  assert.match(violations[0], /2 headings/);
  assert.match(violations[0], /one home/);
});

test("a report reference with no effort-label heading at all is a violation", () => {
  const violations = checkEffortLabelsHome("# Report\n\n## Writing style inside the report\n\nSober.\n");
  assert.equal(violations.length, 1);
  assert.match(violations[0], /effort label/i);
});

test("a bullet naming the effort label in prose is not a second enumeration", () => {
  const md = reportMd({ json: mapping() }).replace(
    "Templates.",
    "- **Effort label.** The mapping `effort`, verbatim; the closed set is enumerated below.",
  );
  assert.deepEqual(checkEffortLabelsHome(md), []);
});

// A fenced example is illustration, not document structure: a `###` line inside a fence is
// not a heading, and its quoted strings are not the closed set.
const FENCED_EXAMPLE = [
  "```markdown",
  "### Effort labels",
  "",
  '- "Bogus label"',
  "```",
].join("\n");

test("an effort-label heading inside a fenced example is not a second enumeration", () => {
  const md = reportMd({ json: mapping() }).replace("## Theme mapping", `${FENCED_EXAMPLE}\n\n## Theme mapping`);
  assert.deepEqual(checkEffortLabelsHome(md), []);
});

test("a fenced example's quoted strings are not read as the closed set", () => {
  const md = reportMd({ json: mapping() }).replace("## Theme mapping", `${FENCED_EXAMPLE}\n\n## Theme mapping`);
  assert.deepEqual(checkThemeMapping(md, themeRubric()), []);
});

test("a tilde-fenced example is ignored the same way", () => {
  const tilde = FENCED_EXAMPLE.replaceAll("```", "~~~");
  const md = reportMd({ json: mapping() }).replace("## Theme mapping", `${tilde}\n\n## Theme mapping`);
  assert.deepEqual(checkEffortLabelsHome(md), []);
  assert.deepEqual(checkThemeMapping(md, themeRubric()), []);
});

// --- Layer 1 section order ----------------------------------------------------

const layer2Items = (items = LAYER_2_ITEMS) =>
  items.map((title, index) => `   ${index + 1}. **${title}**: what it holds.`).join("\n");
const sectionOrderMd = ({
  titles = LAYER_1_SECTIONS,
  scorecards = "the pillar score big, a bar, the band word.",
  methodology = "the four pillar weights with one-line descriptions.",
  nested = layer2Items(),
  trend = "the movement since the first scan, a chart, a per-pillar strip.",
  expander = "one expander, collapsed when the page loads.",
} = {}) => {
  const body = titles
    .map((title, index) => {
      const number = index + 1;
      if (title === "Trend") return `${number}. **${title}**: ${trend}`;
      if (title === "Pillar scorecards") return `${number}. **${title}**: ${scorecards}`;
      if (title === "Methodology") return `${number}. **${title}**: ${methodology}`;
      if (title === "Full audit detail") return `${number}. **${title}**: ${expander}\n${nested}`;
      return `${number}. **${title}**: prose.`;
    })
    .join("\n");
  return `# Report delivery\n\n## Brand look\n\nColors.\n\n## Section order\n\nThe report is two layers.\n\n${body}\n\n## The fix-brief drawer\n\nProse.\n`;
};

test("the ten Layer 1 sections in order, with Layer 2 enumerated inside the expander, pass", () => {
  assert.deepEqual(checkSectionOrder(sectionOrderMd()), []);
});

test("the contract is the ten Layer 1 sections and the six Layer 2 items from the spec", () => {
  assert.deepEqual(LAYER_1_SECTIONS, [
    "Hero",
    "Summary card",
    "Pillar scorecards",
    "Trend",
    "Themes",
    "NAP summary chip",
    "Full audit detail",
    "What to do next",
    "Methodology",
    "Footer",
  ]);
  assert.deepEqual(LAYER_2_ITEMS, [
    "Scan-history table",
    "Sticky section nav",
    "Per-pillar sections",
    "Location breakdown",
    "NAP consistency matrix",
    "Listing content table",
  ]);
});

test("a missing Section order heading is one violation", () => {
  const violations = checkSectionOrder("# Report delivery\n\nNo section order here.\n");
  assert.equal(violations.length, 1);
  assert.match(violations[0], /references\/artifact-report\.md/);
  assert.match(violations[0], /Section order/);
});

test("a Layer 1 section out of order names the position, what is there and what the contract has", () => {
  const swapped = [...LAYER_1_SECTIONS];
  [swapped[4], swapped[5]] = [swapped[5], swapped[4]];
  const violations = checkSectionOrder(sectionOrderMd({ titles: swapped }));
  assert.equal(violations.length, 2);
  assert.match(violations[0], /section 5/);
  assert.match(violations[0], /NAP summary chip/);
  assert.match(violations[0], /Themes/);
});

test("a dropped Layer 1 section names the count and the contract's count", () => {
  const titles = LAYER_1_SECTIONS.filter((title) => title !== "NAP summary chip");
  const violations = checkSectionOrder(sectionOrderMd({ titles }));
  assert.ok(violations.some((v) => /9 Layer 1 sections/.test(v) && /10/.test(v)), violations.join("\n"));
});

test("a pillar weight percentage on the Pillar scorecards item is a violation naming Methodology", () => {
  const violations = checkSectionOrder(sectionOrderMd({ scorecards: "name + weight %, the score big." }));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /Pillar scorecards/);
  assert.match(violations[0], /Methodology/);
});

test("a pillar weight spelled out as per cent, in any section but Methodology, is a violation", () => {
  const violations = checkSectionOrder(sectionOrderMd({ trend: "the pillar weight of 40 per cent moved the score." }));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /Trend/);
});

test("a percentage that is not a pillar weight passes", () => {
  const scorecards = 'the score big, the band word, result labels like "0%".';
  assert.deepEqual(checkSectionOrder(sectionOrderMd({ scorecards })), []);
});

test("a Methodology item that does not carry the pillar weights is a violation", () => {
  const violations = checkSectionOrder(sectionOrderMd({ methodology: "rubric version, scan date, sources." }));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /Methodology/);
  assert.match(violations[0], /weight/);
});

test("a Methodology item that says weight without naming the pillar weights is a violation", () => {
  const methodology = "rubric version, scan date, sources; weight details live elsewhere.";
  const violations = checkSectionOrder(sectionOrderMd({ methodology }));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /Methodology/);
});

test("a Layer 2 item missing from the expander names the item", () => {
  const nested = layer2Items(LAYER_2_ITEMS.filter((title) => title !== "Scan-history table"));
  const violations = checkSectionOrder(sectionOrderMd({ nested }));
  assert.ok(violations.some((v) => /Scan-history table/.test(v)), violations.join("\n"));
});

test("a Layer 2 item out of order names the position", () => {
  const reordered = [...LAYER_2_ITEMS];
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  const violations = checkSectionOrder(sectionOrderMd({ nested: layer2Items(reordered) }));
  assert.equal(violations.length, 2);
  assert.match(violations[0], /Layer 2 item 1/);
  assert.match(violations[0], /Sticky section nav/);
  assert.match(violations[0], /Scan-history table/);
});

test("an expander that does not say it is collapsed is a violation", () => {
  const violations = checkSectionOrder(sectionOrderMd({ expander: "one expander holding the full audit." }));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /Full audit detail/);
  assert.match(violations[0], /collapsed/);
});

test("an expander described as not collapsed is a violation, not a match", () => {
  const violations = checkSectionOrder(sectionOrderMd({ expander: "one expander, not collapsed on load." }));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /collapsed/);
});

test("the word collapsed inside a Layer 2 item does not satisfy the expander's own state", () => {
  const nested = layer2Items().replace("what it holds.", "rows that start collapsed.");
  const violations = checkSectionOrder(sectionOrderMd({ expander: "one expander over the full audit.", nested }));
  assert.equal(violations.length, 1);
  assert.match(violations[0], /collapsed/);
});

test("an empty Full audit detail expander is one violation per missing Layer 2 item", () => {
  const violations = checkSectionOrder(sectionOrderMd({ nested: "" }));
  assert.ok(violations.some((v) => /Layer 2 item/.test(v)), violations.join("\n"));
});
