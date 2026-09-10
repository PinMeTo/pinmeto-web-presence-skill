# scripts/

The deterministic half of a scan. `SKILL.md` rule 1 says scripts beat any
model; these are those scripts. Re-authoring them from the prose in
`references/` cost about 25 minutes of every run and let the arithmetic come
out slightly differently each time.

Everything is Python 3 or bash from the standard library. There is nothing to
install: the served-HTML parsing runs on `html.parser` through the small
`htmlmini.py` in this directory, because `beautifulsoup4` and `lxml` are not
present on a stock Mac running Claude Code and an install step that fails
halfway through a scan is worse than a parser we control.

Every script takes `--workdir DIR` and reads and writes only inside it. No
script contains a brand, a URL or a host path.

| Script | Stage | Reads | Writes |
| --- | --- | --- | --- |
| `fetch.sh` | 2–3 | `fetch-list*.txt` | `fetch/<key>.{h,b,m,err}` |
| `analyze_served.py` | 2–3 | `fetch/` | `served.json` |
| `crawl.py` | 2 | the live site | `crawl.json` |
| `score.py` | 5 | `results.json`, `references/` | `scores.json` |
| `diff_history.py` | 6 | `history.json` | `diff.json` |
| `check-references.mjs` | pre-publish | `references/`, `SKILL.md` | exit status |

A scan runs them in that order:

```bash
W=/tmp/scan-brand && mkdir -p "$W"
# …write $W/fetch-list.txt from the sample and the site's URLs…
scripts/fetch.sh          --workdir "$W"
scripts/analyze_served.py --workdir "$W"
scripts/crawl.py          --workdir "$W" --start https://www.brand.com/ --targets-file "$W/targets.txt"
# …the model assembles $W/results.json from served.json, crawl.json and Stage 4…
scripts/score.py          --workdir "$W" --label "Third scan"
scripts/diff_history.py   --workdir "$W"
```

The gap in the middle is deliberate. Deciding whether
`Karhumäkivägen 3, Vanda` and `Karhumäentie 3, Vantaa` are the same address is
a normalization judgment, and `SKILL.md` rule 3 keeps those on the primary
model. The scripts extract and compute; `results.json` is where the model's
judgments enter.

## The `results.json` contract

`score.py` reads it, and the renderer reads it alongside `scores.json`, so it
is the one shape both must agree on. Statuses are `pass` / `warn` / `fail` and
every ratio is `1`, `0.5` or `0` unless the check id appears in the rubric's
`gradient_checks`.

```jsonc
{
  "scanDate": "2026-09-07",        // ISO date; becomes the history entry's date
  "brand": "pinmeto.com",
  "scope": null,                   // or { "label": "Sweden", "filters": { "country": "Sweden" } }
  "label": "Third scan",           // history label; --label overrides it

  // Every SEO, AIO and Agent Readiness check in the rubric, exactly once.
  // A missing id is an error, not a zero: score.py names it and exits 1.
  "checks": [
    {
      "id": "seo.meta_title_unique",
      "status": "fail",
      "ratio": 0.5,
      "result": "Rendered only · half credit",   // the accordion's short label
      "name": "Titles are unique only after hydration",
      "why": "…",                                 // HTML allowed; the report escapes it
      "cost": "…",                                // what it costs the brand, marketer voice
      "evidence": [{ "url": "…", "note": "…" }],
      "fixSteps": ["…"],                          // failing checks only
      "agentPrompt": "Goal: …\nIssue: …",         // failing checks only
      "skillLinks": [], "docLinks": [], "xref": []
    }
  ],

  // The pinned sample, in its recorded order. Re-runs reuse it verbatim.
  "sample": ["1337", "171206", "666", "GDANSK", "MUMBAI"],
  "names": { "1337": "Malmö" },                              // display names
  "pages": { "1337": "https://www.pinmeto.com/locations/1337/" },

  // geo.location_platform_parity: brand-wide, one value for the whole scan.
  "parity": 0,

  // Stage 4, per location x platform.
  "geoObs": {
    "1337": {
      "google": {
        "lookup": "observed",        // observed | not_found | unobserved
        "pinDistanceM": 0,
        "connectedDowngraded": false,
        "geo.listing_connected_pinmeto": 1,
        "geo.name_matches_site": 1
        // …one key per id in the rubric's applicable_checks for this platform
      },
      "apple": { "lookup": "not_found" },
      "bing":  { "lookup": "observed", "…": 1 }
    }
  },

  // Stage 4, sub-group C: the landing page against the dominant platform
  // answer (majority across Google/Apple/Bing, Google wins ties).
  "pageObs": {
    "1337": {
      "dominant": "google",          // null when no platform was observed
      "page.jsonld_name_matches_dominant": 1,
      "page.jsonld_telephone_matches_dominant": 1,
      "page.jsonld_geo_within_50m_dominant": 1,
      "page.opening_hours_matches_dominant": 1,
      "page.visible_nap_matches_dominant": 1
    }
  },

  // Which rung of the seo.lcp_sample engine ladder measured this scan:
  // "psi", "psi-web", or null when neither was available. Omit it and the
  // history entry omits it too. Copied into the entry verbatim.
  "lcpEngine": "psi-web",

  // Measurement corrections and exclusions discovered about *this* scan.
  // Copied into the history entry verbatim.
  "notes": ["geo.menu_order_reservations excluded: …"]
}
```

