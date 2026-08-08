# PinMeTo Web Presence skill

A Claude skill that audits a multi-location brand's online findability across **SEO**,
**AI visibility (AIO)**, and **generative-engine optimization (GEO)** — the store locator,
sampled location landing pages, and the brand's PinMeTo data — and produces an updatable HTML
report artifact.

It is distributed as part of the **PinMeTo Locations** plugin
([`PinMeTo/claude-plugins`](https://github.com/PinMeTo/claude-plugins)), alongside the
Location Reports skill. It calls the PinMeTo Location MCP tools, so it needs that server (the
`.mcpb` Desktop Extension, or the npm package in Claude Code) connected at run time.

## Layout

| Path | What |
| --- | --- |
| `SKILL.md` | The skill: triggers, workflow, output contract |
| `references/` | Progressive-disclosure detail (SEO / AIO-GEO rubrics, PinMeTo data check, scoring, report spec) |
| `package-skill.sh` | Builds the distributable `pinmeto-web-presence-<version>.skill` archive |
| `.github/workflows/release.yml` | On a `vX.Y.Z` tag: package, release, and notify the marketplace to sync |

## Releasing

1. Bump `version:` in `SKILL.md`.
2. Tag and push: `git tag v0.1.0 && git push --tags`.
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
    "pinmeto-web-presence":     { "repo": "PinMeTo/pinmeto-web-presence-skill",     "version": "0.1.0" }
  }
}
```

That registry PR carries its own plugin version bump (adding a skill is a minor). After it
lands, every future `vX.Y.Z` tag here syncs automatically.

## Status

`v0.1.0` scaffold — the methodology in `SKILL.md`/`references/` is a starting point to refine
against real audits.

## License

Proprietary — © PinMeTo AB. See [LICENSE](LICENSE).
