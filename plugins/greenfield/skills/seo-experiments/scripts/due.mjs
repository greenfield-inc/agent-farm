#!/usr/bin/env node
// Lists every experiment record in .seo/experiments/ with its ship date and its 21- and 42-day read dates,
// and says which reads are due. Uses only node: builtins.
//
//   node due.mjs [--repo <dir>] [--ref <git ref>] [--today YYYY-MM-DD] [--json]
//
// Ship date: the record's `live` field when set, else the committer date (UTC) of the earliest first-parent
// commit on --ref that added the record file. A record with neither is not shipped yet.
// Each read's window ends ship + N days and becomes runnable 3 days later (Search Console lag).
// A read is "done" when read_N holds a date, "due" from its runnable date, and "too early" before it.
// Exit 0 with the list; exit 1 on bad usage, an unparseable record, a bad date, or a git failure.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const READS=[21,42];
const LAG=3;
const DATE=/^\d{4}-\d{2}-\d{2}$/;

function fail(message){
  process.stderr.write(`due.mjs: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv){
  const opts={repo:process.cwd(),ref:'HEAD',today:new Date().toISOString().slice(0,10),json:false};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--json'){opts.json=true;continue;}
    if(['--repo','--ref','--today'].includes(arg)){
      if(i+1>=argv.length)fail(`${arg} needs a value`);
      opts[arg.slice(2)]=argv[++i];
      continue;
    }
    fail(`unknown argument ${arg}. Usage: node due.mjs [--repo <dir>] [--ref <git ref>] [--today YYYY-MM-DD] [--json]`);
  }
  if(!validDate(opts.today))fail(`--today must be a real date in YYYY-MM-DD form, got "${opts.today}"`);
  return opts;
}

function validDate(text){
  const time=DATE.test(text)?Date.parse(`${text}T00:00:00Z`):NaN;
  return !Number.isNaN(time)&&new Date(time).toISOString().slice(0,10)===text;
}

function addDays(date,days){
  const d=new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}

// Frontmatter is the block between the first two `---` lines: `key: value` lines, where ` # ...` starts a comment.
function parseFrontmatter(text,file){
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  if(lines[0].trim()!=='---')fail(`${file}: no frontmatter (the file must start with a --- line)`);
  const end=lines.indexOf('---',1);
  if(end===-1)fail(`${file}: frontmatter has no closing --- line`);
  const fields={};
  for(let i=1;i<end;i++){
    const line=lines[i].replace(/\s+#(\s.*)?$/,'').trimEnd();
    if(!line.trim()||line.trim().startsWith('#'))continue;
    const match=/^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if(!match)fail(`${file}: line ${i+1} is not "key: value": ${lines[i]}`);
    fields[match[1]]=match[2].trim();
  }
  if(!fields.id)fail(`${file}: frontmatter has no id`);
  for(const key of ['live','read_21','read_42']){
    if(fields[key]&&!validDate(fields[key]))fail(`${file}: ${key} must be a real date in YYYY-MM-DD form, got "${fields[key]}"`);
  }
  return fields;
}

function gitShipDate(repo,ref,rel){
  let out;
  try{
    out=execFileSync('git',['-C',repo,'log',ref,'--first-parent','--diff-filter=A','--format=%cI','--',rel],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  }catch(error){
    fail(`git log failed for ${rel} on ${ref}: ${String(error.stderr||error.message).trim()}`);
  }
  const dates=out.split('\n').filter(Boolean);
  if(!dates.length)return null;
  return new Date(dates[dates.length-1]).toISOString().slice(0,10);
}

function record(repo,ref,today,file){
  const abs=path.join(repo,'.seo','experiments',file);
  const rel=path.join('.seo','experiments',file);
  const fields=parseFrontmatter(fs.readFileSync(abs,'utf8'),rel);
  let ship_date=null,ship_source=null;
  if(fields.live){ship_date=fields.live;ship_source='live';}
  else{
    ship_date=gitShipDate(repo,ref,rel);
    if(ship_date)ship_source='git';
  }
  const reads=ship_date?READS.map(days=>{
    const window_end=addDays(ship_date,days);
    const runnable_from=addDays(window_end,LAG);
    const done=fields[`read_${days}`]||null;
    const state=done?'done':today>=runnable_from?'due':'too early';
    return {days,window_end,runnable_from,done,state};
  }):[];
  const open=reads.find(read=>!read.done);
  return {
    id:fields.id,
    file:rel.split(path.sep).join('/'),
    ship_date,
    ship_source,
    status:fields.status||null,
    reads,
    next:open?{days:open.days,date:open.runnable_from}:null,
  };
}

function textLine(rec){
  if(!rec.ship_date)return `${rec.id}  not shipped`;
  const reads=rec.reads.map(read=>{
    if(read.state==='done')return `${read.days}d done ${read.done}`;
    if(read.state==='due')return `${read.days}d DUE since ${read.runnable_from}`;
    return `${read.days}d too early, review ${read.runnable_from}`;
  });
  return `${rec.id}  shipped ${rec.ship_date} (${rec.ship_source})  ${reads.join('  ')}`;
}

const opts=parseArgs(process.argv.slice(2));
const repo=path.resolve(opts.repo);
const dir=path.join(repo,'.seo','experiments');
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(name=>name.endsWith('.md')):[];
const records=files.map(file=>record(repo,opts.ref,opts.today,file)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);

if(opts.json){
  process.stdout.write(`${JSON.stringify(records,null,2)}\n`);
}else{
  for(const rec of records)process.stdout.write(`${textLine(rec)}\n`);
  const due=records.reduce((count,rec)=>count+rec.reads.filter(read=>read.state==='due').length,0);
  process.stdout.write(`Due now: ${due}\n`);
}
