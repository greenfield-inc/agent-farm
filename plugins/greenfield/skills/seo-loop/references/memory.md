# Working memory

The product's local folder holds what a later run needs and `.seo/` cannot carry yet: open questions, items in flight, results not merged, what was tried, the picks history and the last ticks. Every run reads it; a scheduled run writes it last. The repository stays the durable truth: when memory and the repository disagree, the repository wins and the run corrects its memory.

## Where

One folder per product repository on this machine, shared by every worktree: the `memory` path the pre-check prints (`due.mjs --check`), under Agent Farm's state directory. It holds:

| Path | Holds |
| --- | --- |
| `memory.json` | the run state below |
| `memory.prev.json` | the previous good copy |
| `data/` | raw pulls: Search Console and analytics exports, scanner output, survey answers, notes. Every role that pulls data writes it here, and nothing raw leaves the machine through the repository |

Keys and tokens are read from the environment at use and never written here. The folder is machine-local: a loop moved to another machine starts without it and rebuilds what it needs from the repository and the host.

## memory.json

```json
{
  "product": "", "url": "", "repo": "",
  "loop": { "decision": "weekly | daily | none | null", "id": null, "cron": null, "asked": null },
  "ticks": [ { "started": "", "finished": null, "kind": "", "did": "", "waits_on": "", "next_due": "", "cost_usd": null } ],
  "questions": [ { "approval": "", "title": "", "kind": "access | autonomy | picks | approach | cover sheet | merge | loop | other", "asked": "", "answer": null, "answered": null, "acted": null } ],
  "actions": [ { "key": "", "kind": "approval | workspace | worker | pr", "target": "", "status": "pending | done | unknown", "ref": null, "started": "" } ],
  "in_flight": [ { "key": "", "item": "", "role": "", "workspace": "", "worker": "", "status_file": "", "started": "" } ],
  "results": [ { "key": "", "kind": "read | migration | drop | hypothesis | ranked page", "summary": "", "pr": null, "investigator": null, "status": "open | merged | closed" } ],
  "tried": { "<problem>": [ "<date>: <approach> → <outcome>" ] },
  "picks": [ { "item": "", "kind": "", "offered": [ "" ], "outcome": "picked | declined | not picked", "reason": null, "evidence": "" } ],
  "approach": [ { "date": "", "change": "", "evidence": "", "streak": [ "" ] } ],
  "review_done": null,
  "review_skipped_until": null,
  "next_due": null
}
```

- `ticks`: the last 30, newest last. A tick appends its entry with `finished: null` before anything else and fills it last. `cost_usd` comes from the host's cost report for this run when it has one, else stays null.
- `questions`: every question put to the person, with the approval id the host returned. `acted` is set once a run has carried out the answer.
- `picks`: one entry per item ever put to the person. `evidence` is the line the item was ranked on when last offered, so a later run can say what changed.
- `key`: a stable identity for the work, so nothing is dispatched twice: `read:<record id>@<21|42>`, `migrate:.seo/experiments.md`, `drop:<record id>@<days>:<pages>`, `review:<date>`, `pick:<item>`.
- `results`: finished work a later run needs while its PR is unmerged (a read's verdict, a migration, a named drop and whether an investigator was started), each with its open PR or bundle. Prune an entry once its PR merges or closes.
- `actions`: every host action that creates something (an approval, a workspace, a worker, a PR), recorded before it is taken and completed with the reference the host returned.
- `review_done`: the date of a review whose `.seo/` PR, which sets `last_review` in `.seo/access.md`, has not merged yet.
- `approach.streak`: the experiment ids whose results triggered that change.

## Writing it

Hold the host's lock named by the pre-check's `lock` while you read memory to change it and until the write is done, so a person-started run and a tick never overwrite each other; when another run holds it, wait for it. Write `memory.json` whole: copy the current file to `memory.prev.json`, write the new one to a temp file named for this run (`memory.json.<run id>.tmp`), then rename it over `memory.json`. When `memory.json` does not parse, read `memory.prev.json` and say so in the tick's line.

**Before every host action that creates something**, write an `actions` entry with its key, kind, target (the approval's title, the item name, the workspace or branch) and `status: pending`; take the action; then write its returned reference and `status: done` straight away. A later run that finds a `pending` entry looks it up in the host by its target before repeating it (the host's approvals or inbox, its workspace list, `gh pr list --head <branch>`). Found: record the reference. Not found: take the action once. When the host cannot tell, set `status: unknown`, take no action for that key, and say so in the line. A tick whose entry still has `finished: null` when the next run starts died midway: the next run's line says "the previous run did not finish", and it re-checks that run's items.

## Reconciling with the repository

At the start of every run, before acting on memory:

- A read memory calls pending that the record on the default branch shows done: mark it done and drop the result.
- An item in flight whose PR has merged or closed, or whose worker has exited: collect its outcome from its status file and PR, then drop it from `in_flight`. When it left an unmerged PR (a read, a migration), keep a `results` entry under the same key with the PR until it merges or closes.
- A picked item whose experiment record has landed: keep its `picks` entry and drop it from `in_flight`.
- An open question whose answer the host's inbox shows: record the answer.
- `review_done` whose `.seo/` PR has merged (the pre-check's `review.last` now equals it): clear it.

Then the run's line says what it corrected, in a few words.

## When a person starts the orchestrator

Read the folder when it exists and open with what the loop has been doing: the last few ticks in one line each, open questions, items in flight and the next due date. Then do what the person asked. A person-started run writes memory the same way, so the next scheduled tick sees it.
