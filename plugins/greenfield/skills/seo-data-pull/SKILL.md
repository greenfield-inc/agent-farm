---
name: seo-data-pull
description: "(support) Discover connected analytics sources, pull data, write .seo/data/ snapshots, and visualize results with deltas vs prior pulls. This is a support skill. Don't invoke it directly. Other SEO skills (seo-briefing, seo-readability-pass, seo-authority-pass, seo-content-strategy, seo-content-drafting) call it as their first step when they need fresh data. If .seo/data/ is stale or missing, any SEO skill should run this first."
---

# SEO Data Pull & Visualize

Discover what analytics, search, and SEO tools are connected, pull data from
all of them, write structured snapshots to `.seo/data/`, and present a
formatted visualization with deltas vs prior pulls.

This is a support skill. It runs as the initial stage of other SEO skills,
not as a standalone workflow.

## Goal

1. Produce `.seo/data/` with fresh snapshots from every connected source.
2. Compare against the most recent prior snapshot and compute deltas.
3. Present a formatted summary to the user (not just files, a readable dashboard).

If a source isn't connected, note the gap. Never fail because a source is
missing. Work with what's available.

## Steps

### 1. Read prior snapshot

Before pulling new data, check for the most recent prior snapshot:
- Read `.seo/data/manifest.md`. Check the timestamp. If fresh (<24h), skip
  the full pull and jump to Step 7 (visualize from existing data).
- Read `.seo/archive/`. Find the most recent dated directory (e.g.,
  `.seo/archive/2026/06/24/data/`). If one exists, read the prior
  `analytics.md` and `search-console.md` to extract baseline numbers for
  delta comparison.
- If no prior snapshot exists, this is the first pull. Deltas show as "N/A".

Store the prior metrics in memory for use in Step 7.

**Success criteria**: Know the prior pull's key metrics (clicks, impressions,
pageviews, visitors, downloads) or know this is the first pull.

### 2. Discover connected sources

Check what analytics, search, and SEO tools are available:
- PostHog, GA4, Plausible, or similar analytics (MCP or API)
- Google Search Console (MCP or API)
- Ahrefs, Semrush, or similar through a connected tool or direct API
- GitHub API (for stars, forks if this is an open-source project)
- Package registries (npm, PyPI) if the project publishes packages
- Any other relevant MCP tools

List what's connected and what's not.

**Then discover the schema.** Don't assume generic `$pageview` is all that's
available. Query the analytics source for:
- Custom event names (e.g., `download_started`, `signup`, `cta_clicked`)
- Available person-level properties (e.g., `git_email`, `plan`, `company`)
- Available event-level properties (e.g., `$referring_domain`, `$geoip_org`)

This discovery step makes the pull intelligent without hardcoding any specific
project's schema. A project with `download_started` events gets download
funnels; a project without them gets pageview-only analytics.

**Success criteria**: Know exactly which sources are available AND what data
dimensions each source can provide.

### 3. Pull analytics data

From whatever analytics source is connected, pull everything the discovered
schema supports:

**Core (always pull):**
- Total pageviews and unique visitors (30-day and 7-day)
- Daily unique visitors for the last 7 days
- Top pages by views (top 25)

**Referrers (always pull):**
- Top referring domains (top 20, 7-day)
- LLM channel breakdown: filter referrers for known LLM domains
  (chatgpt.com, gemini.google.com, perplexity.ai, www.perplexity.ai,
  claude.ai, kagi.com, copilot.microsoft.com): show views and uniques

**If custom conversion events exist (discovered in Step 2):**
- Conversion counts (today, 7d, 30d)
- Top referrers for conversion events specifically
- Conversion events broken down by page/source

**If person-level properties exist:**
- Segment users by whatever meaningful properties are available (role,
  company domain, plan tier, etc.)
- Show top segments by session count and recency

**If geo/org properties exist on events:**
- Top organizations or networks by conversion events
- Geographic distribution

**If the project has published packages (discovered from package.json, setup.py, or project config):**
- Pull download stats from the relevant registry API
- Show trend (daily, weekly, monthly as available)

