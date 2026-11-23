#!/usr/bin/env node
// Summarizes one answer-panel run per engine, with every numerator and denominator shown.
// Offline, no dependencies, node: builtins only.
//
//   node summarize-panel.mjs <runs.csv> [--json]
//
// Header (exact): prompt_id,engine,repetition,run_date,status,mentioned,recommended,cited,citation_correct
// status is answered or unavailable. The four outcome columns are yes, no or empty (unscored).
// Per engine, never averaged across engines:
//   availability = answered / planned slots (every row is a planned slot)
//   mentioned, recommended, cited = yes / (answered rows scored yes or no)
//   correctness = citation_correct yes / (answered rows with cited yes and citation_correct yes or no)
// Unavailable rows and empty values leave the denominator; they are never counted as no.
// A rate is n/d rounded to 4 decimals, or null when d is 0.
// Exit 0 with the summary, 1 on a wrong header or an unknown value (naming the line), 2 on bad usage.
import {readFileSync} from 'node:fs';

const HEADER = ['prompt_id', 'engine', 'repetition', 'run_date', 'status', 'mentioned', 'recommended', 'cited', 'citation_correct'];
const STATUSES = new Set(['answered', 'unavailable']);
const VALUES = new Set(['yes', 'no', '']);
const OUTCOMES = ['mentioned', 'recommended', 'cited', 'citation_correct'];

class InputError extends Error {}

// RFC 4180: fields may be wrapped in double quotes; a doubled quote inside is a literal quote.
// Returns records as {line, fields}, where line is the line the record starts on.
function parseCsv(text) {
  const records = [];
  let fields = [], field = '', quoted = false, line = 1, start = 1, i = 0;
  const endRecord = () => {
    fields.push(field);
    if (!(fields.length === 1 && fields[0] === '')) records.push({line: start, fields});
    fields = []; field = '';
  };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { quoted = false; i++; continue; }
      if (c === '\n') line++;
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { quoted = true; i++; continue; }
    if (c === ',') { fields.push(field); field = ''; i++; continue; }
    if (c === '\r' && text[i + 1] === '\n') { i++; continue; }
    if (c === '\n') { endRecord(); line++; start = line; i++; continue; }
    field += c; i++;
  }
  if (quoted) throw new InputError(`line ${start}: unterminated quoted field`);
  endRecord();
  return records;
}

const rate = (n, d) => ({n, d, rate: d === 0 ? null : Math.round((n / d) * 10000) / 10000});

function summarize(text) {
  const records = parseCsv(text.replace(/^﻿/, ''));
  if (records.length === 0) throw new InputError('line 1: empty file, expected header ' + HEADER.join(','));
  const [head, ...rows] = records;
  if (head.fields.map((f) => f.trim()).join(',') !== HEADER.join(','))
    throw new InputError(`line ${head.line}: wrong header, expected ${HEADER.join(',')}`);
  const byEngine = new Map();
  for (const {line, fields} of rows) {
    if (fields.length !== HEADER.length)
      throw new InputError(`line ${line}: expected ${HEADER.length} fields, found ${fields.length}`);
    const row = Object.fromEntries(HEADER.map((k, j) => [k, fields[j].trim()]));
    if (!STATUSES.has(row.status))
      throw new InputError(`line ${line}: unknown status "${row.status}", expected answered or unavailable`);
    for (const k of OUTCOMES)
      if (!VALUES.has(row[k])) throw new InputError(`line ${line}: unknown ${k} "${row[k]}", expected yes, no or empty`);
    if (!row.engine) throw new InputError(`line ${line}: engine is empty`);
    if (!byEngine.has(row.engine)) byEngine.set(row.engine, []);
    byEngine.get(row.engine).push(row);
  }
  const engines = [...byEngine.keys()].sort().map((engine) => {
    const planned = byEngine.get(engine);
    const answered = planned.filter((r) => r.status === 'answered');
    const scored = (k) => answered.filter((r) => r[k] === 'yes' || r[k] === 'no');
    const share = (k) => rate(scored(k).filter((r) => r[k] === 'yes').length, scored(k).length);
    const citations = answered.filter((r) => r.cited === 'yes' && (r.citation_correct === 'yes' || r.citation_correct === 'no'));
    return {
      engine,
      planned: planned.length,
      answered: answered.length,
      availability: rate(answered.length, planned.length),
      mentioned: share('mentioned'),
      recommended: share('recommended'),
      cited: share('cited'),
      correctness: rate(citations.filter((r) => r.citation_correct === 'yes').length, citations.length),
    };
  });
  return {engines};
}

const cell = ({n, d, rate: r}) => `${n}/${d} (${r === null ? 'n/a' : (r * 100).toFixed(1) + '%'})`;

function table({engines}) {
  const cols = ['engine', 'planned', 'answered', 'availability', 'mentioned', 'recommended', 'cited', 'correctness'];
  const lines = [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`];
  for (const e of engines)
    lines.push(`| ${[e.engine, e.planned, e.answered, cell(e.availability), cell(e.mentioned), cell(e.recommended), cell(e.cited), cell(e.correctness)].join(' | ')} |`);
  lines.push('', 'Each engine stands alone; never average them. A sample of answers, not market share.');
  return lines.join('\n');
}

function main(argv) {
  const json = argv.includes('--json');
  const files = argv.filter((a) => a !== '--json');
  if (files.length !== 1 || files[0].startsWith('--')) {
    console.error('usage: node summarize-panel.mjs <runs.csv> [--json]');
    return 2;
  }
  let text;
  try { text = readFileSync(files[0], 'utf8'); } catch (e) { console.error(`cannot read ${files[0]}: ${e.message}`); return 2; }
  try {
    const summary = summarize(text);
    console.log(json ? JSON.stringify(summary, null, 2) : table(summary));
    return 0;
  } catch (e) {
    if (!(e instanceof InputError)) throw e;
    console.error(`${files[0]}: ${e.message}`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
