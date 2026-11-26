import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveProfile,build} from '../dist/compiler.js';
import {validatePlugin,installPlugin} from '../dist/plugins.js';
import {command,quoteArgument} from '../dist/runtime.js';
import {writeHarness} from './harness.mjs';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

/** A plugin whose lead links a reviewer set (launch), a pinned implementer (launch), a helper (process) and a
 *  note-taker (native), and whose reviewer links the implementer back: a launch cycle. */
function fixture(t){
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-links-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const source=path.join(base,'plugin'),root=path.join(base,'config'),target=path.join(base,'repo'),home=path.join(base,'home'),bin=path.join(base,'bin'),record=path.join(base,'launched.jsonl');
 for(const dir of [target,path.join(home,'.codex'),bin])fs.mkdirSync(dir,{recursive:true});
 const put=(p,s)=>{const f=path.join(source,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
 put('plugin.yaml','name: team\nversion: 1.0.0\ncli_major: 0\n');
 put('agents/lead.md','---\nharness: claude\nmodel: claude-opus-5-5\nsubagents:\n  reviewer: {agent: reviewer, mode: launch, description: Reviews a PR}\n  builder: {agent: implementer, mode: launch, variant: codex, model: {reasoning: high}}\n  helper: {agent: helper, mode: process}\n  notes: {agent: note-taker, mode: native}\n---\nLead.\n');
 put('agents/reviewer-claude.md','---\nharness: claude\nmodel: claude-opus-5-5\nsubagents:\n  implementer: {agent: implementer, mode: launch}\n---\nClaude reviewer.\n');
 put('agents/reviewer-codex.md','---\nharness: codex\nmodel: gpt-6.2-sol\nsubagents:\n  implementer: {agent: implementer, mode: launch}\n---\nCodex reviewer.\n');
 put('agents/reviewer.yaml','variants:\n  claude: {agent: reviewer-claude}\n  codex: {agent: reviewer-codex}\ndefault: claude\n');
 put('agents/implementer-claude.md','---\nharness: claude\nmodel: claude-opus-5-5\nsubagents:\n  reviewer: {agent: reviewer, mode: launch}\n---\nClaude implementer.\n');
 put('agents/implementer-codex.md','---\nharness: codex\nmodel: gpt-6.2-sol\nreasoning_effort: medium\nsubagents:\n  reviewer: {agent: reviewer, mode: launch}\n---\nCodex implementer.\n');
 put('agents/implementer.yaml','variants:\n  claude: {agent: implementer-claude}\n  codex: {agent: implementer-codex}\ndefault: claude\n');
 put('agents/helper.md','---\nharness: codex\nmodel: gpt-6.2-sol\nreasoning_effort: low\n---\nHelper.\n');
 put('agents/note-taker.md','---\nharness: claude\nmodel: claude-sonnet-5\n---\nNotes.\n');
 put('agents/writer.md','---\nharness: claude\nmodel: claude-opus-5-5\n---\nWriter.\n');
 put('agents/scout.md','---\nharness: claude\nmodel: claude-opus-5-5\nsubagents:\n  anyone: {mode: launch, any: true}\n---\nScout.\n');
 put('profiles/lead.yaml','agent: lead\n');
 installPlugin(source,root);
 for(const harness of ['claude','codex'])writeHarness(bin,harness,`require('fs').appendFileSync(${JSON.stringify(record)},JSON.stringify({harness:${JSON.stringify(harness)},parent:process.env.AGENT_FARM_PARENT})+'\\n');\n`);
 const env={...process.env,HOME:home,USERPROFILE:home,PATH:bin+path.delimiter+process.env.PATH,AGENT_FARM_TELEMETRY:'off',AGENT_FARM_SIGNIN_CHECK:'off'};
 for(const key of ['AGENT_FARM_PARENT','CODEX_HOME','AGENT_FARM_NATIVE_CODEX_HOME','CLAUDE_CONFIG_DIR','PANE_PANEL_ID','AGENT_FARM_REPORT_SESSION_ID'])delete env[key];
 const invoke=(args,extra={})=>spawnSync(process.execPath,[cli,'run',...args,'--config-root',root,'--directory',target,'--no-workspace'],{encoding:'utf8',env:{...env,...extra}});
 const launched=()=>fs.existsSync(record)?fs.readFileSync(record,'utf8').trim().split('\n').map(line=>JSON.parse(line)):[];
 const records=()=>{const dir=path.join(home,'.local/state/agent-farm/launches');return fs.existsSync(dir)?fs.readdirSync(dir).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))):[];};
 return {base,source,root,target,home,put,invoke,launched,records,env};
}

test('launch links are checked but not compiled, so a reviewer and implementer may link each other',t=>{
 const f=fixture(t);
 const lead=resolveProfile(f.root,'team/lead');
 assert.deepEqual(Object.keys(lead.nodes).sort(),['main','main/children/helper','main/children/notes']);
 assert.deepEqual(JSON.parse(JSON.stringify(lead.nodes.main.links)),{reviewer:{agent:'team/reviewer',variants:['claude','codex'],default_variant:'claude',description:'Reviews a PR'},builder:{agent:'team/implementer',variant:'codex',model:{reasoning:'high'}}});
 assert.equal(resolveProfile(f.root,'team/reviewer:codex').nodes.main.links.implementer.agent,'team/implementer');
 validatePlugin(f.source);
});

