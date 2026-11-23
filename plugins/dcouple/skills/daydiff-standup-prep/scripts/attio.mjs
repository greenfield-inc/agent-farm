#!/usr/bin/env node
// Attio: notes and new company, person and deal records since the cutoff. Note titles only;
// note bodies are never emitted. Records an API token created are marked as automation.
//
//   node attio.mjs [--since ISO]
import {options, composioAccounts, composio, emit} from './lib.mjs';

const opt = options();
const since = opt.since.toISOString();
const actor = a => a?.type === 'api-token' ? 'automation' : a?.type === 'workspace-member' ? `member:${a.id}` : a?.type ?? null;
const recordName = v => { const n = v.name?.[0]; return n?.value ?? n?.full_name ?? 'unnamed'; };

for (const account of await composioAccounts('attio')) {
  // Notes list oldest first with no date filter, so page through and keep the recent ones.
  for (let offset = 0; ; offset += 50) {
    const rows = (await composio('ATTIO_LIST_NOTES', {limit: 50, offset}, account))?.data ?? [];
    for (const n of rows) if (n.created_at >= since) emit({time: n.created_at, source: 'attio', actor: actor(n.created_by_actor), what: `Note on ${n.parent_object}: ${n.title}`, link: null});
    if (rows.length < 50) break;
  }
  for (const object of ['companies', 'people', 'deals']) {
    const rows = (await composio('ATTIO_POST_V2_OBJECTS_OBJECT_RECORDS_QUERY', {object, limit: 500, filter: {created_at: {$gte: since}}}, account))?.data ?? [];
    for (const r of rows) emit({time: r.created_at, source: 'attio', actor: actor(r.values?.name?.[0]?.created_by_actor), what: `New ${{companies: 'company', people: 'person', deals: 'deal'}[object]}: ${recordName(r.values ?? {})}`, link: r.web_url ?? null});
  }
}
