# Brief: fix and re-record journeys {RANGE} of {PRODUCT}

Project: `{PROJECT}`. The harness changed ({WHAT_CHANGED}), so every journey
in the range gets re-recorded. Read `QA.md` and the skill's
`references/harness.md`.

For each journey:

1. Fix the script issues in its `QA.md` row, and drop ad-hoc fixtures the
   shared demo world now covers. Usual suspects: the ring on the wrong
   element, a start on a feature page, a control named wrongly in a caption
   ("gear" for a "..." menu), a duplicated demo record, a locator timeout.
2. Record with `--parallel 1` until it passes.
3. Check 5 frames (about 10, 30, 50, 70 % and the last) against
   `templates/audit-checklist.md`, and read the call log.
4. Set its `QA.md` row to `accepted` or `needs fix` with the reason; a
   journey that can't be recorded goes in `SKIPPED.md`.

Touch only your journeys' files and report harness bugs. Time limit:
{MINUTES} minutes. Final message under 60 words: accepted, still failing, skipped.
