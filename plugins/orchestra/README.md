# orchestra

dcouple/orchestra at [`cd3d468`](https://github.com/dcouple/orchestra/tree/cd3d468682fdb727d109a762ebb131daa4e7ece8), packaged for Agent Farm.
Regenerate with `node scripts/vendor-orchestra.mjs <orchestra checkout> <skills checkout> [orchestra commit] [skills commit]`; do not edit these files by hand.

For a one-page visual map of the workflow, open [index.html](index.html) (edit `scripts/orchestra-guide.html`, not the copy). It's also on Grain: [view the guide](https://rungrain.com/share/dmnwnvk2hbvsxcart76f29jk).

<img alt="Orchestra map: /discussion, /create-brief and /do, with your steps in green" src="../../docs/assets/guides/orchestra-map.png">

`/do` still calls `arena` and `hillclimb`, which orchestra had moved to dcouple/skills before this commit. They are bundled from dcouple/skills at [`a79b9fd`](https://github.com/greenfield-inc/skills/tree/a79b9fde21a94e1f21e9ce03ab0e9e5b9f61739e): `parsa/.claude/skills/arena` as `arena`, `parsa/.claude/skills/hillclimb` as `hillclimb`, `parsa/.codex/skills/hillclimb` as `codex-hillclimb`. No Codex `arena` exists, so the Codex `/do` arena step stays unavailable, as it was before.

Both variants also get Agent Farm's `babysit-pr`, `tdd`, `codebase-design`, `session-trace`, `ios-simulators`, copied from `plugins/greenfield/skills/`, `babysit-pr` watches a pull request's CI and review bots after `/do` or `/prepare-pull-request` opens it; `tdd` (with `codebase-design`) is how every implementer writes code and tests, passed to each implementer dispatch; `session-trace` publishes the run as a trace page in Grain when the task has one. `ios-simulators` sets up slim iOS simulators for the frontend-verifier.

| Profile | Harness and model | What it loads |
| --- | --- | --- |
| `orchestra/overseer:claude` (default) | Claude, claude-opus-5-5 | The 11 Claude skills (codex, cold-read, create-brief, discussion, do, excalidraw-pr-diagrams, investigate, postmortem, postmortem-loop, prepare-pull-request, sentry-loop) plus arena and hillclimb, the 6 Claude agents as native subagents, Linear and Playwright MCP. Codex roles run through `codex exec` as in orchestra. |
| `orchestra/overseer:codex` | Codex, gpt-6.2-sol (medium, ultrafast) | The 13 Codex skills, with `do` and `investigate` in `codex-do` and `codex-investigate`, plus codex-hillclimb. |

Both variants select `references: orchestra`, which holds orchestra's `references/` folder, its Claude agent files under `claude-agents/`, and `templates/`.
Skills cite `.references/<path>`; Agent Farm maps that to the bundled folder at launch.

Text is copied unchanged except for 10 patches listed in the vendor script:
- `references/orchestra/verification-methods.md`: iOS simulator QA points to the bundled ios-simulators skill.
- `references/orchestra/claude-agents/frontend-verifier.md`: the Claude frontend-verifier sets up iOS simulators with the bundled ios-simulators skill.
- `skills/frontend-verifier/SKILL.md`: the Codex frontend-verifier sets up iOS simulators with the bundled ios-simulators skill.
- `skills/codex/SKILL.md`: codex falls back to Claude sub-agents when Codex is unavailable.
- `skills/do/SKILL.md`: do accepts a Greenfield brief or PLAN.md instead of refusing it.
- `skills/codex-do/SKILL.md`: codex-do accepts a Greenfield brief or PLAN.md instead of refusing it.
- `skills/codex/SKILL.md`: codex dispatch resolves orchestra paths through the bundled references.
- `skills/do/SKILL.md`: /do browser preflight detects a daemon or local run; a local run without a browser records a note instead of stopping.
- `skills/do/SKILL.md`: /do Step 5 accepts local run and attempt ids.
- `references/orchestra/claude-agents/frontend-verifier.md`: frontend-verifier accepts a dispatch-supplied evidence directory on local runs.

Orchestra's Claude agents restrict their tools (reviewers and researchers are read-only). Agent Farm native subagents get a prompt, model, and effort only, so those allowlists are not enforced; the agents stay read-only by their written charters.

Skills with the same name in `~/.claude/skills` or `~/.codex/skills` are still visible to the launched harness. Save and unmount them with `agent-farm unset global --save <name> --harness claude|codex --model <model-id>` to run orchestra's versions only.
