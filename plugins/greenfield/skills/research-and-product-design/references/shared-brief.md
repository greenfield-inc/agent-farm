# Shared brief template

Every feature agent reads this brief before its own prompt. Fill each section, and delete sections that don't apply.

```markdown
# Shared brief: <work name> research and design

Read all of this first. Your own prompt names the feature you own.

## The product
What it is, who uses it, and the surfaces involved. The deadline or review date
the work serves, and who picks and approves a direction.

## Decisions already made
Design within these. Each with its id, the decision in one sentence, and who
decided. Cite the id beside each screen or diagram it shapes. Don't reopen
them; flag any that the evidence contradicts.

## Sources
- The ask: call transcripts, emails or tickets, with timestamps.
- Real screens, best first: PR screenshots (list the PRs and how to download
  their images), docs media folders, public help pages, a local build.
- Code: the fresh clone at <path>, pinned by the orchestrator at commit <sha>.
  Read it only: never run checkout, reset, clean, stash, fetch or pull in it,
  and never edit it. Read a PR's code with `gh pr diff` when GitHub is the host.
- Research notes already written, by file.

## Fidelity
Follow the research-and-product-design skill's rules, plus:
- Medium: <HTML and CSS rebuilt from real screenshots, or image edits of them>.
- What the real product has that a careless rebuild gets wrong: navigation,
  tabs, panels, avatars, font, icon set, radii, density.
- For system work: the services, data stores and outside systems today's
  diagram must show, and where each lives in the code.

## Output
Write under <root>/<feature-slug>/, in the layout the
research-and-product-design skill sets. Start no servers on shared ports, and
stop any process you start. Don't publish, open panels or message anyone; the
orchestrator reviews first. Return a summary: the files, your recommendation,
the open questions, and the fidelity limits.
```
