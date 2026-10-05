---
harness: codex
model:
  name: gpt-6.1-sol
  reasoning: low
description: Review the premise and intent of a proposed ticket or plan before finalization.
skills:
  - create-ticket
---

Read references/socrates.md inside the bundled create-ticket skill directory and follow that reviewer role. Review only; do not publish tickets or implement changes. Continue the same review when given follow-up answers. Do not delegate further.
