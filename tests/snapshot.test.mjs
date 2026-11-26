import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {installPlugin} from '../dist/plugins.js';
import {createSnapshot,openSnapshot} from '../dist/snapshot.js';
import {writeHarness} from './harness.mjs';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

/** Plugin team 1.0.0: a lead linking an implementer set (launch) and a helper (process); the implementer links a
 *  reviewer back. `install(2)` is the update: new instructions, the implementer's codex variant and the lead profile
 *  gone, and a new auditor the lead links. Fake harnesses record their argv and the snapshot and parent they saw. */
function fixture(t){
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-snapshot-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),target=path.join(base,'session'),home=path.join(base,'home'),bin=path.join(base,'bin'),log=path.join(base,'launched.jsonl');
 for(const dir of [target,path.join(home,'.codex'),bin])fs.mkdirSync(dir,{recursive:true});
 const install=(version)=>{
  const source=path.join(base,`plugin-${version}`),put=(p,s)=>{const f=path.join(source,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
  put('plugin.yaml',`name: team\nversion: ${version}.0.0\ncli_major: 0\n`);
  const auditor=version===2?'  auditor: {agent: auditor, mode: launch}\n':'';
  put('agents/lead.md',`---\nharness: claude\nmodel: claude-opus-5-5\nsubagents:\n  builder: {agent: implementer, mode: launch}\n  helper: {agent: helper, mode: process}\n${auditor}---\nLead v${version}.\n`);
  put('agents/implementer-claude.md',`---\nharness: claude\nmodel: claude-opus-5-5\nsubagents:\n  reviewer: {agent: reviewer, mode: launch}\n---\nImplementer v${version}.\n`);
  if(version===1){put('agents/implementer-codex.md','---\nharness: codex\nmodel: gpt-6.2-sol\n---\nCodex implementer v1.\n');put('agents/implementer.yaml','variants:\n  claude: {agent: implementer-claude}\n  codex: {agent: implementer-codex}\ndefault: claude\n');}
  else put('agents/implementer.yaml','variants:\n  claude: {agent: implementer-claude}\ndefault: claude\n');
  put('agents/reviewer.md',`---\nharness: claude\nmodel: claude-opus-5-5\n---\nReviewer v${version}.\n`);
  put('agents/helper.md',`---\nharness: claude\nmodel: claude-opus-5-5\n---\nHelper v${version}.\n`);
  if(version===2)put('agents/auditor.md','---\nharness: claude\nmodel: claude-opus-5-5\n---\nAuditor.\n');
  put(`profiles/${version===1?'lead':'lead2'}.yaml`,'agent: lead\n');
  installPlugin(source,root);
 };
 install(1);
 for(const harness of ['claude','codex'])writeHarness(bin,harness,`require('fs').appendFileSync(${JSON.stringify(log)},JSON.stringify({harness:${JSON.stringify(harness)},argv:process.argv.slice(2),snapshot:process.env.AGENT_FARM_SNAPSHOT,parent:process.env.AGENT_FARM_PARENT})+'\\n');\n`);
 const env={...process.env,HOME:home,USERPROFILE:home,PATH:bin+path.delimiter+process.env.PATH,AGENT_FARM_TELEMETRY:'off',AGENT_FARM_SIGNIN_CHECK:'off'};
 for(const key of ['AGENT_FARM_PARENT','AGENT_FARM_SNAPSHOT','CODEX_HOME','AGENT_FARM_NATIVE_CODEX_HOME','CLAUDE_CONFIG_DIR','PANE_PANEL_ID','AGENT_FARM_REPORT_SESSION_ID','AGENT_FARM_SESSION_ID','TRACEPARENT','AGENT_FARM_TRACEPARENT'])delete env[key];
 const invoke=(args,extra={},directory=target)=>spawnSync(process.execPath,[cli,...(args[0]==='snapshot'?args:['run',...args]),'--config-root',root,'--directory',directory,...(args[0]==='snapshot'?[]:['--no-workspace'])],{encoding:'utf8',env:{...env,...extra}});
 const launched=()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line)):[];
 const records=()=>{const dir=path.join(home,'.local/state/agent-farm/launches');return fs.existsSync(dir)?fs.readdirSync(dir).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))):[];};
 const snapshots=(directory=target)=>{const dir=path.join(directory,'.agent-farm/snapshots');return fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>!n.startsWith('.')).sort():[];};
 const prompt=(entry)=>entry.argv[entry.argv.indexOf('--append-system-prompt')+1];
 const explain=(args,extra)=>{const r=invoke([...args,'--explain'],extra);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 const bundleOf=(out)=>JSON.parse(fs.readFileSync(path.join(out.bundle,'manifest.json'),'utf8'));
 return {base,root,target,home,install,invoke,launched,records,snapshots,prompt,explain,bundleOf,env};
}
/** The words of one launch-link line from an agent's instructions, without the agent-farm command and description. */
function linkLine(prompt,alias){
 const line=prompt.split('\n').find(l=>l.startsWith(alias+': '));assert.ok(line,`no ${alias} line in:\n${prompt}`);
 const words=[...line.slice(alias.length+2).matchAll(/'((?:[^']|'\\'')*)'|(\S+)/g)].map(m=>m[1]!==undefined?m[1].replaceAll("'\\''","'"):m[2]);
 const run=words.indexOf('run'),result=[];
 for(const word of words.slice(run+1)){if(word.startsWith('('))break;if(word.endsWith(';')){result.push(word.slice(0,-1));break;}result.push(word);}
 return result;
}
const option=(words,name)=>words[words.indexOf(name)+1];
const strip=(words)=>words.filter((w,i)=>w!=='--config-root'&&words[i-1]!=='--config-root');

