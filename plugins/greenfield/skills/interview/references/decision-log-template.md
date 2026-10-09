# Decision log template

`decisions.html` in the work's bundle, rendered with `page`. It's append-only: add rounds, never rewrite them.

```
Decision log: {work}
Bundle links       brief · options · cover sheet · mockups · diagrams
Status             open questions: N   (or "nothing material left undecided")

Round N  ({date}): {topic}
  • {Decided item}: {one sentence}. {link to the page it came from}
  • {Reversal}: {new decision}. Replaces Round M's "{old}".
  • Sent to: {workers or documents that were updated}

Round N-1 ...

Deferred           item · why · what would bring it back
Still open         question · who answers · what is waiting on it
Change log         newest first
```

Write each line so it makes sense on its own: someone who opens only this page should understand what was decided without reading the chat.
