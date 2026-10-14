# Architecture page layout

Saved as `architecture.html` (or `architecture-<topic>.html`) in the bundle: one self-contained HTML page. Copy CSS, markers and shapes from [diagram-kit.html](diagram-kit.html).

```
{Title}: architecture                                 {status chip} {date}
Links            brief · options · cover sheet

1 Answer first   3 to 5 bullets: what runs where, the reader's main question,
                 what is new and reused, cost and latency
2 System         legend, then one diagram: actors left, deployments as dashed
                 frames, existing boxes plain, new in accent, external in --ext,
                 alert targets in --bad, edges labelled
3 Scenarios      per scenario: "a. {name}", sequence diagram (lanes, numbered
                 arrows), matching numbered steps, bold one-line outcome; cover
                 happy path, variants, abuse or failure, outage
4 Behavior       stage | on error | on positive result now | later, and the
                 condition for switching
5 Examples       input | expected result | why   (for classifiers and decisions)
6 Work split     PR-sized pieces in order, with dependencies   (for plans)
7 Arithmetic     cost and latency, working and assumptions shown
```

Before sharing: check light and dark, narrow widths, arrow labels, and box names against the code.
