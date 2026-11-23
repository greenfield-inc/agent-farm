---
name: seo-experiments
description: "Use when a search change is planned, shipped or due for a read: write its experiment record in .seo/experiments/, find which reads are due with scripts/due.mjs, and read each change at 21 and 42 days against a control group."
---

# SEO experiments

Every change to a public page is a bet. Write it down before it ships, read it at 21 and 42 days against pages it did not touch, and write the result back, including Failed. Without a dated baseline and a comparison group, a change that moved with the whole site reads as a win.

The record format and examples with real numbers are in [references/experiment-record.md](references/experiment-record.md). Lessons and corrections behind each rule are in the `seo-evidence` skill.

## The .seo/ folder

The product's repository holds all SEO state under `.seo/`. Roles write it only on their own branch and draft PR, never on the default branch.

| Path | Holds | Written by |
|---|---|---|
| `.seo/access.md` | Access tier (Public, Search, Analytics, Full), each data source and whether it is connected, the review cadence, the default branch, and whether deploys happen on merge or by hand | The first role that opens a `.seo/` PR |
| `.seo/facts.md` | The fact ledger: claim, source, date, owner, approval, allowed wording | Strategist, from page briefs |
| `.seo/experiments/<YYYY-MM-DD>-<slug>.md` | One experiment record per file (this skill) | Writer on the change's PR; measurer for results |
| `.seo/answer-panel/` | The frozen answer-panel definition and its dated runs | Measurer |
| `.seo/foundations.md`, `.seo/data/`, `.seo/briefing.md`, `.seo/strategy.md`, `.seo/archive/YYYY/MM/DD/`, `.seo/index.md` | Foundations, data pulls, briefings, strategy and their dated archive | The existing SEO skills, as they already do |

## Choosing what to test

Score each candidate change on Demand, Conversion and Effort, 1 to 5 each, 15 at most; Effort scores highest when the change is cheapest. Skip any candidate with no data signal behind it. Test the top scorers, within the three-per-review cap below.

Every review opens with seven headline metrics, each against the previous review: the first conversion step (visit or download to first use), that conversion split by platform, the engagement north star (cumulative time or actions in the product), monthly and weekly active users, adoption by company, visits referred by AI assistants, and onboarding completion. A review that skips one says why. (Product A site growth skills, measure and decide-execute, read 2026-11-21.)

## When to open a record

- **One record per change, written before it ships.** The writer adds the record in the same PR as the change, so the record lands on the default branch when the change does.
- **One change at a time per page.** A page in a running experiment gets no other change until its 42-day read. Stacked changes cannot be told apart.
- **At most three new experiments per review.** Reviews run monthly by default and weekly when the product has weekly lead outcomes (accepted leads, booked demos). The cadence lives in `.seo/access.md`. Search reads lag three to six weeks, so more bets than this outrun the reads.
- **Small batches.** A batch of new pages is 5 to 15 pages, one topic each, and counts as one experiment. Product A's evidence said this, and two weeks later it shipped 54 alternatives pages in one night in four batches; their indexing was never checked (Source: "Growth, phase by phase" (v2, 2026-11-04), Phase 3).
- **Check the intent ceiling before a title test.** Title rewrites rarely fix a page whose query Google already answers. Product A's five-page rewrite of 2026-06-25 moved combined CTR from about 0.47% to 0.62% against a 2% to 3% scenario (Source: Product A SEO experiments log, 2026-06-14 to 2026-08-05).
- **Set expectations by site age.** Product A, a new site, saw its first signal 8 to 12 weeks after its first pages; Product B, a known brand, 4 to 6 weeks. Labelled "likely, not proven" (Source: "Growth, phase by phase" (v2, 2026-11-04), "Where they differed"). On a new site, a 42-day read of new pages may show nothing yet: say so in the expectations.

## The record

Each record starts with this frontmatter. The due script reads it; keep the keys exactly.

```
---
id: 2026-10-06-retitle-pricing
hypothesis: <one sentence>
pages: [/pricing]
live: 2026-10-08        # optional; see "Ship date"
read_21: 2026-11-02     # empty until the 21-day read is recorded; then the date it was done
read_42:                # same for the 42-day read
status: running         # running | read | closed
---
```

A comment starts with a space, `#` and a space. Write `PR #187` without a space after `#`.

