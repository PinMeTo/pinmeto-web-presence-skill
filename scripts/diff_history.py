#!/usr/bin/env python3
"""The mechanical `checks` diff between the last two scans.

    scripts/diff_history.py --workdir DIR [--history DIR/history.json]

Reads the scan history (the `pmt-scan-history` block's shape: `schema`,
`brand`, `scope`, `scans` oldest first) and writes DIR/diff.json plus a
readable summary. Feeds the trend section of the report.

What this decides and what it does not:

- It decides what **moved**: which check ids changed status or ratio between
  the two most recent scans, and by how much, plus the pillar, overall and
  count deltas.
- It pre-labels every movement `rubric change` when the two scans ran
  different rubric versions, because under a rubric bump that is the default
  explanation and crediting the customer for it is wrong.
- It does **not** decide `measurement correction` versus `real change`. That
  needs the evidence behind both scans, so every movement in a same-rubric
  diff comes back `unclassified` for the model to label.

An id present in one scan and absent from the other is `unknown`, never
movement: an id can be absent because a category-conditional check was
excluded, or because the rubric did not have it yet, and neither is progress.
"""

import argparse
import json
import os
import sys

PILLARS = ("seo", "geo", "aio", "agent_readiness")
# Better and worse, in the order the report reads them.
BETTER = "improved"
WORSE = "regressed"


def classify(previous, current, rubric_changed):
    """('improved'|'regressed', label) for one moved check."""
    direction = BETTER if current["ratio"] > previous["ratio"] else WORSE
    if current["ratio"] == previous["ratio"]:
        # Status moved without the ratio moving: a warn that became a measured
        # fail at the same 0.5, say. Real movement, but not in either
        # direction, so the report must describe it rather than count it.
        direction = "restated"
    return direction, "rubric change" if rubric_changed else "unclassified"


def diff(history):
    scans = history.get("scans") or []
    if len(scans) < 2:
        return {
            "comparable": False,
            "reason": "fewer than two scans in the history; the first scan has nothing to compare against",
            "scans": len(scans),
        }

    previous, current = scans[-2], scans[-1]
    rubric_changed = previous.get("rubricVersion") != current.get("rubricVersion")

    previous_checks = previous.get("checks") or {}
    current_checks = current.get("checks") or {}
    moved, unchanged, unknown = [], [], []

    for check_id in sorted(set(previous_checks) | set(current_checks)):
        before, after = previous_checks.get(check_id), current_checks.get(check_id)
        if before is None or after is None:
            unknown.append({
                "id": check_id,
                "previous": before,
                "current": after,
                "note": "absent from one scan; unknown, not movement",
            })
            continue
        if before["status"] == after["status"] and before["ratio"] == after["ratio"]:
            unchanged.append(check_id)
            continue
        direction, label = classify(before, after, rubric_changed)
        moved.append({
            "id": check_id,
            "direction": direction,
            "label": label,
            "previous": before,
            "current": after,
            "ratioDelta": round(after["ratio"] - before["ratio"], 4),
        })

    moved.sort(key=lambda row: (-abs(row["ratioDelta"]), row["id"]))

    def delta(field, container="pillars"):
        before = (previous.get(container) or {}).get(field)
        after = (current.get(container) or {}).get(field)
        # A null GEO is "not measured", never zero, so a scan on either side
        # of a degraded run has no delta to report.
        if before is None or after is None:
            return None
        return after - before

    return {
        "comparable": True,
        "previous": {"date": previous.get("date"), "label": previous.get("label"), "rubricVersion": previous.get("rubricVersion")},
        "current": {"date": current.get("date"), "label": current.get("label"), "rubricVersion": current.get("rubricVersion")},
        "rubricChanged": rubric_changed,
        "overallDelta": (
            None
            if previous.get("overall") is None or current.get("overall") is None
            else current["overall"] - previous["overall"]
        ),
        "pillarDeltas": {p: delta(p) for p in PILLARS},
        "countDeltas": {c: delta(c, "counts") for c in ("pass", "warn", "fail")},
        "moved": moved,
        "unchanged": unchanged,
        "unknown": unknown,
        "sampleChanged": previous.get("sample") != current.get("sample"),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--workdir", required=True, help="scan working directory")
    parser.add_argument("--history", help="history JSON path; default <workdir>/history.json")
    parser.add_argument("--out", help="diff JSON path; default <workdir>/diff.json")
    args = parser.parse_args(argv)

    history_path = args.history or os.path.join(args.workdir, "history.json")
    out_path = args.out or os.path.join(args.workdir, "diff.json")

    try:
        with open(history_path) as handle:
            history = json.load(handle)
    except OSError as error:
        print(f"diff_history.py: cannot read {history_path}: {error}", file=sys.stderr)
        return 1

    result = diff(history)
    with open(out_path, "w") as handle:
        json.dump(result, handle, indent=1, ensure_ascii=False)

    if not result["comparable"]:
        print(result["reason"])
        print(out_path)
        return 0

    print(f"{result['previous']['date']} -> {result['current']['date']}"
          f"{'  (rubric changed)' if result['rubricChanged'] else ''}")
    print(f"overall {result['overallDelta']:+d}" if result["overallDelta"] is not None else "overall n/a")
    print("pillars " + ", ".join(
        f"{p} {v:+d}" if v is not None else f"{p} n/a" for p, v in result["pillarDeltas"].items()
    ))
    if result["sampleChanged"]:
        print("note: the pinned sample changed between these scans")
    print(f"\n{len(result['moved'])} moved, {len(result['unchanged'])} unchanged, {len(result['unknown'])} unknown")
    for row in result["moved"]:
        print(f"  {row['direction']:>9}  {row['id']}  "
              f"{row['previous']['status']} {row['previous']['ratio']} -> "
              f"{row['current']['status']} {row['current']['ratio']}  [{row['label']}]")
    for row in result["unknown"]:
        print(f"    unknown  {row['id']}  ({'new in this scan' if row['previous'] is None else 'absent from this scan'})")
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
