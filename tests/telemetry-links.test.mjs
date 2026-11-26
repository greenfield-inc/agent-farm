import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {TelemetryStore,telemetryProject} from '../dist/telemetry-query.js';
import {exportTelemetry} from '../dist/telemetry-export.js';
import {installPlugin} from '../dist/plugins.js';
import {writeHarness} from './harness.mjs';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

/** Sessions as an orchestrator and a tab it opened with --parent record them: the tab inherits no session ID. */
function store(t){
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'farm-links-telemetry-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const directory=path.join(base,'traces'),projectDirectory=path.join(base,'project');fs.mkdirSync(directory);fs.mkdirSync(projectDirectory);
 const save=(attributes,start)=>{const id=randomUUID(),dir=path.join(directory,id);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'session.json'),JSON.stringify({id,traceId:randomUUID().replaceAll('-',''),spanId:'b'.repeat(16),startTimeUnixNano:String(BigInt(1700000000000+start)*1000000n),endTimeUnixNano:String(BigInt(1700000009000+start)*1000000n),state:'finished',exitCode:0,attributes:{'agent_farm.project.directory':telemetryProject(projectDirectory).id,'process.working_directory':projectDirectory,'agent_farm.harness':'claude',...attributes}}));return id;};
 const orchestrator=save({'agent_farm.profile':'team/lead','agent_farm.launch.id':'L-1','agent_farm.entry.kind':'profile'},0);
 // A resume of the same launch adds a later session; the tab still nests under the first.
 const resumed=save({'agent_farm.profile':'team/lead','agent_farm.launch.id':'L-1'},5000);
 const tab=save({'agent_farm.profile':'team/reviewer','agent_farm.launch.id':'L-2','agent_farm.entry.kind':'agent','agent_farm.parent.launch.id':'L-1','agent_farm.link':'reviewer'},1000);
 const orphan=save({'agent_farm.profile':'team/reviewer','agent_farm.launch.id':'L-3','agent_farm.parent.launch.id':'L-gone'},2000);
 // Started with --parent L-1 from inside another agent's shell (L-3): the inherited session edge points at L-3.
 const crossed=save({'agent_farm.profile':'team/planner','agent_farm.launch.id':'L-4','agent_farm.parent.launch.id':'L-1','agent_farm.parent.session.id':orphan},3000);
 return {base,options:{directory,projectDirectory,scope:'project'},orchestrator,resumed,tab,orphan,crossed};
}

test('a tab started with --parent nests under its orchestrator through the parent launch ID',async t=>{
 const f=store(t),s=new TelemetryStore(f.options);
 const runs=await s.runs({});
 const lead=runs.items.find(r=>r.id===f.orchestrator);assert.equal(lead.child_sessions,2);
 const crossed=(await s.query('list_sessions')).items.find(i=>i.id===f.crossed);assert.deepEqual([crossed.parent_session_id,crossed.launch_parent_session_id],[f.orphan,f.orchestrator]);
 assert.equal(runs.items.some(r=>r.id===f.tab),false);assert.ok(runs.items.some(r=>r.id===f.orphan));
 const tree=await s.explorer({session_id:f.orchestrator}),tab=tree.nodes.find(n=>n.id==='session:'+f.tab);
 assert.equal(tab.parent_id,'session:'+f.orchestrator);
 const listed=(await s.query('list_sessions')).items.find(i=>i.id===f.tab);
 assert.deepEqual([listed.parent_launch_id,listed.launch_parent_session_id,listed.entry_kind,listed.link,listed.parent_session_id],['L-1',f.orchestrator,'agent','reviewer',undefined]);
});