The body has these sections, in this order:

1. **Hypothesis**: one sentence: "If [change] helps [searcher] do [job], then [signal] should improve on [pages] within [window]."
2. **What changed**: the exact change, its PRs and merge commits.
3. **Pages**: every URL the change touches, with its page type.
4. **Baseline**: the source (the connected Search Console / analytics tool), the window as two absolute dates, and the numbers. Zero is a valid baseline for a new page.
5. **What stays unchanged**: what on these pages and elsewhere must not change until the 42-day read.
6. **Control**: the comparison group and how it was chosen (see "Reads").
7. **Confounders**: what else could move the numbers: other launches, seasonality, a data gap, a competitor's news, page age.
8. **Minimum window**: 42 days, longer for a page family on a new site.
9. **Expectations**: each labelled a scenario, a guess or a range, anchored to a comparable already measured. Never a forecast.
10. **Stop, continue, expand**: what result at 42 days means stop and revert, keep watching, or ship more of the same.
11. **Results**: one subsection per read (see "Writing a read").

## Ship date

- The ship date is the date the record landed on the default branch: the committer date of the first-parent commit that added the record file.
- Set `live` when the change went live on a different day from that commit: when deploys are manual (use the first successful deploy run containing the merge commit; Product B had a page merge 2026-04-25 and go live 2026-05-06), for a record imported from a legacy log, and for a record written later for a past change. Then `live` is the ship date.
- A change reverted before any deploy was never live and gets no reads. Close its record with the reason.

## Reads

Each change is read twice. Search Console data lags about 3 days.

| Read | Window | Runnable from | Role |
|---|---|---|---|
| 21-day | ship date to ship + 21 days | window end + 3 days | Early read: direction only |
| 42-day | ship date to ship + 42 days | window end + 3 days | The verdict |

- **Existing pages**: compare each window with the same number of days just before the ship date.
- **Control**: every page that already had impressions before the baseline window, minus the experiment's own pages. When brand searches dominate the site, leave out the homepage too. Read the control over the same two windows.
- **Credit only when the change beats the control.** A family that rose 30% while the control rose 30% "moved with the site". Report that as "moved with the site" or "no lift". A change that touches nearly every page has no clean control: report "no measurable search effect".
- **New pages** have no baseline: report raw clicks and impressions for the first 21 and 42 days, plus how many of the pages Google showed or indexed (URL Inspection).
- **Too early**: a read whose runnable date is after today, or after the last day of data, is "too early". Its review date is window end + 3 days.
- **Under 20 clicks is directional.** Say "directional only" and give no verdict from it alone.
- **Matched controls** suit small tests: pair each treated page with an untreated one on page type and inlinks, and pick the treated page of each pair at random. With six per side, only a large gap counts (see the link test in the reference).

The control matters most on large changes. Product A's hand rewrite of about 95 pages lost 7% of clicks on its compare pages at three weeks while untouched pages gained 40%; its alternatives pages rose 34%, which alone reads as a win, against a control that rose 31% (Source: "Agent-First Growth Playbook" (refreshed 2026-11-03), "Experiments since August").

## Writing a read

Add a subsection under Results for each read, then set `read_21` or `read_42` to the date you did it, on the measurer's `.seo/` draft PR.

- Head it with the read and absolute dates: `### 42-day read, done 2026-11-20 (window 2026-10-06 to 2026-11-16, baseline 2026-08-25 to 2026-10-05)`.
- Give the numbers for the pages and the control, each with its source and pull date.
- Quote the data point that closes it: "Clicks +34% against control +31%: moved with the site." A read with no quoted number is not done.
- Log a failure as **Failed**, with the reason (demand shrank, not indexed, intent-capped). Failed results are the most useful rows in the log.
- At the 42-day read, write the verdict and apply the stop, continue or expand rule. Set `status: read`. Set `status: closed` once the follow-up action is decided.
- **A slipped read keeps its date.** A read done after its runnable date says so: `### 42-day read, done 2026-12-02 (slipped from 2026-11-19)`. An expectation or check date that moves keeps its old date beside the new one: `by 2026-12-10 (slipped from 2026-11-17)`.
- **Quick checks are dated todos, not reads.** Write each as `- [ ] by YYYY-MM-DD: <check>` in the record and close it with the data point that closed it. They never produce a verdict. Due dates by kind of check: a compare-page click-rate or ranking change, 7 days after ship (one recrawl); an AI-referral anomaly, 3 days; index coverage after a sitemap or internal-link change, 5 days (URL Inspection on every new URL by day 7 at the latest); anything waiting on a person, such as posting a reply, 2 days (Product A site growth skills, decide-execute).

