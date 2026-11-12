// Renders the Session status page and one page per work item from a status JSON file (references/status-board.md).
// usage: node render.mjs <status.json> <out.html>   (item pages go to items/<id>.html beside <out.html>)
// Diagrams are drawn with rough.js at render time; the pages have no script (a script-src 'none' CSP) and fetch nothing.
// rough.mjs and the Inter font are vendored beside this file, so it needs nothing but Node.
// Pane copies this file; it already carries the hardening Pane's copy added (every link through href(), numeric
// counts, an allow-listed item state, the CSP), so a refresh from Agent Farm is a straight copy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rough from './rough.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) { console.error('usage: node render.mjs <status.json> <out.html>'); process.exit(2); }
const d = { session: {}, needs: [], items: [], done: [], decisions: [], sources: [], links: [], ...JSON.parse(fs.readFileSync(inPath, 'utf8')) };
const g = rough.generator();
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
// `next`, `settings`, `summary`, `nextStep`, `asked` and `changes` may carry <b>, <code> and <a href> links; everything else in them is escaped.
const SAFE_HREF = /^(https?:|file:|pane:|#|\.{0,2}\/|[\w.-]+(\/|\.html|$))/i;
// Links in the JSON are relative to the overview; on an item page (one folder down, in items/) a relative link gets `../`.
let base = '';
const rebase = u => (base && !/^([a-z][\w+.-]*:|#|\/)/i.test(u) ? base + u : u);
const href = u => SAFE_HREF.test(String(u || '')) ? esc(rebase(String(u))) : '#';
const rich = s => esc(s)
  .replace(/&lt;(\/?)(b|code)>/g, '<$1$2>')
  .replace(/&lt;a href=&quot;([^"&<>]*(?:&amp;[^"&<>]*)*)&quot;>(.*?)&lt;\/a>/g, (m, url, text) => SAFE_HREF.test(url.replace(/&amp;/g, '&')) ? `<a href="${rebase(url)}">${text}</a>` : text);
// ---------- diagrams ----------
const COLOR = { retried: 'var(--bad)', done: 'var(--ok)', now: 'var(--run)', need: 'var(--warn)', blocked: 'var(--bad)', failed: 'var(--bad)', todo: 'var(--todo)', skipped: 'var(--todo)' };
const WASH = { now: 'var(--run-wash)', need: 'var(--warn-wash)', blocked: 'var(--bad-wash)', failed: 'var(--bad-wash)' };
const HOT = new Set(['now', 'need', 'blocked', 'failed']);
const DASHED = new Set(['todo', 'skipped']);
let seed = 7;
const opts = (x = {}) => ({ roughness: 1.2, bowing: 1.1, seed: seed++, stroke: 'x', ...x });
function draw(out, dr, stroke, fill, dash) {
  for (const p of g.toPaths(dr)) {
    const f = p.fill && p.fill !== 'none';
    out.push(`<path d="${p.d.replace(/(\d+\.\d)\d+/g, '$1')}" fill="${f ? fill : 'none'}" stroke="${f ? 'none' : stroke}" stroke-width="${p.strokeWidth}"${dash && !f ? ' stroke-dasharray="6 5"' : ''} stroke-linecap="round"/>`);
  }
}
const tcls = st => (HOT.has(st.state) ? 'on ' + st.state : DASHED.has(st.state) ? 'mut' : st.state === 'retried' ? 'failed' : '');
function arrow(out, x1, y1, x2, y2, next) {
  const c = COLOR[next.state], dash = DASHED.has(next.state);
  draw(out, g.line(x1, y1, x2, y2, opts({ strokeWidth: 2 })), c, null, dash);
  const head = x1 === x2 ? [[x2 - 6, y2 - 8], [x2, y2], [x2 + 6, y2 - 8]] : [[x2 - 9, y2 - 6], [x2, y2], [x2 - 9, y2 + 6]];
  draw(out, g.linearPath(head, opts({ roughness: 0.8, strokeWidth: 2 })), c);
}
function boxesSvg(spec) {
  const s = spec.steps, n = s.length;
  const box = (out, st, x, y, w, h) => {
    draw(out, g.rectangle(x, y, w, h, opts({ strokeWidth: HOT.has(st.state) ? 2.4 : 1.6, ...(HOT.has(st.state) ? { fill: 'x', fillStyle: 'solid' } : {}) })), COLOR[st.state], WASH[st.state], DASHED.has(st.state));
    const label = st.label + (st.state === 'done' ? ' ✓' : ''), fits = t => t.length * 7.6 <= w - 14;
    let lines = [label];
    if (!fits(label)) { const words = label.split(' '); let best = null;
      for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(' '), b = words.slice(k).join(' '), m = Math.max(a.length, b.length); if (!best || m < best.m) best = { a, b, m }; }
      if (best) lines = [best.a, best.b]; }
    const longest = Math.max(...lines.map(l => l.length)), fs = Math.min(14, Math.max(10, (w - 14) / (longest * 0.55)));
    const y0 = y + h / 2 + fs * 0.36 - (lines.length - 1) * fs * 0.6;
    out.push(`<text x="${x + w / 2}" y="${y0}" text-anchor="middle" class="${tcls(st)}" style="font-size:${fs.toFixed(1)}px">${lines.map((l, i) => `<tspan x="${x + w / 2}" dy="${i ? fs * 1.2 : 0}">${esc(l)}</tspan>`).join('')}</text>`);
  };
  const wide = [], gap = 30, bw = (852 - gap * (n - 1)) / n;
  s.forEach((st, i) => {
    const x = 4 + i * (bw + gap), big = HOT.has(st.state);
    box(wide, st, x, big ? 26 : 30, bw, big ? 56 : 48);
    if (st.tag) wide.push(`<text x="${x + bw / 2}" y="16" text-anchor="middle" class="tag" style="fill:${COLOR[st.state]}">${esc(st.tag)}</text>`);
    if (i < n - 1) arrow(wide, x + bw + 3, 54, x + bw + gap - 4, 54, s[i + 1]);
  });
  const tall = []; let y = 6;
  s.forEach((st, i) => {
    box(tall, st, 6, y, 236, 44);
    if (st.tag) tall.push(`<text x="250" y="${y + 26}" class="tag" style="fill:${COLOR[st.state]}">◀ ${esc(st.tag.split('·')[0].trim())}</text>`);
    y += 44;
    if (i < n - 1) { arrow(tall, 124, y + 3, 124, y + 22, s[i + 1]); y += 26; }
  });
  const tagW = Math.max(0, ...s.filter(st => st.tag).map(st => (st.tag.split('·')[0].trim().length + 2) * 7.5));
  return [{ w: 860, h: 88, body: wide }, { w: Math.max(310, 250 + tagW), h: y + 6, body: tall }];
}
function dot(out, st, x, y, r = 7) {
  const c = COLOR[st.state], hot = HOT.has(st.state);
  if (DASHED.has(st.state)) { out.push(`<circle cx="${x}" cy="${y}" r="${r - 1.5}" fill="var(--paper)" stroke="${c}" stroke-width="2"/>`); return; }
  if (hot) out.push(`<circle cx="${x}" cy="${y}" r="${r + 7}" fill="${WASH[st.state]}"/>`);
  out.push(`<circle cx="${x}" cy="${y}" r="${hot ? r + 1.5 : r}" fill="${c}"/>`);
  draw(out, g.circle(x, y, (hot ? r + 1.5 : r) * 2 + 3, opts({ roughness: 0.5, bowing: 0, strokeWidth: 1.4 })), c);
  if (['failed', 'blocked', 'retried'].includes(st.state)) out.push(`<path d="M${x - 3.5} ${y - 3.5}L${x + 3.5} ${y + 3.5}M${x + 3.5} ${y - 3.5}L${x - 3.5} ${y + 3.5}" stroke="var(--paper)" stroke-width="2.2" stroke-linecap="round"/>`);
  else if (st.state === 'need') out.push(`<text x="${x}" y="${y + 4}" text-anchor="middle" class="bang">!</text>`);
  else if (st.state === 'done') out.push(`<path d="M${x - 3} ${y}l2.2 2.4 4-4.6" fill="none" stroke="var(--paper)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`);
}
function railLine(out, s, xs, y, gapR) {
  s.forEach((st, i) => { if (i < s.length - 1) draw(out, g.line(xs[i] + gapR, y, xs[i + 1] - gapR, y, opts({ strokeWidth: 2, roughness: 0.6, bowing: 0.6 })), COLOR[s[i + 1].state], null, DASHED.has(s[i + 1].state)); });
}
function railSvg(spec) {
  const s = spec.steps, n = s.length;
  const W = 860, pad = 52, spacing = n > 1 ? (W - 2 * pad) / (n - 1) : W;
  const widthOf = st => st.label.length * 7.2 + 8;
  const stagger = s.some((st, i) => i < n - 1 && (widthOf(st) + widthOf(s[i + 1])) / 2 > spacing);
  const y = stagger ? 36 : 22, xs = s.map((_, i) => (n === 1 ? W / 2 : pad + i * spacing));
  const wide = [];
  railLine(wide, s, xs, y, 12);
  s.forEach((st, i) => { dot(wide, st, xs[i], y); const up = stagger && i % 2 === 1;
    wide.push(`<text x="${xs[i]}" y="${up ? y - 20 : y + 36}" text-anchor="middle" class="${tcls(st)}">${esc(st.label)}</text>`); });
  const NW = 400, np = 16, ny = 18, nxs = s.map((_, i) => (n === 1 ? NW / 2 : np + i * (NW - 2 * np) / (n - 1)));
  const tall = [];
  railLine(tall, s, nxs, ny, 10);
  s.forEach((st, i) => dot(tall, st, nxs[i], ny, 6));
  return [{ w: W, h: stagger ? 82 : 68, body: wide }, { w: NW, h: 36, body: tall }];
}
function railNow(spec) {
  const s = spec.steps, i = s.findIndex(st => HOT.has(st.state));
  const cur = i >= 0 ? i : Math.max(0, s.findLastIndex(st => st.state === 'done'));
  const st = s[cur], next = s.slice(cur + 1).find(x => DASHED.has(x.state));
  return `<p class="railnow">Step ${cur + 1} of ${s.length} · ${esc(st.label)}${next ? ` → ${esc(next.label)}` : ''}</p>`;
}
function diagram(spec, kind, extraClass = '') {
  const [wide, tall] = (kind === 'rail' ? railSvg : boxesSvg)(spec);
  const aria = esc(spec.steps.map(s => `${s.label}: ${s.state}`).join(', '));
  const svg = (v, cls) => `<svg class="${cls}" viewBox="0 0 ${v.w} ${v.h}" role="img" aria-label="${aria}"><g class="fl ${kind}">${v.body.join('')}</g></svg>`;
  return `<div class="flow ${extraClass}">${svg(wide, 'fw')}${svg(tall, 'fn')}${kind === 'rail' ? railNow(spec) : ''}${spec.caption ? `<p class="flowcap">${esc(spec.caption)}</p>` : ''}</div>`;
}


// ---------- work items ----------
// Every in-flight item and every finished one with an id gets items/<id>.html. Ids are checked before anything is written.
const ITEM_STATES = new Set(['now', 'need', 'blocked', 'failed', 'done', 'queued']);
const KINDS = { planned: 'Planned', 'quick fix': 'Quick fix', tweak: 'Tweak', 'picked-up PR': 'Picked-up PR' };
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const items = d.items.map(it => ({ ...it, state: ITEM_STATES.has(it.state) ? it.state : 'now', live: true }));
const finished = d.done.map(x => ({ ...x, name: x.name || x.label, state: 'done', stateLabel: x.stateLabel || 'Done', next: x.next ?? x.detail }));
{
  const seen = new Set(), problems = [];
  for (const [what, list] of [['items', items], ['done', finished]]) for (const [i, x] of list.entries()) {
    const who = `${what}[${i}] "${x.name || '(no name)'}"`;
    if (x.id == null || x.id === '') { if (what === 'items') problems.push(`${who} has no id`); continue; }
    if (typeof x.id !== 'string' || !ID.test(x.id)) problems.push(`${who} has an unsafe id ${JSON.stringify(x.id)}: use lower-case letters, digits and hyphens`);
    else if (seen.has(x.id)) problems.push(`${who} repeats the id "${x.id}"`);
    seen.add(x.id);
  }
  if (problems.length) { console.error(`render.mjs: nothing written.\n${problems.join('\n')}`); process.exit(1); }
}
const paged = [...items, ...finished].filter(x => x.id);
const byId = new Map(paged.map(x => [x.id, x]));
// Siblings are the items sharing a group, in JSON order (in flight, then done); ungrouped items form one group.
const groups = new Map();
for (const x of paged) { const k = x.group || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
const short = x => x.short || x.pr || x.name;

// ---------- shared pieces ----------
const sec = (title, n, body, open = true) => `<details class="sec"${open ? ' open' : ''}><summary><h2>${title}${n != null ? ` <span class="n">${n}</span>` : ''}</h2></summary>${body}</details>`;
const refRow = r => `<div class="rr"><a href="${href(r.link)}">${esc(r.label)}</a>${r.note ? ` <span class="dt">${esc(r.note)}</span>` : ''}</div>`;
const refSec = (title, list) => {
  if (!list.length) return '';
  const gs = new Map();
  for (const r of list) { const name = r.group || 'Other'; if (!gs.has(name)) gs.set(name, []); gs.get(name).push(r); }
  return sec(title, list.length, `<div class="refs">${[...gs].map(([name, rs]) => `<div class="rg"><div class="rgh">${esc(name)} <span class="rgn">${rs.length}</span></div>${rs.map(refRow).join('')}</div>`).join('')}</div>`);
};
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
// A PR's fix rounds used of its budget (QA and review together); marked once the budget is spent.
const rounds = r => r && Number.isFinite(r.used) && Number.isFinite(r.budget) ? ` · <span class="rounds${r.used >= r.budget ? ' spent' : ''}">Fix rounds ${num(r.used)} of ${num(r.budget)}</span>` : '';
// The item's card. On the overview its name is a stretched link to the item page (no script), with "Details →" too.
const itemCard = (it, page) => `<div class="card item ${it.state}${page ? ' linked' : ''}">
  <div class="hd">${page ? `<a class="name" href="${href(page)}">${esc(it.name)}</a>` : `<span class="name">${esc(it.name)}</span>`}<span class="where">${it.pr ? `<a href="${href(it.prLink)}">${esc(it.pr)}</a>` : ''}${it.pr && (it.paneLink || it.pane) ? ' · ' : ''}${it.paneLink ? `<a href="${href(it.paneLink)}">open ↗</a>` : esc(it.pane)}${rounds(it.fixRounds)}</span></div>
  ${it.rail?.length ? diagram({ steps: it.rail }, 'rail', 'bare') : ''}
  <div class="tn">${rich(it.next)}</div>${page ? `<a class="more" href="${href(page)}">Details →</a>` : ''}</div>`;

// Questions show only as a count and their Q-ids: in Pane each links the tab holding its card, which opens Approvals on it.
// A question asked through Notify has no Q-n until it is answered; it shows as "a new question".
const asked = d.needs.filter(q => q && typeof q === 'object');
const qname = q => (q.id ? esc(q.id) : 'a new question');
const inApprovals = Boolean(d.session.approvals) || asked.some(q => q.link);
const where = inApprovals ? 'in Approvals' : "in the orchestrator's chat";
const qref = q => (q.link ? `<a href="${href(q.link)}">${qname(q)}</a>` : qname(q));
const qitem = q => { const x = byId.get(q.item); return x ? short(x) : q.item; };
const joinAnd = parts => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);
const pointer = () => {
  if (!asked.length) return '';
  const n = asked.length, open = d.session.approvals || asked.find(q => q.link)?.link;
  return `<div class="apv"><span class="hg" aria-hidden="true">⏳</span><span><b>${n} question${n === 1 ? '' : 's'}</b> wait${n === 1 ? 's' : ''} for you ${where}: ${joinAnd(asked.map(q => `${qref(q)}${q.item ? ` (${esc(qitem(q))})` : ''}`))}. Questions live only there.</span>${inApprovals && open ? `<a class="btn sm" href="${href(open)}">Open Approvals →</a>` : ''}</div>`;
};

// ---------- styles ----------
const STYLE = `@font-face{font-family:"Inter Page";src:url(data:font/woff2;base64,${fs.readFileSync(path.join(here, 'inter-latin-wght-normal.woff2')).toString('base64')}) format("woff2");font-weight:100 900;font-display:block}
:root{--bg:#f8f4ef;--paper:#fffdfa;--ink:#2a2230;--muted:#75687a;--line:#e8dfd6;--link:#4a3f55;--wash:#f3ece4;--todo:#d3c8bf;
 --ok:#3f8a5a;--ok-wash:#e6f1e6;--run:#5b5fc7;--run-wash:#ecebfb;--warn:#c06a12;--warn-wash:#fcefdc;--bad:#c2414b;--bad-wash:#fbe5e6}
@media(prefers-color-scheme:dark){:root{--bg:#1b1720;--paper:#241f2b;--ink:#efe8f0;--muted:#a99fb0;--line:#3a3242;--link:#d9cfe0;--wash:#2e2736;--todo:#4d4456;
 --ok:#7fcf98;--ok-wash:#1f3326;--run:#9a9cff;--run-wash:#2a2850;--warn:#f2a65a;--warn-wash:#3c2a18;--bad:#f2808a;--bad-wash:#41222a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:13.5px/1.55 "Inter Page",system-ui,-apple-system,"Segoe UI",sans-serif;font-feature-settings:"cv11","ss01"}
a{color:var(--link);text-underline-offset:3px;text-decoration-color:var(--line)}a:hover{text-decoration-color:currentColor}
code{font:.9em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--wash);padding:1px 5px;border-radius:4px}
.wrap{max-width:860px;margin:auto;padding:18px 16px 48px}
.eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:6px}
.eyebrow:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--run);flex:none}
h1{font-size:clamp(19px,2.6vw,23px);font-weight:700;letter-spacing:-.025em;line-height:1.15;margin:4px 0 0}
.goal{margin:4px 0 0;font-size:13px;color:var(--muted)}
h2{font-size:10.5px;font-weight:650;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:22px 0 8px}
.sum{margin:10px 0 4px;font-size:15px;line-height:1.5}
.nextstep{border-left:4px solid var(--ink);background:var(--paper);padding:8px 12px;margin:10px 0;border-radius:6px;font-size:14px}
.apv{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--warn);background:var(--warn-wash);border-radius:8px;padding:9px 12px;margin:10px 0;font-size:14px}
.apv>span:nth-child(2){flex:1;min-width:200px}.apv b{color:var(--warn)}.apv .btn{margin-left:auto}
.btn{display:inline-block;background:var(--ink);color:var(--bg);padding:6px 11px;border-radius:7px;font-size:12.5px;font-weight:600;text-decoration:none;white-space:nowrap}
.btn.sm{padding:3px 9px;font-size:11.5px;border-radius:6px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin:12px 0 6px}
.tile{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--paper)}.tile b{display:block;font-size:22px;line-height:1.3}.tile span{font-size:12px;color:var(--muted)}
.tile.ok b{color:var(--ok)}.tile.run b{color:var(--run)}.tile.need b{color:var(--warn)}.tile.blk b{color:var(--bad)}
.pbar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--line);margin:6px 0 2px}.pbar i{display:block}
.pbar .ok,.legend .ok:before{background:var(--ok)}.pbar .run,.legend .run:before{background:var(--run)}.pbar .need,.legend .need:before{background:var(--warn)}.pbar .blk,.legend .blk:before{background:var(--bad)}
.legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted);margin-bottom:8px}.legend span:before{content:"";display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:8px}
.item{border-left:3px solid var(--line)}.item.now{border-left-color:var(--run)}.item.need{border-left-color:var(--warn)}.item.blocked,.item.failed{border-left-color:var(--bad)}.item.done{border-left-color:var(--ok)}.item.queued{border-left-style:dashed}
.card.linked{position:relative;transition:border-color .1s}.card.linked:hover{border-color:var(--ink)}
.card.linked .name:after{content:"";position:absolute;inset:0;border-radius:8px}
.card.linked .where a,.card.linked .tn a{position:relative;z-index:1}.card.linked .more{z-index:1}
.card .more{position:absolute;right:16px;bottom:10px;font-size:12.5px;text-decoration:none}.card .more:hover{text-decoration:underline}.card.linked .tn{padding-right:76px}
.hd{display:flex;justify-content:space-between;gap:6px 12px;flex-wrap:wrap;align-items:baseline}
.name{font-size:14.5px;font-weight:650;color:var(--ink);text-decoration:none;letter-spacing:-.01em}
.where{font-size:11.5px;color:var(--muted)}.where a{color:var(--muted)}
.rounds.spent{color:var(--warn);font-weight:650}
.tn{font-size:12.5px;color:var(--muted);overflow-wrap:anywhere}
.flow{container-type:inline-size;background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.flow svg{width:100%;height:auto;display:block}.flow .fn{display:none;max-width:380px;margin:auto}
@container (max-width:600px){.flow .fw{display:none}.flow .fn{display:block}}
.flow.bare{background:none;border:0;padding:0;margin:8px 0 4px}.flow.bare .fn{max-width:none;margin:0}
.railnow{display:none;margin:2px 0 0;font-size:11.5px;color:var(--muted)}
@container (max-width:600px){.railnow{display:block}}
.flowcap{margin:4px 0 0;text-align:center;font-size:11.5px;color:var(--muted)}
.fl text{font:500 14px "Inter Page",system-ui,sans-serif;fill:var(--ink)}.fl text.mut{fill:var(--muted)}
.fl text.on{font-weight:700}.fl text.now{fill:var(--run)}.fl text.need{fill:var(--warn)}.fl text.blocked,.fl text.failed{fill:var(--bad)}
.fl .tag{font-size:10.5px;font-weight:700;letter-spacing:.1em}.fl .bang{font-size:11px;font-weight:800;fill:var(--paper)}
.fl.rail text{font-size:13px}
.done-list{display:grid;gap:0;background:var(--paper);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.done-list div{padding:6px 14px;border-top:1px solid var(--line);font-size:12.5px}.done-list div:first-child{border-top:0}
.done-list .ck{color:var(--ok);font-weight:800;margin-right:8px}.done-list .dt{color:var(--muted)}
details{margin-top:14px;font-size:12px;color:var(--muted)}summary{cursor:pointer}
.choices{display:flex;gap:5px;flex-wrap:wrap;font-size:12px}
.choice{border:1px solid var(--line);border-radius:5px;padding:1px 8px;color:var(--muted)}
.choice.picked{border-color:var(--ok);color:var(--ok);background:var(--ok-wash);font-weight:600}
.why{font-size:12px;color:var(--muted);margin-top:6px}
.decs{background:var(--paper);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.dec{margin:0;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink)}.dec:first-child{border-top:0}
.dec summary{list-style:none;cursor:pointer;padding:6px 14px;display:flex;gap:8px;align-items:baseline}
.dec summary::-webkit-details-marker,.sec>summary::-webkit-details-marker{display:none}
.dec summary:after{content:"›";margin-left:auto;color:var(--muted);transition:transform .15s}.dec[open] summary:after{transform:rotate(90deg)}
.dec summary:hover{background:var(--wash)}
.did{display:inline-block;min-width:30px;white-space:nowrap;flex:none;color:var(--muted);font-variant-numeric:tabular-nums}
.dbody{padding:2px 14px 10px 52px}.dq{font-weight:600;margin-bottom:6px}.dmeta{font-size:11px;color:var(--muted);margin-top:6px}
.refs{display:grid;grid-template-columns:minmax(0,1fr);background:var(--paper);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.rg{border-top:1px solid var(--line)}.rg:first-child{border-top:0}
.rgh{padding:8px 14px 2px;overflow-wrap:anywhere;font-size:10.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.rgn{margin-left:2px;font-weight:500;opacity:.7}
.rr{display:flex;gap:8px;align-items:baseline;padding:3px 14px 3px 24px;font-size:12.5px;min-width:0}.rg .rr:last-child{padding-bottom:9px}
.rr a{overflow-wrap:anywhere}.rr .dt{color:var(--muted);flex:1;min-width:0;overflow-wrap:anywhere}
.sec{margin:0}.sec>summary{list-style:none;cursor:pointer;display:block;border-radius:6px}
.sec>summary h2{display:flex;align-items:center;gap:6px;margin:20px 0 8px}
.sec>summary h2:before{content:"›";font-size:13px;transition:transform .15s;transform:rotate(90deg);display:inline-block;width:8px}
.sec:not([open])>summary h2:before{transform:none}
.sec>summary:hover h2{color:var(--ink)}
.sec .n{font-weight:600;background:var(--wash);color:var(--muted);border-radius:999px;padding:0 6px;font-size:10px;letter-spacing:0}
.crumb{font-size:13px;color:var(--muted);margin:0 0 6px;overflow-wrap:anywhere}.crumb a{color:var(--link)}
.kv{display:grid;grid-template-columns:150px minmax(0,1fr);gap:6px 14px;font-size:14px;margin:10px 0}.kv dt{color:var(--muted)}.kv dd{margin:0;overflow-wrap:anywhere}
.ctab{width:100%;border-collapse:collapse;font-size:14px;background:var(--paper);border:1px solid var(--line);border-radius:8px;color:var(--ink)}
.ctab th,.ctab td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}.ctab tr:last-child>*{border-bottom:0}
.ctab th{width:130px;color:var(--muted);font-weight:400}.ctab .nr,.ctab .dt{color:var(--muted)}.ctab tr.wait th,.ctab tr.wait b{color:var(--warn)}
.sib{display:flex;flex-wrap:wrap;gap:6px}.sib a{border:1px solid var(--line);border-radius:99px;padding:2px 10px;font-size:13px;text-decoration:none;color:var(--ink)}.sib a.cur{background:var(--ink);color:var(--paper)}
.navbtns{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin:18px 0;font-size:14px}.navbtns .nx{text-align:right}
@media(max-width:640px){.dbody{padding-left:14px}.kv{grid-template-columns:1fr;gap:0}.kv dd{margin-bottom:8px}.ctab th{width:96px}.navbtns{grid-template-columns:1fr 1fr}.navbtns .up{grid-column:1/-1;grid-row:2;text-align:center}}`;
const doc = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta http-equiv="refresh" content="60"><meta http-equiv="Content-Security-Policy" content="script-src 'none'">
<title>${esc(title)}</title>
<style>
${STYLE}
</style></head><body><div class="wrap">
${body}
</div></body></html>
`;

// ---------- overview ----------
const all = [...items, ...finished];
const tally = { ok: finished.length + items.filter(i => i.state === 'done').length, run: items.filter(i => i.state === 'now').length,
  need: items.filter(i => i.state === 'need').length, blk: items.filter(i => i.state === 'blocked' || i.state === 'failed').length,
  queued: items.filter(i => i.state === 'queued').length };
const TILE = [['ok', 'done'], ['run', 'in progress'], ['need', 'waiting on you'], ['blk', 'blocked']];
const tiles = !all.length ? '' : `<div class="tiles"><div class="tile"><b>${all.length}</b><span>work items</span></div>${TILE.map(([k, label]) => `<div class="tile ${k}"><b>${tally[k]}</b><span>${label}</span></div>`).join('')}${tally.queued ? `<div class="tile"><b>${tally.queued}</b><span>queued</span></div>` : ''}</div>
<div class="pbar">${TILE.filter(([k]) => tally[k]).map(([k]) => `<i class="${k}" style="width:${(100 * tally[k] / all.length).toFixed(1)}%"></i>`).join('')}</div>
<div class="legend">${TILE.map(([k, label]) => `<span class="${k}">${label}</span>`).join('')}</div>`;
// The flow's caption says what the Session is about; it sits in the Order of work diagram, or under the title when that is not drawn.
const showFlow = d.session.flow?.steps?.length && d.items.length > 1;
const goal = !showFlow && d.session.flow?.caption ? `<p class="goal">${esc(d.session.flow.caption)}</p>` : '';
const pageOf = x => (x.id ? `items/${x.id}.html` : null);
const overview = doc(d.session.title, `<div class="eyebrow">${esc(d.session.eyebrow)}</div><h1>${esc(d.session.title)}</h1>${goal}
${d.session.summary ? `<p class="sum">${rich(d.session.summary)}</p>` : ''}
${d.session.nextStep ? `<div class="nextstep"><b>Next step:</b> ${rich(d.session.nextStep)}</div>` : ''}
${pointer()}
${tiles}
${sec('In flight', items.length, items.length ? items.map(it => itemCard(it, pageOf(it))).join('') : `<p class="tn">${finished.length ? 'Nothing in flight.' : 'No workers yet.'}</p>`)}
${showFlow ? sec('Order of work', null, diagram(d.session.flow, 'boxes')) : ''}
${finished.length ? sec('Done', finished.length, `<div class="done-list">${finished.map(x => `<div><span class="ck">✓</span><a href="${href(pageOf(x) || x.link)}">${esc(x.name)}</a> <span class="dt">${esc(x.detail || '')}</span></div>`).join('')}</div>`) : ''}
${d.decisions.length ? sec('Decisions', d.decisions.length, `<div class="decs">${d.decisions.map(x => `<details class="dec"><summary><span class="did">${esc(x.id)}</span><span class="dans">${esc(x.answer)}</span></summary><div class="dbody">
  ${x.q ? `<div class="dq">${esc(x.q)}</div>` : ''}
  ${Array.isArray(x.options) ? `<div class="choices">${x.options.map(o => `<span class="choice${o === x.chosen ? ' picked' : ''}">${o === x.chosen ? '✓ ' : ''}${esc(o)}</span>`).join('')}</div>` : ''}
  ${x.note ? `<div class="why">${esc(x.note)}</div>` : ''}
  <div class="dmeta">${esc([x.by && `Answered by ${x.by}`, x.when, x.ref].filter(Boolean).join(' · '))}</div></div></details>`).join('')}</div>`) : ''}
${refSec('Sources', d.sources)}
${refSec('Relevant links', d.links)}
${sec('Settings', null, `<p class="tn">${rich(d.session.settings)}</p>`, false)}`);

// ---------- item pages ----------
// The fixed Everything rows (D-L6): each shows a link or a short reason, and a gap shows as "Not recorded".
const ROWS = [['plan', 'Plan'], ['task', 'Task'], ['pr', 'Pull request'], ['qa', 'QA'], ['review', 'Review'], ['decisions', 'Decisions'],
  ['depends', 'Depends on'], ['worker', 'Worker'], ['trace', 'Trace'], ['evidence', 'Evidence'], ['postmortem', 'Post-mortem']];
const ALWAYS = new Set(['pr', 'qa', 'review', 'worker', 'trace', 'postmortem']);
const refCell = v => [].concat(v).filter(Boolean).map(r => typeof r === 'string' ? esc(r)
  : `${r.link ? `<a href="${href(r.link)}">${esc(r.label || r.link)}</a>` : esc(r.label)}${r.note ? `${r.label || r.link ? ' · ' : ''}<span class="dt">${esc(r.note)}</span>` : ''}`).join('<br>');
const NR = '<span class="nr">Not recorded</span>';
const everything = x => {
  const refs = x.refs && typeof x.refs === 'object' ? x.refs : {};
  const rows = [];
  for (const q of asked.filter(q => q.item === x.id)) rows.push(`<tr class="wait"><th>Waiting</th><td><b>${q.id ? esc(q.id) : 'A new question'} waits ${where}</b>${q.link ? ` <a href="${href(q.link)}">Open in Approvals →</a>` : ''}</td></tr>`);
  const decided = d.decisions.filter(dc => dc.item === x.id).map(dc => `${esc(dc.id)} ${esc(dc.answer)}`);
  for (const [key, label] of ROWS) {
    let cell = refs[key] ? refCell(refs[key]) : '';
    if (key === 'decisions' && decided.length) cell = [cell, decided.join(' · ')].filter(Boolean).join('<br>');
    const fixed = ALWAYS.has(key) || (key === 'plan' && x.kind === 'planned') || (key === 'task' && x.kind !== 'planned' && !refs.plan);
    if (cell || fixed) rows.push(`<tr><th>${label}</th><td>${cell || NR}</td></tr>`);
  }
  return `<table class="ctab">${rows.join('')}</table>`;
};
const local = u => esc(u); // links between pages this run writes: already relative to items/
const itemPage = x => {
  const k = x.group || '', members = groups.get(k), i = members.indexOf(x), prev = members[i - 1], next = members[i + 1];
  const top = `../${encodeURIComponent(path.basename(outPath))}`;
  const kind = KINDS[x.kind] || 'Work item';
  return doc(`${x.name} · ${d.session.title}`, `<p class="crumb"><a href="${local(top)}">${esc(d.session.title)}</a>${k ? ` › ${esc(k)}` : ''} › <b>${esc(short(x))}</b></p>
<div class="eyebrow">${esc([kind + (k ? ` (${k})` : ''), d.session.eyebrow].filter(Boolean).join(' · '))}</div><h1>${esc(x.name)}</h1>
<dl class="kv"><dt>Asked for</dt><dd>${x.asked ? rich(x.asked) : NR}</dd><dt>What changes</dt><dd>${x.changes ? rich(x.changes) : NR}</dd><dt>Where it stands</dt><dd>${x.stateLabel ? `<b>${esc(x.stateLabel)}</b>: ` : ''}${rich(x.next) || NR}</dd></dl>
${itemCard(x, null)}
${sec('Everything for this item', null, everything(x))}
${members.length > 1 ? sec(k ? esc(k) : 'Work items', members.length, `<div class="sib">${members.map(m => `<a${m === x ? ' class="cur" aria-current="page"' : ''} href="${local(m.id + '.html')}">${esc(short(m))}</a>`).join('')}</div>`) : ''}
<nav class="navbtns"><span>${prev ? `<a class="prev" href="${local(prev.id + '.html')}">← ${esc(short(prev))}</a>` : ''}</span><a class="up" href="${local(top)}">↑ Back to overview</a><span class="nx">${next ? `<a class="next" href="${local(next.id + '.html')}">${esc(short(next))} →</a>` : ''}</span></nav>`);
};

// ---------- write ----------
const itemsDir = path.join(path.dirname(outPath), 'items');
if (paged.length) fs.mkdirSync(itemsDir, { recursive: true });
let biggest = 0;
base = '../';
for (const x of paged) { const page = itemPage(x); biggest = Math.max(biggest, page.length); fs.writeFileSync(path.join(itemsDir, `${x.id}.html`), page); }
fs.writeFileSync(outPath, overview);
console.log(`wrote ${outPath} (${Math.round(overview.length / 1024)} KB)${paged.length ? ` and ${paged.length} item page${paged.length === 1 ? '' : 's'} in ${itemsDir} (largest ${Math.round(biggest / 1024)} KB)` : ''}`);
