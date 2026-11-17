# Cross-OS QA through Workspaces

For OS-sensitive changes or cross-platform claims, discover reachable machines,
run isolated checks, and collect proof per OS. OS-sensitive work includes paths,
shells, native modules, installers, desktop UI, terminals, file watching, line
endings, WSL interop, and simulators. Keep the caller's authorization, delegation,
time, and publication limits; preserve the PR's current draft/ready state.

"Workspaces" here means whatever remote machines the host can reach for you.
The commands that discover machines, launch an agent on one, run a command
there, and read its output come from the host's injected instructions or the
`host_policy` document. Read them before planning. With no such host facility,
check the local OS and mark every other claimed OS BLOCKED with that reason.

## Detect and plan

Confirm the host's remote facility answers and names the machines it can reach,
with each one's OS, architecture, and any WSL distros. A missing or unreachable
facility is BLOCKED; continue independent local checks. Online status and listed
distros identify candidates, not completed checks: confirm each machine's shell
or app is ready before counting it.

Plan the relevant checks once per reachable OS, including the local OS. Use
one machine per OS unless architecture/runtime differences matter. Include all
claimed platforms: offline machines, a disabled remote facility, or unavailable
tools get BLOCKED rows with reasons. Leave infrastructure changes to their owner.
Name WSL distros separately from native Windows. For OS-neutral work, state why
local checks suffice. Continue independent platforms when another is blocked.

## Run and observe

Discover each machine's saved repository and use its paths and shell quoting.
On this machine, QA runs as a new agent in the feature's existing workspace,
never a new workspace. Another machine has no worktree for the feature, so it
gets one QA workspace per feature: create it once through the host and reuse it
for every later QA run there. Prefer a visible QA agent when delegation is
allowed; leaf helpers use direct exec and return agent requests (OS, SHA, check
plan) to the parent. The parent owns authorized launches and evidence
collection, or reports the platform BLOCKED.

A QA workspace on another machine fetches and checks out the target SHA there
and isolates the app before testing. A QA agent in the feature's workspace on
this machine shares the implementer's checkout: it tests the branch as checked
out, confirms `git rev-parse HEAD` equals the target SHA, and never runs
`git checkout`, `reset` or `stash`. Each starting message carries the SHA, the
checks, the evidence wanted, and the isolation rules.

After launch or submission, confirm the agent received its task, wait for
completion, read its final message, and retrieve logs and media through the
host. Treat input the host reports as queued or unconfirmed as not yet
delivered; inspect and resubmit before counting the task running. Answer
first-run dialogs (folder trust, background-server prompts) for the intended
checkout only under the caller's authorization. Leave unrelated agents running.

For WSL, select a distro from `wsl.exe --list --quiet`, then execute explicitly:
`wsl.exe -d <distro> -- bash -lc '<check>'`, quoted for the outer shell too.
Inside the distro, establish the Linux repo path and capture `uname -s`, distro
identity, and `git rev-parse HEAD` with the output. A failed start is BLOCKED.

On another machine, fetch and check out the requested SHA in its QA workspace,
including direct-exec checks. On this machine, check out nothing. Verify
`git rev-parse HEAD` before tests everywhere. For a
composite merge commit, record its SHA and prove the requested head is included
with `git merge-base --is-ancestor <requested-head> HEAD`. Retain `git status
--short` and the patch for dirty trees; label that evidence as dirty-state proof.
Preserve the person's checkout and any app instance they are running. Use
separate dependencies/build output, ports, and app user-data for the app under
test, while the host's own tooling stays connected to its existing instance.
Clean up only resources this run created.

## Collect per-OS proof

Repeat the same planned check rows per OS/runtime. Mark OS-specific rows
Skipped (not applicable) elsewhere. For executed checks, capture actual
commands, stdout/stderr, exit codes, machine/runtime, exact SHAs, and evidence
paths. Pair baseline failing/old behavior with candidate behavior under the
same check: screenshots/recordings for UI, command output for CLI. If the
baseline cannot run, mark before/after proof BLOCKED with the reason; report
any candidate-only pass separately.

Keep evidence in the caller's temporary folder, separated by OS. Name the
machine for remote paths and retrieve artifacts for review when possible.

| OS / runtime | Baseline → tested SHA | Check / command | Result | Before → after evidence; exit codes / reason |
| --- | --- | --- | --- | --- |
| <OS, WSL distro> | <base> → <head> | <check; actual command> | PASS / FAIL / BLOCKED | <paired proof or blocker> |

Give every planned platform a verdict for its applicable checks:

- `✓ PASS on <OS>`: all planned checks passed with evidence.
- `✗ FAIL on <OS>: <failure>`: an exercised check failed.
- `BLOCKED on <OS>: <reason>; unverified`: proof is missing or incomplete;
  list any completed checks separately.

A native OS pass requires the relevant real path executing on that OS with
command/output and tested SHA. Label mocks, fake transports, OS overrides,
portable unit tests, connectivity, and agent launches by what they prove.
WSL evidence proves its named Linux runtime; Windows requires native execution.

## Practical lessons

- **Exit codes through bridges:** a remote-exec bridge may append its own flags
  after your command or wrap it in another shell. Preserve the check's original
  exit code (` ; echo …` can mask it), check the returned shell and status, and
  remember cmd.exe has no `#` comments.
- **Borrow tools:** use a machine's existing `gh` authentication through the
  host's remote exec. Set GitHub targets explicitly and keep credentials on
  their host; caller publication rules apply.
- **Electron capture:** macOS background capture needs Screen Recording
  permission; Windows gdigrab can give black frames. CDP capture of the isolated
  app (`--remote-debugging-port`, `Page.startScreencast`) works without OS capture
  permission on macOS, Windows, and WSL. Bind debugging locally, collect and
  acknowledge frames, and inspect media. CDP covers web contents; verify native
  dialogs/OS chrome separately when relevant.
- **Windows fixtures:** use hermetic fake daemons/transports for portable tests;
  extensionless shebang fake CLIs fail natively. Test real native execution when
  that boundary matters, and label fixture results separately.
- **Disk pressure:** pnpm node_modules may share hard links with its store, so
  deleting them reclaims little. `pnpm store prune` frees unused store content;
  treat it as shared-machine maintenance requiring coordination with its owner.
- **WSL→Windows routes:** a bridge from WSL to Windows tooling can look for a
  Linux socket instead of the Windows one. Check dry-run and execution results,
  use another route while affected, and report remaining route gaps as BLOCKED.