test('telemetry export --launch is unchanged: a launch exports its own sessions, not its tabs',t=>{
 const f=store(t),bundle=path.join(f.base,'bundle');fs.mkdirSync(bundle);fs.writeFileSync(path.join(bundle,'bundle.json'),'{}\n');
 const parent=exportTelemetry(f.options,{bundle,launchIds:['L-1']});
 assert.deepEqual(parent.exported_session_ids.sort(),[f.orchestrator,f.resumed].sort());
 const child=exportTelemetry(f.options,{bundle,launchIds:['L-2']});assert.ok(child.exported_session_ids.includes(f.tab));
 // The raw inherited edge still exports with the shell's launch.
 assert.ok(exportTelemetry(f.options,{bundle,launchIds:['L-3']}).exported_session_ids.includes(f.crossed));
});

/** A plugin whose lead links an implementer with a model, installed in a temp config root, with fake harnesses. */
function launcher(t){
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'farm-links-launch-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const source=path.join(base,'plugin'),root=path.join(base,'config'),target=path.join(base,'repo'),home=path.join(base,'home'),bin=path.join(base,'bin'),record=path.join(base,'argv.jsonl');
 for(const dir of [target,path.join(home,'.codex'),bin])fs.mkdirSync(dir,{recursive:true});
 const put=(p,s)=>{const file=path.join(source,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,s);};
 put('plugin.yaml','name: team\nversion: 1.0.0\ncli_major: 0\n');
 put('agents/lead.md','---\nharness: claude\nmodel: claude-opus-5-5\nsubagents:\n  builder: {agent: implementer, mode: launch, model: {reasoning: high}}\n  helper: {agent: implementer, mode: process}\n---\nLead.\n');
 put('agents/implementer.md','---\nharness: claude\nmodel: claude-opus-5-5\nreasoning_effort: medium\n---\nBuild.\n');
 put('profiles/lead.yaml','agent: lead\n');
 installPlugin(source,root);
 writeHarness(bin,'claude',`require('fs').appendFileSync(${JSON.stringify(record)},JSON.stringify(process.argv.slice(2))+'\\n');\n`);
 const env={...process.env,HOME:home,USERPROFILE:home,PATH:bin+path.delimiter+process.env.PATH,AGENT_FARM_SIGNIN_CHECK:'off',AGENT_FARM_TELEMETRY:'on'};
 for(const key of ['AGENT_FARM_PARENT','AGENT_FARM_SESSION_ID','TRACEPARENT','AGENT_FARM_TRACEPARENT','CLAUDE_CONFIG_DIR','PANE_PANEL_ID','AGENT_FARM_REPORT_SESSION_ID'])delete env[key];
 const invoke=(args,extra={})=>spawnSync(process.execPath,[cli,'run',...args,'--config-root',root,'--directory',target,'--no-workspace'],{encoding:'utf8',env:{...env,...extra}});
 const sessions=()=>{const dir=path.join(home,'.local/state/agent-farm/telemetry');return fs.existsSync(dir)?fs.readdirSync(dir).map(id=>JSON.parse(fs.readFileSync(path.join(dir,id,'session.json'),'utf8')).attributes):[];};
 const records=()=>{const dir=path.join(home,'.local/state/agent-farm/launches');return fs.readdirSync(dir).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));};
 const argv=()=>fs.readFileSync(record,'utf8').trim().split('\n').map(l=>JSON.parse(l));
 return {base,source,root,target,env,put,invoke,sessions,records,argv,home};
}

test('a launch records its entry kind, parent launch and link on its telemetry session',t=>{
 const f=launcher(t);
 assert.equal(f.invoke(['team/lead','--exec','--message','go']).status,0);
 const lead=f.records()[0];
 const child=f.invoke(['builder','--exec','--message','build','--parent',`team/lead@${lead.id}`]);assert.equal(child.status,0,child.stderr);
 const tab=f.sessions().find(a=>a['agent_farm.profile']==='team/implementer'),root=f.sessions().find(a=>a['agent_farm.profile']==='team/lead');
 assert.deepEqual([root['agent_farm.entry.kind'],root['agent_farm.parent.launch.id']],['profile',undefined]);
 assert.deepEqual([tab['agent_farm.entry.kind'],tab['agent_farm.parent.launch.id'],tab['agent_farm.parent.ref'],tab['agent_farm.link'],tab['agent_farm.parent.session.id']],['agent',lead.id,'team/lead','builder',undefined]);
});

