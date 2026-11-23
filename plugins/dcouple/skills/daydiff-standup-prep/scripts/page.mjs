#!/usr/bin/env node
// Renders the standup as Markdown and a self-contained HTML page from standup.json and the
// gathered events. The timeline is built from event times: each event goes to the first
// workstream whose `match` regex hits its `what`, a workstream's events split into blocks at
// gaps over an hour, and rows are ordered by when each workstream first started.
//
//   node page.mjs --standup standup.json --events events.jsonl --out DIR/2026-10-30 [--tz America/Los_Angeles]
//
// standup.json:
// {"title": "Standup · Fri 10/30", "today": "one line",
//  "here": {"title": "Northwind demo, Monday noon", "steps": ["Mockups", "Brief", "Plan", "Quiz", "Approve", "Build"], "at": 4, "note": "one line"},
//  "moved": [{"name": "Northwind", "text": "all 6 planned. Waiting on me.", "context": ["2 to 4 short lines: what happened, what's next"]}],
//  "blockers": [{"who": "Sam", "text": "review the mockups he cares about", "link": "https://…"}],
//  "goals": ["Approve the 6 Northwind plans", {"text": "Customer sends:", "items": ["Harbor House"]}],   (the person's picks; never guessed)
//  "links": [{"label": "Support tracker", "url": "https://…"}],
//  "workstreams": [{"name": "Northwind", "match": "northwind|consent"}]}
import fs from 'node:fs';
import {parseArgs} from 'node:util';

const {values: opt} = parseArgs({options: {standup: {type: 'string'}, events: {type: 'string'}, out: {type: 'string'}, tz: {type: 'string'}}});
if (!opt.standup || !opt.events || !opt.out) { console.error('usage: page.mjs --standup FILE --events FILE --out PATH_WITHOUT_EXTENSION [--tz ZONE]'); process.exit(2); }
const s = JSON.parse(fs.readFileSync(opt.standup, 'utf8'));
const events = fs.readFileSync(opt.events, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const tz = opt.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const local = (ms, o) => new Intl.DateTimeFormat('en-US', {timeZone: tz, ...o}).format(ms);
const hourOf = ms => { const [h, m] = local(ms, {hour: 'numeric', minute: 'numeric', hourCycle: 'h23'}).split(':').map(Number); return h + m / 60; };
// Days are keyed by local date; the weekday is only the label.
const dayOf = ms => local(ms, {year: 'numeric', month: '2-digit', day: '2-digit'});
const clock = ms => local(ms, {hour: 'numeric', minute: '2-digit'}).replace(':00', '').replace(' AM', 'a').replace(' PM', 'p');

// Timeline blocks.
const GAP = 60 * 60_000, MIN = 15 * 60_000;
const streams = (s.workstreams ?? []).map(w => ({...w, re: new RegExp(w.match, 'i'), times: []}));
for (const e of events) {
  const t = Date.parse(e.time);
  if (!/T/.test(e.time) || Number.isNaN(t)) continue;
  streams.find(w => w.re.test(e.what))?.times.push(t);
}
const rows = streams.filter(w => w.times.length).map(w => {
  const times = w.times.sort((a, b) => a - b), blocks = [];
  // A block never crosses local midnight, so after-midnight work shows on its own day.
  for (const t of times) { const b = blocks.at(-1); if (b && t - b.end <= GAP && dayOf(t) === dayOf(b.start)) b.end = t; else blocks.push({start: t, end: t}); }
  for (const b of blocks) b.end = Math.max(b.end, b.start + MIN);
  return {name: w.name, blocks};
}).sort((a, b) => a.blocks[0].start - b.blocks[0].start);

// One axis segment per local day that has blocks, from the first to the last hour worked.
const days = [];
for (const b of rows.flatMap(r => r.blocks).sort((a, b) => a.start - b.start)) {
  const d = dayOf(b.start), seg = days.find(x => x.day === d) ?? (days.push({day: d, at: b.start, label: local(b.start, {weekday: 'short'}), from: 24, to: 0}), days.at(-1));
  seg.from = Math.min(seg.from, Math.floor(hourOf(b.start)));
  seg.to = Math.max(seg.to, Math.ceil(Math.min(24, hourOf(b.start) + (b.end - b.start) / 3_600_000)));
}
// A window longer than a week repeats weekdays, so add the date.
if (new Set(days.map(d => d.label)).size < days.length) for (const d of days) d.label += ` ${local(d.at, {month: 'numeric', day: 'numeric'})}`;
const LABEL = 120, W = 600, ROW = 24, TOP = 34, DAYGAP = 12;
const hours = days.reduce((n, d) => n + d.to - d.from, 0) || 1;
const scale = (W - LABEL - DAYGAP * Math.max(0, days.length - 1)) / hours;
let x0 = LABEL;
for (const d of days) { d.x = x0; x0 += (d.to - d.from) * scale + DAYGAP; }
const xAt = ms => { const d = days.find(x => x.day === dayOf(ms)); return d.x + (hourOf(ms) - d.from) * scale; };

function timelineSvg() {
  if (!rows.length) return '';
  const h = TOP + rows.length * ROW + 6, parts = [];
  days.forEach((d, k) => {
    parts.push(`<text x="${d.x}" y="12" font-size="12" font-weight="600" fill="var(--ink)">${esc(d.label)}</text>`);
    // The next day's first tick already labels the boundary.
    for (let hr = d.from; hr <= d.to - (k < days.length - 1 ? 1 : 0); hr += 2) {
      const x = d.x + (hr - d.from) * scale, label = hr % 12 === 0 ? (hr === 12 ? '12p' : '12a') : `${hr % 12}${hr < 12 ? 'a' : 'p'}`;
      parts.push(`<line x1="${x}" y1="${TOP - 6}" x2="${x}" y2="${h - 4}" stroke="var(--line)"/><text x="${x}" y="${TOP - 10}" font-size="10" text-anchor="middle" fill="var(--muted)">${label}</text>`);
    }
  });
  rows.forEach((r, i) => {
    const y = TOP + i * ROW;
    parts.push(`<text x="${LABEL - 8}" y="${y + 15}" font-size="12" text-anchor="end" fill="var(--ink)">${esc(r.name)}</text>`);
    for (const b of r.blocks) {
      const d = days.find(x => x.day === dayOf(b.start)), x = xAt(b.start);
      const w = Math.max(4, Math.min((b.end - b.start) / 3_600_000, d.to - hourOf(b.start)) * scale);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y + 4}" width="${w.toFixed(1)}" height="${ROW - 8}" rx="3" fill="var(--c${i % 5})"><title>${esc(r.name)}: ${clock(b.start)}–${clock(b.end)}</title></rect>`);
    }
  });
  return `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="When each workstream was worked on" style="width:100%;height:auto">${parts.join('')}</svg>`;
}

