# Relay messages

What the person sees in your chat: one message per `needs_you`, one round at a time, the files opened beside them.

```text
[Needs you · planner · invoice-pdf] Q-7 Invoice filename · blocks P-2, P-3
Q-7  Use the invoice id or number in the PDF filename?
     → Invoice id (Recommended): ids are stable; numbers can be reissued
       Invoice number: matches what customers see
Files   options.html#decision-2 (opened) · mockups/pdf-v2-1.png (opened)
Reply   pick an option, or answer in your own words → recorded as D-n
```

- The header names the kind of worker, the work item, the Q-n and title, and what is waiting (`waiting`).
- The recommended option comes first and says why. Other options follow with their one-line reason. Use the host's structured question tool when it has one, with the same order and labels.
- Files: open HTML and images beside the person with the host's file-opening mechanism; say "(opened)" beside each one you opened, and link the rest.

**Through the host's approvals queue.** Where the host has one, such as Pane's Approvals while it is on (its orchestrator guide, "What waits on the person", has the commands and is the source), post each Q-n there instead of in chat, exactly once, and stay free to talk:

- One post per Q-n, titled with the Q-n, with the message above as its context, the options as choices (recommended first), and `files` as its links, made as a background call that returns the answer (in Pane, `runpane notify ... --json` with `--links`, run in the background; not the MCP `notify` tool, which returns `waiting`). Never block your turn on a structured question tool while it waits.
- Once posted, acknowledge the worker's report the way the host says (in Pane, `runpane inbox ack <id>`).
- When the call returns, handle its answer as below. Stop the call of a Q-n that is superseded or no longer needed, which takes it down.
- When you start, resume or wake, reconcile your open calls against the status files and the map: post what still waits and has no open call, exactly once (Pane keeps no approvals across a restart), and stop what is stale.
- When the host says the queue is unavailable (in Pane, notify returns `unavailable`: Approvals is off, or Pane isn't running), show the message in chat as above.

By kind:

| Kind | Show | After the answer |
| --- | --- | --- |
| `question`, `choice` | the questions and options as above | record a D-n; `answer: Q-n → … Recorded as D-n.` |
| `approval` | the page (opened), its open `[ASSUMPTION]`s, and the `check-bundle --stage approve` result line | record a D-n ("Approved revision N"); for a cover sheet, start the implementer once the planner reports the approved revision |
| `quiz` | the teacher's one question, its files, and "answer in your own words" — no recommended answer | no D-n; `answer: Q-n → <their words>` |
| `fyi` | nothing in chat; a line in the map's needs-you or log section | none |

When the answer comes back, quote it before submitting it, exactly as given when it was free text. If the person asks something back instead of answering, answer from the bundle with a citation when it can, and ask again. Otherwise send `clarify: Q-n → <their question>` to the worker; Q-n stays open, no D-n is taken, and the worker reports its needs_you again with the clarification. Only a real answer is sent as `answer:`.

Unplanned review question, always exactly this choice:

```text
[Needs you · <item>] The implementer finished, and the plan has no review here.
     → Review now: start bigbrain/reviewer:codex on PR #<n>, scope all
       Continue without review: recorded as D-n
```
