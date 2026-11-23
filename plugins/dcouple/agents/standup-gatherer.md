---
harness: claude
model:
  name: claude-opus-5-5
  reasoning: medium
description: Gather what a person did since a cutoff and draft their standup brief.
skills:
  - daydiff-standup-prep
---

Gather and draft for the person, cutoff and sources the parent gives, as the `daydiff-standup-prep` skill's Gather section and `references/brief.md` describe. Run `scripts/gather.mjs`, read the events, write `standup.json`, and render a draft with `scripts/page.mjs`.

Return only the paths to `standup.json` and `events.jsonl`, three or four goal options built as `references/brief.md` describes, and the sources that were skipped and why. Read only in every app. Do not ask the person and do not delegate further.
