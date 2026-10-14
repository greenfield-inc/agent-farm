# Planner documents

The person and the implementer share one HTML plan cover sheet with its `control-flow.json`, saved in the work's bundle. Every page starts from the `documents` skill's template for its kind and passes `check-bundle`.

| Document | Skill | Template kind | Reader |
| --- | --- | --- | --- |
| Explainer | `explain` | `explainer` | person |
| Brief | `brief` | `brief` | person, then you |
| Options | `options` | `options` | person, who picks through the relay |
| Decision log | `interview` | `decisions` | person and implementer |
| Spike | `spike` | (plain text, kept) | you and one helper |
| Plan cover sheet and control flow | `plan` | `cover-sheet` | person approves it; implementer, orchestrator and reviewer read it |

Mockups and design notes come from the designer (`mockups/`); you cite them.

## One piece of work, one bundle

Every page for one piece of work goes in the same bundle, with fixed file names and relative links: the brief as `index.html`, then `options.html`, `decisions.html`, `cover-sheet.html`, `control-flow.json`, `evidence/verification.json`, `explainers/`, `mockups/`, `evidence/`. The brief is the hub: it lists the others under "Related", and each links back. The `page` skill's bundle reference says how to choose a destination and publish to it. Settle the destination once, early, and report where the documents are.

## IDs and decisions

The brief defines SC-n. The cover sheet defines P-n, J-n and S-n. The decision log defines D-n and the Q-n each came from. Cite IDs instead of copying text, and never renumber. Each relay answer becomes one ADR-lite entry: a "We will…" sentence, its context and consequences, `from Q-n`, and what it supersedes.

## The verification rows

When you write `control-flow.json`, also create `evidence/verification.json` with one row per J/S: the `flow` copied exactly from `control-flow.json`, verdict `pending`, everything else empty. Implementers and verifiers fill results; nobody adds, removes or rewords a row. A changed check is a new cover-sheet revision.

## Where research goes

What the person learns is not pasted into the brief or the cover sheet as a block. It is split by who needs it:

- How the system works today, in general: the explainer.
- Facts that define the problem: the brief, under Today, Evidence and Sources. Questions still unanswered: the brief's Unknowns, each as a `[NEEDS DECISION: …]` or a fact to find.
- Learning that changed which approaches are viable: the options page, under "What we learned".
- The outcome: the cover sheet's "Decisions locked" and "Deferred", citing D-n. Not the journey.

The test: would it still be true under a different approach? Brief. Is it about choosing between approaches? Options.

## Where alternatives go

The brief names an open decision. The options page argues it and the person picks through the relay. The cover sheet records what was chosen, what was rejected, and why. Packages assume the choice.
