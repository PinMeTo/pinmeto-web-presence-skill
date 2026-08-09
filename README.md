# PinMeTo Web Presence skill

A Claude skill that audits and **monitors** a multi-location brand's online findability across
four pillars — **SEO**, **GEO** (real Google, Apple, and Bing Maps listings, checked in a
browser), **AI visibility (AIO)**, and **Agent Readiness** — scored against the PinMeTo MLPR
rubric (v2.9.0-skill.1, a skill-line fork of the v2.8.0 rubric in `pinmeto-www-reports` that re-adds Bing and adds a PinMeTo-connection check). It produces an updatable HTML report
artifact in the approved Presence Report design that keeps its own scan history for trends,
and can be set up as a recurring scheduled scan.

It is distributed as part of the **PinMeTo Locations** plugin
([`PinMeTo/claude-plugins`](https://github.com/PinMeTo/claude-plugins)), alongside the
Location Reports skill. It calls the PinMeTo Location MCP tools, so it needs that server (the
`.mcpb` Desktop Extension, or the npm package in Claude Code) connected at run time.

## Layout

| Path | What |
| --- | --- |
| `SKILL.md` | The skill: triggers, workflow, output contract |
| `references/` | Progressive-disclosure detail (vendored rubric, per-pillar check procedures, scoring, report spec, monitoring) |
| `package-skill.sh` | Builds the distributable `pinmeto-web-presence-<version>.skill` archive |
| `.github/workflows/release.yml` | On a `vX.Y.Z` tag: package, release, and notify the marketplace to sync |

## Releasing

1. Bump `version:` in `SKILL.md`.
2. Tag and push: `git tag v0.4.0 && git push --tags`.
3. `release.yml` packages the `.skill`, attaches it to a GitHub release, and sends a
   `skill-released` `repository_dispatch` (with `skill_name: pinmeto-web-presence`) to the
   marketplace.

**Required secret:** `MARKETPLACE_DISPATCH_TOKEN` — a token permitted to send
`repository_dispatch` to `PinMeTo/claude-plugins`. Without it, the release still builds but the
marketplace won't auto-sync.

## Wiring it into the plugin (one-time)

Before the marketplace will vendor this skill, add it to the registry in `claude-plugins`
(`plugins/pinmeto-locations/components.json`):

```json
{
  "skills": {
    "pinmeto-location-reports": { "repo": "PinMeTo/pinmeto-location-reports-skill", "version": "1.2.0" },
    "pinmeto-web-presence":     { "repo": "PinMeTo/pinmeto-web-presence-skill",     "version": "0.4.0" }
  }
}
```

That registry PR carries its own plugin version bump (adding a skill is a minor). After it
lands, every future `vX.Y.Z` tag here syncs automatically.

## Status

`v0.4.0` — four-pillar methodology on rubric 2.9.0-skill.1 (MLPR 2.8.0 + Bing re-added + PinMeTo-connection check); GEO evidence
via real map surfaces in a browser (no Places API / MapKit); updatable report with embedded
scan history. Refine against real audits before v1.

## License

Proprietary — © PinMeTo AB. See [LICENSE](LICENSE).
