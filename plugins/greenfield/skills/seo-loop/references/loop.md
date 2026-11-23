# The worked run this loop comes from

One person ran this loop by hand over about 23 hours on 2026-11-03 and 2026-11-04, with one orchestrating agent, three long-running workers and about a dozen short research agents. Products: **Product A**, an open-source developer tool for running coding agents in parallel, and **Product B**, a B2B healthcare SaaS with a free plan. A confidential engagement stood in for a "new site"; only the method it tested ships here. Each row says what ran, what it produced, what it cost in time, and which part of this loop it became.

Sources: the orchestrating session's transcript digest (2026-11-03 to 2026-11-04), "Agent-First Growth Playbook" (Product A, refreshed 2026-11-03), "Product B growth deep dive" (2026-11-03), "Growth, phase by phase" (v2, 2026-11-04) and the quick-wins page "25 quick wins each" (2026-11-04).

## The run, step by step

| # | What ran | Who | Produced | Time | Became |
| --- | --- | --- | --- | --- | --- |
| 0 | Recover prior work: an August read-back of Product A, never merged | 4 parallel research agents (skills repo, this machine, other machines, the document destination) | found the August playbook on an unmerged branch | 79 s to 652 s each | search for prior `.seo/` work and branches before starting |
| 1 | Agent-readiness baseline | 1 research agent | two scanner reports, raw JSON kept | 55 s | step 3, scanners named and dated |
| 2 | Scope choice: extend the August read-back rather than start over | the person, one question | decision D-1 | | section 0, one question with a recommendation |
| 3 | Product A read-back refresh: every merged PR since August grouped into 17 experiments, read at 3 and 6 weeks, young ones given review dates | a worker on the playbook's branch | updated playbook, change-log line, cold read with 25 findings fixed | blocked about 85 minutes on Search Console access, then 35 minutes | step 2; rule 1 (it stopped instead of estimating) |
| 4 | A meeting snapshot | the orchestrator and one helper | a showcase page, later corrected for IndexNow | 73 s | not part of the loop (Later) |
| 5 | New site, first pass | the orchestrator alone, from Product A lessons only | a fixes page | | step 7, and the reason the rerun and gap check exists |
| 6 | Product B deep dive: every PR since April, live dates from deploy runs, Search Console page by day, AI-feature impressions transcribed, analytics funnel and AI referrals, both scanners | a worker fanning out 4 read-only research agents | deep dive with a coverage appendix that classified every merged PR and reconciled every public-path commit; raw pulls archived under `.seo/archive/` | | steps 2, 3 and 5 |
| 7 | Polling | the orchestrator | status messages every 10 minutes | | `orchestrate-sessions`' watcher |
| 8 | New-site rerun with both products' lessons, every sitemap URL live, both scanners, competitor and assistant-answer searches, and a gap check against the site's own audit | 1 research agent | a second page and a gap-check file; the orchestrator re-verified the top finding before republishing | | step 7's rerun and gap check |
| 9 | Cross-product write-up v1 (thematic) | 1 research agent | 7 sections; its own cold read fixed 12 problems | 453 s | step 6 |
| 10 | "You never checked why": root-cause investigations of three drops, then a fourth on the sign-up survey after the person authorized a read-only database read | 4 parallel read-only agents | one report per drop with ranked hypotheses, confidence and the settling measurement | 200 s to 838 s | step 4 |
| 11 | Fold the investigations back into both documents | the two workers | change-log lines, confidence labels, proposed link tests, a second cold read | about 5 minutes | step 5 revisions |
| 12 | Cross-product write-up v2, chronological by phase, with work sessions rebuilt from git | 1 research agent | "Growth, phase by phase"; cold read by a fresh agent; screenshot-checked in light and dark | 1,026 s, 61 tool calls | step 6; the evidence base `seo-evidence` ships |
| 13 | 25 quick wins per product, with live re-checks of every claimed gap | the orchestrator | the quick-wins page | about 4 minutes | step 7's output shape |
| 14 | Turn the method into a skill; dry run on a new site at Public tier | a worker, then a fresh agent | the quick-wins skill, with every gap the dry run exposed fixed | | growth-quick-wins |

## What the person asked for, and where each lives now

| The person's words (paraphrased) | Rule or step |
| --- | --- |
| "dug into every commit ... against the Google Search Console data ... what happened after three to six weeks ... for every everything" | step 2; rule 2 |
| "literally looked at every commit from start of April to today" | rule 2; the coverage appendix |
| "it's really hard to read"; "in very simple terms, so I can share it" | rule 6 |
| "start the document with a list of the top 10 low hanging fruits" | the ranked page opens with the top actions |
| "check every 10 mins until everything's done" | the watcher |
| "rerun the audit and if it misses anything keep improving" | rule 5 |
| "You never checked why" | step 4 runs for every unexplained drop, without being asked |
| "chronological ... the way I actually did it ... in just a few short sessions" | the deep dive's phases; work sessions rebuilt from git |
| "point any product at the skill ... 25 to 50 low hanging fruit then 10 to 15 larger workstreams" | step 7 |
| "kick off researchers in parallel instead of blocking this thread" | parallel items within the concurrency cap |

## What went wrong, and the rule it produced

| What happened | Rule |
| --- | --- |
| Search Console was not connected; the worker stopped as briefed and lost about 85 minutes waiting | section 0 probes every source before the first dispatch and asks once, up front |
| The August playbook said IndexNow sped up Google indexing; it was copied into two new pages before a refresh caught it | rule 7; the corrections list |
| A first pass built only from another product's lessons, without live checks, needed a rerun and gap check before it could be trusted | rule 5; the claims check re-reads every price and claim live |
| AI-visit loss was blamed on the agent-readiness work; the investigation dated the drop three weeks earlier, on two compare pages | step 4 dates a drop before blaming the latest change |
| Drops were reported without causes | step 4 is part of every first run |
| The analytics tool recorded nothing for about four weeks and an attribution job failed every run on an empty secret | the access probe reads one recent day from each source; data jobs fail silently |
| AI-feature impressions are not in the Search Console API | transcribe from the UI and label the number as transcribed |
| Cold reads found real problems every time (25, 12, 11 and 4 findings) | every page goes through the reviewer before the person |
| The first write-up was thematic; the person wanted it chronological, and the chronology contradicted the person's own framing in five places | the deep dive is chronological and says where the real order differed from the plan |

## Where state lived, and where it lives now

| Then | Now |
| --- | --- |
| One brief per worker in the Session folder, with a change log of later decisions | starting messages written to files; decisions as D-n in the decision log |
| Review dates scattered across the playbook table, the quick-wins calendar items and the Session's next-action note | one record per experiment under `.seo/experiments/`; the due script computes every read date at each start |
| An older single-file experiment log in the product repo | imported once into records |
| Raw pulls archived under `.seo/archive/<date>/data/` on the deep dive's branch | raw pulls stay in the run's private bundle; the `.seo/` PR carries reviewed aggregates only |
| Pages published to the document destination, v1 and v2 at the same link | the same: each run's bundle, updated in place |
