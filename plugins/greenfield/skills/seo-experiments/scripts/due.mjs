#!/usr/bin/env node
// Lists every experiment record in .seo/experiments/ with its ship date and its 21- and 42-day read dates,
// and says which reads are due. Uses only node: builtins.
//
//   node due.mjs [--repo <dir>] [--ref <git ref>] [--today YYYY-MM-DD] [--json | --check]
//
// Records: with --ref, the records as they are on that ref (read through git), so a run from a feature branch
// still sees what is due on the default branch; without --ref, the working tree, including local drafts.
// Ship date: the record's `live` field when set, else the committer date (UTC) of the earliest first-parent
// commit on the ref (default HEAD) that added the record file. A record with neither is not shipped yet.
// Each read's window ends ship + N days and becomes runnable 3 days later (Search Console lag).
// A read is "done" when read_N holds a date, "due" from its runnable date, and "too early" before it.
// A record with status: closed keeps its dates, but its open reads are "closed": never due, no next read.
// A Markdown file with no frontmatter is a legacy record from the older per-file format: it is listed as
// "legacy" (needs migration) and the rest of the list still runs.
// --check answers "is anything due today" in one JSON line for a scheduled run: the due reads, records to migrate,
// and the review, which is due when .seo/access.md is missing or its cadence (weekly 7 days, monthly 30, default
// monthly) has passed since the last merged .seo/ change (the newest first-parent commit on the ref touching .seo/).
// It also names the product's local folder (working memory and raw pulls), one per repository whatever the worktree:
// ~/.local/state/agent-farm/seo/<repository name>-<12 hex of the git common directory's sha256>.
// Exit 0 with the list; exit 1 on bad usage, an unparseable record, a bad date, or a git failure.
// With --check: exit 0 when something is due, 3 when nothing is.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const READS=[21,42];
const LAG=3;
const CADENCE={weekly:7,monthly:30};
const DATE=/^\d{4}-\d{2}-\d{2}$/;

