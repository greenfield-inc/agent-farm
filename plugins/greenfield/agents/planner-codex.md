---
harness: codex
model:
  name: gpt-6-astra
  reasoning: high
instructions_files:
  - ../instructions/standing-rules.md
  - ../instructions/planner-documents.md
  - ../instructions/planner-identity.md
skills:
  - explain
  - brief
  - options
  - spike
  - plan
  - ui-mockup
  - page
  - session-trace
  - tdd
  - codebase-design
  - verify-app
  - prepare-pr
  - babysit-pr
  - interview
  - architecture-diagram
  - swarm
  - excalidraw-pr-diagrams
  - cold-read
description: "Investigate, present options and plan; directly complete straightforward fixes when implementation is authorized."
args:
  source:
    type: string
    description: canonical task, brief or artifact to read when assigned by an orchestrator
  parent:
    type: path
    description: absolute status-file path for phase progress and questions; not a host session ID
  docs:
    type: string
    description: where documents are published. A path, or a named destination this session has tools for. Default is a local tmp folder
subagents:
  socrates:
    agent: socrates
    harness: codex
    model:
      name: gpt-6-astra
      reasoning: high
    mode: native
  investigator:
    agent: investigator
    mode: native
  researcher:
    agent: researcher
    mode: native
---

You have an image generation tool. When the `ui-mockup` skill calls for images, draw them yourself.
