import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from '../dist/compiler.js';
import {command,verify} from '../dist/runtime.js';
import {startSession,redactArgs} from '../dist/telemetry.js';
import {writeHarness} from './harness.mjs';

const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const fake=`#!${process.execPath}
const fs=require('node:fs');
(async()=>{
 const args=process.argv.slice(2),env=process.env;
 if(env.WAIT_FOR_SIGNAL){fs.writeFileSync(env.READY,'ready');setInterval(()=>{},1000);return;}
 if(env.DISPATCH && !env.IN_CHILD){
   const r=require('node:child_process').spawnSync(process.execPath,[env.DISPATCH],{env:{...env,IN_CHILD:'1'},stdio:'inherit'});
   if(r.status!==0)throw new Error('child failed');
 }
 for(const [signal,key] of [['traces','resourceSpans'],['logs','resourceLogs'],['metrics','resourceMetrics']]){
   let endpoint=env.OTEL_EXPORTER_OTLP_ENDPOINT+'/v1/'+signal;
   if(args.includes('--yolo')){
     const field={traces:'trace_exporter',logs:'exporter',metrics:'metrics_exporter'}[signal];
     const config=args.findLast(a=>a.startsWith('otel.'+field+'='));
     if(!config)continue;
     endpoint=JSON.parse(config.match(/endpoint = ("[^"]*")/)[1]);
   }
   const item={resource:{attributes:[{key:'service.name',value:{stringValue:'fake-harness'}}]}};
   if(signal==='traces')item.scopeSpans=[{scope:{name:'fake'},spans:[{traceId:'a'.repeat(32),spanId:'b'.repeat(16),name:'native.tool',kind:1,startTimeUnixNano:'1',endTimeUnixNano:'2'}]}];
   if(signal==='logs')item.scopeLogs=[{logRecords:[{body:{stringValue:'tool event'}}]}];
   if(signal==='metrics')item.scopeMetrics=[{metrics:[]}];
   const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({[key]:[item]})});
   if(!response.ok)throw new Error('export failed: '+response.status);
 }
 fs.writeFileSync(env.RECORD+(env.IN_CHILD?'.child':''),JSON.stringify({args,traceparent:env.TRACEPARENT,id:env.AGENT_FARM_SESSION_ID,token:env.ANTHROPIC_AUTH_TOKEN,tty:process.stdin.isTTY}));
 process.stdout.write('harness stdout\\n');process.stderr.write('harness stderr\\n');process.exitCode=Number(env.EXIT_CODE??0);
})().catch(e=>{console.error(e);process.exitCode=1});
`;
function fixture(t,harness='claude'){
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-otel-')));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),cwd=path.join(base,'worktree'),home=path.join(base,'home'),bin=path.join(base,'bin'),directory=path.join(base,'telemetry');
 for(const d of [path.join(root,'agents'),cwd,path.join(home,'.codex'),bin])fs.mkdirSync(d,{recursive:true});
 fs.writeFileSync(path.join(root,'agents/main.yaml'),`harness: ${harness}\nmodel: test\nskills: []\nargs:\n  mode: {values: [review, build], default: review}\n  api_key: {type: string}\n`);
 fs.writeFileSync(path.join(root,'settings.json'),JSON.stringify({telemetry:{directory}}));
 fs.writeFileSync(path.join(home,'.codex/config.toml'),'');
 for(const h of ['claude','codex'])writeHarness(bin,h,fake);
 const env={...process.env,HOME:home,USERPROFILE:home,CODEX_HOME:path.join(home,'.codex'),AGENT_FARM_NATIVE_CODEX_HOME:path.join(home,'.codex'),AGENT_FARM_CONFIG_ROOT:root,PATH:bin+path.delimiter+process.env.PATH,RECORD:path.join(base,'record')};
 for(const k of ['AGENT_FARM_TELEMETRY','AGENT_FARM_TRACEPARENT','AGENT_FARM_SESSION_ID','TRACEPARENT'])delete env[k];
 const invoke=(args)=>spawnSync(process.execPath,[cli,'run','main','--config-root',root,'--directory',cwd,...args],{env,encoding:'utf8',timeout:15000});
 const sessions=()=>fs.readdirSync(directory).map(id=>({directory:path.join(directory,id),...JSON.parse(fs.readFileSync(path.join(directory,id,'session.json')))}));
 return {base,root,cwd,home,bin,directory,env,invoke,sessions};
}
const lines=(s,signal)=>fs.readFileSync(path.join(s.directory,signal+'.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const attrs=list=>Object.fromEntries(list.map(a=>[a.key,a.value.stringValue??a.value.intValue??a.value.boolValue??a.value.arrayValue]));

for(const harness of ['claude','codex'])test(`${harness}: post-exit artifact export includes lifecycle and preserves harness exit status`,t=>{
 const f=fixture(t,harness),bundle=path.join(f.base,'artifact');fs.mkdirSync(bundle);
 fs.writeFileSync(path.join(bundle,'bundle.json'),JSON.stringify({published:{kind:'grain',id:'existing'}}));
 f.env.AGENT_FARM_ARTIFACT_BUNDLE=bundle;f.env.EXIT_CODE='7';
 const r=f.invoke(['--exec']);assert.equal(r.status,7,r.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'))),[s]=f.sessions();
 assert.equal(manifest.telemetry.complete,true);assert.equal(manifest.published.id,'existing');
 const exported=path.join(bundle,'evidence/telemetry',s.id);
 assert.equal(JSON.parse(fs.readFileSync(path.join(exported,'session.json'))).exitCode,7);
 assert.match(fs.readFileSync(path.join(exported,'traces.jsonl'),'utf8'),/agent_farm.session/);
 assert.match(r.stderr,/publication pending/);
 f.env.AGENT_FARM_ARTIFACT_BUNDLE=path.join(f.base,'missing');
 const failed=f.invoke(['--exec']);assert.equal(failed.status,7);assert.match(failed.stderr,/artifact telemetry export failed/);
});

for(const harness of ['claude','codex'])test(`${harness}: prepared launches collect native signals and lifecycle, remain reusable, and redact metadata`,t=>{
 const f=fixture(t,harness);
 const result=f.invoke(['--print-launch','--arg','api_key=ARG-SECRET','--message','PROMPT-SECRET','--','--unknown-key','NATIVE-SECRET']);
 assert.equal(result.status,0,result.stderr);const launch=JSON.parse(result.stdout);
 assert.equal(fs.existsSync(f.directory),false);assert.equal(fs.existsSync(f.env.RECORD),false);
 verify(launch.bundle);
 for(let i=0;i<2;i++){
   const r=spawnSync(launch.argv[0],launch.argv.slice(1),{cwd:launch.cwd,env:{...f.env,...launch.env,EXIT_CODE:String(i?7:0)},encoding:'utf8',timeout:15000});
   assert.equal(r.status,i?7:0,r.stderr);assert.equal(r.stdout,'harness stdout\n');assert.equal(r.stderr,'harness stderr\n');
 }
 const sessions=f.sessions();assert.equal(sessions.length,2);assert.notEqual(sessions[0].traceId,sessions[1].traceId);
 for(const s of sessions){
   assert.equal(s.state,'finished');assert.equal(s.attributes['agent_farm.argument.mode'],'review');
   assert.equal(s.attributes['agent_farm.argument.api_key'],'[REDACTED]');assert.equal(s.attributes['agent_farm.harness'],harness);
   assert.equal(s.attributes['process.owner'],os.userInfo().username);assert.equal(s.attributes['process.working_directory'],f.cwd);
   const traces=lines(s,'traces');assert.equal(traces.length,2);
   const native=traces[0].resourceSpans[0];assert.equal(native.scopeSpans[0].spans[0].traceId,'a'.repeat(32));
   assert.equal(attrs(native.resource.attributes)['agent_farm.session.id'],s.id);
   assert.equal(attrs(native.resource.attributes)['service.name'],'fake-harness');
   const lifecycle=traces[1].resourceSpans[0].scopeSpans[0].spans[0];assert.equal(lifecycle.name,'agent_farm.session');
   assert.equal(lifecycle.traceId,s.traceId);assert.ok(BigInt(lifecycle.endTimeUnixNano)>=BigInt(lifecycle.startTimeUnixNano));
   assert.equal(lifecycle.status.code,s.exitCode===0?1:2);
   for(const signal of ['logs','metrics'])assert.equal(lines(s,signal).length,1);
   for(const name of fs.readdirSync(s.directory)){
     const p=path.join(s.directory,name),text=fs.readFileSync(p,'utf8');
     for(const secret of ['ARG-SECRET','NATIVE-SECRET','PROMPT-SECRET'])assert.equal(text.includes(secret),false,`${secret} in ${name}`);
     if(process.platform!=='win32')assert.equal(fs.statSync(p).mode&0o777,0o600);
   }
   if(process.platform!=='win32')assert.equal(fs.statSync(s.directory).mode&0o777,0o700);
 }
});

test('direct launch and standalone cross-harness process children share trace context and config root',t=>{
 const f=fixture(t);
 const artifact=path.join(f.base,'artifact');fs.mkdirSync(artifact);fs.writeFileSync(path.join(artifact,'bundle.json'),'{}');f.env.AGENT_FARM_ARTIFACT_BUNDLE=artifact;
 fs.appendFileSync(path.join(f.root,'agents/main.yaml'),'subagents: {worker: {agent: worker, mode: process}}\n');
 fs.writeFileSync(path.join(f.root,'agents/worker.yaml'),'harness: codex\nmodel: child\nskills: []\n');
 const bundle=build(f.root,'main',f.cwd);f.env.DISPATCH=path.join(bundle,'main/dispatch/worker');
 const r=f.invoke(['--exec']);assert.equal(r.status,0,r.stderr);
 const sessions=f.sessions();assert.equal(sessions.length,2);
 const parent=sessions.find(s=>s.attributes['agent_farm.route']==='main'),child=sessions.find(s=>s!==parent);
 assert.equal(child.traceId,parent.traceId);assert.equal(child.parentSpanId,parent.spanId);
 assert.equal(child.attributes['agent_farm.parent.session.id'],parent.id);assert.equal(child.attributes['gen_ai.request.model'],'child');
 const exported=JSON.parse(fs.readFileSync(path.join(artifact,'bundle.json'))).telemetry;
 assert.deepEqual(exported.session_ids,[parent.id]);assert.deepEqual(new Set(exported.exported_session_ids),new Set([parent.id,child.id]));assert.equal(exported.complete,true);
 assert.match(r.stderr,/incomplete snapshot/);assert.match(r.stderr,/complete snapshot/);
});

test('provider wrapper resolves secrets in the child without persisting them',t=>{
 const f=fixture(t);f.env.TEST_PROVIDER_KEY='PROVIDER-SECRET';
 fs.writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({telemetry:{directory:f.directory},provider:{name:'test',base_url:'http://localhost:1234',api_key_env:'TEST_PROVIDER_KEY'}}));
 const r=f.invoke(['--exec']);assert.equal(r.status,0,r.stderr);
 assert.equal(JSON.parse(fs.readFileSync(f.env.RECORD)).token,'PROVIDER-SECRET');
 for(const s of f.sessions())for(const p of fs.readdirSync(s.directory))assert.equal(fs.readFileSync(path.join(s.directory,p),'utf8').includes('PROVIDER-SECRET'),false);
});

test('Git metadata identifies a linked worktree and shared project without recording remote credentials',t=>{
 const f=fixture(t),repo=path.join(f.base,'repo');fs.mkdirSync(repo);
 const git=(...args)=>execFileSync('git',['-C',repo,...args],{stdio:'pipe'});
 git('init');git('-c','user.name=Test','-c','user.email=test@example.com','commit','--allow-empty','-m','initial');
 const linked=path.join(f.base,'linked');git('worktree','add','-b','feature',linked);
 const bundle=build(f.root,'main',linked),launch=command(bundle,'main',{headless:true,env:f.env,home:f.home});
 const r=spawnSync(launch.argv[0],launch.argv.slice(1),{env:{...f.env,...launch.envOverrides},encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);
 const [s]=f.sessions();assert.equal(s.attributes['vcs.worktree'],linked);assert.equal(s.attributes['vcs.ref.head.name'],'feature');
 assert.equal(s.attributes['agent_farm.project.directory'],path.join(repo,'.git'));assert.match(s.attributes['vcs.ref.head.revision'],/^[a-f0-9]{40}$/);
});

test('disabled telemetry retains direct native launch; malformed settings are rejected',t=>{
 const f=fixture(t);f.env.AGENT_FARM_TELEMETRY='off';
 let r=f.invoke(['--print-launch']);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).argv[0],'claude');assert.equal(fs.existsSync(f.directory),false);
 delete f.env.AGENT_FARM_TELEMETRY;
 fs.writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({telemetry:{enabled:false}}));
 r=f.invoke(['--print-launch']);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).argv[0],'claude');
 for(const telemetry of [{directory:'relative'},{enabled:'false'},{endpoint:'https://example.com'},null]){
   fs.writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({telemetry}));r=f.invoke(['--print-launch']);assert.equal(r.status,1);assert.match(r.stderr,/Telemetry supports/);
 }
});