**If a public code repository exists (discovered from project config):**
- Stars, forks, watchers, open issues

Write everything to `.seo/data/analytics.md`.

If no analytics source is connected, write a stub noting the gap.

**Success criteria**: `.seo/data/analytics.md` exists with the deepest data
the discovered schema supports (not just pageviews).

### 4. Pull search console data

From Google Search Console (if connected):
- Total impressions, clicks, CTR, avg position (28-day window)
- Daily trend for the last 10 days
- Top queries by clicks (top 30)
- Top pages by clicks (top 30)
- Pages with high impressions but low CTR (opportunities)
- New pages that recently appeared in search results
- Queries with improving/declining position (if prior data available)

Write to `.seo/data/search-console.md`.

**Success criteria**: `.seo/data/search-console.md` exists.

### 5. Pull SEO tool data

From Ahrefs, Semrush, or similar (if connected):
- Current keyword rankings and movement
- New keywords appeared for
- Lost keywords
- Competitor keyword gaps
- Backlink profile: new/lost, referring domains
- Domain rating trend

Write to `.seo/data/seo-tool.md`.

If no SEO tool is connected, write a stub noting the gap and what data
is therefore unavailable.

**Success criteria**: `.seo/data/seo-tool.md` exists.

### 6. Write the data manifest

Write `.seo/data/manifest.md` listing:
- Which sources were connected and pulled
- Which sources were missing (and what data is therefore unavailable)
- Timestamp of the pull
- Schema discovered (custom events, person properties, package names)
- Recommended actions to connect missing sources

**Success criteria**: `.seo/data/manifest.md` exists. Any SEO skill can read
this to know what data is available.

### 7. Visualize: present formatted summary with deltas

This is the most important step. Do NOT skip it. After writing the data files,
present a formatted dashboard to the user. This output goes directly into the
conversation. It is NOT written to a file.

**Format:**

```
## Dashboard: {date}

### Headlines

| Metric           | Current | Prior  | Δ       |
|------------------|---------|--------|---------|
| GSC clicks (28d) | 687     | 648    | +6% ▲   |
| Impressions      | 18,521  | 17,696 | +5% ▲   |
| Pageviews (30d)  | 6,199   | 5,800  | +7% ▲   |
| Unique visitors  | 2,387   | N/A    | N/A     |
| Downloads (7d)   | 1,109   | 980    | +13% ▲  |
| Stars            | 236     | 224    | +12 ▲   |

### Top Pages (GSC)

| Page | Clicks | Imp | CTR | Pos |
|------|--------|-----|-----|-----|

### Referrers (7d)

| Source | Views | Uniques |
|--------|-------|---------|

### LLM Channel (7d)

| Source | Views | Uniques |
|--------|-------|---------|

### User Segments (if person properties discovered)

{render whatever segments the schema discovery found: work emails,
plan tiers, geo clusters, org names. Adapt the table shape to the data.}

### Notable Changes
- {bullet points highlighting what moved, new entries, records}

### Instrumentation Suggestions

{Based on what the schema discovery found AND what it didn't find,
suggest 1-3 concrete, platform-agnostic improvements that would make
future pulls richer. Focus on gaps that block clearer funnels or
audience understanding.}

Examples of good suggestions:
- "No conversion event found. Adding a `signup_completed` or
  `download_started` event would let future pulls show conversion
  rates by page and referrer."
- "Person properties have no company/org field. Enriching users with
  a `company` or `domain` property (via reverse-email lookup, form
  field, or SSO claim) would unlock audience segmentation by org."
- "Referrer data exists but no UTM parameters are tracked. Adding
  `utm_source`/`utm_medium`/`utm_campaign` to links would separate
  organic from paid and show which campaigns drive conversions."
- "Pageviews exist but no session-level events (session_start,
  session_end). Adding session tracking would enable time-on-site
  and bounce rate metrics."
- "Conversion events exist but aren't tied to the page that drove
  them. Passing `source_page` or `referrer_path` as a property on
  conversion events would close the attribution loop."

Rules for suggestions:
- Only suggest what the CURRENT schema is missing. Don't repeat
  suggestions for things already tracked
- Be specific about what to name the event/property and what it
  unlocks ("would let future pulls show X")
- Keep it to 1-3 suggestions, prioritized by impact on funnel
  clarity or audience understanding
- These are suggestions, not demands. The user accepts or ignores
  them, and the skill adapts to whatever schema exists next time
```

