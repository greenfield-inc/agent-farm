import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {build,resolveProfile} from '../dist/compiler.js';
import {verify} from '../dist/runtime.js';

const root=fileURLToPath(new URL('../plugins/greenfield/',import.meta.url));
const tempDir=(t,prefix)=>{const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),prefix)));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};

test('the six SEO roles resolve on Claude with the model and effort of the greenfield role each mirrors, and each builds a bundle',t=>{
 const target=tempDir(t,'greenfield-seo-');
 for(const [role,effort] of [['seo-orchestrator','medium'],['seo-strategist','high'],['seo-writer','medium'],['seo-reviewer','high'],['seo-measurer','high'],['seo-investigator','high']]){
  const main=resolveProfile(root,role).nodes.main;
  assert.deepEqual([main.harness,main.model,main.reasoning_effort],['claude','claude-opus-5-5',effort],role);
  assert.ok(main.skills.includes('seo-evidence'),`${role} bundles the evidence base`);
  const dir=path.join(target,role);fs.mkdirSync(dir);verify(build(root,role+':claude',dir));
 }
});

test('the SEO orchestrator coordinates with greenfield\'s rules and the loop, and the research roles take source, parent and docs like a planner',()=>{
 const orchestrator=resolveProfile(root,'seo-orchestrator').nodes.main;
 for(const heading of ['# Standing rules','# Coordination'])assert.ok(orchestrator.instructions.includes(heading),heading);
 for(const skill of ['orchestrate-sessions','seo-loop','seo-experiments'])assert.ok(orchestrator.skills.includes(skill),skill);
 for(const role of ['seo-strategist','seo-measurer','seo-investigator']){
  const main=resolveProfile(root,role).nodes.main;
  assert.deepEqual(Object.keys(main.argument_definitions??{}).sort(),['docs','parent','source'],role);
  assert.ok(main.instructions.includes('# Standing rules'),role);
 }
 const skills=role=>resolveProfile(root,role).nodes.main.skills;
 assert.ok(skills('seo-writer').includes('seo-page-brief')&&skills('seo-writer').includes('seo-experiments'));
 assert.ok(skills('seo-reviewer').includes('seo-claims-check')&&skills('seo-reviewer').includes('principled-review'));
 assert.ok(skills('seo-investigator').includes('seo-search-diagnosis'));
 assert.ok(skills('seo-measurer').includes('seo-read-back')&&skills('seo-measurer').includes('seo-answer-panel'));
 assert.ok(skills('seo-strategist').includes('growth-quick-wins'));
});

const panel=(t,csv,...args)=>{
 const file=path.join(tempDir(t,'answer-panel-'),'runs.csv');fs.writeFileSync(file,csv);
 return spawnSync(process.execPath,[path.join(root,'skills/seo-answer-panel/scripts/summarize-panel.mjs'),file,...args],{encoding:'utf8'});
};

test('the answer-panel summary keeps each engine apart, leaves unavailable and unscored slots out of the denominators, and counts correctness over scored citations only',t=>{
 const run=panel(t,[
  'prompt_id,engine,repetition,run_date,status,mentioned,recommended,cited,citation_correct',
  'p1,alpha,1,2026-11-01,answered,yes,no,yes,yes',
  'p1,alpha,2,2026-11-01,answered,no,no,no,',
  'p2,alpha,1,2026-11-01,unavailable,no,no,no,',
  '"p2",alpha,2,2026-11-01,answered,yes,,yes,',
  'p1,beta,1,2026-11-01,unavailable,,,,',
  'p2,beta,1,2026-11-01,unavailable,,,,',
 ].join('\n')+'\n','--json');
 assert.equal(run.status,0,run.stderr);
 const engines=Object.fromEntries(JSON.parse(run.stdout).engines.map(e=>[e.engine,e]));
 const pick=m=>m&&[m.n,m.d,m.rate];
 // alpha: 4 planned slots, 3 answered. Mentioned yes/no/yes; recommended no/no/blank; cited yes/no/yes; of the two cited rows only one has a correctness score.
 assert.deepEqual([engines.alpha.planned,engines.alpha.answered],[4,3]);
 assert.deepEqual(pick(engines.alpha.availability),[3,4,0.75]);
 assert.deepEqual(pick(engines.alpha.mentioned),[2,3,0.6667]);
 assert.deepEqual(pick(engines.alpha.recommended),[0,2,0]);
 assert.deepEqual(pick(engines.alpha.cited),[2,3,0.6667]);
 assert.deepEqual(pick(engines.alpha.correctness),[1,1,1]);
 // beta answered nothing: its rates are unknown, never zero.
 assert.deepEqual(pick(engines.beta.availability),[0,2,0]);
 for(const metric of ['mentioned','recommended','cited','correctness'])assert.deepEqual(pick(engines.beta[metric]),[0,0,null],metric);
 assert.equal(engines.overall,undefined,'engines are never averaged');
});