### The three lookup states, and why they are not two

`geoObs[<storeId>][<platform>].lookup` drives everything in GEO:

- **`observed`** — we read the listing. Every id in that platform's
  `applicable_checks` must carry a value.
- **`not_found`** — we looked and the listing is not there. A measured
  absence: the platform scores 0 across its applicable checks for that
  location, and the location is excluded from sub-group B.
- **`unobserved`** — we never looked (no browser, consent wall, quota). The
  platform scores 0.5 across its applicable checks, because claiming a
  listing is missing on evidence we do not have publishes a fix brief for a
  problem that may not exist.

Two refinements the scorer applies:

- On an `unobserved` platform, an id whose value **is** recorded keeps it.
  That is `SKILL.md`'s no-browser path: `geo.listing_connected_pinmeto` and
  `geo.special_hours_set` still score from the PinMeTo record with no map
  surface at all, while everything needing the map stays at 0.5.
- `geo.location_platform_parity` never takes the fallback. It is brand-wide
  and only borrows a slot in the Google column, so it always reads the
  top-level `parity` value — an unread Google listing must not soften a
  parity failure measured elsewhere.

Inside an `observed` platform, a value of `0.5` means *we could not read this
field* (the photo grid did not load, the About tab was blocked). Those
observations return no points and, if every observation of a check id is one,
make that id's rollup `warn`.

### What `score.py` writes

`scores.json` carries `pillars` and `pillarsRounded`, `overall` /
`overallExact` / `grade`, the GEO sub-groups with per-location and
per-platform detail, the section 4b `rollups`, `points` per check id,
`warnPoints` and `warnIds` for the points bar, the ranked `themes`, and
`entry` — the history block entry, ready to append to `scans`.

`pillars.geo` is `null` and `geoUnmeasured` is `true` in exactly one case:
every sampled lookup came back `unobserved`. An all-`not_found` run is
measured and scores normally, at or near zero. Confusing the two prints a
mid-50s GEO for listings nobody looked at, under a PinMeTo logo.

## Reproducing a known scan

`tests/fixtures/results-2026-09-07.json` is the third pinmeto.com scan, and
`tests/scoring.test.mjs` asserts the numbers it must produce: SEO 42.75,
GEO 79.80 (A 67.82 / B 90 / C 100), AIO 84.97, Agent Readiness 96.67, overall
72.51 → 73, grade C, seven Themes with worth. Run it directly with:

```bash
python3 scripts/score.py --workdir tests/fixtures --results tests/fixtures/results-2026-09-07.json --out /tmp/scores.json
```

The fixture is that scan's `results.json` with `pageObs`, `notes` and `label`
backfilled: the original predates those keys, and the sub-group C values are
the ones that run measured (all five fields matched at all five locations),
read off the workspace's `rendered/*.json` against `geo/*.json`.