test('link mistakes fail validation with the link named',t=>{
 const f=fixture(t),lead=(sub)=>f.put('agents/lead.md',`---\nharness: claude\nmodel: claude-opus-5-5\nsubagents:\n  ${sub}\n---\nLead.\n`);
 for(const [sub,error] of [
  ['x: {agent: missing, mode: launch}',/Launch link x of team\/lead names missing agent team\/missing/],
  ['x: {agent: writer, mode: launch, variant: codex}',/pins variant codex, but team\/writer is a single agent with no variants/],
  ['x: {agent: reviewer, mode: launch, variant: opus}',/Agent team\/reviewer has no variant opus; choose claude or codex/],
  ['x: {agent: writer, mode: launch, any: true}',/with any: true names no agent, variant or model/],
  ['x: {agent: writer, mode: launch, harness: codex}',/Unsupported prototype fields: harness/],
  ['x: {agent: writer, mode: tab}',/Child x mode must be native, process or launch/]]){
  lead(sub);assert.throws(()=>validatePlugin(f.source),error,sub);
 }
 // A target that exists but does not resolve fails plugin validate, though its parent resolves.
 lead('x: {agent: writer, mode: launch}');f.put('agents/writer.md','---\nharness: claude\nmodel: claude-opus-5-5\nskills: [nope]\n---\nWriter.\n');
 assert.throws(()=>validatePlugin(f.source),/Launch link x of team\/lead names team\/writer, which does not resolve: Missing skill team\/nope required by team\/writer/);
});

test('the children block gives each launch link a command with --parent and the config root',t=>{
 const f=fixture(t),bundle=build(f.root,'team/lead',f.target);
 const launch=command(bundle,'main',{prepare:false,home:f.home,configRoot:f.root,launchId:'abc-123',cli:['/opt/agent-farm']});
 const prompt=launch.argv[launch.argv.indexOf('--append-system-prompt')+1];
 assert.ok(prompt.includes(`reviewer: /opt/agent-farm run team/reviewer --config-root ${quoteArgument(f.root)} --parent team/lead@abc-123 (Reviews a PR); variants claude, codex, default claude: append :codex`),prompt);
 assert.equal(quoteArgument('C:\\Users\\me\\config'),'C:\\Users\\me\\config');assert.equal(quoteArgument('/a b/"c"'),'"/a b/\\"c\\""');
 assert.match(prompt,/builder: \/opt\/agent-farm run team\/implementer:codex --config-root \S+ --parent team\/lead@abc-123$/m);
 assert.match(prompt,/helper: node "[^"]+dispatch\/helper"/);
 assert.equal(launch.env.AGENT_FARM_PARENT,'team/lead@abc-123');assert.equal(launch.env.AGENT_FARM_CLI,'["/opt/agent-farm"]');
});

test('an unlisted name is refused before any harness starts, naming the links; with no parent it runs',t=>{
 const f=fixture(t),parent='team/lead@11111111-2222-3333-4444-555555555555';
 const refused=f.invoke(['team/writer','--exec','--message','hi','--parent',parent]);
 assert.equal(refused.status,1);assert.deepEqual(f.launched(),[]);
 assert.match(refused.stderr,/team\/writer is not one of team\/lead's links, so it can't be started from there \(parent from --parent\)\. Its links:\n  helper: agent-farm run team\/helper --parent team\/lead@1111/);
 assert.match(refused.stderr,/  builder: agent-farm run team\/implementer:codex --parent /);
 const native=f.invoke(['team/note-taker','--exec','--parent',parent]);
 assert.match(native.stderr,/native subagent notes: it runs inside your harness, use native delegation/);
 assert.equal(f.invoke(['team/writer','--exec','--message','hi']).status,0);assert.equal(f.launched().length,1);
 const inherited=f.invoke(['team/writer','--exec','--message','hi'],{AGENT_FARM_PARENT:parent});
 assert.equal(inherited.status,1);assert.match(inherited.stderr,/parent from AGENT_FARM_PARENT/);
 assert.match(f.invoke(['team/writer','--exec','--parent','nonsense']).stderr,/Invalid parent token "nonsense"/);
 assert.match(f.invoke(['team/writer','--exec','--parent','team/gone@abc']).stderr,/Parent team\/gone \(from --parent\) does not resolve here/);
});

