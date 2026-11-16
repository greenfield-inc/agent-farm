#!/usr/bin/env python3
"""Size and attention per part of a repo.  Usage: metrics.py <repo> <config.json> <out.json>

config.json:
{
  "buckets": [{"prefix": "apps/", "depth": 2}, {"prefix": "packages/", "depth": 2}, {"prefix": "", "depth": 1}],
  "authors": {"top": ["jane", "jdoe@"], "others": {"alex": ["alex"]}},
  "today": "2026-11-15"
}
A path lands in the first bucket rule whose prefix it starts with; the bucket key is its first `depth`
path segments. Order rules from most to least specific. `authors.top` are lowercase substrings of the
name or email of the person whose share you want to show; leave it out to use the most frequent author.
Read-only: runs git ls-files and git log.
"""
import collections, datetime, json, os, re, subprocess, sys, time

repo, cfg_path, out_path = sys.argv[1:4]
cfg = json.load(open(cfg_path))
os.chdir(repo)
RULES = cfg["buckets"]
SRC = re.compile(r"\.(ts|tsx|js|jsx|mjs|cjs|swift|kt|java|m|mm|h|c|cpp|cc|cs|py|rb|rs|go|php|ex|exs|scala|dart|vue|svelte|html|css|scss|sh|sql|md|mdx|json|yaml|yml|toml|gradle)$")
CODE = re.compile(r"\.(ts|tsx|js|jsx|mjs|cjs|swift|kt|java|m|mm|h|c|cpp|cc|cs|py|rb|rs|go|php|ex|exs|scala|dart|vue|svelte|html|css|scss|sh|sql)$")
SKIP = re.compile(cfg.get("skip") or r"(\.lock$|lock\.json$|/generated/|/dist/|/build/|/vendor/|\.min\.|/Pods/|/node_modules/|/third_party/|/assets/|/screenshots/|\.pb\.|_pb2\.)")
TEST = re.compile(cfg.get("test") or r"(\.test\.|\.spec\.|_test\.|__tests__/|/tests?/|/e2e)")


def bucket(path):
    for r in RULES:
        if path.startswith(r["prefix"]):
            parts = path.split("/")
            if len(parts) <= r["depth"]:
                return None if r["depth"] > 1 else parts[0]
            return "/".join(parts[: r["depth"]])
    return None


new = lambda: dict(files=0, loc=0, code_loc=0, test_loc=0, test_files=0, todo=0, commits=0, c365=0, c90=0, c30=0,
                   fix90=0, top=0, first=None, last=None)
B = collections.defaultdict(new)
for f in subprocess.check_output(["git", "ls-files"], text=True).splitlines():
    b = bucket(f)
    if not b or SKIP.search(f) or not SRC.search(f):
        continue
    try:
        if os.path.getsize(f) > 600000:
            continue
        txt = open(f, errors="ignore").read()
    except OSError:
        continue
    n, d = txt.count("\n"), B[b]
    d["files"] += 1
    d["loc"] += n
    if CODE.search(f):
        if TEST.search(f):
            d["test_loc"] += n
            d["test_files"] += 1
        else:
            d["code_loc"] += n
            d["todo"] += len(re.findall(r"\b(TODO|FIXME|HACK|XXX)\b", txt))

log = subprocess.check_output(["git", "log", "--name-only", "--format=@%H|%at|%an <%ae>|%s"], text=True, errors="ignore")
authors = collections.Counter(l.split("|", 3)[2].lower() for l in log.splitlines() if l.startswith("@"))
top = [s.lower() for s in (cfg.get("authors") or {}).get("top") or [authors.most_common(1)[0][0]]]
today = cfg.get("today")
now = time.mktime(datetime.date(*map(int, today.split("-"))).timetuple()) if today else time.time()
monthly = collections.defaultdict(lambda: [0, 0])
cur, seen = None, set()
for line in log.splitlines():
    if line.startswith("@"):
        h, t, a, s = line[1:].split("|", 3)
        cur, seen = (int(t), any(x in a.lower() for x in top), bool(re.search(r"\b(fix|revert|bug|hotfix)", s, re.I))), set()
        m = monthly[time.strftime("%Y-%m", time.gmtime(int(t)))]
        m[0] += 1
        m[1] += cur[1]
        continue
    if not line or not cur:
        continue
    b = bucket(line)
    if not b or b in seen or b not in B:
        continue
    seen.add(b)
    t, is_top, is_fix = cur
    d, age = B[b], (now - t) / 86400
    d["commits"] += 1
    d["top"] += is_top
    d["c30"] += age <= 30
    d["c90"] += age <= 90
    d["fix90"] += age <= 90 and is_fix
    d["c365"] += age <= 365
    d["first"] = t if d["first"] is None else min(d["first"], t)
    d["last"] = t if d["last"] is None else max(d["last"], t)
for d in B.values():
    for k in ("first", "last"):
        d[k] = time.strftime("%Y-%m-%d", time.gmtime(d[k])) if d[k] else None
json.dump({"parts": B, "monthly": [{"m": k, "n": v[0], "f": v[1]} for k, v in sorted(monthly.items())],
           "topAuthor": top, "authors": authors.most_common(12)}, open(out_path, "w"), indent=1)
print(f"{'part':44}{'code':>8}{'tests':>8}{'all':>6}{'90d':>5}{'30d':>5}  last")
for k, d in sorted(B.items(), key=lambda kv: -kv[1]["code_loc"]):
    print(f"{k:44}{d['code_loc']:>8}{d['test_loc']:>8}{d['commits']:>6}{d['c90']:>5}{d['c30']:>5}  {d['last']}")
