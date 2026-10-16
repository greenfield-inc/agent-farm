---
name: plan
description: Writes the bigbrain plan once the direction is chosen - the cover sheet with package outcomes and Given/When/Then checks, its control-flow.json with review points and QA settings, and the verification rows - and relays it for approval. Never implements.
---

# Plan

Write the context a capable implementer needs, and the program it will run. The approved cover sheet and its `control-flow.json` are the whole implementation handoff: what to build and why, how we will know it works, and the steps, checks and review points in order. Step-by-step coding stays with the implementer.

## Establish the outcome

Start from the brief, the approved design (mockups from the designer, cited by path), and the decision log. Product choices still open go to the person as relay questions (`interview`); alternatives still open go to `options`. Inspect enough of the repository to name the affected surfaces, integration points, existing patterns and verification prerequisites. Use an explorer only for a specific unknown that changes scope or validation. Record what the implementer must check in preflight, separating known blockers from assumptions.

Every interface change needs an approved design before the plan: if there is none, set `needs: design` (planner instructions) and keep working on the rest while it is made.

## The outputs

All in the existing bundle, each from its `documents` template:

1. **`cover-sheet.html`** (kind `cover-sheet`), following [references/cover-sheet.md](references/cover-sheet.md). It defines P-n, J-n and S-n.
2. **`control-flow.json`**, following the `documents` skill's `references/control-flow.md`. Its `flows` hold every J-n and S-n exactly as the cover sheet states them; its `steps` build, verify, QA, open the PR and review in order.
3. **`evidence/verification.json`**: one row per J/S, `flow` copied exactly from `control-flow.json`, verdict `pending`, `control_flow_revision` set. Nobody adds, removes or rewords a row later.
4. **`bundle.json`** listing all of them.

### How we will know it works

- Every required behaviour is a journey: **Given** a starting state, **When** the user does something, **Then** an observable outcome, and a **Check** line (method `app`, `command` or `test`, and the evidence expected, such as `J-2-empty-phone-dark.png`). Name what it covers (SC-n or P-n).
- A bug fix adds "continues to" lines for behaviour that must not change.
- Whole-feature commands are suites: **Run** a command, **expect** a result.
- Cover backend, frontend, integration and design behaviour, including empty, error, loading, duplicate and permission cases when they apply, and every screen the approved mockups mark must-match.
- Every screen the change touches is covered by a journey or QA flow that includes its **empty state** and its **long-content/overflow state**, plus loading and error where they exist. A screen with no journey of its own gets one for those states.
- Mark known environment and fixture needs. A planned check is planned; only an observed result counts. A missing capability leaves its check open.

### The control flow

- One `build` step per package, in dependency order, each followed by a `verify` step for the checks that package can prove. Name a step's skills only when they differ from the defaults.
- One `qa` step after the last build, with `spawn: "verifier"`, listing every journey, and `qa` settings: `max_rounds` (3 unless the person chose otherwise), the approved `mockups`, `jank_checklist: true` for any UI change, the viewports and themes the design notes name.
- A `pr` step, then the end review (`"scope": "all"`).
- Checkpoints only as agreed with the person in the interview, each with a `reason_kind` and a one-line `reason`. "No review" only on the person's explicit word, as `"review": "none"` with its D-n.
- A `design` step only when a design decision genuinely cannot be made before the build.

Render the Control flow section on the cover sheet from the JSON (its phase diagram and the step detail), as the reference shows, and put the one-line summary at the top.

## Self-check, then approval

Before relaying the plan, check it yourself against the brief and the approved design:

- Scope, exclusions, constraints and locked decisions agree; every package explains approach, reuse, new systems, schema and data impact, and dependencies; assumptions are marked `[ASSUMPTION: …]`.
- Every user-facing capability is a track in What we're building with its approved frames; every schema change is in Schema changes with its exact DDL and why it is needed, and each track links the rows it relies on.
- Every required behaviour has a J/S with an observable outcome; every must-match screen is covered; every changed screen has a journey through its empty and long-content/overflow states (and loading/error where they exist); prerequisites are honest.
- The page holds everything the person must review, including exact copy or contract semantics when they matter.
- Zero `[NEEDS DECISION]` markers. Each one becomes a relay question first.
- `node <documents skill>/scripts/check-bundle.mjs <bundle> --stage approve` passes.

Then set the cover sheet's status to `ready-for-review` and write a `needs_you` of kind `approval`: the cover sheet and `control-flow.json` in `files`, the open assumptions listed, and the check result. When `answer: Q-n → approved` arrives, record the D-n, set `approved_by` in `control-flow.json` and status `approved` on the cover sheet, re-render, run the check again, and report done with the cover sheet's path and revision. The orchestrator starts the implementer.

When scope, a locked decision or a check changes after approval, make a new revision of the cover sheet, `control-flow.json` and the affected verification rows together, with a change-log line, and relay it for approval the same way. Routine technical discoveries need no new revision.
