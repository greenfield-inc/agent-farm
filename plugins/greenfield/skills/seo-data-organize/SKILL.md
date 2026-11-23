---
name: seo-data-organize
description: "(support) Archive and organize .seo/ data into a dated wiki structure for historical tracking. This is a support skill that runs at the end of any SEO workflow. It archives the current .seo/ working data into a dated, browsable wiki structure so nothing gets lost and you can track SEO progress over time. Other SEO skills should call this as their final step."
---

# SEO Data Organize

Archive and organize `.seo/` working data into a dated, browsable wiki
structure. Runs at the end of any SEO workflow so data accumulates into a
searchable history instead of getting overwritten.

This is a support skill: run it as the last step of each SEO workflow.

## Goal

Over time, `.seo/` becomes a self-organized wiki of SEO data:
- Every briefing, strategy, and content decision is dated and preserved
- You can look back at any week and see what the data said
- Experiments and their outcomes are tracked
- The current working state is always clean and fresh

## Directory structure

```
.seo/
  data/                          # current working data (from seo-data-pull)
    manifest.md
    analytics.md
    search-console.md
    seo-tool.md

  briefing.md                    # current working briefing
  strategy.md                    # current working strategy

  archive/                       # dated snapshots (this skill creates these)
    2026/
      06/
        24/
          briefing.md
          strategy.md
          data/
            manifest.md
            analytics.md
            search-console.md
            seo-tool.md
        10/
          briefing.md
          ...
      05/
        27/
          briefing.md
          ...

  experiments/                   # one file per experiment
    2026-06-24-windows-landing-page.md
    2026-06-10-remote-workspaces-blog-post.md

  index.md                       # auto-generated table of contents
```

## Steps

### 1. Archive current working data

If `.seo/briefing.md` or `.seo/strategy.md` exist:
- Create the dated archive directory: `.seo/archive/YYYY/MM/DD/`
- Copy `briefing.md` and `strategy.md` into the archive. Copy `data/*` to the
  raw store's `archive/YYYY/MM/DD/data/` instead: it holds raw pulls, which
  stay on this machine, as the data pull's **Persisting .seo/ data** section
  says
- Don't move them. Copy. The working files stay for the next skill that needs them.

**Success criteria**: Today's data is preserved in the archive. Working files still exist.

### 2. Track experiments

Experiments live in `.seo/experiments/`, one file per experiment. If the repo
still has an older layout, migrate it once, in one commit, before anything
reads the folder: a single `.seo/experiments.md` is split into one file per
entry, and a file in `.seo/experiments/` with no frontmatter (the older
per-file format) gets the frontmatter below. Either way, keep every original
date and result, and set `live` to the date the change actually shipped,
because the migration commit's date is not the ship date.

Scan the current strategy and any PRs merged since the last organize run.
For each new piece of content created or significant change made with no
experiment file yet:
- Create an experiment file: `.seo/experiments/YYYY-MM-DD-short-name.md`
- Record the hypothesis, the pages, the baseline (its source and date window),
  what stays unchanged, the control pages, and a link to the strategy
- Set `live` to the date the change shipped (its PR's merge date, or the
  deploy date when deploys happen by hand). A record written after the change
  shipped would otherwise date its reads from the day the record was written

Experiment files open with this frontmatter:

```markdown
---
id: 2026-06-24-windows-landing-page
hypothesis: <one sentence>
pages: [/windows]
live:            # the ship date; required when the record is written after the change shipped or deploys happen by hand
read_21:         # empty until the 21-day read is done, then the date it was done
read_42:         # same for the 42-day read
status: running  # running | read | closed
---
```

The ship date is `live` when present. Otherwise it is the committer date of
the first-parent commit on the default branch that added the file. A read is
due from 21 or 42 days after the ship date plus 3 days of Search Console lag.
A read is past due when it is due, its field is empty and `status` is
`running`.

**Success criteria**: Every content action from this cycle has an experiment file.

### 3. Update the index

Regenerate `.seo/index.md` as a table of contents:

```markdown
# SEO Data Index

## Latest
- [Current briefing](briefing.md): YYYY-MM-DD
- [Current strategy](strategy.md): YYYY-MM-DD

## Archive
- [2026-06-24](archive/2026/06/24/): briefing, strategy, data
- [2026-06-10](archive/2026/06/10/): briefing, strategy
- ...

## Active Experiments
- [windows-landing-page](experiments/2026-06-24-windows-landing-page.md): running, 21-day read due 2026-07-18
- [remote-workspaces-blog-post](experiments/2026-06-10-remote-workspaces-blog-post.md): running, 42-day read due 2026-07-25
- ...

## Data Sources
- [Current manifest](data/manifest.md): what's connected
```

**Success criteria**: `.seo/index.md` is up to date and links to everything.

### 4. Clean stale working files

If working files in `.seo/` are older than 7 days and have been archived,
note them as stale in the index. Don't delete them automatically.

**Success criteria**: Stale data is flagged but not destroyed.
