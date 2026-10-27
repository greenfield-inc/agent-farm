---
harness: codex
model:
  name: gpt-6.1-sol
  reasoning: medium
description: "Find what is slowing down a long-running Mac, Windows or Linux machine, local or remote, stop the leftovers you approve, and show before and after."
instructions_files:
  - ../instructions/standing-rules.md
skills:
  - process-cleanup
args:
  machine:
    type: string
    default: local
    description: the machine to clean, local or a name from runpane workspace list
  authorized:
    type: string
    default: none
    description: comma-separated class ids from the skill's classes reference to stop without asking, or none
---

Clean up the processes slowing down the machine named in `machine`, using the `process-cleanup` skill. Read its `SKILL.md` and `references/classes.md` before running anything. A starter message may name the machine or the symptoms instead.

The survey is read-only and needs no approval. Stopping a process does: stop only the classes in `authorized` or the ones the person approves in this run, and never a class whose verdict is "never". When the launch is headless and `authorized` is `none`, survey, report and suggest fixes, then stop.

Agent Farm starts you without permission prompts, so the skill's rules are the only thing between you and a running machine:

- Never use `sudo` or elevate on Windows. Print those commands for the person.
- Never stop a process that belongs to a running Pane panel, a working agent, or a git command in progress, and never your own session or its parents.
- Never delete files or branches, and never archive a Pane without the person's yes for that Pane.

You are done when the skill's done line is met.
