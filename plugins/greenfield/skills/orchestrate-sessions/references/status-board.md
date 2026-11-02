# Session status page

One overview page per Session for the person (the workstream map), plus one page per work item, kept locally in the Session folder and, when a destination resolves, also published to it as the Session's hub (see **Publishing** in the skill). You fill a status JSON from the Session's real state, and the renderer beside this skill draws the overview and every item page from it in one run. Never write the page's HTML by hand, nor an item page's.

## Write it

```sh
node <this skill's directory>/assets/status-page/render.mjs <Session folder>/.agent/status.json <Session folder>/session/index.html
```

- Always write the local copy to `<Session folder>/session/index.html`, the ledger's `session.artifact.local`. That file is the canonical page and the one Pane's Overview tab shows. The same run writes `<Session folder>/session/items/<id>.html` for every item, linked from its card. When a document destination resolves, also publish them after every rewrite as the Session artifact's front page, `index.html` and `items/` together with their relative links, but never instead of the local file.
- Write it at the Session's first working turn, even when nothing will be dispatched, and again after every ledger write and when the person asks. The overview and the item pages are always re-rendered together. Each rewrite replaces the same files and, when there is one, the same published copy.
- In Pane, the Session's Overview tab shows this page, so never open it as a separate tab there. A click on a card opens its item page as a browser tab beside the chat, and that tab's links move within it.
- Outside Pane, publish it first, then open it beside the person at the first dispatch with the host's show-page mechanism, without asking. Show it as a page, never a file to edit: open its URL, the published URL when a destination resolves, and a `file://` URL only when none does or publishing failed (see **Publishing** in the skill). Record that URL in the ledger's `session.artifact.opened_url`, and after each rewrite publish it again, then open the same URL again so the host reuses its tab; it is refreshed in the same tab, never opened in another.
- The pages carry `<meta http-equiv="refresh" content="60">`, so an open copy reloads itself every minute.
- The pages are self-contained: no script (a `script-src 'none'` policy), no network, diagrams drawn at render time, and Inter embedded as a font subset, the one exception to `page`'s system fonts. Each item page is about 90 KB. The overview with one item in flight is about 90 KB and each further one adds about 12 KB, so it passes `page`'s 200 KB at about 10 items in flight. Keep finished items in `done`, where each takes one line.
- The renderer needs only Node: rough.js and the font are vendored beside it, with their licenses. `assets/status-page/example-status.json` is a filled example showing every state and every kind of item.
- The renderer checks every item's `id` before it writes anything. A missing, repeated or unsafe id stops it with a message naming the item, and nothing is written: fix the JSON from the ledger and render again. A status JSON from before item pages has no ids, so the first render after an upgrade fails until you add them.

## The status JSON

Every fact comes from the Session's real state: the ledger, the workers' status files, the host and GitHub. Write "unknown" rather than guess. Say each fact once: a rail, an Everything row and a `next` line never repeat each other. The renderer escapes every field, except that `next`, `settings`, `summary`, `nextStep`, `asked` and `changes` keep `<b>`, `<code>` and `<a href="…">` links.

```json
{
  "session": {
    "title": "the Session's name, as a short human title",
    "eyebrow": "Updated 14:40 · 2 h 05 min elapsed",
    "summary": "one to three sentences: what the Session is doing and where it stands",
    "nextStep": "what happens next and who does it; the overview shows it after \"Next step:\"",
    "approvals": "pane://open?pane=<pane id>&panel=<panel id>, the tab of the oldest question's card; only in Pane",
    "settings": "one line: review policy (any override, who gave it and when), validation default; links allowed",
    "flow": {
      "caption": "Goal: one line",
      "steps": [ { "label": "short", "state": "done | now | need | blocked | todo", "tag": "optional, e.g. NOW · IMPLEMENTER" } ]
    }
  },
  "needs": [
    { "id": "Q-3 | F-2 | null", "item": "the id of the item it blocks",
      "link": "pane://open?pane=<pane id>&panel=<panel id> of the tab holding its card; only in Pane" }
  ],
  "items": [
    { "id": "env-vars", "name": "item name", "group": "optional: the plan or batch it belongs to",
      "kind": "planned | quick fix | tweak | picked-up PR", "short": "optional chip label, e.g. #1014 or P5",
      "pr": "#1234", "prLink": "https://github.com/…", "pane": "Pane name", "paneLink": "pane://open?pane=<pane id>",
      "state": "queued | now | need | blocked | failed | done", "stateLabel": "short",
      "fixRounds": { "used": 1, "budget": 2 },
      "next": "one sentence: who does what next; <b> and <code> allowed",
      "asked": "what the person asked for, in their words",
      "changes": "what the work changes, in one or two sentences",
      "rail": [ { "label": "1-2 words", "state": "done | retried | now | need | blocked | failed | todo | skipped" } ],
      "refs": {
        "plan": [ { "label": "Cover sheet, revision 2", "link": "env-vars/cover-sheet.html", "note": "approved, D-10" }, { "label": "Brief", "link": "env-vars/index.html" } ],
        "pr": { "label": "app #1234", "link": "https://github.com/…", "note": "CI 7/7 green" },
        "qa": { "note": "not yet: runs when the build is done" },
        "review": { "note": "none: D-30" }
      } }
  ],
  "done": [ { "id": "sidebar-scroll", "name": "#1240 what it did", "detail": "merged 13:02 · no issues hit", "…": "the item's other fields, kept as they were" } ],
  "decisions": [
    { "id": "D-4", "item": "the id of the item it is about, or a short name", "answer": "the answer, one line", "by": "You | Planner | Advisor",
      "q": "the question asked", "options": ["option", "option"], "chosen": "exactly one of options",
      "note": "optional one line", "when": "13:10", "ref": "where it came from, e.g. Q-1 from the planner" }
  ],
  "sources": [ { "label": "Cover sheet (plan rev 2)", "link": "https://… | a relative path in the Session artifact", "note": "optional, e.g. approved, D-10", "group": "Plan and decisions" } ],
  "links": [ { "label": "PR #1251 walkthrough", "link": "https://…", "note": "optional", "group": "Pane #1251" } ]
}
```

