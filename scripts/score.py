#!/usr/bin/env python3
"""The scoring arithmetic, exactly as `references/scoring.md` specifies it.

    scripts/score.py --workdir DIR [--refs references/] [--label "Third scan"]

Reads DIR/results.json (contract in scripts/README.md), writes DIR/scores.json,
and prints the pillar scores, GEO sub-groups, counts and ranked Themes.

Nothing here is a judgment call. Every input is a `pass`/`warn`/`fail` and a
ratio the model already decided; this turns them into pillar scores, points
returned, Theme worth and a history entry the same way every time. That is the
whole reason it is a script: given the same results, two runs that disagree on
the overall score are a bug, not a difference of opinion.

The rubric and the Theme mapping are read out of the reference Markdown rather
than restated here, and the script refuses to run if their pinned versions
disagree - a Theme mapping written for an older rubric silently drops or
double-counts check ids.
"""

import argparse
import json
import math
import os
import re
import sys

PILLARS = ("seo", "geo", "aio", "agent_readiness")
SITE_PILLARS = ("seo", "aio", "agent_readiness")
PLATFORMS = ("google", "apple", "bing")

# `geo.location_platform_parity` is a brand-wide result that borrows a slot in
# the Google column. It is exempt from the per-platform lookup fallback: an
# unobserved Google listing must not soften a parity failure measured on Apple
# and Bing evidence (scoring.md section 2).
PARITY = "geo.location_platform_parity"

# Sub-group weights inside GEO, and the reweights scoring.md fixes for the
# cases where a sub-group has no qualifying location.
GEO_WEIGHTS = {"a": 0.55, "b": 0.25, "c": 0.20}
GEO_WITHOUT_B = {"a": 0.733, "c": 0.267}
GEO_WITHOUT_C = {"a": 0.688, "b": 0.312}
# GEO could not be observed at all: the other three pillars carry the overall.
PILLARS_WITHOUT_GEO = {"seo": 0.43, "aio": 0.357, "agent_readiness": 0.214}

B_FIELDS = (
    ("consistency.name", "geo.name_matches_site", 0.35),
    ("consistency.address", "geo.address_matches_site", 0.35),
    ("consistency.coords_50m_cluster", "geo.coords_within_50m", 0.30),
)
C_FIELDS = (
    "page.jsonld_name_matches_dominant",
    "page.jsonld_telephone_matches_dominant",
    "page.jsonld_geo_within_50m_dominant",
    "page.opening_hours_matches_dominant",
    "page.visible_nap_matches_dominant",
)


class ScoreError(Exception):
    """A malformed input. Always names the id or location at fault."""


def round_half_up(value):
    """scoring.md section 2: never a language's default rounding.

    Python's round() is banker's: round(22.5) == 22 where JS gives 23. A
    report whose hero said 22 and whose history said 23 is how we found out.
    """
    return math.floor(value + 0.5)


def json_block(markdown, must_contain=None):
    """The first ```json block in a reference file, optionally the one with a key."""
    for match in re.finditer(r"```json\n(.*?)\n```", markdown, re.S):
        text = match.group(1)
        if must_contain and must_contain not in text:
            continue
        return json.loads(text)
    raise ScoreError(f"no JSON block{f' containing {must_contain!r}' if must_contain else ''} in the reference")


def load_references(refs_dir):
    rubric = json_block(open(os.path.join(refs_dir, "rubric.md")).read())
    themes = json_block(
        open(os.path.join(refs_dir, "artifact-report.md")).read(),
        must_contain="theme_mapping_for_rubric_version",
    )
    if themes["theme_mapping_for_rubric_version"] != rubric["rubric_version"]:
        raise ScoreError(
            "rubric and Theme mapping disagree: rubric.md is "
            f"{rubric['rubric_version']}, artifact-report.md is pinned to "
            f"{themes['theme_mapping_for_rubric_version']}"
        )
    return rubric, themes


def grade_for(overall, thresholds):
    for letter in ("A", "B", "C", "D"):
        if overall >= thresholds[letter]:
            return letter
    return "F"