// "Thu: Northwind 10a → Support 1p · Fri: …", the order to say it in.
const firstPerDay = days.map(d => {
  const seen = rows.flatMap(r => r.blocks.filter(b => dayOf(b.start) === d.day).map(b => ({name: r.name, start: b.start}))).sort((a, b) => a.start - b.start);
  const order = seen.filter((x, i) => seen.findIndex(y => y.name === x.name) === i);
  return `${d.label}: ${order.map(x => `${x.name} ${clock(x.start)}`).join(' → ')}`;
});

const here = s.here;
function stepsSvg() {
  if (!here?.steps?.length) return '';
  const n = here.steps.length, bw = Math.min(88, (W - 20) / n - 10), fs = Math.min(14, bw / 6.5).toFixed(1);
  const boxes = here.steps.map((step, i) => {
    const x = 10 + i * (bw + 10), done = i < here.at, now = i === here.at;
    return `<rect x="${x}" y="10" width="${bw}" height="32" rx="6" fill="var(--${done ? 'accent-soft' : now ? 'warn-soft' : 'panel'})" stroke="var(--${done ? 'accent' : now ? 'warn' : 'line'})" stroke-width="${now ? 2 : 1}"/><text x="${x + bw / 2}" y="31" text-anchor="middle" font-size="${fs}" fill="var(--ink)">${done ? '✓ ' : ''}${esc(step)}</text>`;
  }).join('');
  const hx = 10 + here.at * (bw + 10) + bw / 2;
  return `<svg viewBox="0 0 ${W} 70" role="img" aria-label="${esc(here.title)}: now at ${esc(here.steps[here.at])}" style="width:100%;height:auto">${boxes}<text x="${hx}" y="62" text-anchor="middle" font-size="12" fill="var(--warn)">you are here</text></svg>`;
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.title)}</title><style>
:root { --bg:#fbfaf6; --panel:#ffffff; --ink:#1d2420; --muted:#5d6861; --line:#dcdfd6; --accent:#2f7d4f; --accent-soft:#e4f1e7; --warn:#9a5b00; --warn-soft:#fbefd9; --c0:#2f7d4f; --c1:#3b6ea8; --c2:#9a5b00; --c3:#8a4f9e; --c4:#a23a2f; }
@media (prefers-color-scheme: dark) { :root { --bg:#141815; --panel:#1b211d; --ink:#e7ebe6; --muted:#9aa69e; --line:#2e3731; --accent:#6fc38d; --accent-soft:#1e3327; --warn:#e5b566; --warn-soft:#352a15; --c0:#6fc38d; --c1:#7fb0e6; --c2:#e5b566; --c3:#c79be0; --c4:#ef9388; } }
body{background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,sans-serif;margin:0;padding:24px 16px}
main{max-width:72ch;margin:0 auto} h1{margin:0 0 4px} .muted{color:var(--muted)}
.big{font-size:20px;border-left:4px solid var(--warn);background:var(--warn-soft);padding:12px 16px;border-radius:8px;margin:16px 0}
h2{font-size:18px;color:var(--accent)} li{margin:2px 0} a{color:var(--accent)}
summary{cursor:pointer} details[open] summary{margin-bottom:4px} .ctx{color:var(--muted);font-size:15px;margin:0 0 8px} summary::marker{color:var(--accent)}
.moved{list-style:none;padding-left:0} .moved>li{margin:6px 0} .moved .ctx{list-style:none;padding-left:22px} .moved .ctx li{margin:2px 0}
</style></head><body><main>
<h1>${esc(s.title)}</h1>
<p class="big"><strong>Today:</strong> ${esc(s.today)}</p>
${here ? `<h2>${esc(here.title)}</h2>${stepsSvg()}${here.note ? `<p class="muted">${esc(here.note)}</p>` : ''}` : ''}
${rows.length ? `<h2>Timeline</h2>${timelineSvg()}<p class="muted">${esc(firstPerDay.join(' · '))}</p>` : ''}
<h2>What moved</h2><ul class="moved">${(s.moved ?? []).map(m => `<li><details><summary><strong>${esc(m.name)}:</strong> ${esc(m.text)}</summary><ul class="ctx">${(m.context ?? []).map(c => `<li>${esc(c)}</li>`).join('')}</ul></details></li>`).join('')}</ul>
<h2>Blockers</h2><ul>${(s.blockers?.length ? s.blockers : [{text: 'None'}]).map(b => `<li>${b.who ? `<strong>${esc(b.who)}:</strong> ` : ''}${b.link ? `<a href="${esc(b.link)}">${esc(b.text)}</a>` : esc(b.text)}</li>`).join('')}</ul>
<h2>Goals by end of day</h2><ul>${(s.goals ?? []).map(g => typeof g === 'string' ? `<li>${esc(g)}</li>` : `<li>${esc(g.text)}<ul>${(g.items ?? []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></li>`).join('')}</ul>
<h2>Links</h2><p>${(s.links ?? []).map(l => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')}</p>
</main></body></html>
`;

const md = [`# ${s.title}`, '', `**Today:** ${s.today}`, '',
  ...(here ? [`## ${here.title}`, '', here.steps.map((st, i) => i < here.at ? `✓ ${st}` : i === here.at ? `**${st} ← you are here**` : st).join(' → '), ...(here.note ? ['', here.note] : []), ''] : []),
  ...(rows.length ? ['## Timeline', '', ...firstPerDay.map(l => `- ${l}`), ''] : []),
  '## What moved', '', ...(s.moved ?? []).flatMap(m => [`- **${m.name}:** ${m.text}`, ...(m.context ?? []).map(c => `  - ${c}`)]), '',
  '## Blockers', '', ...(s.blockers?.length ? s.blockers.map(b => `- ${b.who ? `**${b.who}:** ` : ''}${b.link ? `[${b.text}](${b.link})` : b.text}`) : ['- None']), '',
  '## Goals by end of day', '', ...(s.goals ?? []).flatMap(g => typeof g === 'string' ? [`- ${g}`] : [`- ${g.text}`, ...(g.items ?? []).map(t => `  - ${t}`)]), '',
  '## Links', '', (s.links ?? []).map(l => `[${l.label}](${l.url})`).join(' · '), ''].join('\n');

fs.writeFileSync(`${opt.out}.html`, html);
fs.writeFileSync(`${opt.out}.md`, md);
console.log(`${opt.out}.md\n${opt.out}.html\n${rows.length} timeline rows; ${events.filter(e => /T/.test(e.time) && !streams.some(w => w.re.test(e.what))).length} timed events matched no workstream`);
