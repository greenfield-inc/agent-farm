#!/usr/bin/env node
// Agent sessions: the person's prompts to Claude Code and Codex, Panes started, planner and
// worker status files, and decision-log lines from Pane Session folders, all since the cutoff.
// Prompts are clipped to one line; transcripts are not read.
//
//   node sessions.mjs [--since ISO] [--pane-dir DIR]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {options, runJson, emit, clip} from './lib.mjs';

const opt = options({'pane-dir': {type: 'string'}});
const since = opt.since.getTime();
const home = os.homedir();
const paneDir = opt['pane-dir'] ?? process.env.PANE_DIR ?? path.join(home, '.pane');
const lines = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').flatMap(l => { try { return l ? [JSON.parse(l)] : []; } catch { return []; } }) : [];
const project = p => path.basename(String(p ?? '')).replace(/^__orchestration_session_.*/, 'Pane Session');
// Prompts Pane hands to an agent ("Read and follow .pane/prompts/…") are dispatches, not typing.
const actorOf = text => /^Read and follow \.pane\/prompts\//.test(text) ? 'dispatch' : 'person';

for (const h of lines(path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(home, '.claude'), 'history.jsonl'))) {
  if (h.timestamp >= since && h.display?.trim()) emit({time: new Date(h.timestamp).toISOString(), source: 'claude', actor: actorOf(h.display), what: `[${project(h.project)}] ${clip(h.display, 140)}`, link: null});
}
for (const h of lines(path.join(process.env.CODEX_HOME ?? path.join(home, '.codex'), 'history.jsonl'))) {
  if (h.ts * 1000 >= since && h.text?.trim()) emit({time: new Date(h.ts * 1000).toISOString(), source: 'codex', actor: actorOf(h.text), what: clip(h.text, 140), link: null});
}

// runpane reports pane times shifted ahead by the local UTC offset; shift them back.
const panes = await runJson('runpane', ['panes', 'list', '--json', '--pane-dir', paneDir]);
for (const p of panes?.panes ?? []) {
  const t = Date.parse(p.createdAt) - new Date().getTimezoneOffset() * 60_000;
  if (t >= since) emit({time: new Date(t).toISOString(), source: 'pane', actor: null, what: `Started Pane "${p.name}" in ${p.repoName}`, link: null});
}

// Session folders: status files (any JSON with `state` and `step`, one per planner or worker)
// and decisions.md logs.
const sessionsDir = path.join(paneDir, 'sessions');
const walk = (dir, depth, out = []) => {
  for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, {withFileTypes: true}) : []) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && depth > 0) walk(p, depth - 1, out);
    else if (/(\.json|^decisions\.md)$/.test(e.name) && fs.statSync(p).mtimeMs >= since) out.push(p);
  }
  return out;
};
const sinceDay = new Date(since).toLocaleDateString('en-CA');
for (const file of walk(sessionsDir, 6)) {
  const where = path.relative(sessionsDir, path.dirname(file)).split(path.sep).slice(1).filter(s => s !== 'plans' && s !== 'status').join('/') || 'session';
  if (file.endsWith('.json')) {
    let s; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!s?.state || !('step' in s)) continue;
    const name = path.basename(file, '.json'), label = name === 'status' ? where : `${where}/${name}`;
    // A date-only `updated` says too little; use the file's modified time then.
    const t = /T/.test(s.updated ?? '') ? Date.parse(s.updated) : fs.statSync(file).mtimeMs;
    if (!(t >= since)) continue;
    emit({time: new Date(t).toISOString(), source: 'pane-status', actor: s.profile ?? null, what: `${label}: ${s.state}${s.step ? `, ${s.step}` : ''}${s.needs_you ? ' (needs you)' : ''}`, link: s.pr ?? null});
    continue;
  }
  // Decision lines look like "- D-12 (10/29) text (who)" and carry a date but no time.
  // A month/day is read in the cutoff's year or the next, whichever falls in the window.
  const year = new Date(since).getFullYear(), today = new Date().toLocaleDateString('en-CA');
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/^\s*-\s*(D-\d+\w*)(?: revised)? \((\d{1,2})\/(\d{1,2})\)\s*(.+)$/gm)) {
    const day = [year, year + 1].map(y => `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`).find(d => d >= sinceDay && d <= today);
    if (day) emit({time: day, source: 'decision', actor: m[4].match(/\(([^()]+)\)\s*$/)?.[1] ?? null, what: `${where} ${m[1]}: ${m[4].replace(/^:\s*/, '')}`, link: null});
  }
}
