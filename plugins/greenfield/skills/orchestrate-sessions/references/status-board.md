# Session status page

One HTML page per Session for the person (the workstream map), published as the Session's hub. You fill a status JSON from the Session's real state, and the renderer beside this skill draws the page from it. Never write the page's HTML by hand.

## Write it

```sh
node <this skill's directory>/assets/status-page/render.mjs <Session folder>/.agent/status.json <Session folder>/session/index.html
```

- Always write the local copy to `<Session folder>/session/index.html`, the ledger's `session.artifact.local`. When a document destination resolves, also publish it as the Session artifact's front page.
- Write it at the first dispatch, again at each material change (a worker report, a decision, a PR opened, reviewed or merged) and when the person asks. Each rewrite replaces the same file and the same published artifact.
- In Pane, the Session's Overview tab shows this page, so never open it as a separate tab there.
- Outside Pane, open it beside the person at the first dispatch with the host's show-page mechanism, without asking. Open its URL (the published URL, or a `file://` URL for the local copy), never a file to edit. Record that URL in the ledger's `session.artifact.opened_url`, and after each rewrite open the same URL again so the host reuses its tab.
- The page carries `<meta http-equiv="refresh" content="60">`, so an open copy reloads itself every minute.
- The page is self-contained: no script, no network, diagrams drawn at render time, and Inter embedded as a font subset, the one exception to `page`'s system fonts. One item in flight renders at about 90 KB and each further one adds about 12 KB, so the page passes `page`'s 200 KB at about 10 items in flight. Keep finished items in `done`, where each takes one line.
- The renderer needs only Node: rough.js and the font are vendored beside it, with their licenses. `assets/status-page/example-status.json` is a filled example showing every state.

## The status JSON

Every fact comes from the Session's real state: the ledger, the workers' status files, the host and GitHub. Write "unknown" rather than guess. Say each fact once: a rail, a question row and a `next` line never repeat each other.

```json
{
  "session": {
    "title": "the Session's name, as a short human title",
    "eyebrow": "Updated 14:40 · 2 h 05 min elapsed",
    "counts": { "running": 0, "queued": 0, "done": 0 },
    "settings": "one line: review policy (any override, who gave it and when), validation default; links allowed",
    "flow": {
      "caption": "Goal: one line",
      "steps": [ { "label": "short", "state": "done | now | need | blocked | todo", "tag": "optional, e.g. NOW · IMPLEMENTER" } ]
    }
  },
  "needs": [
    { "id": "Q-3 | F-2 | null", "item": "item name", "role": "Planner | Implementer | Reviewer | Orchestrator",
      "blocks": "what waits on it", "q": "the question, one sentence",
      "options": [ { "label": "short", "rec": true }, { "label": "short" } ],
      "why": "one or two sentences", "age": "4 min",
      "link": "pane://open?pane=<pane id>&panel=<panel id>, only for a question asked through Notify",
      "files": "optional link to the page to read" }
  ],
  "items": [
    { "name": "item name", "link": "its front page", "pr": "#1234", "prLink": "https://github.com/…",
      "pane": "Pane name", "paneLink": "pane://open?pane=<pane id>",
      "state": "now | need | blocked | failed | done", "stateLabel": "short",
      "next": "one sentence: who does what next; <b> and <code> allowed",
      "rail": [ { "label": "1-2 words", "state": "done | retried | now | need | blocked | failed | todo | skipped" } ] }
  ],
  "done": [ { "label": "#1234 what it did", "link": "its front page", "detail": "merged 13:02 · no issues hit" } ],
  "decisions": [
    { "id": "D-4", "item": "item", "answer": "the answer, one line", "by": "You | Planner | Advisor",
      "q": "the question asked", "options": ["option", "option"], "chosen": "exactly one of options",
      "note": "optional one line", "when": "13:10", "ref": "where it came from, e.g. Q-1 from the planner" }
  ]
}
```

Keep the JSON at `<Session folder>/.agent/status.json` and update it in place, so each rewrite starts from the last one.

**Session.** `eyebrow` is the local time of the newest evidence you read and the time elapsed since the Session started, with no cost. `counts` are workers running now, items waiting to start, and items finished. Give `flow` when items depend on each other (`depends_on` in the ledger) or run in sequence: one step per item or wave, in the order of work. The page shows it only with 2 or more items in flight. Shared ledgers and stub hubs in other destinations are links in `settings`.

**Needs you.** One entry per open question, approval or finding waiting on the person, newest blocking first; `[]` when there are none.

- A worker's question asked through Notify (`"asked": "notify"` with empty `answers`): `id` is `null`, since it is numbered once answered, and `link` is `pane://open?pane=<pane id>&panel=<panel id>`, the item's `pane_id` and the asking worker's `panel_id` from the ledger. The person clicks it to open that tab with its card docked.
- A relayed question: its Q-n and no `link`, since the person answers it in your relay. Link its files in `files`, or its Context.
- Review findings waiting on the person: the F-n, with no `link`.

**Items.** One per work item still in flight, in the order of work. `link` is its front page: its brief when it has a bundle, otherwise its hub ([item-hub.md](item-hub.md)). In Pane, `paneLink` opens its Pane. `state` is `need` when it waits on the person, `blocked` or `failed` when a worker is stuck; the state bar counts those, and `next` says what is missing or the failure in one line.

The rail is the path the work actually took, then what is still ahead: one dot per real step (Plan, Plan rev 2, Approved, Build, CI, Fix 1, CI again, QA, Review, Fix F-1–F-3, Follow-up review, Merge). A past failure that was retried is `retried`; the current step is `now`, `need`, `blocked` or `failed`; steps still ahead are `todo`. Keep labels to 1 or 2 words and rails to about 10 dots.

`next` carries what the rail cannot show:

- unreviewed commits: "N commits since the last review at <sha>, not reviewed", counted with `git rev-list --count <last reviewed head>..<PR head>`, or "never reviewed" when there is no reviewed head;
- validation still pending, from the ledger's `validation` (for example "Validation deferred: CI, QA and review wait for 'ready'");
- "no destination" when the repository names none.

The last reviewed head is the ledger's `last_reviewed_head` for that PR. When the ledger has lost it, use the head in the newest `<!-- greenfield-review head=<sha> -->` marker on the PR's reviews, and record it.

**Done.** Every completed item (PR merged or closed, plan abandoned), newest first, linking its front page, with its outcome and "no issues hit" or that a post-mortem exists. An item moves here and is never removed.

**Decisions.** Every D-n, newest first, from the ledger's `decisions`. An addendum is a decision whose `ref` names it and whose `note` lists the work items it was sent to.

The cleanup log and the end-of-run summary live in the ledger and your final report, not on the page.

Link only pages that exist, with relative links inside the Session artifact, and check each local link before publishing.
