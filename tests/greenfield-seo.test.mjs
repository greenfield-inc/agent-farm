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

test('the pre-check answers in one line whether a read or the review is due, from the records, the cadence in .seo/access.md and the last merged .seo/ change',t=>{
 const repo=tempDir(t,'seo-check-');
 const git=(args,date='2026-08-01T12:00:00Z')=>execFileSync('git',args,{cwd:repo,env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null'},encoding:'utf8'});
 const write=(rel,text)=>{fs.mkdirSync(path.dirname(path.join(repo,rel)),{recursive:true});fs.writeFileSync(path.join(repo,rel),text);};
 const commit=(tag,date)=>{git(['add','.']);git(['commit','-qm',tag],date);git(['tag',tag]);};
 const record=(read21='',read42='',status='running')=>write('.seo/experiments/a.md',`---\nid: a\nread_21: ${read21}\nread_42: ${read42}\nstatus: ${status}\n---\n`);
 git(['init','-q','-b','main']);
 write('README.md','site\n');commit('t0','2026-08-01T12:00:00Z');
 write('.seo/access.md','---\ntier: Search\ncadence: monthly   # monthly | weekly\nautonomy: fully automatic\n---\n');record();commit('t1','2026-09-01T12:00:00Z');
 record('2026-09-27');commit('t2','2026-09-28T12:00:00Z');
 record('2026-09-27','2026-10-17','read');commit('t3','2026-10-18T12:00:00Z');
 const home=tempDir(t,'seo-check-home-');
 const run=(dir,ref,today)=>{const out=spawnSync(process.execPath,[path.join(root,'skills/seo-experiments/scripts/due.mjs'),'--repo',dir,'--ref',ref,'--today',today,'--check'],{encoding:'utf8',env:{...process.env,HOME:home}});assert.equal(out.stdout.split('\n').filter(Boolean).length,1,out.stderr);return [out.status,JSON.parse(out.stdout)];};
 const check=(ref,today)=>{const [status,{memory,...rest}]=run(repo,ref,today);return [status,rest];};
 const access={tier:'Search',cadence:'monthly',autonomy:'fully automatic'};
 // Shipped 2026-09-01: the 21-day read is runnable 09-25 and the 42-day read 10-16. Monthly is 30 days from the last .seo/ change.
 assert.deepEqual(check('t1','2026-09-20'),[3,{today:'2026-09-20',due:false,reads_due:[],legacy:[],review:{cadence:'monthly',last:'2026-09-01',next:'2026-10-01',due:false,reason:null},next_due:'2026-09-25',access}]);
 assert.deepEqual(check('t1','2026-09-26'),[0,{today:'2026-09-26',due:true,reads_due:[{id:'a',days:21,since:'2026-09-25'}],legacy:[],review:{cadence:'monthly',last:'2026-09-01',next:'2026-10-01',due:false,reason:null},next_due:'2026-10-01',access}]);
 // The 21-day read merged 09-28, which moves the review to 10-28.
 assert.deepEqual(check('t2','2026-10-20'),[0,{today:'2026-10-20',due:true,reads_due:[{id:'a',days:42,since:'2026-10-16'}],legacy:[],review:{cadence:'monthly',last:'2026-09-28',next:'2026-10-28',due:false,reason:null},next_due:'2026-10-28',access}]);
 // Both reads done, last merged 10-18: the review is due from 11-17 with no read due.
 assert.deepEqual(check('t3','2026-11-20'),[0,{today:'2026-11-20',due:true,reads_due:[],legacy:[],review:{cadence:'monthly',last:'2026-10-18',next:'2026-11-17',due:true,reason:null},next_due:null,access}]);
 // No .seo/ yet: a first run is due.
 assert.deepEqual(check('t0','2026-09-20'),[0,{today:'2026-09-20',due:true,reads_due:[],legacy:[],review:{cadence:null,last:null,next:null,due:true,reason:'no .seo/access.md: first run'},next_due:null,access:null}]);
 // Every worktree of the product shares one local folder, under Agent Farm's state directory.
 const other=path.join(tempDir(t,'seo-check-wt-'),'run');git(['worktree','add','-q','--detach',other,'t3']);
 const [,main]=run(repo,'t3','2026-11-20'),[,fromWorktree]=run(other,'t3','2026-11-20');
 assert.ok(main.memory.startsWith(path.join(home,'.local/state/agent-farm/seo',path.basename(repo)+'-')),main.memory);
 assert.equal(fromWorktree.memory,main.memory);
});