## Find what is due

Run the due script from the product repository at the start of every review and every orchestrator run:

```
node <this skill's folder>/scripts/due.mjs [--repo <dir>] [--ref <git ref>] [--today YYYY-MM-DD] [--json]
```

- `--repo` defaults to the current directory. With `--ref <default branch>` (for example `--ref origin/main`) the script reads the records as they are on that branch, through git, and dates them from its first-parent history: use this from a feature branch, and in every review. Without `--ref` it reads the working tree, including records on your own branch that have not merged, and dates them from `HEAD`.
- `--today` defaults to today in UTC. All dates are UTC.
- The text output has one line per record and ends with `Due now: N`, the number of reads that are due:

```
2026-10-05-october-rewrite  shipped 2026-10-06 (git)  21d done 2026-10-29  42d DUE since 2026-11-20
2026-10-06-retitle-pricing  shipped 2026-10-08 (live)  21d done 2026-11-02  42d too early, review 2026-11-22
2026-11-20-draft  not shipped
Due now: 1
```

- `--json` gives an array sorted by id: `{id, file, ship_date, ship_source ("live", "git" or null), status, reads: [{days, window_end, runnable_from, done, state}], next: {days, date} | null}`. `state` is `done`, `due`, `too early` or `closed`. `next` is the earliest read still due or too early, dated by its runnable date. A record with `status: closed` keeps its dates, but its open reads are `closed`: never due, and `next` is null. A file with no frontmatter (the older per-file format) is listed with `legacy: true` and no reads, and the text output ends with `Legacy records to migrate: N`; migrate it as **Import a legacy log once** says.
- "not shipped" means the record is not on the ref yet and has no `live` date: it gets no reads.
- Exit 1 names the record with unparseable frontmatter or a bad date. Fix that record and run it again.

Due reads go first in any review, before new work. Every run ends with the next due date and this command.

A first run on an existing product usually finds reads nobody did. On 2026-11-21, Product A's October program had 42-day reads due since 2026-11-19, and its internal-link test, due for review from 2026-11-17, had never shipped; Product B's log had no results written back after July (Source: "Agent-First Growth Playbook" (refreshed 2026-11-03), "Experiments since August"; the catalog of Product B's SEO documents, 2026-11-21).

## Import a legacy log once

Two older layouts exist. Some repositories keep every bet in one file, `.seo/experiments.md`, with rows of date, type, target, baseline (with its window), action, expected impact and review date. Others have one Markdown file per experiment in `.seo/experiments/` with no frontmatter. The due script reads only frontmatter records, so after one migration the folder is the only format. On the first `.seo/` PR, in one commit, give each row or old file its own record with frontmatter:

- `id` and file name from the row's date and target; `live` from the row's ship date; `read_21` and `read_42` from any results already written back, else empty.
- Copy baseline, action and expected impact into the matching sections, and any written result into Results with its original date.
- A review that was never written back becomes a due or slipped read, never a guessed result.
- Replace the old file's body with one line pointing to `.seo/experiments/`.

## Sources

- "Agent-First Growth Playbook" (refreshed 2026-11-03): "Experiments since August" (method, windows, control, too-early dates), principle 11 and prompt P7 (log every bet, scenario-labelled impact, Failed results).
- "Growth, phase by phase" (v2, 2026-11-04): Phase 5 and "The monthly loop" (at most three moves, review at least 3 weeks out), Principle 8.
- "Product B growth deep dive" (2026-11-03): Experiments, Method (live dates, homepage left out of the control, readings under 20 clicks directional).
- Product A site growth skills (router, measure, decide-execute; read 2026-11-21): absolute dates, closing data point, slipped marks, one change per invocation, due dates by kind of check, the 15-point scoring and the seven headline metrics.
- A customer workflow starter (method only): hypothesis sentence, what stays unchanged, confounders, stop/continue/expand, the three-experiment cap.
