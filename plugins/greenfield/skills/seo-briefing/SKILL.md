---
name: seo-briefing
description: "(proactive) Pull analytics from PostHog, GSC, and Ahrefs. Correlate data and produce an actionable SEO briefing. Use when the user wants an SEO status report, morning briefing, analytics overview, or wants to understand how their site is performing. Examples: 'SEO briefing', 'how is the site doing', 'pull analytics', 'morning report', 'check indexing status', 'what keywords are we ranking for'."
---

# SEO Briefing

Pull data from all connected analytics sources, correlate it, and produce a
single actionable briefing. This is the CEO morning report for SEO.

## Data sources

The more sources connected, the better the briefing. At minimum, you need
analytics (PostHog, GA4, Plausible, etc.) and search data (GSC). Keyword/backlink
data (Ahrefs, Semrush) makes the briefing significantly more actionable.

Check what's available through the connected tools or direct API access.
If a source isn't connected, skip that section and note the gap in the briefing
so the user knows what they're missing.

## Goal

Produce `.seo/briefing.md` with:
1. What's working (traffic up, rankings improving, new keywords)
2. What's not working (traffic down, pages not indexed, rankings dropping)
3. What to do about it (specific, prioritized action items)

Every claim must cite the data source and specific numbers. No vibes.

## Steps

### 1. Run seo-data-pull

Run `seo-data-pull` to discover connected sources and pull fresh data into
`.seo/data/`. If `.seo/data/manifest.md` exists and is less than 24 hours old,
skip the pull and use the cached data.

**Success criteria**: `.seo/data/` exists with analytics, search console, and/or SEO tool snapshots.

### 2. Check for active experiments

Experiments live in `.seo/experiments/`, one file per experiment. If the repo
still has an older layout, migrate it once, in one commit, before anything
reads the folder: a single `.seo/experiments.md` is split into one file per
entry, and a file in `.seo/experiments/` with no frontmatter (the older
per-file format) gets frontmatter with the fields below. Either way, keep every original
date and result, and set `live` to the date the change actually shipped,
because the migration commit's date is not the ship date.

Each file's frontmatter holds `id`, `live` (optional), `read_21`, `read_42` and
`status`. Work out which reads are due:
- The ship date is `live` when present. Otherwise it is the date the record
  landed on the default branch: the committer date of the first-parent commit
  that added the file (`git log <default-branch> --first-parent --diff-filter=A --format=%cs -- <file>`).
- The 21-day read is due from ship date + 21 days + 3 days, and the 42-day read
  from ship date + 42 days + 3 days. The 3 days cover Search Console's data lag.
- A read is past due when it is due, its field (`read_21` or `read_42`) is
  empty, and `status` is `running`. Before its due date a read is too early;
  report the due date instead.

List every past-due read in the briefing with its experiment, read and due
date. A read counts as done only when it was run the controlled way, so a
quick look at the fresh numbers never fills `read_21` or `read_42`. When the
briefing is asked to run a due read itself, run it exactly as the Reads
section of seo-experiments says (its windows, its control, which leaves out
the homepage when brand searches dominate, and its credit rule), then write
the read into the experiment file as that skill's "Writing a read" says and
set `read_21` (or `read_42`) to today's date. When seo-experiments is not
available to you, do not run the read: list it as due for the measurer.

List experiments with no read due yet in the briefing under "Running
Experiments", with the date each next read is due.

**Success criteria**: Every past-due experiment has a measured outcome. Active experiments are listed.

### 3. Correlate and produce briefing

Cross-reference the three data sources:
- Pages with high impressions but no clicks -> title/description problem
- Pages with traffic drops + ranking drops -> content quality or competition
- Pages not indexed -> list them with their URL Inspection links so the person can request indexing
- New pages indexed + gaining traffic -> working, do more like this
- Competitor keywords you don't rank for -> content gaps to fill
- High-traffic pages with poor readability -> readability pass candidates

Write `.seo/briefing.md` with sections:

```markdown
# SEO Briefing: [date]

## Summary
3-5 bullet executive summary

## Traffic (PostHog)
Numbers, trends, top pages, biggest movers

## Search Performance (GSC)
Queries, impressions, clicks, CTR, position trends

## Indexing Status
Pages indexed, not indexed, recently submitted, errors

## Rankings (Ahrefs)
Keyword positions, movement, new/lost keywords

## Backlinks (Ahrefs)
New/lost, referring domains, domain rating

## Content Gaps
Keywords competitors rank for that we don't

## Running Experiments
Active experiments from `.seo/experiments/` with no read due yet, and the date each next read is due.

## Experiment Results
Experiments with a 21-day or 42-day read done this run, with measured before/after metrics.

## Action Items (prioritized)
1. [specific action]: [why], [expected impact]
2. ...
```

**Success criteria**: Briefing written with every claim citing a data source and number. Action items are specific and prioritized.
**Artifacts**: `.seo/briefing.md` feeds into `seo-content-strategy`.

## Committing .seo/

After writing the briefing, commit `.seo/` to the working branch and push, as
the data pull's **Persisting .seo/ data** section says: the briefing, the
experiments and the other reviewed files, never the raw pulls under
`.seo/data/` or `.seo/archive/`.
