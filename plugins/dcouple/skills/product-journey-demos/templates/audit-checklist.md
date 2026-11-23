# Audit checklist for one journey recording

A fresh agent with no stake in the recording audits it, leaving scripts and
recordings as they are. Paths are relative to the project folder.

## Gather

- Recording `recordings/jNN-*.webp` (if missing: `not recorded`, with a
  reason in `SKIPPED.md`), script `journeys/jNN.mjs`, call log
  `recordings/jNN-*.calls.json`, and `journeys.html#jNN` (Steps and Gap).
- Frames: one per step (at least 6) plus the last, in a temp folder outside
  the project. View every one. `ffmpeg -i <webp> -vf fps=1 "$TMP/audit/jNN/%02d.png"`,
  or Pillow, converting each frame inside the loop.

## Check

- **Privacy:** only the demo world: persona, org, invented customers, demo
  email domain, fictional numbers. Real professional/organization labels must
  match the private approved profile and provenance under
  [contextual-data.md](../references/contextual-data.md); records remain synthetic
  and sample-data framing must not imply real activity or endorsement.
- **Clean UI:** free of error toasts, loading or "Connecting..." banners,
  crash pages and browser bars.
- **Overlay:** on every step the card title, ring and caption agree, the ring
  wraps the named control, and each caption is whole.
- **Start:** the start screen, or an entry point named in the first caption.
- **Pace:** each screen holds at least 1.5 s after it settles.
- **Accuracy:** steps match the map, caption labels match the screen, and the
  last caption names any gap.
- **Calls:** only `fixture`, `faked`, `failed` (on purpose), `allowed`,
  `session` and `real-patched`, and `errors` is `[]`.

## Score and write `audit/jNN.json`

`pass`; `pass with notes` (each note with a cheap fix); `fail` (the exact
frame or step and the fix); or `not recorded`.

```json
{
  "journey": "jNN",
  "verdict": "pass|pass with notes|fail|not recorded",
  "checks": { "privacy": "", "ui": "", "overlay": "", "start": "", "pace": "", "accuracy": "", "calls": "" },
  "notes": "",
  "frames": ["<temp path>/audit/jNN/01.png"]
}
```

Start a failing check's text with `fail`; the report lists those. After a
fix round, the fixer re-audits and adds `"fixed": "<what changed>"`.
