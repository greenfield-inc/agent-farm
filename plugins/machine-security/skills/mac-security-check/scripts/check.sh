#!/bin/bash
# mac-security-check: read-only security scan of the developer Mac it runs on.
#
# Prints NDJSON, one finding per line, with a stable check id:
#   {"id":"os.filevault","level":"PASS","score":0,"subject":"","detail":"...","fix":"...","key":"...","norm":"..."}
# --text prints LEVEL|AREA|CHECK|DETAIL|FIX instead, most severe first.
# Levels: FAIL (fix now, 10 points), WARN (review, 3 points), INFO, PASS, SKIP (not checked, with the reason).
#
# It never uses sudo, never changes a setting, and never prints a secret value: every string passes
# through one redaction step before it is printed. The only files it writes are its own temp files
# (mktemp, removed on exit) and its baseline under ~/.local/state (skip with --no-save).
# Runs on the macOS system bash (3.2). On other systems the macOS-only checks report SKIP.

# The awk and jq programs below are single-quoted on purpose.
# shellcheck disable=SC2016

set -u
umask 077

MSC_VERSION=1.0.0

usage() {
  cat <<'EOF'
Usage: check.sh [--fast | --deep] [--offline] [--text] [--diff] [--no-save]
                [--role laptop|server] [--roots DIR:DIR...] [--days-unused N] [--budget SECONDS]

  --fast         Default. Usually 10-30 s (60 s budget), no permission prompts, repo roots only.
  --deep         Adds the live Apple update check, login items (asks for Automation access),
                 a home-wide .env and key-file search (may ask for Desktop/Documents/Downloads),
                 deprecated Homebrew packages and Docker disk use. One to several minutes.
  --offline      Skips everything that talks to the network (Apple updates, gh).
  --text         LEVEL|AREA|CHECK|DETAIL|FIX lines instead of NDJSON.
  --diff         Show only what changed since the last run in the same mode: new, resolved, changed.
  --no-save      Don't write this run as the new baseline.
  --role server  For an always-on machine: FileVault off, Remote Login and authorized_keys are INFO.
  --roots        Colon-separated folders that hold your checkouts. Default: ~/repos ~/src ~/code
                 ~/projects ~/dev ~/work ~/git ~/Developer ~/workspace (those that exist).
                 Also MSC_ROOTS. In --fast, roots under Desktop, Documents or Downloads are skipped.
  --days-unused  Apps and checkouts unused this many days are flagged. Default 90.
  --budget       Seconds before remaining sections are skipped. Default 60 (--deep: 900).
  --only         Comma-separated sections to run: os network persistence apps secrets ssh git
                 packages editors agents docker stale cloud. Implies --no-save.

Allowlist: ~/.config/mac-security-check/allow.tsv (or MSC_ALLOWLIST), tab-separated:
  id <TAB> match <TAB> reason <TAB> expires (YYYY-MM-DD)
id and match are globs; match is tested against the finding's subject. A matching FAIL or WARN
is shown as INFO with "accepted" and the reason until the expiry date.

Exit status: 0 no new FAIL since the baseline, 1 new FAIL findings, 2 usage error.
EOF
}

# ---------- helpers ----------

SEP=$(printf '\037')
NL='
'
TAB=$(printf '\t')
have() { command -v "$1" >/dev/null 2>&1; }
IS_MAC=0
[ "$(uname -s)" = Darwin ] && IS_MAC=1

# Run a command with a time limit so one slow command can't hang the scan. Exit 142 means it timed out.
t() {
  local s=$1; shift
  if [ -x /usr/bin/perl ] || have perl; then perl -e 'alarm shift; exec @ARGV or exit 127' "$s" "$@"; else "$@"; fi
}
now_ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time*1000' 2>/dev/null || echo "$(( $(date +%s) * 1000 ))"; }

