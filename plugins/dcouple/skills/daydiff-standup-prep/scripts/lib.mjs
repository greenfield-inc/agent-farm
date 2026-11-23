// Shared pieces for the daydiff adapters. Every adapter is read-only and prints one
// event per line to stdout as JSON: {"time","source","actor","what","link"}.
// `time` is ISO 8601 UTC, or a bare YYYY-MM-DD when the source only records a date.
// Notes about skipped or unavailable sources go to stderr.
//
// Common flags: --since ISO (default: 10:00 local on the previous workday) and
// --person TEXT (an email or login the adapter uses to decide who did something).
import {execFile} from 'node:child_process';
import fs from 'node:fs';
import {parseArgs} from 'node:util';

export function options(extra = {}) {
  const {values} = parseArgs({options: {since: {type: 'string'}, person: {type: 'string'}, ...extra}, strict: false});
  values.since = values.since ? new Date(values.since) : defaultSince();
  if (Number.isNaN(values.since.getTime())) { console.error('--since must be an ISO date'); process.exit(2); }
  return values;
}

// 10:00 local on the previous workday (Friday when today is Monday).
export function defaultSince(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - ({0: 2, 1: 3}[d.getDay()] ?? 1));
  d.setHours(10, 0, 0, 0);
  return d;
}

export function run(cmd, args, {timeout = 90_000} = {}) {
  return new Promise(resolve => execFile(cmd, args, {timeout, maxBuffer: 64 << 20}, (err, stdout, stderr) =>
    resolve({ok: !err, stdout, stderr: stderr || err?.message || ''})));
}

export async function runJson(cmd, args, opts) {
  const r = await run(cmd, args, opts);
  try { return JSON.parse(r.stdout); } catch { return null; }
}

// Phone numbers never leave an adapter.
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
export const redact = s => String(s ?? '').replace(PHONE, '[phone]').replace(/\s+/g, ' ').trim();
export const clip = (s, n = 120) => { s = redact(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export function emit(e) {
  process.stdout.write(JSON.stringify({time: e.time, source: e.source, actor: e.actor ?? null, what: clip(e.what, 160), link: e.link ?? null}) + '\n');
}

export const note = msg => console.error(`daydiff: ${msg}`);

export async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// Active Composio accounts for a toolkit. Expired or missing connections are noted and skipped.
export async function composioAccounts(toolkit) {
  const all = await runJson('composio', ['connections', 'list']) ?? {};
  const rows = all[toolkit] ?? [];
  const active = rows.filter(r => r.status === 'ACTIVE');
  for (const r of rows.filter(r => r.status !== 'ACTIVE')) note(`${toolkit} ${r.alias ?? r.word_id} is ${r.status}; skipped${/^INITIA/.test(r.status) ? ' until the connection finishes' : ` (reconnect with: composio link ${toolkit})`}`);
  if (!rows.length) note(`${toolkit} is not connected; connect it with: composio link ${toolkit}`);
  return active.map(r => r.alias ?? r.word_id);
}

// Runs one Composio tool and returns its `data`. Large results land in a file; read it.
export async function composio(slug, data, account) {
  const args = ['execute', slug, '-d', JSON.stringify(data)];
  if (account) args.push('--account', account);
  let r = await runJson('composio', args, {timeout: 120_000});
  if (r?.storedInFile && r.outputFilePath) r = JSON.parse(fs.readFileSync(r.outputFilePath, 'utf8'));
  if (!r?.successful) { note(`${slug} failed: ${r?.error ?? 'no response'}`); return null; }
  return r.data;
}