Keep the JSON at `<Session folder>/.agent/status.json` and update it in place, so each rewrite starts from the last one.

**Session with no workers.** A Session that only talks still gets its page from the first working turn: the title, what the Session is about as the flow's caption (shown under the title when no diagram is drawn), any open questions and decisions, and empty items, which the page shows as "No workers yet."

```json
{
  "session": { "title": "Release questions", "eyebrow": "Updated 09:12 · 4 min elapsed",
    "summary": "Deciding whether 0.3 ships this week.", "nextStep": "you answer Q-1.", "settings": "Review on ready; validation deferred",
    "flow": { "caption": "Goal: decide whether 0.3 ships this week", "steps": [] } },
  "needs": [], "items": [], "done": [],
  "decisions": [ { "id": "D-1", "answer": "Ship after the docs fix", "by": "You", "when": "09:10" } ]
}
```

**Session.** `eyebrow` is the local time of the newest evidence you read and the time elapsed since the Session started, with no cost. `summary` says, in plain words, what the Session is for and where it stands; `nextStep` names the next action and who takes it, the same "Next: …" your progress messages end with. Always give `flow.caption`, the Session's goal in one line. Give its `steps` when items depend on each other (`depends_on` in the ledger) or run in sequence: one step per item or wave, in the order of work. The page draws the steps only with 2 or more items in flight, and otherwise shows the caption alone under the title. Shared ledgers and stub hubs in other destinations are links in `settings`.

The overview's tiles (work items, done, in progress, waiting on you, blocked, and queued when any item is) and its progress bar are counted by the renderer from the items' states, so they always agree with the cards.

**Questions.** No page shows a question's wording, options or reasons: questions live only in Approvals in Pane, and in your chat elsewhere. `needs` holds one entry per open question, approval or finding waiting on the person, oldest first, `[]` when there are none, with only its `id`, the `item` id it blocks and, in Pane, its `link`; the renderer ignores any other field. The overview shows one pointer with the count, each Q-id and its item ("2 questions wait for you in Approvals: Q-7 (#1014) and Q-8 (#1241)"), and the item page of each blocked item shows a Waiting row first.

- In Pane, every question has a card in Approvals. `link` is `pane://open?pane=<pane id>&panel=<panel id>` of the tab that holds its card: the asking worker's for a question asked through Notify (`"asked": "notify"`), yours for one you relayed. Pane opens Approvals on that card. Set `session.approvals` to the oldest one's link; "Open Approvals →" opens it.
- A question asked through Notify has no Q-n until it is answered: give `id: null`, and the page shows it as "a new question".
- Outside Pane, give no `link` and no `session.approvals`: the pointer says the questions wait in the orchestrator's chat.
- Review findings waiting on the person: the F-n, with the item id.

