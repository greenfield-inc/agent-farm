import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../plugins/greenfield/skills/session-trace/scripts/build-trace.mjs',import.meta.url));
test('trace foregrounds escaped conversation text while tool details remain collapsed',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-trace-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const session=path.join(dir,'session.jsonl');
 const row=(n,type,payload)=>({timestamp:`2026-09-23T12:00:0${n}Z`,type,payload});
 const message=(role,text)=>({type:'message',role,content:[{type:role==='user'?'input_text':'output_text',text}]});
 const rows=[row(0,'session_meta',{id:'fixture',cwd:dir}),row(1,'response_item',message('user','Please fix <script>alert(1)</script>')),row(2,'response_item',message('assistant','Checking the renderer.')),row(3,'response_item',{type:'function_call',name:'exec',call_id:'c1',arguments:'{"cmd":"echo checked"}'}),row(4,'response_item',{type:'function_call_output',call_id:'c1',output:'checked'}),row(5,'response_item',message('assistant','Fixed the rendering.'))];
 rows.splice(2,0,row(1,'response_item',{...message('assistant','PRIVATE REASONING'),channel:'analysis'}));
 fs.writeFileSync(session,rows.map(x=>JSON.stringify(x)).join('\n'));
 const result=spawnSync(process.execPath,[script,'--session',session,'--out',dir],{encoding:'utf8',env:{...process.env,HOME:dir,USERPROFILE:dir}});
 assert.equal(result.status,0,result.stderr);
 const html=fs.readFileSync(path.join(dir,'trace.html'),'utf8');
 assert.match(html,/<details class="turn" open id="t0"/);
 assert.match(html,/<strong>User<\/strong>/);
 assert.match(html,/<strong>Agent<\/strong>/);
 assert.doesNotMatch(html,/PRIVATE REASONING/);
 assert.match(html,/Checking the renderer\./);
 assert.match(html,/Fixed the rendering\./);
 assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/<details class="tool-calls"><summary>1 tool calls<\/summary>/);
 assert.doesNotMatch(html,/<details class="tool-calls"[^>]*\bopen\b/);
});

test('Codex traces follow the Codex home the worker ran with, including its subagents',t=>{
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-trace-home-')));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const home=path.join(base,'home'),work=path.join(base,'worktree'),generated=path.join(home,'.cache/agent-farm/native-proof/abc'),elsewhere=path.join(base,'elsewhere');
 for(const dir of [work,elsewhere])fs.mkdirSync(dir,{recursive:true});
 const rollout=(codexHome,name,meta,ask,minute)=>{
  const dir=path.join(codexHome,'sessions/2026/10/06');fs.mkdirSync(dir,{recursive:true});
  const stamp=`2026-10-06T12:${minute}:00Z`,file=path.join(dir,`rollout-${name}.jsonl`);
  const message=text=>({type:'message',role:'user',content:[{type:'input_text',text}]});
  fs.writeFileSync(file,[{timestamp:stamp,type:'session_meta',payload:{timestamp:stamp,cwd:work,...meta}},{timestamp:stamp,type:'response_item',payload:message(ask)}].map(r=>JSON.stringify(r)).join('\n'));
  return file;
 };
 const parent=rollout(generated,'parent',{id:'worker'},'Review PR 42 for the workstream','10');
 rollout(generated,'child',{id:'child',parent_thread_id:'worker'},'Check the cleanup contract','11');
 rollout(path.join(home,'.codex'),'decoy',{id:'decoy'},'Unrelated native session','20');
 rollout(path.join(home,'.codex'),'decoy-child',{id:'decoy-child',parent_thread_id:'worker'},'Decoy child in the default home','21');
 const env={...process.env,HOME:home,USERPROFILE:home};delete env.CLAUDE_CODE_SESSION_ID;delete env.CODEX_HOME;
 const build=(args,cwd,extra={})=>{const out=fs.mkdtempSync(path.join(base,'out-'));const result=spawnSync(process.execPath,[script,'--out',out,...args],{cwd,encoding:'utf8',env:{...env,...extra}});assert.equal(result.status,0,result.stderr);return fs.readFileSync(path.join(out,'trace.html'),'utf8');};
 const expectWorker=html=>{assert.match(html,/Review PR 42 for the workstream/);assert.match(html,/Check the cleanup contract/);assert.doesNotMatch(html,/Unrelated native session|Decoy child/);};
 expectWorker(build([],work,{CODEX_HOME:generated}));
 expectWorker(build(['--session',parent],elsewhere));
 expectWorker(build(['--codex-home',generated],work));
 const launches=path.join(home,'.local/state/agent-farm/launches');fs.mkdirSync(launches,{recursive:true});
 fs.writeFileSync(path.join(launches,'pane-worker.json'),JSON.stringify({id:'pane-worker',profile:'greenfield/reviewer',variant:'codex',harness:'codex',directory:work,started_at:'2026-10-06T12:09:58Z',codex_home:generated}));
 expectWorker(build(['--launch','pane-worker'],elsewhere));
 const missing=spawnSync(process.execPath,[script,'--out',base,'--launch','nobody'],{cwd:elsewhere,encoding:'utf8',env});
 assert.equal(missing.status,1);assert.match(missing.stderr,/No Agent Farm launch record for nobody/);
});

test('a Claude worker trace is found from its Agent Farm launch ID',t=>{
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-trace-claude-')));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const home=path.join(base,'home'),project=path.join(home,'.claude/projects/-worktree'),launches=path.join(home,'.local/state/agent-farm/launches');
 for(const dir of [project,launches])fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(project,'planner-1.jsonl'),JSON.stringify({type:'user',timestamp:'2026-10-06T12:00:00Z',message:{role:'user',content:'Plan the orchestrator change'}}));
 fs.writeFileSync(path.join(launches,'planner-1.json'),JSON.stringify({id:'planner-1',profile:'greenfield/planner',harness:'claude',directory:base,started_at:'2026-10-06T12:00:00Z'}));
 const env={...process.env,HOME:home,USERPROFILE:home};delete env.CLAUDE_CODE_SESSION_ID;delete env.CLAUDE_CONFIG_DIR;
 const result=spawnSync(process.execPath,[script,'--out',base,'--launch','planner-1'],{cwd:base,encoding:'utf8',env});
 assert.equal(result.status,0,result.stderr);
 assert.match(fs.readFileSync(path.join(base,'trace.html'),'utf8'),/Plan the orchestrator change/);
});