function fail(message){
  process.stderr.write(`due.mjs: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv){
  const opts={repo:process.cwd(),ref:null,today:new Date().toISOString().slice(0,10),json:false,check:false};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--json'){opts.json=true;continue;}
    if(arg==='--check'){opts.check=true;continue;}
    if(['--repo','--ref','--today'].includes(arg)){
      if(i+1>=argv.length)fail(`${arg} needs a value`);
      opts[arg.slice(2)]=argv[++i];
      continue;
    }
    fail(`unknown argument ${arg}. Usage: node due.mjs [--repo <dir>] [--ref <git ref>] [--today YYYY-MM-DD] [--json | --check]`);
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
function frontmatter(text,file){
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  if(lines[0].trim()!=='---')return null;
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
  return fields;
}

function parseFrontmatter(text,file){
  const fields=frontmatter(text,file);
  if(!fields)return null;
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

function git(repo,args,what){
  try{
    return execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  }catch(error){
    fail(`${what}: ${String(error.stderr||error.message).trim()}`);
  }
}

// A file's text on the ref (through git) or in the working tree; null when it does not exist.
function readFile(repo,ref,rel){
  if(!ref){
    const file=path.join(repo,rel);
    return fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  }
  try{execFileSync('git',['-C',repo,'cat-file','-e',`${ref}:${rel}`],{stdio:'ignore'});}catch{return null;}
  return git(repo,['show',`${ref}:${rel}`],`cannot read ${rel} on ${ref}`);
}

function review(repo,ref,today){
  const text=readFile(repo,ref,'.seo/access.md');
  const access=text===null?null:frontmatter(text,'.seo/access.md')||{};
  const cadence=access?.cadence||'monthly';
  if(!CADENCE[cadence])fail(`.seo/access.md: cadence must be weekly or monthly, got "${cadence}"`);
  const out=git(repo,['log','-1','--first-parent','--format=%cI',ref||'HEAD','--','.seo'],'cannot read the .seo/ history').trim();
  const last=out?new Date(out).toISOString().slice(0,10):null;
  if(!access)return {access,review:{cadence:null,last,next:null,due:true,reason:'no .seo/access.md: first run'}};
  const next=last?addDays(last,CADENCE[cadence]):null;
  return {access,review:{cadence,last,next,due:!next||today>=next,reason:next?null:'no merged .seo/ change'}};
}

function memoryDir(repo){
  const common=fs.realpathSync(path.resolve(repo,git(repo,['rev-parse','--git-common-dir'],'not a git repository').trim()));
  const name=(path.basename(common)==='.git'?path.basename(path.dirname(common)):path.basename(common,'.git')).replace(/[^A-Za-z0-9._-]/g,'-');
  const key=`${name}-${createHash('sha256').update(common).digest('hex').slice(0,12)}`;
  return path.join(os.homedir(),'.local','state','agent-farm','seo',key);
}

function check(records,repo,ref,today){
  const {access,review:rev}=review(repo,ref,today);
  const reads_due=records.flatMap(rec=>rec.reads.filter(read=>read.state==='due').map(read=>({id:rec.id,days:read.days,since:read.runnable_from})));
  const legacy=records.filter(rec=>rec.legacy).map(rec=>rec.id);
  const later=[...records.flatMap(rec=>rec.reads.filter(read=>read.state==='too early').map(read=>read.runnable_from)),...(rev.due?[]:[rev.next])].sort();
  const due=reads_due.length>0||legacy.length>0||rev.due;
  return {today,due,reads_due,legacy,review:rev,next_due:later[0]||null,access,memory:memoryDir(repo)};
}

function listRecords(repo,ref){
  if(ref){
    git(repo,['rev-parse','--verify','--quiet',`${ref}^{commit}`],`${ref} is not a commit`);
    try{execFileSync('git',['-C',repo,'cat-file','-e',`${ref}:.seo/experiments`],{stdio:'ignore'});}catch{return [];}
    const out=git(repo,['ls-tree','--name-only',`${ref}:.seo/experiments`],`cannot list .seo/experiments on ${ref}`);
    return out.split('\n').filter(name=>name.endsWith('.md')).map(name=>({name,text:()=>git(repo,['show',`${ref}:.seo/experiments/${name}`],`cannot read ${name} on ${ref}`)}));
  }
  const dir=path.join(repo,'.seo','experiments');
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(name=>name.endsWith('.md')).map(name=>({name,text:()=>fs.readFileSync(path.join(dir,name),'utf8')}));
}

function record(repo,ref,today,entry){
  const rel=path.join('.seo','experiments',entry.name);
  const fields=parseFrontmatter(entry.text(),rel);
  if(!fields)return {id:entry.name.replace(/\.md$/,''),file:rel.split(path.sep).join('/'),legacy:true,ship_date:null,ship_source:null,status:null,reads:[],next:null};
  let ship_date=null,ship_source=null;
  if(fields.live){ship_date=fields.live;ship_source='live';}
  else{
    ship_date=gitShipDate(repo,ref||'HEAD',rel.split(path.sep).join('/'));
    if(ship_date)ship_source='git';
  }
  const closed=fields.status==='closed';
  const reads=ship_date?READS.map(days=>{
    const window_end=addDays(ship_date,days);
    const runnable_from=addDays(window_end,LAG);
    const done=fields[`read_${days}`]||null;
    const state=done?'done':closed?'closed':today>=runnable_from?'due':'too early';
    return {days,window_end,runnable_from,done,state};
  }):[];
  const open=reads.find(read=>read.state==='due'||read.state==='too early');
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
  if(rec.legacy)return `${rec.id}  legacy record without frontmatter: migrate it (seo-experiments, Import a legacy log)`;
  if(!rec.ship_date)return `${rec.id}  not shipped`;
  const reads=rec.reads.map(read=>{
    if(read.state==='done')return `${read.days}d done ${read.done}`;
    if(read.state==='closed')return `${read.days}d closed`;
    if(read.state==='due')return `${read.days}d DUE since ${read.runnable_from}`;
    return `${read.days}d too early, review ${read.runnable_from}`;
  });
  return `${rec.id}  shipped ${rec.ship_date} (${rec.ship_source})  ${reads.join('  ')}`;
}

const opts=parseArgs(process.argv.slice(2));
const repo=path.resolve(opts.repo);
const records=listRecords(repo,opts.ref).map(entry=>record(repo,opts.ref,opts.today,entry)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);

if(opts.check){
  const result=check(records,repo,opts.ref,opts.today);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.due?0:3);
}else if(opts.json){
  process.stdout.write(`${JSON.stringify(records,null,2)}\n`);
}else{
  for(const rec of records)process.stdout.write(`${textLine(rec)}\n`);
  const due=records.reduce((count,rec)=>count+rec.reads.filter(read=>read.state==='due').length,0);
  process.stdout.write(`Due now: ${due}\n`);
  const legacy=records.filter(rec=>rec.legacy).length;
  if(legacy)process.stdout.write(`Legacy records to migrate: ${legacy}\n`);
}
