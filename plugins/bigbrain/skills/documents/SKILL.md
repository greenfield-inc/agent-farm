---
name: documents
description: Holds bigbrain's page templates, worked examples, JSON schemas and the check-bundle script. Used whenever a step writes a page or a JSON source, changes a page's stage, or checks a bundle or status file.
---

# Documents

Every bigbrain page is built from a template here, carries a `doc-meta` block, and passes `check-bundle` before it changes stage. This skill owns the whole page: form, skeletons, the machine-readable parts, the bundle and the checker. The templates already carry the CSS; never restyle from scratch.

## Write a page

1. Copy `formats/<kind>/template.html` into the bundle at the kind's file name (in `kinds.json`). Read `formats/<kind>/example.html` once for a filled-in page of the same kind.
2. Fill every section, in the template's order. A section that does not apply says "n/a because …"; never delete one. The required section ids are in `kinds.json`; a kind marked `ordered` (the cover sheet) must keep them in that order.
3. Fill `doc-meta`: `kind`, a kebab-case `id`, `status`, `revision`, `supersedes`, `updated`, the IDs this page `defines` (each also an element `id` on the page, so `decisions.html#D-4` links), the IDs it `cites`, and the counts of open `[NEEDS DECISION` and `[ASSUMPTION` markers.
4. Add the page to `bundle.json`'s `documents`.

Kinds: brief, explainer, options, decisions, cover-sheet, design-notes, mockups, verification, bug-report, post-mortem, learning, map.

## Style

The templates hold the tokens, layout and components; keep them. On top of that:

- **Drawing first.** Open with one inline-SVG drawing right after the title, the sketch the rest of the page explains. Add more where a flow or comparison is the point. A simple subject gets a simple drawing, never none.
- **One centred column**, about 72 characters wide, no horizontal scrolling outside a `pre`.
- **Decision first.** What the person must decide or act on comes before background.
- **Light and dark.** Use the template's colour tokens only; the page must read in both themes.
- **Self-contained.** One `.html` file, inline CSS and SVG, system fonts, no external requests, no script unless the page needs interaction.
- **Readable with every `details` closed.** Disclosures hold depth the reader opts into, never something they need.

Before you share a page: someone who reads only the drawings and headings leaves oriented; it renders with JavaScript off; nothing is fetched; it reads in light and dark; every fact came from your sources.

## Bundle and destination

One piece of work has one bundle, a folder whose files and names come from `kinds.json`: the brief as `index.html` (the hub), `options.html`, `decisions.html`, `cover-sheet.html`, `control-flow.json`, `evidence/verification.json` and `evidence/verification.html`, `explainers/<topic>.html`, `mockups/` with `mockups/design-notes.html`, `learning/`, `post-mortem.html`, `trace.html` (built with `session-trace`, or a labelled status page when capture is not authorized), and `bundle.json` listing every document. A bug report is the `index.html` of a bundle of its own.

- Link between files with relative links only, so the bundle works opened from disk, copied or published. Each page links back to `index.html`; the brief and cover sheet list every other file.
- Settle the destination once, in this order, and record it in `bundle.json`: what the person said in this conversation, then the `docs` launch argument, then the workspace instructions or the repository's conventions, then local.
- Local means `tmp/bigbrain/<slug>/` in the repository you were started in (the orchestrator's Session map lives in the Session folder). Check that `tmp/` is git-ignored and never commit a bundle unless the person asks.
- Publishing elsewhere copies the local bundle there, keeping its folders and links, private by default. If `bundle.json` has a `published.id`, update that same container; never make a second one. Read back what you published, record its `kind`, `id` and `url`, and say plainly when publishing failed.

## JSON sources

| File | Schema | Written by | Rule |
| --- | --- | --- | --- |
| `control-flow.json` | `schemas/control-flow.schema.json` | planner | The cover sheet's Control flow section is rendered from it: `<section id="control-flow" data-control-flow-revision="N">` with a diagram and one `data-step="<id>"` element per step, in order. Never hand-edit the section. |
| `evidence/verification.json` | `schemas/verification.schema.json` | planner (rows), implementer and verifier (results) | One row per J/S with `flow` copied exactly from `control-flow.json`. Results set only verdict, method, evidence, commit and round, and append to the logs. |
| `.agent/status/<role>.json` | `schemas/status.schema.json` | each worker | See `contract.md`. |
| every page | `schemas/doc-meta.schema.json` | the page's writer | The `doc-meta` block. |

The control-flow steps, review-point rules, who runs which step, and how the section renders are in [references/control-flow.md](references/control-flow.md). Read it whenever you write, render, execute or review against a control flow.

## Check

```sh
node <this skill>/scripts/check-bundle.mjs <bundle dir> [--stage draft|approve|done] [--json]
node <this skill>/scripts/check-bundle.mjs --status <status file> [--json]
```

It needs only Node. Exit 0 is pass; each failure names its rule:

| Rule | Fails when |
| --- | --- |
| `bundle-json` | `bundle.json` is missing, or lists a file that does not exist |
| `doc-meta` | a listed page (other than `trace.html`) has no valid `doc-meta` |
| `sections` | a page lacks a required section of its kind (a page approved before its kind gained a section, listed in `settled_may_omit`, keeps the shape it was approved in) |
| `section-order` | a draft or ready-for-review page of an `ordered` kind has its sections out of order |
| `schema-changes` | a draft or ready-for-review cover sheet's schema group lacks its visible DDL block above its Object / What it is for / Why table, or the section has no group and no "n/a because" |
| `id-anchors` | a defined ID has no element with that id, or the kind may not define that prefix |
| `ids-unique`, `ids-defined` | an ID is defined twice, or a cited or mentioned ID is defined nowhere (the Session map may mention IDs from the bundles it lists) |
| `open-counts` | `doc-meta.open` disagrees with the markers on the page |
| `needs-decision` | a `[NEEDS DECISION` sits on an approved, in-build or done page, or anywhere at `--stage approve` or `done` |
| `links` | a relative link or anchor does not resolve inside the bundle |
| `schema:control-flow`, `control-flow-refs`, `review-points`, `control-flow-render` | the flow is invalid (including a bare `null`, `false`, `0` or `""`), cites unknown IDs, lacks a checkpoint reason, does not end with the end review or its waiver, or the cover sheet's section no longer shows the same steps and facts, or (before approval) has no diagram |
| `schema:verification`, `verification-rows`, `verification-reworded`, `verification-verdicts` | rows are added, removed, reworded, or still pending at `--stage done` |
| `schema:status`, `status-state` | a status file is invalid or its state and blocks disagree |

Run it before reporting any stage change: `--stage approve` before relaying a cover sheet for approval, `--stage done` before reporting done. The orchestrator runs `--stage approve` itself before it relays an approval. Paste the result line into your report.

## Review size

`node <this skill>/scripts/review-size.mjs <base>...<head> [--repo <dir>] [--floor standard|large] [--json]` prints a review's size and why. It lives here so the orchestrator and the reviewer, which both load this skill, run the same rule; the size table it implements is in the `review` skill.
