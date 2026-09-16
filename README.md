# PinMeTo Web Presence skill

A host-aware skill for Claude (and ChatGPT/Codex) that audits and **monitors** a multi-location
brand's online findability across four pillars: **SEO**, **GEO** (real Google, Apple, and Bing
Maps listings, checked in a browser), **AI visibility (AIO)**, and **Agent Readiness**. It
scores the brand against the PinMeTo MLPR rubric and produces an updatable, two-layer
Presence Report. Layer 1 is written for a marketer: score, trend, and a ranked list of
**Themes**, each one plain-language issue that one fix and one owner resolve. The full audit
(every check row, the location breakdown, the NAP matrix) sits one click away behind a "Full
audit detail" expander. The report keeps its own scan history for trends and can be set up as
a recurring scan.

![Example Presence Report for pinmeto.com: score 71 of 100, four pillar scores, the points bar, the trend since the first scan, and the ranked Themes](docs/images/report-example.png)

Every report carries an AI notice in its footer: generated with AI from automated checks of
public signals, it can make mistakes, and it is provided as is, without warranty. The scores
show where to improve visibility, not rankings PinMeTo guarantees.

## The rubric

Scoring follows rubric **2.15.0-skill.1**, a skill-line fork of the PinMeTo MLPR product
rubric v2.8.0 (in `pinmeto-www-reports`) that re-adds Bing as a scored GEO platform and adds
a PinMeTo-connection check. SEO, AIO and Agent Readiness are scored identically to the
product.

- [`docs/rubric.md`](docs/rubric.md) is the readable version: every check with its weight,
  what it looks for, when it passes, and which Theme it belongs to. Generated from the
  contract below, so it is always current.
- [`references/rubric.md`](references/rubric.md) is the scoring contract the scan runs, with
  the version history. It is the authority when the two disagree.

## Distribution

The skill ships inside the **PinMeTo Locations** plugin
([`PinMeTo/claude-plugins`](https://github.com/PinMeTo/claude-plugins)), alongside the
Location Reports skill. It calls the PinMeTo Location MCP tools, so it needs that server (the
`.mcpb` Desktop Extension, or the npm package in Claude Code) connected at run time.

The plugin's registry (`plugins/pinmeto-locations/components.json`) pins this skill by
version:

```json
"pinmeto-web-presence": { "repo": "PinMeTo/pinmeto-web-presence-skill", "version": "0.16.2" }
```

Every `vX.Y.Z` tag here builds the `.skill` archive and, when the `MARKETPLACE_DISPATCH_TOKEN`
secret is configured, notifies the marketplace, which vendors the new version and bumps the
plugin. Without the secret, run the marketplace's "Sync plugin artifacts" workflow by hand
(see Releasing).

## Layout

| Path | What |
| --- | --- |
| `SKILL.md` | The skill: triggers, workflow, output contract |
| `references/` | Progressive-disclosure detail: vendored rubric, per-pillar check procedures, scoring, report spec, monitoring |
| `scripts/` | The deterministic half of a scan (fetch, parse, crawl, score, diff) plus the reference checker and the rubric-page renderer. See `scripts/README.md` |
| `assets/` | The PinMeTo logo the report embeds |
| `tests/` | Node test suite for the scripts and the reference checker (`node --test 'tests/*.test.mjs'`) |
| `docs/` | The readable rubric page, design specs, ADRs, dogfood test runs, and the README screenshot. Not shipped |
| `CHANGELOG.md` | Skill releases. `references/rubric.md` stays authoritative for scoring changes |
| `LICENSE` | Proprietary license, shipped with the skill |
| `package-skill.sh` | Builds the distributable `pinmeto-web-presence-<version>.skill` archive |
| `.github/workflows/check-references.yml` | On every push and PR: runs the tests and checks that the shipped references agree with each other |
| `.github/workflows/release.yml` | On a `vX.Y.Z` tag: package, release, and notify the marketplace to sync |

## Working on the skill

```bash
node --test 'tests/*.test.mjs'       # unit tests
node scripts/check-references.mjs    # do the shipped files agree with each other?
node scripts/render-rubric.mjs       # regenerate docs/rubric.md after a rubric change
```

The reference checker fails when the skill version and the changelog disagree, when the
Theme mapping and the rubric drift apart, when the report contract loses a section, or when
`docs/rubric.md` is stale. CI runs it on every push.

## Releasing

1. Bump `version:` in `SKILL.md`, and add the entry to `CHANGELOG.md`. If the change moves
   scores, bump `rubric_version` in `references/rubric.md` too and record what moved there:
   the re-run attribution rule cannot separate rubric drift from real customer progress
   unless the version moved with the rules. Regenerate `docs/rubric.md`.
2. Tag and push: `git tag v0.16.2 && git push --tags`.
3. `release.yml` packages the `.skill`, attaches it to a GitHub release, and sends a
   `skill-released` `repository_dispatch` (with `skill_name: pinmeto-web-presence`) to the
   marketplace.

**Required secret:** `MARKETPLACE_DISPATCH_TOKEN`, a token permitted to send
`repository_dispatch` to `PinMeTo/claude-plugins`. Without it, the release still builds but the
marketplace won't auto-sync; run the marketplace's "Sync plugin artifacts" workflow by hand.

## Status

`v0.16.2` on rubric 2.15.0-skill.1. Four-pillar methodology; GEO evidence via real map
surfaces in a browser (no Places API / MapKit); host-native updatable report with embedded
scan history, rendered as the two-layer Presence Report; the deterministic half of a scan
shipped as scripts; PageSpeed measured on the API-key / `pagespeed.web.dev` / standing-`warn`
ladder. Refine against real audits before v1.

## License

Proprietary. © PinMeTo AB. See [LICENSE](LICENSE).
