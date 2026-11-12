# Relay

How a worker's `needs_you` (standing rules, Questions for the person) reaches the person, and how the answer goes back. One round at a time, newest blocking question first; batch `fyi` blocks into the map instead.

In Pane, ask and relay the way the `pane` skill says (its "Asking the person in Pane" section); this page keeps only Greenfield's numbering and the lines back to the worker. Relaying a worker's question in Pane always uses `runpane notify --relays <item>`, never `AskUserQuestion`.

## Asked through Notify

A block with `"asked": "notify"` already reached the person as the worker's own Notify cards. Never relay it while its card is live. The status pages show it only by count, and on its item page as a Waiting row that links the asking tab (status-board.md).

- **Answered** (`answers` is not empty): assign the block the next free Q-n and each answer the next free D-n, record them as for an answer below, and send `recorded: Q-n → <answer>. Recorded as D-n.` to the asking tab only, with one `→ <answer>` and one D-n per question in order when the block has several. On the next rewrite its row moves to Decisions.
- **The card is gone** (a crash, an interrupt or a restart): when `answers` is empty and `runpane sessions overview` shows the worker's agent in any state other than `blocked` on two checks at least a minute apart, relay the block as below. One check is not enough: a worker that got `waiting` runs briefly before it calls `notify` again.

Every other block, `"asked": "relay"` or with no `asked`, is relayed.

## A worker's report card in a Pane Session

In a Pane Session, a worker's blocked report is already an answerable card in Approvals, built from the `needs_you` in its status file. Never put the same question to the person a second way, and never through `AskUserQuestion`: relay that card with `runpane notify --relays <item>`, then record the answer with `runpane inbox ack <item> --decision <D-n>` and send the line under Back to the worker. The `pane` skill and Pane's orchestration guide have the mechanics.

## To the person

Open every file in `files` beside the person first, with the host's show-file or show-page mechanism; they belong to the question, so open them without asking. Where the host has none, link them. When `files` is empty, find where the question's context lives (a page and anchor, a PR comment, a file and line, a decision) and add a `Context: <where the context lives>` line to the round instead. The status pages never show a question's wording: only its Q-id, in the overview's pointer and its item page's Waiting row. Then put the round:

```text
[Needs you · <role> · <feature>] Q-n <title>
1. <question>?                                        (<header>)
   a. <option> (recommended): <consequence>
   b. <option>: <consequence>
   Why: <why>
Files   <each file, opened beside you>
Context: <where the context lives>                    (only when there are no files)
```

In Pane, the round is an approval card: `runpane notify --relays <item>` for a worker's report card, otherwise `runpane notify` as the `pane` skill says, never `AskUserQuestion`. Outside Pane, on Claude, put the questions through the harness question tool (`AskUserQuestion`) once the files are open, the recommended option first; on Codex, use the numbered list above, answered as "1a". Keep the worker's options and wording; add only the label, and the Context line when there are no files.

## Back to the worker

- **An answer.** Record each question's answer as the next D-n in that work's decision log (the bundle's, with `interview`), or in the map's Decisions log when the work has no bundle. Send one line to the asking tab only: `answer: Q-n → <the answer, quoted exactly when it is free text>. Recorded as D-n.` Nobody else gets it; a decision that changes other running work goes out as an addendum.
- **A question back.** Send `clarify: Q-n → <the person's question>` to the asking tab, even when you can answer it yourself from an approved source (then add your answer and its source after it, and show the person the same), so the worker adds it to `why`. Q-n stays open and nothing is recorded; relay its next report the same way.
- **A clash.** Q-n are unique per Session. When a worker's id is already used in the map, relay it under the next free Q-n and answer `answer: Q-9 (raised as Q-3) → …`.

Never answer a product question for the person, and never treat their silence as an answer.
