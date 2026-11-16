# Data contract

`scripts/build.py <data dir> <out.html>` reads these files from the data directory. Fields marked optional may be left out; the page drops the section that depends on them. The builder stops and lists every score, rank, date or enum value (milestone `type`, `impact`, `verified`, `tone`) that does not match these shapes, and fills months without commits with zeroes through `hand.page.today`.

## metrics.json (from scripts/metrics.py)

```json
{"parts": {"<bucket key>": {"code_loc": 0, "test_loc": 0, "loc": 0, "commits": 0, "c30": 0, "c90": 0, "c365": 0,
                            "top": 0, "first": "YYYY-MM-DD", "last": "YYYY-MM-DD"}},
 "monthly": [{"m": "YYYY-MM", "n": 0, "f": 0}]}
```
`f` is commits by the top author. The bucket key is a path prefix such as `apps/web` or `packages/core`.

## scores.json

```json
{"buckets": {"<bucket key>": {"label": "Checkout", "group": "Web app", "score": 3.5, "reason": "one sentence, 140 characters at most"}},
 "devices": [{"label": "Safari", "kind": "browsers", "score": 4, "reason": "", "lastChange": "YYYY-MM-DD"}]}
```
- Keys match metrics.json. `group` is one of 5 to 8 product areas; it groups the treemap.
- `score` is 1 to 5 in half points, or `null` for not assessed (drawn hatched).
- `devices` is optional: any inventory of supported targets (devices, platforms, integrations, providers), grouped by `kind`.

## architecture.json

```json
{"layers": ["Clients", "API", "Services", "Data", "External"],
 "nodes": [{"id": "api-gateway", "label": "API gateway", "layer": "API", "external": false, "score": 4, "summary": "what it owns, 240 characters at most",
            "metrics": {"loc": 0, "commits30d": 0, "commits90d": 0, "pctNewSinceBaseline": null}}],
 "edges": [{"from": "web-app", "to": "api-gateway", "transport": "HTTPS", "bidirectional": false, "inferred": false}]}
```
- 20 to 40 nodes. `layers` lists bottom to top; the map draws the last layer first. Set `archRows` in hand.json to control rows yourself.
- External nodes (hardware, third-party services) have no metrics and draw dashed.

## timeline.json

```json
{"eras": [{"name": "Beta", "short": "Beta", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "detail": ""}],
 "milestones": [{"date": "YYYY-MM-DD", "type": "release | feature | device | architecture | team", "title": "", "detail": "", "inferred": false}],
 "releases": [{"version": "1.2.0", "date": "YYYY-MM-DD", "headlines": ["", ""]}],
 "monthly": []}
```
- 40 to 80 milestones. Titles are plain user-facing phrases. `monthly` is optional; metrics.json supplies it.
- `type: device` is the lane for supported targets; rename lanes in `hand.page.lanes`.

## top50.json

```json
{"low":  [{"rank": 1, "title": "verb phrase", "why": "what the user sees today and what changes", "area": "Checkout", "size": "S",
           "impact": "high | med | low", "files": ["path:line"], "verified": "code | inferred", "focus": true}],
 "high": [{"rank": 1, "title": "", "why": "", "area": "", "size": "M | L", "effort": "2 to 4 days", "impact": "", "files": [], "verified": "", "focus": false}]}
```
Exactly 25 each. `area` names the one part the item touches. `focus` marks items serving a stated priority.

## hand.json (written by you)

```json
{"page": {"title": "Acme, mapped", "today": "YYYY-MM-DD", "topAuthor": "Jane Doe", "baseline": "the 2.0 rewrite",
          "marker": {"date": "YYYY-MM-DD", "label": "2.0 rewrite"}, "recentMonths": 6,
          "lanes": {"device": "Platforms", "born": "Apps added"},
          "unitsTitle": "The 14 apps, least polished first", "unitsNav": "Apps",
          "inventoryTitle": "Browsers and platforms", "inventoryNav": "Platforms",
          "traceTitle": "One order, from tap to receipt", "traceNote": "", "timeSub": "", "timeNote": "", "archHint": "",
          "method": ["How many agents read what, at which commit.", "What a score means.", "What was not run or assessed."]},
 "findings": [{"h": "headline", "p": "two or three sentences with numbers"}],
 "lowest": [{"s": 2, "n": "name", "x": "why it scores low", "w": "area, your focus"}],
 "units": {"prefix": "apps/", "noun": "App"},
 "focus": [{"k": "<bucket key>", "n": "name", "said": "\"their words\"", "found": ["cause", "cause"]}],
 "creative": [{"n": "idea", "said": "", "today": "what exists", "size": "", "verdict": "Start now", "tone": "go | maybe | no"}],
 "trace": [{"t": "step", "x": "detail"}],
 "glossary": [["term", "definition"]],
 "nodeLabel": {"<node id>": "short label"}, "nodeText": {"<node id>": "detail text"},
 "layerNote": {"<layer>": "one line"}, "archRows": [["Clients"], ["API"], ["Services", "External"]],
 "extraParts": []}
```
- Every key is optional except `page.title`. `focus[].k` outlines that part in purple on every chart.
- `units` names the folder of repeated units (apps, packages, services, plugins) for the per-unit table and the "added" lane.
- `extraParts` adds treemap parts in the built shape (`k, l, g, s, r, loc, t, c90, c30, age`), for splitting one very large bucket into scored sub-parts.
