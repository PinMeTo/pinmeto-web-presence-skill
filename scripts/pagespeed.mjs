#!/usr/bin/env node
// PageSpeed Insights for `seo.lcp_sample` (rung 1 of the engine ladder in
// references/seo-checks.md).
//
//   node scripts/pagespeed.mjs <url> [<url> <url>]
//
// One attempt per URL, 60 s hard timeout, **no retries**, and it stops after
// the first 429: the anonymous quota is per-IP and shared machine-wide, so the
// remaining calls would spend a minute each proving the same thing. Without a
// key it makes no call at all — a keyless scan must cost zero minutes here.
//
// The key comes from --key, else $PAGESPEED_API_KEY, else $PSI_API_KEY. It is
// never printed: the endpoint appears in output as `key=REDACTED`, so evidence
// rows copied out of here cannot leak it into a published report.
//
// Writes one JSON object per line to stdout (JSON Lines), in argument order,
// one line per URL — including the URLs it deliberately did not call, so the
// caller can score over the full attempted denominator that `rubric.md`
// requires rather than silently shrinking it. Diagnostics go to stderr.
//
// Exit codes: 0 every URL returned · 3 no key, nothing called · 4 stopped on a
// 429 · 5 some other request failed. Any non-zero exit still prints a full set
// of lines; the exit code is a summary, not a reason to skip stdout.

// $PAGESPEED_ENDPOINT and $PAGESPEED_TIMEOUT_MS are test seams
// (tests/pagespeed.test.mjs points one at a local server and shortens the
// other); a scan never sets either.
const ENDPOINT = process.env.PAGESPEED_ENDPOINT || "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = Number(process.env.PAGESPEED_TIMEOUT_MS) || 60_000;
const MAX_URLS = 3;

/** Audit score 1 → "pass", 0 → "fail", missing/not-applicable → "unknown". */
function auditVerdict(audits, id) {
  const audit = audits?.[id];
  if (!audit) return "unknown";
  if (audit.scoreDisplayMode === "notApplicable" || audit.scoreDisplayMode === "informative") return "unknown";
  if (typeof audit.score !== "number") return "unknown";
  return audit.score >= 0.9 ? "pass" : "fail";
}

/**
 * `seo.lcp_sample`'s fields, extracted from one PSI response.
 *
 * `lcpMs` is the **lab** LCP and is the scored value. CrUX field data rides
 * along as `fieldLcpMs` for evidence only: it exists for high-traffic URLs and
 * not for most location pages, so scoring it would mix two measurements inside
 * one three-URL ratio. The mobile audits are evidence too — `seo.mobile_friendly`
 * reads the viewport tag off the page's own HTML, because Lighthouse 13 ships
 * none of `viewport`, `tap-targets` or `font-size` any more.
 */
export function extractResult(url, body) {
  const lighthouse = body?.lighthouseResult ?? {};
  const audits = lighthouse.audits ?? {};
  const labMs = audits["largest-contentful-paint"]?.numericValue ?? null;
  const fieldMs = body?.loadingExperience?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null;
  return {
    url,
    engine: "psi",
    ok: true,
    formFactor: lighthouse.configSettings?.formFactor ?? null,
    lcpMs: labMs === null ? null : Math.round(labMs),
    lcpSeconds: labMs === null ? null : Math.round(labMs) / 1000,
    fieldLcpMs: fieldMs === null ? null : Math.round(fieldMs),
    mobileAudits: {
      viewport: auditVerdict(audits, "viewport"),
      tapTargets: auditVerdict(audits, "tap-targets"),
      fontSize: auditVerdict(audits, "font-size"),
    },
    lighthouseVersion: lighthouse.lighthouseVersion ?? null,
    fetchedAt: body?.analysisUTCTimestamp ?? new Date().toISOString(),
  };
}

function requestUrl(url, key) {
  const query = new URLSearchParams({ url, strategy: "mobile" });
  query.append("category", "PERFORMANCE");
  query.append("category", "SEO");
  query.append("key", key);
  return `${ENDPOINT}?${query}`;
}

