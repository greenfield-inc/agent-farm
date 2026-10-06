import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {writeHarness} from './harness.mjs';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

function fixture(t) {
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-resume-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),target=path.join(base,'repo'),home=path.join(base,'home'),bin=path.join(base,'bin'),record=path.join(base,'argv.json');
 for(const dir of [target,path.join(home,'.codex'),bin])fs.mkdirSync(dir,{recursive:true});
 const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
 put('agents/planner-claude.md','---\nharness: claude\nmodel: claude-opus-5-5\n---\nClaude planner.\n');
 put('agents/planner-codex.md','---\nharness: codex\nmodel: gpt-6-astra\n---\nCodex planner.\n');
 put('profiles/planner.yaml','variants:\n  claude:\n    agent: planner-claude\n  codex:\n    agent: planner-codex\ndefault: codex\n');
 // Fake harnesses record the argv they were started with.
 for(const harness of ['claude','codex'])writeHarness(bin,harness,`require('fs').writeFileSync(${JSON.stringify(record)},JSON.stringify({harness:${JSON.stringify(harness)},argv:process.argv.slice(2)}));\n`);
 const env={...process.env,HOME:home,USERPROFILE:home,PATH:bin+path.delimiter+process.env.PATH,AGENT_FARM_TELEMETRY:'off',PANE_PANEL_ID:'panel-under-test'};
 delete env.CODEX_HOME;delete env.AGENT_FARM_NATIVE_CODEX_HOME;delete env.CLAUDE_CONFIG_DIR;
 const invoke=(profile,args=[],extraEnv={})=>{
  fs.rmSync(record,{force:true});
  const result=spawnSync(process.execPath,[cli,'run',profile,'--config-root',root,'--directory',target,'--no-workspace',...args],{encoding:'utf8',env:{...env,...extraEnv}});
  return {...result,launched:fs.existsSync(record)?JSON.parse(fs.readFileSync(record,'utf8')):undefined,reported:[...result.stderr.matchAll(/^PANE_AGENT_SESSION_ID=(\S+)$/gm)].map(m=>m[1])};
 };
 const launches=()=>{const dir=path.join(home,'.local/state/agent-farm/launches');return fs.existsSync(dir)?fs.readdirSync(dir).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))):[];};
 return {base,root,target,home,bin,invoke,launches};
}

test('a first Claude launch gets a recorded session ID and reports it to Pane',t=>{
 const f=fixture(t),r=f.invoke('planner:claude');
 assert.equal(r.status,0,r.stderr);assert.equal(r.launched.harness,'claude');
 assert.equal(r.reported.length,1);const id=r.reported[0];
 assert.equal(r.launched.argv[r.launched.argv.indexOf('--session-id')+1],id);
 const [record]=f.launches();assert.deepEqual([record.id,record.profile,record.variant,record.harness,record.directory],[id,'planner','claude','claude',f.target]);
});

test('the Pane line is printed only under Pane',t=>{
 const f=fixture(t),r=f.invoke('planner:claude',[],{PANE_PANEL_ID:''});
 assert.equal(r.status,0,r.stderr);assert.deepEqual(r.reported,[]);
 assert.ok(r.launched.argv.includes('--session-id'));assert.equal(f.launches().length,1);
});

test('resuming a bare profile reopens the recorded variant instead of the default',t=>{
 const f=fixture(t),id=f.invoke('planner:claude').reported[0];
 fs.mkdirSync(path.join(f.home,'.claude/projects/-repo'),{recursive:true});fs.writeFileSync(path.join(f.home,'.claude/projects/-repo',id+'.jsonl'),'{}\n');
 const r=f.invoke('planner',['--resume',id]);
 assert.equal(r.status,0,r.stderr);assert.equal(r.launched.harness,'claude','the default variant is codex; the recorded one is claude');
 assert.equal(r.launched.argv[r.launched.argv.indexOf('--resume')+1],id);assert.equal(r.launched.argv.includes('--session-id'),false);
 assert.deepEqual(r.reported,[id]);
});

test('a Claude session that never saved a conversation starts fresh under the same ID',t=>{
 const f=fixture(t),id=f.invoke('planner:claude').reported[0];
 const r=f.invoke('planner',['--resume',id]);
 assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/no saved conversation/);
 assert.equal(r.launched.argv[r.launched.argv.indexOf('--session-id')+1],id);assert.equal(r.launched.argv.includes('--resume'),false);
 assert.deepEqual(r.reported,[id]);assert.equal(f.launches().length,1);
});

