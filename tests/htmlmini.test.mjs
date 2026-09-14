// The vendored HTML parser, against the markup real sites actually serve.
//
// `scripts/htmlmini.py` exists so a scan needs nothing installed, which means
// the parser is ours to get wrong. Every case here is a shape that changed a
// check's answer at some point: unclosed list items concatenating breadcrumb
// labels, a `<` inside a JSON-LD string, decorative images counted against
// alt-text coverage, script text leaking into the first-200-words extract.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));

/** Parses `markup` and returns whatever the python `expression` evaluates to. */
function parse(markup, expression) {
  const program = [
    "import sys, json",
    `sys.path.insert(0, ${JSON.stringify(join(repo, "scripts"))})`,
    "import htmlmini",
    "doc = htmlmini.parse(sys.stdin.read())",
    `print(json.dumps(${expression}))`,
  ].join("\n");
  const run = spawnSync("python3", ["-c", program], { input: markup, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test("character references in the title are decoded once", () => {
  assert.equal(parse("<title>Bed &amp; Breakfast</title>", "doc.find('title').get_text()"), "Bed & Breakfast");
});

test("unclosed list items stay siblings instead of nesting", () => {
  // `<li>a<li>b` nested is how a breadcrumb trail comes back as one label
  // reading "Home Locations Malmö" and stops matching the JSON-LD items.
  const labels = parse(
    "<ul><li>Home<li>Locations<li>Malmö</ul>",
    "[li.get_text() for li in doc.find_all('li')]",
  );
  assert.deepEqual(labels, ["Home", "Locations", "Malmö"]);
});

test("an unclosed paragraph does not swallow the rest of the document", () => {
  const text = parse("<main><p>one<p>two</main>", "doc.find('main').get_text()");
  assert.equal(text, "one two");
});

test("a void element never opens a scope", () => {
  const count = parse("<div><img src=a><img src=b></div>", "len(doc.find('div').find_all('img'))");
  assert.equal(count, 2);
});

test("a stray closing tag for a never-opened element is ignored", () => {
  assert.equal(parse("<main>text</span> more</main>", "doc.find('main').get_text()"), "text more");
});

test("JSON-LD survives a < inside a string value", () => {
  const raw = parse(
    '<script type="application/ld+json">{"name": "A < B", "@type": "Organization"}</script>',
    "doc.find('script', {'type': 'application/ld+json'}).raw_text()",
  );
  assert.deepEqual(JSON.parse(raw), { name: "A < B", "@type": "Organization" });
});

test("script and style text never reaches the page copy", () => {
  // aio.quick_answer_first_200w reads the opening words; a analytics blob
  // landing in them turns a passing page into a failing one.
  const text = parse(
    "<main><script>var tracking = 1;</script><style>.a{color:red}</style><p>Real copy.</p></main>",
    "doc.find('main').get_text()",
  );
  assert.equal(text, "Real copy.");
});

test("attribute lookups match exact values, presence and a predicate", () => {
  const markup = '<link rel="canonical" href="/x"><link rel="alternate" hreflang="sv" href="/sv">';
  assert.equal(parse(markup, "doc.find('link', {'rel': 'canonical'}).get('href')"), "/x");
  assert.equal(parse(markup, "len(doc.find_all('link', {'hreflang': True}))"), 1);
  assert.equal(
    parse('<meta property="og:title" content="T"><meta property="x" content="N">',
      "len(doc.find_all('meta', {'property': lambda v: bool(v) and v.startswith('og:')}))"),
    1,
  );
});

test("a valueless attribute reads as empty, not missing", () => {
  assert.equal(parse("<img src=a alt>", "doc.find('img').get('alt')"), "");
});

test("uppercase tags and attributes are matched lowercase", () => {
  assert.equal(parse('<IMG SRC="a" ALT="Alt">', "doc.find('img').get('alt')"), "Alt");
});

test("malformed markup parses instead of raising", () => {
  assert.equal(parse("<p>unterminated <b>bold", "doc.get_text()"), "unterminated bold");
  assert.equal(parse("", "doc.get_text()"), "");
});

// `seo.mobile_friendly` scores the viewport tag off served HTML, so the served
// pass has to surface it. No current Lighthouse ships a viewport, tap-targets
// or font-size audit, which is why the check reads the markup directly.
test("analyze_served surfaces the viewport meta tag", () => {
  const workdir = mkdtempSync(join(tmpdir(), "pmt-served-"));
  const fetchDir = join(workdir, "fetch");
  mkdirSync(fetchDir);
  writeFileSync(
    join(fetchDir, "page.b"),
    '<html lang="en"><head><title>T</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      "</head><body><h1>H</h1></body></html>",
  );
  writeFileSync(join(fetchDir, "page.h"), "HTTP/2 200\n");
  writeFileSync(join(fetchDir, "page.m"), "200\thttps://brand.example/a\ttext/html\t120\t0\n");

  const run = spawnSync("python3", [join(repo, "scripts", "analyze_served.py"), "--workdir", workdir], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const served = JSON.parse(readFileSync(join(workdir, "served.json"), "utf8"));
  assert.equal(served.page.viewport, "width=device-width, initial-scale=1");
});

test("a page with no viewport tag reports null, not an empty string", () => {
  const workdir = mkdtempSync(join(tmpdir(), "pmt-served-"));
  const fetchDir = join(workdir, "fetch");
  mkdirSync(fetchDir);
  writeFileSync(join(fetchDir, "page.b"), "<html><head><title>T</title></head><body></body></html>");
  writeFileSync(join(fetchDir, "page.h"), "HTTP/2 200\n");
  writeFileSync(join(fetchDir, "page.m"), "200\thttps://brand.example/a\ttext/html\t60\t0\n");

  const run = spawnSync("python3", [join(repo, "scripts", "analyze_served.py"), "--workdir", workdir], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(readFileSync(join(workdir, "served.json"), "utf8")).page.viewport, null);
});
