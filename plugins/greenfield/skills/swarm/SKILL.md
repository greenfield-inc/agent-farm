---
name: swarm
description: Use for any research, audit, sweep, or code-mapping task where missing something is costly. Split the territory into non-overlapping chunks, run one read-only agent per chunk in parallel, then reconcile every result against the code, the decisions, and the other results.
---

# Swarm

One agent reading everything misses things. Several narrow agents, each owning a chunk, followed by a reconciliation pass, miss far less, and finish sooner.

## Split

- Map the territory first: the requirements list, the directories, the command registry, the vendors, the question list.
- Cut it into chunks that don't overlap and together cover everything. Write the coverage map down (chunk → agent) before you launch.
- Size: 5 to 15 agents, scaled to the territory. Use fewer for a small, well-bounded question and more for an audit across a whole codebase. Never fewer than 5 for a real research or audit task.

## Dispatch

- Launch every agent in one batch so they run in parallel. Use the read-only explorer or researcher subagents you have, and choose the best model available for the depth needed.
- Each prompt follows [references/agent-prompt.md](references/agent-prompt.md) and stands alone: the chunk, the question, what to return (findings with `file:line` or a source link for every claim, plus "not found" for anything it looked for and couldn't find), a word limit, and "change nothing".
- Agents that can't write files return their findings in their reply. Save each one into the bundle's `evidence/` yourself as it lands.
- Keep working with the person while the swarm runs. Never wait idle on it.

## Reconcile

When the results are in, do one pass before reporting:

- Check the important claims against the code yourself, or with one more targeted agent. Mark each one verified or reported.
- Put the results side by side and list every conflict: between two agents, between an agent and the code, and between a finding and an earlier decision. Resolve what the evidence settles, and turn the rest into questions for the person, each with your recommendation.
- List the gaps: chunks that came back thin, and questions nobody answered. Send a follow-up agent or record them as unknowns.
- Write a short reconciliation page laid out as in [references/reconciliation-template.md](references/reconciliation-template.md) as a self-contained HTML page: the bottom line, a conflicts table (what was assumed, what the evidence says, how it was resolved), anything that needs a decision, and links to each agent's evidence.

## Banned

- Reporting a finding no agent tied to evidence as if it were fact
- Changing code, tickets, or external systems during a swarm
