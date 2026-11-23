#!/usr/bin/env node
// Grain: workspaces updated since the cutoff in every organization, their revisions, and
// row-level changes in tracker apps: app grains whose name contains "tracker", plus any
// --tracker ID, that serve GET /api/state with lists of rows carrying updated_at.
//
//   node grain.mjs [--since ISO] [--tracker ID ...]
import {options, runJson, emit, note, mapLimit} from './lib.mjs';

const opt = options({tracker: {type: 'string', multiple: true}});
const since = opt.since.getTime();
const grain = (args, ws) => runJson('grain', ['--json', ...(ws ? ['--workspace', ws] : []), ...args]);

async function listOrg(org) {
  const out = [];
  for (let cursor; ;) {
    const r = await grain(['list', '--organization', org, '--limit', '50', ...(cursor ? ['--cursor', cursor] : [])]);
    const page = r?.data?.workspaces ?? [];
    out.push(...page);
    cursor = r?.data?.nextCursor;
    // Results come newest first; stop paging once a page reaches past the cutoff.
    if (!cursor || !page.length || Date.parse(page.at(-1).updatedAt) < since) return out;
  }
}

const first = await grain(['list', '--limit', '1']);
const orgs = first?.data?.availableOrganizations ?? [];
if (!orgs.length) { note('grain list returned no organizations; run grain login'); process.exit(0); }

const lists = await mapLimit(orgs, 4, async o => (await listOrg(o.id)).map(w => ({...w, org: o.name})));
const updated = lists.flat().filter(w => Date.parse(w.updatedAt) >= since);
const trackers = new Set(opt.tracker ?? []);
for (const w of updated) if (w.kind === 'app' && /tracker/i.test(w.name)) trackers.add(w.id);

await mapLimit(updated, 6, async w => {
  const link = `https://rungrain.com/w/${w.id}`;
  const revs = (await grain(['history', '--limit', '20'], w.id))?.data?.revisions ?? [];
  const recent = revs.filter(r => Date.parse(r.createdAt) >= since);
  for (const r of recent) emit({time: r.createdAt, source: 'grain', actor: r.createdByUserId, what: `${w.name}: revision ${r.number}${r.message ? ` (${r.message})` : ''}`, link});
  if (!recent.length && !trackers.has(w.id)) emit({time: w.updatedAt, source: 'grain', actor: null, what: `${w.name}: updated (${w.org})`, link});
});

await mapLimit([...trackers], 3, async id => {
  const r = await grain(['exec', 'curl', '-s', 'localhost:3000/api/state'], id);
  let state;
  try { state = JSON.parse(r?.data?.stdout); } catch { note(`tracker ${id} did not answer /api/state`); return; }
  const name = state.meta?.name ?? id, link = `https://rungrain.com/w/${id}`;
  // updated_at moves on any edit, so a row reads as "updated, now <status>", never as a transition.
  for (const [kind, rows] of Object.entries(state)) {
    if (!Array.isArray(rows)) continue;
    for (const x of rows.filter(x => Number(new Date(x?.updated_at)) >= since)) {
      const label = x.title ?? x.name ?? x.text ?? x.question ?? x.id;
      emit({time: new Date(x.updated_at).toISOString(), source: 'grain-tracker', actor: x.owner ?? x.asked_by ?? null, what: `${name} ${kind}: ${label}${x.status ? `, now ${x.status}` : ''}`, link});
    }
  }
});
