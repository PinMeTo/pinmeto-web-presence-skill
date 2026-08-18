# Agent Readiness checks — procedures (10 checks, pillar weight 15%)

Agent Readiness measures whether an AI agent acting **for a customer** can discover and use
the site's machine surfaces. These are the standards PinMeTo itself implements — the pillar
doubles as a product story. All checks are plain HTTP against the website root; no browser
needed.

### ar.content_signals_robots (15)
`robots.txt` declares Content Signals (draft-romm-aipref-contentsignals): look for
`Content-Signal:` lines (e.g. `search=yes, ai-train=no`) or the documented comment block.
Plain crawler rules without signals = fail.

### ar.mcp_server_card (15)
`GET /.well-known/mcp-server-card` (SEP-2127) returns 200 JSON describing an MCP server
(name, endpoint/transport). Validate it is JSON, not an SPA shell.

### ar.webmcp_tools_registered (10)
Fetch the homepage HTML and look for WebMCP registration
(webmachinelearning.github.io/webmcp): script that calls `navigator.modelContext` /
`window.agent` tool registration, or an explicit WebMCP manifest. If detection is uncertain
from static HTML, check in the browser console (`typeof navigator.modelContext`) when a
browser is already open for GEO; otherwise judge from source and say how you judged.

### ar.agent_skills_discovery (10)
`GET /.well-known/skills/index.json` (Cloudflare Agent Skills RFC) returns 200 JSON listing
skills; spot-check that one listed skill path (e.g. its `SKILL.md`) also resolves.

### ar.api_catalog (10)
`GET /.well-known/api-catalog` (RFC 9727) returns 200 with a linkset (JSON,
`application/linkset+json` preferred) enumerating the site's APIs.

### ar.llms_txt_full (10)
Both `/llms.txt` **and** `/llms-full.txt` return 200 markdown. Only one of the two = ratio
0.5. (Related to `aio.llms_txt_present` but stricter — the pair is the convention.)

### ar.markdown_content_negotiation (10)
Identical to `aio.markdown_content_negotiation` — run that probe once (homepage + one
content page + one sampled location page, ratio = passing/3) and record the same status and
ratio under both check ids. Gradient in AIO, mirrored here; the two must never disagree.

### ar.rfc8288_link_headers (10)
Inspect response headers on the homepage for RFC 8288 `Link:` headers with
`rel="api-catalog"`, `rel="describedby"`, `rel="service-desc"`. Ratio = present ÷ 3 always;
pass at 3/3. (A header advertising a target that 404s does not count as present — check the
target resolves, and say so in the evidence.)

### ar.jsonld_present_valid (5)
At least one sampled page and the homepage carry JSON-LD that parses cleanly. (Deliberately
redundant with the SEO pillar at a small weight — an agent consumes it too.) The dual-pass
rendering policy from `seo-checks.md` applies: JSON-LD that only exists after hydration
counts at 0.5.

### ar.xml_sitemap (5)
A syntactically valid XML sitemap exists and is referenced from `robots.txt`. Reuse the
Stage 2 sitemap fetch.

## Fix briefs for this pillar

Most AR fixes are "add a small static file / header at the edge". The agent prompts should
say exactly that (e.g. "serve this JSON at /.well-known/api-catalog from our CDN config")
and include a minimal valid example body inline, so a developer can ship it in minutes. Use
the exact `Goal` / `Issue` / `Fix` / `Skill` / `Docs` prompt format in
`artifact-report.md`. The audited host's report at `https://isitagentready.com/<audited-host>`
is the approved source for check-specific skill links and may also supply verified documentation
links. Copy only links actually surfaced in that report; never guess a skill path. Reference
PinMeTo's own implementations as the working example where helpful (pinmeto.com serves all of
these).
