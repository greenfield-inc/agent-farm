# Checks

Every finding has a stable `id`. Allowlist lines and `--diff` key on the id plus the finding's `subject`, the thing it is about (a path, a server name, a setting). "Deep" means the check runs only with `--deep`. Every other check runs in the default `--fast` scan. A check whose tool is missing, that needs `--deep`, or that doesn't apply to the OS reports SKIP with the reason.

Levels are the most severe the check gives. Most checks also report PASS or INFO.

## os

| id | Level | What |
| --- | --- | --- |
| `os.version` | INFO | macOS version and build |
| `os.updates` | FAIL | Pending security or point updates. Fast reads the last automatic check; deep runs `softwareupdate -l` |
| `os.updates-clt` | WARN | Pending Command Line Tools update (deep) |
| `os.major-upgrade` | INFO | A new major macOS version is available (deep) |
| `os.updates-check-stale` | WARN | The last successful update check was more than 14 days ago |
| `os.auto-update` | FAIL | Automatic security responses or system data files are off. Subject: the preference key |
| `os.filevault` | FAIL | FileVault is not on (INFO with `--role server`) |
| `os.sip`, `os.gatekeeper` | FAIL | System Integrity Protection or Gatekeeper is off |
| `os.screen-lock` | FAIL | No password after sleep, or a delay over 60 seconds (WARN) |
| `os.xprotect` | INFO | XProtect definitions version |
| `os.config-profiles` | WARN | User-level configuration profiles. Device-level ones need `sudo profiles list` |
| `os.keychain-autolock` | INFO | The login keychain has no auto-lock timeout |

## network and sharing

| id | Level | What |
| --- | --- | --- |
| `network.firewall` | FAIL | Application firewall is off |
| `network.stealth` | WARN | Stealth mode is off |
| `sharing.remote-login`, `sharing.screen-sharing`, `sharing.file-sharing`, `sharing.remote-management` | WARN | The service's port answers on localhost (ports 22, 5900, 445, 3283) |
| `sharing.airplay-receiver` | WARN | AirPlay Receiver listens on 5000/7000 |
| `sharing.airdrop` | INFO | AirDrop discoverability setting, when macOS stores one |
| `network.listening-all` | WARN | A non-Apple process listens on all interfaces. Ports whose owner a non-root `lsof` can't see are INFO |
| `network.listening-localhost` | INFO | How many processes listen on localhost only |
| `network.tunnel` | INFO | ngrok, cloudflared, frpc, bore, localtunnel or zrok is running |
| `network.tailscale-serve` | WARN | Tailscale Serve exposes local services to the tailnet |
| `network.tailscale-funnel` | FAIL | Tailscale Funnel exposes a local service to the internet |

## persistence

| id | Level | What |
| --- | --- | --- |
| `persistence.launch-item` | FAIL | Every plist (including hidden ones) in `~/Library/LaunchAgents`, `/Library/LaunchAgents` and `/Library/LaunchDaemons`. FAIL when the program runs from a temp, shared or cache folder, or its arguments download with curl or wget or decode base64. WARN for a hidden folder, `sh -c`, `osascript`, a missing program, an unsigned or ad hoc-signed program outside the system and Homebrew prefixes, a `/Library` plist not owned by root, a group- or world-writable plist, or a plist changed in the last 14 days |
| `persistence.login-item` | WARN | Login items whose app is gone, or that run from a worktree, `node_modules`, a temp folder, Downloads or DerivedData (deep: needs Automation access to System Events) |
| `persistence.system-extension` | INFO | Active system extensions, and ones waiting to uninstall |
| `persistence.recent-executable` | WARN | Executables added in the last 14 days in `/tmp`, `/var/tmp` and `/Users/Shared` |
| `persistence.rc-fetch` | FAIL | Shell startup files that download and run remote code (`curl … \| sh`, `eval "$(curl …)"`). WARN for other curl, wget or base64 decoding. Line numbers only |
| `persistence.rc-eval` | INFO | Startup lines that `eval` command output, usually tool setup |
| `persistence.rc-changed` | INFO | A startup file changed in the last 7 days |

## apps

| id | Level | What |
| --- | --- | --- |
| `apps.unused` | WARN | Apps not opened in `--days-unused` days (default 90) |
| `apps.no-last-used` | INFO | How many apps have no last-opened date in Spotlight |

## secrets

| id | Level | What |
| --- | --- | --- |
| `secrets.dotfile` | FAIL | Shell startup files with token shapes or credential-named variables set to a literal |
| `secrets.shell-history` | FAIL | Shell and REPL history lines with token shapes |
| `secrets.aws-static-keys` | FAIL | Long-lived keys in `~/.aws/credentials` |
| `secrets.netrc`, `secrets.npm-token`, `secrets.pypi-token`, `secrets.docker-auth`, `secrets.gh-plaintext`, `secrets.stripe-live` | WARN | Plain-text credentials in those tools' config files |
| `secrets.file-permissions` | FAIL | A file that holds credentials is readable by group or others |
| `secrets.env-files` | WARN | `.env` files that hold credentials, under the repo roots (deep: the whole home folder). Examples, samples and templates are skipped |
| `secrets.env-files-by-folder` | INFO | The same, counted per folder |
| `secrets.env-backup` | FAIL | Backup copies (`.bak`, `.old`, `.orig`, `~`) of `.env` files with credentials |
| `secrets.env-permissions` | WARN | A `.env` file with credentials that group or others can read |
| `secrets.gcp-sa-keys` | FAIL | Google service-account key files, counted by distinct key |
| `secrets.signing-material` | WARN | `.p12`, `.pfx`, `.jks`, `.keystore`, `.p8`, and `.pem` or `.key` files holding a private key, in Desktop, Documents and Downloads (deep) |
| `secrets.gitleaks` | INFO | Whether gitleaks is installed for a deeper scan |

