#!/bin/bash
# process-cleanup survey: read-only look at what is loading a Mac, Linux or WSL machine.
#
# Prints sections headed "== name ==", each a tab-separated table with a header row.
# It never kills, stops or changes anything, never uses sudo, and bounds every slow call.
# Command lines never reach the output: each row shows the program and only those of its first
# three arguments that match a fixed list of tool, mode and flag names, with "..." for the rest.
# Its only file writes are temp files under mktemp, removed on exit.
# Runs on the macOS system bash (3.2) and BSD awk.

set -u
umask 077

usage() {
  cat <<'EOF'
Usage: survey.sh [--budget SECONDS] [--session-var NAME] [--agent-var NAME]

  --budget       Seconds allowed for each slow call (lsof, mdutil, memory_pressure). Default 8.
  --session-var  Environment variable in which the host stores its session id.
  --agent-var    Environment variable in which the host stores its agent or terminal id.
                 With either set, agent, shell and dev-server rows show those ids.
EOF
}

BUDGET=8; SVAR=""; AVAR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --budget) BUDGET="${2:-8}"; shift 2 ;;
    --session-var) SVAR="${2:-}"; shift 2 ;;
    --agent-var) AVAR="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

T=$(mktemp -d 2>/dev/null || mktemp -d -t pcsurvey) || exit 1
trap 'rm -rf "$T"' EXIT
have() { command -v "$1" >/dev/null 2>&1; }

# bounded SECONDS CMD...: run CMD, stop it after SECONDS. macOS has no timeout(1).
bounded() {
  local secs=$1; shift
  "$@" &
  local pid=$!
  ( sleep "$secs" & s=$!; trap 'kill $s 2>/dev/null; exit 0' TERM; wait $s; kill -TERM "$pid" 2>/dev/null ) &
  local watcher=$!
  wait "$pid" 2>/dev/null; local rc=$?
  kill -TERM "$watcher" 2>/dev/null; wait "$watcher" 2>/dev/null
  return $rc
}

OS=$(uname -s)
WSL=0
[ "$OS" = Linux ] && grep -qi microsoft /proc/version 2>/dev/null && WSL=1

# ---------- host ----------
echo "== host =="
printf 'key\tvalue\n'
printf 'hostname\t%s\n' "$(hostname 2>/dev/null)"
if [ "$OS" = Darwin ]; then
  cores=$(sysctl -n hw.ncpu)
  printf 'os\tmacOS %s\n' "$(sw_vers -productVersion 2>/dev/null)"
  printf 'cores\t%s\n' "$cores"
  load=$(sysctl -n vm.loadavg | tr -d '{}' | awk '{print $1, $2, $3}')
  boot=$(sysctl -n kern.boottime | sed 's/^{ sec = \([0-9]*\).*/\1/')
  up=$(( $(date +%s) - boot ))
  printf 'memory_gb\t%s\n' "$(( $(sysctl -n hw.memsize) / 1073741824 ))"
  printf 'swap\t%s\n' "$(sysctl -n vm.swapusage)"
  mp=$(bounded "$BUDGET" memory_pressure -Q 2>/dev/null | awk -F': ' '/free percentage/{print $2}')
  printf 'memory_free_percent\t%s\n' "${mp:-unknown}"
else
  cores=$(nproc 2>/dev/null || getconf _NPROCESSORS_ONLN)
  printf 'os\t%s%s\n' "$( (. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-Linux}") )" "$([ $WSL = 1 ] && echo ' (WSL: Windows host processes are not visible here; run survey.ps1 on the host)')"
  printf 'cores\t%s\n' "$cores"
  load=$(awk '{print $1, $2, $3}' /proc/loadavg)
  up=$(awk '{print int($1)}' /proc/uptime)
  awk '/^MemTotal|^MemAvailable|^SwapTotal|^SwapFree/{printf "%s\t%.1f GB\n", tolower(substr($1,1,length($1)-1)), $2/1048576}' /proc/meminfo
  [ -r /proc/pressure/memory ] && printf 'memory_pressure\t%s\n' "$(head -1 /proc/pressure/memory)"