test('the answer-panel summary refuses an unknown status and names its line',t=>{
 const run=panel(t,'prompt_id,engine,repetition,run_date,status,mentioned,recommended,cited,citation_correct\np1,alpha,1,2026-11-01,timeout,,,,\n');
 assert.equal(run.status,1);
 assert.match(run.stderr,/line 2/);
});

test('the due list reads each experiment at 21 and 42 days from its ship date, runnable three days after the window ends',t=>{
 const repo=tempDir(t,'seo-due-');
 const git=(args,date)=>execFileSync('git',args,{cwd:repo,env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null'},encoding:'utf8'});
 const record=(id,extra='')=>{fs.mkdirSync(path.join(repo,'.seo/experiments'),{recursive:true});fs.writeFileSync(path.join(repo,`.seo/experiments/${id}.md`),`---\nid: ${id}\nhypothesis: one change lifts clicks\npages: [/a, /b]\n${extra}read_21:\nread_42:\nstatus: running\n---\n\n# ${id}\n`);};
 git(['init','-q','-b','main']);git(['config','user.email','t@example.com']);git(['config','user.name','t']);
 record('a-old');git(['add','.']);git(['commit','-qm','a'],'2026-10-01T12:00:00Z');
 record('b-new');git(['add','.']);git(['commit','-qm','b'],'2026-11-01T12:00:00Z');
 fs.mkdirSync(path.join(repo,'.seo/experiments'),{recursive:true});
 fs.writeFileSync(path.join(repo,'.seo/experiments/c-manual.md'),'---\nid: c-manual\nlive: 2026-09-01\nread_21: 2026-09-25\nread_42:\nstatus: running\n---\n');
 git(['add','.']);git(['commit','-qm','c'],'2026-11-10T12:00:00Z');
 record('d-draft');
 const run=spawnSync(process.execPath,[path.join(root,'skills/seo-experiments/scripts/due.mjs'),'--repo',repo,'--today','2026-11-21','--json'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const rows=Object.fromEntries(JSON.parse(run.stdout).map(r=>[r.id,r]));
 const reads=r=>r.reads.map(x=>[x.days,x.window_end,x.runnable_from,x.state]);
 // Merged 2026-10-01: windows end Oct 22 and Nov 12; both reads runnable by Nov 21.
 assert.deepEqual([rows['a-old'].ship_date,rows['a-old'].ship_source],['2026-10-01','git']);
 assert.deepEqual(reads(rows['a-old']),[[21,'2026-10-22','2026-10-25','due'],[42,'2026-11-12','2026-11-15','due']]);
 // Merged 2026-11-01: the 21-day window ends Nov 22, so both reads are too early.
 assert.deepEqual(reads(rows['b-new']),[[21,'2026-11-22','2026-11-25','too early'],[42,'2026-12-13','2026-12-16','too early']]);
 assert.deepEqual(rows['b-new'].next,{days:21,date:'2026-11-25'});
 // Deployed by hand: the recorded live date wins over the commit date, and a recorded read is done.
 assert.deepEqual([rows['c-manual'].ship_date,rows['c-manual'].ship_source],['2026-09-01','live']);
 assert.deepEqual(reads(rows['c-manual']),[[21,'2026-09-22','2026-09-25','done'],[42,'2026-10-13','2026-10-16','due']]);
 // Not on the branch yet: not shipped, nothing due.
 assert.deepEqual([rows['d-draft'].ship_date,rows['d-draft'].reads,rows['d-draft'].next],[null,[],null]);
});

test('the answer-panel summary refuses a header packed into one quoted field and a slot captured twice',t=>{
 const header='prompt_id,engine,repetition,run_date,status,mentioned,recommended,cited,citation_correct';
 const quoted=panel(t,`"${header}"\np1,alpha,1,2026-11-01,answered,yes,no,no,\n`);
 assert.equal(quoted.status,1);assert.match(quoted.stderr,/line 1: wrong header/);
 const twice=panel(t,`${header}\np1,alpha,1,2026-11-01,answered,yes,no,no,\np2,alpha,1,2026-11-01,answered,no,no,no,\np1,alpha,1,2026-11-01,answered,no,no,no,\n`);
 assert.equal(twice.status,1);assert.match(twice.stderr,/line 4: duplicate slot.*first on line 2/);
});

test('the due list reads the default branch\'s records from a feature branch, never schedules a closed record, and lists an old-format file for migration without stopping',t=>{
 const repo=tempDir(t,'seo-due-ref-');
 const env=date=>({...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null'});
 const git=(args,date='2026-09-01T12:00:00Z')=>execFileSync('git',args,{cwd:repo,env:env(date),encoding:'utf8'});
 const write=(name,text)=>{fs.mkdirSync(path.join(repo,'.seo/experiments'),{recursive:true});fs.writeFileSync(path.join(repo,'.seo/experiments',name),text);};
 git(['init','-q','-b','main']);git(['config','user.email','t@example.com']);git(['config','user.name','t']);
 write('legacy-title-test.md','# Title test\n\nDate: 2026-07-01\nResult: pending\n');
 git(['add','.']);git(['commit','-qm','old log']);
 git(['branch','feature']);
 write('on-main.md','---\nid: on-main\nread_21:\nread_42:\nstatus: running\n---\n');
 write('reverted.md','---\nid: reverted\nread_21:\nread_42:\nstatus: closed\n---\nReverted before deploy.\n');
 git(['add','.']);git(['commit','-qm','two records'],'2026-10-01T12:00:00Z');
 git(['checkout','-q','feature']);
 const due=(...args)=>{const run=spawnSync(process.execPath,[path.join(root,'skills/seo-experiments/scripts/due.mjs'),'--repo',repo,'--today','2026-11-21','--json',...args],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);return Object.fromEntries(JSON.parse(run.stdout).map(r=>[r.id,r]));};
 // The feature branch predates both records, so its working tree holds only the old-format file.
 assert.deepEqual(Object.keys(due()),['legacy-title-test']);
 const main=due('--ref','main');
 // Merged 2026-10-01: windows end Oct 22 and Nov 12, runnable Oct 25 and Nov 15, both due on Nov 21.
 assert.deepEqual(main['on-main'].reads.map(r=>[r.days,r.runnable_from,r.state]),[[21,'2026-10-25','due'],[42,'2026-11-15','due']]);
 assert.deepEqual(main.reverted.reads.map(r=>r.state),['closed','closed']);
 assert.equal(main.reverted.next,null);
 assert.deepEqual([main['legacy-title-test'].legacy,main['legacy-title-test'].reads],[true,[]]);
});

test('the pre-check answers in one line whether a read or the review is due, from the records and the cadence and last review in .seo/access.md',t=>{
 const repo=tempDir(t,'seo-check-');
 const git=(args,date='2026-08-01T12:00:00Z')=>execFileSync('git',args,{cwd:repo,env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null'},encoding:'utf8'});
 const write=(rel,text)=>{fs.mkdirSync(path.dirname(path.join(repo,rel)),{recursive:true});fs.writeFileSync(path.join(repo,rel),text);};
 const commit=(tag,date)=>{git(['add','.']);git(['commit','-qm',tag],date);git(['tag',tag]);};
 const record=(read21='',read42='',status='running')=>write('.seo/experiments/a.md',`---\nid: a\nread_21: ${read21}\nread_42: ${read42}\nstatus: ${status}\n---\n`);
 const accessFile=last=>write('.seo/access.md',`---\ntier: Search\ncadence: monthly   # monthly | weekly\nautonomy: fully automatic\nlast_review: ${last}\n---\n`);
 git(['init','-q','-b','main']);git(['config','user.email','t@example.com']);git(['config','user.name','t']);
 write('README.md','site\n');commit('t0','2026-08-01T12:00:00Z');
 accessFile('2026-09-01');record();commit('t1','2026-09-01T12:00:00Z');
 record('2026-09-27');commit('t2','2026-09-28T12:00:00Z');
 accessFile('2026-10-05');commit('t3','2026-10-05T12:00:00Z');
 record('2026-09-27','2026-10-17','read');commit('t4','2026-10-25T12:00:00Z');
 const home=tempDir(t,'seo-check-home-');
 const run=(dir,ref,today)=>{const out=spawnSync(process.execPath,[path.join(root,'skills/seo-experiments/scripts/due.mjs'),'--repo',dir,'--ref',ref,'--today',today,'--check'],{encoding:'utf8',env:{...process.env,HOME:home,USERPROFILE:home}});assert.equal(out.stdout.split('\n').filter(Boolean).length,1,out.stderr);return [out.status,JSON.parse(out.stdout)];};
 const check=(ref,today)=>{const [status,{memory,...rest}]=run(repo,ref,today);return [status,rest];};
 const access=last=>({tier:'Search',cadence:'monthly',autonomy:'fully automatic',last_review:last});
 const reviewed=(last,next,due)=>({cadence:'monthly',last,next,due,reason:null});
 // Shipped 2026-09-01: the 21-day read is runnable 09-25 and the 42-day read 10-16. Reviewed 09-01, so the next review is 10-01.
 assert.deepEqual(check('t1','2026-09-20'),[3,{today:'2026-09-20',due:false,reads_due:[],legacy:[],review:reviewed('2026-09-01','2026-10-01',false),next_due:'2026-09-25',access:access('2026-09-01')}]);
 assert.deepEqual(check('t1','2026-09-26'),[0,{today:'2026-09-26',due:true,reads_due:[{id:'a',days:21,since:'2026-09-25'}],legacy:[],review:reviewed('2026-09-01','2026-10-01',false),next_due:'2026-10-01',access:access('2026-09-01')}]);
 // The 21-day read merged 09-28 and leaves the review clock where it was.
 assert.deepEqual(check('t2','2026-09-30'),[3,{today:'2026-09-30',due:false,reads_due:[],legacy:[],review:reviewed('2026-09-01','2026-10-01',false),next_due:'2026-10-01',access:access('2026-09-01')}]);
 // The review merged 10-05 sets last_review, so on 10-20 only the 42-day read is due.
 assert.deepEqual(check('t3','2026-10-20'),[0,{today:'2026-10-20',due:true,reads_due:[{id:'a',days:42,since:'2026-10-16'}],legacy:[],review:reviewed('2026-10-05','2026-11-04',false),next_due:'2026-11-04',access:access('2026-10-05')}]);
 // Both reads done: the review is due from 11-04 with no read due.
 assert.deepEqual(check('t4','2026-11-10'),[0,{today:'2026-11-10',due:true,reads_due:[],legacy:[],review:reviewed('2026-10-05','2026-11-04',true),next_due:null,access:access('2026-10-05')}]);
 // No .seo/ yet: a first run is due.
 assert.deepEqual(check('t0','2026-09-20'),[0,{today:'2026-09-20',due:true,reads_due:[],legacy:[],review:{cadence:null,last:null,next:null,due:true,reason:'no .seo/access.md: first run'},next_due:null,access:null}]);
 // A single-file experiment log hides its reads, so it is due for migration until its body is the one-line pointer.
 write('.seo/experiments.md','| date | target | review |\n| 2026-07-10 | /pricing | 2026-08-11 |\n');commit('t5','2026-10-26T12:00:00Z');
 write('.seo/experiments.md','Moved to .seo/experiments/, one record per experiment.\n');commit('t6','2026-10-27T12:00:00Z');
 assert.deepEqual(check('t5','2026-10-30').map((v,i)=>i?[v.due,v.legacy]:v),[0,[true,['.seo/experiments.md']]]);
 assert.deepEqual(check('t6','2026-10-30').map((v,i)=>i?[v.due,v.legacy]:v),[3,[false,[]]]);
 // Every worktree of the product shares one local folder, under Agent Farm's state directory.
 const other=path.join(tempDir(t,'seo-check-wt-'),'run');git(['worktree','add','-q','--detach',other,'t4']);
 const [,main]=run(repo,'t4','2026-11-10'),[,fromWorktree]=run(other,'t4','2026-11-10');
 assert.ok(main.memory.startsWith(path.join(home,'.local/state/agent-farm/seo',path.basename(repo)+'-')),main.memory);
 assert.equal(fromWorktree.memory,main.memory);
});

test('the pre-check delivers its whole JSON line and exit status to a reader that drains the pipe late',{skip:process.platform==='win32'&&'needs a POSIX shell pipe'},t=>{
 const repo=tempDir(t,'seo-check-pipe-');
 const env={...process.env,GIT_AUTHOR_DATE:'2026-01-01T12:00:00Z',GIT_COMMITTER_DATE:'2026-01-01T12:00:00Z',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null'};
 execFileSync('git',['init','-q','-b','main'],{cwd:repo,env});
 fs.mkdirSync(path.join(repo,'.seo/experiments'),{recursive:true});
 // 1,500 records live 2026-01-01, both reads due on 2026-03-01: about 100 KB of JSON, more than a pipe buffers.
 for(let i=0;i<1500;i++)fs.writeFileSync(path.join(repo,`.seo/experiments/r${String(i).padStart(4,'0')}.md`),`---\nid: r${String(i).padStart(4,'0')}\nlive: 2026-01-01\nstatus: running\n---\n`);
 execFileSync('git',['add','.'],{cwd:repo,env});execFileSync('git',['-c','user.email=t@example.com','-c','user.name=t','commit','-qm','records'],{cwd:repo,env});
 // The reader sleeps a second before draining; pipefail keeps the script's own exit status.
 const run=spawnSync('bash',['-c','set -o pipefail; "$0" "$1" --repo "$2" --today 2026-03-01 --check | (sleep 1; cat)',process.execPath,path.join(root,'skills/seo-experiments/scripts/due.mjs'),repo],{encoding:'utf8',maxBuffer:1<<24});
 assert.equal(run.status,0,run.stderr);
 assert.equal(JSON.parse(run.stdout).reads_due.length,3000);
});

test('the raw guard refuses a push whose commits add raw data, even when a later commit removes it, and allows removing raw files the default branch already has',t=>{
 const repo=tempDir(t,'seo-raw-guard-');
 const git=(...args)=>execFileSync('git',args,{cwd:repo,env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null'},encoding:'utf8'});
 const write=(rel,text)=>{fs.mkdirSync(path.dirname(path.join(repo,rel)),{recursive:true});fs.writeFileSync(path.join(repo,rel),text);};
 const commit=message=>{git('add','-A');git('commit','-qm',message);return git('rev-parse','--short=12','HEAD').trim();};
 git('init','-q','-b','main');git('config','user.email','t@example.com');git('config','user.name','t');
 // An older run committed a raw pull to the default branch.
 write('.seo/data/old-gsc.csv','query,clicks\nexample,3\n');write('.seo/briefing.md','# Briefing\n');commit('legacy');
 const guard=head=>spawnSync(process.execPath,[path.join(root,'skills/seo-data-pull/scripts/raw-guard.mjs'),'--repo',repo,'--base','main','--head',head],{encoding:'utf8'});
 // Cleanup only: removing the tracked raw file and changing a reviewed file publishes nothing raw.
 git('checkout','-q','-b','cleanup');git('rm','-q','--cached','.seo/data/old-gsc.csv');write('.seo/briefing.md','# Briefing v2\n');commit('untrack raw, update briefing');
 assert.deepEqual([guard('cleanup').status,guard('cleanup').stderr],[0,'']);
 // Exposure: a raw export added in one commit and removed in the next is still in what the push publishes.
 git('checkout','-q','-b','exposed','main');
 write('.seo/archive/2026/11/20/data/ga4.json','{"rows":[]}\n');const added=commit('add archive');
 fs.rmSync(path.join(repo,'.seo/archive'),{recursive:true});commit('remove archive');
 const exposed=guard('exposed');
 assert.equal(exposed.status,1);
 assert.match(exposed.stderr,new RegExp(`^  ${added} A \\.seo/archive/2026/11/20/data/ga4\\.json$`,'m'));
 assert.doesNotMatch(exposed.stderr,/old-gsc/);
});

test('the memory lock admits one run at a time, renews for its owner, ignores a release by another run, and lets a run take over a lock left stale by a dead one',t=>{
 const dir=tempDir(t,'seo-lock-');
 const lock=(...args)=>{const run=spawnSync(process.execPath,[path.join(root,'skills/seo-loop/scripts/lock.mjs'),...args,'--dir',dir],{encoding:'utf8'});return [run.status,JSON.parse(run.stdout)];};
 assert.deepEqual(lock('acquire','--owner','tick-1','--wait','0'),[0,{ok:true,owner:'tick-1'}]);
 assert.deepEqual(lock('acquire','--owner','tick-1','--wait','0'),[0,{ok:true,owner:'tick-1'}]);
 const [status,busy]=lock('acquire','--owner','person-run','--wait','0');
 assert.deepEqual([status,busy.ok,busy.holder],[2,false,'tick-1']);
 assert.deepEqual(lock('release','--owner','person-run'),[0,{ok:true,released:false}]);
 assert.deepEqual(lock('release','--owner','tick-1'),[0,{ok:true,released:true}]);
 assert.deepEqual(lock('acquire','--owner','person-run','--wait','0'),[0,{ok:true,owner:'person-run'}]);
 // A holder that last renewed an hour ago is past the 30-minute default and taken to have died.
 fs.writeFileSync(path.join(dir,'lock','owner.json'),JSON.stringify({owner:'person-run',at:new Date(Date.now()-3600e3).toISOString()}));
 assert.deepEqual(lock('acquire','--owner','tick-2','--wait','0'),[0,{ok:true,owner:'tick-2'}]);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'lock','owner.json'),'utf8')).owner,'tick-2');
});
