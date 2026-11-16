#!/usr/bin/env python3
"""Assemble the map page.  Usage: build.py <data dir> <out.html>

Reads from <data dir>: metrics.json, scores.json, architecture.json, timeline.json, top50.json, hand.json.
Shapes are in references/data-contract.md.  Missing optional files or fields leave their section out.
"""
import datetime, json, os, re, sys

data, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
J = lambda n, d=None: json.load(open(os.path.join(data, n), encoding="utf-8")) if os.path.exists(os.path.join(data, n)) else d
metrics, scores, hand = J("metrics.json"), J("scores.json"), J("hand.json", {})
arch, tl, top = J("architecture.json", {"nodes": [], "edges": [], "layers": []}), J("timeline.json", {}), J("top50.json", {"low": [], "high": []})
today = datetime.date(*map(int, (hand.get("page") or {}).get("today", str(datetime.date.today())).split("-")))


# Researcher output is untrusted: check every field the page uses as a number, date, class name or enum.
bad = []
DATE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")


def need(ok, where):
    if not ok:
        bad.append(where)


def num(v, where, lo=None, hi=None, null=False):
    ok = (null and v is None) or (isinstance(v, (int, float)) and not isinstance(v, bool)
                                   and (lo is None or v >= lo) and (hi is None or v <= hi))
    need(ok, f"{where}: {v!r} is not a number{f' from {lo} to {hi}' if lo is not None else ''}")


def date(v, where, null=False):
    need((null and not v) or (isinstance(v, str) and DATE.match(v)), f"{where}: {v!r} is not YYYY-MM-DD")


def one_of(v, allowed, where, null=False):
    need((null and v is None) or v in allowed, f"{where}: {v!r} is not one of {sorted(allowed)}")


for k, s in scores["buckets"].items():
    num(s.get("score"), f"scores.buckets[{k}].score", 1, 5, null=True)
for i, d in enumerate(scores.get("devices") or []):
    num(d.get("score"), f"scores.devices[{i}].score", 1, 5)
    date(d.get("lastChange"), f"scores.devices[{i}].lastChange", null=True)
for i, n in enumerate(arch["nodes"]):
    num(n.get("score"), f"architecture.nodes[{i}].score", 1, 5, null=True)
    for key, v in (n.get("metrics") or {}).items():
        num(v, f"architecture.nodes[{i}].metrics.{key}", null=key == "pctNewSinceBaseline")
for i, m in enumerate(tl.get("milestones", [])):
    one_of(m.get("type"), {"release", "feature", "device", "architecture", "team"}, f"timeline.milestones[{i}].type")
    date(m.get("date"), f"timeline.milestones[{i}].date")
for i, e in enumerate(tl.get("eras", [])):
    date(e.get("start"), f"timeline.eras[{i}].start")
    date(e.get("end"), f"timeline.eras[{i}].end")
for i, r in enumerate(tl.get("releases", [])):
    date(r.get("date"), f"timeline.releases[{i}].date")
for lst in ("low", "high"):
    for i, o in enumerate(top.get(lst, [])):
        num(o.get("rank"), f"top50.{lst}[{i}].rank", 1)
        one_of(o.get("impact"), {"high", "med", "low"}, f"top50.{lst}[{i}].impact")
        one_of(o.get("verified"), {"code", "inferred"}, f"top50.{lst}[{i}].verified")
for i, c in enumerate(hand.get("creative") or []):
    one_of(c.get("tone"), {"go", "maybe", "no"}, f"hand.creative[{i}].tone")
for i, l in enumerate(hand.get("lowest") or []):
    num(l.get("s"), f"hand.lowest[{i}].s", 1, 5)
for i, p in enumerate(hand.get("extraParts") or []):
    num(p.get("s"), f"hand.extraParts[{i}].s", 1, 5, null=True)
    for key in ("loc", "t", "c90", "c30", "age"):
        num(p.get(key), f"hand.extraParts[{i}].{key}")
date((hand.get("page") or {}).get("today"), "hand.page.today", null=True)
if bad:
    sys.exit("Fix these fields before building (shapes are in references/data-contract.md):\n  " + "\n  ".join(bad))


