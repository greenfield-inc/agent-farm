# Development

## Build and run from source

Requires Node 22.15+ and pnpm 11 (the version is pinned in `package.json`'s
`packageManager`, so `corepack enable` provides it).

```sh
git clone https://github.com/greenfield-inc/agent-farm.git
cd agent-farm
pnpm install --frozen-lockfile   # also builds, through the prepare script
pnpm typecheck
node dist/cli.js help
```

To use the source build as your everyday `agent-farm`, link it onto your PATH:

```sh
mkdir -p ~/.local/bin
ln -s "$PWD/dist/cli.js" ~/.local/bin/agent-farm
```

Rebuild with `pnpm build` after changing `src/`.

## Keep tests off your real config

Every CLI command reads and writes `~/.config/agent-farm` unless you pass
`--config-root DIR`. The CLI ignores the `AGENT_FARM_CONFIG_ROOT` environment
variable; only generated launch bundles read it. The bare `agent-farm` menu,
`init`, and `doctor` have no `--config-root` option and always use
`$HOME/.config/agent-farm`. Tests also create `.codex`, `.local`, and `.cache`
under `HOME`, and some inherit the whole environment, so an exported
`AGENT_FARM_CONFIG_ROOT` or `CODEX_HOME` in your shell can change their results.

Run the suite against scratch directories:

```sh
pnpm build
env -u CODEX_HOME -u AGENT_FARM_NATIVE_CODEX_HOME \
  HOME="$(mktemp -d)" AGENT_FARM_CONFIG_ROOT="$(mktemp -d)" \
  node --test tests/*.test.mjs
```

`pnpm test` runs the same tests after a build, using your real `HOME`. Don't
combine `pnpm test` with a temporary `HOME`: pnpm then looks for its store and
cache in the new `HOME` and tries to reinstall.

For manual checks, pass a temporary root to every command, for example
`node dist/cli.js plugin install greenfield --config-root "$(mktemp -d)"`. To
try the bare menu or `doctor`, set `HOME` to a temporary directory.

## This repository's own workspace

This repository tracks `.agent-farm/workspace.yaml`, which configures agents
launched here. Until you approve it, `inspect`, `--explain`, and headless runs
fail with a trust error. Run `agent-farm workspace trust`, or pass
`--no-workspace`. Launches write bundles to `.agent-farm/generated/`, which is
gitignored.

## Layout

- `src/`: the CLI (`cli.ts`, `commands.ts`), compiler, runtime, plugins, workspaces, telemetry, and dashboard.
- `src/runtime.ts` is copied into every launch bundle as `runtime.mjs` and runs without the package installed. Import only `node:` builtins there.
- `tests/*.test.mjs`: `node:test` suites that run against `dist/`.
- `plugins/`: the bundled plugins that the npm package ships. See [RUNBOOK.md](../RUNBOOK.md#update-bundled-plugins) for how each one is updated.
- `examples/`: sample agents, skills, and a repository workspace.

## Scripts

- `scripts/vendor-orchestra.mjs`: regenerates `plugins/orchestra` from pinned upstream commits. See [RUNBOOK.md](../RUNBOOK.md#update-bundled-plugins).
- `scripts/orchestra-guide.html`: the source for `plugins/orchestra/index.html`. The vendor script copies it into place.
- `scripts/provider-smoke.mjs`: checks provider routing end to end against a local fake gateway. Run it after `pnpm build`. It needs the native `claude` and `codex` CLIs on PATH, and uses no real credentials.

## Documentation checks

`tests/docs-links.test.mjs` fails when a relative link or `#anchor` in a tracked
Markdown file points nowhere. Pull requests run `pnpm typecheck` and the test
suite in CI (`.github/workflows/ci.yml`).