test('a team runs one version after an update: child and grandchild lines carry the lead\'s snapshot (journey 1)',t=>{
 const f=fixture(t);
 assert.equal(f.invoke(['team/lead']).status,0);
 const [lead]=f.launched(),[snapshot]=f.snapshots(),folder=path.join(f.target,'.agent-farm/snapshots',snapshot);
 assert.equal(lead.snapshot,folder,'the lead\'s shell passes its snapshot on');
 const builder=strip(linkLine(f.prompt(lead),'builder'));
 assert.equal(option(builder,'--snapshot'),folder);assert.match(option(builder,'--parent'),/^team\/lead@/);
 f.install(2);
 // The printed builder line, then a grandchild from the child's own shell.
 const child=f.invoke([...builder,'--exec','--message','build']);assert.equal(child.status,0,child.stderr);
 const built=f.launched().at(-1);assert.equal(built.snapshot,folder);
 assert.match(built.argv.join('\n'),/Implementer v1\./);
 const grandchild=f.invoke(['reviewer','--exec','--message','review'],{AGENT_FARM_SNAPSHOT:built.snapshot,AGENT_FARM_PARENT:built.parent});
 assert.equal(grandchild.status,0,grandchild.stderr);assert.match(f.launched().at(-1).argv.join('\n'),/Reviewer v1\./);
 const out=f.explain(['reviewer'],{AGENT_FARM_SNAPSHOT:folder,AGENT_FARM_PARENT:built.parent});
 assert.deepEqual([out.trace_identity,out.plugin_version,out.snapshot,out.snapshot_path],['team/reviewer@1.0.0','1.0.0',openSnapshot(folder,f.target).digest,folder]);
 assert.deepEqual(f.snapshots(),[snapshot],'no second snapshot folder');
 // The v1 codex variant the update dropped still starts from the snapshot.
 assert.equal(f.explain(['team/implementer:codex','--parent',option(builder,'--parent'),'--snapshot',folder]).trace_identity,'team/implementer:codex@1.0.0');
});

test('a process link by name builds its parent from the snapshot (journey 2)',t=>{
 const f=fixture(t);
 assert.equal(f.invoke(['team/lead']).status,0);
 const [snapshot]=f.snapshots(),folder=path.join(f.target,'.agent-farm/snapshots',snapshot),parent=f.launched()[0].parent;
 f.install(2);
 const out=f.explain(['helper','--parent',parent,'--snapshot',folder]);
 assert.equal(out.plugin_version,'1.0.0');assert.equal(f.bundleOf(out).nodes['main/children/helper'].instructions,'Helper v1.');
});