test('default storage is local to the launching home; explain does not start collection',t=>{
 const f=fixture(t);fs.unlinkSync(path.join(f.root,'settings.json'));
 const r=f.invoke(['--explain']);assert.equal(r.status,0,r.stderr);
 const descriptor=JSON.parse(JSON.parse(r.stdout).argv[2]);assert.equal(descriptor.directory,path.join(f.home,'.local/state/agent-farm/telemetry'));
 assert.equal(fs.existsSync(descriptor.directory),false);
});

test('disabled host setting propagates to standalone process children',t=>{
 const f=fixture(t);
 fs.appendFileSync(path.join(f.root,'agents/main.yaml'),'subagents: {worker: {agent: worker, mode: process}}\n');
 fs.writeFileSync(path.join(f.root,'agents/worker.yaml'),'harness: claude\nmodel: child\nskills: []\n');
 fs.writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({telemetry:{enabled:false}}));
 delete f.env.AGENT_FARM_CONFIG_ROOT;
 const printed=f.invoke(['--print-launch']),launch=JSON.parse(printed.stdout);
 assert.equal(launch.env.AGENT_FARM_CONFIG_ROOT,f.root);
 const result=spawnSync(process.execPath,[path.join(launch.bundle,'main/dispatch/worker'),'--print-launch'],{env:{...f.env,...launch.env},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).argv[0],'claude');
});

