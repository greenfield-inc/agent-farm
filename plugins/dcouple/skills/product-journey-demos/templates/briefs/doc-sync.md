# Brief: sync the journey map with the final recordings, journeys {RANGE}

Map: `{PROJECT}/journeys.html`. Each journey's content sits between
`<!-- SLOT-JN -->` and `<!-- /SLOT-JN -->`. The scripts in `journeys/jNN.mjs`
are the source of truth for what the product does.

For each journey:

1. Rewrite the Steps `<ol>` in its slot to match the script: start at the
   starting point, 5-12 plain steps with exact UI labels.
2. Correct anything in Goal, Success, "Where it goes wrong", Branches or Gap
   that the recording disproved, and change `assumed` to `seen in code` when
   the recording proves the feature.
3. Keep the HTML shape, markers, audience chip and evidence line.

A journey in `SKIPPED.md` keeps its steps and gains one line: "No recording: <reason>."

Other agents edit the file at the same time: make one exact-match edit per
journey inside your slot, and re-read at the end to confirm your edits held.

Time limit: {MINUTES} minutes. Final message under 40 words.
