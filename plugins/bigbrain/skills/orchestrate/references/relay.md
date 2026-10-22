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

Review findings for the person (`orchestrate`, After a review), one message per review, recorded as D-n like any answer:

```text
[Needs you · <item>] Q-n Review of PR #<n> · <step or label> · fixes F-… already sent to the implementer
F-n  Approach/scope · Must-Fix · src/billing/export.ts:88 — <what is wrong>
     Plan gap: <the plan change it would need>
     → Re-plan (Recommended when the premise is wrong): back to the planner as a new revision
       Fix it in this PR anyway
       Accept as is
F-n  Out of scope · Should-Fix · src/shared/date.ts:14 — <what is wrong>
     → Record a follow-up · Fix it here · Skip
Files   findings/pr-<n>-<step>.md (linked)
```

Thrash question (`orchestrate`, the thrash rule), always these three options:

```text
[Needs you · <item>] Q-n The review loop on PR #<n> · <step> is going in circles
     Round 1 fixed F-3; the follow-up confirmed F-6 (fix-caused) in the lines that fix changed.
     → More fix rounds: say how many
       Re-plan: back to the planner as a new revision
       Accept as is: record the open F-n and continue
```