file_mode() { if [ "$IS_MAC" = 1 ]; then stat -f %Lp "$1" 2>/dev/null; else stat -c %a "$1" 2>/dev/null; fi; }
file_mtime() { if [ "$IS_MAC" = 1 ]; then stat -f %m "$1" 2>/dev/null; else stat -c %Y "$1" 2>/dev/null; fi; }
file_owner() { if [ "$IS_MAC" = 1 ]; then stat -f %Su "$1" 2>/dev/null; else stat -c %U "$1" 2>/dev/null; fi; }
# Days since the file last changed, or empty when unknown.
age_days() { local m; m=$(file_mtime "$1"); [ -n "$m" ] && echo $(( (NOW - m) / 86400 )); }
# True when the mode gives group or others any access.
loose_mode() { local m=${1:-}; [ -n "$m" ] && [ $(( 8#$m & 077 )) -ne 0 ]; }
# Seconds since the epoch for "2026-10-26 17:51:34 +0000" or "2026-10-26T17:51:34Z"; empty when it can't parse.
parse_date() {
  local d=$1
  if [ "$IS_MAC" = 1 ]; then
    date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$d" +%s 2>/dev/null || date -j -f '%Y-%m-%d %H:%M:%S %z' "$d" +%s 2>/dev/null
  else
    date -d "$d" +%s 2>/dev/null
  fi
}

# One finding. Fields are flattened here; redaction, ~ for $HOME, truncation, the allowlist and
# JSON encoding all happen once, in finalize.
emit() { # LEVEL ID SUBJECT DETAIL [FIX]
  local s=${3:-} d=${4:-} f=${5:-}
  s=${s//$NL/ }; d=${d//$NL/ }; f=${f//$NL/ }
  s=${s//$SEP/ }; d=${d//$SEP/ }; f=${f//$SEP/ }
  s=${s//$TAB/ }; d=${d//$TAB/ }; f=${f//$TAB/ }
  printf '%s\037%s\037%s\037%s\037%s\n' "$1" "$2" "$s" "$d" "$f" >> "$REC"
}
mac_only() { [ "$IS_MAC" = 1 ] && return 0; emit SKIP "$1" "" "not macOS"; return 1; }
need() { have "$1" && return 0; emit SKIP "$2" "" "${3:-$1 is not installed}"; return 1; }

# Token shapes, for content checks (grep -E). A boundary is required before sk-.
TOKEN_RE='(^|[^A-Za-z0-9])(sk-ant-[A-Za-z0-9_-]{20,}|sk-(proj-)?[A-Za-z0-9_-]{20,}|gh[opusr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|(AKIA|ASIA)[0-9A-Z]{16}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{30,})|-----BEGIN [A-Z ]*PRIVATE KEY-----'
# A credential-named variable assigned a literal value (not $VAR, $(cmd) or an op:// reference).
SECRET_ASSIGN_RE='^[[:space:]]*(export[[:space:]]+)?[A-Za-z0-9_]*(TOKEN|SECRET|API_?KEY|APIKEY|PASSWORD|PASSWD|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET|CREDENTIALS)[A-Za-z0-9_]*[[:space:]]*=[[:space:]]*["'\'']?[A-Za-z0-9/+_.@:-]{8,}'

# The sed program every printed string goes through.
redact_program() {
  local u=$SEP
  cat <<EOF
s/-----BEGIN [A-Z ]*PRIVATE KEY-----/[REDACTED]/g
s/(^|[^A-Za-z0-9])(sk-ant-|sk-proj-|sk-|gh[opusr]_|github_pat_|glpat-|xox[abprs]-|npm_|hf_|AIza)[A-Za-z0-9_-]{16,}/\1[REDACTED]/g
s/(^|[^A-Za-z0-9])(AKIA|ASIA)[0-9A-Z]{16}/\1[REDACTED]/g
s/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/[REDACTED]/g
s/([Bb][Ee][Aa][Rr][Ee][Rr][ ]+)[^ $u"',;]{8,}/\1[REDACTED]/g
s#(://[^/:@ $u]+:)[^@/ $u]+@#\1[REDACTED]@#g
s/([A-Za-z0-9_-]*([Tt][Oo][Kk][Ee][Nn]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Pp][Aa][Ss][Ss][Ww][Oo]?[Rr]?[Dd]|[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]|[Aa][Uu][Tt][Hh])[A-Za-z0-9_-]*[ ]*=[ ]*["']?)[^ $u"',;&)]{4,}/\1[REDACTED]/g
s/("[A-Za-z0-9_-]*([Tt][Oo][Kk][Ee][Nn]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Pp][Aa][Ss][Ss][Ww][Oo]?[Rr]?[Dd]|[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]|[Aa][Uu][Tt][Hh])[A-Za-z0-9_-]*"[ ]*:[ ]*")[^"$u]{4,}/\1[REDACTED]/g
s/(--?([Tt][Oo][Kk][Ee][Nn]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Aa][Pp][Ii]-?[Kk][Ee][Yy])[ ]+)[^ $u-][^ $u]*/\1[REDACTED]/g
EOF
}

# Strip control characters and non-ASCII bytes, redact token shapes, and shorten $HOME to ~.
# Reads stdin, writes stdout. Tabs and the field separator survive; every other control byte goes.
sanitize() {
  local prog home_re
  prog=$(redact_program)
  if [ -n "${HOME:-}" ] && [ "$HOME" != / ]; then
    home_re=$(printf '%s' "$HOME" | sed 's/[][\\.*^$#/+?(){}|]/\\&/g')
    prog="$prog${NL}s#$home_re(/|$SEP| |\$)#~\\1#g"
  fi
  LC_ALL=C tr -d '\000-\010\013-\036\177' | LC_ALL=C tr '\200-\377' '?' | LC_ALL=C sed -E "$prog"
}

# Turns sanitized records (and the allowlist) into NDJSON: allowlist, scores, truncation, keys.
AWK_FINAL='
BEGIN { FS = sep; for (i = 32; i < 127; i++) ORD[sprintf("%c", i)] = i; n = 0 }
function h(s,   i, x, c) { x = 7; for (i = 1; i <= length(s); i++) { c = substr(s, i, 1); x = (x * 31 + ((c in ORD) ? ORD[c] : 63)) % 2147483629 } return sprintf("%08x", x) }
function esc(s) { gsub(/\\/, "\\\\", s); gsub(/"/, "\\\"", s); return s }
function cut(s, max) { return length(s) > max ? substr(s, 1, max - 3) "..." : s }
function glob2re(g,   r, i, c) { r = "^"; for (i = 1; i <= length(g); i++) { c = substr(g, i, 1); if (c == "*") r = r ".*"; else if (c == "?") r = r "."; else if (index("\\^$.[]|()+{}/", c)) r = r "\\" c; else r = r c } return r "$" }
function record(lvl, id, subj, det, fix, extra,   norm, sc, key) {
  subj = cut(subj, 200); det = cut(det, 400); fix = cut(fix, 300)
  sc = (lvl == "FAIL") ? 10 : (lvl == "WARN") ? 3 : 0
  norm = det; gsub(/[0-9]+/, "#", norm)
  if (id !~ /^meta\.(version|timing)$/) { count[lvl]++; score += sc }
  key = id ":" h(subj); if (++seen[key] > 1) key = key "." seen[key]
  return "{\"id\":\"" esc(id) "\",\"level\":\"" lvl "\",\"score\":" sc ",\"subject\":\"" esc(subj) "\",\"detail\":\"" esc(det) "\",\"fix\":\"" esc(fix) "\",\"key\":\"" esc(key) "\",\"norm\":\"" h(norm) "\"" extra "}"
}
FILENAME == allow {
  if ($0 ~ /^[ \t]*(#|$)/) next
  split($0, a, "\t")
  if (a[1] == "" || a[2] == "" || a[3] == "" || a[4] !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/) {
    late = late record("WARN", "meta.allowlist-invalid", "line " FNR, "allowlist line " FNR " needs id, match, reason and expiry (YYYY-MM-DD), separated by tabs", "Fix or delete that line of the allowlist") "\n"; next
  }
  if (a[4] < today) {
    late = late record("WARN", "meta.allowlist-expired", a[1] " " a[2], "allowlist entry for " a[1] " (" a[2] ") expired on " a[4] ": " a[3], "Check the finding again, then renew the date or delete the line") "\n"; next
  }
  n++; AID[n] = glob2re(a[1]); AM[n] = glob2re(a[2]); AR[n] = a[3]; AE[n] = a[4]; next
}
{
  lvl = $1; id = $2; subj = $3; det = $4; fix = $5; extra = ""
  if (lvl == "FAIL" || lvl == "WARN") for (i = 1; i <= n; i++) if (id ~ AID[i] && subj ~ AM[i]) {
    extra = ",\"accepted\":true,\"was\":\"" lvl "\",\"reason\":\"" esc(cut(AR[i], 200)) "\",\"expires\":\"" AE[i] "\""
    det = det " (accepted until " AE[i] ": " AR[i] ")"; lvl = "INFO"; accepted++; break
  }
  print record(lvl, id, subj, det, fix, extra)
}
END {
  printf "%s", late
  print "{\"id\":\"meta.summary\",\"level\":\"INFO\",\"score\":" score + 0 ",\"subject\":\"\",\"detail\":\"FAIL " count["FAIL"] + 0 ", WARN " count["WARN"] + 0 ", INFO " count["INFO"] + 0 ", PASS " count["PASS"] + 0 ", SKIP " count["SKIP"] + 0 ", accepted " accepted + 0 "; score " score + 0 "; " mode " scan in " elapsed " s\",\"fix\":\"\",\"key\":\"meta.summary\",\"norm\":\"\",\"counts\":{\"FAIL\":" count["FAIL"] + 0 ",\"WARN\":" count["WARN"] + 0 ",\"INFO\":" count["INFO"] + 0 ",\"PASS\":" count["PASS"] + 0 ",\"SKIP\":" count["SKIP"] + 0 ",\"accepted\":" accepted + 0 "},\"total_score\":" score + 0 ",\"mode\":\"" mode "\",\"version\":\"" version "\",\"elapsed_s\":" elapsed "}"
}'

# Reads one field from our own NDJSON lines (fixed shape, escaped strings).
AWK_JF='
function unesc(v) { gsub(/\\\\/, "\001", v); gsub(/\\"/, "\"", v); gsub("\001", "\\", v); return v }
function jf(line, name,   re) {
  re = "\"" name "\":\"([^\"\\\\]|\\\\.)*\""
  if (match(line, re)) return unesc(substr(line, RSTART + length(name) + 4, RLENGTH - length(name) - 5))
  re = "\"" name "\":[-0-9a-z.]+"
  if (match(line, re)) return substr(line, RSTART + length(name) + 3, RLENGTH - length(name) - 3)
  return ""
}'

# Text view: LEVEL|AREA|CHECK|DETAIL|FIX, most severe first, emission order within a level.
AWK_TEXT='
function rank(l) { return l == "FAIL" ? 1 : l == "WARN" ? 2 : l == "INFO" ? 3 : l == "PASS" ? 4 : 5 }
function bar(s) { gsub(/\|/, "/", s); return s }
{
  id = jf($0, "id"); lvl = jf($0, "level"); d = jf($0, "diff")
  if (id == "meta.summary") { summary = jf($0, "detail"); next }
  dot = index(id, "."); area = dot ? substr(id, 1, dot - 1) : id; chk = dot ? substr(id, dot + 1) : ""
  tag = d == "" ? lvl : toupper(d) " " lvl
  if (d == "changed") tag = tag " (was " jf($0, "prev_level") ")"
  r = id == "meta.version" ? 0 : rank(lvl)
  printf "%d\t%06d\t%s|%s|%s|%s|%s\n", r, NR, tag, area, chk, bar(jf($0, "detail")), bar(jf($0, "fix"))
}
END { if (summary != "") printf "9\t999999\tSUMMARY|meta|summary|%s|\n", summary }'

# Diff of the current run (second file) against the baseline (first file), keyed by check id + subject.
# Ages and counts are normalized out of "norm", so "91 days" -> "92 days" is not a change.
AWK_DIFF='
FILENAME == basef { if (jf($0, "id") ~ /^meta\./) next; k = jf($0, "key"); BL[k] = jf($0, "level"); BN[k] = jf($0, "norm"); BLINE[k] = $0; next }
{
  if (jf($0, "id") ~ /^meta\./) next
  k = jf($0, "key"); l = jf($0, "level"); seen[k] = 1; base = substr($0, 1, length($0) - 1)
  if (!(k in BL)) { new++; if (l == "FAIL") newfail++; if (!countonly) print base ",\"diff\":\"new\"}" }
  else if (BL[k] != l || BN[k] != jf($0, "norm")) { changed++; if (l == "FAIL" && BL[k] != "FAIL") newfail++; if (!countonly) print base ",\"diff\":\"changed\",\"prev_level\":\"" BL[k] "\"}" }
}
END {
  for (k in BL) if (!(k in seen)) { resolved++; if (!countonly) print substr(BLINE[k], 1, length(BLINE[k]) - 1) ",\"diff\":\"resolved\"}" }
  if (countonly) print newfail + 0
  else print "{\"id\":\"meta.summary\",\"level\":\"INFO\",\"score\":0,\"subject\":\"\",\"detail\":\"since the last " mode " scan: " new + 0 " new, " resolved + 0 " resolved, " changed + 0 " changed; " newfail + 0 " FAIL not in the baseline\",\"fix\":\"\",\"key\":\"meta.summary\",\"norm\":\"\",\"new\":" new + 0 ",\"new_fail\":" newfail + 0 ",\"resolved\":" resolved + 0 ",\"changed\":" changed + 0 "}"
}'

# ---------- pure classifiers (tested with fixtures in tests/machine-security.test.mjs) ----------

# Apple update label -> "LEVEL id". Command Line Tools and new major versions are kept apart from
# security and point updates, which can't wait.
classify_update() { # LABEL OS_MAJOR
  case $1 in
    *"Command Line Tools"*) echo "WARN os.updates-clt" ;;
    macOS*)
      local v; v=$(printf '%s' "$1" | grep -Eo '[0-9]+(\.[0-9]+)*' | head -1)
      if [ -n "$v" ] && [ -n "${2:-}" ] && [ "${v%%.*}" != "$2" ]; then echo "INFO os.major-upgrade"; else echo "FAIL os.updates"; fi ;;
    *) echo "FAIL os.updates" ;;
  esac
}

# A launch agent or daemon -> "LEVEL<TAB>reasons". Heuristics follow common stealer persistence
# (AMOS-style LaunchDaemons running a hidden or temp-dir binary through a shell or curl).
classify_launch_item() { # PROGRAM ARGS(joined) PLIST_OWNER PLIST_MODE AGE_DAYS SIGNATURE(signed|adhoc|unsigned|unknown) PROGRAM_EXISTS(1|0) SYSTEM_DIR(1|0)
  local prog=$1 args=$2 owner=$3 mode=$4 age=$5 sig=$6 exists=$7 sysdir=$8 level=INFO reasons=""
  add() { reasons="${reasons:+$reasons; }$1"; }
  raise() { case "$1:$level" in FAIL:*) level=FAIL ;; WARN:INFO) level=WARN ;; esac; }
  if [ -z "$prog" ]; then echo "INFO${SEP}no program"; return; fi
  case $prog in
    /tmp/*|/private/tmp/*|/var/tmp/*|/private/var/tmp/*|/Users/Shared/*|"$HOME"/Library/Caches/*|/Library/Caches/*) raise FAIL; add "runs from a temp, shared or cache folder" ;;
  esac
  case $prog in */.*) raise WARN; add "runs from a hidden folder" ;; esac
  case " $args " in
    *" curl "*|*" wget "*|*"/curl "*|*"/wget "*) raise FAIL; add "arguments download with curl or wget" ;;
  esac
  case " $args " in *"base64 -d"*|*"base64 -D"*|*"base64 --decode"*) raise FAIL; add "arguments decode base64" ;; esac
  case " $args " in *"sh -c "*) raise WARN; add "runs a shell command string" ;; esac
  case " $args " in *osascript*) raise WARN; add "runs osascript" ;; esac
  if [ "$exists" = 0 ]; then raise WARN; add "program is missing (orphaned)"; fi
  if [ "$exists" = 1 ]; then
    case "$sig:$prog" in
      unsigned:/System/*|unsigned:/usr/*|unsigned:/bin/*|unsigned:/sbin/*|adhoc:/opt/homebrew/*|adhoc:/usr/local/*) ;;
      unsigned:*) raise WARN; add "program is unsigned" ;;
      adhoc:*) raise WARN; add "program is ad hoc-signed" ;;
    esac
  fi
  if [ "$sysdir" = 1 ] && [ -n "$owner" ] && [ "$owner" != root ]; then raise WARN; add "plist owned by $owner, not root"; fi
  if [ -n "$mode" ] && [ $(( 8#$mode & 022 )) -ne 0 ]; then raise WARN; add "plist is group- or world-writable"; fi
  if [ -n "$age" ] && [ "$age" -lt 14 ]; then raise WARN; add "added or changed $age days ago"; fi
  echo "$level$SEP${reasons:-nothing unusual}"
}

# Shell rc lines that fetch or decode remote content -> "LEVEL<TAB>line" per hit (line numbers only).
AWK_RC='
{
  l = $0; sub(/^[ \t]+/, "", l); if (l ~ /^#/) next
  if (l ~ /(curl|wget)[^|]*\|[ \t]*(sudo[ \t]+)?(ba|z|da|k)?sh([ \t]|$)/ || l ~ /(eval|source|\.)[ \t]+"?\$\((curl|wget)/ || l ~ /(source|\.|bash|sh|zsh)[ \t]+<\([ \t]*(curl|wget)/) { print "FAIL\t" FNR; next }
  if (l ~ /base64[ \t]+(-d|-D|--decode)/ || l ~ /(^|[^A-Za-z0-9_-])(curl|wget)[ \t]/) { print "WARN\t" FNR; next }
  if (l ~ /eval[ \t]+"?\$\(/ || l ~ /source[ \t]+<\(/) print "INFO\t" FNR
}'

# Codex config.toml -> "LEVEL<TAB>code<TAB>detail" lines. A small line-based reader: sections,
# key = value pairs, single- and multi-line arrays, inline tables for env.
AWK_CODEX='
function unq(s) { gsub(/^[ \t]*"|"[ \t]*$/, "", s); return s }
function flush_server() { if (srv != "") print "MCP\t" srv "\t" cmd "\t" args "\t" envsecret; srv = ""; cmd = ""; args = ""; envsecret = 0 }
function secretish(k, v) { return (k ~ /(TOKEN|SECRET|KEY|PASSWORD|PASSWD|AUTH)/ && v !~ /^\$/ && length(v) >= 8) }
BEGIN { home = ENVIRON["HOME"]; ntrusted = 0; ntmp = 0 }
{
  line = $0; sub(/[ \t]+#.*$/, "", line)
  if (pending != "") { pending = pending " " line; if (line !~ /\]/) next; line = pending; pending = "" }
  if (line ~ /^[ \t]*\[/) {
    ns = line; gsub(/^[ \t]*\[+[ \t]*|[ \t]*\]+[ \t]*$/, "", ns); bare = ns; gsub(/"/, "", bare)
    if (srv != "" && bare != "mcp_servers." srv ".env") flush_server()
    section = ns
    if (section ~ /^mcp_servers\.[^.]+$/) { srv = section; sub(/^mcp_servers\./, "", srv); gsub(/"/, "", srv) }
    next
  }
  if (line !~ /=/) next
  key = line; sub(/[ \t]*=.*/, "", key); gsub(/^[ \t]+|"/, "", key); val = line; sub(/^[^=]*=[ \t]*/, "", val)
  if (val ~ /^\[/ && val !~ /\]/) { pending = line; next }
  if (key == "approval_policy" && unq(val) == "never") print "WARN\tapproval-never\t" (section == "" ? "top level" : "[" section "]")
  if (key == "sandbox_mode" && unq(val) == "danger-full-access") print "WARN\tfull-access\t" (section == "" ? "top level" : "[" section "]")
  if (section == "sandbox_workspace_write" && key == "network_access" && val ~ /true/) print "INFO\tnetwork\t[sandbox_workspace_write]"
  if (section ~ /^projects\./ && key == "trust_level" && unq(val) == "trusted") {
    p = section; sub(/^projects\./, "", p); gsub(/^"|"$/, "", p); ntrusted++
    if (p == home || p == home "/" || p == "/" || p == "~" || index(":" roots ":", ":" p ":")) print "WARN\ttrust-broad\t" p
    else if (p ~ /^(\/tmp|\/private\/tmp|\/private\/var\/folders|\/var\/folders)\//) ntmp++
  }
  if (srv != "" && section ~ /^mcp_servers\./) {
    if (section ~ /\.env$/) { if (secretish(key, unq(val))) envsecret++ }
    else if (key == "command") cmd = unq(val)
    else if (key == "args") { a = val; gsub(/^\[|\]$/, "", a); gsub(/"[ \t]*,[ \t]*"/, " ", a); gsub(/"/, "", a); gsub(/^[ \t]+|[ \t,]+$/, "", a); args = a }
    else if (key == "env") { e = val; gsub(/[{}]/, "", e); m = split(e, kv, ","); for (j = 1; j <= m; j++) { split(kv[j], pair, "="); k2 = pair[1]; gsub(/[ \t"]/, "", k2); if (secretish(k2, unq(pair[2]))) envsecret++ } }
  }
}
END { flush_server(); print "INFO\ttrusted-count\t" ntrusted; if (ntmp) print "INFO\ttrusted-tmp\t" ntmp }'

# MCP launch -> pinned | unpinned | local. Unpinned launchers fetch whatever version is newest.
mcp_pin_state() { # COMMAND ARGS(joined)
  local cmd=${1##*/} pkg="" a skip=1 value=0
  case $cmd in
    npx|bunx|pnpx) skip=0 ;;
    pnpm|yarn) case " $2 " in *" dlx "*) skip=0 ;; esac ;;
    npm|bun) case " $2 " in *" exec "*|*" x "*) skip=0 ;; esac ;;
    uvx|pipx) skip=0 ;;
    docker|podman) case " $2 " in *" run "*) skip=0 ;; esac ;;
  esac
  [ "$skip" = 1 ] && { echo local; return; }
  case " $2 " in *"@latest"*|*":latest"*) echo unpinned; return ;; esac
  set -f
  for a in $2; do
    if [ "$value" = 1 ]; then value=0; continue; fi
    if [ "$value" = from ]; then pkg=$a; break; fi
    case $a in
      --from) value=from; continue ;;
      -e|-v|-p|-w|-u|--env|--volume|--publish|--name|--network|--env-file|--mount|--user|--workdir|--entrypoint|--with|--python) value=1; continue ;;
      -*|dlx|exec|x|run) continue ;;
      *=*) continue ;;
    esac
    pkg=$a; break
  done
  set +f
  [ -z "$pkg" ] && { echo unpinned; return; }
  case $cmd in
    uvx|pipx) case $pkg in *==*|*@[0-9]*) echo pinned ;; *) echo unpinned ;; esac ;;
    docker|podman) case $pkg in *@sha256:*|*:[0-9]*) echo pinned ;; *) echo unpinned ;; esac ;;
    *) case $pkg in @*/*@[0-9]*|[!@]*@[0-9]*) echo pinned ;; /*|./*|*.js|*.mjs) echo local ;; *) echo unpinned ;; esac ;;
  esac
}

# jq program over a Claude Code settings file -> "LEVEL<TAB>code<TAB>detail" lines.
JQ_CLAUDE_SETTINGS='
def lit: type == "string" and (startswith("$") | not) and length >= 8;
def tok: type == "string" and test("(sk-|gh[opusr]_|github_pat_|AKIA|xox[abprs]-|AIza|glpat-|npm_)[A-Za-z0-9_-]{16,}");
(if (.permissions.defaultMode? // "") == "bypassPermissions" then "WARN\tbypass\tpermissions.defaultMode is bypassPermissions" else empty end),
(if .skipDangerousModePermissionPrompt? == true then "WARN\tskip-prompt\tskipDangerousModePermissionPrompt is true" else empty end),
(if .enableAllProjectMcpServers? == true then "WARN\tall-project-mcp\tenableAllProjectMcpServers is true: every repo .mcp.json server starts without asking" else empty end),
([(.hooks? // {}) | objects | to_entries[] | .key as $e | (.value | arrays | .[]) | (.hooks? // []) | .[]? | select(((.command? // "") | tostring) | test("(^|[^A-Za-z])(curl|wget)[ ]|\\|[ ]*(ba|z)?sh([ ]|$)|base64 +(-d|--decode)")) | $e] | unique | if length > 0 then "WARN\thook-fetch\thooks that download or pipe to a shell: " + join(", ") else empty end),
([(.env? // {}) | objects | to_entries[] | select((.value | tok) or ((.key | test("TOKEN|SECRET|KEY|PASSWORD"; "i")) and (.value | lit))) | .key] | if length > 0 then "FAIL\tenv-secret\tenv block sets credentials inline: " + join(", ") else empty end),
(if ((.env? // {}) | objects | has("ANTHROPIC_BASE_URL")) then "INFO\tbase-url\tenv sets ANTHROPIC_BASE_URL (requests go to another endpoint)" else empty end),
(if $user then
  ([.permissions.deny[]? | tostring] | join(" ")) as $d |
  (if ($d | test("\\.ssh")) and ($d | test("\\.env")) and ($d | test("\\.aws|gcloud|credentials")) then "PASS\tdeny\tpermissions.deny covers ~/.ssh, .env and cloud credentials" else "INFO\tdeny\tpermissions.deny does not cover all of ~/.ssh, .env and cloud credential files" end),
  (if .sandbox.enabled? == true then (if .sandbox.allowUnsandboxedCommands? == false then "PASS\tsandbox\tsandbox on, no unsandboxed escape hatch" else "INFO\tsandbox\tsandbox on, but allowUnsandboxedCommands is not false" end) else "INFO\tsandbox\tsandbox.enabled is not true" end)
 else empty end)'

# jq program over any MCP config -> "name<TAB>command<TAB>args<TAB>inline-secret-count" per server.
# Handles mcpServers at the top level and under projects.* (~/.claude.json).
JQ_MCP='
def lit: type == "string" and (startswith("$") | not) and length >= 8;
def tok: type == "string" and test("(sk-|gh[opusr]_|github_pat_|AKIA|xox[abprs]-|AIza|glpat-|npm_)[A-Za-z0-9_-]{16,}");
def servers: ((.mcpServers? // {}) | objects | to_entries[]), ((.projects? // {}) | objects | .[] | objects | (.mcpServers? // {}) | objects | to_entries[]);
servers | .value as $s | select($s | type == "object") |
[ .key,
  (($s.command // $s.url // "") | tostring),
  ((($s.args // []) | if type == "array" then map(tostring) | join(" ") else tostring end)),
  ( ([($s.env // {}) | objects | to_entries[] | select((.value | tok) or ((.key | test("TOKEN|SECRET|KEY|PASSWORD"; "i")) and (.value | lit)))] | length)
  + ([($s.headers // {}) | objects | to_entries[] | select((.value | tok) or ((.value | tostring) | test("^Bearer [A-Za-z0-9._-]{12,}")))] | length)
  + ([($s.args // [])[]? | select(tok)] | length) + (if (($s.url // "") | tostring | test("[?&](token|key|api_key)=[^$&]{8,}"; "i")) then 1 else 0 end) | tostring)
] | @tsv'

# ---------- check sections ----------

check_os() {
  mac_only os.version || return 0
  local v b sup=/Library/Preferences/com.apple.SoftwareUpdate.plist k val fv out
  v=$(sw_vers -productVersion 2>/dev/null); b=$(sw_vers -buildVersion 2>/dev/null)
  OS_MAJOR=${v%%.*}
  emit INFO os.version "" "macOS $v ($b)"

  if [ "$MODE" = deep ] && [ "$OFFLINE" = 0 ]; then updates_live; else updates_cached "$sup"; fi

  for k in AutomaticCheckEnabled AutomaticDownload CriticalUpdateInstall ConfigDataInstall; do
    val=$(plutil -extract "$k" raw -o - "$sup" 2>/dev/null)
    case $val in
      false|0) if [ "$k" = CriticalUpdateInstall ] || [ "$k" = ConfigDataInstall ]; then
                 emit FAIL "os.auto-update" "$k" "$k is off" "System Settings > General > Software Update > Automatic Updates: turn on Install Security Responses and system files"
               else emit WARN "os.auto-update" "$k" "$k is off" "System Settings > General > Software Update > Automatic Updates"; fi ;;
      true|1) emit PASS "os.auto-update" "$k" "$k is on" ;;
      *) emit INFO "os.auto-update" "$k" "$k is not set (the macOS default, on, applies)" ;;
    esac
  done

  fv=$(fdesetup status 2>/dev/null)
  case $fv in
    *"FileVault is On"*) emit PASS os.filevault "" "FileVault is on" ;;
    *) if [ "$ROLE" = server ]; then emit INFO os.filevault "" "FileVault is not on (${fv:-unknown}); allowed for --role server" "Record why in the allowlist; keep the machine physically secure"
       else emit FAIL os.filevault "" "FileVault is not on (${fv:-unknown})" "System Settings > Privacy & Security > FileVault: turn it on and keep the recovery key off this Mac"; fi ;;
  esac
  if csrutil status 2>/dev/null | grep -q 'status: enabled'; then emit PASS os.sip "" "System Integrity Protection is on"
  else emit FAIL os.sip "" "System Integrity Protection is not fully on" "Start up in Recovery and run: csrutil enable"; fi
  if spctl --status 2>/dev/null | grep -q 'assessments enabled'; then emit PASS os.gatekeeper "" "Gatekeeper is on"
  else emit FAIL os.gatekeeper "" "Gatekeeper is off" "Run yourself: sudo spctl --global-enable"; fi

  out=$(sysadminctl -screenLock status 2>&1 | grep -i 'screenLock' | tail -1)
  case $out in
    *immediate*) emit PASS os.screen-lock "" "Password required immediately after sleep or screen saver" ;;
    *"is off"*) if [ "$ROLE" = server ]; then emit INFO os.screen-lock "" "Screen lock is off (role server)"
                else emit FAIL os.screen-lock "" "Screen lock is off" "System Settings > Lock Screen: require password immediately"; fi ;;
    *delay\ is\ [0-9]*)
      k=$(printf '%s' "$out" | grep -Eo 'delay is [0-9]+' | grep -Eo '[0-9]+')
      if [ "${k:-999}" -le 60 ]; then emit PASS os.screen-lock "" "Password required ${k} s after sleep"
      else emit WARN os.screen-lock "" "Password required only ${k} s after sleep" "System Settings > Lock Screen: require password immediately"; fi ;;
    *) emit SKIP os.screen-lock "" "could not read sysadminctl -screenLock status" ;;
  esac

  val=$(plutil -extract CFBundleShortVersionString raw -o - /Library/Apple/System/Library/CoreServices/XProtect.bundle/Contents/Info.plist 2>/dev/null)
  if [ -n "$val" ]; then emit INFO os.xprotect "" "XProtect definitions version $val" "Updated by Install Security Responses and system files"
  else emit SKIP os.xprotect "" "XProtect version not found"; fi

  out=$(t 10 profiles list 2>&1)
  case $out in
    *"no configuration profiles"*) emit PASS os.config-profiles "" "No user-level configuration profiles (device-level ones need: sudo profiles list)" ;;
    *profileIdentifier*) k=$(printf '%s\n' "$out" | grep -c profileIdentifier)
      emit WARN os.config-profiles "" "$k user-level configuration profile(s) installed; device-level ones need sudo profiles list" "System Settings > General > Device Management: make sure each one is expected" ;;
    *) emit SKIP os.config-profiles "" "could not read profiles list" ;;
  esac

  out=$(security show-keychain-info "$HOME/Library/Keychains/login.keychain-db" 2>&1)
  case $out in
    *no-timeout*) emit INFO os.keychain-autolock "" "login keychain has no auto-lock timeout (the macOS default)" "Optional: Keychain Access > login > Change Settings: lock after a period of inactivity" ;;
    *timeout=*) emit PASS os.keychain-autolock "" "login keychain locks after $(printf '%s' "$out" | grep -Eo 'timeout=[0-9]+s')" ;;
    *) emit SKIP os.keychain-autolock "" "could not read the login keychain settings" ;;
  esac
}

updates_cached() {
  local sup=$1 n i name ver last ts
  if [ ! -r "$sup" ]; then emit SKIP os.updates "" "cannot read the Software Update preferences"; return; fi
  last=$(plutil -extract LastFullSuccessfulDate raw -o - "$sup" 2>/dev/null)
  ts=""; [ -n "$last" ] && ts=$(parse_date "$last")
  n=$(plutil -extract RecommendedUpdates raw -o - "$sup" 2>/dev/null)
  case $n in ''|*[!0-9]*) emit SKIP os.updates "" "no cached update list; run with --deep for a live check"; return ;; esac
  if [ -n "$ts" ] && [ $(( (NOW - ts) / 86400 )) -gt 14 ]; then
    emit WARN os.updates-check-stale "" "The last successful update check was $(( (NOW - ts) / 86400 )) days ago" "System Settings > General > Software Update, or run with --deep"
  fi
  if [ "$n" = 0 ]; then
    emit PASS os.updates "" "No pending updates as of the last automatic check${last:+ ($last)}; --deep checks live"
    return
  fi
  i=0
  while [ "$i" -lt "$n" ]; do
    name=$(plutil -extract "RecommendedUpdates.$i.Display Name" raw -o - "$sup" 2>/dev/null)
    [ -z "$name" ] && name=$(plutil -extract "RecommendedUpdates.$i.Identifier" raw -o - "$sup" 2>/dev/null)
    ver=$(plutil -extract "RecommendedUpdates.$i.Display Version" raw -o - "$sup" 2>/dev/null)
    case "${name:-}" in *"$ver"*) ;; *) name="${name:-update} $ver" ;; esac
    emit_update "${name:-update $i}" "per the last automatic check"
    i=$((i + 1))
  done
}

emit_update() { # LABEL SOURCE
  local lvl id
  lvl=$(classify_update "$1" "${OS_MAJOR:-}"); id=${lvl#* }; lvl=${lvl%% *}
  case $id in
    os.major-upgrade) emit INFO "$id" "$1" "Available ($2): $1" "Optional: upgrade once it has a point release and your tools support it" ;;
    os.updates-clt) emit WARN "$id" "$1" "Pending ($2): $1" "System Settings > General > Software Update, or softwareupdate -i with that label" ;;
    *) emit "$lvl" "$id" "$1" "Pending ($2): $1" "System Settings > General > Software Update" ;;
  esac
}

updates_live() {
  local out rc lbl
  out=$(t 120 softwareupdate -l 2>&1); rc=$?
  if [ "$rc" = 142 ]; then emit SKIP os.updates "" "softwareupdate -l timed out after 120 s"; return; fi
  if printf '%s' "$out" | grep -q 'No new software available'; then emit PASS os.updates "" "No pending Apple updates (live check)"; return; fi
  if ! printf '%s' "$out" | grep -q 'Label:'; then emit SKIP os.updates "" "could not read softwareupdate -l output"; return; fi
  printf '%s\n' "$out" | sed -n 's/.*Label: //p' > "$TMP/labels"
  while IFS= read -r lbl; do emit_update "$lbl" "live check"; done < "$TMP/labels"
}

check_network() {
  mac_only network.firewall || return 0
  local fw=/usr/libexec/ApplicationFirewall/socketfilterfw out p name port lsof_out ports proc
  out=$($fw --getglobalstate 2>/dev/null)
  case $out in
    *"State = 1"*|*"State = 2"*) emit PASS network.firewall "" "Application firewall is on" ;;
    *"State = 0"*|*disabled*) emit FAIL network.firewall "" "Application firewall is off" "Run yourself: sudo $fw --setglobalstate on" ;;
    *) emit SKIP network.firewall "" "could not read the firewall state" ;;
  esac
  if $fw --getstealthmode 2>/dev/null | grep -qi 'is on\|enabled'; then emit PASS network.stealth "" "Stealth mode is on"
  else emit WARN network.stealth "" "Stealth mode is off" "Run yourself: sudo $fw --setstealthmode on"; fi

  # Sharing services run as root, so a non-root lsof can't see them; probe the ports instead.
  for p in 22:remote-login:"Remote Login" 5900:screen-sharing:"Screen Sharing" 445:file-sharing:"File Sharing" 3283:remote-management:"Remote Management"; do
    port=${p%%:*}; name=${p#*:}; name=${name%%:*}
    if t 3 nc -z -G 1 -w 1 127.0.0.1 "$port" >/dev/null 2>&1; then
      if [ "$ROLE" = server ] && [ "$name" = remote-login ]; then emit INFO "sharing.$name" "" "${p##*:} is on (port $port); expected for --role server"
      else emit WARN "sharing.$name" "" "${p##*:} is on (port $port answers)" "System Settings > General > Sharing: turn it off unless you use it"; fi
    else emit PASS "sharing.$name" "" "${p##*:} is off"; fi
  done

  lsof_out=$(t 10 lsof -nP +c 0 -iTCP -sTCP:LISTEN 2>/dev/null)
  if printf '%s\n' "$lsof_out" | awk '$1 == "ControlCenter" && ($9 ~ /:7000$/ || $9 ~ /:5000$/) {f=1} END {exit !f}'; then
    emit WARN sharing.airplay-receiver "" "AirPlay Receiver is on (ControlCenter listens on 5000/7000)" "System Settings > General > AirDrop & Handoff: turn off AirPlay Receiver unless you use it"
  else emit PASS sharing.airplay-receiver "" "AirPlay Receiver is not listening"; fi

  out=$(defaults read com.apple.sharingd DiscoverableMode 2>/dev/null)
  emit INFO sharing.airdrop "" "AirDrop DiscoverableMode: ${out:-not set}" "Control Center > AirDrop: Contacts Only or Receiving Off"

  # Every TCP port listening on all interfaces, named by process where lsof can see it.
  ports=$(netstat -an -p tcp 2>/dev/null | awk '$NF == "LISTEN" && ($4 ~ /^\*\./ || $4 ~ /^0\.0\.0\.0\./) { n = split($4, a, "."); print a[n] }' | sort -un)
  for port in $ports; do
    case $port in 22|445|5900|3283|5000|7000) continue ;; esac
    proc=$(printf '%s\n' "$lsof_out" | awk -v p="$port" 'NR > 1 && ($9 == "*:" p || $9 == "0.0.0.0:" p || $9 == "[::]:" p) {print $1; exit}')
    if [ -z "$proc" ]; then
      emit INFO network.listening-all "port-$( [ "$port" -ge 49152 ] && echo ephemeral || echo "$port")" "Port $port listens on all interfaces; its owner is not visible without sudo" "Check it yourself: sudo lsof -nP -iTCP:$port -sTCP:LISTEN"
    else
      case $proc in
        ControlCenter|rapportd|sharingd|mDNSResponder|launchd|remoted|identityservicesd|CommCenter|AirPlayXPCHelper)
          emit INFO network.listening-all "$proc" "$proc (macOS) listens on all interfaces, port $port" ;;
        *) emit WARN network.listening-all "$proc" "$proc listens on all interfaces, port $port" "Bind dev servers to 127.0.0.1, or stop the process if unused" ;;
      esac
    fi
  done
  out=$(printf '%s\n' "$lsof_out" | awk 'NR > 1 && ($9 ~ /^127\.0\.0\.1:/ || $9 ~ /^\[::1\]:/) {print $1}' | sort -u | wc -l | tr -d ' ')
  emit INFO network.listening-localhost "" "$out process name(s) listen on localhost only"

  for p in ngrok cloudflared frpc bore localtunnel zrok; do
    pgrep -x "$p" >/dev/null 2>&1 && emit INFO network.tunnel "$p" "$p is running" "Make sure every tunnel is one you still need"
  done
  if have tailscale; then
    out=$(t 5 tailscale serve status 2>/dev/null)
    if printf '%s' "$out" | grep -q '://'; then
      ports=$(printf '%s\n' "$out" | grep -Eo '://[^ /]+:[0-9]+' | grep -Eo '[0-9]+$' | sort -un | tr '\n' ' ')
      emit WARN network.tailscale-serve "" "Tailscale Serve exposes local services to your tailnet (port ${ports% })" "tailscale serve status; turn off what you don't need, or limit it with ACLs"
    else emit PASS network.tailscale-serve "" "Tailscale Serve exposes nothing"; fi
    if t 5 tailscale funnel status 2>/dev/null | grep -qi 'funnel on'; then
      emit FAIL network.tailscale-funnel "" "Tailscale Funnel exposes a local service to the internet" "tailscale funnel status; turn it off unless you mean it"
    fi
  fi
}

check_persistence() {
  rc_checks
  mac_only persistence.launch-item || return 0
  local d f prog args owner mode age sig exists sysdir res lvl why items
  for d in "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons; do
    [ -d "$d" ] || continue
    sysdir=1; [ "$d" = "$HOME/Library/LaunchAgents" ] && sysdir=0
    for f in "$d"/*.plist "$d"/.[!.]*.plist; do
      [ -f "$f" ] || continue
      prog=$(plutil -extract Program raw -o - "$f" 2>/dev/null)
      [ -z "$prog" ] && prog=$(plutil -extract ProgramArguments.0 raw -o - "$f" 2>/dev/null)
      args=$(plutil -extract ProgramArguments json -o - "$f" 2>/dev/null | json_array_words)
      owner=$(file_owner "$f"); mode=$(file_mode "$f"); age=$(age_days "$f")
      exists=0; [ -n "$prog" ] && [ -e "$prog" ] && exists=1
      sig=unknown
      if [ "$exists" = 1 ] && [ -f "$prog" ]; then sig=$(signature_of "$prog"); fi
      res=$(classify_launch_item "$prog" "$args" "$owner" "$mode" "$age" "$sig" "$exists" "$sysdir")
      lvl=${res%%"$SEP"*}; why=${res#*"$SEP"}
      emit "$lvl" persistence.launch-item "$f" "$f runs ${prog:-nothing} ($why)" "Show the plist and its signature first; if unwanted: launchctl bootout, then move the plist to the Trash"
    done
  done

  if [ "$MODE" = deep ]; then
    if items=$(t 15 osascript -e 'set out to ""' -e 'tell application "System Events" to repeat with i in login items' -e 'set out to out & (name of i) & tab & (path of i) & linefeed' -e 'end repeat' -e 'return out' 2>/dev/null); then
      printf '%s\n' "$items" | while IFS="$(printf '\t')" read -r name p; do
        [ -z "$name" ] && continue
        case $p in
          "missing value"|"") emit WARN persistence.login-item "$name" "Login item $name points at an app that no longer exists" "System Settings > General > Login Items & Extensions: remove it" ;;
          */worktrees/*|*/node_modules/*|/tmp/*|/private/tmp/*|*/Downloads/*|*/DerivedData/*) emit WARN persistence.login-item "$name" "Login item $name runs from $p" "A dev build or download runs at every login: remove it and add the installed app instead" ;;
          *) emit INFO persistence.login-item "$name" "Login item $name ($p)" "Remove what you don't need" ;;
        esac
      done
    else emit SKIP persistence.login-item "" "System Events did not answer (Automation permission denied or timed out)"; fi
  else
    emit SKIP persistence.login-item "" "needs --deep (reading login items asks for Automation permission)"
  fi

  if have systemextensionsctl; then
    systemextensionsctl list 2>/dev/null | awk -F'\t' '/\[activated/ || /waiting to uninstall/ { b = $4; sub(/ \(.*$/, "", b); print $5 "\t" b "\t" $NF }' > "$TMP/sysext"
    while IFS="$(printf '\t')" read -r name b st; do
      emit INFO persistence.system-extension "$b $st" "System extension $name ($b) $st" "System Settings > General > Login Items & Extensions: remove what you don't use"
    done < "$TMP/sysext"
  fi

  # Recently dropped executables in world-writable places.
  find /private/tmp /private/var/tmp /Users/Shared -maxdepth 2 -type f -perm -100 -mtime -14 2>/dev/null > "$TMP/drops"
  local n; n=$(wc -l < "$TMP/drops" | tr -d ' ')
  head -10 "$TMP/drops" | while IFS= read -r f; do
    emit WARN persistence.recent-executable "$f" "Executable added in the last 14 days: $f" "Check what created it (codesign -dv, xattr -l for the download source); move it to the Trash if unknown"
  done
  [ "$n" -gt 10 ] && emit INFO persistence.recent-executable "more" "$((n - 10)) more recent executables in /tmp, /var/tmp and /Users/Shared"
  return 0
}

# JSON array of strings -> space-joined words (jq when present, else a plain strip).
json_array_words() {
  if have jq; then jq -r 'if type == "array" then map(tostring) | join(" ") else empty end' 2>/dev/null
  else tr -d '[]"\n' | sed 's/,/ /g; s/  */ /g; s/^ //'; fi
}
signature_of() {
  local s; s=$(t 5 codesign -dv "$1" 2>&1)
  case $s in
    *"not signed at all"*) echo unsigned ;;
    *Signature=adhoc*) echo adhoc ;;
    *"Signature size"*|*Authority=*|*TeamIdentifier=*) echo signed ;;
    *) echo unknown ;;
  esac
}

