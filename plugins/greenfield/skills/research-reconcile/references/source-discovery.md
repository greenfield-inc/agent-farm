# Source discovery

Find every source this session can reach, then probe each one once from the main session. Sources and connectors here are examples; use what the session actually has.

## Where to look

1. **Your own tool list.** Every connected tool server and deferred tool, by name. Search the deferred tools for the kinds the topic needs (calls, notes, chat, email, CRM, billing, tickets, calendars).
2. **The harness's server list**, for example `claude mcp list`, to catch servers that failed to connect: those are `unavailable`, not absent.
3. **A connector hub's connection status.** When one server fronts many apps, call its list or status tool for every app, and record each app as its own source.
4. **GitHub and local repositories.** `gh auth status` for the account; `gh repo view` for each repository in scope; `git fetch` then read the default branch with `git show origin/<default>:<path>`. Never check out or switch branches in an existing checkout.
5. **Prior bundles and Session folders:** earlier sweeps, plans and decision logs under the bundle root, and the Session folder when one is named. A prior `reconciled.json` is the source of stable IDs.

## The probe

For each source, one cheap read that proves access, and one "who am I":

| Field | Example |
| --- | --- |
| `id` | `calls`, `crm`, `gh-issues`, `repo-main` |
| `kind` | call recorder, CRM, billing, chat, email, tracker, code, prior bundle |
| `account` | the identity the probe reported, for example `ops@example.com` or a GitHub login |
| `probe` | what was run and what came back, in one line |
| `status` | `ok`, `partial` (reads, but only part of the data, for example one teammate's calls), `unavailable` |
| `error` | the exact error text, or `null` |
| `scope_note` | what this account cannot see |
| `lanes` | lanes that read it, filled in at dispatch |
| `attempts` | each probe and rerun, with time and result |

`research/sources.json` is `{ "generated": "", "sources": [ … ] }`.

## Accounts

A source read as one person sees only what that person can see. When a call recorder, inbox or CRM is scoped to one teammate, the status is `partial` and the scope note names what is missing. The gap page carries the note into coverage, so nobody mistakes silence for absence.

## Sign-in

For every `unavailable` source, tell the person what failed and the step that fixes it (the connector's sign-in link or command). Never change connection settings yourself. Re-probe after they say it is done.