**Delta rules:**
- If a prior snapshot exists, compute percentage change for numeric metrics
- Use ▲/▼ arrows for direction
- Bold any metric that changed >10%
- If this is the first pull, show "N/A" for Prior and Δ columns
- Highlight new entries that didn't exist in the prior snapshot (new pages
  indexed, new users, new queries appearing)
- For absolute counts (stars, forks), show +N instead of percentage

**Success criteria**: The user sees a formatted, scannable dashboard in the
conversation with deltas highlighted, plus actionable suggestions for
improving their instrumentation over time.

### 8. Note experiment baselines

If `.seo/experiments/` exists (one file per experiment), check if any
experiments reference pages or queries that were just pulled. A read is due
from 21 or 42 days after the ship date plus 3 days of Search Console lag; the
ship date is the `live` frontmatter field when present, else the committer date
of the first-parent commit on the default branch that added the file. When a
read is due, its `read_21` or `read_42` field is empty and `status` is
`running`, flag it in the manifest as "experiment awaiting measurement" so the
briefing skill knows to evaluate it.

**Success criteria**: Manifest notes any experiments that need evaluation.

## Staleness

Data snapshots are considered stale after 24 hours. If `.seo/data/manifest.md`
exists and its timestamp is within 24 hours, other skills can skip re-pulling
and jump directly to Step 7 (visualize from existing data).
If it's older, re-run from Step 1.

## Persisting .seo/ data

Commit the reviewed parts of `.seo/` to the working branch: foundations,
strategy, briefing, the fact ledger, experiment records and the index. They
are the record later runs measure against, so never leave them untracked.

Raw pulls live on this machine and never leave it through the repository.
This is the one raw-data rule; the other SEO skills point here.

- The raw store is the product's local folder: `data/` under the `memory`
  path the SEO loop's due script prints with `--check`, and
  `archive/YYYY/MM/DD/data/` there for dated copies. Without the due script,
  it is `~/.local/state/agent-farm/seo/<repository name>/`. Later runs in
  other worktrees diff against it instead of pulling again.
- Before the first pull in a worktree, point `.seo/data` at the raw store.
  When `.seo/data` is a real directory, move its untracked files into the
  store's `data/` and remove the directory first; then run
  `ln -s <store>/data .seo/data` and confirm `test -L .seo/data`. Write
  nothing raw until that check passes.
- Nothing raw is committed, pushed or put in a PR. `.seo/data` (no trailing
  slash, so the link is ignored too) and `.seo/archive/**/data/` are in
  `.gitignore`. When `git ls-files .seo/data .seo/archive` lists raw files
  that an older run committed, remove them from the index
  (`git rm -r --cached <path>`) in the next `.seo/` PR and say in it that
  they stay in the repository's history.
- Stage reviewed files by path, never `git add .seo` or `git add -A`. Before
  every push, run `node <this skill's directory>/scripts/raw-guard.mjs --base
  origin/<default branch>`. It checks every commit the push would publish, so
  a raw file added in one commit and deleted in a later one still counts, and
  it allows deleting raw files the default branch already has. When it exits
  1, rewrite the branch so no commit adds the files it names, then push.
- What a briefing, read or experiment record cites from a pull is a reviewed
  aggregate, and that is committed.

## Analytics API Notes

Different analytics platforms have different API surfaces. Some have multiple
(legacy and modern). During the discovery step, test which API surface works
and note it in the manifest. If one endpoint returns errors, try alternatives
before reporting the source as unavailable.

## Committing .seo/

Commit `.seo/` as **Persisting .seo/ data** says: the reviewed files, never the raw pulls.