fi
printf 'uptime_days\t%s\n' "$(( up / 86400 ))"
printf 'load_1_5_15\t%s\n' "$load"
printf 'load_per_core\t%s\n' "$(echo "$load" | awk -v c="$cores" '{printf "%.1f", $1/c}')"
df -kP "$HOME" 2>/dev/null | awk 'NR>1 {printf "disk_free %s\t%.0f GB of %.0f GB (%s used)\n", $6, $4/1048576, $2/1048576, $5}'

# ---------- process snapshot ----------
# comm (full path on macOS) and args go in separate calls so names with spaces stay whole.
ps -ax -o pid=,ppid=,stat=,etime=,rss=,%cpu=,tty=,comm= > "$T/comm" 2>/dev/null
ps -ax -o pid=,args= > "$T/args" 2>/dev/null

# fsmonitor daemons: map each to its .git/fsmonitor--daemon.ipc socket. When the socket was
# bound with a relative name, fall back to the deepest directory the daemon holds open
# (the watched worktree; the rest are its parents).
awk 'index($0, "fsmonitor--daemon run") {print $1}' "$T/args" > "$T/fsm.pids"
: > "$T/fsm.ipc"
if [ -s "$T/fsm.pids" ]; then
  if have lsof; then
    bounded "$BUDGET" lsof -p "$(paste -sd, - < "$T/fsm.pids")" -Fpftn 2>/dev/null | awk '
      function flush() { if (p != "") print p "\t" (ipc != "" ? ipc : (dir != "" ? dir "/?" : "?")) }
      /^p/ { flush(); p = substr($0, 2); ipc = ""; dir = ""; next }
      /^f/ { fd = substr($0, 2); next }
      /^t/ { ty = substr($0, 2); next }
      /^n/ { n = substr($0, 2)
             if (n ~ /^\/.*fsmonitor--daemon\.ipc$/) ipc = n
             else if (fd != "cwd" && ty == "DIR" && length(n) > length(dir)) dir = n }
      END { flush() }' > "$T/fsm.ipc"
  elif [ -r /proc/net/unix ]; then
    awk '$NF ~ /fsmonitor--daemon\.ipc$/ {print "?\t" $NF}' /proc/net/unix | sort -u > "$T/fsm.ipc"
  fi
