#!/usr/bin/env node
// Runs every adapter in parallel and writes one time-sorted events file, plus each
// adapter's notes (skipped or failed sources).
//
//   node gather.mjs --out DIR [--since ISO] [--person EMAIL] [--github LOGIN] [--zendesk SUBDOMAIN] [--tracker ID ...]
//
// --zendesk defaults to ZENDESK_SUBDOMAIN; --github defaults to the gh login.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {options, run} from './lib.mjs';

const opt = options({out: {type: 'string'}, github: {type: 'string'}, zendesk: {type: 'string'}, tracker: {type: 'string', multiple: true}});
if (!opt.out) { console.error('usage: gather.mjs --out DIR [--since ISO] [--person EMAIL] [--github LOGIN] [--zendesk SUBDOMAIN] [--tracker ID ...]'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
const since = ['--since', opt.since.toISOString()];
const adapters = {
  grain: [...since, ...(opt.tracker ?? []).flatMap(id => ['--tracker', id])], gmail: since, calendar: since, fireflies: since, attio: since, sessions: since,
  zendesk: [...since, ...(opt.zendesk ? ['--subdomain', opt.zendesk] : []), ...(opt.person ? ['--person', opt.person] : [])],
  github: [...since, ...(opt.github ? ['--person', opt.github] : [])],
};

const started = Date.now();
const results = await Promise.all(Object.entries(adapters).map(async ([name, args]) => {
  const t = Date.now(), r = await run('node', [path.join(here, `${name}.mjs`), ...args], {timeout: 240_000});
  const events = r.stdout.split('\n').flatMap(l => { try { return l ? [JSON.parse(l)] : []; } catch { return []; } });
  // A failed or timed-out adapter keeps what it printed, flagged as possibly incomplete.
  const notes = [r.stderr.trim(), r.ok ? '' : 'daydiff: stopped before finishing; its events may be incomplete'].filter(Boolean).join('\n');
  return {name, events, seconds: Math.round((Date.now() - t) / 1000), notes};
}));

const events = results.flatMap(r => r.events).sort((a, b) => String(a.time).localeCompare(String(b.time)));
fs.mkdirSync(opt.out, {recursive: true});
fs.writeFileSync(path.join(opt.out, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n') + '\n');
const summary = results.map(r => `${r.name}: ${r.events.length} events in ${r.seconds}s${r.notes ? `\n  ${r.notes.replace(/\n/g, '\n  ')}` : ''}`).join('\n');
fs.writeFileSync(path.join(opt.out, 'sources.txt'), `since ${opt.since.toISOString()}\n${summary}\n`);
console.log(`${events.length} events in ${Math.round((Date.now() - started) / 1000)}s -> ${path.join(opt.out, 'events.jsonl')}\n${summary}`);
