# Process classes

Each class has an id, used in the `authorized` launch argument and in the report. "Safe" means stopping it loses no work; it is still stopped only with the person's go-ahead or `authorized`. "Ask" means it might be someone's work, so it needs a yes for that class in this run. "Never" means don't stop it in this skill at all.

Without `sudo` or elevation you can only stop your own user's processes, which keeps system processes out of reach. Don't try to get around a "permission denied": report it.

## Classes

| Id | What it is | How to spot it | Verdict | Cost of stopping |
| --- | --- | --- | --- | --- |
| `fsmonitor-orphaned` | git fsmonitor daemon whose repository or worktree is gone | `fsmonitor` row `worktree-missing` or `gitdir-missing` | safe | none |
| `fsmonitor-idle` | daemon for a repository that still exists but nothing is using: no running Pane has it as its worktree and no git command runs in it | `fsmonitor` row `live` (with or without `,temp`), worktree not under a running Pane, no git in progress | safe | the next `git status` there is slower once, and starts a new daemon |
| `app-renderers` | a browser's or Electron app's renderers piling up over days | `apps` row with many `renderers_older_2d` | ask | quitting the app closes its windows and tabs; most restore them |
| `app-duplicates` | extra copies of an app that should run once | `apps` row with `launched` above 1 | ask | closes those windows |
| `dev-servers-orphaned` | dev server or watcher whose terminal is gone | `dev-servers` row of kind `server`, parent `orphaned` or `gone`, working folder known and not in a running Pane, and no Pane panel id that is a running panel (a detached server keeps the panel id of the terminal that started it) | safe (ask on Windows or without `runpane`) | none, unless the person still opens that port: list ports in the question |
| `dev-servers` | dev server or watcher with a live parent, or any node, bun or deno program not recognized as a server (kind `runtime`, which may be a batch job) | the other `dev-servers` rows, every `runtime` row included | ask | stops a server or job someone may be using |
| `shells-orphaned` | idle shell with no terminal and no parent | `agents-and-shells` shell row, parent `orphaned` or `gone`, no tty (`??` or `?`), no Pane ids, `children` 0 and near-zero CPU. A shell with children is running a job: it goes in `ask`, listing what its children are | safe (ask on Windows or without `runpane`) | none |
| `agents-orphaned` | agent CLI (claude, codex) whose panel, Pane or Session no longer exists | `agents-and-shells` agent row, no running panel matches it, parent `orphaned` or `gone`, near-zero CPU | ask | loses that agent's unsaved session if it was still working headless |
| `pane-live` | anything belonging to a running Pane panel, a shell whose parent is the Pane app, and any app that hosts terminals or agents: Pane itself, editors such as VS Code or Cursor, terminal apps | Pane ids, working folder or parent match step 3 of the skill, or the `apps` row is one of those | never | close the panel or archive the Pane instead; quit such an app only by hand |
| `git-in-progress` | git command running, or a repository with `index.lock` | step 3 of the skill | never | wait for it to finish |
| `zombies` | exited process its parent hasn't collected | `zombies` section | never | it holds no memory; it goes when its parent exits. Name the parent in the report |
| `indexing` | Spotlight (`mds*`, `mdworker*`, `corespotlightd`), Windows Search, Defender, tracker, baloo | `indexing` and `spotlight-status` sections, `top-cpu` | never | fix with exclusions (Prevent) |
| `system` | anything owned by root or SYSTEM, the window server, login, Finder, Explorer, and apps the person is using that aren't piling up renderers or copies | not your user's, or not in any class above | never | — |
| `unknown` | a heavy row that fits none of the classes above, including an `fsmonitor` row in state `unknown` | — | ask | say what it is and what stopping it would cost |

A process in two classes takes the stricter verdict. "never" classes can't be authorized: if `authorized` names one, skip it and say so.

## Stopping, by class

Send each class as one batch. Confirm each pid still is what the survey said (same name and age) right before stopping it: pids get reused. Stop only the rows the person saw in that class; never a process tree flag such as `taskkill /T`, which reaches children nobody classified.

### fsmonitor

Stop by repository, not by pid. This is the daemon's own shutdown and never touches the index:

```sh
git -C <worktree> fsmonitor--daemon stop      # every OS; give each repository about 10 seconds
```

For a `worktree-missing` or `gitdir-missing` daemon on macOS or Linux, there is no repository left to ask, so signal its pid: `kill -TERM <pids>`, then after 5 seconds `kill -KILL` whatever is left.

On Windows a daemon can't be matched to its pid. Stop the orphans by pid only when you have just stopped the daemon of every `live` repository in the list, none was skipped, and the number of git fsmonitor daemons still running equals the number of `worktree-missing` and `gitdir-missing` rows. Then `Stop-Process -Id <pid>,<pid>` on those. Otherwise leave them and report the count: a restart or log-off clears them.

### Apps (renderers, duplicates)

Quit the app's real instance (a `launched` process) instead of picking off renderers, which only crashes tabs:

- macOS and Linux: `kill -TERM <main pid>`. Chromium and Electron treat it as Quit. Avoid `osascript` over `exec`: it can wait on an Automation permission prompt nobody can answer.
- Windows: `taskkill /PID <pid> /PID <pid>` (no `/F`) asks its windows to close.

After 10 seconds, force only what is left of those apps: `kill -KILL <pids>` or `taskkill /F /PID <pid>`, unless the app is showing a dialog (a save prompt), which you leave for the person. For duplicates, ask which copy to keep; with no answer, keep the oldest `launched` one, which is most likely the one in use. Tell them which apps will need reopening.

### Dev servers, shells, agents

macOS and Linux: `kill -TERM <pids>`, then `kill -KILL` on what is left after 5 seconds. Windows: `Stop-Process -Id <pid>,<pid>`. Console programs such as node, shells and agent CLIs have no window to close, so Windows has no graceful step for them.

## Prevent

| Class | Durable fix | Needs |
| --- | --- | --- |
| fsmonitor | In throwaway, test and QA repositories: `git -C <repo> config --unset core.fsmonitor`. A daemon only starts where it is on. A tool that turns it on for every repository it opens will turn it back on; say so, and name the tool if you can tell | nothing |
| fsmonitor | Archive Panes whose pull request merged or whose work is done, which removes the worktree and stops its daemon. Confirm with `panes archive --pane <id> --dry-run --yes --json` first (the command takes `--yes` even for a dry run, which changes nothing) | the person's yes per Pane |
| apps | Quit long-running browsers and Electron apps once a day; turn on the browser's sleeping or discarded tabs | nothing |
| apps | A launcher or agent opening a new copy each time (dozens of the same app) needs fixing at the source: name the parent that launched them | — |
| dev servers, shells | Run dev servers in Pane panels or a tmux session that is closed with its work, not with `&` or `nohup` | nothing |
| Spotlight | Rename folders that never need searching (archives, caches) with a `.noindex` suffix; Spotlight skips them | nothing, but it changes the path |
| Spotlight | Exclude the folders that hold checkouts and worktrees: System Settings > Spotlight > Search Privacy, or from a terminal `sudo mdutil -i off <volume>` for a whole volume. Print the command; never run it | the person, with `sudo` |
| Windows Search | Remove repository folders from Indexing Options (Control Panel > Indexing Options > Modify) | the person |
| Defender | Develop on a Dev Drive, which Defender scans in performance mode, or add an exclusion from an admin shell: `Add-MpPreference -ExclusionPath C:\repos`. Exclusions weaken protection for that folder; say so | the person, admin |
