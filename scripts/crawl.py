#!/usr/bin/env python3
"""The `seo.internal_linking_depth` crawl.

    scripts/crawl.py --workdir DIR --start https://www.brand.com/ \\
        --target https://www.brand.com/stores/123/ [--target ...]
    scripts/crawl.py --workdir DIR --start ... --targets-file DIR/targets.txt

Breadth-first over served-HTML `<a href>` links from the homepage, same host,
depth <= 3, capped at exactly 50 fetched pages, exactly as
`references/seo-checks.md` defines it: strict BFS, ascending lexicographic
order of the absolute URL within a depth level, deduped without the fragment.
JS-only links (buttons, `onclick`) do not count; that is the whole point of
the check. Writes DIR/crawl.json.

Two things here are faster than the letter of the reference without being
different from it:

- each depth level is fetched concurrently (4 at a time). The ordering rule
  fixes *which* URLs get fetched, by sorting the level and slicing it to the
  remaining cap before any request goes out. Fetch timing cannot move that
  set, so it cannot move the verdict. 50 sequential curls took 8 minutes.
- the crawl stops as soon as every target has been reached. Their depths are
  already final at that point; continuing only burns the rest of the cap.

Targets are matched case-insensitively with the trailing slash ignored,
because location URLs are exactly where hosts differ on casing and
`/GDANSK/` and `/gdansk/` are one page, not two.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urldefrag, urljoin, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import htmlmini  # noqa: E402

MAX_DEPTH = 3
CAP = 50
LEVEL_CONCURRENCY = 4
UA = "Mozilla/5.0 (compatible; PinMeTo-PresenceScan; +https://www.pinmeto.com)"


def canonical_target(url):
    return url.rstrip("/").lower()


def fetch(url, timeout=40):
    """(status, body). Never raises; a dead URL is a datum, not a crash."""
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()
        except Exception:  # noqa: BLE001 - transport failures of every shape
            if attempt == 2:
                return 0, b""
    return 0, b""


def internal_links(base, body, host):
    doc = htmlmini.parse(body)
    found = set()
    for anchor in doc.find_all("a", {"href": True}):
        absolute = urldefrag(urljoin(base, anchor.get("href")))[0]
        parsed = urlparse(absolute)
        if parsed.scheme in ("http", "https") and parsed.netloc == host:
            found.add(absolute)
    return found


def crawl(start, targets):
    host = urlparse(start).netloc
    wanted = {canonical_target(t) for t in targets}

    depth_of = {start: 0}
    frontier = [start]
    reached = {}
    linking_pages = {}
    fetched = 0
    cap_hit = False
    depth = 0
    stopped_early = False

    while frontier and depth <= MAX_DEPTH:
        level = sorted(frontier)
        remaining = CAP - fetched
        if len(level) > remaining:
            level = level[:remaining]
            cap_hit = True

        with ThreadPoolExecutor(max_workers=LEVEL_CONCURRENCY) as pool:
            responses = list(pool.map(fetch, level))
        fetched += len(level)

        # Merge in the crawl's fixed order, not completion order, so the
        # depth recorded for a URL discovered on two pages is reproducible.
        next_level = set()
        for url, (status, body) in zip(level, responses):
            if not 200 <= status < 300:
                continue
            links = internal_links(url, body, host)
            hits = sorted(link for link in links if canonical_target(link) in wanted)
            if hits:
                linking_pages[url] = hits
            for link in sorted(links):
                if link not in depth_of:
                    depth_of[link] = depth + 1
                    next_level.add(link)
                key = canonical_target(link)
                if key in wanted and key not in reached:
                    reached[key] = {"depth": depth + 1, "url": link, "linkedFrom": url}

        if len(reached) == len(wanted):
            stopped_early = True
            break
        if fetched >= CAP:
            cap_hit = True
            break
        frontier = sorted(next_level)
        depth += 1

    missing = sorted(wanted - set(reached))
    return {
        "start": start,
        "host": host,
        "maxDepth": MAX_DEPTH,
        "cap": CAP,
        "fetched": fetched,
        "capHit": cap_hit,
        "stoppedEarly": stopped_early,
        "deepestLevelFetched": depth,
        "totalUrlsDiscovered": len(depth_of),
        "targets": sorted(wanted),
        "targetsReached": reached,
        "targetsMissing": missing,
        "pagesLinkingToTargets": linking_pages,
        # `seo.internal_linking_depth` ratio = reached within depth 3 / sampled.
        # A target reached at depth 4+ cannot happen here (the crawl stops at
        # 3), so unreached and too-deep are the same outcome, as the check
        # intends.
        "reached": len(reached),
        "sampled": len(wanted),
        "ratio": (len(reached) / len(wanted)) if wanted else None,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--workdir", required=True, help="scan working directory")
    parser.add_argument("--start", required=True, help="homepage URL, depth 0")
    parser.add_argument("--target", action="append", default=[], help="sampled location URL (repeatable)")
    parser.add_argument("--targets-file", help="file of target URLs, one per line")
    args = parser.parse_args(argv)

    targets = list(args.target)
    if args.targets_file:
        with open(args.targets_file) as handle:
            targets += [line.strip() for line in handle if line.strip() and not line.startswith("#")]
    if not targets:
        parser.error("no targets; pass --target or --targets-file")

    result = crawl(args.start, targets)
    out_path = os.path.join(args.workdir, "crawl.json")
    with open(out_path, "w") as handle:
        json.dump(result, handle, indent=1, ensure_ascii=False)

    print(
        f"fetched {result['fetched']} page(s) to depth {result['deepestLevelFetched']}, "
        f"discovered {result['totalUrlsDiscovered']}, cap_hit={result['capHit']}, "
        f"stopped_early={result['stoppedEarly']}"
    )
    for key in result["targets"]:
        hit = result["targetsReached"].get(key)
        print(f"  {key}: depth {hit['depth']} via {hit['linkedFrom']}" if hit else f"  {key}: NOT REACHED")
    print(f"ratio {result['reached']}/{result['sampled']}\n{out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