## ssh and git

| id | Level | What |
| --- | --- | --- |
| `ssh.key` | FAIL | A private key in `~/.ssh` without a passphrase. FIDO (`sk-`) keys are INFO |
| `ssh.key-permissions` | FAIL | A private key readable by group or others |
| `ssh.authorized-keys` | WARN | Keys that can log in to this Mac (INFO with `--role server`) |
| `ssh.forward-agent`, `ssh.host-key-checking` | WARN | `ForwardAgent yes`, `StrictHostKeyChecking no` or `UserKnownHostsFile /dev/null` in `~/.ssh/config` |
| `ssh.agent` | INFO | How many keys the SSH agent holds |
| `git.credential-store` | FAIL | `~/.git-credentials` exists, or the credential helper is `store` |
| `git.commit-signing` | INFO | Commits aren't signed by default |
| `git.gh-scopes` | WARN | The GitHub CLI login has `delete_repo` or an `admin:` scope. `workflow` is INFO. Never reads the token. Skipped with `--offline` |

## packages

| id | Level | What |
| --- | --- | --- |
| `packages.pnpm-release-age` | WARN | No global `minimum-release-age` of at least a day |
| `packages.npm-ignore-scripts`, `packages.npm-release-age` | WARN | npm runs install scripts, or has no `min-release-age` (read from `~/.npmrc` too, because `npm config get` can print null when it is set) |
| `packages.cask-no-quarantine` | WARN | `--no-quarantine` in `HOMEBREW_CASK_OPTS` or a startup file |
| `packages.pip-index` | WARN | `extra-index-url` or `trusted-host` in pip or uv config, or the matching environment variables. The scan reads the files and never runs pip |
| `packages.brew-tap`, `packages.brew-service` | INFO | Third-party taps and running Homebrew services |
| `packages.brew-outdated` | WARN | Outdated Homebrew packages, from the local index without updating it |
| `packages.brew-deprecated` | WARN | Deprecated or disabled Homebrew packages (deep) |

## editors, browsers and agents

| id | Level | What |
| --- | --- | --- |
| `editors.extensions` | INFO | Extension counts for VS Code, Cursor, Windsurf and VSCodium |
| `browser.extensions` | INFO | Extensions per Chromium browser profile, and how many can read every site, cookies, the debugger or native messaging |
| `agents.claude-permissions` | WARN | `defaultMode: bypassPermissions` or `skipDangerousModePermissionPrompt` in user or repo Claude Code settings |
| `agents.claude-project-mcp` | WARN | `enableAllProjectMcpServers: true` |
| `agents.claude-hooks` | WARN | Hooks that download with curl or wget, pipe to a shell, or decode base64 |
| `agents.claude-env-secret` | FAIL | Credentials written inline in a settings `env` block |
| `agents.claude-base-url`, `agents.claude-deny`, `agents.claude-sandbox`, `agents.claude-managed` | INFO | `ANTHROPIC_BASE_URL` override; user `permissions.deny` not covering `~/.ssh`, `.env` and cloud credentials; sandbox off or with an unsandboxed escape hatch; managed settings present |
| `agents.project-mcp` | INFO | How many project `.mcp.json` files the repo roots hold |
| `agents.mcp-unpinned` | WARN | An MCP server launched through `npx`, `bunx`, `pnpm dlx`, `uvx`, `pipx` or `docker run` without a pinned version |
| `agents.mcp-inline-secret` | FAIL | An MCP server with a credential written in its env, headers, args or URL |
| `agents.codex-approval`, `agents.codex-sandbox` | WARN | Codex `approval_policy = "never"` or `sandbox_mode = "danger-full-access"`, at the top level or in a profile |
| `agents.codex-trust-broad` | WARN | Codex trusts your home folder, `/`, or a whole repo root |
| `agents.codex-network`, `agents.codex-trusted-projects`, `agents.codex-trusted-tmp` | INFO | Network access in the workspace-write sandbox; how many trusted projects; how many are temp folders |

Claude Code settings are read from `~/.claude/settings.json`, `~/.claude/settings.local.json` and each repo's `.claude/settings*.json`. MCP servers are read from `~/.claude.json` (top level and per project), Cursor, Claude Desktop, Windsurf and Gemini configs, `~/.codex/config.toml`, and each repo's `.mcp.json`. These checks need `jq`, which macOS 15 and later include.

## docker, checkouts and cloud

| id | Level | What |
| --- | --- | --- |
| `docker.published-port` | WARN | A container publishes a port on all interfaces |
| `docker.socket-mount` | WARN | A container mounts the Docker socket |
| `docker.socket-permissions` | WARN | The Docker socket is world-writable |
| `docker.disk` | INFO | Docker disk use (deep) |
| `stale.checkout` | WARN | A checkout untouched for `--days-unused` days that still holds `.env` credentials. It reads file times only and never runs `git` in the repo |
| `cloud.kubectl-prod-default` | WARN | kubectl's current context looks like production |

## meta

`meta.version` comes first and `meta.summary` last, with the counts by level, the score and the elapsed time. `meta.timing` gives each section's time. `meta.allowlist-invalid` and `meta.allowlist-expired` (WARN) report allowlist lines that are malformed or past their date. A section skipped because the time budget ran out reports `<section>.budget`.