test('a Codex resume finds the top-level session the launch started and ignores subagent threads',t=>{
 const f=fixture(t),first=f.invoke('planner');
 assert.equal(first.status,0,first.stderr);assert.equal(first.launched.harness,'codex');assert.equal(first.launched.argv.includes('resume'),false);
 const id=first.reported[0],[record]=f.launches();assert.equal(record.variant,'codex');assert.ok(record.codex_home);
 const day=path.join(record.codex_home,'sessions','2026','09','27');fs.mkdirSync(day,{recursive:true});
 const write=(name,payload)=>fs.writeFileSync(path.join(day,name),JSON.stringify({type:'session_meta',payload})+'\n');
 const now=new Date().toISOString();
 write('rollout-a-11111111-1111-1111-1111-111111111111.jsonl',{id:'11111111-1111-1111-1111-111111111111',timestamp:now,cwd:path.join(f.base,'elsewhere'),thread_source:'user'});
 write('rollout-b-22222222-2222-2222-2222-222222222222.jsonl',{id:'22222222-2222-2222-2222-222222222222',timestamp:now,cwd:f.target,thread_source:'user'});
 write('rollout-c-33333333-3333-3333-3333-333333333333.jsonl',{id:'33333333-3333-3333-3333-333333333333',session_id:'22222222-2222-2222-2222-222222222222',parent_thread_id:'22222222-2222-2222-2222-222222222222',timestamp:now,cwd:f.target,thread_source:'subagent'});
 const r=f.invoke('planner',['--resume',id]);
 assert.equal(r.status,0,r.stderr);assert.equal(r.launched.harness,'codex');
 assert.deepEqual(r.launched.argv.slice(0,2),['resume','22222222-2222-2222-2222-222222222222']);
 assert.equal(f.launches()[0].native_session_id,'22222222-2222-2222-2222-222222222222');assert.deepEqual(r.reported,[id]);
});

test('an unrecorded ID is handed to the harness as a native session ID',t=>{
 const f=fixture(t),r=f.invoke('planner:claude',['--resume','native-session']);
 assert.equal(r.status,0,r.stderr);assert.equal(r.launched.argv[r.launched.argv.indexOf('--resume')+1],'native-session');
 assert.deepEqual(f.launches(),[]);
});

test('resume refuses headless launches, native resume arguments and a different variant',t=>{
 const f=fixture(t),id=f.invoke('planner:claude').reported[0];
 for(const [args,pattern] of [[['--resume',id,'--exec'],/cannot be combined with --exec/],[['--resume',id,'--','--continue'],/not both/]]){
  const r=f.invoke('planner',args);assert.equal(r.status,1);assert.match(r.stderr,pattern);
 }
 const r=f.invoke('planner:codex',['--resume',id]);assert.equal(r.status,1);assert.match(r.stderr,/was launched as planner:claude on claude/);
});

test('native resume arguments skip Agent Farm session IDs',t=>{
 const f=fixture(t),r=f.invoke('planner:claude',['--','--continue']);
 assert.equal(r.status,0,r.stderr);assert.equal(r.launched.argv.includes('--session-id'),false);
 assert.deepEqual(r.reported,[]);assert.deepEqual(f.launches(),[]);
});

test('an interactive resume never asks which variant',{skip:process.platform!=='darwin'},t=>{
 const f=fixture(t),id=f.invoke('planner:claude').reported[0];
 // script(1) gives the CLI a real terminal, where a bare profile would otherwise ask.
 const record=path.join(f.base,'argv.json');fs.rmSync(record,{force:true});
 const result=spawnSync('/usr/bin/script',['-q','/dev/null',process.execPath,cli,'run','planner','--resume',id,'--config-root',f.root,'--directory',f.target,'--no-workspace'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,env:{...process.env,HOME:f.home,PATH:f.bin+path.delimiter+process.env.PATH,AGENT_FARM_TELEMETRY:'off',PANE_PANEL_ID:'panel-under-test'}});
 assert.equal(result.error,undefined,'the launch waited for input');assert.equal(result.status,0,result.stdout);
 assert.doesNotMatch(result.stdout,/◆/,'the variant picker opened');assert.equal(JSON.parse(fs.readFileSync(record,'utf8')).harness,'claude');
});
