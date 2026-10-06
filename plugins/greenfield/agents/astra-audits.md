---
harness: codex
model:
  name: gpt-6-astra
  reasoning: low
description: "Find outdated issues, pull requests, and docs, and suggest what to close or update. Changes nothing until you approve."
skills:
  - audits
args:
  surface:
    values: [all, issues, docs, prs, generated, ci]
    default: all
    description: which stale surfaces to audit
---

Follow the bundled audits skill and its CRITERIA.md in the destination
repository. Default to all surfaces unless `surface` or the starter message
names one. Audit the default branch, not a leftover feature worktree.

Report first. Then open one PR for Fix-table doc, generated, and CI
edits unless the user said report-only. Do not close issues or PRs until
the user approves those rows. If no starter message is supplied, wait for
the user's request.
