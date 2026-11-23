---
name: seo-read-back
description: "Use to measure what shipped changes did in search: run due experiment reads, reverse-engineer every merged change to public pages since a start date against Search Console at 21 and 42 days, check agent discovery, and write the product's deep dive with a full coverage appendix."
---

# SEO read-back

Read every shipped change against search data, with a control group, and write the results back where the next run finds them. The method: take every commit to a public page, date it, and read what happened three and six weeks later against pages the change did not touch.

Three jobs, one method:

- **Due reads**: the experiment reads the due script lists. Run these first, every time.
- **History mode**: reverse-engineer every merged change since a start date, for a product with no records yet or with records that stopped.
- **Deep dive**: the product's write-up of what grew it, built on the history read, with a coverage appendix.

Record format, windows and due dates come from `seo-experiments`. Evidence rules, lessons and corrections come from `seo-evidence`. Pull data through `seo-data-pull`; archive raw pulls through `seo-data-organize`.

## Rules

- **Never guess a number.** Every number carries its source and pull date. When the step needs a source that is not connected (`.seo/access.md` says which are), stop and ask for it.
- **No sampling.** Every merged change in the window is classified, and the output shows the coverage counts.
- **Credit only what beats the control.** A change that moved with the site gets "moved with the site", however big its own rise.
- **Write only under `.seo/`**, on your own branch and a draft PR opened with `prepare-pr`. Never touch site code.
- **Hand an unexplained drop back** as a question for the investigator role: what fell, from when, which pages, what the control did, and what you ruled out. Do not diagnose it here.

## Due reads

1. Run the due script from `seo-experiments` against the default branch.
2. For each due read, pull page-by-day data for the record's pages and the control over the read window and the same number of days before.
3. Write the read into the record, set `read_21` or `read_42`, and mark slipped reads as `seo-experiments` describes.
4. End with the next due date and the command to run then.

## History mode

### 1. Enumerate every change

Pick the start date: the first public page, or the first day of search data if that is later. Then list everything since it.

- Merged PRs: `gh pr list --state merged --search "merged:>=<start>" --limit 1000 --json number,title,mergedAt,mergeCommit,files`.
- First-parent commits over every public path: `git log <default branch> --first-parent --since=<start> --format='%H %cI %s' -- <site, docs, help, developer docs, robots.txt, sitemaps, llms.txt, agent files, redirect config, .seo>`.
- Classify every merged PR as one of: **timeline** (changed what searchers or agents see), **public surface, no acquisition effect** (with a one-line reason: build fix, download fix, telemetry, a help-article typo), or **product only**.
- Reconcile commits to PRs. Every first-parent commit maps to a timeline PR, a no-effect PR, or a named direct commit. Match commits whose subject lacks a PR number through the GitHub API (`gh api repos/<owner>/<repo>/commits/<sha>/pulls`). Note PRs that merged into side branches and reached the default branch inside another PR.

Product B's deep dive classified every PR merged in its window, more than five for each one that reached the timeline, and mapped every first-parent commit over its public paths to a PR or a named direct commit (Source: "Product B growth deep dive" (2026-11-03), Appendix: coverage).

### 2. Date each change

- **Merge date** when the site deploys on merge.
- **Live date** when deploys are manual: the first successful deploy run whose head contains the merge commit (`gh run list --workflow <deploy workflow> --status success`, then `git merge-base --is-ancestor <merge commit> <run head>`). One of Product B's PRs merged 2026-04-25 and went live 2026-05-06.
- A PR reverted before any deploy was never live. Product B found one, reverted 82 minutes after merging.
- `.seo/access.md` says which deploy mode applies.

### 3. Group into experiments

Group timeline PRs by page family or change type and ship date: one launch, one rewrite program, one cluster. Give each group a letter and number (A1, B3) and list its PRs. Changes with no single ship date, such as docs refreshes for every release, are listed with that reason. Write each group as an experiment record with `live` set to its ship date.

### 4. Read each experiment

- Read at 21 and 42 days, against the same number of days before, with the control `seo-experiments` defines.
- Fold `www`, trailing slashes and `/index.html` into one page row, and drop `#fragment` URLs, which Search Console reports as their own rows from the same result.
- New pages: raw clicks and impressions, and how many Google showed or indexed (URL Inspection).
- A window ending after the last day of data is too early: label it with its review date, window end plus three days.
- Under 20 clicks: directional only.

The worked read-back in [references/worked-read-back.md](references/worked-read-back.md) is Product A's full table, from 2026-08-23 to 2026-10-28.

### 5. Rebuild the work sessions

Rebuild when and how long the work happened, from git, so the write-up can show the real effort per phase.

- Events: every human commit on every branch (`git log --all`, bots dropped, duplicates by time and subject folded) plus each merged PR's open and merge times. For squash-merged repos, use each PR's commit times (`gh pr view <n> --json commits`).
- Events less than 2.5 hours apart form one session. A session's length is first to last event, so real time is longer.
- Rerun at 2 and 3 hours and report the spread: on both products the counts moved about 10% and the conclusions held.
- Tag each session with its phase (foundations, landing and pillar pages, templates, batches, indexing and agent layer, measurement) from its commits and PRs.
- Tell the deep dive's story in that order: chronological, phase by phase, each phase with what was built, its sessions and hours, and what it earned after what lag.

