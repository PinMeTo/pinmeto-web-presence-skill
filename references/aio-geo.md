# AIO / GEO rubric — AI visibility for local intent

**AIO** (AI Optimization / AI visibility) = does an AI assistant surface the brand correctly?
**GEO** (Generative Engine Optimization) = the signals that make the brand *citable* by it.
The two are the same coin: fix the GEO signals to improve AIO outcomes.

## Signals to evaluate (GEO — the inputs)

- **Entity consistency across the web.** The brand and each location present the *same* NAP,
  category, and hours on the site, Google/Facebook/Apple profiles, and major directories.
  LLMs synthesize across sources; conflicting facts get averaged into wrong or hedged answers.
  Cross-check the live signals against the PinMeTo baseline.
- **Machine-liftable structured data.** Valid `LocalBusiness` JSON-LD with `sameAs`, `geo`, and
  `openingHoursSpecification` gives a generative engine clean facts to quote. Prose-only pages
  force it to guess.
- **Answer-shaped content.** Pages that directly answer local questions ("opening hours",
  "parking", "is there a location in <city>") are more quotable than marketing copy.
- **Review coverage & recency.** Volume, rating, and freshness (from PinMeTo ratings) feed the
  "is this place real and good?" judgement assistants make.
- **Authoritative corroboration.** `sameAs` links and presence in reputable directories raise
  the confidence an engine has in citing the brand.

## Outcomes to probe (AIO — the results)

Where the host's web tools allow, run a few representative assistant-style local queries and
record how the brand appears — cited, mentioned-uncited, absent, or **misrepresented** (wrong
address/hours). Suggested probes:

- "Is there a `<brand>` in `<city>`? What are the opening hours?"
- "Where's the nearest `<brand>` to `<landmark>`?"
- "`<brand>` `<city>` phone number / address"

Classify each: **cited & correct** / **mentioned but incomplete** / **absent** /
**misrepresented**. A *misrepresented* result is a **Critical** finding — the AI is actively
telling customers something wrong — and almost always traces back to a NAP/hours inconsistency
Stage 1–3 already flagged.

Be explicit in the report that AI answers are non-deterministic and vary by assistant and over
time; probes are a spot check, not a ranking.
