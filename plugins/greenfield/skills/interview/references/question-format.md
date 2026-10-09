# Question format

Every round has the same shape on every model, so the person learns it once.

```
Before the round    open the page the questions are about (options, mockup, diagram,
                    cover sheet section) and say in one line what it shows

Round               1 to 4 questions, grouped by topic, most consequential first

  Question          one sentence that ends in "?". Name the work item or lane
                    when several are in flight: "Lane B: ...". Add the fact
                    that makes it a real choice when it isn't obvious
  Header            a chip of 12 characters or fewer: "Opt-out", "Sched files"
  Options           2 to 4, mutually exclusive, the recommended one first
    Label           1 to 5 words; the recommended one ends in " (Recommended)"
    Description     one line giving the consequence of choosing it, not a
                    feature list
  Multi-select      only when the choices genuinely combine ("pick any")

After the round     plain-text open questions, numbered: names, numbers,
                    credentials, dates
                    then: what you changed, as "decisions.html Round N · <docs> revised"
```

## Tool mapping

- **Claude Code:** `AskUserQuestion` with `questions[]`, each having `question`, `header`, `options[]` (`label` and `description`) and `multiSelect`. Use the `preview` field to compare short mockups or code side by side.
- **Codex and other harnesses:** use the native question tool if there is one. Otherwise send the same structure as a numbered Markdown list: `1. Question? (header)`, then `   a. Label (Recommended): consequence`. Ask the person to reply with something like "1a 2c".

## Writing good options

- Each option states what the person gets and what they give up, in their terms.
- Include the smallest version or "not now" when deferring is reasonable.
- Never offer an option that contradicts a recorded decision without saying which decision it would reverse.
- If the person answers with a question, a correction or "I'm confused", don't record anything. Explain, with a page if that's quicker, then ask the same question again.

## Example

```
[opens tradeoff-scheduled-files.html]
Q1  Scheduling with files: which way?                                   (Sched files)
    • Text-only Tuesday, files next (Recommended): lowest risk; files add on later, no rework
    • Files too, by Tuesday: about one more day across two lanes, plus four new edge cases
→ decisions.html Round 12 · lane B and lane C plans revised
```
