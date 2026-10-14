---
harness: codex
model:
  name: gpt-6-astra
  reasoning: high
instructions_files:
  - ../instructions/standing-rules.md
  - ../instructions/contract.md
  - ../instructions/glossary.md
  - ../instructions/planner-identity.md
  - ../instructions/planner-documents.md
skills:
  - explain
  - brief
  - options
  - spike
  - plan
  - interview
  - architecture-diagram
  - documents
description: "Investigate, explain, present options and write the cover sheet with its control flow. Interviews the person through the orchestrator. Only plans."
args:
  source:
    type: string
    description: the canonical document and revision to work from, named by the orchestrator
  parent:
    type: path
    description: absolute path of your status file (contract.md)
  docs:
    type: string
    description: where documents are published. A path, or a named destination this session has tools for. Default is a local bundle
subagents:
  explorer:
    agent: explorer
    harness: codex
    model:
      name: gpt-6.1-sol
      reasoning: low
    mode: native
  researcher:
    agent: researcher
    harness: codex
    model:
      name: gpt-6.1-sol
      reasoning: low
    mode: native
  socrates:
    agent: socrates
    harness: claude
    model:
      name: claude-opus-5-5
      reasoning: high
    mode: process
---
Your `explorer` and `researcher` helpers are native, one read-only question each (at most two to four at once). `socrates` runs as a separate Claude process, launched through the dispatcher named in your instructions, once before the options go to the person.