test('concurrent launches have isolated collectors and files',async t=>{
 const f=fixture(t),launch=JSON.parse(f.invoke(['--print-launch']).stdout);
 const run=async()=>{
   const child=spawn(launch.argv[0],launch.argv.slice(1),{env:{...f.env,...launch.env},stdio:'ignore'});
   const [code]=await once(child,'exit');assert.equal(code,0);
 };
 await Promise.all([run(),run()]);
 const sessions=f.sessions();assert.equal(sessions.length,2);
 assert.notEqual(sessions[0].traceId,sessions[1].traceId);
 for(const s of sessions)assert.equal(lines(s,'traces').length,2);
});

test('interactive launches inherit the native terminal', {skip:process.platform!=='darwin'},t=>{
 let tty;
 try {tty=fs.openSync('/dev/tty','r');}catch {t.skip('requires a controlling terminal');return;}
 t.after(()=>fs.closeSync(tty));
 const f=fixture(t),bundle=build(f.root,'main',f.cwd),launch=command(bundle,'main',{env:f.env,home:f.home});
 const result=spawnSync('/usr/bin/script',['-q','/dev/null',...launch.argv],{env:{...f.env,...launch.envOverrides},stdio:[tty,'pipe','pipe'],encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(f.env.RECORD)).tty,true);
 assert.equal(f.sessions()[0].attributes['agent_farm.headless'],false);
});

