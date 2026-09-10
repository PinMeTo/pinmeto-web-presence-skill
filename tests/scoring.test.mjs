// The scoring arithmetic, against the third pinmeto.com scan.
//
// The fixture is that scan's real `results.json`, so these numbers are not
// invented: they are what the 2026-09-07 report published. Any change to
// `scripts/score.py` that moves them is either a rubric change (which must
// bump `rubric_version` and land with the reference) or a bug.
//
// The tests shell out to python3 because the scorer is Python and the repo's
// test runner is `node --test`. A machine without python3 cannot run a scan
// either, so failing here is the right answer.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = dirname(here);
const scorer = join(repo, "scripts", "score.py");
const fixturePath = join(here, "fixtures", "results-2026-09-07.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

/** Runs score.py over `results` and returns the parsed scores.json. */
function score(results, extraArgs = []) {
  const workdir = mkdtempSync(join(tmpdir(), "pmt-score-"));
  writeFileSync(join(workdir, "results.json"), JSON.stringify(results));
  const run = spawnSync(
    "python3",
    [scorer, "--workdir", workdir, "--refs", join(repo, "references"), ...extraArgs],
    { encoding: "utf8" },
  );
  return { run, scores: run.status === 0 ? JSON.parse(readFileSync(join(workdir, "scores.json"), "utf8")) : null };
}

/** A deep copy, so a mutation in one test cannot leak into the next. */
const clone = () => JSON.parse(JSON.stringify(fixture));

const near = (actual, expected, tolerance = 0.005) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected} (+/- ${tolerance}), got ${actual}`,
  );

test("the 2026-09-07 scan reproduces its published pillar scores", () => {
  const { run, scores } = score(fixture);
  assert.equal(run.status, 0, run.stderr);
  near(scores.pillars.seo, 42.75);
  near(scores.pillars.geo, 79.8);
  near(scores.pillars.aio, 84.97);
  near(scores.pillars.agent_readiness, 96.67);
});

test("the 2026-09-07 scan reproduces its GEO sub-groups", () => {
  const { scores } = score(fixture);
  near(scores.geo.A, 67.82);
  near(scores.geo.B, 90);
  near(scores.geo.C, 100);
});

test("the 2026-09-07 scan reproduces its overall score and grade", () => {
  const { scores } = score(fixture);
  near(scores.overallExact, 72.51);
  assert.equal(scores.overall, 73);
  assert.equal(scores.grade, "C");
});

test("the 2026-09-07 scan reproduces its pass/warn/fail counts", () => {
  const { scores } = score(fixture);
  assert.deepEqual(scores.counts, { pass: 36, warn: 3, fail: 20 });
});

test("the 2026-09-07 scan reproduces its Theme ranking and worth", () => {
  const { scores } = score(fixture);
  const ranked = scores.themes.filter((theme) => theme.worth > 0).map((theme) => [theme.slug, Number(theme.worth.toFixed(2))]);
  assert.deepEqual(ranked, [
    ["crawlable-site", 8.0],
    ["location-data-in-code", 5.05],
    ["unique-location-pages", 3.75],
    ["same-details-everywhere", 3.01],
    ["connect-listings", 1.37],
    ["text-for-ai", 1.33],
    ["fresh-google-listings", 1.12],
  ]);
});

test("the history entry is ready to append to the scan history block", () => {
  const { scores } = score(fixture, ["--label", "Third scan"]);
  const entry = scores.entry;
  assert.equal(entry.date, "2026-09-07");
  assert.equal(entry.label, "Third scan");
  assert.equal(entry.rubricVersion, "2.14.0-skill.1");
  assert.deepEqual(entry.pillars, { seo: 43, geo: 80, aio: 85, agent_readiness: 97 });
  assert.deepEqual(entry.sample, ["1337", "171206", "666", "GDANSK", "MUMBAI"]);
  assert.ok(entry.notes.length > 0, "the scan's measurement notes carry into the history entry");
});

test("a category-conditional check excluded everywhere is absent from the history checks", () => {
  // rubric.md drops geo.menu_order_reservations from the GEO denominator for
  // this brand, so recording it as warn would count it among "could not be
  // measured" and imply somebody tried.
  const { scores } = score(fixture);
  assert.ok(!("geo.menu_order_reservations" in scores.entry.checks));
  assert.ok(scores.entry.notes.some((note) => note.includes("geo.menu_order_reservations")));
});

test("a GEO rollup is warn only when every contributing observation was unmeasurable", () => {
  const { scores } = score(fixture);
  // Every sampled Google listing hid its photo grid, so nothing was measured.
  assert.equal(scores.rollups["geo.photos_5_plus"].status, "warn");
  // Two of five could not be read, three could: a measured failure, not a gap.
  assert.equal(scores.rollups["geo.recent_reviews_180d"].status, "fail");
});

test("rounding is half up, not Python's banker's rounding", () => {
  // A pillar landing exactly on .5 must round away from zero. round(85.5)
  // is 86 in JS and 86 here; Python's own round() would say 85, and a hero
  // that disagrees with the history block is how this rule got written.
  const results = clone();
  assert.equal(score(results).scores.entry.pillars.geo, 80); // 79.80 -> 80
  assert.equal(score(results).scores.entry.pillars.aio, 85); // 84.97 -> 85
});

test("a not_found platform scores zero, not a warn", () => {
  const results = clone();
  for (const platform of ["google", "apple", "bing"]) {
    for (const storeId of results.sample) results.geoObs[storeId][platform] = { lookup: "not_found" };
  }
  const { scores } = score(results);
  assert.equal(scores.geoUnmeasured, false, "an all-not_found run is measured");
  assert.equal(scores.pillars.geo, 0);
  assert.equal(scores.entry.pillars.geo, 0);
});

test("an all-unobserved run drops GEO from the overall instead of scoring warns", () => {
  const results = clone();
  for (const platform of ["google", "apple", "bing"]) {
    for (const storeId of results.sample) results.geoObs[storeId][platform] = { lookup: "unobserved" };
  }
  const { scores } = score(results);
  assert.equal(scores.geoUnmeasured, true);
  assert.equal(scores.pillars.geo, null);
  assert.equal(scores.entry.pillars.geo, null, "the history must not plot an unmeasured GEO as a drop");
  // 0.43 seo + 0.357 aio + 0.214 agent_readiness, per scoring.md.
  near(scores.overallExact, 0.43 * 42.75 + 0.357 * 84.97 + 0.214 * 96.67);
  assert.ok(scores.entry.notes.some((note) => note.toLowerCase().includes("degraded")));
});

test("parity ignores the unobserved fallback that softens platform-scoped checks", () => {
  // geo.location_platform_parity is brand-wide and only borrows a slot in
  // the Google column. Blanking Google must not lift a parity failure to 0.5.
  const results = clone();
  for (const storeId of results.sample) results.geoObs[storeId].google = { lookup: "unobserved" };
  const { scores } = score(results);
  assert.equal(scores.rollups["geo.location_platform_parity"].ratio, 0);
  assert.equal(scores.rollups["geo.location_platform_parity"].status, "fail");
});

test("sub-group C is excluded and its weight redistributed when no location has a dominant platform", () => {
  const results = clone();
  for (const storeId of results.sample) results.pageObs[storeId].dominant = null;
  const { scores } = score(results);
  assert.equal(scores.geo.C, null);
  assert.deepEqual(scores.geo.weights, { a: 0.688, b: 0.312 });
  near(scores.pillars.geo, 0.688 * scores.geo.A + 0.312 * scores.geo.B);
});

test("sub-group B is excluded and its weight redistributed when no location has two observed listings", () => {
  const results = clone();
  for (const storeId of results.sample) {
    results.geoObs[storeId].apple = { lookup: "not_found" };
    results.geoObs[storeId].bing = { lookup: "not_found" };
  }
  const { scores } = score(results);
  assert.equal(scores.geo.B, null);
  assert.deepEqual(scores.geo.weights, { a: 0.733, c: 0.267 });
  near(scores.pillars.geo, 0.733 * scores.geo.A + 0.267 * scores.geo.C);
});

test("a missing check result is named and fails the run, never silently scored as zero", () => {
  const results = clone();
  results.checks = results.checks.filter((check) => check.id !== "seo.canonical_present");
  const { run } = score(results);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /seo\.canonical_present/);
});

test("a Theme mapping pinned to another rubric version refuses to score", () => {
  const workdir = mkdtempSync(join(tmpdir(), "pmt-refs-"));
  writeFileSync(join(workdir, "results.json"), JSON.stringify(fixture));
  writeFileSync(
    join(workdir, "rubric.md"),
    "```json\n" + JSON.stringify({ rubric_version: "9.9.9" }) + "\n```\n",
  );
  writeFileSync(
    join(workdir, "artifact-report.md"),
    "```json\n" + JSON.stringify({ theme_mapping_for_rubric_version: "2.14.0-skill.1", themes: [] }) + "\n```\n",
  );
  const run = spawnSync("python3", [scorer, "--workdir", workdir, "--refs", workdir], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /9\.9\.9/);
});