def observation_value(check_id, observation, parity):
    """One observation's effective ratio, or None when it is unmeasurable.

    scoring.md section 2's tri-state:
      observed    - the recorded value
      not_found   - 0 across the platform's applicable checks; a measured
                    absence, not an evidence gap
      unobserved  - 0.5, because we never looked and cannot claim the listing
                    is missing. An id explicitly recorded on an unobserved
                    platform still wins: SKILL.md's no-browser path scores
                    geo.listing_connected_pinmeto and geo.special_hours_set
                    from PinMeTo data even with no map surface.
    """
    if check_id == PARITY:
        return float(parity)
    lookup = observation.get("lookup")
    if lookup == "not_found":
        return 0.0
    if lookup == "unobserved":
        recorded = observation.get(check_id)
        return float(recorded) if recorded is not None else 0.5
    if lookup != "observed":
        raise ScoreError(f"unknown lookup state {lookup!r} (expected observed/not_found/unobserved)")
    if check_id not in observation:
        raise ScoreError(f"observed platform is missing a value for {check_id}")
    return float(observation[check_id])


def is_evidence_gap(check_id, observation):
    """True when this observation measured nothing.

    Feeds the section 4b rule that a rolled-up GEO check is `warn` only when
    *every* contributing observation was unmeasurable, and the section 4 rule
    that a warn returns no points.
    """
    if check_id == PARITY:
        return False
    if observation.get("lookup") == "unobserved":
        return observation.get(check_id) is None
    return observation.get("lookup") == "observed" and observation.get(check_id) == 0.5


def score_site_pillars(rubric, by_id):
    pillars = {}
    for pillar in SITE_PILLARS:
        total = 0.0
        for check in rubric["pillars"][pillar]["checks"]:
            result = by_id.get(check["id"])
            if result is None:
                raise ScoreError(f"results.json has no result for {check['id']}")
            total += check["weight"] * float(result["ratio"])
        pillars[pillar] = total
    return pillars


def score_geo(rubric, results):
    """GEO sub-groups A, B and C, plus everything the report needs to show them."""
    config = rubric["pillars"]["geo"]["sub_groups"]
    a_config = config["a_per_platform"]
    platform_weight = {k: v / 100 for k, v in a_config["platform_weights"].items()}
    # These lists ARE the sub-group A denominator. A category-conditional check
    # that does not apply is absent from them, which shrinks the denominator
    # rather than scoring zero.
    applicable = {k: v for k, v in a_config["applicable_checks"].items() if isinstance(v, list)}

    sample = results["sample"]
    observations = results["geoObs"]
    parity = results["parity"]
    if not sample:
        raise ScoreError("results.json has an empty sample")

    # -- A: per platform, per location
    location_scores, platform_scores = {}, {}
    for store_id in sample:
        if store_id not in observations:
            raise ScoreError(f"no geoObs for sampled location {store_id}")
        per_platform = {}
        for platform in PLATFORMS:
            ids = applicable[platform]
            observation = observations[store_id][platform]
            per_platform[platform] = sum(
                observation_value(cid, observation, parity) for cid in ids
            ) / len(ids)
        platform_scores[store_id] = per_platform
        location_scores[store_id] = sum(platform_weight[p] * per_platform[p] for p in PLATFORMS)
    a_score = sum(location_scores.values()) / len(sample) * 100

    # -- B: consistency against the PinMeTo record, observed platforms only
    b_values, b_fields = {}, {field: [] for field, _, _ in B_FIELDS}
    for store_id in sample:
        observed = [p for p in PLATFORMS if observations[store_id][p].get("lookup") == "observed"]
        if len(observed) < 2:
            continue  # nothing to compare; scoring.md excludes the location
        total = 0.0
        for field, check_id, share in B_FIELDS:
            # An observation of 0.5 measured nothing, so it is neither a match
            # nor a deviation; only a recorded 0 deviates from the record.
            deviating = sum(1 for p in observed if observations[store_id][p].get(check_id) == 0)
            value = 1.0 if deviating == 0 else (0.5 if deviating == 1 else 0.0)
            b_fields[field].append(value)
            total += share * value
        b_values[store_id] = total
    b_score = (sum(b_values.values()) / len(b_values) * 100) if b_values else None

    # -- C: the landing page against the dominant platform answer
    page_obs = results.get("pageObs") or {}
    c_values, c_fields = {}, {field: [] for field in C_FIELDS}
    for store_id in sample:
        record = page_obs.get(store_id)
        # No observed platform means no dominant answer to compare the page
        # against, whether the lookups came back not_found or never ran. The
        # lookup states decide that, not the recorded `dominant`: a stale
        # dominant left in the input would otherwise score a location whose
        # listings nobody read.
        any_observed = any(observations[store_id][p].get("lookup") == "observed" for p in PLATFORMS)
        if not record or not any_observed or record.get("dominant") is None:
            continue
        values = []
        for field in C_FIELDS:
            if field not in record:
                raise ScoreError(f"pageObs[{store_id}] is missing {field}")
            values.append(float(record[field]))
            c_fields[field].append(float(record[field]))
        c_values[store_id] = sum(values) / len(values)
    c_score = (sum(c_values.values()) / len(c_values) * 100) if c_values else None

    # -- combine, reweighting around whichever sub-group had no qualifying location
    if b_score is None and c_score is None:
        geo, weights = a_score, {"a": 1.0}
    elif b_score is None:
        weights = GEO_WITHOUT_B
        geo = weights["a"] * a_score + weights["c"] * c_score
    elif c_score is None:
        weights = GEO_WITHOUT_C
        geo = weights["a"] * a_score + weights["b"] * b_score
    else:
        weights = GEO_WEIGHTS
        geo = weights["a"] * a_score + weights["b"] * b_score + weights["c"] * c_score

    return {
        "score": geo,
        "A": a_score,
        "B": b_score,
        "C": c_score,
        "weights": weights,
        "locationScores": location_scores,
        "platformScores": platform_scores,
        "bValues": b_values,
        "bFields": b_fields,
        "cValues": c_values,
        "cFields": c_fields,
        "applicable": applicable,
        "platformWeight": platform_weight,
    }