RC_FILES=".zshrc .zprofile .zshenv .zlogin .bashrc .bash_profile .profile .config/fish/config.fish"
rc_checks() {
  local rel f hits lvl lines age
  for rel in $RC_FILES; do
    f="$HOME/$rel"; [ -f "$f" ] || continue
    hits=$(awk "$AWK_RC" "$f" 2>/dev/null)
    for lvl in FAIL WARN INFO; do
      lines=$(printf '%s\n' "$hits" | awk -F'\t' -v l="$lvl" '$1 == l {print $2}' | tr '\n' ',' | sed 's/,$//')
      [ -z "$lines" ] && continue
      case $lvl in
        FAIL) emit FAIL persistence.rc-fetch "$f" "$f line(s) $lines download and run remote code at every shell start" "Look at those lines; remove them unless you wrote them, and rotate anything that shell could reach" ;;
        WARN) emit WARN persistence.rc-fetch "$f" "$f line(s) $lines use curl, wget or base64 decoding" "Make sure you wrote each one and know where it fetches from" ;;
        INFO) emit INFO persistence.rc-eval "$f" "$f line(s) $lines eval command output (usually tool setup such as brew shellenv)" ;;
      esac
    done
    age=$(age_days "$f")
    [ -n "$age" ] && [ "$age" -lt 7 ] && emit INFO persistence.rc-changed "$f" "$f changed $age days ago" "If you didn't change it, compare it with a backup"
  done
}

