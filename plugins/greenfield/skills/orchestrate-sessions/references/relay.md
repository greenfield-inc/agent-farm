# Relay

How a worker's `needs_you` (standing rules, Questions for the person) reaches the person, and how the answer goes back. One round at a time, newest blocking question first (under Pane, one Approvals card per Q-n, all waiting at once); batch `fyi` blocks into the map instead.

## To the person

Open every file in `files` beside the person first, with the host's show-file or show-page mechanism; they belong to the question, so open them without asking. Where the host has none, link them. When `files` is empty, find where the question's context lives (a page and anchor, a PR comment, a file and line, a decision) and add a `Context: <where the context lives>` line to the round instead. The question's Needs you row on the status page links the same places. Then put the round:

```text
[Needs you · <role> · <feature>] Q-n <title>
1. <question>?                                        (<header>)
   a. <option> (recommended): <consequence>
   b. <option>: <consequence>
   Why: <why>
Files   <each file, opened beside you>
Context: <where the context lives>                    (only when there are no files)
```

On Claude, put the questions through the harness question tool (`AskUserQuestion`) once the files are open, the recommended option first; on Codex, use the numbered list above, answered as "1a". Keep the worker's options and wording; add only the label, and the Context line when there are no files, so its Needs you row links the same places.

**Under Pane, through Approvals.** When you run under Pane (`PANE_ORCHESTRATION_SESSION_ID` is set, or you are in a Pane terminal and `runpane` answers), post each Q-n to Pane's Approvals instead, exactly once, and stay free to talk. Pane's orchestrator guide (`runpane docs read --doc skills/pane-orchestration/SKILL.md`, "What waits on the person") is the source; in short:

- One background `runpane notify ... --json` per Q-n (in Claude Code, Bash with `run_in_background`), titled `Q-n: <title>`, with the round in `--context`, the options as `--choices` (recommended first; `--ui approve` for an approval, `--ui ask` for a round of several questions), and `files` as `--links` (up to 6: `{"label":…,"path":…}` for a file, `{"label":…,"url":…}` for a page), which open beside the card. The CLI call waits until the person answers; don't use the MCP `notify` tool, which returns `waiting`, and don't block your turn on `AskUserQuestion`.
- Once posted, acknowledge the worker's inbox item (`runpane inbox ack <id>`).
- When the call returns, it carries the answer: send it back as below. Stop the background call of a Q-n that is superseded or no longer needed (TaskStop in Claude Code), which expires its card.
- When you start, resume or wake, reconcile your open calls against the status files and the map: post what still waits and has no open call, exactly once (Pane keeps no approvals across a restart), and stop what is stale.
- If notify returns `unavailable` (Approvals is off, or Pane isn't running), put the round as above.

## Back to the worker

- **An answer.** Record it as the next D-n in that work's decision log (the bundle's, with `interview`), or in the map's Decisions log when the work has no bundle. Send one line to the asking tab only: `answer: Q-n → <the answer, quoted exactly when it is free text>. Recorded as D-n.` Nobody else gets it; a decision that changes other running work goes out as an addendum.
- **A question back.** Send `clarify: Q-n → <the person's question>` to the asking tab, even when you can answer it yourself from an approved source (then add your answer and its source after it, and show the person the same), so the worker adds it to `why`. Q-n stays open and nothing is recorded; relay its next report the same way.
- **A clash.** Q-n are unique per Session. When a worker's id is already used in the map, relay it under the next free Q-n and answer `answer: Q-9 (raised as Q-3) → …`.

Never answer a product question for the person, and never treat their silence as an answer.
