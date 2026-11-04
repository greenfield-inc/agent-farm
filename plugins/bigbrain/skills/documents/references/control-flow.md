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
- Every changed screen is reached by a journey or QA flow that includes its empty state and its long-content/overflow state, plus loading and error where they exist.
- `revision` goes up with every change; `approved_by` is the D-n that approved this revision.
- Steps cite only P/J/S IDs the cover sheet defines. The checker rejects anything else.

## Steps

| `do` | `actor` | Meaning |
| --- | --- | --- |
| `build` | implementer | Implement one package (`package`) with `tdd` and `quick-verify`. |
| `verify` | implementer | Prove the listed `flows`. With `spawn: "verifier"` the verifier drives the app; otherwise the implementer runs the commands itself. |
| `qa` | implementer | The QA loop: the verifier checks the listed flows, mockup fidelity, and the jank checklist on every screen the PR's changed files render; the implementer fixes; repeat up to `max_rounds`. |
| `pr` | implementer | `prepare-pr` (linking the verification page), then `babysit-pr` until checks are green. |
| `review` | orchestrator | The implementer pushes, reports checkpoint and waits. The orchestrator sizes the diff and starts one reviewer with `scope`. Must-Fix and in-scope Should-Fix items come back, a follow-up checks only those, then the implementer resumes. Approach/scope findings and a thrashing loop go to the person (`orchestrate`, Reviews). |
| `design` | orchestrator | A design decision in the middle of a build: the orchestrator starts the designer, relays its options, and returns the approved design. The implementer waits at this step as at a review. |

`skills` on a step names the skills the implementer loads for it; without it, the defaults for that `do` apply (see `implement-plan`). `max_rounds` on a `qa` step overrides `qa.max_rounds`. `note` is free text shown on the cover sheet.

## Review points

- Every flow ends with an end review: a `review` step with `"scope": "all"`, last among the review steps, normally right after `pr`.
- A checkpoint (a review step with a list of packages as `scope`) is added only with a `reason_kind`: `irreversible`, `schema`, `security` or `shared-contract`, and a one-line `reason`.
- "No review" is allowed only on the person's explicit word, and the planner never proposes it: the end review step stays, with `"review": "none"` and `approved_by` naming the D-n that recorded their word. The implementer still stops there; the orchestrator starts no reviewer and puts "review now, or continue?" to the person. Only an explicit "review now" starts one.
- The end review (or its waiver) is the last step; nothing runs after it.
- `profile` picks the reviewer variant; the default is the reviewer profile's default.
- The planner settles the review points with the person during the interview. Anything else is unplanned: the orchestrator asks the person before acting on it, and an implementer never starts a reviewer.

## QA settings

`qa.max_rounds` defaults to 3. `mockups` lists the approved mockups whose screens must match (paths inside the bundle). `jank_checklist` turns on the checklist in `design-quality.md`. `viewports` and `themes` say what every flow and screen is captured at.

## Rendering on the cover sheet

The cover sheet's Control flow section is generated from the JSON; never hand-edit it. It is a `<section>` with no nested `<section>`, holding three parts in this order: a meta line, a diagram, and the step-by-step detail.

```html
<section id="control-flow" data-control-flow-revision="2">
  <h2>Control flow</h2>
  <p class="meta">Rendered from <a href="control-flow.json">control-flow.json</a>, revision 2, approved by D-6. Do not hand-edit. Two review points: a checkpoint after P-1, and the end review. QA: up to 3 rounds, desktop and phone, light and dark, jank checklist on.</p>
  <figure class="cf-diagram">
    <svg viewBox="0 0 640 380" role="img" aria-labelledby="cf-title cf-desc">
      <title id="cf-title">Control flow: …</title>
      <desc id="cf-desc">every phase, step, actor, review point, the QA loop and each gate, in reading order</desc>
      …
    </svg>
  </figure>
  <details id="control-flow-steps">
    <summary>Step-by-step detail (7 steps)</summary>
    <h4>1 · Theme tokens</h4>
    <ol class="flow" start="1">
      <li data-step="build-P-1"><strong>Build P-1</strong> · theme tokens <span class="meta">(implementer · <code>build-P-1</code> · build)</span></li>
      <li data-step="verify-P-1"><strong>Verify</strong> · checks S-1 <span class="meta">(implementer · <code>verify-P-1</code> · verify)</span></li>
      <li data-step="review-P-1"><strong>Checkpoint review</strong> · scope P-1 · shared-contract: the theme tokens every later screen uses <span class="meta">(orchestrator · <code>review-P-1</code> · review)</span></li>
    </ol>
    <h4>2 · Settings screen</h4>
    <ol class="flow" start="4">
      …
      <li data-step="review-final"><strong>End review</strong> · scope all <span class="meta">(orchestrator · <code>review-final</code> · review)</span></li>
      <!-- a waived end review renders as: End review · scope all · no review (waived), D-n -->
    </ol>
  </details>
  <p>Anything else: the orchestrator asks you first.</p>
</section>
```

**The diagram** is an inline SVG drawn from the steps, readable at the page's normal width and in light and dark (template classes only):

- **Phases:** group the steps into phases, one row or lane each, labelled (`1 · Backend pull request`, `2 · Web pull request`). A phase usually ends at a `pr` step or a review point; a single-PR flow is one phase.
- **Actors by colour and shape:** implementer steps (`build` with its `verify`, `qa`, `pr`) are `.box` rectangles; review and design steps, which the orchestrator runs, are `.hot` rectangles labelled with their scope and `reason_kind`. A build and its verify may share one node ("Build + check P-1").
- **The QA loop** is one node with an arrow looping back to itself, labelled with its round cap, viewports and themes.
- **Human gates** are `.warnbox` hexagons joined by a dashed line to the step they belong to: approvals and actions the plan gives a person (staging migration, a backfill, production DDL a human applies). They are not steps; take them from the steps' `note`s and the cover sheet's Ask-first actions.
- Arrows (`.path`) show the order, including `continue:` from a review point to the next phase. A legend explains the three shapes. The `<title>` and `<desc>` say the whole flow in words.

**The step detail** sits in `<details id="control-flow-steps">`, closed by default, grouped under one `h4` per phase, one `<li data-step="<id>">` per step in order (continue the numbering with `start`). Only these items carry `data-step`; the diagram never does. Each line shows what the step will make workers do: its `do`, package and its title, flows, scope, `reason_kind` and reason, "up to N rounds" for a `qa` step, "no review (waived)" and the D-n for a waiver, and the step's `note` on a second line. The section shows the QA viewports and themes. `check-bundle` checks those facts against the JSON, and fails a cover sheet still in draft or review whose section has no diagram.

Put a one-line summary near the top of the page too (`#control-flow-summary`): the review points and the QA settings.

## Who runs what

- **Implementer:** runs every `build`, `verify`, `qa` and `pr` step in order, records its position as `step` in its status file, and stops at each `review` and `design` step with the checkpoint handshake in `contract.md`.
- **Orchestrator:** on a checkpoint report, reads the flow, confirms the reported step is a `review` (or `design`) step, starts exactly one reviewer (or the designer) as the step says, and relays the outcome. A reported checkpoint that is not in the flow is unplanned, so the orchestrator asks the person.
- **Reviewer:** reviews only the step's `scope` and posts with the step id in its marker.

## Changes after approval

The implementer never edits `control-flow.json` or the cover sheet's checks. A change (a new step, a different review point, a reworded check) goes back to the planner as a new revision of both, approved through the relay. Routine technical discoveries within a package need no new revision.