check_apps() {
  mac_only apps.unused || return 0
  local app lu ts age nodate=0 bad=0 list="$TMP/apps"
  : > "$list"
  for app in /Applications/*.app "$HOME/Applications"/*.app; do
    [ -d "$app" ] || continue
    case $app in /Applications/Safari.app) continue ;; esac
    printf '%s\n' "$app" >> "$list"
  done
  [ -s "$list" ] || { emit SKIP apps.unused "" "no apps found"; return; }
  # One mdls call for all apps; it separates values with NUL.
  tr '\n' '\0' < "$list" | xargs -0 mdls -raw -name kMDItemLastUsedDate 2>/dev/null | tr '\0' '\n' > "$TMP/lastused"
  if [ "$(wc -l < "$TMP/lastused")" -lt "$(($(wc -l < "$list") - 1))" ]; then emit SKIP apps.unused "" "mdls output did not line up with the app list"; return; fi
  paste -d "$SEP" "$list" "$TMP/lastused" | while IFS="$SEP" read -r app lu; do
    case $lu in "(null)"|"") echo nodate; continue ;; esac
    ts=$(parse_date "$lu")
    [ -z "$ts" ] && { echo bad; continue; }
    age=$(( (NOW - ts) / 86400 ))
    [ "$age" -ge "$DAYS_UNUSED" ] && emit WARN apps.unused "$app" "$app was last opened $age days ago" "Delete it if unused, especially VPNs, remote-access tools and apps with helpers or login items"
  done > "$TMP/appstat"
  nodate=$(grep -c nodate "$TMP/appstat"); bad=$(grep -c bad "$TMP/appstat")
  [ "$nodate" -gt 0 ] && emit INFO apps.no-last-used "" "$nodate app(s) have no last-opened date in Spotlight (never opened, or not indexed)" "Delete any you don't recognise"
  [ "$bad" -gt 0 ] && emit SKIP apps.unused "unparsed" "$bad app date(s) could not be parsed"
  return 0
}

# A .env-style file holds credentials when it assigns a literal to a credential-named variable or contains a token shape.
holds_env_creds() { LC_ALL=C grep -E "$SECRET_ASSIGN_RE" "$1" 2>/dev/null | grep -vq 'op://' || LC_ALL=C grep -Eq "$TOKEN_RE" "$1" 2>/dev/null; }

PRUNE_NAMES="node_modules .git .hg vendor .venv venv .tox .cache .cargo .rustup .nvm .pnpm-store .npm .yarn .gradle .m2 Pods DerivedData .next .turbo dist build target __pycache__ .terraform"
# find(1) arguments that prune the folders above.
prune_args() { local n first=1; printf '( '; for n in $PRUNE_NAMES; do [ $first = 1 ] || printf -- '-o '; printf -- '-name %s ' "$n"; first=0; done; printf ') -prune -o'; }

check_secrets() {
  local f n lines rel
  for rel in $RC_FILES; do
    f="$HOME/$rel"; [ -f "$f" ] || continue
    lines=$( { LC_ALL=C grep -nE "$TOKEN_RE" "$f"; LC_ALL=C grep -nE "$SECRET_ASSIGN_RE" "$f" | grep -v 'op://'; } 2>/dev/null | cut -d: -f1 | sort -un | tr '\n' ',' | sed 's/,$//')
    [ -n "$lines" ] && emit FAIL secrets.dotfile "$f" "$f line(s) $lines look like inline secrets" "Load them at runtime instead (op read, op run, security find-generic-password -w), then rotate them"
  done
  for f in "$HOME/.zsh_history" "$HOME/.bash_history" "$HOME/.local/share/fish/fish_history" "$HOME/.python_history" "$HOME/.node_repl_history" "$HOME/.psql_history" "$HOME/.mysql_history" "$HOME/.sqlite_history" "$HOME/.irb_history"; do
    [ -f "$f" ] || continue
    n=$(LC_ALL=C grep -Eac "$TOKEN_RE" "$f" 2>/dev/null)
    if [ "${n:-0}" -gt 0 ]; then
      lines=$(LC_ALL=C grep -Ean "$TOKEN_RE" "$f" 2>/dev/null | cut -d: -f1 | head -10 | tr '\n' ',' | sed 's/,$//')
      emit FAIL secrets.shell-history "$f" "$f has $n line(s) with token-like strings (lines $lines${n:+$( [ "$n" -gt 10 ] && echo ', ...')})" "Rotate those tokens first. Then delete the lines in an editor with history off, or ask before removing the file"
    fi
  done

  f="$HOME/.aws/credentials"
  if [ -f "$f" ]; then
    n=$(grep -c 'aws_access_key_id' "$f" 2>/dev/null)
    [ "${n:-0}" -gt 0 ] && emit FAIL secrets.aws-static-keys "$f" "$f holds $n long-lived access key(s)" "Switch to IAM Identity Center (aws configure sso), then deactivate and delete the keys"
    cred_perm "$f"
  fi
  f="$HOME/.netrc"; [ -f "$f" ] && grep -qE '(^|[[:space:]])password[[:space:]]' "$f" && { emit WARN secrets.netrc "$f" "$f holds password(s)" "Use a credential helper or keychain instead"; cred_perm "$f"; }
  f="$HOME/.npmrc"; [ -f "$f" ] && grep -Eq '(_authToken|_auth|_password)[[:space:]]*=[[:space:]]*[^$[:space:]]' "$f" && { emit WARN secrets.npm-token "$f" "$f holds a literal npm credential" "Use a short-lived granular token from the environment (\${NPM_TOKEN}), or npm logout when not publishing"; cred_perm "$f"; }
  f="$HOME/.pypirc"; [ -f "$f" ] && grep -qiE '^[[:space:]]*password[[:space:]]*[=:]' "$f" && { emit WARN secrets.pypi-token "$f" "$f holds a credential" "Use trusted publishing or keyring"; cred_perm "$f"; }
  f="$HOME/.docker/config.json"; [ -f "$f" ] && grep -Eq '"auth"[[:space:]]*:[[:space:]]*"[^"]+' "$f" && { emit WARN secrets.docker-auth "$f" "$f stores registry logins inline" "Set \"credsStore\": \"osxkeychain\" and log in again"; cred_perm "$f"; }
  f="$HOME/.config/gh/hosts.yml"; [ -f "$f" ] && grep -q 'oauth_token:' "$f" && { emit WARN secrets.gh-plaintext "$f" "$f stores the GitHub CLI login in plain text" "gh auth logout, then gh auth login (it uses the keychain by default)"; cred_perm "$f"; }
  f="$HOME/.kube/config"; [ -f "$f" ] && grep -Eq '^[[:space:]]*(token|client-key-data|password):' "$f" && cred_perm "$f"
  for f in "$HOME/.config/gcloud/credentials.db" "$HOME/.config/gcloud/application_default_credentials.json" "$HOME/.config/gcloud/access_tokens.db"; do [ -f "$f" ] && cred_perm "$f"; done
  f="$HOME/.config/stripe/config.toml"; [ -f "$f" ] && grep -q 'live_mode_api_key' "$f" && emit WARN secrets.stripe-live "$f" "The Stripe CLI holds live-mode keys" "stripe logout --all, or stay in test mode locally"

  env_files
  sa_keys
  if [ "$MODE" = deep ]; then signing_material; else emit SKIP secrets.signing-material "" "needs --deep (searches Desktop, Documents and Downloads)"; fi
  if have gitleaks; then emit INFO secrets.gitleaks "" "gitleaks is installed; the skill can run a scoped, redacted deep scan with your OK"
  else emit INFO secrets.gitleaks "" "Optional deeper scan: brew install gitleaks"; fi
}

# FAIL when a file that holds credentials is readable by anyone else.
cred_perm() {
  local m; m=$(file_mode "$1")
  loose_mode "$m" && emit FAIL secrets.file-permissions "$1" "$1 holds credentials and is mode $m" "chmod 600 '$1'"
  return 0
}

# Folders to search: the existing repo roots in --fast, the whole home folder in --deep.
search_dirs() {
  local r
  if [ "$MODE" = deep ]; then printf '%s\n' "$HOME"; return; fi
  printf '%s\n' "$ROOTS" | tr ':' '\n' | while IFS= read -r r; do
    [ -n "$r" ] && [ -d "$r" ] || continue
    case "$r/" in
      "$HOME"/Desktop/*|"$HOME"/Documents/*|"$HOME"/Downloads/*|"$HOME"/Library/*|"$HOME"/Pictures/*|"$HOME"/Movies/*|"$HOME"/Music/*)
        echo "SKIP $r" ;;
      *) printf '%s\n' "$r" ;;
    esac
  done
}

env_files() {
  local dirs d f n m list="$TMP/envfiles" top
  dirs=$(search_dirs)
  printf '%s\n' "$dirs" | grep '^SKIP ' | while IFS= read -r d; do emit SKIP secrets.env-files "${d#SKIP }" "${d#SKIP } is under a privacy-protected folder; --deep searches it"; done
  dirs=$(printf '%s\n' "$dirs" | grep -v '^SKIP ' | grep .)
  if [ -z "$dirs" ]; then emit SKIP secrets.env-files "" "no repo roots found (set --roots or MSC_ROOTS); --deep searches the whole home folder"; return; fi
  : > "$list"
  printf '%s\n' "$dirs" | while IFS= read -r d; do
    # shellcheck disable=SC2046
    find "$d" -maxdepth 6 \( -path "$HOME/Library" -o -path "$HOME/.Trash" \) -prune -o $(prune_args) -type f \( -name '.env' -o -name '.env.*' -o -name '*.env' -o -name '*.env.bak*' \) -print0 2>/dev/null
  done | while IFS= read -r -d '' f; do
    case $f in *.example|*.sample|*.template|*.dist|*.defaults|*.schema) continue ;; esac
    holds_env_creds "$f" && printf '%s\n' "$f"
  done > "$list"
  n=$(grep -c . "$list")
  if [ "$n" = 0 ]; then emit PASS secrets.env-files "" "No .env files with credentials in $(printf '%s' "$dirs" | tr '\n' ' ')"; return; fi
  emit WARN secrets.env-files "" "$n .env file(s) hold credentials under $(printf '%s' "$dirs" | tr '\n' ' ')" "Delete those in stale clones and worktrees; load secrets at runtime (op run) where you can"
  # Count per folder two levels under the search root.
  printf '%s\n' "$dirs" | while IFS= read -r d; do
    grep -F "$d/" "$list" | sed "s#^$(printf '%s' "$d" | sed 's/[][\\.*^$#]/\\&/g')/##" | awk -F/ -v d="$d" 'NF > 2 {print d "/" $1 "/" $2; next} {print d "/" $1}'
  done | sort | uniq -c | sort -rn | head -15 | while read -r m top; do
    emit INFO secrets.env-files-by-folder "$top" "$top: $m .env file(s) with credentials"
  done
  while IFS= read -r f; do
    case ${f##*/} in
      *.bak*|*backup*|*.old|*.orig|*~) emit FAIL secrets.env-backup "$f" "Backup of a .env file with credentials: $f" "Make sure the values are rotated, then move it to the Trash" ;;
    esac
    m=$(file_mode "$f")
    loose_mode "$m" && emit WARN secrets.env-permissions "$f" "$f is mode $m" "chmod 600 '$f'"
  done < "$list"
}

