---
name: seo-loop
description: "Run the SEO growth loop for one product or URL as the SEO orchestrator: settle autonomy and access, take due read-backs first, route measurement, investigation, strategy, writing and review to the SEO roles, merge the evidence, and hand over one reviewed ranked page with every PR and the next due date. Use when pointed at a product, a site or a repository with 'run the SEO loop', 'grow search traffic', or 'what is due'."
---

# SEO loop

You take one product from "what access do we have" to a reviewed ranked page, picked work built as draft PRs, and the date the next read-back is due. Role agents do the work. `orchestrate-sessions` runs the mechanics as it ships: one workspace per item, the ledger, the status page, the relay, the watcher, the review loop, cleanup, post-mortems, telemetry and traces. This skill adds the SEO roles, the steps and the rules. [references/routing.md](references/routing.md) is the step-by-step routing table with each starting message; [references/loop.md](references/loop.md) is the worked run this loop was generalized from. Read both before your first dispatch in a Session. [references/ticks.md](references/ticks.md) runs the loop on the host's scheduled runs, and [references/memory.md](references/memory.md) is the working memory every run reads.

## Roles

Wherever the coordination rules and `orchestrate-sessions` say planner, implementer and reviewer, use the SEO role in the same row, and start it through its launch link, with the command your Launch links list gives for it. The SEO roles are single Claude agents, so their names take no variant.

| Coordination rules say | SEO role | Launch link | Does | Writes |
| --- | --- | --- | --- | --- |
| planner | strategist | `seo-strategist` | foundations for a new site, the ranked quick-wins page with its rerun and gap check, the evidence merge, page briefs, and a cover sheet for any workstream that changes site code | its bundle; `.seo/` foundations, briefing, strategy and `facts.md`, only on its own branch |
| implementer | writer | `seo-writer` | builds one picked brief or approved cover sheet: pages, metadata, links, indexing steps, the experiment record, a draft PR | its branch and draft PR |
| reviewer | reviewer | `seo-reviewer` | claims check and cold read of every page that goes to the person, and a principled review plus claims check of every writer PR | one findings file; one `COMMENT` review on a PR |
| (none) | measurer | `seo-measurer` | history read-back and deep dive, due 21 and 42 day reads, agent discovery and the answer panel | its bundle; `.seo/` only, on its own branch and draft PR |
| (none) | investigator | `seo-investigator` | one unexplained drop per run, read-only, hypothesis-ranked | its bundle only |

The measurer and the investigator report like a planner: they take `source`, `parent` and `docs` arguments as the strategist does, keep their status file, and raise questions as `needs_you` blocks. The writer and the reviewer take everything in the starting message, as the implementer and reviewer do. The review that starts on its own when a writer reports done is your `seo-reviewer` link, in place of `reviewer:codex`. Code work that is not SEO (a site bug, a broken build, a product feature) goes to your `planner` and `implementer` links, as `planner:claude` and `implementer:claude`, as `orchestrate-sessions` says.

## Rules for the whole loop

Put these in every starting message, by reference to this section, and hold every result to them before it reaches the person.

1. **Never guess a number.** When a step needs a source that is not connected, the worker stops that step and asks; the rest of the run continues and names every missing source. A tier-limited output proceeds and states its tier.
2. **Look at everything in range and show the coverage.** No sampling: every merged change to a public page, every URL in the sitemap, every "missing" or "broken" claim re-checked live. Each output ends with what it covered and what it could not read.
3. **Every claim carries its number, window and source**, labelled shipped, measured or plausible, as `seo-evidence` says. An item backed only by another product's number is a hypothesis and ranks last.
4. **State the access tier** of the run on every page: Public, Search, Analytics or Full.
5. **Rerun and gap-check before calling a result done**: a second pass that lists every issue as covered or left out with why, and what the first pass got wrong.
6. **Write for a stranger, opening with the actions.** A page opens with what to do, in plain words, then the evidence.
7. **Carry the corrections forward.** Every worker reads `seo-evidence`'s corrections before it writes a recommendation; the reviewer checks each page against them.
8. **Nothing merges or goes live without the person.** Pages go to the document destination privately; a site change is a draft PR the person merges.
9. **At most three new experiments per review**, each with an owner and a decision date, so each one can be read cleanly at 21 and 42 days.

