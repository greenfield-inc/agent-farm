---
name: investigate-issues
description: Reproduces a reported symptom, proves its cause and writes a bug report with a route (report mode), or hunts an area, a finished PR or a list of flows for issues and reproduces each before counting it (sweep mode). Never fixes or plans. Used by the bigbrain investigator.
---

# Investigate issues

The goal is a report someone else can act on. The first move is reproduction, not theory. Your launch context gives `mode` (`report` or `sweep`) and `area`; the starting message gives the symptom or the scope, the bundle location and your status file. You reach the person only through `needs_you`.

## Report mode

1. **Restate the symptom** in one sentence, with the environment, the account or record involved and when it started. If any of that is missing and matters, ask through a `needs_you` and keep going with what you have.
2. **Reproduce.** Brief the verifier with the steps to attempt, from a clean state, and ask for screenshots, console output and failed requests. For what does not need the app, brief the explorer with one question at a time (find the failing test, trace the code path, list touched files). Say how reliably it reproduces (always, N of M, once).
3. **Find the cause** with `investigate`: classify the failure early (compile, logic, race, state, integration, environment, interface), write three to five ranked hypotheses before reading deeply, and test them against the code and its history (send the `explorer` helper for logs and history). Compare a broken path with a working one, and find the last known good commit and the regression window when you can. Drop a theory once the evidence rules it out. If only diagnostic logging would settle it, say exactly what you would add, as a `needs_you`.
4. **Define gone-when:** Given / When / Then for the fixed behaviour, plus "continues to" lines for behaviour that must not change.
5. **Pick the route:**
   - `direct-to-implementer`: obvious locus, contained change, tests exist. Add Files allowed, Constraints, Ask first, and Escalate if (the cause turns out to be outside those files, or the fix needs a design choice).
   - `options-first`: unclear locus, or fixing it forces a product or design choice.
   - `cannot-reproduce`: what was tried and what evidence would help.
6. **Write the report** from the `documents` skill's `bug-report` template, defining the next unused B-n: in the person's tracker when the starting message names one, otherwise as `index.html` in a bundle of its own. Run `check-bundle`, set your status to `done` with the B-n, its route and the path, and report. The orchestrator routes it: options-first to a planner on its own, direct-to-implementer only once the person has said yes.

## Sweep mode

`area` is a path, a finished PR, or a list of flows.

1. **Plan the coverage:** the flows and areas to exercise and how (app via the verifier, tests, reading), written down before you start.
2. **Hunt:** drive the flows through the verifier (including empty, error, long-content, phone and dark states, and the jank checklist in the `design` skill's `design-quality.md` when the verifier has it); read the riskiest changed code with the explorer; run the tests.
3. **Reproduce before counting.** An issue counts as confirmed only when it reproduced, with evidence. Each confirmed issue gets its own bug report (report mode steps 3 to 6, one B-n each). Anything unreproduced is "suspected", with why you suspect it and what would confirm it.
4. **Write the sweep summary** at `sweeps/<area>-<date>.html` from the `sweep` template: covered (with method), confirmed (B-n, severity, route, how reproduced), suspected, not covered and why, and the proposed routing per B-n for the orchestrator to relay.
5. Run `check-bundle` on each bundle, set your status to `done` with the summary path and the B-n list, and report.

## Never

- Fix, patch, refactor or plan.
- Present a hypothesis as the cause without evidence.
- Count an issue you did not reproduce.
