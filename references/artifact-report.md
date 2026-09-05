# Report delivery — PinMeTo Presence Report design

The deliverable is a standalone, published report that a stakeholder opens from a link. The
host determines the container, while the content, identity, embedded history, and update-in-place
contract remain the same:

- **ChatGPT / Codex:** load and follow `sites-building`, then `sites-hosting`; create an actual
  Site and return its deployed URL as the primary deliverable. Do not substitute an HTML
  artifact, attachment, canvas, or local-only preview. If Sites or its required hosting
  capability is unavailable, stop and explain that Sites must be enabled before the report can
  be delivered.
- **Claude:** create one self-contained HTML artifact using the host's artifact capability.

The layout below is the PinMeTo Presence Report contract: two layers, Layer 1 for the
marketer and the full audit behind one "Full audit detail" expander. Follow it section by
section rather than improvising. On Claude, load an artifact-design skill first if the host
provides one. On ChatGPT/Codex, the Sites workflows govern project setup, implementation,
validation, preview, and hosting; this file governs the report-specific UI and data contract.

**Access.** A published report is link-accessible: anyone holding the URL can read it. That is
what lets a stakeholder open it from a link, and it is also the boundary on content: the report
may contain only what is already public (site observations, map listings, NAP data the brand
publishes) plus aggregate reputation and context lines — never raw PinMeTo API payloads,
per-location insight dumps, tokens, or credentials. On a report's first publish, tell the user
the URL is readable by anyone who has it; re-runs to the same report inherit that consent.
Tighter access (org-restricted Sites, unpublishing) is host configuration the user applies,
not something the skill can enforce.

**Generate, don't hand-write.** A full report is ~60 accordion rows and ~30 drawers;
hand-authoring that much repeated markup drifts. Hold the `CheckResult`s and scan history as
data and render repeated UI from them. In a Site, keep the data in a module and map it into
components. For an HTML artifact, emit the document from a small template script. Both pair
naturally with the scoring script in `scoring.md`.

**Render every data-derived string safely** — check names, why/cost prose, fix steps, evidence
notes, agent prompts. In a Site, render these as framework text nodes; do not pass them to
`dangerouslySetInnerHTML` — with exactly one exception: the `pmt-scan-history` script element
(below) has no text-node alternative in a framework, so its JSON, escaped per this paragraph,
is set through the framework's raw-content mechanism; nothing else may use it. In an HTML
artifact, HTML-escape them. Evidence routinely *quotes
literal markup* (a duplicated `<title>`, a missing `<link rel=canonical>`, a JSON-LD snippet);
one unescaped RCDATA tag like `<title>` can swallow the rest of a hand-generated document. If
prose needs inline code styling, escape first and re-allow only `<code>`/`</code>`.
Serialize the history block as JSON and escape every literal `<` as `\u003c` before placing it
inside the script element; do not HTML-escape JSON quotes, which would make the block invalid.
Validate every data-derived URL before placing it in `href`, `src`, CSS, or another navigable
attribute. Allow same-page `#` anchors, `https:`, and `http:` only when the observed or cited
resource genuinely requires HTTP. Reject `javascript:`, `data:`, `blob:`, `file:`, malformed,
and other schemes; render a rejected value as inert text instead of a link or embedded resource.

**Pre-publish sanity checks** (cheap, catch the whole failure class):

- in both modes, the history block parses as JSON and the visible hero, pillar scores and points bar render from
  that same history entry;
- for Sites, complete the build and validation required by `sites-building`, then publish via
  `sites-hosting`; keep the report on one route unless the data genuinely needs more;
- for HTML artifacts, require exactly one `<title>` tag and the expected `<script>` tags (the
  `pmt-scan-history` block plus one interactivity script), with the interactivity script last;
- artifact interactivity uses `addEventListener` on `data-*` hooks — never inline `onclick=`
  attributes — and the script sits at the end of the body;
- when artifact browser QA is available, serve the file and, before publishing, expand "Full
  audit detail", then click one accordion, one drawer button, one copy button and one filter
  inside it, since all four live in Layer 2 now and the expander is the first click
  (`document.scripts.length` being 0 is the instant tell that malformed markup swallowed the
  script). **Check a copy button by its payload, not its label.** A browser denies clipboard
  writes on a `file://` origin, and a handler that reports success either way will say "Copied"
  over a rejected write, so read the text of the element the button copies from and count the
  blocks there; serve the file over `http://localhost` if you want the clipboard round-trip
  itself;
- escape non-ASCII inside artifact CSS `content:` rules as `\00B7`-style escapes;
- in both modes, the Theme mapping (below) agrees with the rubric. Run
  `node scripts/check-references.mjs --scan` before publishing: `--scan` runs only the checks
  that read files a skill payload ships (this reference and `rubric.md`), so it can pass or fail
  on the references you actually have, never on a repo file the skill does not contain. It
  verifies (a) `theme_mapping_for_rubric_version` equals `rubric_version` in `rubric.md`; (b) the
  union of all `checks` arrays equals the rubric's set of point-bearing ids, every pillar check id
  plus the GEO sub-group B and C field ids; (c) no id appears in two Themes; (d) every `effort`
  value is one of the eight effort labels enumerated under "Effort labels" in the
  writing-style section below. **Any failure blocks publishing.** (The script's default mode adds
  the repo-only checks and is what CI runs on every push.) There is no "Other" catch-all
  Theme: a catch-all would hide exactly the drift this check exists to catch, in front of a
  customer.

After publishing, verify the same three things on either path: the exact report title, the
hero score, and a parseable `pmt-scan-history` block. For a Site, run the `sites-hosting`
workflow's own verification, then fetch the deployed URL once and confirm those three. For a
Claude artifact, confirm them through an **artifact-aware read** — whatever mechanism the host
documents for reading published artifacts (an artifact read/fetch tool, or reopening the
artifact in the conversation). Do not use a generic URL fetch or the in-app browser on an
artifact: either can return a SPA shell, 403, or false 404 even when the artifact is valid.

## Identity (what makes re-runs update instead of fork)

- **Title:** `PinMeTo Web Presence — <brand domain>` for a whole-brand report, or
  `PinMeTo Web Presence — <brand domain> — <Scope>` for a scoped one (e.g.
  `… — hm.com — Sweden`, `… — hm.com — DACH`). The title is the identity: exact,
  stable across scans, scope label capitalized consistently.
- **Favicon:** `📍`, never changed.
- **ChatGPT / Codex re-run:** find the existing Sites project for the exact title and scope.
  Prefer the project source and its `.openai/hosting.json`; reuse its `project_id`. Read the
  history from the source data or rendered `pmt-scan-history` block, append the scan, save a
  new version, and redeploy the **same project** so its URL remains stable. Only create a new
  Site when no project matches that report identity. Keep each scope in its own project
  directory so one `.openai/hosting.json` never points two report identities at one Site.
- **Claude re-run:** list existing artifacts, match the exact title for the requested scope,
  read the published artifact through the artifact-aware read described above, parse the
  history block, append the scan, and republish to the same artifact URL. Only create fresh when
  no artifact matches.
