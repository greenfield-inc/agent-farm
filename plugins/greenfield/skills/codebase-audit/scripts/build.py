#!/usr/bin/env python3
"""Assemble the map page.  Usage: build.py <data dir> <out.html>

Reads from <data dir>: metrics.json, scores.json, architecture.json, timeline.json, top50.json, hand.json.
Shapes are in references/data-contract.md.  Missing optional files or fields leave their section out.
"""
import datetime, json, os, sys

data, out = sys.argv[1], sys.argv[2]
here = os.path.dirname(os.path.abspath(__file__))
J = lambda n, d=None: json.load(open(os.path.join(data, n))) if os.path.exists(os.path.join(data, n)) else d
metrics, scores, hand = J("metrics.json"), J("scores.json"), J("hand.json", {})
arch, tl, top = J("architecture.json", {"nodes": [], "edges": [], "layers": []}), J("timeline.json", {}), J("top50.json", {"low": [], "high": []})
today = datetime.date(*map(int, (hand.get("page") or {}).get("today", str(datetime.date.today())).split("-")))


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
D = {"parts": parts, "devices": scores.get("devices") or [], "nodes": nodes, "edges": edges, "layers": arch["layers"],
     "monthly": tl.get("monthly") or metrics["monthly"],
     "miles": [{"d": m["date"], "y": m["type"], "t": m["title"], "x": m["detail"], "i": bool(m.get("inferred"))} for m in tl.get("milestones", [])],
     "eras": [{"n": e["name"], "s": e.get("short"), "a": e["start"], "b": e["end"], "x": e.get("detail", "")} for e in tl.get("eras", [])],
     "rels": [{"v": r["version"], "d": r["date"], "h": r.get("headlines", [])[:3]} for r in tl.get("releases", [])],
     "born": born, "top": top, "hand": hand,
     "stats": {"loc": sum(p["loc"] for p in parts), "nparts": len(parts),
               "wavg": round(sum(p["s"] * p["loc"] for p in scored) / max(1, sum(p["loc"] for p in scored)), 2)}}
tpl = open(os.path.join(here, "..", "assets", "template.html")).read()
html = tpl.replace("/*__DATA__*/null", json.dumps(D, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))
open(out, "w").write(html)
print(out, len(html.encode()), "bytes;", len(parts), "parts;", len(nodes), "nodes;", len(top["low"]), "+", len(top["high"]), "opportunities")
for check, ok in [("25 quick wins", len(top["low"]) == 25), ("25 investments", len(top["high"]) == 25),
                  ("every part has a group", all(p.get("g") for p in parts)), ("under 256 KiB (single-page publish limit)", len(html.encode()) < 262144)]:
    print(("ok   " if ok else "CHECK") + " " + check)
