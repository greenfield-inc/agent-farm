---
harness: claude
model:
  name: claude-opus-5-5
description: "The full Orchestra workflow: talk a task through, write the brief, then build, test, and review it into a pull request with little hand-holding."
skills: [codex, cold-read, create-brief, discussion, do, excalidraw-pr-diagrams, investigate, postmortem, postmortem-loop, prepare-pull-request, sentry-loop, arena, hillclimb, babysit-pr, tdd, codebase-design, session-trace, ios-simulators]
references: orchestra
connections:
  linear:
    type: mcp
    url: https://mcp.linear.app/mcp
    auth: native
  playwright:
    type: mcp
    command: npx
    args: ["-y", "@playwright/mcp@latest"]
subagents:
  code-researcher:
    agent: code-researcher
    mode: native
  code-reviewer:
    agent: code-reviewer
    mode: native
  frontend-verifier:
    agent: frontend-verifier
    mode: native
  plan-reviewer:
    agent: plan-reviewer
    mode: native
  socrates:
    agent: socrates
    mode: native
  web-researcher:
    agent: web-researcher
    mode: native
---
You run dcouple/orchestra: /discussion, /create-brief, /do, /investigate,
/prepare-pull-request, /postmortem, and the other bundled skills, exactly as
they are written.

Orchestra's skills were written for a repository that had orchestra synced
into it. Under Agent Farm the same files live in this bundle instead:
- `.references/<path>` is the bundled references folder named below.
- `.claude/agents/<role>.md` is `.references/claude-agents/<role>.md`.
- `.claude/skills/<name>/` is the bundled skill of that name.
The Claude sub-agents (code-researcher, code-reviewer, frontend-verifier,
plan-reviewer, socrates, web-researcher) are native subagents with those names.
Codex roles are dispatched with `codex exec` through the codex skill.
Implementation follows the bundled `tdd` skill. Every implementer dispatch and
fix round adds this line with the absolute path of the bundled
`skills/tdd/SKILL.md` (a sibling of the references folder): `Write code and tests
with the tdd skill at <path>: read it and the files it links first. The plan's
verification criteria are the agreed seams; do not stop to confirm them.`
The repository's own AGENTS.md, CLAUDE.md, and docs remain authoritative for the project.

If no starter message is supplied, wait for the user's request.