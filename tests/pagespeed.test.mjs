import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractResult } from "../scripts/pagespeed.mjs";

const script = join(dirname(dirname(fileURLToPath(import.meta.url))), "scripts", "pagespeed.mjs");

const psiBody = ({ labMs = 3100, fieldMs = null, audits = {} } = {}) => ({
  analysisUTCTimestamp: "2026-09-10T10:00:00.000Z",
  ...(fieldMs === null
    ? {}
    : { loadingExperience: { metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: fieldMs } } } }),
  lighthouseResult: {
    lighthouseVersion: "12.0.0",
    audits: {
      "largest-contentful-paint": { numericValue: labMs },
      viewport: { score: 1 },
      ...audits,
    },
  },
});

/**
 * Run the CLI against a stub endpoint; resolves with {code, lines, stderr}.
 * `handler` replaces the canned `responses` when a test needs to misbehave at
 * the socket level (drop the body, stall after the headers).
 */
function runCli(args, { responses, handler, env = {} }) {
  return new Promise((resolve, reject) => {
    const seen = [];
    const server = createServer((req, res) => {
      seen.push(req.url);
      if (handler) return handler(req, res);
      const next = responses[Math.min(seen.length - 1, responses.length - 1)];
      res.writeHead(next.status, { "content-type": "application/json" });
      res.end(JSON.stringify(next.body ?? {}));
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      execFile(
        process.execPath,
        [script, ...args],
        {
          env: {
            PATH: process.env.PATH,
            PAGESPEED_ENDPOINT: `http://127.0.0.1:${port}/runPagespeed`,
            ...env,
          },
        },
        (error, stdout, stderr) => {
          server.close();
          if (error && typeof error.code !== "number") return reject(error);
          resolve({
            code: error?.code ?? 0,
            lines: stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)),
            stderr,
            requests: seen,
          });
        },
      );
    });
  });
}

test("the scored LCP is the lab number even when field data is present", () => {
  const result = extractResult("https://brand.example/a", psiBody({ labMs: 3100, fieldMs: 1800 }));
  assert.equal(result.lcpMs, 3100);
  assert.equal(result.lcpSeconds, 3.1);
  assert.equal(result.fieldLcpMs, 1800, "field data rides along as evidence");
});

test("a URL with no field data still scores on lab", () => {
  const result = extractResult("https://brand.example/a", psiBody({ labMs: 2400 }));
  assert.equal(result.lcpSeconds, 2.4);
  assert.equal(result.fieldLcpMs, null);
});

test("a missing or not-applicable mobile audit reads unknown, never pass", () => {
  const result = extractResult(
    "https://brand.example/a",
    psiBody({ audits: { "font-size": { score: null, scoreDisplayMode: "notApplicable" } } }),
  );
  assert.equal(result.mobileAudits.viewport, "pass");
  assert.equal(result.mobileAudits.tapTargets, "unknown", "Lighthouse 13 ships no tap-targets audit");
  assert.equal(result.mobileAudits.fontSize, "unknown");
});

test("a failing audit reads fail", () => {
  const result = extractResult("https://brand.example/a", psiBody({ audits: { viewport: { score: 0 } } }));
  assert.equal(result.mobileAudits.viewport, "fail");
});

test("the form factor the engine actually ran is reported", () => {
  const body = psiBody();
  body.lighthouseResult.configSettings = { formFactor: "mobile" };
  assert.equal(extractResult("https://brand.example/a", body).formFactor, "mobile");
});

test("without a key it makes no call and still lines up every URL", async () => {
  const run = await runCli(["https://brand.example/a", "https://brand.example/b"], {
    responses: [{ status: 200, body: psiBody() }],
  });
  assert.equal(run.code, 3);
  assert.deepEqual(run.requests, []);
  assert.equal(run.lines.length, 2);
  assert.deepEqual(
    run.lines.map((line) => line.error),
    ["no_key", "no_key"],
  );
});

test("the first 429 stops the remaining URLs, which are reported as skipped", async () => {
  const run = await runCli(["https://brand.example/a", "https://brand.example/b", "https://brand.example/c"], {
    env: { PAGESPEED_API_KEY: "secret-key" },
    responses: [{ status: 429, body: { error: { message: "Quota exceeded" } } }],
  });
  assert.equal(run.code, 4);
  assert.equal(run.requests.length, 1, "only the first URL is attempted");
  assert.deepEqual(
    run.lines.map((line) => line.error),
    ["quota_exceeded", "skipped_after_quota", "skipped_after_quota"],
  );
});

test("the key never appears in output, and the quoted endpoint is redacted", async () => {
  const run = await runCli(["https://brand.example/a"], {
    env: { PAGESPEED_API_KEY: "secret-key" },
    responses: [{ status: 429, body: { error: { message: "Quota exceeded" } } }],
  });
  const printed = JSON.stringify(run.lines) + run.stderr;
  assert.ok(!printed.includes("secret-key"));
  assert.match(run.lines[0].endpoint, /key=REDACTED$/);
});

test("a successful run exits 0 and reports one line per URL", async () => {
  const run = await runCli(["https://brand.example/a", "https://brand.example/b"], {
    env: { PSI_API_KEY: "secret-key" },
    responses: [{ status: 200, body: psiBody({ labMs: 2100 }) }],
  });
  assert.equal(run.code, 0);
  assert.equal(run.requests.length, 2);
  assert.deepEqual(
    run.lines.map((line) => line.ok),
    [true, true],
  );
});

test("more than three URLs is a usage error, not a partial run", async () => {
  const run = await runCli(["a", "b", "c", "d"].map((p) => `https://brand.example/${p}`), {
    env: { PAGESPEED_API_KEY: "secret-key" },
    responses: [{ status: 200, body: psiBody() }],
  });
  assert.equal(run.code, 2);
  assert.deepEqual(run.requests, []);
  assert.equal(run.lines.length, 0);
});


// The body is a second failure point after the headers. An unhandled rejection
// here would escape the loop in main() and leave the remaining URLs without a
// line at all, silently shrinking the attempted denominator the ratio divides by.
test("a body that never arrives is one failed line, and the next URL still runs", async () => {
  const run = await runCli(["https://brand.example/a", "https://brand.example/b"], {
    env: { PAGESPEED_API_KEY: "secret-key" },
    handler: (req, res) => {
      res.writeHead(200, { "content-type": "application/json", "content-length": "999" });
      res.flushHeaders();
      res.socket.destroy();
    },
  });
  assert.equal(run.code, 5);
  assert.equal(run.lines.length, 2, "every URL still gets a line");
  assert.deepEqual(
    run.lines.map((line) => line.error),
    ["network_error", "network_error"],
  );
  assert.equal(run.lines[0].httpStatus, 200, "the headers did arrive; the body did not");
});

test("a body that stalls past the timeout is a timeout, not a crash", async () => {
  const run = await runCli(["https://brand.example/a"], {
    env: { PAGESPEED_API_KEY: "secret-key", PAGESPEED_TIMEOUT_MS: "300" },
    handler: (req, res) => {
      res.writeHead(200, { "content-type": "application/json", "content-length": "999" });
      res.flushHeaders();
      // Never end the body: the read has to abort on the timeout.
    },
  });
  assert.equal(run.code, 5);
  assert.equal(run.lines.length, 1);
  assert.equal(run.lines[0].error, "timeout");
  assert.match(run.lines[0].message, /within 0\.3s/);
});