/** The endpoint as it is safe to quote in evidence. */
function redactedEndpoint(url) {
  return `${ENDPOINT}?url=${encodeURIComponent(url)}&strategy=mobile&key=REDACTED`;
}

/** A failed request as one scored line; never throws, so the loop survives it. */
function failure(url, error, httpStatus, message) {
  return { url, engine: "psi", ok: false, error, httpStatus, endpoint: redactedEndpoint(url), message };
}

async function measure(url, key) {
  const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);
  const timedOut = (httpStatus) =>
    failure(url, "timeout", httpStatus, `no response within ${TIMEOUT_MS / 1000}s`);

  let response;
  try {
    response = await fetch(requestUrl(url, key), {
      signal: timeoutSignal,
      headers: { accept: "application/json" },
    });
  } catch (error) {
    return timeoutSignal.aborted
      ? timedOut(null)
      : failure(url, "network_error", null, String(error?.message ?? error));
  }

  // The body is a second failure point: headers can arrive and the read still
  // abort on the timeout, or the connection drop mid-JSON. Left unhandled that
  // rejection escapes the loop in main() and the remaining URLs never get a
  // line, which is exactly the silently-shrunk denominator this script exists
  // to prevent.
  let text;
  try {
    text = await response.text();
  } catch (error) {
    return timeoutSignal.aborted
      ? timedOut(response.status)
      : failure(url, "network_error", response.status, String(error?.message ?? error));
  }

  if (!response.ok) {
    let message = text.slice(0, 300);
    try {
      message = JSON.parse(text)?.error?.message ?? message;
    } catch {
      // Non-JSON error body (an HTML quota page, say): the excerpt is the evidence.
    }
    return failure(
      url,
      response.status === 429 ? "quota_exceeded" : `http_${response.status}`,
      response.status,
      message,
    );
  }

  try {
    return extractResult(url, JSON.parse(text));
  } catch (error) {
    return failure(url, "unparseable_response", response.status, String(error?.message ?? error));
  }
}

async function main(argv) {
  const args = [...argv];
  let key = process.env.PAGESPEED_API_KEY || process.env.PSI_API_KEY || "";
  const flag = args.indexOf("--key");
  if (flag !== -1) {
    key = args[flag + 1] ?? "";
    args.splice(flag, 2);
  }
  const urls = args.filter((arg) => !arg.startsWith("-"));

  if (urls.length === 0) {
    process.stderr.write("usage: node scripts/pagespeed.mjs [--key KEY] <url> [<url> <url>]\n");
    return 2;
  }
  if (urls.length > MAX_URLS) {
    process.stderr.write(`error: at most ${MAX_URLS} URLs per run (got ${urls.length})\n`);
    return 2;
  }

  const emit = (line) => process.stdout.write(`${JSON.stringify(line)}\n`);

  if (!key) {
    // No key, no call. `warn` on both checks is the standing outcome, and the
    // scan spends nothing discovering it.
    for (const url of urls) {
      emit({
        url,
        engine: "psi",
        ok: false,
        error: "no_key",
        httpStatus: null,
        message: "no PageSpeed API key supplied; not called (the anonymous per-IP quota is routinely exhausted)",
      });
    }
    process.stderr.write("pagespeed: no API key (--key, $PAGESPEED_API_KEY or $PSI_API_KEY); made no calls\n");
    return 3;
  }

  let stopped = false;
  let failed = false;
  for (const url of urls) {
    if (stopped) {
      emit({
        url,
        engine: "psi",
        ok: false,
        error: "skipped_after_quota",
        httpStatus: null,
        message: "not called: an earlier URL returned 429 and the quota is shared across these calls",
      });
      continue;
    }
    const result = await measure(url, key);
    emit(result);
    if (!result.ok) {
      failed = true;
      if (result.error === "quota_exceeded") {
        stopped = true;
        process.stderr.write("pagespeed: 429 on the shared quota; skipping the remaining URLs\n");
      }
    }
  }
  return stopped ? 4 : failed ? 5 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await main(process.argv.slice(2)));
}
