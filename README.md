![Agent Farm — a pixel-art robot tending skill crops beside native terminal huts](docs/assets/agent-farm-banner.png)

# Agent Farm

**Load the right skills for each job. Keep your native terminal.**

Agent Farm is a harness configurator. A harness is the full working setup around
an AI model — instructions, tools, permissions, and checks. Agent Farm lets you
save different setups and switch between them without reinstalling everything
for every conversation.

Pick a setup, point it at a repo, and Agent Farm opens your native Claude Code
or Codex terminal with that configuration loaded.

Run `agent-farm ui` to open the local dashboard for **Sessions** and **Profiles**.
Create profiles from existing agent definitions, edit model/argument presets,
inspect resolved instructions and skills, and review changes before saving.
Plugin profiles are read-only and can be duplicated into local presets. The UI
command launches only the browser interface, not an agent; `agent-farm traces`
remains a compatibility alias.

Sessions provides a compact profile-session list and hierarchical run
explorer: user turns, nested sub-agents, a shared-time-axis timeline, and breadcrumb
drill-down. The reader includes collapsible instructions/context, outputs, token
usage, and reported cost. Missing parent links or turn boundaries stay explicit.
Conversation text requires explicit `telemetry.capture_content: true` for new
sessions; it is off by default because it can contain sensitive data. To expose read-only
telemetry tools to launched agents, opt in with workspace
`telemetry.agent_access.enabled: true`; optionally restrict `profiles` to an
allowlist. See [agent access and UI settings](CONFIGURATION.md#agent-access-and-the-local-browser).

Sessions automatically collect local OpenTelemetry traces, events, and metrics,
including launch arguments, user, model, and Git worktree metadata. Data stays in
`~/.local/state/agent-farm/telemetry/`. See [collection settings and coverage](CONFIGURATION.md#local-opentelemetry-collection)
for storage, privacy, and opt-out details. Local collection can be configured per
project in `.agent-farm/workspace.yaml`, with personal overlay overrides.

Think of each setup as a desk prepared for a job. For SEO, you might lay out site
references, search tools, and a skill that walks through researching and improving
a page. For presentations, you bring brand guidelines, slide tools, and a workflow
for turning an outline into a story. Each setup keeps the relevant material close
to the work.

## Install

Requires **Node 22.15+** on macOS, Linux, or Windows, and the Claude Code and/or
Codex CLI installed and authenticated. On Windows, turn on Developer Mode
(Settings > System > For developers) before launching Codex profiles or running
`agent-farm set global`, because those link individual files.

```sh
npm install --global @greenfieldco/agent-farm
agent-farm init
```

`agent-farm init` checks your prerequisites, installs the default profiles and
skills, explains how everything fits together, and offers to launch your first
session.

Or install from source:

```sh
git clone https://github.com/dcouple/agent-farm.git
cd agent-farm
pnpm install --frozen-lockfile && pnpm build
mkdir -p ~/.local/bin
ln -s "$PWD/dist/cli.js" ~/.local/bin/agent-farm
```

Add `~/.local/bin` to your shell's `PATH`, then run `agent-farm init`.

After pulling updates, run `agent-farm plugin install` to sync new profiles.

## Profiles

Agent Farm ships with profiles ready to use. Run `agent-farm` to pick one:

```
◆  What would you like to do? Tab: show all descriptions
│  ● greenfield/planner (2) (Help you understand a problem, decide what to do, and write the plan. Doesn't write code.)
│  ○ orchestra/overseer (2)
│  ○ dcouple/raw (3)
│  ○ dcouple/qa-and-fix (2)
│  ○ dcouple/reviewer (2)
│  ─────────────────────
│  + Create new profile
```

Highlight a profile to see what it's for, or press Tab to show every
profile's description at once.

**Plan** — `greenfield/planner` helps you understand a problem, decide what
to do, and write the plan. Start here. For a fuzzy idea, `dcouple/ideate` talks
it through first and hands over a ticket.

**Build** — `orchestra/overseer` builds, tests, and reviews a task into a pull
request with little hand-holding. For smaller, clear tasks, `dcouple/raw` is the
AI model on its own plus a few good habits.

**Check** — `dcouple/qa-and-fix` tests a finished pull request, fixes small safe
problems, and tells you when it's ready. `dcouple/reviewer` reviews it from many
angles at once.

**More** — `ideate` to talk through an idea before planning, `product-researcher`
for research write-ups, `business` for business documents, `seo` for search
content, and `audits` for finding outdated issues and docs.

**Guides** — Each plugin has a one-page visual guide to its profiles and how work is routed: [greenfield](plugins/greenfield/index.html), [orchestra](plugins/orchestra/index.html), and [dcouple](plugins/dcouple/index.html). They're also on Grain: [greenfield](https://rungrain.com/share/49gtyr7fi7hm75n71itmmlgl), [orchestra](https://rungrain.com/share/dmnwnvk2hbvsxcart76f29jk), and [dcouple](https://rungrain.com/share/6uxd73wjm97a2n2shyg5m6xz).

**Variants** — Some profiles come in more than one version, such as a Claude
and a Codex planner. They're one profile with variants, and the menu shows
how many: `greenfield/planner (2)`. `agent-farm run` asks which one you want
and shows each variant's model; `agent-farm profiles list` shows them too.
Add `:codex` to the name to skip the question; without it, scripts get the
default.

## Four entry points

![A pixel-art farm crossroads with signs for init, interactive, help, and doctor](docs/assets/entry-points-pixel-farm.png)

```sh
agent-farm init         # First-time setup — the starting point
agent-farm              # Interactive — pick a profile, create one, launch
agent-farm help         # Reference — every command, for humans and agents
agent-farm doctor       # Diagnostic — check prerequisites, config, profiles
```

`agent-farm init` is where you start, and `agent-farm` runs it for you on
first launch. After that, `agent-farm` is your everyday launcher. `agent-farm help` is the single discovery point for all
commands. `agent-farm doctor` tells you what's working and what's not.

### For power users

```sh
agent-farm run planner
agent-farm run dcouple/implementer
agent-farm run greenfield/planner:codex
agent-farm run greenfield/implementer --directory ~/repos/my-project --message "Fix the failing tests"
agent-farm run greenfield/implementer --model gpt-6-astra --speed fast --arg review=dual
```

Several plugins can be installed together. Use `plugin/profile` when plugins
publish the same role name; a bare name works only when it is unique, unless
`default_plugin` selects a preferred plugin in `settings.json`.

Run `agent-farm help run` for all flags.

## How it works

![Pixel-art workflow: choose a profile, assemble a launch bundle with shared skills, child agents, and optional workspace connections, write it to the repository, and open the native terminal](docs/assets/how-it-works-pixel-farm.png)

Choose a profile to select an agent's harness, model, and instructions. Agent Farm
combines that definition with shared skills, child agent definitions, and optional
workspace MCP connections into a launch bundle in `.agent-farm/generated/` in the
target repository, then opens Claude Code or Codex to work there.

- **Profile** — a saved setup. "When I say *planner*, I mean: use this agent, optionally with these model fields and launch arguments." Like choosing which worker to send.
- **Agent** — the worker definition. Which AI brain, what it knows, what instructions it follows, who it can delegate to.
- **Skill** — a playbook. Step-by-step instructions for a kind of task: how to create a ticket, review code, or investigate a bug.
- **Workspace** — the toolbox for a project. Which external tools (Linear, Sentry, databases) an agent can reach when working on that project.

## Configuration

![A pixel-art farm shed organizing profiles, agents, skills, and workspaces into four labeled compartments](docs/assets/configuration-pixel-farm.png)

Personal configuration lives in `~/.config/agent-farm/`. Project connections and
instructions live in the tracked `.agent-farm/workspace.yaml` at each Git
repository root. The interactive CLI creates profiles. To edit by hand:

```text
~/.config/agent-farm/
├── profiles/             # Unnamed local namespace
├── agents/               # Local agents
├── skills/               # Local reusable skills
├── plugins/
│   ├── dcouple/          # Installed plugin namespace
│   └── roles/            # Another plugin; names may overlap
├── .plugins/             # Per-plugin install receipts
├── overlays/             # Personal settings keyed by repository workspace name
└── workspace.yaml        # Optional fallback workspace
```

Run inside the repository or pass `--directory PATH`. Selection is: `--no-workspace`,
then the approved repository file plus `<config-root>/overlays/<name>.yaml`, then
`<config-root>/workspace.yaml` if no repository file exists, then none. The fallback
has an optional `name`, needs no approval, and has no overlay.

Repository files require `name`, with optional `connections` and `instructions`.
Personal overlays omit `name`: connection fields replace shared values, `env`
merges by key, `env_vars` lists union, and instructions append. The merged result
is validated; conflicts with agent-defined connections still fail.

```sh
agent-farm workspace trust                    # review and approve this repository
agent-farm workspace show                     # merged values, sources, trust state
agent-farm workspace untrust                  # revoke repository approval
agent-farm run greenfield/implementer --explain
```

Trust binds the real Git common directory and the file's SHA-256, so linked
worktrees share approval for identical content. Changes require approval again.
Interactive runs ask; declining uses no workspace. Noninteractive launches and
inspection fail until approved. `workspace trust --yes` supports scripted setup.
The personal overlay and fallback need no approval. Symlinked workspace files
and paths escaping the repository are refused. Keep secrets outside authoring
files and ignore `.agent-farm/generated/`. See [configuration](CONFIGURATION.md#workspaces-and-repositories)
for schema, merge examples, trust storage, and global workspace installation.

```sh
agent-farm plugin install                 # bundled dcouple
agent-farm plugin install greenfield      # bundled role-named profiles, see plugins/greenfield/README.md
agent-farm plugin install orchestra       # dcouple/orchestra as of 2026-09-16, see plugins/orchestra/README.md
agent-farm plugin install roles           # any bundled plugins/roles folder
agent-farm plugin install /path/to/plugin
agent-farm plugin list
agent-farm plugin uninstall roles
agent-farm profiles list
```

An update touches only that plugin's namespace and receipt. If Agent Farm finds
an older flat plugin receipt, installation stops without changing files and asks
you to have your agent migrate the configuration into the namespaced layout.

User-level `load` uses global harness skill directories. If two plugins select
the same skill name, Agent Farm refuses the second load and names both owners;
it never silently overwrites. `agent-farm loaded` reports each skill's plugin.

See the [configuration reference](CONFIGURATION.md) for file formats, child
agents, skill metadata, and workspace connections.

Agents can declare validated enum, string, and path arguments. Profiles can
save argument values and partial model presets; command-line `--model`,
`--reasoning`, `--speed`, and repeatable `--arg key=value` flags win over the
profile, while children keep their compiled models. Every entry identity gets a
`LAUNCH CONTEXT` block containing `headless` and the resolved arguments. See the
[configuration reference](CONFIGURATION.md#launch-overrides-and-context) for
the schema, precedence, output metadata, and exact block format.

### Using third-party models via OpenRouter

```sh
# One-time setup
export OPENROUTER_API_KEY="sk-or-..."
echo 'export OPENROUTER_API_KEY="sk-or-..."' >> ~/.zshrc
agent-farm provider set openrouter --base-url https://openrouter.ai/api --api-key-env OPENROUTER_API_KEY
```

Then add `"match": "slash-models"` to `~/.config/agent-farm/settings.json`:

```json
{
  "provider": {
    "name": "openrouter",
    "base_url": "https://openrouter.ai/api",
    "api_key_env": "OPENROUTER_API_KEY",
    "match": "slash-models"
  }
}
```

Models with `/` in the slug route through OpenRouter. Native models use
their harness directly. No switching between runs — see the
[configuration reference](CONFIGURATION.md) for details.

## Releases

### 0.1.2

- Interactive setup, diagnostics, and managed global skills and MCP connections.
- Printable native launches with argument passthrough and stable Codex resume homes.
- Environment-variable bearer authentication for HTTP MCP connections and provider targeting.
- Bundled dcouple plugin 0.1.7 with updated profiles and skills.
- Tag-validated npm publishing with package integrity checks and provenance.

## Releasing

Before the first release, open the package's Settings on npmjs.com, find
Trusted Publisher, and select GitHub Actions. Set the organization to `dcouple`,
repository to `agent-farm`, and workflow filename to `publish.yml`. Leave the
environment name empty and allow direct publishing with `npm publish`.
No npm token or repository secret is required. See the
[npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

Bump the version in `package.json`, commit it, and push the commit. Then tag
that commit and push the tag:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

The release workflow checks that the tag matches the package version, runs the
tests, builds, and publishes the public package using Trusted Publishing (OIDC).
The workflow pins npm to `11.5.1`; npm automatically generates provenance.

## Documentation

- [Configuration reference](CONFIGURATION.md)
- [Operational notes](docs/operations.md)
- [Verification history](docs/verification-history.md)
- [Example configurations](examples/)
- [Skill and profile sources](https://github.com/dcouple/skills)
