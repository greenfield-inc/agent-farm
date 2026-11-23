#!/usr/bin/env node
// Fireflies: recorded calls since the cutoff. Emits title, length and speaker count only;
// transcripts and summaries are never read.
//
//   node fireflies.mjs [--since ISO]
import {options, composioAccounts, composio, emit} from './lib.mjs';

const opt = options();
for (const account of await composioAccounts('fireflies')) {
  for (let skip = 0; ; skip += 50) {
    const rows = (await composio('FIREFLIES_GET_TRANSCRIPTS', {from_date: opt.since.toISOString(), limit: 50, skip}, account))?.transcripts ?? [];
    for (const t of rows) emit({time: t.dateString, source: 'fireflies', actor: t.organizer_email, what: `Call: ${t.title} (${Math.round(t.duration ?? 0)} min, ${t.speakers?.length ?? 0} speakers)`, link: t.transcript_url});
    if (rows.length < 50) break;
  }
}