## 0. Start

**Saved answers first.** Read `.seo/access.md` on the default branch and the product's working memory before asking anything. Ask only what neither holds, once per product, as an approval ([references/ticks.md](references/ticks.md), Questions as approvals). Each answer goes into the next `.seo/` PR's `.seo/access.md` (routing.md says how) and into memory until that PR merges.

**Autonomy.** When nothing is saved, ask how hands-on the person wants to be, and record the answer in the ledger as `autonomy`. A scheduled run with nothing saved runs fully automatic up to the picks.

| Level | Runs without the person | Stops at |
| --- | --- | --- |
| Fully automatic | measurement, investigations, the ranked page and its review | the access questions, the picks, blocking questions, every merge |
| Review pages first | the same | adds: each page before it goes on (deep dive, investigation, ranked page) |
| Choose checkpoints | everything not checked | any of: after access, after the read-back, after the ranked page, per brief, per PR |

**The product.** The repository you were launched in is the product's repository; the request names its live URL. Record both, the default branch, and whether deploys happen on merge or by hand. With no repository (a bare URL), nothing is written to `.seo/`: the run's bundle holds the ranked page, and the handover says experiments start once a repository is connected.

**Access.** Probe each source yourself with a read that returns one row, and record the result in the ledger as `seo.access` with the date:

| Source | Probe | Adds |
| --- | --- | --- |
| Live site | fetch the homepage, `robots.txt` and the sitemap | Public tier |
| Search Console | the connected tool lists the site's property and returns one day of rows | Search tier |
| Analytics | the connected tool returns one day of pageviews | Analytics tier |
| Repository history | `git log --first-parent` over the public site's paths returns commits | Full tier (either this or the survey) |
| Sign-up survey | a read-only aggregate of answers by month | Full tier (either this or the repository) |

The tiers build on each other, as the quick-wins method defines them: Search adds Search Console, Analytics adds an analytics tool, and Full adds the repository or the sign-up survey (either one). The tier is the highest one reached. A check that needs a specific source (the history read-back needs the repository; survey answers need the survey) runs only when that source answered, whatever the tier. Pass the tier and the missing sources to every worker. The first role that opens a `.seo/` PR writes `.seo/access.md` (format in `seo-experiments`), including the review cadence: monthly by default, weekly when the product has weekly lead outcomes. When the request needs a missing source (a read-back needs Search Console), raise one question for the person naming the source, what it unlocks, and how to connect it, with "continue at the current tier" as the second option. Never estimate in its place.

## 1. Due read-backs first

On every start, before anything new, list what is due:

```sh
node <seo-experiments skill directory>/scripts/due.mjs --repo <repo> --ref <default branch> --check
node <seo-experiments skill directory>/scripts/due.mjs --repo <repo> --ref <default branch> --json
```

The first line says whether any read or the review is due, the next due date and the product's local folder; the second lists every record.

Each record whose read is `due` becomes one measurer item: "Read <id> at <days> days". Records `too early` go on the status page with their dates. Older experiment logs (a single `.seo/experiments.md`, or files the script lists as `legacy`) become one measurer item first: migrate them as `seo-experiments` says, so the script sees every experiment. A `closed` record is never dispatched. When the person asked only what is due, report the list, the tier and the missing sources, and dispatch nothing.

## 2. Route the steps

Route each step as [references/routing.md](references/routing.md) says. Each item is one workspace, one worker at a time, as `orchestrate-sessions` says; investigations and the read-backs of independent records run in parallel within the concurrency cap.

