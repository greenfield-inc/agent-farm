# Control flow

Contents: [The file](#the-file) · [Steps](#steps) · [Review points](#review-points) · [QA settings](#qa-settings) · [Rendering](#rendering-on-the-cover-sheet) · [Who runs what](#who-runs-what) · [Changes after approval](#changes-after-approval)

Every bigbrain cover sheet ships `control-flow.json` in its bundle. It is the program the implementer and the orchestrator run. The planner writes it, the person approves the rendered section on the cover sheet, and `check-bundle` keeps the two in step. The schema is `../schemas/control-flow.schema.json`.

## The file

```json
{
  "$schema": "control-flow.schema.json", "version": 1, "revision": 2, "approved_by": "D-6",
  "qa": { "max_rounds": 3, "mockups": ["mockups/settings-v2-1.html"],
          "jank_checklist": true, "viewports": ["desktop", "phone"], "themes": ["light", "dark"] },
  "flows": {
    "J-1": { "covers": ["SC-1"], "given": "a signed-in user on the settings page",
             "when": "they turn on dark mode", "then": "every page renders in the dark palette",
             "continues": ["the light palette is unchanged when the toggle is off"],
             "check": { "method": "app", "evidence": "J-1-toggle-desktop-dark.png" } },
    "S-1": { "covers": ["P-1"], "run": "pnpm test", "expect": "0 failures" }
  },
  "steps": [
    { "id": "build-P-1", "actor": "implementer", "do": "build", "package": "P-1", "skills": ["tdd", "quick-verify"] },
    { "id": "verify-P-1", "actor": "implementer", "do": "verify", "flows": ["S-1"] },
    { "id": "review-P-1", "actor": "orchestrator", "do": "review", "scope": ["P-1"],
      "reason_kind": "shared-contract", "reason": "the theme tokens every later screen uses",
      "profile": "bigbrain/reviewer:codex" },
    { "id": "build-P-2", "actor": "implementer", "do": "build", "package": "P-2" },
    { "id": "qa", "actor": "implementer", "do": "qa", "flows": ["J-1"], "spawn": "verifier" },
    { "id": "pr", "actor": "implementer", "do": "pr" },
    { "id": "review-final", "actor": "orchestrator", "do": "review", "scope": "all" }
  ]
}
```

- `flows` holds every J-n and S-n the cover sheet defines, keyed by ID. A journey is Given / When / Then with a Check (method `app`, `command` or `test`, and the evidence expected). A bug fix adds `continues` lines for behaviour that must not change. A suite is a command and its expected result. `covers` cites the SC-n or P-n it proves.
- `revision` goes up with every change; `approved_by` is the D-n that approved this revision.
- Steps cite only P/J/S IDs the cover sheet defines. The checker rejects anything else.

## Steps

| `do` | `actor` | Meaning |
| --- | --- | --- |
| `build` | implementer | Implement one package (`package`) with `tdd` and `quick-verify`. |
| `verify` | implementer | Prove the listed `flows`. With `spawn: "verifier"` the verifier drives the app; otherwise the implementer runs the commands itself. |
| `qa` | implementer | The QA loop: the verifier checks the listed flows, mockup fidelity and the jank checklist; the implementer fixes; repeat up to `max_rounds`. |
| `pr` | implementer | `prepare-pr` (linking the verification page), then `babysit-pr` until checks are green. |
| `review` | orchestrator | The implementer pushes, reports checkpoint and waits. The orchestrator starts one reviewer with `scope`. Must-fix items come back, a follow-up checks only those, then the implementer resumes. |
| `design` | orchestrator | A design decision in the middle of a build: the orchestrator starts the designer, relays its options, and returns the approved design. The implementer waits at this step as at a review. |

`skills` on a step names the skills the implementer loads for it; without it, the defaults for that `do` apply (see `implement-plan`). `max_rounds` on a `qa` step overrides `qa.max_rounds`. `note` is free text shown on the cover sheet.

## Review points

- Every flow ends with an end review: a `review` step with `"scope": "all"`, last among the review steps, normally right after `pr`.
- A checkpoint (a review step with a list of packages as `scope`) is added only with a `reason_kind`: `irreversible`, `schema`, `security` or `shared-contract`, and a one-line `reason`.
- "No review" is allowed only on the person's explicit word: the end review step stays, with `"review": "none"` and `approved_by` naming the D-n that recorded their word.
- `profile` picks the reviewer variant; the default is the reviewer profile's default.
- The planner settles the review points with the person during the interview. Anything else is unplanned: the orchestrator asks the person before acting on it, and an implementer never starts a reviewer.

## QA settings

`qa.max_rounds` defaults to 3. `mockups` lists the approved mockups whose screens must match (paths inside the bundle). `jank_checklist` turns on the checklist in `design-quality.md`. `viewports` and `themes` say what every flow and screen is captured at.

## Rendering on the cover sheet

The cover sheet's Control flow section is generated from the JSON; never hand-edit it. It is a `<section>` with no nested `<section>`, and one element per step carrying `data-step`, in order:

```html
<section id="control-flow" data-control-flow-revision="2">
  <h2>Control flow</h2>
  <p>Generated from <a href="control-flow.json">control-flow.json</a>, revision 2. QA: up to 3 rounds, desktop and phone, light and dark.</p>
  <ol class="flow">
    <li data-step="build-P-1">build P-1 <span>implementer</span></li>
    <li data-step="verify-P-1">verify S-1</li>
    <li data-step="review-P-1">review P-1 <span>planned · shared-contract: the theme tokens every later screen uses</span></li>
    …
    <li data-step="review-final">review all <span>planned · end</span></li>
  </ol>
  <p>Anything else: the orchestrator asks you first.</p>
</section>
```

Put a one-line summary near the top of the page too (`#control-flow-summary`): the review points and the QA settings. A small inline-SVG strip of the steps is welcome beside the list.

## Who runs what

- **Implementer:** runs every `build`, `verify`, `qa` and `pr` step in order, records its position as `step` in its status file, and stops at each `review` and `design` step with the checkpoint handshake in `contract.md`.
- **Orchestrator:** on a checkpoint report, reads the flow, confirms the reported step is a `review` (or `design`) step, starts exactly one reviewer (or the designer) as the step says, and relays the outcome. A reported checkpoint that is not in the flow is unplanned, so the orchestrator asks the person.
- **Reviewer:** reviews only the step's `scope` and posts with the step id in its marker.

## Changes after approval

The implementer never edits `control-flow.json` or the cover sheet's checks. A change (a new step, a different review point, a reworded check) goes back to the planner as a new revision of both, approved through the relay. Routine technical discoveries within a package need no new revision.