def geo_rollups(results, geo):
    """Section 4b: one value per GEO check id, for history and the trend diff.

    A reporting rollup across observations, never a check ratio - GEO is
    scored only by the A/B/C arithmetic above.
    """
    sample, observations, parity = results["sample"], results["geoObs"], results["parity"]
    rollups = {}
    for check_id in sorted({cid for ids in geo["applicable"].values() for cid in ids}):
        values, gaps = [], []
        for store_id in sample:
            for platform in PLATFORMS:
                if check_id not in geo["applicable"][platform]:
                    continue
                observation = observations[store_id][platform]
                values.append(observation_value(check_id, observation, parity))
                gaps.append(is_evidence_gap(check_id, observation))
        mean = sum(values) / len(values)
        status = "pass" if mean >= 0.8 else ("warn" if all(gaps) else "fail")
        rollups[check_id] = {"status": status, "ratio": round(mean, 4), "n": len(values), "sum": sum(values)}

    for field, values in list(geo["bFields"].items()) + list(geo["cFields"].items()):
        if not values:
            continue
        mean = sum(values) / len(values)
        rollups[field] = {
            "status": "pass" if mean >= 0.8 else "fail",
            "ratio": round(mean, 4),
            "n": len(values),
            "sum": sum(values),
        }
    return rollups


