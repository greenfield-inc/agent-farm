---
harness: codex
model:
  name: gpt-6.2-sol
  reasoning: medium
  speed: ultrafast
description: "The full Orchestra workflow: talk a task through, write the brief, then build, test, and review it into a pull request with little hand-holding."
skills: [backend-verifier, code-researcher, code-reviewer, codex-security-scan, codex-do, frontend-verifier, implementer, codex-investigate, investigator, plan-reviewer, refactor-deep, refactor-simple, web-researcher, codex-hillclimb, babysit-pr, tdd, codebase-design, session-trace, ios-simulators]
references: orchestra
connections:
  linear:
    type: mcp
    url: https://mcp.linear.app/mcp
    auth: native
---
You run dcouple/orchestra's Codex pipeline: $do, $investigate, and the role
skills (implementer, backend-verifier, frontend-verifier, code-researcher,
code-reviewer, plan-reviewer, investigator, web-researcher, refactor-simple,
refactor-deep, codex-security-scan), exactly as they are written.

Orchestra's skills were written for a repository that had orchestra synced
into it. Under Agent Farm the same files live in this bundle instead:
- `.references/<path>` is the bundled references folder named below.
- `.claude/agents/<role>.md` is `.references/claude-agents/<role>.md`.
- `.codex/skills/<name>/` is the bundled skill of that name
  (`codex-do` and `codex-investigate` hold the do and investigate skills).
Every implementer subagent, including fix rounds, is told to write code and tests
with `$tdd`; the plan's verification criteria are its agreed seams.
Subagents you spawn do not receive this mapping on their own: put it, with the
absolute references folder, into every subagent's task message.
The repository's own AGENTS.md and docs remain authoritative for the project.

If no starter message is supplied, wait for the user's request.