test('receiver rejects malformed, unauthenticated and unsupported payloads and accepts subsequent exports',async t=>{
 const f=fixture(t),bundle=build(f.root,'main',f.cwd),launch=command(bundle,'main',{env:f.env,home:f.home});
 const descriptor=JSON.parse(launch.argv[2]);const s=await startSession(descriptor,['claude'],f.env);
 t.after(()=>s.finish(0,null));
 const post=(url,body,type='application/json')=>fetch(url,{method:'POST',headers:{'content-type':type},body});
 for(const [url,body,type,status] of [[s.endpoint+'/v1/traces','{',undefined,400],[s.endpoint+'/v1/traces','{}',undefined,400],[s.endpoint+'/v1/traces','{"resourceSpans":[null]}',undefined,400],[s.endpoint+'/v1/traces','abc','application/x-protobuf',415],[s.endpoint.replace(/\/[^/]+$/,'')+'/v1/traces','{}',undefined,404]])assert.equal((await post(url,body,type)).status,status);
 assert.equal((await post(s.endpoint+'/v1/traces','{"resourceSpans":[]}')).status,200);
 await s.finish(0,null);assert.equal(f.sessions()[0].state,'finished');
});

test('missing harness records launch failure',t=>{
 const f=fixture(t);for(const file of fs.readdirSync(f.bin))if(file.startsWith('claude'))fs.unlinkSync(path.join(f.bin,file));f.env.PATH=f.bin;
 const r=f.invoke(['--exec']);assert.equal(r.status,1,r.stderr);
 assert.equal(f.sessions()[0].error,'ENOENT');assert.equal(f.sessions()[0].state,'finished');
});

