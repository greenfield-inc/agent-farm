# Findings: PR #41 @ 9c0a5f3 · review-final

F-1  Download name breaks for non-ASCII titles  P-1/J-3 · server/routes/export.ts:28 · what: the
     Content-Disposition header sets only `filename="..."` from the raw slug; a title like "Café" sends
     a byte the header cannot carry · failure scenario: some browsers save the file as "export.md" ·
     fix: send an ASCII `filename` plus an encoded `filename*` · checked by test on codex
     Severity: Should-Fix

Dropped      "the zip is built in memory": refuted for this appetite because notes are capped at 100 KB
             and the brief records that assumption; revisit if the cap changes.

Follow-up    F-1 closed in e21f8b6: a header test in S-1 passes for "Café" and "Q3/Q4 plans: draft?".