def age(d):
    return (today - datetime.date(*map(int, d.split("-")))).days if d else 999


parts = []
for key, s in scores["buckets"].items():
    m = metrics["parts"].get(key)
    if not m:
        continue
    size = m["code_loc"] or m["loc"]
    if size < 300 and not s.get("force"):
        continue
    parts.append({"k": key, "l": s["label"], "g": s["group"], "s": s.get("score"), "r": s.get("reason") or "",
                  "loc": size, "t": m["test_loc"], "c90": m["c90"], "c30": m["c30"], "first": m["first"], "last": m["last"],
                  "age": age(m["last"]), "own": round(100 * m["top"] / (m["commits"] or 1))})
parts += hand.get("extraParts") or []  # e.g. one large part split into scored sub-parts

nlabel, ntext = hand.get("nodeLabel") or {}, hand.get("nodeText") or {}
nodes = [{"id": n["id"], "l": nlabel.get(n["id"], n["label"]), "y": n["layer"], "x": bool(n.get("external")),
          "loc": (n.get("metrics") or {}).get("loc", 0), "c90": (n.get("metrics") or {}).get("commits90d", 0),
          "c30": (n.get("metrics") or {}).get("commits30d", 0), "nw": (n.get("metrics") or {}).get("pctNewSinceBaseline"),
          "s": n.get("score"), "t": ntext.get(n["id"]) or n.get("summary", "")[:240]} for n in arch["nodes"]]
edges = [{"a": e["from"], "b": e["to"], "t": e.get("transport", "")[:60], "bi": bool(e.get("bidirectional")),
          "inf": bool(e.get("inferred"))} for e in arch["edges"]]
prefix = (hand.get("units") or {}).get("prefix")
born = sorted([{"d": p["first"], "t": p["l"]} for p in parts if prefix and p["k"].startswith(prefix) and p.get("first")],
              key=lambda a: a["d"])
scored = [p for p in parts if p["s"] is not None]
# Every calendar month from the first commit through the audit date, so "recent" means recent.
mon = {m["m"]: m for m in (tl.get("monthly") or metrics["monthly"])}
months, y, mo = [], *map(int, min(list(mon) or [today.strftime("%Y-%m")]).split("-"))
while (y, mo) <= (today.year, today.month):
    k = f"{y:04d}-{mo:02d}"
    months.append(mon.get(k) or {"m": k, "n": 0, "f": 0})
    y, mo = (y + 1, 1) if mo == 12 else (y, mo + 1)
D = {"parts": parts, "devices": scores.get("devices") or [], "nodes": nodes, "edges": edges, "layers": arch["layers"],
     "monthly": months,
     "miles": [{"d": m["date"], "y": m["type"], "t": m["title"], "x": m["detail"], "i": bool(m.get("inferred"))} for m in tl.get("milestones", [])],
     "eras": [{"n": e["name"], "s": e.get("short"), "a": e["start"], "b": e["end"], "x": e.get("detail", "")} for e in tl.get("eras", [])],
     "rels": [{"v": r["version"], "d": r["date"], "h": r.get("headlines", [])[:3]} for r in tl.get("releases", [])],
     "born": born, "top": top, "hand": hand,
     "stats": {"loc": sum(p["loc"] for p in parts), "nparts": len(parts),
               "wavg": round(sum(p["s"] * p["loc"] for p in scored) / max(1, sum(p["loc"] for p in scored)), 2)}}
tpl = open(os.path.join(here, "..", "assets", "template.html"), encoding="utf-8").read()
html = tpl.replace("/*__DATA__*/null", json.dumps(D, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
open(out, "w", encoding="utf-8").write(html)
print(out, len(html.encode()), "bytes;", len(parts), "parts;", len(nodes), "nodes;", len(top["low"]), "+", len(top["high"]), "opportunities")
for check, ok in [("25 quick wins", len(top["low"]) == 25), ("25 investments", len(top["high"]) == 25),
                  ("every part has a group", all(p.get("g") for p in parts)), ("under 256 KiB (single-page publish limit)", len(html.encode()) < 262144)]:
    print(("ok   " if ok else "CHECK") + " " + check)