test('unavailable storage fails open and preserves harness exit status',t=>{
 const f=fixture(t);fs.writeFileSync(f.directory,'not a directory');
 writeHarness(f.bin,'claude',`process.stdout.write('ok');process.exit(7);\n`);
 const r=f.invoke(['--exec']);assert.equal(r.status,7);assert.equal(r.stdout,'ok');assert.match(r.stderr,/telemetry unavailable/);
});

test('supervisor forwards termination, records it, and exits with the same signal',{skip:process.platform==='win32'&&'Windows has no POSIX signals'},async t=>{
 const f=fixture(t);f.env.WAIT_FOR_SIGNAL='1';f.env.READY=path.join(f.base,'ready');
 const printed=f.invoke(['--print-launch']),launch=JSON.parse(printed.stdout);
 const child=spawn(launch.argv[0],launch.argv.slice(1),{env:{...f.env,...launch.env},stdio:'ignore'});
 t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
 const ended=once(child,'exit');
 for(let i=0;i<200&&!fs.existsSync(f.env.READY);i++)await delay(25);
 assert.equal(fs.existsSync(f.env.READY),true);child.kill('SIGTERM');
 const [code,signal]=await ended;assert.equal(code,null);assert.equal(signal,'SIGTERM');
 assert.equal(f.sessions()[0].signal,'SIGTERM');assert.equal(f.sessions()[0].state,'finished');
});

test('argument redaction retains known metadata and removes arbitrary content',()=>{
 assert.deepEqual(redactArgs(['exec','--model','model','--api-key=secret','-c','token="secret"','--append-system-prompt','private','--','private']),['exec','--model','model','--api-key=[REDACTED]','-c','[REDACTED]','--append-system-prompt','[REDACTED]','--','[REDACTED]']);
});

test('a workspace-selected directory collects parent and child telemetry outside the host default',t=>{
 const f=fixture(t),directory=path.join(f.base,'workspace-traces');
 fs.writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({telemetry:{enabled:false,directory:f.directory}}));
 fs.writeFileSync(path.join(f.root,'workspace.yaml'),'telemetry: '+JSON.stringify({enabled:true,directory}));
 fs.appendFileSync(path.join(f.root,'agents/main.yaml'),'subagents: {worker: {agent: worker, mode: process}}\n');
 fs.writeFileSync(path.join(f.root,'agents/worker.yaml'),'harness: codex\nmodel: child\nskills: []\n');
 const printed=f.invoke(['--print-launch']);assert.equal(printed.status,0,printed.stderr);
 const parent=JSON.parse(printed.stdout);
 assert.deepEqual(parent.telemetry,{enabled:true,directory});
 // The fallback is snapshotted too: no child rediscovery from its cwd or changed file.
 fs.writeFileSync(path.join(f.root,'workspace.yaml'),'telemetry: {enabled: false}');
 const r=spawnSync(parent.argv[0],parent.argv.slice(1),{env:{...f.env,...parent.env,DISPATCH:path.join(parent.bundle,'main/dispatch/worker')},encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(f.directory),false);
 const sessions=fs.readdirSync(directory).map(id=>({directory:path.join(directory,id),...JSON.parse(fs.readFileSync(path.join(directory,id,'session.json')))}));
 assert.equal(sessions.length,2);
 for(const s of sessions){
  assert.equal(s.state,'finished');assert.equal(s.attributes['agent_farm.workspace'],`user:${path.join(f.root,'workspace.yaml')}`);
  assert.equal(s.attributes['agent_farm.workspace.trust'],'personal');assert.equal(lines(s,'traces').length,2);
 }
 const fresh=f.invoke(['--print-launch']);assert.equal(fresh.status,0,fresh.stderr);assert.equal(JSON.parse(fresh.stdout).argv[0],'claude');
});