sa_keys() {
  local dirs d list="$TMP/sakeys" n u
  dirs=$(search_dirs | grep -v '^SKIP ' | grep .)
  [ "$MODE" = deep ] || [ -n "$dirs" ] || { emit SKIP secrets.gcp-sa-keys "" "no repo roots found"; return; }
  printf '%s\n' "$dirs" | while IFS= read -r d; do
    # shellcheck disable=SC2046
    find "$d" -maxdepth 8 \( -path "$HOME/Library" -o -path "$HOME/.Trash" \) -prune -o $(prune_args) -type f -name '*.json' -size -20k -print0 2>/dev/null
  done | xargs -0 grep -l '"type": *"service_account"' /dev/null 2>/dev/null | xargs grep -l '"private_key"' /dev/null 2>/dev/null > "$list"
  n=$(grep -c . "$list")
  [ "$n" = 0 ] && { emit PASS secrets.gcp-sa-keys "" "No Google service-account key files found"; return; }
  # Count distinct keys without printing anything derived from them.
  u=$(tr '\n' '\0' < "$list" | xargs -0 cat 2>/dev/null | grep -o '"private_key_id": *"[^"]*"' | sort -u | wc -l | tr -d ' ')
  emit FAIL secrets.gcp-sa-keys "" "$n Google service-account key file(s) on disk ($u distinct keys), e.g. $(head -2 "$list" | tr '\n' ' ')" "Rotate the keys in IAM, delete the copies (stale worktrees first), use gcloud user sign-in or workload identity"
}