Product A: 69 growth sessions, 126 hours over eight months, median 66 minutes, 32 under an hour; most hours went to the indexing and agent layer (41.0) and batches (26.8). Product B took about the same hours in shorter sessions (median 44 minutes), and its sign-up flow took more hours than any content phase. On Product A, a 5.5-hour session built 44 pages on a branch that never merged. Growth took short sessions; waiting for the data was the slow part (Source: "Growth, phase by phase" (v2, 2026-11-04), "The short version"; Work sessions investigation (2026-11-03)).

## Agent discovery

Measure three things, each dated, and keep them apart.

- **Scanners measure readiness, never citations.** Run named scanners (is-agentic: `npx is-agentic <domain> --json`, which may return a cached scan; Ora: `POST https://ora.ai/api/scan`) and record each score with its scan date and whether it was cached. Product A's readiness pass took is-agentic from 86 to 100 while AI-assistant pageviews fell from 606 in July to 247 in October (5.2% to 1.4% of pageviews); Product B scored 64 and 65 while its AI visits about doubled (Source: "Growth, phase by phase" (v2, 2026-11-04), Principle 6).
- **AI referrals by assistant.** Count visits per month from ChatGPT, Claude, Perplexity, Gemini and Copilot in the connected analytics tool, by referrer or `utm_source` (ChatGPT sends most visits as `utm_source=chatgpt.com` with no referrer), split by landing page. Name any gap in the analytics data.
- **The sign-up survey over time.** Ask every sign-up "How did you find us?" with an AI option split by assistant, and save the first-touch source on the sign-up. Report the AI share by month. Tracking hides AI: on Product B, 25% to 28% of answers each month from July to October named an AI while tracking credited about 4%, so self-reported AI ran 4x to 5x tracked AI; only about 1 in 7 AI answerers had an AI first touch. Before the AI option existed, about 2% typed it in, so shares before and after an option change are not comparable (Source: "Growth, phase by phase" (v2, 2026-11-04), Principle 7). With no survey, say the product cannot tell fewer AI recommendations from hidden referrers, and list adding one as an action.
- **State the denominator.** Product B's AI share of sign-ups was about 4% tracked, 20% in one analytics survey count, and 24.3% and 27% in warehouse counts over different windows. All are correct for what they measure. Every AI share names its numerator, denominator and window.
- Google's AI-feature impressions are not in the Search Console API; copy them from the Search Console screen and label them "transcribed".
- Whether assistants name the product is measured by the answer panel in `seo-answer-panel`.

## Report brand and homepage separately

Brand searches and the homepage click at high rates, so many new pages at lower rates pull the site's CTR down while clicks grow. Product A's site CTR fell from 4.70% in May to 2.85% in October while monthly clicks rose from 191 to 2,945. On Product B, 87% of query-attributed clicks were brand searches and 76% of search visits landed on the homepage, while non-homepage clicks rose about 7x October to October (Source: "Growth, phase by phase" (v2, 2026-11-04), Principle 4 and "Where they differed"). Every summary and every experiment table reports brand and non-brand, and homepage and other pages, as separate rows.

## Deep dive

Write the product's deep dive from [references/deep-dive-outline.md](references/deep-dive-outline.md) as a page with `page`, and keep its raw pulls and the commit-level coverage list under `.seo/archive/YYYY/MM/DD/data/` through `seo-data-organize`.

- **Open with a five-minute founder summary of actions**: what happened, what it proves, and the method step by step, in plain words any founder can copy. Numbers follow below it.
- **End with the coverage appendix**: every merged PR classified with counts, the commit list and its reconciliation to PRs, what git cannot show (redirects outside the repo, side-branch merges, shared components that change many pages at once), headline numbers re-verified, and what was not checked.
- **Re-verify headline numbers by a separate script** that recomputes every number in the summary from the raw pulls. Product B's check found three sums off by one and one mislabelled window.
- Use `swarm` to fan out the read-only pulls in parallel: the PR timeline, Search Console page-by-day and queries, analytics and referrals, and the scanners.
- The orchestrator sends the finished deep dive to the reviewer for a claims check and a cold read before the person sees it.

## Done when

- Every due read is written into its record, or labelled too early with its review date.
- In history mode, the coverage counts add up: PRs classified, commits reconciled, nothing sampled.
- Every number has a source and date, brand and homepage are separate, and every agent-discovery share names its denominator.
- The `.seo/` draft PR is open, and the handover names the next due date and the due-script command.

## Sources

- "Agent-First Growth Playbook" (refreshed 2026-11-03): "Experiments since August", "Where [Product A] stands with AI agents".
- "Product B growth deep dive" (2026-11-03): the five-minute section, Evidence rules, Experiments, AI search, Appendix: coverage.
- "Growth, phase by phase" (v2, 2026-11-04): Principles 4, 6 and 7, "Where they differed", Sources and method.
- Work sessions investigation (2026-11-03): the session rule and its sensitivity.
