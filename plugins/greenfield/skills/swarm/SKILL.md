---
name: swarm
description: Use for research, audits, sweeps and code mapping where completeness matters. Split the territory into non-overlapping chunks, run one read-only agent per chunk in parallel, then reconcile every result against the code, the decisions, and each other.
---

# Swarm

Narrow agents with one chunk each, plus a reconciliation pass, give full coverage fast.

## Split

- Map the territory and cut it into non-overlapping chunks that cover everything. Write the coverage map (chunk → agent) before launching.
- **Use 5 to 15 agents, scaled to the territory.** Every real research or audit task gets at least 5.

## Dispatch

- **Launch every agent in one batch.** Use your read-only explorer or researcher subagents, on the strongest model the depth calls for.
- Write each prompt from [references/agent-prompt.md](references/agent-prompt.md): one chunk, one question, evidence for every claim, and a list of what it searched for and found absent.
- Save findings to `evidence/` as they land, and keep working with the person meanwhile.

## Reconcile

Before reporting, run one pass:

- **Verify** the claims that matter against the source. Mark each verified or reported.
- **List conflicts** between agents, the code, and earlier decisions. Resolve what evidence settles; ask the person about the rest, with your recommendation.
- **List gaps:** thin chunks and unanswered questions, each with a follow-up agent or recorded as unknown.
- **Publish** a self-contained HTML page laid out as in [references/reconciliation-template.md](references/reconciliation-template.md).

## Keep to

- Findings stated as fact carry evidence from an agent or from your check.
- A swarm reads only: code, tickets and external systems stay as they are.