fi
# Resolve each socket's git dir to its worktree and whether it still exists.
: > "$T/fsm.repo"
while IFS="$(printf '\t')" read -r pid ipc; do
  gitdir=${ipc%/fsmonitor--daemon.ipc}
  case "$ipc" in
    */\?) wt=${ipc%/?}; gitdir="?"; [ -d "$wt" ] && st=live || st=worktree-missing
          printf '%s\t%s\t%s\t%s\n' "$pid" "$st" "$gitdir" "$wt" >> "$T/fsm.repo"; continue ;;
    \?) printf '%s\tunknown\t?\t?\n' "$pid" >> "$T/fsm.repo"; continue ;;
  esac
  case "$gitdir" in
    */.git/worktrees/*)
      if [ -f "$gitdir/gitdir" ]; then wt=$(dirname "$(cat "$gitdir/gitdir")"); [ -d "$wt" ] && st=live || st=worktree-missing
      else wt="?"; st=gitdir-missing; fi ;;
    */.git) wt=${gitdir%/.git}; if [ -d "$gitdir" ]; then st=live; elif [ -d "$wt" ]; then st=gitdir-missing; else st=worktree-missing; fi ;;
    *) wt="$gitdir"; [ -d "$gitdir" ] && st=live || st=gitdir-missing ;;
  esac
  case "$wt" in /tmp/*|/private/tmp/*|/var/folders/*|/private/var/folders/*|"${TMPDIR:-/nonexistent}"*) st="$st,temp" ;; esac
  printf '%s\t%s\t%s\t%s\n' "$pid" "$st" "$gitdir" "$wt" >> "$T/fsm.repo"
done < "$T/fsm.ipc"

# Candidate agents, shells and dev servers: look up cwd and the host's ids from the environment.
awk '
  { pid=$1; $1=""; a=substr($0,2) }
  a ~ /(^|\/)(claude|codex|cursor-agent|gemini|opencode|amp)( |$)/ ||
  a ~ /(^|\/)-?(zsh|bash|fish|sh|tmux)( |$)/ ||
  a ~ /(^|\/)(node|bun|deno|esbuild|tsc|tsx|turbo|nodemon|vite|next-server)( |$)/ ||
  a ~ /(vite|webpack|next dev|storybook|vitest|jest --watch|tsc -w|tsc --watch|esbuild .*--watch)/ ||
  (a ~ /(^|\/)git( |$)/ && a !~ /fsmonitor--daemon/) { print pid }
' "$T/args" > "$T/cand.pids"
: > "$T/cwd"; : > "$T/hostenv"
if [ -s "$T/cand.pids" ]; then
  if [ "$OS" = Darwin ]; then
    have lsof && bounded "$BUDGET" lsof -a -d cwd -p "$(paste -sd, - < "$T/cand.pids")" -Fpn 2>/dev/null \
      | awk '/^p/{p=substr($0,2)} /^n/{print p "\t" substr($0,2)}' > "$T/cwd"
    # ps eww appends the environment; keep only the host's ids, never print the rest.
    [ -n "$SVAR$AVAR" ] && bounded "$BUDGET" ps eww -o pid=,command= -p "$(paste -sd, - < "$T/cand.pids")" 2>/dev/null | awk -v sv="$SVAR=" -v av="$AVAR=" '{
      s=""; p=""; for(i=2;i<=NF;i++){ if(sv!="=" && index($i,sv)==1) s=substr($i,length(sv)+1); if(av!="=" && index($i,av)==1) p=substr($i,length(av)+1) }
      if(s!=""||p!="") print $1 "\t" s "\t" p }' > "$T/hostenv"
  else
    while read -r pid; do
      c=$(readlink "/proc/$pid/cwd" 2>/dev/null) && printf '%s\t%s\n' "$pid" "$c" >> "$T/cwd"
      [ -n "$SVAR$AVAR" ] || continue
      e=$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | awk -F= -v sv="$SVAR" -v av="$AVAR" 'sv!="" && $1==sv{s=$2} av!="" && $1==av{p=$2} END{if(s!=""||p!="") print s "\t" p}')
      [ -n "$e" ] && printf '%s\t%s\n' "$pid" "$e" >> "$T/hostenv"
    done < "$T/cand.pids"
  fi
fi

awk -F'\t' -v os="$OS" -v up="$up" '
function secs(e,   d, n, i, s, p, a) {
  d = 0; if (index(e, "-")) { split(e, a, "-"); d = a[1]; e = a[2] }
  n = split(e, p, ":"); s = 0; for (i = 1; i <= n; i++) s = s * 60 + p[i]
  return d * 86400 + s
}
# macOS reports impossible ages for some processes started at boot.
function age(s) { if (s > up + 3600) return "boot"; if (s >= 86400) return sprintf("%.1fd", s/86400); if (s >= 3600) return sprintf("%.1fh", s/3600); return sprintf("%dm", s/60) }
function base(p,   n, x) { n = split(p, x, "/"); return x[n] }
function appof(p,   i, n, x) { n = split(p, x, "/"); for (i = 1; i <= n; i++) if (x[i] ~ /\.app$/) return substr(x[i], 1, length(x[i]) - 4); return "" }
# The only path from a command line to the output. Print the program name and only those of
# its first three arguments that are in a fixed list of tool, mode and flag names; the rest
# becomes "...". Credentials cannot be recognized by their shape, so nothing else is printed.
function label(w,   b) {
  if (w ~ /^(--watch|-w|--serve|--port|--host)$/) return w
  if (w ~ /[:@=]/) return ""
  b = base(w); sub(/\.(c|m)?js$/, "", b)
  return (b ~ /^(vite|vitest|next|nodemon|webpack|webpack-dev-server|storybook|start-storybook|tsc|tsx|esbuild|jest|turbo|http-server|live-server|npm|npx|pnpm|yarn|bun|deno|run|dev|serve|start|watch|preview|build|test|exec|x)$/) ? b : ""
}
function clean(a,   n, w, i, out, l, more) {
  n = split(a, w, " "); out = base(w[1])
  if (out !~ /^[A-Za-z0-9._-]{1,64}$/ || out ~ /^[A-Za-z0-9_-]{32,}$/) out = "?"
  for (i = 2; i <= n; i++) { l = (i <= 4) ? label(w[i]) : ""; if (l == "") more = 1; else out = out " " l }
  return out (more ? " ..." : "")
}
# A dev server or watcher only on positive evidence of a serve or watch mode; one-shot builds,
# test runs and anything ambiguous stay "runtime", which is never a safe stop.
# Every watch or serve flag is read first (-w only in a tsc command): a bare flag, one followed
# by another flag, or a value of true, 1, yes, on or forever (or a port for --serve) turns it on.
# Any other value, or one occurrence that is on and another that is off, keeps the row runtime.
function isserver(a, nm,   n, w, i, b, nx, v, tsc, en) {
  if (nm ~ /^(nodemon|next-server)$/) return 1
  n = split(a, w, " "); tsc = 0; en = 0
  for (i = 1; i <= n; i++) { b = base(w[i]); sub(/\.(c|m)?js$/, "", b); if (b == "tsc") tsc = 1 }
  for (i = 1; i <= n; i++) {
    if (w[i] ~ /^--(watch|serve)$/ || (tsc && w[i] == "-w")) v = (i < n && w[i + 1] !~ /^-/) ? w[i + 1] : "true"
    else if (w[i] ~ /^--(watch|serve)=/) v = substr(w[i], index(w[i], "=") + 1)
    else continue
    v = tolower(v)
    if (v ~ /^(true|1|yes|on|forever)$/ || (w[i] ~ /^--serve/ && v ~ /^([0-9.]+:)?[0-9]+$/)) en = 1
    else return 0
  }
  if (en) return 1
  for (i = 1; i <= n; i++) {
    b = base(w[i]); sub(/\.(c|m)?js$/, "", b); nx = (i < n) ? w[i + 1] : ""
    if (b ~ /^(nodemon|http-server|live-server|webpack-dev-server|start-storybook|next-server)$/) return 1
    if (b == "vite" && (nx == "" || nx ~ /^-/ || nx ~ /^(dev|serve|preview)$/)) return 1
    if (b == "next" && nx ~ /^(dev|start)$/) return 1
    if (b ~ /^(webpack|storybook)$/ && nx ~ /^(serve|dev)$/) return 1
    if (b ~ /^(npm|pnpm|yarn|bun)$/) { if (nx == "run" && i + 2 <= n) nx = w[i + 2]; if (nx ~ /^(dev|serve|start|watch)$/) return 1 }
  }
  return 0
}
FILENAME == ARGV[1] { l = $0; sub(/^ +/, "", l); pid = l; sub(/ .*/, "", pid); sub(/^[0-9]+ */, "", l); args[pid] = l; next }
FILENAME == ARGV[2] { fsm[$1] = $2 "\t" $3 "\t" $4; fsmrows[++nf] = $0; next }
FILENAME == ARGV[3] { cwd[$1] = $2; next }
FILENAME == ARGV[4] { pses[$1] = $2; ppan[$1] = $3; next }
{
  # comm rows are space-separated; the path in the last column may hold spaces.
  line = $0; sub(/^ +/, "", line)
  split(line, f, / +/)
  pid = f[1]; ppid[pid] = f[2]; st[pid] = f[3]; el[pid] = secs(f[4]); rss[pid] = f[5]; cpu[pid] = f[6]; tty[pid] = f[7]
  c = line; for (i = 1; i <= 7; i++) sub(/^[^ ]+ +/, "", c)
  comm[pid] = c; nm = base(c); name[pid] = nm; pids[++np] = pid
}
END {
  now1 = 86400; now2 = 172800
  for (i = 1; i <= np; i++) { p = pids[i]; alive[p] = 1 }
  print "\n== summary =="
  print "processes\tolder_than_1d\tolder_than_2d\tzombies\ttotal_rss_gb"
  for (i = 1; i <= np; i++) { p = pids[i]; t += rss[p]; if (el[p] > now1) o1++; if (el[p] > now2) o2++; if (st[p] ~ /Z/) z++ }
  printf "%d\t%d\t%d\t%d\t%.1f\n", np, o1, o2, z, t/1048576

  print "\n== by-name (top 30 by memory) =="
  print "name\tcount\trss_mb\tcpu\tolder_1d\tolder_2d\toldest"
  for (i = 1; i <= np; i++) { p = pids[i]; k = name[p]; gc[k]++; gr[k] += rss[p]; gcpu[k] += cpu[p]; if (el[p] > now1) g1[k]++; if (el[p] > now2) g2[k]++; if (el[p] > go[k]) go[k] = el[p] }
  for (k in gc) printf "%s\t%d\t%.0f\t%.1f\t%d\t%d\t%s\n", k, gc[k], gr[k]/1024, gcpu[k], g1[k], g2[k], age(go[k]) | "sort -t\"\t\" -k3,3nr | head -30"
  close("sort -t\"\t\" -k3,3nr | head -30")

  print "\n== apps (Electron/Chromium instances and helpers) =="
  # main_binary: processes running the executable in the app bundle. launched: those started by launchd
  # (macOS) or by something other than the app itself (Linux), which is what a real app
  # instance looks like; Electron apps also run their main binary as a plain node child.
  print "app\tmain_binary\tlaunched\trenderers\trenderers_older_2d\tother_helpers\trss_mb\toldest_launched"
  # Off macOS there is no app bundle: an app is any program that runs --type= children,
  # and its processes without --type= are its main binary.
  for (i = 1; i <= np; i++) { p = pids[i]; if (os != "Darwin" && args[p] ~ /--type=/) chromium[name[p]] = 1 }
  for (i = 1; i <= np; i++) {
    p = pids[i]; a = args[p]
    app = (os == "Darwin") ? appof(comm[p]) : ((name[p] in chromium) ? name[p] : "")
    if (app == "" && os == "Darwin" && a ~ /--type=/) app = name[p]
    if (app == "") continue
    seenapp[app] = 1; ar[app] += rss[p]
    if (a ~ /--type=renderer/) { rr[app]++; if (el[p] > now2) r2[app]++ }
    else if (a ~ /--type=/ || name[p] ~ /Helper/) oh[app]++
    else if (os == "Darwin" ? !index(comm[p], "/" app ".app/Contents/MacOS/") : 0) oh[app]++
    else { mb[app]++
      if (os == "Darwin" ? ppid[p] == 1 : name[ppid[p]] != name[p]) { mi[app]++; if (el[p] > om[app]) om[app] = el[p] } }
  }
  for (k in seenapp) if (rr[k] || mb[k] > 1 || oh[k] > 2) printf "%s\t%d\t%d\t%d\t%d\t%d\t%.0f\t%s\n", k, mb[k], mi[k], rr[k], r2[k], oh[k], ar[k]/1024, (om[k] ? age(om[k]) : "-") | "sort -t\"\t\" -k7,7nr | head -25"
  close("sort -t\"\t\" -k7,7nr | head -25")

  print "\n== fsmonitor (git fsmonitor--daemon) =="
  print "pid\tppid\tage\trss_mb\tstate\tgit_dir\tworktree"
  for (i = 1; i <= np; i++) { p = pids[i]; if (index(args[p], "fsmonitor--daemon run")) {
    nfs++; split((p in fsm) ? fsm[p] : "unknown\t?\t?", r, "\t")
    printf "%s\t%s\t%s\t%.0f\t%s\t%s\t%s\n", p, ppid[p], age(el[p]), rss[p]/1024, r[1], r[2], r[3] } }
  for (i = 1; i <= nf; i++) { split(fsmrows[i], r, "\t"); if (r[1] == "?") printf "?\t?\t?\t?\t%s\t%s\t%s\n", r[2], r[3], r[4] }
  printf "# %d daemons\n", nfs

  print "\n== dev-servers (node, bun, esbuild, vite, tsc and other watchers) =="
  # kind: server when the arguments show a dev server or watcher; runtime for any other
  # node, bun or deno program, which may be a batch job and is never a safe stop.
  print "pid\tppid\tparent\tkind\tage\trss_mb\tcpu\thost_session\thost_agent\tcwd\targs"
  for (i = 1; i <= np; i++) { p = pids[i]; a = args[p]
    if (a ~ /(^|\/)(claude|codex|cursor-agent|gemini|opencode|amp)( |$)/ || a ~ /--type=/ || comm[p] ~ /\.app\//) continue
    server = isserver(a, name[p])
    if (server || name[p] ~ /^(node|bun|deno|esbuild|vite|tsc|tsx|turbo)$/)
      printf "%s\t%s\t%s\t%s\t%s\t%.0f\t%s\t%s\t%s\t%s\t%s\n", p, ppid[p], (ppid[p] == 1 ? "orphaned" : (ppid[p] in alive ? name[ppid[p]] : "gone")), (server ? "server" : "runtime"), age(el[p]), rss[p]/1024, cpu[p], (p in pses ? pses[p] : "-"), (p in ppan ? ppan[p] : "-"), (p in cwd ? cwd[p] : "?"), clean(a) }

  print "\n== agents-and-shells (agent CLIs, and shells older than 1 day or orphaned) =="
  # children: live child processes. A detached shell running a job is not idle.
  print "pid\tppid\tparent\tkind\tage\trss_mb\tcpu\tchildren\ttty\thost_session\thost_agent\tcwd"
  for (i = 1; i <= np; i++) { p = pids[i]; if (st[p] !~ /Z/) kids[ppid[p]]++ }
  for (i = 1; i <= np; i++) { p = pids[i]; a = args[p]; kind = ""
    if (a ~ /(^|\/)(claude|codex|cursor-agent|gemini|opencode|amp)( |$)/) { kind = a; sub(/ .*/, "", kind); kind = base(kind); if (kind ~ /^(node|bun)$/) { kind = a; sub(/^[^ ]+ +/, "", kind); sub(/ .*/, "", kind); kind = base(kind) } }
    else if (name[p] ~ /^-?(zsh|bash|fish|sh|tmux)$/ && (el[p] > now1 || ppid[p] == 1)) kind = name[p]
    if (kind == "") continue
    printf "%s\t%s\t%s\t%s\t%s\t%.0f\t%s\t%d\t%s\t%s\t%s\t%s\n", p, ppid[p], (ppid[p] == 1 ? "orphaned" : (ppid[p] in alive ? name[ppid[p]] : "gone")), kind, age(el[p]), rss[p]/1024, cpu[p], kids[p], tty[p], (p in pses ? pses[p] : "-"), (p in ppan ? ppan[p] : "-"), (p in cwd ? cwd[p] : "?") }

  print "\n== git-in-progress (git commands other than fsmonitor daemons) =="
  print "pid\tage\tcwd\tcommand"
  for (i = 1; i <= np; i++) { p = pids[i]; a = args[p]
    if (a ~ /(^|\/)git( |$)/ && a !~ /fsmonitor--daemon/ && st[p] !~ /Z/) printf "%s\t%s\t%s\t%s\n", p, age(el[p]), (p in cwd ? cwd[p] : "?"), clean(a) }

  print "\n== zombies =="
  print "pid\tppid\tparent\tage"
  for (i = 1; i <= np; i++) { p = pids[i]; if (st[p] ~ /Z/) printf "%s\t%s\t%s\t%s\n", p, ppid[p], name[ppid[p]], age(el[p]) }

  print "\n== indexing (Spotlight, tracker, baloo) =="
  print "name\tcount\tcpu\trss_mb"
  for (i = 1; i <= np; i++) { p = pids[i]; k = name[p]; if (k ~ /^(mds|mds_stores|mdworker.*|corespotlightd|mdsync|mediaanalysisd|photoanalysisd|tracker-miner.*|tracker-extract.*|baloo.*)$/) { xc[k]++; xp[k] += cpu[p]; xr[k] += rss[p] } }
  for (k in xc) printf "%s\t%d\t%.1f\t%.0f\n", k, xc[k], xp[k], xr[k]/1024

  print "\n== top-cpu (15) =="
  print "pid\tname\tcpu\trss_mb\tage"
  for (i = 1; i <= np; i++) { p = pids[i]; printf "%s\t%s\t%s\t%.0f\t%s\n", p, name[p], cpu[p], rss[p]/1024, age(el[p]) | "sort -t\"\t\" -k3,3nr | head -15" }
  close("sort -t\"\t\" -k3,3nr | head -15")
}' "$T/args" "$T/fsm.repo" "$T/cwd" "$T/hostenv" "$T/comm"

if [ "$OS" = Darwin ]; then
  echo
  echo "== spotlight-status =="
  bounded "$BUDGET" mdutil -s / "$HOME" 2>&1 | tr '\n' ' ' | sed 's/  */ /g'; echo
fi