- If the user says "update the report" ambiguously and several presence reports exist for the
  brand, ask which one (or update all only when a scheduled scan explicitly says so).
- **Reading the previous history block, cheaply.** Prefer local Site source/state when it is
  available. Otherwise, for a Site, fetch the deployed URL once and extract
  `<script type="application/json" id="pmt-scan-history">…</script>` from the saved full HTML
  rather than asking a markdown converter to transcribe it. On Claude, never `curl` an
  artifact URL (it may return the SPA shell or a 403); use the artifact-aware read
  described above.

### Single-writer update guard

The scan history is append-only, so two scans must never publish from the same stale base.
Serialize updates per exact report identity: use a per-project lock when the host supports
one, and conditional saves or an expected parent version when offered. On hosts with neither —
most of them — the fingerprint check below **is** the guard: run it and publish; the absence
of a lock is not a reason to block. What is forbidden is *knowing* overlap: never start a
second update of the same report while one is in flight (one schedule per report already makes
this rare), and if you know another is running, wait for it instead of publishing. Capture a
fingerprint of the history read at the start, then re-read the authoritative history
immediately before publishing.

- If the fingerprint is unchanged, append and publish normally.
- If another scan appended entries, preserve those entries verbatim, append this scan to the latest
  history, and regenerate deltas and trend prose against its new immediate predecessor before
  publishing.
- If the latest history cannot be read or merged exactly, do not publish. Leave the current
  report untouched and surface the conflict. Never let last-writer-wins erase a scan.

## Scoped reports (country / region)

A brand can hold **several living reports at once** — one global, one per country, one per
region — each with its own Site or artifact, sample, history, and schedule:

- The scope is a filter over the PinMeTo fleet: `country` (maps directly onto
  `pinmeto_get_locations` filters) or a named region = an explicit list of countries or
  cities. Sampling (5/10, min 3) applies **within the scope**, so a scoped report of a big
  brand has real coverage where a global one is thin.
- The scope is stored in the history block (`scope` field below) so a scheduled or re-run
  invocation can reconstruct the exact filter without asking.
- Keep scopes **disjoint** when possible; if a location appears in overlapping reports,
  that is fine (each report is self-consistent) but say so when the user sets it up.
- A scoped report never silently widens or narrows: if the user asks for a different scope,
  that is a **new report** with a new title, not a mutation of an existing one.

## Brand look (a document, not a dashboard)

The page reads as a briefing document: one column on a white page, with typography and
hairlines carrying the structure. No cards, no shadows, no gradients, no colour-coded score
numbers, no uppercase labels. Set explicit colors on every surface so it renders identically in
light and dark viewers.

- **Surfaces.** Page and every section white `#fff`; hairlines `#E2E6EA` between sections; the
  one tinted panel is "What to do next" on light grey `#F2F3F4` (10px radius). Nothing else is a
  container. Buttons and the re-run prompt block use a 6px to 8px radius.
- **Ink.** Navy `#000050` for headings, every score and the one primary button; body text
  `#333`; muted `#6A6F76` for labels, datelines and meta; link blue `#1E7FE0` for links and
  text-link buttons. Light blue `#BBD9FA` and mid blue `#3399FF` appear only in the logo.
- **Orange `#FF8854` as an accent in exactly two places.** The rank badge on the top Theme
  (orange fill, navy numeral, never white on orange) and the top Theme's hatched segment of the
  points bar. Its only other use is as a status mark: the 8px fail dot in the counts row and on
  Layer 2 check rows, listed under status colors below. Never as type on white, never as a
  border or rule.
- **Status colors.** Text: fail `#B5481E`, warn `#6A6F76`, pass `#137A50` (the band word under
  a pillar score, the NAP mismatch count). Dots in the counts row: fail `#FF8854`, warn
  `#6A6F76`, pass `#1FA971`. The points bar's earned segment is muted green `#CFEBDC` so it reads
  as done without pulling focus. Delta pill: up `#D8F3E7` on `#137A50` text, down `#FFE0D1` on
  `#B5481E`, no change `#F2F3F4` on muted.
- **Type.** `font-family:'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  (no external font loads). Headings 700, big numbers 800 with tight letter-spacing (overall
  score 96px, pillar scores 32px, Theme worth 30px), body 15px to 16px, meta 13px. Tabular
  numerals on every number. Sentence case everywhere: no uppercase kickers, no letter-spaced
  labels. A label above a value is small muted sentence-case text ("Effort", "Pays in").
- **Meta reads as language.** Never join facts with middle dots. Write a sentence
  ("Five locations, scanned 4 September 2026.") or label-and-value cells.
- **Buttons.** One filled navy primary button per page: the top Theme's "How to fix". Every
  other "How to fix" is a text link in link blue. Utility buttons (Copy, Close, the Theme
  brief's "Copy all N briefs") are outline style: white, link-blue text, 1px `#E2E6EA` border.
- **Logo.** The masthead carries the official PinMeTo landscape logo from
  `assets/pinmeto-logo.svg`, 30px tall at the left, inlined in the artifact (a Site may import
  the file). Never recolor, stretch or redraw it. If the asset cannot be read, set the word
  "PinMeTo" in Montserrat 700 navy in its place rather than drawing a substitute.
- **Measure.** Max width 900px, centered, 32px side padding; prose no wider than about 66
  characters; wide tables scroll inside their own `overflow-x:auto` container. Nothing in
  Layer 1 is sticky.

### Print

**Layer 1 is the print view.** A printed report is the summary a manager reads, not sixty
check rows. In `@media print`:

- Layer 1 prints in full: hero, summary, pillar scores, points bar, trend, Themes, the NAP
  summary line, "What to do next", Methodology and the footer.
- The "Full audit detail" expander prints **only when the reader has expanded it**. An open
  expander prints its contents; a collapsed one prints nothing, its summary line included.
- **Theme briefs and per-check drawers never print**, open or not. They are worked from the
  live report, and printing them would bury the summary under thirty sets of fix steps.
- Interactive chrome carries `.np` and is hidden in print; sections keep `break-inside: avoid`;
  the hatched and dotted fills of the points bar must survive greyscale printing (they are
  patterns, not colours, for exactly this reason).

## Section order

The report is **two layers**. **Layer 1** is everything outside the expander: what a marketer
reads (the hero with the summary beside the score, the pillar scores, the points bar, the
trend, the Themes work list with the top Theme expanded, a one-line NAP summary) plus the
page-level sections under it. **Layer 2** is the full audit, demoted behind one "Full audit
detail" expander that is collapsed when the page loads. Nothing was removed from the audit,
only moved one click away: every Layer 2 item keeps the data contract it already had.
Printing gives you Layer 1, and Layer 2 only where the reader opened the expander first (see
"Print" above).

Layer 1 is these eleven sections, in this order. Sections 9 to 11 sit below the expander at
the bottom of the page: "What to do next" is the marketer's next step, Methodology and the
footer are page-level. **Any link that points into Layer 2 expands the expander first**, then
scrolls to its target: the NAP summary line, a Theme brief's evidence pointer into the
matrix, or a per-check drawer. A reader must never be sent into a closed expander.

