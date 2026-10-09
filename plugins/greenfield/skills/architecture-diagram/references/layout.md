# Architecture page template

Saved in the bundle as `architecture.html` (or `architecture-<topic>.html`): a self-contained HTML page. Copy the CSS, markers and shapes from [diagram-kit.html](diagram-kit.html).

```
{Title}: architecture                                  {status chip} {date}
Links             back to the brief · options · cover sheet

1  Answer first   call-out, 3 to 5 bullets:
                  - what runs where (process or deployment for each new part)
                  - the question people will ask, answered ("new service? no: the
                    existing async server")
                  - new things: tables, task types, services, external APIs, IAM
                  - what is reused unchanged
                  - cost and latency in one line

2  System         legend (sync · new · async · external · alert), then one diagram:
                  actors on the left, deployments as dashed frames, existing boxes
                  plain, new parts in accent, external in --ext, alert targets in
                  --bad; edges labelled with latency, cost or volume

3  Scenarios      one block per scenario, each with
                  h3 "a. {scenario}", a sequence diagram (lanes plus numbered
                  arrows), numbered steps matching the arrows, and a bold one-line
                  outcome. Include the happy path, the main variants, the abuse or
                  failure case, and an outage

4  Behavior       when the system has stages: stage | on error | on positive verdict now
                  | later (and what has to be true before switching)

5  Examples       when it classifies or decides: input | expected result | why

6  Work split     PR-sized pieces in order, with dependencies (when used for a plan)

7  Arithmetic     cost and latency, with the working and assumptions labelled
```

Check before sharing: light and dark both read cleanly, nothing clips at narrow width (each `.diag` scrolls), every arrow is labelled or obvious, and every box name matches the code.