signing_material() {
  local d f c=0
  for d in "$HOME/Documents" "$HOME/Downloads" "$HOME/Desktop"; do
    [ -d "$d" ] || continue
    find "$d" -maxdepth 4 -type f \( -name '*.p12' -o -name '*.pfx' -o -name '*.jks' -o -name '*.keystore' -o -name '*.p8' -o -name '*.pem' -o -name '*.key' \) -print0 2>/dev/null
  done | while IFS= read -r -d '' f; do
    case $f in *.pem|*.key) grep -q 'PRIVATE KEY' "$f" 2>/dev/null || continue ;; esac
    c=$((c + 1)); [ "$c" -gt 20 ] && break
    emit WARN secrets.signing-material "$f" "Signing key or certificate bundle: $f" "Move it into your password manager and move the loose copy to the Trash"
  done
}

check_ssh() {
  local f out m n lines rc
  if [ -d "$HOME/.ssh" ]; then
    for f in "$HOME"/.ssh/* "$HOME"/.ssh/.[!.]*; do
      [ -f "$f" ] || continue
      case $f in *.pub|*/known_hosts*|*/authorized_keys*|*/config|*.sock) continue ;; esac
      LC_ALL=C grep -q 'BEGIN .*PRIVATE KEY' "$f" 2>/dev/null || continue
      m=$(file_mode "$f")
      loose_mode "$m" && emit FAIL ssh.key-permissions "$f" "$f is mode $m" "chmod 600 '$f'"
      if LC_ALL=C grep -q 'ENCRYPTED' "$f" 2>/dev/null; then emit PASS ssh.key "$f" "$f is passphrase-protected"; continue; fi
      out=$(ssh-keygen -y -P '' -f "$f" 2>&1 </dev/null); rc=$?
      emit "$(ssh_key_level "$rc" "$out")" ssh.key "$f" "$(ssh_key_detail "$rc" "$out" "$f")" "Move it to a hardware-backed agent (1Password SSH agent, Secure Enclave), or add a passphrase: ssh-keygen -p -f '$f'"
    done
  fi
  f="$HOME/.ssh/authorized_keys"
  if [ -s "$f" ]; then
    n=$(grep -cvE '^[[:space:]]*(#|$)' "$f")
    if [ "$ROLE" = server ]; then emit INFO ssh.authorized-keys "" "$n key(s) can log in to this Mac" "Remove keys you don't recognise"
    else emit WARN ssh.authorized-keys "" "$n key(s) can log in to this Mac" "Remove keys you don't recognise; turn off Remote Login if unused"; fi
  fi
  f="$HOME/.ssh/config"
  if [ -f "$f" ]; then
    lines=$(grep -niE '^[[:space:]]*ForwardAgent[[:space:]=]+yes' "$f" | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')
    [ -n "$lines" ] && emit WARN ssh.forward-agent "" "$f line(s) $lines forward your SSH agent" "Forward only to hosts you trust, per Host block; prefer ProxyJump"
    lines=$(grep -niE '^[[:space:]]*(StrictHostKeyChecking[[:space:]=]+(no|off)|UserKnownHostsFile[[:space:]=]+/dev/null)' "$f" | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')
    [ -n "$lines" ] && emit WARN ssh.host-key-checking "" "$f line(s) $lines turn off host key checking" "Remove them, or limit them to throwaway local VMs"
  fi
  if have ssh-add; then
    out=$(t 5 ssh-add -l 2>/dev/null); n=$?
    case $n in
      0) emit INFO ssh.agent "" "$(printf '%s\n' "$out" | grep -c .) key(s) loaded in the SSH agent" ;;
      1) emit INFO ssh.agent "" "The SSH agent holds no keys" ;;
      *) emit INFO ssh.agent "" "No SSH agent reachable" ;;
    esac
  fi
}
# ssh-keygen -y -P '' succeeds only for keys without a passphrase. FIDO (sk-) keys need the hardware key anyway.
ssh_key_level() { if [ "$1" != 0 ]; then echo PASS; else case $2 in sk-*) echo INFO ;; *) echo FAIL ;; esac; fi; }
ssh_key_detail() {
  if [ "$1" != 0 ]; then case $2 in *UNPROTECTED*|*"bad permissions"*) echo "$3: ssh-keygen refused to read it (permissions); passphrase unknown" ;; *) echo "$3 is passphrase-protected" ;; esac
  else case $2 in sk-*) echo "$3 is a hardware-backed (FIDO) key without a passphrase" ;; *) echo "$3 has no passphrase" ;; esac; fi
}

check_git() {
  local helper out scopes s
  if [ -f "$HOME/.git-credentials" ]; then emit FAIL git.credential-store "$HOME/.git-credentials" "$HOME/.git-credentials stores Git passwords or tokens in plain text" "Switch to osxkeychain or gh auth (git config --global credential.helper osxkeychain), rotate the tokens, then move the file to the Trash"; fi
  if have git; then
    helper=$(git config --global --get-all credential.helper 2>/dev/null)
    case " $helper " in *" store"*) emit FAIL git.credential-store "helper" "git credential.helper is store (plain-text file)" "git config --global --unset-all credential.helper; use osxkeychain or gh auth setup-git" ;; esac
    if [ "$(git config --global commit.gpgsign 2>/dev/null)" = true ]; then emit PASS git.commit-signing "" "Commits are signed by default"
    else emit INFO git.commit-signing "" "Commits are not signed by default" "Optional: sign with an SSH key (git config --global gpg.format ssh; commit.gpgsign true)"; fi
  fi
  if ! have gh; then emit SKIP git.gh-scopes "" "gh is not installed"; return; fi
  if [ "$OFFLINE" = 1 ]; then emit SKIP git.gh-scopes "" "--offline"; return; fi
  out=$(t 10 gh auth status 2>&1)
  [ $? = 142 ] && { emit SKIP git.gh-scopes "" "gh auth status timed out"; return; }
  scopes=$(printf '%s\n' "$out" | grep -i 'token scopes' | grep -Eo "'[^']+'" | tr -d "'" | sort -u)
  if [ -z "$scopes" ]; then emit SKIP git.gh-scopes "" "gh is not logged in, or reported no scopes"; return; fi
  for s in $scopes; do
    case $s in
      delete_repo|admin:org|admin:enterprise|admin:org_hook|admin:repo_hook|site_admin|admin:public_key|admin:gpg_key)
        emit WARN git.gh-scopes "$s" "The GitHub CLI login has the $s scope" "gh auth refresh --remove-scopes $s (keep powerful scopes for short sessions)" ;;
      workflow) emit INFO git.gh-scopes "$s" "The GitHub CLI login can edit workflows (workflow scope)" ;;
    esac
  done
  printf '%s\n' "$out" | grep -q 'hosts.yml' && emit WARN secrets.gh-plaintext "" "gh stores its login in a plain-text hosts.yml" "gh auth logout, then gh auth login (keychain)"
  return 0
}