The order is the reading order of importance: where you stand, what that is made of, how far
you are from 100 and what closes the gap, what moved, then the work in the order to do it.

1. **Hero**: a masthead (the PinMeTo logo left, "Web presence report" right, a hairline
   under both), then a two-column lead. Left: the brand domain as the h1 (46px), a one-sentence
   dateline ("Five locations, scanned 4 September 2026. Rubric 2.14.0-skill.1."), and the
   Summary (section 2), which lives in this column. Right, right-aligned: the overall score
   huge (96px, 800, navy), "of 100", the band word (Strong / Healthy / Needs work / Critical)
   in its status colour, and from the second scan on a delta pill (↑ or ↓ and points, green or
   orange) with "since <previous scan date>" under it. First run: no delta pill. The lead
   closes with a hairline. No gradient, no navy band, no kicker: the masthead names the report.
2. **Summary**: two short paragraphs written for a marketer, to the "Summary" template under
   "Writing style inside the report", rendered in the lead's left column under the dateline,
   then the three counts on one line, each with its status dot: `N failing checks` /
   `N could not be measured` / `N passing`.
3. **Pillar scores**: one row of four cells separated by hairlines (SEO, GEO, AIO, Agent
   readiness), each carrying the pillar name (13px, 600, navy), the pillar score (32px, 800,
   navy, never colour-coded) with, from the second scan on, a small signed delta against the
   previous scan beside it (`+4`, green for up, fail colour for down, nothing at zero), and the
   band word in its status colour. No bars. No weight on the cell: the four pillar weights
   live in Methodology (section 10), because a marketer reads the score and the band, not the
   arithmetic behind them. Each cell links to its pillar section inside Layer 2. This row is
   the only place the per-pillar deltas appear; the trend does not repeat them.
4. **Points bar**: the one chart every reader understands, answering "how far from 100 am I,
   and what closes the gap". A caption sentence, then a single 28px horizontal bar from 0 to
   100 where one point is one hundredth of the width, then a legend. Segments, left to
   right:
   - **Earned**: the overall score, muted green fill, the label "earned <score>" inside its
     right end in navy. Solid fill means done.
   - **The top Theme's worth**: orange diagonal hatching on white with a 1px orange outline.
   - **Every other Theme's worth**, in rank order: navy diagonal hatching on white with a 1px
     navy outline, one segment per Theme, 2px gaps between segments.
   - **Not measurable**: the points the `warn` checks did not earn, a dotted grey fill with a
     dashed grey edge. A `warn` already earns half credit in the score (`scoring.md` §1, ratio
     0.5), so this segment is the unearned half only: `check_weight × 0.5 × pillar_weight / 100`
     summed over the warn checks, never `100 − score − Theme worths`, so a rounding gap in the
     Theme worths can never be reported as an evidence gap and the bar can never exceed 100. If the segments do not sum to 100 after rounding,
     absorb the difference in the earned segment's width, never in a label.

   Hatched and dotted fills mean unfinished; nothing still to earn is a solid colour. Above the
   hatched Theme segments a thin navy bracket carries "Left to do: <count> themes,
   <points> points". Under the bar the legend is four lines, each with a swatch in the same
   fill: "<score> points earned in this scan" · "<worth> points from <top Theme name>, do this
   first" (the name a link to `#theme-<slug>`) · "<points> points from the <count> other
   themes" (a link to `#themes`) · "<points> not measurable this time (<n> checks)". At one
   point, render the singular ("1 point"). The caption reads: "You have <score> of 100 points.
   Fixing the <count> themes below earns about <points> more; the first one alone earns
   <worth>. The last <points> sit in checks that could not be measured this time." When no
   Theme has worth above 0, the bar is earned plus not-measurable and the caption says so.
   When nothing is `warn`, omit the last segment, legend line and caption sentence.