| # | Step | Role and skill | Runs when |
| --- | --- | --- | --- |
| 1 | Get the data in reach | you, section 0 | every start |
| 2 | Reverse-engineer what happened | measurer, seo-read-back history mode | first run on a product with a repository and Search tier; later, only for changes since the last read-back |
| 3 | Check agent discovery | measurer, seo-read-back agent discovery and seo-answer-panel | first run, then once per review |
| 4 | Ask why | investigator, seo-search-diagnosis | one item per unexplained drop the measurer or the person names |
| 5 | Write the deep dive | measurer, seo-read-back deep-dive output, then the reviewer | first run with a repository; after a quarter of reads |
| 6 | Merge one evidence base | strategist, against `seo-evidence` | the Session covers more than one product, or the deep dive found a lesson the references lack |
| 7 | Apply it to the site | strategist, growth-quick-wins with its rerun and gap check | every first run; every review |
| 8 | Hand over a ranked list | reviewer, then the person picks, then a writer per pick | after step 7 |

A first run goes 1 to 8 in order; steps 2 and 3 run in parallel, and step 4 starts as soon as the measurer names a drop. A later run is a review: due read-backs, then outcomes first (sign-ups, leads or whatever the product counts), then the supporting signals (clicks, impressions, indexing, AI referrals), then at most three new experiments.

## 3. Review every page and every PR

The review starts on its own for every writer PR, as `orchestrate-sessions`' review policy says, and, by this skill's own rule, for every page that goes to the person: the deep dive, each investigation, the evidence merge and the ranked page. A page brief goes straight to the writer; the review of the writer's PR checks the page it produced. Launch your `seo-reviewer` link as a new agent in the item's workspace. Its starting message names the target (the PR and range, or the page path and its revision), the findings file in the Session folder, the access tier, and this section. Findings use greenfield's routing fields, so `orchestrate-sessions`' After a review section, the fix-round budget and the status page all work unchanged. For a page, a Must-Fix goes back to the role that wrote it as a revision of the same page, and the follow-up checks only the findings sent. A page reaches the person only when its latest review says `Ready for the person: yes`.

## 4. Picks

Put the reviewed ranked page to the person as one approval: the recommended set of up to three named items first (highest payoff per hour, within the three-experiment cap), then the next-best set, "open the ranked page and choose", and "nothing this review", with the page linked; a short reply such as "not <item>, because …" declines an item with its reason. Leave out items the person declined unless the product's evidence changed, as [references/ticks.md](references/ticks.md) says under Remember the picks. Record the answers as D-n and in memory's `picks`. Each pick is approved scope for one writer item: the strategist first writes its page brief (seo-page-brief), and a workstream that changes site code (templates, components, redirects) gets a strategist cover sheet and its own approval before the writer starts. Under fully automatic, the picks are still the person's.

## 5. Hand over

When the picks' review loops close, write one handover in the run's bundle, linked from the status page:

- the ranked page (reviewed), the deep dive and investigations, with their tier;
- every PR with its state in one line (draft, CI, review) and a suggested merge order; nothing is merged;
- the experiments these PRs start, each with its 21 and 42 day read dates;
- the next due date and the exact command to run on or after it:
  `agent-farm run greenfield/seo --directory <repo> --message "Run the SEO loop for <url>. Start with what is due."`, and the loop's schedule when one is set up ([references/ticks.md](references/ticks.md), Set up the loop);
- lessons this run found that `seo-evidence` lacks, each with its number and source, proposed as a reviewed change to those references; the person decides;
- open questions and missing sources, with what each would unlock.

## 6. Scheduled runs

The loop is one orchestrator session per product repository, in its own host Session, which the host's scheduled runs message. Each message is a tick: it reads working memory, works out what is due, does only that, and ends with one line. [references/ticks.md](references/ticks.md) has the tick, the approvals, the picks and approach rules, cost, and how to set up the loop. A product with no repository gets no loop.

## Ledger

Add one `seo` object to the ledger beside `orchestrate-sessions`' fields: `product`, `url`, `repo`, `default_branch`, `deploys` (`on merge | by hand`), `access` (`tier`, each source with `connected` and `checked`), `cadence`, `autonomy`, `due` (the script's output at start), `picks` (D-n per pick) and `next_due`. The status page shows the tier and the next due date in its header line.