test('a listed launch runs as the link says and records its parent, even one this machine never saw',t=>{
 const f=fixture(t),parent='team/lead@11111111-2222-3333-4444-555555555555';
 // By alias, by agent name, and qualified: the pinned codex variant, with the link's reasoning.
 for(const name of ['builder','implementer','team/implementer']){
  const r=f.invoke([name,'--explain','--parent',parent]);assert.equal(r.status,0,r.stderr);
  const out=JSON.parse(r.stdout);assert.equal(out.trace_identity,'team/implementer:codex@1.0.0',name);
  assert.deepEqual([out.launch.model.reasoning,out.launch.model.sources.reasoning],['high','preset']);
 }
 // A flag still wins over the link.
 assert.equal(JSON.parse(f.invoke(['builder','--explain','--reasoning','low','--parent',parent]).stdout).launch.model.reasoning,'low');
 const pinned=f.invoke(['team/implementer:claude','--exec','--parent',parent]);
 assert.equal(pinned.status,1);assert.match(pinned.stderr,/Launch link builder of team\/lead pins variant codex; it refuses :claude/);
 const r=f.invoke(['reviewer:codex','--exec','--message','go','--parent',parent]);assert.equal(r.status,0,r.stderr);
 const [run]=f.launched();assert.equal(run.harness,'codex');assert.match(run.parent,/^team\/reviewer:codex@[0-9a-f-]{36}$/);
 const [rec]=f.records();
 assert.deepEqual([rec.profile,rec.variant,rec.entry_kind,rec.parent_launch_id,rec.parent_ref,rec.link,rec.headless],['team/reviewer','codex','agent','11111111-2222-3333-4444-555555555555','team/lead','reviewer',true]);
 assert.equal(run.parent,`team/reviewer:codex@${rec.id}`);
 // A headless launch is found, never resumed.
 assert.match(f.invoke(['reviewer:codex','--resume',rec.id]).stderr,/was a headless launch .*not resumed/);
});

test('a background launch from an agent shell inherits its parent, and the reviewer and implementer start each other',t=>{
 const f=fixture(t);
 assert.equal(f.invoke(['team/lead','--exec','--message','plan']).status,0);
 const lead=f.launched()[0].parent;assert.match(lead,/^team\/lead@/);
 // The token the lead's harness saw is the environment its shell passes on.
 const reviewer=f.invoke(['reviewer','--exec','--message','review'],{AGENT_FARM_PARENT:lead});assert.equal(reviewer.status,0,reviewer.stderr);
 const child=f.records().find(r=>r.profile==='team/reviewer');assert.equal(child.parent_launch_id,lead.split('@')[1]);
 const back=f.invoke(['implementer','--exec','--message','fix'],{AGENT_FARM_PARENT:f.launched()[1].parent});assert.equal(back.status,0,back.stderr);
 assert.equal(f.records().find(r=>r.profile==='team/implementer').parent_ref,'team/reviewer:claude');
});

test('any: true lets an agent start any agent in its plugin',t=>{
 const f=fixture(t),parent='team/scout@abc';
 assert.equal(f.invoke(['writer','--exec','--parent',parent]).status,0);
 assert.equal(f.invoke(['team/lead','--exec','--parent',parent]).status,0);
 const rec=f.records().find(r=>r.profile==='team/lead');assert.deepEqual([rec.entry_kind,rec.link],['profile','anyone']);
 assert.equal(f.invoke(['other/writer','--exec','--parent',parent]).status,1);
});

test('a process link started by name runs the same compiled route its dispatcher runs',t=>{
 const f=fixture(t),parent='team/lead@abc';
 const byName=f.invoke(['helper','--explain','--parent',parent]);assert.equal(byName.status,0,byName.stderr);
 const bundle=build(f.root,'team/lead',f.target);
 const dispatched=spawnSync(process.execPath,[path.join(bundle,'main/dispatch/helper'),'--explain'],{encoding:'utf8',env:{...f.env,AGENT_FARM_CONFIG_ROOT:f.root}});
 assert.equal(dispatched.status,0,dispatched.stderr);
 const [a,b]=[JSON.parse(byName.stdout),JSON.parse(dispatched.stdout)];
 assert.deepEqual(a.launch,b.launch);assert.equal(a.bundle,b.bundle);
 assert.equal(f.invoke(['helper','--exec','--message','go','--parent',parent]).status,0);
 const rec=f.records().find(r=>r.profile==='team/helper');assert.deepEqual([rec.link,rec.parent_ref,rec.headless],['helper','team/lead',true]);
});

test('a child resumes after its parent closed and the parent record is gone',t=>{
 const f=fixture(t);
 assert.equal(f.invoke(['team/lead']).status,0);
 const lead=f.records()[0];
 const child=f.invoke(['reviewer','--parent',`team/lead@${lead.id}`]);assert.equal(child.status,0,child.stderr);
 const rec=f.records().find(r=>r.profile==='team/reviewer');
 fs.rmSync(path.join(f.home,'.local/state/agent-farm/launches',lead.id+'.json'));
 // The lead is gone from this machine, and the link could even have changed: a resume is not checked again.
 f.put('agents/lead.md','---\nharness: claude\nmodel: claude-opus-5-5\n---\nLead.\n');installPlugin(f.source,f.root);
 const resumed=f.invoke(['reviewer','--resume',rec.id,'--parent',`team/lead@${lead.id}`]);
 assert.equal(resumed.status,0,resumed.stderr);
 const after=f.records().find(r=>r.id===rec.id);assert.deepEqual([after.parent_launch_id,after.link],[lead.id,'reviewer']);
});
