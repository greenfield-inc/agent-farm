import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Script} from 'node:vm';
import http from 'node:http';
import {spawnSync,execFileSync} from 'node:child_process';
import {TelemetryStore,telemetryProject} from '../dist/telemetry-query.js';
import {startTelemetryUI} from '../dist/telemetry-ui.js';
import {validateTelemetry,mergeTelemetry,telemetryAccess,resolveTelemetry,command,verify} from '../dist/runtime.js';
import {build} from '../dist/compiler.js';

function fixture(t){
  const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'farm-query-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const directory=path.join(base,'traces'),projectDirectory=path.join(base,'project');fs.mkdirSync(directory);fs.mkdirSync(projectDirectory);
  const options={directory,projectDirectory,scope:'project'};
  function session(project=projectDirectory,extra={}){const id=randomUUID(),dir=path.join(directory,id);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'session.json'),JSON.stringify({id,traceId:'a'.repeat(32),spanId:'b'.repeat(16),startTimeUnixNano:'1700000000000000000',endTimeUnixNano:'1700000001000000000',state:'finished',exitCode:0,attributes:{'agent_farm.project.directory':telemetryProject(project).id,'process.working_directory':project,'agent_farm.profile':'test','agent_farm.harness':'claude'},...extra}));return {id,dir};}
  return {base,options,session,store:new TelemetryStore(options)};
}
test('access is opt-in, exact-profile, collection-independent, with replaceable allowlists',()=>{
  assert.equal(telemetryAccess({},'test'),false);
  assert.equal(telemetryAccess({enabled:false,agent_access:{enabled:true}},'test'),true);
  assert.equal(telemetryAccess({agent_access:{enabled:true,profiles:[]}},'test'),false);
  assert.equal(telemetryAccess({agent_access:{enabled:true,profiles:['plugin/test']}},'test'),false);
  assert.equal(telemetryAccess({agent_access:{enabled:true,profiles:['plugin/test']}},'plugin/test'),true);
  const base={enabled:false,agent_access:{enabled:true,scope:'project',profiles:['a']}};
  assert.deepEqual(mergeTelemetry(base,{agent_access:{profiles:['b']}}),{enabled:false,agent_access:{enabled:true,scope:'project',profiles:['b']}});
  assert.throws(()=>validateTelemetry({agent_access:{scope:'machine'}}),/host settings/);
  assert.deepEqual(validateTelemetry({agent_access:{scope:'machine'}},true),{agent_access:{scope:'machine'}});
  for(const policy of [{profiles:['*']},{profiles:['a','a']},{enabled:'yes'},{other:true}])assert.throws(()=>validateTelemetry({agent_access:policy}));
});
test('queries enforce scope, validate IDs/arguments, paginate, and distinguish unfinished',async t=>{
  const f=fixture(t),a=f.session(),b=f.session(undefined,{state:'running',endTimeUnixNano:undefined});
  const other=path.join(f.base,'other');fs.mkdirSync(other);const foreign=f.session(other);
  let data=await f.store.query('list_sessions',{limit:1});assert.equal(data.items.length,1);assert.equal(data.total_matching,2);assert.equal(data.next_cursor,'1');
  data=await f.store.query('list_sessions',{status:'unfinished'});assert.equal(data.items[0].id,b.id);
  data=await f.store.query('summarize_sessions',{});assert.equal(data.success,1);assert.equal(data.unfinished,1);assert.equal(data.total_duration_ms,1000);
  await assert.rejects(f.store.query('get_session',{session_id:foreign.id}),/not found/);
  await assert.rejects(f.store.query('query_spans',{session_id:foreign.id}),/not found/);
  await assert.rejects(f.store.conversation({session_id:foreign.id}),/not found/);
  await assert.rejects(f.store.conversation({session_id:a.id,cursor:'-1'}),/Invalid/);
  for(const args of [{session_id:'../secret'},{session_id:a.id,directory:other},{session_id:'current'}])await assert.rejects(f.store.query('get_session',args));
  for(const args of [{limit:101},{limit:1.5},{cursor:'-1'},{from:'bogus'},{from:'2025-01-01',to:'2024-01-01'}])await assert.rejects(f.store.query('list_sessions',args));
  assert.equal((await new TelemetryStore({...f.options,scope:'machine'}).query('list_sessions')).total_matching,3);
  assert.equal((await new TelemetryStore({...f.options,currentSession:a.id}).query('get_session')).session.id,a.id);
});
test('linked worktrees share project scope; symlink records and unrelated repositories do not',async t=>{
  const f=fixture(t);execFileSync('git',['init','-q',f.options.projectDirectory]);
  execFileSync('git',['-C',f.options.projectDirectory,'-c','user.name=test','-c','user.email=test@example.com','commit','--allow-empty','-qm','initial']);
  const linked=path.join(f.base,'linked');execFileSync('git',['-C',f.options.projectDirectory,'worktree','add','-qb','linked',linked]);
  const s=f.session(linked);assert.equal(telemetryProject(linked).id,telemetryProject(f.options.projectDirectory).id);
  const store=new TelemetryStore(f.options);assert.equal((await store.query('list_sessions')).items[0].id,s.id);
  const symlink=randomUUID();fs.symlinkSync(s.dir,path.join(f.options.directory,symlink));assert.equal((await store.query('list_sessions')).items.length,1);
  fs.renameSync(path.join(s.dir,'session.json'),path.join(f.base,'metadata'));fs.symlinkSync(path.join(f.base,'metadata'),path.join(s.dir,'session.json'));
  await assert.rejects(store.query('get_session',{session_id:s.id}),/unreadable/);
});
test('span and event queries tolerate partial exports, preserve native usage, and bound results',async t=>{
  const f=fixture(t),s=f.session();
  const exportData={resourceSpans:[{scopeSpans:[{spans:[{name:'tool.failure',startTimeUnixNano:'1000000',endTimeUnixNano:'4000000',status:{code:2},attributes:[{key:'gen_ai.usage.input_tokens',value:{intValue:'7'}}]},{name:'ok',startTimeUnixNano:'1000000',endTimeUnixNano:'2000000'}]}]}]};
  fs.writeFileSync(path.join(s.dir,'traces.jsonl'),JSON.stringify(exportData)+'\nbad json\n{"unfinished":');
  let result=await f.store.query('query_spans',{session_id:s.id,error_only:true,min_duration_ms:2});assert.equal(result.items.length,1);assert.equal(result.items[0].duration_ms,3);assert.equal(result.items[0].attributes['gen_ai.usage.input_tokens'],'7');assert.equal(result.partial,true);assert.match(result.warnings.join(' '),/Malformed/);
  result=await f.store.query('query_spans',{session_id:s.id,text:'"name":"ok"',limit:1});assert.equal(result.items[0].name,'ok');
  fs.writeFileSync(path.join(s.dir,'logs.jsonl'),JSON.stringify({resourceLogs:[{scopeLogs:[{logRecords:[{body:{stringValue:'<script>alert(1)</script>'}}]}]}]})+'\n');
  result=await f.store.query('query_events',{session_id:s.id});assert.match(result.items[0].body.stringValue,/<script>/);
  fs.writeFileSync(path.join(s.dir,'logs.jsonl'),JSON.stringify({resourceLogs:[{scopeLogs:[{logRecords:Array.from({length:100},()=>({body:{stringValue:'x'.repeat(20000)}}))}]}]})+'\n');
  result=await f.store.query('query_events',{session_id:s.id,limit:100});assert.ok(JSON.stringify(result).length<140000);assert.ok(result.next_cursor);assert.equal(result.items[0].truncated,true);
});
test('stdio MCP negotiates, lists tools, reports tool errors, and emits only protocol JSON',t=>{
  const f=fixture(t),s=f.session();
  const requests=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'get_session',arguments:{}}},{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'get_session',arguments:{session_id:'../secret'}}}];
  const result=spawnSync(process.execPath,['dist/telemetry-mcp.js',JSON.stringify(f.options)],{env:{...process.env,AGENT_FARM_SESSION_ID:s.id},input:requests.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',timeout:5000});
  assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');const replies=result.stdout.trim().split('\n').map(JSON.parse);assert.equal(replies.length,4);assert.equal(replies[0].result.protocolVersion,'2025-06-18');assert.equal(replies[1].result.tools.length,5);assert.ok(replies[1].result.tools.every(t=>t.annotations.readOnlyHint));assert.equal(replies[2].result.structuredContent.session.id,s.id);assert.equal(replies[3].result.isError,true);
});
test('local UI requires its secret URL, validates origin, and serves scoped read-only queries',async t=>{
  const f=fixture(t),s=f.session(),ui=await startTelemetryUI(f.options);t.after(()=>new Promise(resolve=>ui.server.close(resolve)));
  assert.equal(ui.server.address().address,'127.0.0.1');
  const page=await fetch(ui.url);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await page.text(),/Agent Farm · Sessions/);
  assert.equal((await fetch(new URL('/',ui.url))).status,404);
  assert.equal((await fetch(ui.url,{headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(ui.url,{method:'POST'})).status,405);
  assert.equal(await new Promise((resolve,reject)=>{http.get(new URL(ui.url).origin,{path:'//['},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);}),400);
  const data=await (await fetch(ui.url+'api/list_sessions')).json();assert.equal(data.items[0].id,s.id);
  const conversation=await (await fetch(ui.url+'api/conversation?args='+encodeURIComponent(JSON.stringify({session_id:s.id})))).json();assert.equal(conversation.session_id,s.id);assert.equal(conversation.summary.cost_usd,null);
  assert.equal((await fetch(ui.url+'api/conversation?args='+encodeURIComponent(JSON.stringify({session_id:s.id,directory:'/'})))).status,400);
  const script=await (await fetch(ui.url+'app.js')).text();assert.ok(!script.includes('innerHTML'));assert.match(script,/textContent/);new Script(script);
  assert.equal((await fetch(ui.url+'api/get_session?args='+encodeURIComponent(JSON.stringify({session_id:s.id,directory:'/'})))).status,400);
});
for(const harness of ['claude','codex'])test(`${harness}: policy selects launch tools and bundles a standalone MCP server`,t=>{
  const f=fixture(t),root=path.join(f.base,'config');fs.mkdirSync(path.join(root,'agents'),{recursive:true});fs.writeFileSync(path.join(root,'agents/main.yaml'),`harness: ${harness}\nmodel: test\nskills: []\n`);
  fs.mkdirSync(path.join(f.base,'.codex'));fs.writeFileSync(path.join(f.base,'.codex/config.toml'),'');
  const bundle=build(root,'main',f.options.projectDirectory),env={...process.env,AGENT_FARM_TELEMETRY:'off',CODEX_HOME:path.join(f.base,'.codex'),AGENT_FARM_NATIVE_CODEX_HOME:path.join(f.base,'.codex')};
  const launch=()=>command(bundle,'main',{configRoot:root,env,prepare:true,home:f.base});
  assert.ok(!launch().argv.join(' ').includes('mcp_servers.agent_farm_telemetry'));
  for(const [profiles,expected] of [[undefined,true],[[],false],[['other'],false],[['main'],true]]){
    fs.writeFileSync(path.join(root,'settings.json'),JSON.stringify({telemetry:{agent_access:{enabled:true,profiles}}}));
    const result=launch();assert.equal(result.argv.join(' ').includes('telemetry-mcp.mjs'),expected);assert.equal(result.telemetry_access,expected);assert.equal(result.telemetry.enabled,false);verify(bundle);
    if(expected&&harness==='claude'){const server=JSON.parse(result.argv[result.argv.indexOf('--mcp-config')+1]).mcpServers.agent_farm_telemetry;assert.equal(server.env.AGENT_FARM_SESSION_ID,'');const child=spawnSync(server.command,server.args,{input:'{"jsonrpc":"2.0","id":1,"method":"initialize"}\n',encoding:'utf8',timeout:5000});assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).result.serverInfo.name,'agent-farm-telemetry');}
  }
  fs.writeFileSync(path.join(root,'settings.json'),JSON.stringify({telemetry:{agent_access:{enabled:true,scope:'machine'}}}));assert.equal(resolveTelemetry(root,undefined,env,f.base).agent_access.scope,'machine');
});
