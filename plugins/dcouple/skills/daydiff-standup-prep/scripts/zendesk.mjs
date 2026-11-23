#!/usr/bin/env node
// Zendesk: tickets the person replied to, noted on or changed since the cutoff. Emits ticket
// number, organization, reply or note, status change and the subject; comment bodies are
// never read or emitted.
//
//   node zendesk.mjs --subdomain NAME --person EMAIL [--since ISO]
//
// The API token comes from ZENDESK_API_TOKEN or the OS keychain item with service
// "<subdomain>-zendesk-api-token" and account "daydiff" (macOS Keychain, or the Secret
// Service through secret-tool on Linux), read at use and never printed. Audits are fetched one
// at a time, honouring Retry-After, because Zendesk rate-limits them quickly.
// When the API isn't reachable, falls back to Zendesk mail in Gmail (see gmailFallback).
import {execFileSync} from 'node:child_process';
import {options, composioAccounts, composio, emit, note} from './lib.mjs';

const opt = options({subdomain: {type: 'string'}});
const since = opt.since.toISOString();
const sub = opt.subdomain ?? process.env.ZENDESK_SUBDOMAIN;
if (!sub) { note('zendesk: no --subdomain or ZENDESK_SUBDOMAIN; skipped'); process.exit(0); }
const base = `https://${sub}.zendesk.com`;
// gather.mjs stops an adapter after 240 s; audits stop at 180 s so the rest can go to Gmail.
const deadline = Date.now() + 180_000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function token() {
  if (process.env.ZENDESK_API_TOKEN) return process.env.ZENDESK_API_TOKEN;
  const service = `${sub}-zendesk-api-token`;
  const [cmd, args] = process.platform === 'darwin'
    ? ['security', ['find-generic-password', '-a', 'daydiff', '-s', service, '-w']]
    : ['secret-tool', ['lookup', 'service', service, 'account', 'daydiff']];
  try { return execFileSync(cmd, args, {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim() || null; } catch { return null; }
}

async function api(auth, path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(path.startsWith('https://') ? path : `${base}/api/v2/${path}`, {headers: {authorization: auth}, signal: AbortSignal.timeout(30_000)}).catch(() => null);
    if (r?.ok) return r.json();
    if (r?.status !== 429) return null;
    await sleep(Math.min(60, Number(r.headers.get('retry-after')) || 10) * 1000);
  }
  return null;
}

// Returns the tickets whose audits couldn't be read, or null when the API isn't reachable.
async function fromApi() {
  const t = token();
  if (!t || !opt.person) return null;
  const auth = 'Basic ' + Buffer.from(`${opt.person}/token:${t}`).toString('base64');
  const me = (await api(auth, 'users/me.json'))?.user;
  if (!me?.id) return null;
  const tickets = [], orgs = new Map(), missed = [];
  for (let page = 1; page <= 10; page++) {
    const data = await api(auth, `search.json?query=${encodeURIComponent(`type:ticket updated>${since}`)}&include=tickets(organizations)&per_page=100&page=${page}`);
    if (!data) return null;
    tickets.push(...data.results);
    for (const o of data.organizations ?? []) orgs.set(o.id, o.name);
    if (!data.next_page) break;
  }
  for (const [i, tk] of tickets.entries()) {
    if (Date.now() > deadline) { note(`zendesk: out of time after ${i} of ${tickets.length} tickets; reading the rest from mail`); missed.push(...tickets.slice(i)); break; }
    // Audits come oldest first, 100 per page, so read every page.
    const audits = [];
    for (let next = `tickets/${tk.id}/audits.json`; next;) {
      const data = await api(auth, next);
      if (!data) { audits.length = 0; break; }
      audits.push(...data.audits);
      next = data.next_page;
      if (next) await sleep(1500);
    }
    if (!audits.length) { note(`zendesk: audits for #${tk.id} unavailable; reading its mail instead`); missed.push(tk); continue; }
    for (const a of audits) {
      if (a.author_id !== me.id || a.created_at < since) continue;
      const did = [];
      for (const e of a.events ?? []) {
        if (e.type === 'Comment') did.push(e.public ? 'replied' : 'internal note');
        else if (e.type === 'Change' && e.field_name === 'status') did.push(`${e.previous_value ?? 'new'} → ${e.value}`);
      }
      const org = orgs.get(tk.organization_id);
      if (did.length) emit({time: a.created_at, source: 'zendesk', actor: me.name, what: `Ticket #${tk.id}${org ? ` (${org})` : ''}: ${did.join(', ')}: ${tk.subject ?? ''}`, link: `${base}/agent/tickets/${tk.id}`});
    }
    await sleep(1500);
  }
  return missed;
}

// Zendesk mail in Gmail: replies sent to the ticket address count as the person replying, and
// the newest notification per subject gives the ticket's latest state. Subjects only. With
// `only`, keeps mail about those tickets (by subject or #id), so nothing is reported twice.
async function gmailFallback(only) {
  const after = Math.floor(opt.since.getTime() / 1000);
  for (const account of await composioAccounts('gmail')) {
    const latest = new Map();
    for (let page_token; ;) {
      const data = await composio('GMAIL_FETCH_EMAILS', {query: `(from:${sub}.zendesk.com OR to:${sub}.zendesk.com) after:${after}`, max_results: 100, include_payload: false, verbose: false, ...(page_token ? {page_token} : {})}, account);
      for (const m of data?.messages ?? []) {
        const sent = (m.labelIds ?? []).includes('SENT'), subject = String(m.subject ?? '').replace(/^(re|fwd?):\s*/i, '');
        if (only && !only.some(tk => (tk.subject && subject.includes(tk.subject)) || subject.includes(`#${tk.id}`))) continue;
        if (sent) emit({time: m.messageTimestamp, source: 'zendesk-mail', actor: account, what: `Replied on ticket: ${subject}`, link: m.display_url});
        else if (!latest.has(subject) || latest.get(subject).messageTimestamp < m.messageTimestamp) latest.set(subject, m);
      }
      page_token = data?.nextPageToken;
      if (!page_token) break;
    }
    for (const [subject, m] of latest) emit({time: m.messageTimestamp, source: 'zendesk-mail', actor: null, what: `Ticket update: ${subject}`, link: m.display_url});
  }
}

const missed = await fromApi();
if (!missed) { note('zendesk: API not reachable; read Zendesk mail in Gmail instead'); await gmailFallback(); }
else if (missed.length) await gmailFallback(missed);
