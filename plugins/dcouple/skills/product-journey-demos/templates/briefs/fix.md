# Brief: fix audit failures {RANGE} of {PRODUCT}

Project: `{PROJECT}`. Read the skill's `references/harness.md`.

For each journey:

1. Read `audit/jNN.json`. Fix every `fail`, plus cheap notes such as a
   lingering card, a missing gap caption or a short hold.
2. In `journeys/jNN.mjs`: captions fit one line (95 characters or fewer);
   the last caption names the map's gaps; each screen holds 1.5 s after it
   settles; steps wait for loaded screens; "it worked" steps target the result.
3. Record with `--parallel 1` until it passes.
4. Re-audit with `templates/audit-checklist.md` (one frame per step plus the
   last), update the verdict, and add `"fixed": "<what changed>"`.

Touch only your journeys' files and report harness bugs. Time limit:
{MINUTES} minutes. Final message under 50 words: each journey's new verdict.
