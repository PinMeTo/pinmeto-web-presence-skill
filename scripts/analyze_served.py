#!/usr/bin/env python3
"""Served-pass extraction for every HTML page `fetch.sh` pulled down.

    scripts/analyze_served.py --workdir DIR [--keys home,loc_1337] [--host www.brand.com]

Reads DIR/fetch/<key>.{h,b,m} and writes DIR/served.json: one record per page
with the facts Stages 2-3 score against. By default every fetched key whose
content type says HTML is analyzed; `--keys` narrows that.

This is the *served* pass only. Values that appear here earn full credit;
values that show up only after the browser renders the page earn the fixed
half credit in `references/seo-checks.md`. Keeping the two passes in separate
scripts is the point - the moment one script reports "the title is there", the
distinction that half the checks turn on is gone.

Nothing here decides pass or fail. It extracts; `references/*-checks.md` and
the model judge. A field that could not be read is `null`, never a guess.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from urllib.parse import urljoin, urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import htmlmini  # noqa: E402


def read_meta(path):
    """The five tab-separated `-w` fields fetch.sh recorded, or {} if unreadable."""
    try:
        parts = open(path).read().strip("\n").split("\t")
    except OSError:
        return {}
    if len(parts) < 5:
        return {}
    return {
        "status": parts[0],
        "finalUrl": parts[1],
        "contentType": parts[2],
        "bytes": int(parts[3]),
        "redirects": int(parts[4]),
    }


def walk_json(node, out):
    """Every dict anywhere in a JSON-LD document, @graph members included."""
    if isinstance(node, dict):
        out.append(node)
        for value in node.values():
            walk_json(value, out)
    elif isinstance(node, list):
        for value in node:
            walk_json(value, out)


def node_types(node):
    value = node.get("@type")
    if isinstance(value, list):
        return value
    return [value] if value else []


def extract(key, workdir, host):
    fetch_dir = os.path.join(workdir, "fetch")
    body_path = os.path.join(fetch_dir, key + ".b")
    with open(body_path, "rb") as handle:
        body = handle.read()
    try:
        headers = open(os.path.join(fetch_dir, key + ".h"), errors="replace").read()
    except OSError:
        headers = ""
    meta = read_meta(os.path.join(fetch_dir, key + ".m"))
    url = meta.get("finalUrl") or ""
    doc = htmlmini.parse(body)

    record = dict(meta)
    record["key"] = key
    record["sha1"] = hashlib.sha1(body).hexdigest()[:12]

    title = doc.find("title")
    record["title"] = title.get_text() if title else None
    description = doc.find("meta", {"name": "description"})
    record["description"] = description.get("content") if description else None
    canonical = doc.find("link", {"rel": "canonical"})
    record["canonical"] = canonical.get("href") if canonical else None
    record["h1"] = [h.get_text() for h in doc.find_all("h1")]

    record["og"] = {
        m.get("property"): m.get("content")
        for m in doc.find_all("meta", {"property": lambda v: bool(v) and v.startswith("og:")})
    }
    twitter = doc.find("meta", {"name": "twitter:card"})
    record["twitter_card"] = twitter.get("content") if twitter else None

    record["hreflang"] = [
        [link.get("hreflang"), link.get("href")]
        for link in doc.find_all("link", {"rel": "alternate", "hreflang": True})
    ]
    html = doc.find("html")
    record["lang"] = html.get("lang") if html else None
    robots = doc.find("meta", {"name": "robots"})
    record["meta_robots"] = robots.get("content") if robots else None
    # `seo.mobile_friendly` scores this tag directly: no current Lighthouse
    # ships a viewport, tap-targets or font-size audit any more (seo-checks.md).
    viewport = doc.find("meta", {"name": "viewport"})
    record["viewport"] = viewport.get("content") if viewport else None
    # A noindex delivered as a header is invisible in the body but binding all
    # the same, so `seo.robots_allows_locations` has to see it.
    record["x_robots"] = bool(re.search(r"^x-robots-tag:", headers, re.I | re.M))
    record["link_headers"] = re.findall(r"^link:\s*(.+)$", headers, re.I | re.M)

    # role="presentation" marks an image as decorative; alt="" is then correct,
    # so counting it against alt-text coverage would penalize the right answer.
    images = [i for i in doc.find_all("img") if i.get("role") != "presentation"]
    record["img_total"] = len(images)
    record["img_alt"] = sum(1 for i in images if (i.get("alt") or "").strip())

    anchors = set()
    for anchor in doc.find_all("a", {"href": True}):
        absolute = urljoin(url, anchor.get("href")).split("#")[0]
        if urlparse(absolute).netloc == host:
            anchors.add(absolute)
    record["anchors"] = sorted(anchors)

    blocks, nodes, parse_errors = [], [], 0
    for script in doc.find_all("script", {"type": "application/ld+json"}):
        try:
            block = json.loads(script.raw_text())
        except ValueError:
            parse_errors += 1
            continue
        blocks.append(block)
        walk_json(block, nodes)
    record["jsonld_blocks"] = len(blocks)
    record["jsonld_parse_errors"] = parse_errors
    record["jsonld_has_graph"] = any(isinstance(b, dict) and "@graph" in b for b in blocks)
    record["jsonld_types"] = sorted({t for n in nodes for t in node_types(n) if isinstance(t, str)})
    record["jsonld_nodes"] = nodes

    crumb = doc.find(attrs={"aria-label": lambda v: bool(v) and "breadcrumb" in v.lower()}) or doc.find(
        attrs={"class": lambda v: bool(v) and "breadcrumb" in v.lower()}
    )
    record["visible_breadcrumb"] = (
        [item.get_text() for item in crumb.find_all("li")] or [a.get_text() for a in crumb.find_all("a")]
        if crumb
        else None
    )

    main = doc.find("main") or doc.find("body") or doc
    record["first200"] = " ".join(main.get_text().split()[:200])
    return record


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--workdir", required=True, help="scan working directory")
    parser.add_argument("--keys", help="comma-separated fetch keys; default: every HTML response")
    parser.add_argument("--host", help="host that counts as internal for anchors; default: from the first page")
    args = parser.parse_args(argv)

    fetch_dir = os.path.join(args.workdir, "fetch")
    if not os.path.isdir(fetch_dir):
        parser.error(f"no fetch output in {fetch_dir}; run fetch.sh --workdir {args.workdir} first")

    if args.keys:
        keys = [k.strip() for k in args.keys.split(",") if k.strip()]
    else:
        keys = sorted(
            os.path.splitext(name)[0]
            for name in os.listdir(fetch_dir)
            if name.endswith(".b") and "html" in (read_meta(os.path.join(fetch_dir, name[:-2] + ".m")).get("contentType") or "")
        )
    if not keys:
        parser.error("no HTML responses to analyze")

    host = args.host
    if not host:
        first = read_meta(os.path.join(fetch_dir, keys[0] + ".m"))
        host = urlparse(first.get("finalUrl") or "").netloc
    if not host:
        parser.error("could not infer the internal host; pass --host")

    served = {key: extract(key, args.workdir, host) for key in keys}
    out_path = os.path.join(args.workdir, "served.json")
    with open(out_path, "w") as handle:
        json.dump(served, handle, indent=1, ensure_ascii=False)

    for key, record in served.items():
        print(
            f"{key}: {record.get('status')} {record.get('bytes')}B sha={record['sha1']} "
            f"title={record['title']!r} canonical={record['canonical']} h1={record['h1'][:2]} "
            f"lang={record['lang']} jsonld={record['jsonld_types']} graph={record['jsonld_has_graph']} "
            f"hreflang={len(record['hreflang'])} alt={record['img_alt']}/{record['img_total']} "
            f"anchors={len(record['anchors'])} breadcrumb={record['visible_breadcrumb']}"
        )
    print(f"\n{out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
