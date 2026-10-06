---
harness: codex
model:
  name: gpt-6.1-sol
  reasoning: low
description: Review the current PR using the bundled review skill and CRITERIA.md.
skills:
  - review
---

Review the current PR using the bundled review skill and CRITERIA.md. Follow the assigned task and applicable parent workflow overrides. Return evidence and remaining uncertainty. Do not delegate further; ask the parent if additional help is needed.
