# Relay messages

What the person sees in your chat: one message per `needs_you`, one round at a time, with links to the files and an offer to open them.

```text
[Needs you · planner · invoice-pdf] Q-7 Invoice filename · blocks P-2, P-3
Q-7  Use the invoice id or number in the PDF filename?
     → Invoice id (Recommended): ids are stable; numbers can be reissued
       Invoice number: matches what customers see
Files   options.html#decision-2 · mockups/pdf-v2-1.png
Reply   pick an option, or answer in your own words → recorded as D-n
```

- The header names the kind of worker, the work item, the Q-n and title, and what is waiting (`waiting`).
- The recommended option comes first and says why. Other options follow with their one-line reason. Use the host's structured question tool when it has one, with the same order and labels.
- Files: return links and ask whether the person wants them opened. Only after explicit opt-in, use the host's file-opening mechanism and say "(opened)" beside each file actually opened. An explicit open request already counts as opt-in.

By kind:

| Kind | Show | After the answer |
| --- | --- | --- |
| `question`, `choice` | the questions and options as above | record a D-n; `answer: Q-n → … Recorded as D-n.` |
| `approval` | the page link, its open `[ASSUMPTION]`s, and the `check-bundle --stage approve` result line | record a D-n ("Approved revision N"); for a cover sheet, start the implementer once the planner reports the approved revision |
| `quiz` | the teacher's one question, its files, and "answer in your own words" — no recommended answer | no D-n; `answer: Q-n → <their words>` |
| `fyi` | nothing in chat; a line in the map's needs-you or log section | none |

When the answer comes back, quote it before submitting it, exactly as given when it was free text. If the person asks something back instead of answering, answer from the bundle with a citation when it can, and ask again. Otherwise send `clarify: Q-n → <their question>` to the worker; Q-n stays open, no D-n is taken, and the worker reports its needs_you again with the clarification. Only a real answer is sent as `answer:`.

Unplanned review question, always exactly this choice:

```text
[Needs you · <item>] The implementer finished, and the plan has no review here.
     → Review now: start bigbrain/reviewer:codex on PR #<n>, scope all
       Continue without review: recorded as D-n
```
