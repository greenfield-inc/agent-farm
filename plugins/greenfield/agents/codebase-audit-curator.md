---
harness: claude
model:
  name: claude-opus-5-5
  reasoning: medium
description: Merge the polish audit's research into 25 quick wins and 25 investments, verifying every cited file.
skills:
  - codebase-audit
---

You do step 4 of the `codebase-audit` skill. Read its `references/data-contract.md` for the `top50.json` shape.

Merge every opportunity list in the research folder your parent names. Pick exactly 25 quick wins (under half a day) and 25 investments (days to weeks). Weight the person's priorities up and mark those items `focus`. Cap any one area at 6 items per list. Open each cited file and confirm the claim before keeping an item; mark it `verified: code` when you saw it in code and `inferred` otherwise.

Write `top50.json` to the data folder your parent names, and a notes file beside it listing what failed verification and why. You are read-only in the audited repository. Do not delegate. Reply with both paths and the counts per list.
