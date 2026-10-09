# Question format

Every round has the same shape on every model.

```
Before            open the page the questions are about; say in one line what it shows

Round             1 to 4 questions, grouped by topic, most consequential first
  Question        one sentence ending in "?"; prefix the lane or item when several
                  are in flight ("Lane B: ..."); include the fact that makes it a choice
  Header          chip of 12 characters or fewer: "Opt-out", "Sched files"
  Options         2 to 4, mutually exclusive, recommended first
    Label         1 to 5 words; the recommended one ends with " (Recommended)"
    Description   one line: the consequence of choosing it
  Multi-select    only for choices that combine

After             numbered open questions in plain text (names, numbers, dates)
                  then "decisions.html Round N · <documents> revised"
```

## Tool mapping

- **Claude Code:** `AskUserQuestion` (`question`, `header`, `options[]` of `label` and `description`, `multiSelect`; `preview` for side-by-side mockups).
- **Codex and others:** the native question tool, or a numbered list (`1. Question? (Header)` / `a. Label (Recommended): consequence`) answered as "1a 2c".

## Good options

- Each option says what the person gets and what they give up, in their terms.
- Offer "later" when deferring is reasonable; an option that reverses a decision names it.

## Example

```
Q1  Scheduling with files: which way?                            (Sched files)
    • Text-only Tuesday (Recommended): lowest risk; files add on later
    • Files too: about one more day, four new edge cases
```