check_packages() {
  local v f n lines
  if have pnpm; then
    v=$(t 10 pnpm config get minimum-release-age 2>/dev/null)
    case $v in
      ''|undefined|null|0) emit WARN packages.pnpm-release-age "" "No minimum-release-age in your global pnpm config" "pnpm config set minimum-release-age 10080 --global (7 days); also set minimumReleaseAge in each pnpm-workspace.yaml" ;;
      *[!0-9]*) emit SKIP packages.pnpm-release-age "" "unexpected pnpm config output" ;;
      *) if [ "$v" -ge 1440 ]; then emit PASS packages.pnpm-release-age "" "pnpm minimum-release-age is $v minutes"
         else emit WARN packages.pnpm-release-age "" "pnpm minimum-release-age is only $v minutes" "pnpm config set minimum-release-age 10080 --global"; fi ;;
    esac
  else emit SKIP packages.pnpm-release-age "" "pnpm is not installed"; fi
  if have npm; then
    v=$(t 10 npm config get ignore-scripts 2>/dev/null)
    if [ "$v" = true ]; then emit PASS packages.npm-ignore-scripts "" "npm ignore-scripts is true"
    else emit WARN packages.npm-ignore-scripts "" "npm runs package install scripts" "npm config set ignore-scripts true (allow the few packages that need a build)"; fi
    # npm config get can print null even when set (npm/cli#9199), so read ~/.npmrc too.
    v=$(t 10 npm config get min-release-age 2>/dev/null)
    case $v in ''|undefined|null|0) v=$(sed -n 's/^[[:space:]]*min-release-age[[:space:]]*=[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$HOME/.npmrc" 2>/dev/null | tail -1) ;; esac
    case $v in
      ''|0) emit WARN packages.npm-release-age "" "No npm min-release-age" "npm config set min-release-age 7 (npm 11.10 or later)" ;;
      *) emit PASS packages.npm-release-age "" "npm min-release-age is $v day(s)" ;;
    esac
  else emit SKIP packages.npm-ignore-scripts "" "npm is not installed"; fi

  case ${HOMEBREW_CASK_OPTS:-} in *no-quarantine*) emit WARN packages.cask-no-quarantine "env" "HOMEBREW_CASK_OPTS contains --no-quarantine (casks skip Gatekeeper)" "Remove --no-quarantine" ;; esac
  for f in $RC_FILES; do
    f="$HOME/$f"; [ -f "$f" ] || continue
    lines=$(grep -n -- '--no-quarantine' "$f" 2>/dev/null | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')
    [ -n "$lines" ] && emit WARN packages.cask-no-quarantine "$f" "$f line(s) $lines use --no-quarantine (casks skip Gatekeeper)" "Remove --no-quarantine"
  done
  # pip and uv extra indexes allow dependency confusion. Read the config files; don't run pip.
  for f in "$HOME/.config/pip/pip.conf" "$HOME/.pip/pip.conf" "$HOME/Library/Application Support/pip/pip.conf" /etc/pip.conf "$HOME/.config/uv/uv.toml"; do
    [ -f "$f" ] || continue
    lines=$(grep -noE '^[[:space:]]*(extra-index-url|trusted-host|extra_index_url)' "$f" 2>/dev/null | tr -d ' ' | tr '\n' ',' | sed 's/,$//')
    [ -n "$lines" ] && emit WARN packages.pip-index "$f" "$f sets $lines" "Use one index (index-url) and pin hashes; extra indexes let a public package shadow a private one"
  done
  for v in PIP_EXTRA_INDEX_URL PIP_TRUSTED_HOST UV_EXTRA_INDEX_URL; do
    eval "[ -n \"\${$v:-}\" ]" && emit WARN packages.pip-index "$v" "$v is set in the environment" "Use one index and pin hashes"
  done

  if have brew; then
    export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_ENV_HINTS=1
    t 10 brew tap 2>/dev/null | grep -v '^homebrew/' > "$TMP/taps"
    while IFS= read -r v; do [ -n "$v" ] && emit INFO packages.brew-tap "$v" "Third-party tap: $v" "brew untap $v if unused"; done < "$TMP/taps"
    t 15 brew services list 2>/dev/null | awk 'NR > 1 && $2 == "started" {print $1}' > "$TMP/svcs"
    while IFS= read -r v; do [ -n "$v" ] && emit INFO packages.brew-service "$v" "$v runs as a Homebrew service" "brew services stop $v if unused"; done < "$TMP/svcs"
    t 30 brew outdated --quiet 2>/dev/null > "$TMP/outdated"; n=$(grep -c . "$TMP/outdated")
    if [ "$n" -gt 0 ]; then emit WARN packages.brew-outdated "" "$n outdated Homebrew package(s): $(head -12 "$TMP/outdated" | tr '\n' ' ')" "brew upgrade (casks with their own updater may show here too)"
    else emit PASS packages.brew-outdated "" "No outdated Homebrew packages (local index, not refreshed)"; fi
    if [ "$MODE" = deep ]; then
      if have jq; then
        t 60 brew info --installed --json=v2 2>/dev/null | jq -r '[.formulae[]?, .casks[]?] | .[] | select(.deprecated == true or .disabled == true) | ((.name | if type == "array" then .[0] else . end) // .token) + "\t" + (if .disabled then "disabled" else "deprecated" end)' 2>/dev/null > "$TMP/deprecated"
        while IFS="$(printf '\t')" read -r v n; do emit WARN packages.brew-deprecated "$v" "$v is $n in Homebrew" "Find a maintained replacement and uninstall it"; done < "$TMP/deprecated"
      else emit SKIP packages.brew-deprecated "" "jq is not installed"; fi
    else emit SKIP packages.brew-deprecated "" "needs --deep"; fi
  else emit SKIP packages.brew-outdated "" "Homebrew is not installed"; fi
}

check_editors() {
  local d n prof ext m wide
  for d in "$HOME/.vscode/extensions" "$HOME/.cursor/extensions" "$HOME/.windsurf/extensions" "$HOME/.vscode-oss/extensions"; do
    [ -d "$d" ] || continue
    n=$(find "$d" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
    emit INFO editors.extensions "$d" "$d: $n extension(s)" "Remove ones you don't use; prefer verified publishers"
  done
  for prof in "$HOME/Library/Application Support/Google/Chrome" "$HOME/Library/Application Support/Arc/User Data" "$HOME/Library/Application Support/BraveSoftware/Brave-Browser" "$HOME/Library/Application Support/Microsoft Edge" "$HOME/Library/Application Support/Vivaldi"; do
    [ -d "$prof" ] || continue
    for ext in "$prof"/*/Extensions; do
      [ -d "$ext" ] || continue
      n=$(find "$ext" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
      wide=0
      for m in "$ext"/*/*/manifest.json; do
        [ -f "$m" ] && grep -q -E '"<all_urls>"|"\*://\*/\*"|"https?://\*/\*"|"debugger"|"cookies"|"nativeMessaging"' "$m" && wide=$((wide + 1))
      done
      emit INFO browser.extensions "$ext" "$(basename "$(dirname "$ext")") in $(basename "$prof"): $n extension(s), $wide with broad access (all sites, cookies, debugger or native messaging)" "Open the browser's extensions page; remove anything unused or unknown"
    done
  done
}

check_agents() {
  local f dirs d out lvl code det name cmd args sec state cfg n
  need jq agents.claude-settings "jq is not installed (macOS 15 and later include it)" || return 0
  for f in "$HOME/.claude/settings.json" "$HOME/.claude/settings.local.json"; do
    [ -f "$f" ] || continue
    claude_settings "$f" true
  done
  [ -f "/Library/Application Support/ClaudeCode/managed-settings.json" ] && emit INFO agents.claude-managed "" "Managed Claude Code settings are installed" "They override user settings; make sure they are expected"

  dirs=$(search_dirs | grep -v '^SKIP ' | grep .)
  : > "$TMP/projcfg"
  if [ -n "$dirs" ]; then
    printf '%s\n' "$dirs" | while IFS= read -r d; do
      # shellcheck disable=SC2046
      find "$d" -maxdepth 5 $(prune_args) -type f \( -path '*/.claude/settings.json' -o -path '*/.claude/settings.local.json' -o -name '.mcp.json' \) -print 2>/dev/null
    done | grep -v "^$HOME/.claude/" > "$TMP/projcfg"
  fi
  grep '/.claude/settings' "$TMP/projcfg" | while IFS= read -r f; do claude_settings "$f" false; done

  # MCP servers in every known config, plus project .mcp.json files.
  {
    for f in "$HOME/.claude.json" "$HOME/.cursor/mcp.json" "$HOME/Library/Application Support/Claude/claude_desktop_config.json" "$HOME/.codeium/windsurf/mcp_config.json" "$HOME/.gemini/settings.json"; do [ -f "$f" ] && printf '%s\n' "$f"; done
    grep '/\.mcp\.json$' "$TMP/projcfg"
  } > "$TMP/mcpcfg"
  n=$(grep -c '/\.mcp\.json$' "$TMP/projcfg")
  [ "$n" -gt 0 ] && emit INFO agents.project-mcp "" "$n project .mcp.json file(s) under your repo roots" "Project MCP servers run as you once approved: review each before trusting a repo"
  while IFS= read -r cfg; do
    jq -r "$JQ_MCP" "$cfg" 2>/dev/null > "$TMP/servers" || { emit SKIP agents.mcp "$cfg" "could not parse $cfg"; continue; }
    while IFS="$(printf '\t')" read -r name cmd args sec; do
      [ -z "$name" ] && continue
      mcp_server_findings "$cfg" "$name" "$cmd" "$args" "$sec"
    done < "$TMP/servers"
  done < "$TMP/mcpcfg"

  f="$HOME/.codex/config.toml"
  if [ -f "$f" ]; then
    awk -v roots="$ROOTS" "$AWK_CODEX" "$f" > "$TMP/codex" 2>/dev/null
    while IFS="$(printf '\t')" read -r lvl code det args sec; do
      case $lvl:$code in
        MCP:*) mcp_server_findings "$f" "$code" "$det" "$args" "$sec" ;;
        *:approval-never) emit WARN agents.codex-approval "$det" "Codex approval_policy is never ($det)" "Use on-request outside a sandbox or VM" ;;
        *:full-access) emit WARN agents.codex-sandbox "$det" "Codex sandbox_mode is danger-full-access ($det)" "Use workspace-write; keep full access for throwaway VMs" ;;
        *:network) emit INFO agents.codex-network "" "Codex workspace-write sandbox allows network access" ;;
        *:trust-broad) emit WARN agents.codex-trust-broad "$det" "Codex trusts a whole folder of repos or your home: $det" "Remove that [projects] entry; trust individual repos" ;;
        *:trusted-count) emit INFO agents.codex-trusted-projects "" "$det trusted Codex project(s)" "Trim entries for deleted checkouts" ;;
        *:trusted-tmp) emit INFO agents.codex-trusted-tmp "" "$det trusted Codex project(s) are temp folders" "Remove them from ~/.codex/config.toml" ;;
      esac
    done < "$TMP/codex"
  fi
}

