---
name: product-journey-demos
description: Map a web product's user journeys, then record an animated how-to demo of each one on the real UI (cursor, highlight ring, step card, caption strip) with fake data and faked side effects, audit the demos independently, and publish them. Use when asked for journey maps, product walkthrough or how-to recordings, help-center demos, or to add, re-record, audit or fix a journey demo. Works for any product through a small adapter; BloomText is the worked example.
---

# Product journey demos

Playwright drives the product's real UI and records each common journey as an
animated WebP. A default-deny guard answers reads from a synthetic demo world
and fakes every write in the browser, so the recording shows the real
product with synthetic records and the server stays untouched. A fresh agent then
audits each recording frame by frame.

`SKILL` is this skill's folder. Work happens in a project folder outside the
product's repository ([references/harness.md](references/harness.md)); ask
the person where it is or should go.

## Workflow

1. **Map the journeys** in `journeys.html`: ranked by frequency, gap-swept for
   users and admins, audience-tagged ([journey-map.md](references/journey-map.md)).
2. **Build the harness:** copy `$SKILL/assets/harness/` to `<project>/harness/`,
   `npm install`, run `node harness/selftest/run.mjs`, and write `adapter.mjs`
   from `$SKILL/templates/adapter.template.mjs`
   ([adapter-interface.md](references/adapter-interface.md)). Prepare fixtures
   using [contextual-data.md](references/contextual-data.md): customer demos
   default to verified, authorized professional and organization display names;
   generic public demos use an invented world. Freeze the private customer
   profile and record two worked examples before fanning out.
3. **Pin the start screen** every recording opens on; other entry points are
   adapter modes, named in the first caption.
4. **Write journey scripts** from `$SKILL/templates/journey.template.mjs`; fan
   out with `$SKILL/templates/briefs/fan-out.md`.
5. **Record:** `node harness/runner.mjs jNN --parallel 1` at PACE 1.33.
6. **Self-QA** against `$SKILL/templates/audit-checklist.md`; log it in `QA.md`.
7. **Independent audit** by fresh agents: `briefs/audit.md`.
8. **Fix round** with `briefs/fix.md` until no `fail` remains; `briefs/re-record.md`
   when the harness improves.
9. **Sync the doc** with `briefs/doc-sync.md`, then `python harness/report.py`.
10. **File missing features** when asked: `briefs/file-features.md`.
11. **Publish** the gallery, audit report and map; plan public releases with the person.

Details: [references/workflow.md](references/workflow.md). BloomText's build,
numbers and failure modes: [references/example-bloomtext.md](references/example-bloomtext.md).

## Rules

- **Writes stay in the browser.** Use a local app on test or staging data. If
  a journey needs a real side effect to show, report it blocked.
- **Demo records only:** customer professional/organization display labels may
  be real under the contextual-data guidance; patient/client identities and
  private records stay synthetic. A `real` read still fails the run; answer it
  from the demo world. Verified labels never authorize real effects.
- **Secrets stay local:** credentials are read at run time and kept out of
  files, logs and recordings; `.auth/` and recordings stay out of git.
- **Fakes keep falsy values:** `false`, `null` and `[]` go out as-is; only
  `undefined` falls back. Match the shapes the app expects.
- **Captions:** one plain sentence, 95 characters or fewer, exact UI labels.
  The ring sits on the control the caption names; "it worked" steps target
  the result; the last caption names any gap from the map.
- **During a fan-out,** agents touch only their journeys' files, edit `QA.md`
  and the map in place, and report harness or adapter needs.
- **Audits are independent:** a fresh agent that only audits.
- Keep the `jNN-` prefixes and paths; the tools rely on them.