def points_returned(rubric, results, by_id, geo):
    """Section 4: how much of the overall score each failing check gives back.

    Also totals the points held by `warn` checks - measured by nobody, so
    unearned but not yet a known problem. The report's points bar draws them
    as a separate dotted segment rather than folding them into either side.
    """
    pillar_weights = rubric["pillar_weights"]
    points = {}

    for pillar in SITE_PILLARS:
        for check in rubric["pillars"][pillar]["checks"]:
            result = by_id[check["id"]]
            points[check["id"]] = (
                check["weight"] * (1 - float(result["ratio"])) * pillar_weights[pillar] / 100
                if result["status"] == "fail"
                else 0.0
            )

    sample, observations, parity = results["sample"], results["geoObs"], results["parity"]
    geo_weight = pillar_weights["geo"] / 100
    a_weight = geo["weights"].get("a", 0.0)

    # A sub-group A observation's effective weight in overall-score points:
    # (1 / the platform's applicable-check count) x platform weight x the
    # sub-group's weight x the pillar's weight, averaged over the sample.
    for check_id in sorted({cid for ids in geo["applicable"].values() for cid in ids}):
        total = 0.0
        for store_id in sample:
            for platform in PLATFORMS:
                if check_id not in geo["applicable"][platform]:
                    continue
                observation = observations[store_id][platform]
                if is_evidence_gap(check_id, observation):
                    continue  # a warn returns nothing; it is not a known failure
                value = observation_value(check_id, observation, parity)
                share = 1 / len(geo["applicable"][platform])
                total += (1 - value) * share * geo["platformWeight"][platform] * a_weight * geo_weight * 100 / len(sample)
        points[check_id] = total

    b_weight = geo["weights"].get("b", 0.0)
    for field, _, share in B_FIELDS:
        values = geo["bFields"][field]
        if not values:
            points[field] = 0.0
            continue
        mean = sum(values) / len(values)
        points[field] = (1 - mean) * share * b_weight * geo_weight * 100

    c_weight = geo["weights"].get("c", 0.0)
    for field in C_FIELDS:
        values = geo["cFields"][field]
        if not values:
            points[field] = 0.0
            continue
        mean = sum(values) / len(values)
        points[field] = (1 - mean) * (1 / len(C_FIELDS)) * c_weight * geo_weight * 100

    warn_points, warn_ids = 0.0, []
    for pillar in SITE_PILLARS:
        for check in rubric["pillars"][pillar]["checks"]:
            if by_id[check["id"]]["status"] == "warn":
                warn_points += check["weight"] * 0.5 * pillar_weights[pillar] / 100
                warn_ids.append(check["id"])
    for check_id in sorted({cid for ids in geo["applicable"].values() for cid in ids}):
        for store_id in sample:
            for platform in PLATFORMS:
                if check_id not in geo["applicable"][platform]:
                    continue
                if not is_evidence_gap(check_id, observations[store_id][platform]):
                    continue
                share = 1 / len(geo["applicable"][platform])
                warn_points += 0.5 * share * geo["platformWeight"][platform] * a_weight * geo_weight * 100 / len(sample)
                if check_id not in warn_ids:
                    warn_ids.append(check_id)

    return points, warn_points, warn_ids


def rank_themes(themes, points, by_id, rollups):
    rows = []
    for theme in themes["themes"]:
        members = []
        for check_id in theme["checks"]:
            if check_id in by_id:
                status = by_id[check_id]["status"]
            elif check_id in rollups:
                status = rollups[check_id]["status"]
            else:
                # Category-conditional and excluded for every sampled location:
                # it produced no result, so it is neither warn nor fail.
                status = None
            members.append({"id": check_id, "status": status, "points": points.get(check_id, 0.0)})
        rows.append({**theme, "worth": sum(points.get(i, 0.0) for i in theme["checks"]), "members": members})
    # Slug breaks ties so two Themes worth the same amount never swap order
    # between runs and read as movement in the trend.
    rows.sort(key=lambda row: (-row["worth"], row["slug"]))
    return rows