claude_settings() { # FILE IS_USER
  local lvl code det
  jq -r --argjson user "$2" "$JQ_CLAUDE_SETTINGS" "$1" 2>/dev/null > "$TMP/cs" || { emit SKIP agents.claude-settings "$1" "could not parse $1"; return; }
  while IFS="$(printf '\t')" read -r lvl code det; do
    case $code in
      bypass|skip-prompt) emit "$lvl" agents.claude-permissions "$1#$code" "$1: $det" "Keep bypass and skip-prompt for sandboxes, containers and VMs; use approval prompts on your own machine" ;;
      all-project-mcp) emit "$lvl" agents.claude-project-mcp "$1" "$1: $det" "Set it to false and approve project servers one by one" ;;
      hook-fetch) emit "$lvl" agents.claude-hooks "$1" "$1: $det" "Read each hook; a hook runs on every matching event with your permissions" ;;
      env-secret) emit "$lvl" agents.claude-env-secret "$1" "$1: $det" "Use apiKeyHelper or a secret manager, then rotate the values" ;;
      base-url) emit "$lvl" agents.claude-base-url "$1" "$1: $det" ;;
      deny) emit "$lvl" agents.claude-deny "$1" "$1: $det" "Add permissions.deny rules such as Read(~/.ssh/**), Read(./.env*), Read(~/.aws/**)" ;;
      sandbox) emit "$lvl" agents.claude-sandbox "$1" "$1: $det" "Turn on the sandbox (sandbox.enabled true, allowUnsandboxedCommands false) where your workflow allows" ;;
    esac
  done < "$TMP/cs"
}

mcp_server_findings() { # CONFIG NAME COMMAND ARGS SECRET_COUNT
  local state
  if [ "${5:-0}" -gt 0 ] 2>/dev/null; then emit FAIL agents.mcp-inline-secret "$1#$2" "$1: MCP server $2 has $5 credential(s) written inline" "Reference them from the environment or a secret manager instead, then rotate them"; fi
  state=$(mcp_pin_state "$3" "$4")
  [ "$state" = unpinned ] && emit WARN agents.mcp-unpinned "$1#$2" "$1: MCP server $2 is launched unpinned ($3 $(printf '%s' "$4" | cut -d' ' -f1-3)), so each start fetches the newest version" "Pin an exact version, or install it once and run the binary"
  return 0
}

check_docker() {
  need docker docker.published-port "docker is not installed" || return 0
  if ! t 8 docker info >/dev/null 2>&1; then emit SKIP docker.published-port "" "the Docker daemon is not running"; return; fi
  local line id m s
  t 8 docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | grep -E '0\.0\.0\.0:|:::|\[::\]:' > "$TMP/dports"
  while IFS= read -r line; do emit WARN docker.published-port "${line%%	*}" "Container ${line%%	*} publishes on all interfaces: ${line#*	}" "Publish to 127.0.0.1 only (-p 127.0.0.1:3000:3000), or stop the container"; done < "$TMP/dports"
  for id in $(t 8 docker ps -q 2>/dev/null); do
    m=$(t 8 docker inspect --format '{{.Name}}{{range .Mounts}} {{.Source}}{{end}}' "$id" 2>/dev/null)
    case $m in *docker.sock*) emit WARN docker.socket-mount "${m%% *}" "Container ${m%% *} mounts the Docker socket (root-equivalent access to Docker)" "Remove the mount unless the container must manage Docker" ;; esac
  done
  for s in "$HOME/.docker/run/docker.sock" /var/run/docker.sock; do
    [ -S "$s" ] || continue
    m=$(file_mode "$s")
    [ -n "$m" ] && [ $(( 8#$m & 002 )) -ne 0 ] && emit WARN docker.socket-permissions "$s" "$s is world-writable (mode $m)" "Restrict it to your user"
  done
  if [ "$MODE" = deep ]; then
    emit INFO docker.disk "" "$(t 20 docker system df --format '{{.Type}} {{.Size}} ({{.Reclaimable}} reclaimable)' 2>/dev/null | tr '\n' ';')" "docker system prune (review first)"
  fi
}

# .env files with credentials in the top three levels of a checkout.
count_env_creds() {
  local f
  find "$1" -maxdepth 3 -name node_modules -prune -o -type f -name '.env*' -print 2>/dev/null | while IFS= read -r f; do
    case $f in *.example|*.sample|*.template) continue ;; esac
    holds_env_creds "$f" && echo x
  done | grep -c x
}

# Stale checkouts that still hold .env credentials. Reads only file times: it never runs git inside
# the repo, because a repo's own config can make git run programs.
check_stale() {
  local dirs d g r gd last age envs f m
  dirs=$(search_dirs | grep -v '^SKIP ' | grep .)
  [ "$MODE" = deep ] && dirs=$(printf '%s\n' "$ROOTS" | tr ':' '\n' | while IFS= read -r d; do [ -d "$d" ] && printf '%s\n' "$d"; done)
  [ -z "$dirs" ] && { emit SKIP stale.checkout "" "no repo roots found"; return; }
  printf '%s\n' "$dirs" | while IFS= read -r d; do
    find "$d" -maxdepth 4 -name node_modules -prune -o -name .git \( -type d -o -type f \) -print 2>/dev/null
  done > "$TMP/gits"
  while IFS= read -r g; do
    r=${g%/.git}; gd=$g
    [ -f "$g" ] && gd=$(sed -n 's/^gitdir: //p' "$g" | head -1)
    case $gd in /*) ;; *) gd="$r/$gd" ;; esac
    last=0
    for f in "$gd/index" "$gd/HEAD" "$gd/logs/HEAD" "$gd/FETCH_HEAD"; do
      [ -e "$f" ] || continue
      m=$(file_mtime "$f"); [ "${m:-0}" -gt "$last" ] && last=$m
    done
    [ "$last" = 0 ] && continue
    age=$(( (NOW - last) / 86400 ))
    [ "$age" -lt "$DAYS_UNUSED" ] && continue
    envs=$(count_env_creds "$r")
    [ "$envs" -gt 0 ] && emit WARN stale.checkout "$r" "$r: untouched for $age days, $envs .env file(s) with credentials" "Delete the checkout (git worktree remove for worktrees) or its .env files, after checking for unpushed work"
  done < "$TMP/gits"
  return 0
}

check_cloud() {
  local f="$HOME/.kube/config" ctx
  [ -f "$f" ] || return 0
  ctx=$(sed -n 's/^current-context:[[:space:]]*//p' "$f" | head -1 | tr -d '"')
  case $ctx in *[Pp][Rr][Oo][Dd]*) emit WARN cloud.kubectl-prod-default "" "kubectl's default context looks like production: $ctx" "Default to a non-production context; pass --context for production on purpose" ;; esac
  return 0
}

# ---------- driver ----------

section() { # NAME FUNCTION
  local start
  case ",${ONLY:-$1}," in *",$1,"*) ;; *) return 0 ;; esac
  if [ "$(( $(date +%s) - NOW ))" -ge "$BUDGET" ]; then emit SKIP "$1.budget" "" "skipped: the ${BUDGET}s time budget was used up"; return; fi
  start=$(now_ms)
  "$2"
  emit INFO "meta.timing" "$1" "$1 took $(( $(now_ms) - start )) ms"
}

main() {
  MODE=fast FORMAT=ndjson OFFLINE=0 DIFF=0 SAVE=1 ROLE=laptop DAYS_UNUSED=90 BUDGET="" ONLY=""
  ROOTS=${MSC_ROOTS:-}
  while [ $# -gt 0 ]; do
    case $1 in
      --fast) MODE=fast ;;
      --deep) MODE=deep ;;
      --offline) OFFLINE=1 ;;
      --text) FORMAT=text ;;
      --json|--ndjson) FORMAT=ndjson ;;
      --diff) DIFF=1 ;;
      --no-save) SAVE=0 ;;
      --role) ROLE=${2:-}; shift ;;
      --roots) ROOTS=${2:-}; shift ;;
      --days-unused) DAYS_UNUSED=${2:-}; shift ;;
      --budget) BUDGET=${2:-}; shift ;;
      --only) ONLY=${2:-}; shift ;;
      --version) echo "mac-security-check $MSC_VERSION"; return 0 ;;
      -h|--help) usage; return 0 ;;
      *) echo "check.sh: unknown option: $1" >&2; usage >&2; return 2 ;;
    esac
    shift
  done
  [ -n "$ONLY" ] && SAVE=0
  case $ROLE in laptop|server) ;; *) echo "check.sh: --role must be laptop or server" >&2; return 2 ;; esac
  case $DAYS_UNUSED in ''|*[!0-9]*) echo "check.sh: --days-unused needs a number" >&2; return 2 ;; esac
  [ -z "$BUDGET" ] && { [ "$MODE" = deep ] && BUDGET=900 || BUDGET=60; }
  case $BUDGET in *[!0-9]*) echo "check.sh: --budget needs a number of seconds" >&2; return 2 ;; esac
  [ -z "$ROOTS" ] && ROOTS="$HOME/repos:$HOME/src:$HOME/code:$HOME/projects:$HOME/dev:$HOME/work:$HOME/git:$HOME/Developer:$HOME/workspace"

  NOW=$(date +%s)
  TMP=$(mktemp -d "${TMPDIR:-/tmp}/mac-security-check.XXXXXX") || { echo "check.sh: mktemp failed" >&2; return 2; }
  trap 'case $TMP in */mac-security-check.*) rm -rf "$TMP" ;; esac' EXIT
  REC="$TMP/records"; : > "$REC"
  local state_dir allow base out final rc elapsed newfail
  state_dir=${MSC_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/mac-security-check}
  allow=${MSC_ALLOWLIST:-${XDG_CONFIG_HOME:-$HOME/.config}/mac-security-check/allow.tsv}
  base="$state_dir/last-$MODE.ndjson"

  emit INFO meta.version "" "mac-security-check $MSC_VERSION, $MODE mode$( [ "$OFFLINE" = 1 ] && echo ', offline'), role $ROLE, $(uname -s) $(uname -m)"
  section os check_os
  section network check_network
  section persistence check_persistence
  section apps check_apps
  section secrets check_secrets
  section ssh check_ssh
  section git check_git
  section packages check_packages
  section editors check_editors
  section agents check_agents
  section docker check_docker
  section stale check_stale
  section cloud check_cloud
  elapsed=$(( $(date +%s) - NOW ))

  final="$TMP/final.ndjson"
  if [ -f "$allow" ]; then sanitize < "$allow" > "$TMP/allow"; else : > "$TMP/allow"; fi
  sanitize < "$REC" > "$TMP/clean"
  awk -v sep="$SEP" -v allow="$TMP/allow" -v today="$(date +%Y-%m-%d)" -v mode="$MODE" -v elapsed="$elapsed" -v version="$MSC_VERSION" "$AWK_FINAL" "$TMP/allow" "$TMP/clean" > "$final"

  newfail=$(grep -c '"level":"FAIL"' "$final")
  out="$final"
  if [ -f "$base" ]; then
    newfail=$(awk -v countonly=1 -v mode="$MODE" -v basef="$base" "$AWK_JF$AWK_DIFF" "$base" "$final")
    if [ "$DIFF" = 1 ]; then awk -v countonly=0 -v mode="$MODE" -v basef="$base" "$AWK_JF$AWK_DIFF" "$base" "$final" > "$TMP/diff"; out="$TMP/diff"; fi
  elif [ "$DIFF" = 1 ]; then
    printf '%s\n' '{"id":"meta.diff","level":"SKIP","score":0,"subject":"","detail":"no baseline for this mode yet; showing the full scan, which becomes the baseline","fix":"","key":"meta.diff","norm":""}' >> "$final"
  fi

  if [ "$FORMAT" = text ]; then awk "$AWK_JF$AWK_TEXT" "$out" | sort -t "$(printf '\t')" -k1,1n -k2,2n | cut -f3-
  else cat "$out"; fi

  if [ "$SAVE" = 1 ]; then
    if mkdir -p "$state_dir" 2>/dev/null && chmod 700 "$state_dir" 2>/dev/null && cp "$final" "$base.tmp" 2>/dev/null; then
      chmod 600 "$base.tmp"; mv "$base.tmp" "$base"
    else echo "check.sh: could not save the baseline in $state_dir" >&2; fi
  fi
  rc=0; [ "${newfail:-0}" -gt 0 ] && rc=1
  return $rc
}

if [ "${MSC_LIB:-0}" != 1 ]; then main "$@"; exit $?; fi