test('a name the snapshot lacks is refused with its links; without a parent or snapshot it resolves from what is installed (journey 3)',t=>{
 const f=fixture(t);
 assert.equal(f.invoke(['team/lead']).status,0);
 const [snapshot]=f.snapshots(),folder=path.join(f.target,'.agent-farm/snapshots',snapshot),parent=f.launched()[0].parent;
 f.install(2);
 const refused=f.invoke(['auditor','--exec','--parent',parent,'--snapshot',folder]);
 assert.equal(refused.status,1);assert.match(refused.stderr,/auditor is not one of team\/lead's links/);
 assert.match(refused.stderr,/  builder: agent-farm run team\/implementer --parent /);assert.doesNotMatch(refused.stderr,/auditor: agent-farm run/);
 assert.equal(f.explain(['team/auditor']).trace_identity,'team/auditor@2.0.0');
});

test('a resume after an update reopens the recorded snapshot; a record from before snapshots still says start fresh (journey 4)',t=>{
 const f=fixture(t);
 assert.equal(f.invoke(['team/lead']).status,0);
 assert.equal(f.invoke(['team/implementer:codex']).status,0);
 const record=f.records().find(r=>r.profile==='team/lead'),codex=f.records().find(r=>r.variant==='codex'),[snapshot]=f.snapshots();
 assert.equal(record.snapshot,path.join('.agent-farm','snapshots',snapshot),'recorded relative to the launch directory');
 f.install(2);
 // v2 dropped the codex variant and changed the lead's instructions.
 const variant=f.invoke(['team/implementer','--resume',codex.id]);
 assert.equal(variant.status,0,variant.stderr);assert.doesNotMatch(variant.stderr,/Start a fresh Session/);assert.equal(f.launched().at(-1).harness,'codex');
 const resumed=f.invoke(['team/lead','--resume',record.id]);
 assert.equal(resumed.status,0,resumed.stderr);
 assert.match(f.prompt(f.launched().at(-1)),/Lead v1\./);
 // An inherited snapshot does not win over the record (D-2).
 const other=createSnapshot(f.root,f.base);
 assert.equal(f.invoke(['team/lead','--resume',record.id],{AGENT_FARM_SNAPSHOT:other.path}).status,0);assert.match(f.prompt(f.launched().at(-1)),/Lead v1\./);
 const old={id:randomUUID(),profile:'team/implementer',variant:'codex',harness:'codex',directory:f.target,started_at:new Date().toISOString(),entry_kind:'agent'};
 fs.writeFileSync(path.join(f.home,'.local/state/agent-farm/launches',old.id+'.json'),JSON.stringify(old));
 const gone=f.invoke(['team/implementer:codex','--resume',old.id]);
 assert.equal(gone.stderr.trim(),`error: Session ${old.id} was started as team/implementer:codex, which this Agent Farm no longer has. Start a fresh Session.`);
});

test('--resume ID --reload moves the launch to what is installed; a line printed before the reload keeps v1 (journey 5)',t=>{
 const f=fixture(t);
 assert.equal(f.invoke(['team/reviewer']).status,0);
 const [record]=f.records(),before=path.join(f.target,record.snapshot);
 assert.equal(f.invoke(['team/lead']).status,0);
 const v1line=strip(linkLine(f.prompt(f.launched().at(-1)),'builder'));
 f.install(2);
 const reloaded=f.invoke(['team/reviewer','--resume',record.id,'--reload']);assert.equal(reloaded.status,0,reloaded.stderr);
 const after=f.records().find(r=>r.id===record.id);assert.notEqual(after.snapshot,record.snapshot);
 const latest=f.launched().at(-1);assert.match(f.prompt(latest),/Reviewer v2\./);assert.equal(latest.snapshot,path.join(f.target,after.snapshot));
 // The next resume stays on the new snapshot; the old line still gives v1.
 assert.equal(f.invoke(['team/reviewer','--resume',record.id]).status,0);assert.match(f.prompt(f.launched().at(-1)),/Reviewer v2\./);
 assert.equal(f.explain(v1line).plugin_version,'1.0.0');assert.equal(option(v1line,'--snapshot'),before);
 for(const [args,error] of [[['team/reviewer','--reload'],/--reload takes a new snapshot for a resume/],[['team/reviewer','--resume',record.id,'--reload','--snapshot',before],/Choose only one of --snapshot or --reload/],[['team/reviewer','--snapshot',''],/--snapshot needs the path/]]){
  const r=f.invoke(args);assert.equal(r.status,1);assert.match(r.stderr,error);
 }
 const flag=spawnSync(process.execPath,[cli,'profiles','list','--snapshot',before,'--config-root',f.root],{encoding:'utf8',env:f.env});
 assert.match(flag.stderr,/--snapshot and --reload require run or agent/);
});

test('a Pane-style ACP lead: snapshot create --json, then --print-acp --snapshot gives v1 across an update (journey 6)',t=>{
 const f=fixture(t);
 const created=f.invoke(['snapshot','create','--json']);assert.equal(created.status,0,created.stderr);
 const info=JSON.parse(created.stdout);
 assert.deepEqual(Object.keys(info).sort(),['digest','path','plugins']);assert.deepEqual(info.plugins,{team:'1.0.0'});
 assert.equal(info.path,path.join(f.target,'.agent-farm/snapshots',info.digest));
 assert.equal(JSON.parse(f.invoke(['snapshot','create','--json']).stdout).path,info.path,'nothing installed in between: the same folder');
 const acp=()=>{const r=f.invoke(['team/lead','--print-acp','--snapshot',info.path]);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 const first=acp();f.install(2);const second=acp();
 for(const out of [first,second]){assert.deepEqual([out.plugin_version,out.snapshot,out.env.AGENT_FARM_SNAPSHOT],['1.0.0',info.digest,info.path]);assert.match(out.session._meta.systemPrompt.append,/--snapshot /);}
 const plain=spawnSync(process.execPath,[cli,'snapshot','create','--config-root',f.root,'--directory',f.target],{encoding:'utf8',env:f.env});
 assert.equal(plain.stdout.trim(),path.join(f.target,'.agent-farm/snapshots',JSON.parse(f.invoke(['snapshot','create','--json']).stdout).digest));
 assert.notEqual(plain.stdout.trim(),info.path,'the update gives a new folder');
});

test('a missing, damaged or too-new snapshot is refused naming Reload; it never falls back (journey 7, D-3)',t=>{
 const f=fixture(t),info=createSnapshot(f.root,f.target),copy=(name)=>{const p=path.join(f.base,name);fs.cpSync(info.path,p,{recursive:true});return p;};
 const damaged=copy('damaged'),extra=copy('extra'),newer=copy('newer');
 fs.appendFileSync(path.join(damaged,'plugins/team/agents/lead.md'),'\nInjected.\n');
 fs.writeFileSync(path.join(extra,'plugins/team/agents/writer.md'),'---\nharness: claude\nmodel: claude-opus-5-5\n---\nNew.\n');
 const meta=path.join(newer,'snapshot.json');fs.writeFileSync(meta,JSON.stringify({...JSON.parse(fs.readFileSync(meta,'utf8')),format:99}));
 for(const [folder,reason,env] of [[path.join(f.base,'deleted'),/is missing/],[damaged,/failed its checksum/],[extra,/failed its checksum/],[newer,/format 99/],[damaged,/failed its checksum/,{AGENT_FARM_SNAPSHOT:damaged}]]){
  const r=f.invoke(env?['team/lead','--exec']:['team/lead','--exec','--snapshot',folder],env);
  assert.equal(r.status,1,folder);assert.match(r.stderr,reason);assert.match(r.stderr,/will not fall back to the installed plugins\. Use Reload profile/);
  assert.doesNotMatch(r.stderr,/Try another variant/);
 }
 assert.deepEqual(f.launched(),[]);
 // A resume whose recorded snapshot was deleted is refused too.
 assert.equal(f.invoke(['team/lead']).status,0);const [record]=f.records();
 fs.rmSync(path.join(f.target,record.snapshot),{recursive:true});
 const resumed=f.invoke(['team/lead','--resume',record.id]);assert.equal(resumed.status,1);assert.match(resumed.stderr,/is missing.*--resume ID --reload/s);
 assert.equal(f.invoke(['team/lead','--resume',record.id,'--reload']).status,0,'--reload recovers it');
 // An empty AGENT_FARM_SNAPSHOT counts as unset.
 assert.equal(f.invoke(['team/lead','--exec'],{AGENT_FARM_SNAPSHOT:''}).status,0);
});

test('a moved Session: a snapshot path relative to the launch directory still resolves after the folder is copied elsewhere (D-3)',t=>{
 const f=fixture(t);
 const info=JSON.parse(f.invoke(['snapshot','create','--json']).stdout),relative=path.relative(f.target,info.path);
 assert.equal(f.invoke(['team/lead','--snapshot',relative]).status,0);
 const [record]=f.records();assert.equal(record.snapshot,relative);
 f.install(2);
 const moved=path.join(f.base,'other-computer','session');fs.mkdirSync(path.dirname(moved));
 // Pane's move copies the Session folder but not .agent-farm/generated.
 fs.cpSync(f.target,moved,{recursive:true,filter:(source)=>!source.includes(path.join('.agent-farm','generated'))});
 fs.rmSync(f.target,{recursive:true});
 const r=f.invoke(['team/lead','--snapshot',relative,'--explain'],{},moved);assert.equal(r.status,0,r.stderr);
 const out=JSON.parse(r.stdout);assert.deepEqual([out.plugin_version,out.snapshot,out.snapshot_path],['1.0.0',info.digest,path.join(moved,relative)]);
 assert.match(f.bundleOf(out).nodes.main.instructions,/Lead v1\./);
});

test('a run with no parent and no snapshot resolves from what is installed and saves its own snapshot (journey 8)',t=>{
 const f=fixture(t);
 const r=f.invoke(['team/lead','--exec','--message','go']);assert.equal(r.status,0,r.stderr);
 const [snapshot]=f.snapshots(),[record]=f.records();
 assert.equal(record.snapshot,path.join('.agent-farm','snapshots',snapshot));
 const folder=path.join(f.target,record.snapshot);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder,'snapshot.json'),'utf8')).plugins,{team:'1.0.0'});
 for(const file of ['.plugins/team.json','plugins/team/plugin.yaml','settings.json','checksums.json'])assert.ok(fs.existsSync(path.join(folder,file)),file);
 assert.equal(f.launched()[0].snapshot,folder);
 // A config root's own agents are copied too.
 fs.mkdirSync(path.join(f.root,'agents'));fs.writeFileSync(path.join(f.root,'agents/mine.md'),'---\nharness: claude\nmodel: claude-opus-5-5\n---\nMine.\n');
 const local=f.explain(['mine']);assert.ok(local.snapshot_path.startsWith(path.join(f.target,'.agent-farm/snapshots')));
 assert.equal(f.bundleOf(local).nodes.main.source_file,path.join(local.snapshot_path,'agents/mine.md'));
});

test('telemetry carries the snapshot digest beside a trace identity read from the snapshot (journey 9)',t=>{
 const f=fixture(t),info=createSnapshot(f.root,f.target);f.install(2);
 const r=f.invoke(['team/reviewer','--exec','--message','go','--snapshot',info.path],{AGENT_FARM_TELEMETRY:'on'});assert.equal(r.status,0,r.stderr);
 const dir=path.join(f.home,'.local/state/agent-farm/telemetry'),[session]=fs.readdirSync(dir).map(id=>JSON.parse(fs.readFileSync(path.join(dir,id,'session.json'),'utf8')).attributes);
 assert.deepEqual([session['agent_farm.trace_identity'],session['agent_farm.snapshot']],['team/reviewer@1.0.0',info.digest]);
});