**Items.** One per work item still in flight, in the order of work. Every item has an `id` that names its page, `items/<id>.html`: lower-case letters, digits and hyphens, unique across `items` and `done`, set once when the item enters the ledger (its `page_id`) and never changed, even when the item is renamed or finishes. Items sharing a `group` (a plan's packages, a batch of picked-up PRs) are siblings on their pages, in JSON order; ungrouped items form one group. In Pane, `paneLink` opens its Pane. `state` is `need` when it waits on the person, `blocked` or `failed` when a worker is stuck, `queued` before it starts; the tiles count those, and `next` says what is missing or the failure in one line. `asked` is what the person asked for in their own words, from the starting message or request; `changes` is what the plan package or PR changes.

`fixRounds` is the ledger's `fix_rounds` for the PR (QA and review rounds together, of the budget its latest review set); the card shows "Fix rounds 1 of 2" and marks it once the budget is spent. Leave it out before the first review or QA fix round.

The rail is the path the work actually took, then what is still ahead: one dot per real step (Plan, Plan rev 2, Approved, Build, CI, Fix 1, CI again, QA, Review, Fix F-1–F-3, Follow-up review, Merge). A past failure that was retried is `retried`; the current step is `now`, `need`, `blocked` or `failed`; steps still ahead are `todo`. Keep labels to 1 or 2 words and rails to about 10 dots.

`next` carries what the rail cannot show:

- unreviewed commits: "N commits since the last review at <sha>, not reviewed", counted with `git rev-list --count <last reviewed head>..<PR head>`, or "never reviewed" when there is no reviewed head;
- validation still pending, from the ledger's `validation` (for example "Validation deferred: CI, QA and review wait for 'ready'");
- "no destination" when the repository names none.

The last reviewed head is the ledger's `last_reviewed_head` for that PR. When the ledger has lost it, use the head in the newest `<!-- greenfield-review head=<sha> -->` marker on the PR's reviews, and record it.

**Everything for this item.** `refs` fills the item page's table, one key per row: `refs.plan`, `refs.task`, `refs.pr`, `refs.qa`, `refs.review`, `refs.decisions`, `refs.depends`, `refs.worker`, `refs.trace`, `refs.evidence`, `refs.postmortem`. Each is one entry or a list of them, `{ "label", "link", "note" }`, with a link when the file or page exists and a short reason in `note` when it does not ("none: D-30", "not yet: written when the review loop closes"). The rows Plan (for a planned item) or Task (for any other), Pull request, QA, Review, Worker, Trace and Post-mortem always show; one you leave empty shows "Not recorded", so a gap looks like a gap. Fill them from the workers' status files, the findings files, the traces and the post-mortems:

- `refs.plan`: a planned item's cover sheet (its package's section) and its brief. The item page links them; it never copies them.
- `refs.task`: the starting message or request a quick fix, tweak or picked-up PR came from.
- `refs.pr`: the pull request, its branch or checks line, and the PR's own artifact (the implementer's `pr_artifact`).
- `refs.qa`, `refs.review`: the QA record and the review or findings file, with the outcome, or why there is none.
- `refs.worker`: the worker's tab (`pane://open?pane=…&panel=…`) while it runs.
- `refs.trace`, `refs.postmortem`: added when the review loop closes; "no issues hit" when it closed cleanly.
- `refs.decisions`: the renderer adds every decision whose `item` is this id; use the key only for anything else.

Write relative links relative to the overview (`env-vars/cover-sheet.html`, `work/findings.md`); the renderer rebases them for the item pages one folder down.

**Done.** Every completed item (PR merged or closed, plan abandoned), newest first, with its outcome in `detail` and "no issues hit" or that a post-mortem exists. An item moves here and is never removed; it keeps its `id`, `group`, `refs` and other fields, and its page. A finished entry from before item pages may have no `id`; it then links its `link` and gets no page.

**Decisions.** Every D-n, newest first, from the ledger's `decisions`. Give `item` the id of the item a decision is about, so its page lists it. An addendum is a decision whose `ref` names it and whose `note` lists the work items it was sent to.

**Sources and links.** The overview is the one place that points to everything the person may need to see. Add every artifact a worker produces or relies on as soon as it appears, and keep it after the work is done. `sources` are the documents behind the work: cover sheets, briefs, options and decision pages, plans, addenda, mockups, review findings, QA records and traces. `links` are everything else worth opening: PRs, each PR's own artifact (the implementer's `pr_artifact`), reviews, Panes, dashboards and external references. Take them from the workers' status files, the bundles' pages, the findings files and the briefs you wrote. A file that exists only in the Session folder, such as a findings file or a brief, goes into the Session artifact (or its item's bundle) and is linked by its relative path, since a published page cannot open `file://` links; use `file:///…` only when there is no destination and the page stays local. Group entries by kind of work with `group`: in `sources`, "Plan and decisions", "Design", "Reviews", "QA" and one group per follow-up; in `links`, one group per PR named by repository and number (for example "Pane #1251"), then "Examples" or "Other". Groups show in the order they first appear, and an entry without one falls under "Other". The page omits a section whose array is empty. A `link` with a scheme other than `http`, `https`, `file` or `pane` becomes `#`. Write every relative link with a `/` in it (`./report.md#sec`, `work/findings.md`), because a bare file name with `#`, `?`, `%` or a space in it can become `#`.

The cleanup log and the end-of-run summary live in the ledger and your final report, not on the page.

Link only pages that exist, with relative links inside the Session artifact, and check each local link before publishing.
