---
name: daydiff-standup-prep
description: Prepare a person's standup brief from what changed since a cutoff (default 10 am the previous workday) across their trackers, Grain artifacts, connected apps, GitHub and agent sessions. Use for "standup", "prep my standup", "what did I do since yesterday", or a morning recap.
---

# Daydiff standup prep

The reader is about to talk at standup. They are context switching, overwhelmed and confused. Every line earns its place.

## The brief

Follow [references/brief.md](references/brief.md): the page from top to bottom, how to word each line, the goals card and the checks. [references/example.html](references/example.html) is an example brief with fictional work; match its shape. Render the page with `scripts/page.mjs`.

## Find the person and their sources

Discover these at run time; ask only for what none of them answers:

- **Who:** the launch context, then `gh api user` and `git config user.email`.
- **Cutoff:** the one the person names, else 10 am local on the previous workday.
- **Trackers:** Grain tracker apps named in the launch context or the project's workspace (pass each to `scripts/gather.mjs` as `--tracker ID`), plus Grain apps whose name contains "tracker".
- **Connected apps:** `composio connections list`.
- **Zendesk:** the subdomain from the launch context or `ZENDESK_SUBDOMAIN`.

## Gather

- Run the gathering in a subagent with its own context. It returns only the paths to `standup.json` and `events.jsonl`, three or four goal options, and the sources it skipped.
- One small read-only script per source in `scripts/`, each printing events in one shape: `{time, source, actor, what, link}`. `scripts/gather.mjs` runs them all and writes `events.jsonl` and `sources.txt`; its header lists the flags.
- The draft is `standup.json` (its shape is at the top of `scripts/page.mjs`). Its `workstreams` list maps events to workstreams by pattern. `scripts/page.mjs` turns it and the events into the Markdown and HTML brief and draws the timeline from the event times.
- Sources, each skipped with a one-line note when unavailable:
  - **Trackers:** rows updated since the cutoff, with their current status. An update is not proof of a status change.
  - **Grain:** workspaces updated since the cutoff in every organization, and their `grain history` revisions since then. App trackers keep their state in a database, so read their `GET /api/state` through `grain exec`.
  - **Connected apps:** mail sent, meetings held, CRM and ticket changes. Report expired or missing connections.
  - **Zendesk:** tickets the person replied to, noted on or changed, from ticket audits. When the API isn't reachable, read the Zendesk mail in Gmail for each ticket's latest state.
  - **GitHub:** PRs opened, merged and reviewed by the person.
  - **Agent sessions:** Claude Code and Codex prompts, and Pane Panes, status files and decision logs when Pane is installed. Decision lines carry a date and no time.
- Attribute each event to the person or to an agent acting for them, and map it to a workstream from the trackers.
- Read only. Never send, edit or mark anything.
- Leave out customers' personal details: names of people in their records, phone numbers, message text and health information.

## Secrets

Read secrets from the environment or the OS keychain at use, and never print or store them. The Zendesk API token is `ZENDESK_API_TOKEN`, or the keychain item with service `<subdomain>-zendesk-api-token` and account `daydiff`. Other sources use their CLI's own sign-in.

## Goals

After the gatherer returns, the main session asks the person with one goals card, as [references/brief.md](references/brief.md) describes, and puts their pick in the Goals list. Never guess the goals.

## Check before sharing

Run the checks in [references/brief.md](references/brief.md), then have a fresh agent cold-read the page.
