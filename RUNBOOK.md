# Runbook

Agent Farm ships as the npm package `@greenfieldco/agent-farm`. There are no
servers, databases, migrations, or hosted environments. Operations means
releasing the package and updating the plugins it bundles.

## Release to npm

`.github/workflows/publish.yml` runs when a `v*` tag is pushed. It:

1. fails unless the tag equals `v` plus the `version` in `package.json`;
2. runs `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build`;
3. installs npm 11.5.1 and runs `npm publish --access public` through npm
   Trusted Publishing (OIDC), with no token or repository secret. npm attaches
   provenance automatically.

To release:

```sh
# 1. Bump "version" in package.json, commit ("Release Agent Farm X.Y.Z"), push to main.
git tag vX.Y.Z
git push origin vX.Y.Z
# 2. Watch the "Publish to npm" run in GitHub Actions, then confirm:
npm view @greenfieldco/agent-farm version
```

One-time setup, already done: on npmjs.com, the package's Trusted Publisher is
GitHub Actions with organization `greenfield-inc`, repository `agent-farm`, and
workflow `publish.yml`, with no environment name. See the
[npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

Release notes live in the GitHub releases and tags, not in this repository.

## Roll back a release

npm does not allow republishing a version. To undo a bad release:

1. Publish a fixed version (X.Y.Z+1), built from the last good commit or from a fix.
2. Mark the bad version: `npm deprecate @greenfieldco/agent-farm@X.Y.Z "<reason>; use X.Y.Z+1"`.

Users pick up plugin changes only after upgrading and running
`agent-farm plugin install [NAME]`, so a bad plugin change is rolled back the
same way: revert it, then release a new CLI version.

## Update bundled plugins

The package ships everything under `plugins/`. CLI and plugin versions are
independent; each plugin's version is in its `plugin.yaml`.

- **dcouple**: maintainers publish `plugins/dcouple/` into this repository from
  a separate source repository, and the publish procedure is documented there.
  The publish replaces the whole folder and opens a pull request here. Never edit
  `plugins/dcouple/` directly, because the next publish overwrites it. Before
  merging that pull request, run the isolated test suite from
  [docs/development.md](docs/development.md#keep-tests-off-your-real-config).
- **orchestra**: generated from pinned upstream commits. Edit
  `scripts/orchestra-guide.html` for the guide page, and put any text changes in
  the script's patch list, never in the vendored files. Then regenerate:

  ```sh
  node scripts/vendor-orchestra.mjs <orchestra checkout> <skills checkout> [orchestra commit] [skills commit]
  ```

- **greenfield**: authored in this repository. Edit it in place and bump
  `plugins/greenfield/plugin.yaml`'s `version`. Its `tdd` and `codebase-design`
  skills are vendored unchanged from mattpocock/skills (see
  `plugins/greenfield/THIRD_PARTY_NOTICES.md`).

Check a plugin before release with
`node dist/cli.js plugin validate plugins/<name> --config-root "$(mktemp -d)"`.

## Local state on user machines

For support questions, see [CONFIGURATION.md](CONFIGURATION.md) for the full
layout. In brief:

- `~/.config/agent-farm/`: configuration, installed plugins, and receipts.
- `~/.local/state/agent-farm/`: telemetry, workspace trust records, and global-install ownership.
- `~/.cache/agent-farm/`: generated runtime homes and skill layouts.
