# Brief: file the missing features the journey map found in {PRODUCT}

Sources: Gap bullets, `assumed` chips and "not built" wording in
`{PROJECT}/journeys.html`, plus `SKIPPED.md`. Tracker: {TRACKER}, team
{TEAM}. The person asked for these issues.

1. Check the code (every app and the backend). If the feature exists, correct
   the map and drop the candidate.
2. Search the tracker; for an existing issue, comment with the journey number
   and title.
3. File one issue per missing feature, merging gaps that are the same feature.
   Title: verb-first and user-facing ("Let staff schedule a message to send
   later"). Body: the problem and its journey; what exists today, with file
   paths; who it affects; why it matters; rough scope; and the source
   ("Found while mapping {PRODUCT} user journeys, journey N"). Leave design
   out, use existing labels only, and leave priority and assignee empty.

Deliverable: `{PROJECT}/filed-issues.md`, a table of candidate, verified
missing (with evidence), issue link (new or commented), and title. If the
tracker is unreachable, stop as blocked.