test('a resume of a removed name says to start fresh and starts no harness; a link child resumes with its link model',t=>{
 const f=launcher(t);
 assert.equal(f.invoke(['team/lead']).status,0);
 const lead=f.records()[0];
 assert.equal(f.invoke(['builder','--parent',`team/lead@${lead.id}`]).status,0);
 const child=f.records().find(r=>r.profile==='team/implementer');assert.deepEqual(f.argv().at(-1).slice(f.argv().at(-1).indexOf('--effort'),f.argv().at(-1).indexOf('--effort')+2),['--effort','high']);
 // Pane resumes with the command it ran: the alias, its --parent, and --resume. The alias no longer needs the check.
 const resumed=f.invoke(['builder','--parent',`team/lead@${lead.id}`,'--resume',child.id],{AGENT_FARM_REPORT_SESSION_ID:'1'});
 assert.equal(resumed.status,0,resumed.stderr);assert.match(resumed.stderr,new RegExp(`AGENT_FARM_SESSION_ID=${child.id}`));
 const last=f.argv().at(-1);assert.equal(last[last.indexOf('--effort')+1],'high');
 // A record from an older Agent Farm, under a name this one doesn't have.
 const old={id:randomUUID(),profile:'team/implementer',variant:'opus',harness:'claude',directory:path.join(f.base,'repo'),started_at:new Date().toISOString()};
 fs.writeFileSync(path.join(f.home,'.local/state/agent-farm/launches',old.id+'.json'),JSON.stringify(old));
 const before=f.argv().length,gone=f.invoke(['team/implementer:opus','--resume',old.id]);
 assert.equal(gone.status,1);assert.equal(f.argv().length,before);
 assert.equal(gone.stderr.trim(),`error: Session ${old.id} was started as team/implementer:opus, which this Agent Farm no longer has. Start a fresh Session.`);
 // The same when the profile itself is gone.
 const removed={...old,id:randomUUID(),profile:'team/free-range',variant:undefined};fs.writeFileSync(path.join(f.home,'.local/state/agent-farm/launches',removed.id+'.json'),JSON.stringify(removed));
 assert.match(f.invoke(['team/free-range','--resume',removed.id]).stderr,/was started as team\/free-range, which this Agent Farm no longer has\. Start a fresh Session\./);
});

test('a dispatched process child is an agent with its link on its telemetry session',t=>{
 const f=launcher(t),bundle=f.invoke(['team/lead','--build']).stdout.trim();
 const r=spawnSync(process.execPath,[path.join(bundle,'main/dispatch/helper'),'--message','go'],{encoding:'utf8',env:{...f.env,AGENT_FARM_CONFIG_ROOT:f.root,HOME:f.home,USERPROFILE:f.home,AGENT_FARM_TELEMETRY:'on',AGENT_FARM_SIGNIN_CHECK:'off'}});
 assert.equal(r.status,0,r.stderr);
 const child=f.sessions().find(a=>a['agent_farm.route']==='main/children/helper');
 assert.deepEqual([child['agent_farm.entry.kind'],child['agent_farm.link']],['agent','helper']);
});

test('a resume with a mistyped name fails instead of falling back to the recorded one',t=>{
 const f=launcher(t);
 assert.equal(f.invoke(['team/lead']).status,0);
 const lead=f.records()[0];
 assert.equal(f.invoke(['builder','--parent',`team/lead@${lead.id}`]).status,0);
 const child=f.records().find(r=>r.link==='builder');
 const typo=f.invoke(['bulider','--resume',child.id]);
 assert.equal(typo.status,1);assert.doesNotMatch(typo.stderr,/Start a fresh Session/);
});