def score(results, rubric, themes, label=None):
    by_id = {c["id"]: c for c in results["checks"]}
    pillars = score_site_pillars(rubric, by_id)
    geo = score_geo(rubric, results)

    # scoring.md: if every sampled lookup came back unobserved, GEO is "Not
    # measured" and drops out of the overall. An all-not_found run is measured
    # and must score normally, so this tests the lookup states, not the score.
    lookups = [
        results["geoObs"][s][p].get("lookup") for s in results["sample"] for p in PLATFORMS
    ]
    geo_unmeasured = all(state == "unobserved" for state in lookups)

    if geo_unmeasured:
        pillars["geo"] = None
        weights = PILLARS_WITHOUT_GEO
        overall_exact = sum(weights[p] * pillars[p] for p in SITE_PILLARS)
    else:
        pillars["geo"] = geo["score"]
        weights = {k: v / 100 for k, v in rubric["pillar_weights"].items()}
        overall_exact = sum(weights[p] * pillars[p] for p in PILLARS)

    overall = round_half_up(overall_exact)
    grade = grade_for(overall, rubric["grade_thresholds"])

    rollups = geo_rollups(results, geo)
    points, warn_points, warn_ids = points_returned(rubric, results, by_id, geo)
    theme_rows = rank_themes(themes, points, by_id, rollups)

    history_checks = {c["id"]: {"status": c["status"], "ratio": round(float(c["ratio"]), 4)} for c in results["checks"]}
    for check_id, rollup in rollups.items():
        history_checks[check_id] = {"status": rollup["status"], "ratio": rollup["ratio"]}
    counts = {
        state: sum(1 for v in history_checks.values() if v["status"] == state)
        for state in ("pass", "warn", "fail")
    }

    entry = {
        "date": results["scanDate"],
        "rubricVersion": rubric["rubric_version"],
        "label": label or results.get("label") or "Scan",
        "overall": overall,
        "grade": grade,
        "pillars": {p: (None if pillars[p] is None else round_half_up(pillars[p])) for p in PILLARS},
        "counts": counts,
        "sample": results["sample"],
        "checks": history_checks,
    }
    # Which rung of the seo.lcp_sample engine ladder measured this scan, so a
    # later scan knows what it is comparing against (seo-checks.md). Absent
    # means a scan from before the ladder existed; explicit null means neither
    # rung was available.
    if "lcpEngine" in results:
        entry["lcpEngine"] = results["lcpEngine"]
    notes = list(results.get("notes") or [])
    if geo_unmeasured:
        notes.append(
            "Degraded scan: every sampled map lookup was unobserved, so GEO is not measured "
            "and the overall covers three pillars."
        )
    if notes:
        entry["notes"] = notes

    return {
        "pillars": pillars,
        "pillarsRounded": entry["pillars"],
        "overall": overall,
        "overallExact": overall_exact,
        "grade": grade,
        "geoUnmeasured": geo_unmeasured,
        "geo": {
            "A": geo["A"],
            "B": geo["B"],
            "C": geo["C"],
            "weights": geo["weights"],
            "locationScores": geo["locationScores"],
            "platformScores": geo["platformScores"],
            "bValues": geo["bValues"],
            "cValues": geo["cValues"],
        },
        "rollups": rollups,
        "points": points,
        "warnPoints": warn_points,
        "warnIds": warn_ids,
        "themes": theme_rows,
        "counts": counts,
        "entry": entry,
    }


def main(argv=None):
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--workdir", required=True, help="scan working directory holding results.json")
    parser.add_argument("--refs", default=os.path.join(os.path.dirname(here), "references"), help="references directory")
    parser.add_argument("--label", help="history label for this scan, e.g. 'Third scan'")
    parser.add_argument("--results", help="results.json path; default <workdir>/results.json")
    parser.add_argument("--out", help="scores.json path; default <workdir>/scores.json")
    args = parser.parse_args(argv)

    results_path = args.results or os.path.join(args.workdir, "results.json")
    out_path = args.out or os.path.join(args.workdir, "scores.json")

    try:
        rubric, themes = load_references(args.refs)
        with open(results_path) as handle:
            results = json.load(handle)
        scored = score(results, rubric, themes, label=args.label)
    except ScoreError as error:
        print(f"score.py: {error}", file=sys.stderr)
        return 1

    with open(out_path, "w") as handle:
        json.dump(scored, handle, indent=1, ensure_ascii=False)

    pillars = {k: (None if v is None else round(v, 2)) for k, v in scored["pillars"].items()}
    print(f"pillars {pillars}")
    print(f"overall {round(scored['overallExact'], 2)} -> {scored['overall']} grade {scored['grade']}")
    geo = scored["geo"]
    print(
        f"GEO A/B/C {round(geo['A'], 2)} / "
        f"{'excluded' if geo['B'] is None else round(geo['B'], 2)} / "
        f"{'excluded' if geo['C'] is None else round(geo['C'], 2)}"
    )
    print(f"counts {scored['counts']}  warn points {round(scored['warnPoints'], 2)}")
    for theme in scored["themes"]:
        failing = [m["id"] for m in theme["members"] if m["status"] == "fail"]
        print(f"{theme['worth']:6.2f}  {theme['slug']}  fail={failing}")
    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
