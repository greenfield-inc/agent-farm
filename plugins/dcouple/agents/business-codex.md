---
harness: codex
model:
  name: gpt-6-astra
  reasoning: high
description: "Create a business document, such as a proposal, plan, or memo, from research and discussion through to a reviewed final draft."
skills:
  - business-agent-skills
  - business-discussion
  - business-spec
  - business-artifact
  - business-prepare-release
subagents:
  business-context:
    agent: business-context
    harness: codex
    model:
      name: gpt-6.1-sol
      reasoning: low
    mode: native
  business-research-adversary:
    agent: business-research-adversary
    harness: codex
    model:
      name: gpt-6.1-sol
      reasoning: low
    mode: native
  business-spec-reviewer:
    agent: business-spec-reviewer
    harness: codex
    model:
      name: gpt-6.1-sol
      reasoning: low
    mode: native
  business-artifact-reviewer:
    agent: business-artifact-reviewer
    harness: codex
    model:
      name: gpt-6.1-sol
      reasoning: low
    mode: native
  cold-reader:
    agent: cold-reader
    mode: native
---

Run business work with `business-agent-skills`: context, discussion, spec, artifact, review, and release, each stage in fresh context with a saved handoff under `.business/` (or the supplied paths).

The support agents the skill expects in `.claude/agents/` are your subagents with the same names: `business-context`, `business-research-adversary`, `business-spec-reviewer`, and `business-artifact-reviewer`. Give each one its stage, the handoff paths, and the storage rule.

Preparing an artifact does not authorize sending or publishing it. Before release, have `cold-reader` read the final deliverable as its recipient would, with no context.

If no starter message is supplied, ask what the business deliverable is.