5. **Trend** *(from the second scan onward; omit entirely on the first scan)*. A two-column
   row under a hairline: the story left, an inline SVG line chart right. Every number in it is
   read from the history entries, never recomputed.
   - **Headline, since the first scan** (20px, 700, navy): total movement with the first scan's
     date. Template: `Up <n> points since your first scan on <date>` /
     `Down <n> points since your first scan on <date>` /
     `Unchanged since your first scan on <date>`. Same template up or down; no adjectives.
   - **Subline, since the previous scan** (muted): `+<n> since <previous scan date>` /
     `−<n> since <previous scan date>` / `No change since <previous scan date>`. Omit it when
     the report has exactly two scans (it would repeat the headline).
   - **Themes cleared, since the first scan**: one line in pass green,
     `<count> themes cleared since your first scan on <date>: <name>, <name>`, Themes named by
     the Theme mapping's `name` verbatim, ordered by the scan in which they cleared, most
     recent first. A Theme is **cleared** when no member check is `fail` in the current scan
     and at least one member was `fail` in an earlier scan. Zero cleared: omit the line; never
     print "0 themes cleared". A cleared Theme does not reappear in the Themes list, which
     stays a pure work list, so the names on this line are plain text: there is no
     `theme-<slug>` row left to link to.
   - a collapsed "What moved since <previous scan date>" disclosure (a text link that expands
     in place): derive the bullets **mechanically from a diff of the previous and current
     `checks` maps** (that is why the map stores every check), and classify each one as
     **rubric change**, **measurement correction**, or **real change** per the re-run rule in
     `rubric.md`. A Theme that was cleared in an earlier scan and has a failing member again is
     named as **reopened** ("Opening hours consistency reopened: 2 of 5 sampled listings
     changed hours"), in the same words as progress. Concrete and honest: "Agent readiness
     gained 12 points, the MCP server card went live" (real) vs "SEO gained 10 points because
     the rubric now gives half credit for client-rendered values; nothing changed on the site"
     (rubric).
   - the chart: overall score across scans, grid lines at 0/50/100, score labels above points,
     dates below (first label anchored at its start, last at its end, so neither clips), last
     point emphasized in orange. When two scans share a date, label the points with date
     **and** ordinal ("9 Aug (1st)", "9 Aug (2nd)"). With only two points the chart is thin
     but still correct; keep it. The per-pillar deltas are not repeated here: they sit beside
     the pillar scores (section 3).

   The chart stays in Layer 1; the scan-history table behind it is the first item inside
   Layer 2, so the row tells the story and the raw numbers are one click away.

   **Cross-scan rules.** Theme progress (cleared, reopened, and the "Open since" status on
   Theme rows) is computed against the **current mapping table only**: a past scan's Theme was
   failing if any of the Theme's current member ids was `fail` in that scan's `checks`; ids the
   older scan does not contain are **unknown, never failing**, so rubric drift never invents a
   reopened Theme. Old scans are never re-scored. The hero score, the pillar scores, the points
   bar, the chart and the Layer 2 scan-history table must all render **from the history
   entries**, never from separately computed numbers: a report that disagrees with its own
   embedded state (hero 22, history 23) is worse than no trend at all. Nothing in this row
   credits PinMeTo or anyone else for the movement; the numbers carry it.
6. **Themes** (the work list): the h2 "What to fix, in this order" · a data-driven lede,
   `<Count> themes, worth ~<summed points> points together, ranked by the score points a fix
   would return. One theme is one plain-language issue; a single fix can earn points in several
   pillars.` with the count in words ("Six themes, worth ~28 points together"; "One theme,
   worth ~4 points" when a single Theme remains). Then one **Theme row** per Theme in the Theme
   mapping (below) whose worth is above 0, ranked by worth descending, under hairlines. The
   top Theme is the one expanded row; every other Theme is one compact line. A Theme whose
   worth is 0 (every member passes or is `warn`) is omitted and not counted in the lede. The
   lede total is the sum of the displayed worths, so the heading and the rows agree, and it
   equals the points bar's hatched total. When no Theme has worth above 0, render the h2 and one
   sentence saying every scored check passed or could not be measured, and no rows.

   **Worth and ranking.** A Theme's worth is the sum of points returned (`scoring.md` §4:
   `check_weight × (1 − ratio) × pillar_weight / 100`, GEO ids at their effective weights)
   over its member checks whose status is `fail`, rendered-only half credit included (ratio
   0.5). `warn` members contribute 0. Display the worth as an integer, rounded half up. Rank
   by worth descending; break ties with the §4 tie-breakers (fleet-wide template fixes beat
   per-location manual edits), then by the rubric order of each Theme's first member.
   Membership comes from the Theme mapping, never from per-scan judgment.

   **Theme row contract, the expanded top row.** A three-column grid (rank, body, side):
   - the rank badge: orange `#FF8854` fill, navy `#000050` numeral "1", the only orange badge
     on the page;
   - the headline: the mapping `name`, verbatim (24px, 700);
   - a one-to-two sentence per-scan summary: the observation with its count and denominator,
     then what it costs the brand (see "Writing style inside the report");
   - facts as label-and-value cells, in this order: **Effort** (the mapping `effort`
     verbatim) · **Pays in** (the distinct pillars among the failing members, as a list:
     "SEO and AIO") · **Failing checks** (`<count>, <M> of <K> already pass`, K counting every
     member in the mapping and M those with status `pass`) · from the second scan on,
     **Status**: `Open since <date>, <n> scans`, where the date is the earliest scan in which
     any current member id was `fail`, and `<n>` counts the scans from that one to now
     inclusive. On the first scan there is no "Open since" cell. This is where stagnation
     shows, next to the work it describes, rather than in the trend;
   - the side column, right-aligned: the worth as `~<N>` (30px, 800, navy) over "points back"
     (singular at one), and the page's one filled navy "How to fix" button opening the Theme
     brief (below).

   **Theme row contract, the compact rows.** One line each under a hairline, five cells: the
   rank numeral in muted grey (no badge) · the mapping `name` (16px, 600) with, from the second
   scan on, `Open since <date>, <n> scans` in small muted text beneath it · the worth as
   `~<N> pts` (`~1 pt` at one) · the effort label verbatim · a text-link "How to fix" opening
   the Theme brief. Pillar tags are not shown on compact rows; the brief header carries them.

   No cards, no orange borders, no pills. Every row carries the `id="theme-<slug>"` anchor
   specified under "The Theme brief".
7. **NAP summary line**: one row under a hairline answering "do my listings agree?" without
   opening the table. Left: the h3 "Name, address and phone" and one or two sentences: when
   any location agrees on every field, "<n> of <N> locations match everywhere." first; then,
   when anything disagrees, the sharpest example naming the location, the platform and the
   field ("Sharpest: Malmö, where Apple shows the old street address"); then the link "See
   the full matrix in the audit detail", pointing at the NAP consistency matrix inside Layer 2:
   it **expands the expander if it is collapsed**, then scrolls to the matrix. Right,
   right-aligned: the mismatch count as a number (26px, 700) in fail colour, or in pass colour
   when it is zero, over "mismatches across <N> locations". When every sampled location agrees
   on every field, the sentence is the match count alone and the number reads `0` in pass
   colour. When **no** location agrees on every field, omit the match sentence rather than
   print "0 of 5 locations match everywhere". Both counts come from the same GEO evidence as
   the matrix, so the line and the table cannot disagree. The wording follows "Writing style
   inside the report"; the sentences above are illustrations, not templates.
8. **Full audit detail**: one expander, collapsed when the page loads, holding Layer 2. Its
   summary line reads "Full audit detail: every check, every location, the NAP matrix" with a
   link-blue "Open" at its right end, sits under a hairline, and it holds these six items in
   this order:
   1. **Scan-history table** (date, label, SEO, GEO, AIO, Agent, Overall): the numbers behind
      the Layer 1 chart, rendered from the same history entries. Omitted on the first scan,
      like the rest of the trend.
   2. **Sticky section nav**: pill links (Trend · SEO n · GEO n · AIO n · Agent n · Locations)
      plus a filter toggle (All / Needs attention / Passing) that shows/hides check rows. Nav
      and filter sit inside the expander because their targets do. The "Trend" pill is the one
      exception: it points at the Layer 1 trend row.
   3. **Per-pillar sections** (SEO, GEO, AIO, Agent readiness): section header with pillar
      name, 1-line blurb, score + band tag, separated by a 2px navy rule. Then one accordion
      row per check: status dot (fail orange / warn grey / pass green) · human check name · the
      rubric `check.id` in small muted type · right-aligned result label (e.g. "0%", "3 / 5",
      "Pass") · chevron. Expanded: "Why this matters" prose, the cost of leaving it, and a
      button — "How to fix it" (fail) or "See evidence" (pass/warn) — opening the drawer.

      **Double-scored rows carry a muted cross-reference.** Where one fix earns points under
      two pillars (the pairs listed under "Theme mapping": llms.txt, markdown negotiation,
      sitemap, breadcrumbs, canonicals, JSON-LD), each row of the pair shows one muted line in
      its expanded body naming the other, "also scored in <pillar>, same fix, pays twice",
      linking to the sibling row. Both rows keep their own status, result label and drawer;
      neither is hidden and neither is merged, because the two checks differ in threshold.
   4. **Location breakdown**: table of every *sampled* location — name, city, per-pillar
      mini-scores where applicable, overall. Note which fleet locations were not sampled.
   5. **NAP consistency matrix**: per sampled location × {Name, Address, Phone, Hours,
      Map pin, URL}. Each cell shows **one chip per platform** where the field applies and a
      listing exists — a small **G / A / B** (Google, Apple, Bing) letter chip, green
      `#D8F3E7` = matches the PinMeTo record, orange `#FFE0D1` = differs, grey `#F2F3F4` =
      searched and **no listing found** (`lookup: "not_found"`). A platform that could **not be
      checked** (`lookup: "unobserved"`) gets a distinct hollow chip — grey outline, no fill, `?`
      instead of the glyph — with the reason in its tooltip; rendering it as a plain grey chip
      would tell the customer they have no listing when nobody looked. So an Oslo/Address cell
      reads `G✓ A! B✓` at a glance
      instead of one flattened "!". Each orange chip carries a `title` tooltip with the
      observed value vs the PinMeTo value ("Apple: Ruseløkkveien 34 · PinMeTo: Dronning
      Eufemias gate 16"). Fields that are scored on fewer platforms show only those chips
      (Hours: G · URL: G/B · the rest: G/A/B). Legend underneath must explain the chips
      **and define Map pin** ("the platform's map-pin position — within 50 m of the PinMeTo
      coordinates counts as matching") **and what the Hours chip compares** ("Google's weekly
      hours table vs the PinMeTo record" — hours are a Google richness check and a
      page-agreement field, not a three-platform NAP comparison, so the single chip is
      correct and should not read as if Apple and Bing were checked and omitted). This is the money table for the PinMeTo pitch — it
      must be exactly right per the GEO evidence. It is what the Layer 1 NAP summary line and
      the Theme brief's evidence pointers link to.
   6. **Listing content table** (directly after the matrix): per sampled location, what the
      Google listing actually shows — {Category (vs the category PinMeTo pushes, from
      `network.google.categories.primaryCategory`), Photos ("5+" / "under 5" / "not counted" — never a fabricated exact number; see the reviewer-profile trap in `geo-browser-checks.md`), Latest owner
      post (date or "none"), Newest review (Google's own relative label verbatim — "6 months
      ago" — not an ISO date derived from it; the `newestReviewLabel` field), Newest review
      (absolute date — the optional `newestReview` field, set only when Google actually
      displays a date; leave the cell empty otherwise)}. Photos and review recency feed scored
      checks (`geo.photos_5_plus`, `geo.recent_reviews_180d`); category and owner posts are
      **observed, unscored** — label the columns so the distinction is visible. A stale or
      empty "latest owner post" is a natural talking point for PinMeTo's posting features;
      keep it factual, not salesy.
9. **What to do next** (the one tinted panel, light grey): "Ship the fixes, then scan again" —
   3 numbered steps (hand a Theme's briefs to a developer / any person-tasks like claiming an
   Apple listing / re-run), and a literal re-run prompt the customer can say to ChatGPT, Codex,
   or Claude, in a white bordered block with an outline Copy button:
   `"Re-run the presence scan for <domain> and show me what changed since <date>."` The steps
   refer to Themes, in the order the Themes section ranks them, not to individual checks.
10. **Methodology**: the four pillar weights with a one-line description each, saying what the
    pillar covers and why it carries that share of the overall score (the weights moved here
    from the pillar scores, and this is the only place they appear), plus rubric version, scan
    date, and sources ("Google, Apple, and Bing Maps as observed in a browser, your website
    and store locator, PageSpeed Insights, PinMeTo location data"). State the sample
    explicitly: which locations, which pages, what was not covered. When any check used the
    rendered pass, include the one-paragraph explanation of the dual-pass policy (served =
    full credit, client-rendered = half, and why: Google renders, AI training crawlers
    don't) so the half-credit rows read as method, not error.
11. **Footer**: one hairline, then "Generated by the PinMeTo web presence skill" at the left
    and "Rubric <version>" at the right, both small and muted.

## The fix-brief drawer

A fixed right-side drawer (or, if scripting is constrained, an anchored details section —
but prefer the drawer) opened from any check row, or as a section inside a Theme brief.
Contents, in order:

- one muted header line "Part of theme: <Theme name>" linking to the Theme's row
  (`#theme-<slug>`), the name being the mapping `name` verbatim; a pointer, not content, and
  omitted when the drawer renders as a section inside that Theme's own brief,
- status tag + `check.id` + check name,
- **why** (2–3 sentences, customer-priced: what it costs them today),
- **How to fix it** — numbered steps (3–4, imperative),
- **Copy to your coding agent** — a bordered block with a copy button and the
  `agentPrompt`. Every prompt uses the exact five-field format below so it can be pasted into
  any coding agent without rewriting. Person-tasks (e.g. claim a listing in Apple Business
  Connect) use the same format; the `Fix` must say that it is not a code change and give the
  operational steps instead.
- **What we found** — the evidence rows `{url, note}`, plus one or more verified reference
  links to the relevant spec/docs (schema.org, Google Search docs, RFC…).

### Coding-agent prompt format

Write exactly these five labeled fields, in this order. Keep each field self-contained and do
not add an introduction, closing paragraph, or extra heading inside the copy block.

```text
Goal: <the concrete outcome, affected production host, and route/page scope>
Issue: <what the affected URLs return today, with representative URLs or a route pattern and the missing/incorrect values>
Fix: <which repository surface to find, exactly what output to produce, standalone acceptance tests, and a request to show the diff and results>
Skill: <approved skill link(s), or None>
Docs: <verified standards or best-practice documentation link(s), or None>
```

- Assume the coding agent receives **only this five-field block and the target repository**. It
  cannot see the report, its evidence drawer, sampled-location table, check IDs, scores, or scan
  history. The block must contain every fact needed to locate, implement, and verify the change.
- `Goal` describes the desired end state and names the production hostname plus the affected
  route or template scope.
- `Issue` stays concise but includes the concrete production context: at least one representative
  URL when available (otherwise an exact route pattern), what the raw/rendered/listing surface
  returns today, and which expected value is absent or wrong. State only observed facts; do not
  turn an evidence gap or `warn` into a confirmed defect.
- `Fix` names the artifact to change (for example, the location-page template or edge/CDN
  configuration), tells the agent how to locate it when the repository's filenames are unknown,
  specifies the exact output and required fields, and gives standalone acceptance tests against
  concrete routes or endpoints. End by asking the coding agent to show the diff and verification
  results.
- Never use report-dependent shorthand such as “all five sampled pages,” “this check,” “the
  evidence above,” “rendered only · 5/5,” or “record proof in the next scan” unless the same field
  also names the affected URLs/routes and explains the measurement in ordinary implementation
  language.
- Before publishing, apply the **context-free handoff test**: hide the report and read only the
  five-field block. If a coding agent with the repository could not identify the affected surface,
  reproduce the issue, implement the expected output, and verify success, rewrite the prompt.
- `Skill` is optional in substance but the line is required. Suggest a skill only when it is
  relevant and approved. For agent-readiness findings, skill links surfaced in the Resources
  section of `https://isitagentready.com/<audited-host>` are approved, including the
  `https://isitagentready.com/.well-known/agent-skills/.../SKILL.md` links shown there. Use the
  exact surfaced URL; never construct a skill URL from a guessed slug. A skill explicitly
  approved by the user or their organization and available in the coding agent's environment
  may also be named. Otherwise write `Skill: None`. Never link to an unverified third-party
  skill.
- `Docs` links to the primary specification or official best-practice documentation for the
  finding. Resource links surfaced by the audited host's Is It Agent Ready report are verified
  for this purpose. Prefer official publishers such as an RFC, standards body, schema.org, or
  the relevant search/platform documentation. Do not invent or guess URLs; write `Docs: None`
  when no verified reference is known.

Example:

```text
Goal: Serve LocalBusiness JSON-LD in the initial HTML for every https://www.pinmeto.com/locations/<storeId> page.
Issue: A raw HTTP GET of https://www.pinmeto.com/locations/171206 returns only generic Organization/WebSite JSON-LD; the location's LocalBusiness node appears only after JavaScript executes. The same served-HTML gap was observed across the audited /locations/<storeId> route.
Fix: Find the server route or shared location-page template that renders /locations/<storeId>. Serialize one valid LocalBusiness node into the initial HTML inside <script type="application/ld+json"> using that location's name, postal address, latitude/longitude, canonical URL, telephone, and opening hours. Keep the hydrated output equivalent. Add a regression test that requests at least /locations/171206 without executing JavaScript, parses every JSON-LD block, and asserts that a LocalBusiness node with those required fields exists. Show the diff plus the raw-response and test results.
Skill: None
Docs: https://developers.google.com/search/docs/appearance/structured-data/local-business, https://schema.org/LocalBusiness
```

## The Theme brief

The drawer a Theme row's "How to fix" button opens. It is a **container** of the per-check
fix briefs of the Theme's failing members, each unchanged; nothing in it is merged or
rewritten per scan. It uses the same drawer surface as the fix-brief drawer, or the same
anchored-details fallback where scripting is constrained. Nine rules:

1. **Header**: Theme name (the mapping `name`, verbatim) · "Worth ~N points" pill · effort
   label · the mapping `description` · "M of K checks already pass", where K counts every
   member in the mapping and M those with status `pass` · one "Copy all N briefs" button
   (rule 6).
2. **Sections**: one per member check whose status is `fail`, rendered-only half credit
   included. Each section is that check's fix brief exactly as "The fix-brief drawer" specifies
   it (status tag + `check.id` + check name, why, How to fix it, Copy to your coding agent,
   What we found); only the "Part of theme" pointer is omitted, since the header names the
   Theme. `warn` members are not sections: they are one muted footer line under the sections
   ("2 checks could not be verified: <check names>"). Passing members appear only in the
   header count. A member that produced **no result at all** (a category-conditional check
   excluded for every sampled location) joins that footer line as a separate clause in its own
   words ("1 check not applicable to these locations: <check name>"), never as "could not be
   verified": nobody failed to measure it, it did not apply. It stays inside the header's
   `M of K` denominator, since `K` counts every member in the mapping.
3. **Ids without a drawer** (GEO sub-group B and C fields, `consistency.*` and `page.*`)
   render as evidence pointers into the NAP consistency matrix, linking to it: no steps, no
   prompt. The pointer sentence carries the observation the matrix does not show as a chip:
   the field, the count and denominator of sampled locations, and what disagreed ("Phone on
   the location page differs from the dominant listing value at 3 of 5 sampled locations,
   see the matrix"). The header's effort label is their instruction.
4. **Order**: sections by points returned descending, ties by rubric order. The same rule
   ranks the Theme rows.
5. **Dual-scored pairs** inside one Theme (the known duplicates listed under "Theme mapping")
   show **both** sections; the later one carries
   the muted cross-reference "also scored in <pillar>, same fix, pays twice". Never collapse a
   pair: the two checks differ in threshold, so choosing whose steps survive would be judgment.
6. **Copy all N briefs** concatenates the sections' five-field blocks in section order, each
   block exactly as its drawer shows it, separated by a line containing only `---`. Sections
   without a prompt (rule 3) are skipped and excluded from N; when N is 0 the button is
   omitted. The label is neutral in every Theme, never "coding agent"; the per-check "Copy to
   your coding agent" labels stay as the drawer contract writes them.
7. **Expansion**: three or fewer sections, all expanded. Four or more: the first expanded, the
   rest collapsed to a one-line header (status dot · check name · worth), using the same
   accordion as the per-pillar check rows.
8. **Anchors**: the Theme row carries `id="theme-<slug>"` and its brief
   `id="theme-<slug>-brief"`, both from the mapping `slug` (an HTML document may not repeat an
   id, so the row owns the bare anchor). Loading the report at `#theme-<slug>` scrolls to the
   row and opens its brief; the summary, the NAP summary line and the trend section may link
   there. Where scripting is constrained, the brief is an anchored details element inside the
   row: the hash scrolls to the row and the reader opens the brief with one click.
9. **Back-pointer**: every per-check drawer opened from a check row carries the "Part of
   theme: <Theme name>" line linking to `#theme-<slug>` (see "The fix-brief drawer"). It is a
   pointer, not content: nothing else in the drawer or in the five-field prompt format changes.

## Embedded state — the scan history contract

The report carries its own memory. Embed exactly one block in the rendered page:

```html
<script type="application/json" id="pmt-scan-history">
{
  "schema": 1,
  "brand": "pinmeto.com",
  "scope": { "label": "Sweden", "filters": { "country": "Sweden" } },
  "scans": [
    {
      "date": "2026-08-09",
      "rubricVersion": "2.14.0-skill.1",
      "label": "First scan",
      "overall": 63, "grade": "C",
      "pillars": { "seo": 47, "geo": 79, "aio": 45, "agent_readiness": 90 },
      "counts": { "pass": 40, "warn": 2, "fail": 14 },
      "sample": ["<locationId>", "…"],
      "checks": { "seo.h1_unique_has_location": { "status": "fail", "ratio": 0 } },
      "notes": ["ar.markdown_content_negotiation was recorded 1.0 here but 0.5 under the AIO id; corrected in the next scan"]
    }
  ]
}
</script>
```

- `scope` is `null` for a whole-brand report; otherwise `label` (what appears in the title)
  plus `filters` (machine-usable: `country`, or a list of countries/cities for a region) so
  re-runs and scheduled scans reconstruct the fleet filter without asking.
- `scans` is append-only, oldest first. Keep every prior scan verbatim — never recompute old
  numbers, even if the rubric version moved.
- `pillars.geo` is **nullable**. When **every** sampled lookup came back `unobserved` (not
  merely when none was `observed` — an all-`not_found` run is measured and scores normally),
  `scoring.md` renders GEO as "Not measured" and drops it from the overall; record
  `"geo": null` for that scan, keep `overall` as the value actually computed from the
  reweighted three pillars, and name the degraded scan in `notes`. A renderer must treat null
  as "not plotted" — never as 0, and never recompute the overall with the standard weights,
  or a scan nobody could measure prints as a collapse. The other three pillars are never null.
- `checks` records status+ratio for **every** check that produced a result (compact but
  complete): it is what lets the next scan say "internal linking hasn't moved across four
  scans" without guessing, and it is the input to the trend section's mechanical diff. A
  **category-conditional check excluded for every sampled location** produced no result and is
  the one exception: `rubric.md` drops it from the GEO denominator, so **omit the id from
  `checks` and name the exclusion in `notes`**. Do not record it as `warn`, which would count
  it among "could not be measured" and imply somebody tried, and do not record it as `fail`.
  The trend's mechanical diff reads an id missing from one side as unknown, so an exclusion
  that persists across scans never shows up as movement.
- `notes` (optional) records **measurement corrections** discovered about *that* scan — so
  a later run can see "this check was mis-scored" without re-deriving it. Append notes to
  the older entry when you find the error; never edit its scores.
- On re-run: read this block from Site source/state or the live report, append, and redeploy or
  republish in place, following the single-writer guard above. If a matching report's block is
  missing or unparseable, do **not** reset or overwrite that report. Preserve its source and
  published payload. On an interactive scan, explain the problem and require explicit approval
  before restoring a prior valid history or deliberately resetting it; on a scheduled scan,
  abort, leave the report unchanged, and surface a setup-required failure in the scheduled
  scan's own output (the same way a failed PinMeTo baseline is surfaced in `monitoring.md`) so
  the schedule's owner sees why monitoring stopped instead of a silently frozen report.
  Create a new report identity only when the user explicitly requests one.

## Theme mapping

A **Theme** is a fixed cross-pillar group of checks that one fix and one owner resolve. The
table below is the **Theme mapping**: the scanning agent computes Theme membership and worth
mechanically from it, never by per-scan judgment. Membership rule: one fix, one owner. A
check lives where the person who fixes it sits (developer template, developer infrastructure,
content, PinMeTo listings); the reader-facing story is the tie-breaker. The mapping covers
every id that can produce points returned: the 52 pillar checks plus GEO's three sub-group B
fields and five sub-group C fields (`scoring.md` §4 gives them an effective weight, so they can
surface as fixes). 60 ids, each in exactly one Theme, ten Themes, no "Other" catch-all.

Per Theme the table fixes five columns: `slug` (stable, kebab-case, for cross-references),
`name` (written as a change, short, no check id or file token; rendered verbatim every scan), `description` (what the Theme is about, marketer voice, no per-scan
facts), `effort` (a property of the fix, not the scan; one of the closed set below) and
`checks`. Pillar tags and "pays in N pillars" are derived from the member ids.

```json
{
  "theme_mapping_for_rubric_version": "2.14.0-skill.1",
  "themes": [
    { "slug": "location-data-in-code",
      "name": "Put each location's and your brand's details into the page code",
      "description": "Structured data (JSON-LD) that names each location and the brand in the HTML the server sends, so search engines and AI crawlers read it without running JavaScript.",
      "effort": "One template change",
      "checks": ["seo.localbusiness_jsonld_present", "seo.localbusiness_jsonld_richness", "aio.graph_jsonld_pattern", "aio.inlanguage_matches_html_lang", "aio.organization_schema_complete", "aio.entity_consistent_brand_naming", "ar.jsonld_present_valid"] },
    { "slug": "unique-location-pages",
      "name": "Make every location page introduce its own location",
      "description": "Every location page carries its own title, description, heading, image text and social preview, so search engines can tell the pages apart and show the right one.",
      "effort": "One template change",
      "checks": ["seo.meta_title_unique", "seo.meta_description_unique", "seo.h1_unique_has_location", "seo.og_twitter_per_location", "seo.image_alt_text"] },
    { "slug": "crawlable-site",
      "name": "Let search engines find and crawl every location page",
      "description": "Canonicals, sitemaps, robots rules, breadcrumbs, language links and link depth that let crawlers discover and index every location page.",
      "effort": "One developer task",
      "checks": ["seo.canonical_present", "aio.canonical_homepage_resolvable", "seo.sitemap_lists_locations", "ar.xml_sitemap", "seo.robots_allows_locations", "seo.internal_linking_depth", "seo.breadcrumbs_structured", "aio.breadcrumblist_matches_visible_nav", "seo.hreflang_correct"] },
    { "slug": "fast-on-phones",
      "name": "Make location pages fast on phones",
      "description": "Location pages show their main content within 2.5 seconds on mobile and pass Google's mobile-friendly test.",
      "effort": "Performance work",
      "checks": ["seo.lcp_sample", "seo.mobile_friendly"] },
    { "slug": "text-for-ai",
      "name": "Give AI assistants a text version of your site",
      "description": "A plain-text guide at /llms.txt and Markdown versions of pages on request, so AI assistants read your own words instead of third-party summaries.",
      "effort": "One developer task",
      "checks": ["aio.llms_txt_present", "ar.llms_txt_full", "aio.markdown_content_negotiation", "ar.markdown_content_negotiation"] },
    { "slug": "answers-on-page",
      "name": "Answer customers' questions on the page itself",
      "description": "Question-and-answer content, quick answers, speakable sections and author signals that AI search can quote directly.",
      "effort": "Content task",
      "checks": ["aio.faqpage_schema_2_types", "aio.quick_answer_first_200w", "aio.speakable_specification", "aio.eeat_article_signals", "aio.haspart_about_mentions_enrichment"] },
    { "slug": "agent-front-door",
      "name": "Tell AI agents what they may do and give them a front door",
      "description": "Content signals in robots.txt plus the well-known files (MCP server card, agent skills, API catalog, link headers) that tell AI agents what they may do and where to start.",
      "effort": "A few small files",
      "checks": ["ar.content_signals_robots", "ar.mcp_server_card", "ar.webmcp_tools_registered", "ar.agent_skills_discovery", "ar.api_catalog", "ar.rfc8288_link_headers"] },
    { "slug": "connect-listings",
      "name": "Connect every listing through PinMeTo",
      "description": "Every location's Google, Apple and Bing listing exists and is connected through PinMeTo, with no duplicates or stale closed pages.",
      "effort": "PinMeTo task, no code",
      "checks": ["geo.listing_connected_pinmeto", "geo.location_platform_parity"] },
    { "slug": "same-details-everywhere",
      "name": "Same name, address, phone and pin everywhere",
      "description": "Name, address, phone, website, hours and map pin agree across the PinMeTo record, every map platform and the location page.",
      "effort": "Fix the record in PinMeTo, then the page",
      "checks": ["geo.name_matches_site", "geo.address_matches_site", "geo.phone_matches_site", "geo.website_url_on_listing", "geo.coords_within_50m", "consistency.name", "consistency.address", "consistency.coords_50m_cluster", "page.jsonld_name_matches_dominant", "page.jsonld_telephone_matches_dominant", "page.jsonld_geo_within_50m_dominant", "page.opening_hours_matches_dominant", "page.visible_nap_matches_dominant"] },
    { "slug": "fresh-google-listings",
      "name": "Keep each Google listing complete and fresh",
      "description": "Each Google listing shows hours, holiday hours, five or more photos, services, recent reviews and no consumer alerts.",
      "effort": "Ongoing, no code",
      "checks": ["geo.hours_present", "geo.special_hours_set", "geo.photos_5_plus", "geo.services_attributes", "geo.menu_order_reservations", "geo.recent_reviews_180d", "geo.consumer_alerts_clear"] }
  ]
}
```

Known duplicates and where they collapse: llms.txt ×2 and markdown negotiation ×2 →
`text-for-ai` · sitemap ×2, breadcrumbs ×2, canonicals ×2 → `crawlable-site` · JSON-LD ×3 →
`location-data-in-code` · NAP across sub-groups A, B and C → `same-details-everywhere`.

**Maintenance rule (keeps the mapping total).** The mapping is pinned to the rubric version
through `theme_mapping_for_rubric_version` and is updated in the same change as any rubric
bump:

1. The mapping lives as this machine-readable JSON block in `artifact-report.md` (not a new
   file, not prose only) and pins `theme_mapping_for_rubric_version`.
2. The pre-publish sanity check above (conditions (a) to (d), run by
   `scripts/check-references.mjs --scan`) fails when the mapping and the rubric disagree, and any
   failure blocks publishing. There is no "Other" catch-all Theme: a catch-all would hide
   exactly the drift this rule exists to catch, in front of a customer.
3. `rubric.md`'s version-bump paragraph states that bumping the rubric version requires
   updating the Theme mapping and its pinned version.

## Writing style inside the report

The report is a diagnostic the customer trusts, written for a brand-side marketer or
webmaster with two jobs: a work list (what do I fix) and a progress story (what improved).
Two tiers of rules: a baseline for every reader-facing word, then templates for the Layer 1
surfaces. Fix-brief drawer text follows its own contract above.

### Baseline (all reader-facing prose)

- **Voice.** Sober, concrete, advisory. Address the brand as "you". State what was observed
  and what it costs; never promise rankings, traffic, or revenue. Evidence quotes the observed
  value rather than describing it. No exclamation marks.
- **PinMeTo brand tone rules apply.** No em dashes; use commas, periods, colons, or
  parentheses. No hype vocabulary: the brand's banned list governs, and the pinmeto-brand
  plugin's ai-slop-guards reference carries it in full for every language. No
  "not just X, it's Y". Sentence case in every heading and label; nothing in the report is
  set in uppercase. Say "customer", never "client".
- **warn is never a failure.** Checks that could not be measured are always labelled so;
  prose never counts them among failures or passes.
- **PinMeTo is named only where the fix happens in PinMeTo** (the two GEO listing Themes),
  in the re-run prompt, and in the footer. Progress is credited to the observed change, never
  to PinMeTo: "GEO gained 3 points after the Apple listings were connected", not "thanks to
  PinMeTo".
- **The location noun.** Every fixed string (Theme names, effort labels, count tags, section
  headings, table headers) says "location". Per-scan prose (summary, Theme summaries,
  evidence, trend bullets) may use the kind-specific noun the brand uses for itself (shops,
  restaurants, charging stations) when every sampled location shares one PinMeTo primary
  category. Mixed or unknown kinds say "location".
- **Numbers.** Every count comes from this scan's evidence and names its denominator when it
  is a sample ("3 of the 5 checked locations"); never extrapolate to the fleet. Integers only.
  Numbers one to twelve are words when they open a sentence, digits elsewhere. The summary
  carries at most one score pair (from and to); all other scores live in the hero,
  pillar scores, points bar and trend. **Every data-driven string agrees with its own number.** The templates
  below are written in the plural because that is the common case; at one, render the singular:
  `Worth ~1 point`, `1 check`, `pays in 1 pillar`, `Copy all 1 brief`, `One theme cleared since
  your first scan on <date>`, `Up 1 point since your first scan on <date>`, `+1 since <date>`,
  and `One theme, worth ~1 point` in the Themes lede, which also drops its "together" at a single
  Theme. A pill reading "Worth ~1 points" is the tell that a count was pasted into a fixed
  string instead of rendered from the data. A one-point move is the most likely delta a re-run
  will ever print, so the trend headline meets this first.
- **Technical names.** None in Layer 1 headlines. A Theme summary or summary sentence may
  name one file or standard, once, right after the plain-language phrase ("a text guide at
  /llms.txt"), and only when the reader will need the word to brief a developer. Check ids
  never appear in Layer 1.
- **Language.** English by default. When the user asks for another language, every
  reader-facing string renders in it; product names stay English. The page records the
  language in `<html lang>`; a re-run renders in the same language and reuses the existing
  report's Theme headlines (read back by `theme-<slug>` anchor) so names stay stable.

### Layer 1 templates

- **Band word.** One of Strong / Healthy / Needs work / Critical, never rephrased.
- **Summary.** Two paragraphs, two or three sentences each. Paragraph 1: what is strong,
  then what holds the score back. Paragraph 2: the shape of the effort ("one template change,
  not fourteen page edits"), and from the second scan on, what moved since the previous scan
  with the one allowed score pair. First scan: paragraph 2 is effort shape only and ends with
  the sentence "This scan is your baseline; the next one shows what moved." Never invent a
  "since" clause.
- **Theme headline.** The Theme's `name` from the mapping table, verbatim, every scan. Names
  are written as a change the reader can picture (Put, Make, Let, Give, Keep, Tell, Connect),
  name the outcome rather than the check, and contain no technical token. Twelve words is the
  target; `scripts/check-references.mjs` rejects a name above thirteen.
- **Theme summary.** Exactly two moves in one or two sentences, forty words or fewer.
  First the observation with its count from the evidence ("Eleven location pages share the
  same title and heading"), then the consequence in the customer's terms ("so Google picks one
  at random for 'bike shop Malmö'"). Never a third sentence, and never the fix: the effort
  label and the Theme brief carry that.
- **Effort label.** The Theme's `effort` from the mapping table, verbatim. Each names the size
  of the job and who does it, in eight words or fewer. The closed set is enumerated under
  "Effort labels" below, its one home in this file; pre-publish sanity check condition
  (d) is that every `effort` in the mapping is in that set.
- **Themes heading and lede.** The h2 is the fixed string "What to fix, in this order". The
  lede opens `<Count> themes, worth ~<summed points> points together`, count in words, and
  continues with the fixed ranking sentence given under "Section order".
- **Theme row facts.** Label-and-value cells (Effort, Pays in, Failing checks, Status) on the
  expanded row; `~<N> pts` and the effort label on compact rows. Never a middle-dot string.
- **Trend prose.** One template for movement in either direction, no adjectives, no
  attribution. The "What moved" bullets come mechanically from the checks diff, each
  classified as rubric change, measurement correction, or real change, and credit the change
  that moved the score.
- **Trend headline, since the first scan.** `Up <n> points since your first scan on <date>` /
  `Down <n> points since your first scan on <date>` /
  `Unchanged since your first scan on <date>`. One template up or down, and the date is the
  first scan's, never "six months ago".
- **Trend subline, since the previous scan.** `+<n> since <previous scan date>` /
  `−<n> since <previous scan date>` / `No change since <previous scan date>`. Dropped when the
  report has exactly two scans, where it would only repeat the headline.
- **Themes cleared line.** `<count> themes cleared since your first scan on <date>: <name>,
  <name>`, the names being the mapping `name` verbatim, most recently cleared first. Omitted
  when nothing has cleared: the report never prints "0 themes cleared". A Theme that fails
  again is **reopened** in the "What moved" callout, in the same words as progress.

### Effort labels

The closed set of eight **effort labels**. An effort label names the size of a Theme's fix and
who does it; it is never rewritten per scan. `scripts/check-references.mjs` reads the quoted
strings in this section as the set, and this section is their only home in the file, so keep
it to the list:

- "One template change"
- "One developer task"
- "Performance work"
- "Content task"
- "A few small files"
- "PinMeTo task, no code"
- "Fix the record in PinMeTo, then the page"
- "Ongoing, no code"
