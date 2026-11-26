import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from '../dist/compiler.js';
import {command,acpLaunch,nativeGcloud} from '../dist/runtime.js';
import {writeHarness} from './harness.mjs';

/** A temp HOME, a bin folder for a fake gcloud, and a log of every gcloud call it answers. */
function setup(t){
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-gcloud-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const home=path.join(base,'home'),bin=path.join(base,'bin'),log=path.join(base,'calls.log');
 for(const d of [home,bin])fs.mkdirSync(d,{recursive:true});
 const env={...process.env,HOME:home,USERPROFILE:home,PATH:bin,FAKE_LOG:log};
 for(const key of ['CLOUDSDK_ACTIVE_CONFIG_NAME','GOOGLE_APPLICATION_CREDENTIALS','CLOUDSDK_CONFIG','AGENT_FARM_GCLOUD_CHECK'])delete env[key];
 const calls=()=>{try{return fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch{return [];}};
 return {base,home,bin,log,env,calls};
}
/** A fake gcloud: logs each call, prints a token, and fails with FAKE_STDERR (exit 1) when FAKE_FAIL names the probe (cli or adc). */
const fakeGcloud=`const fs=require('node:fs');const a=process.argv.slice(2);const kind=a.includes('application-default')?'adc':'cli';
fs.appendFileSync(process.env.FAKE_LOG,JSON.stringify({kind,args:a,config:process.env.CLOUDSDK_ACTIVE_CONFIG_NAME,adc:process.env.GOOGLE_APPLICATION_CREDENTIALS})+'\\n');
const wait=Number(process.env.FAKE_SLEEP_MS??0);const end=Date.now()+wait;while(Date.now()<end){}
if((process.env.FAKE_FAIL??'').split(',').includes(kind)){process.stderr.write(process.env.FAKE_STDERR??'ERROR: (gcloud.auth.print-access-token) Reauthentication failed. cannot prompt during non-interactive execution.\\n');process.exit(1);}
process.stdout.write('ya29.SECRET_TOKEN_NEVER_KEPT\\n');`;

test('gcloud: a working identity reports ok, probed with its own config name in the environment',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const result=nativeGcloud({...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work'},f.home);
 assert.deepEqual(result.map(({key,state})=>({key,state})),[{key:'cli:work',state:'ok'}]);
 assert.deepEqual(f.calls().map(c=>[c.args.join(' '),c.config]),[['auth print-access-token','work']]);
});
test('gcloud: a reauth error marks the identity lapsed; the application-default probe gets the credentials path',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const result=nativeGcloud({...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work',GOOGLE_APPLICATION_CREDENTIALS:'/creds/work.json',FAKE_FAIL:'adc'},f.home);
 assert.deepEqual(result.map(({key,state})=>({key,state})),[{key:'cli:work',state:'ok'},{key:'adc:/creds/work.json',state:'lapsed'}]);
 const adc=f.calls().find(c=>c.kind==='adc');
 assert.deepEqual([adc.args.join(' '),adc.adc],['auth application-default print-access-token','/creds/work.json']);
});
test('gcloud: an application-default file gcloud cannot read as credentials is lapsed',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 for(const stderr of ['ERROR: (gcloud.auth.application-default.print-access-token) File /creds/work.json is not a valid json file.\n','ERROR: (gcloud.auth.application-default.print-access-token) The file /creds/work.json does not have a valid type. Type is None, expected one of (\'authorized_user\', \'service_account\').\n']){
  const result=nativeGcloud({...f.env,GOOGLE_APPLICATION_CREDENTIALS:'/creds/work.json',FAKE_FAIL:'adc',FAKE_STDERR:stderr},f.home,{refresh:true,now:Date.now()});
  assert.deepEqual(result.map(({state})=>state),['lapsed'],stderr);
 }
});
test('gcloud: an error that is not about the sign-in is unknown, not lapsed',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const result=nativeGcloud({...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work',FAKE_FAIL:'cli',FAKE_STDERR:'ERROR: network unreachable\n'},f.home);
 assert.equal(result[0].state,'unknown');
});
test('gcloud: no gcloud on PATH is unknown, never lapsed',t=>{
 const f=setup(t);
 assert.deepEqual(nativeGcloud({...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work'},f.home).map(i=>i.state),['unknown']);
});
test('gcloud: a probe that runs past the time limit is unknown',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const started=Date.now(),result=nativeGcloud({...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work',FAKE_SLEEP_MS:'5000'},f.home,{timeout:300});
 assert.equal(result[0].state,'unknown');assert.ok(Date.now()-started<4000);
});
test('gcloud: no identity in the environment means no gcloud call',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 assert.deepEqual(nativeGcloud(f.env,f.home),[]);assert.deepEqual(f.calls(),[]);
});
test('gcloud: a result is reused for ten minutes, ok or lapsed, and the cache holds no token',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const env={...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work',GOOGLE_APPLICATION_CREDENTIALS:'/creds/work.json',FAKE_FAIL:'adc'},now=Date.now();
 nativeGcloud(env,f.home,{now});
 const again=nativeGcloud({...env,FAKE_FAIL:''},f.home,{now:now+9*60_000});
 assert.deepEqual(again.map(i=>i.state),['ok','lapsed']);
 assert.equal(f.calls().length,2);
 const cache=fs.readFileSync(path.join(f.home,'.cache/agent-farm/gcloud-identities.json'),'utf8');
 assert.ok(!cache.includes('SECRET_TOKEN'));assert.ok(!cache.includes('Reauthentication'));
});
test('gcloud: after ten minutes the identity is probed again',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const env={...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work',FAKE_FAIL:'cli'},now=Date.now();
 nativeGcloud(env,f.home,{now});
 const later=nativeGcloud({...env,FAKE_FAIL:''},f.home,{now:now+11*60_000});
 assert.deepEqual(later.map(i=>i.state),['ok']);assert.equal(f.calls().length,2);
});
test('gcloud: parallel launches share one probe and all get its result',async t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const runtime=new URL('../dist/runtime.js',import.meta.url).href;
 const script=`import {nativeGcloud} from ${JSON.stringify(runtime)};process.stdout.write(nativeGcloud(process.env,process.env.HOME).map(i=>i.state).join(','));`;
 const env={...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work',FAKE_FAIL:'cli',FAKE_SLEEP_MS:'700'};
 const one=()=>new Promise(done=>{let out='';const c=spawn(process.execPath,['--input-type=module','-e',script],{env,stdio:['ignore','pipe','inherit']});c.stdout.on('data',d=>out+=d);c.on('close',()=>done(out));});
 const results=await Promise.all([one(),one(),one(),one()]);
 assert.deepEqual(results,['lapsed','lapsed','lapsed','lapsed']);
 assert.equal(f.calls().length,1);
 assert.ok(!fs.existsSync(path.join(f.home,'.cache/agent-farm/gcloud-identities.json.lock')));
});

const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
/** setup plus a config root with one agent and a project to launch in. */
function project(t,harness='codex'){
 const f=setup(t),root=path.join(f.home,'.config/agent-farm'),directory=path.join(f.base,'project');
 for(const d of [path.join(root,'agents'),directory,path.join(f.home,'.codex')])fs.mkdirSync(d,{recursive:true});
 fs.writeFileSync(path.join(root,'agents/main.yaml'),`harness: ${harness}\nmodel: test\n`);
 return {...f,root,directory,env:{...f.env,CODEX_HOME:path.join(f.home,'.codex'),AGENT_FARM_TELEMETRY:'off',AGENT_FARM_SIGNIN_CHECK:'off'}};
}
const lapsed=(...keys)=>()=>keys.map(key=>({key,kind:key.slice(0,key.indexOf(':')),name:key.slice(key.indexOf(':')+1),state:'lapsed'}));
const note='gcloud is unavailable in this folder: the gcloud configuration "work" credentials have lapsed (a new sign-in is needed). Do not run gcloud or retry it. If your work needs gcloud, report blocked once, asking the person to sign in again for this identity with their own sign-in command, and carry on without gcloud where you can.';

test('gcloud: a launch with a lapsed identity tells the agent not to use gcloud',t=>{
 const f=project(t),bundle=build(f.root,'main',f.directory);
 const r=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,gcloud:lapsed('cli:work')});
 assert.ok(r.argv.find(a=>a.startsWith('developer_instructions=')).includes(JSON.stringify(note).slice(1,-1)));
 assert.deepEqual(r.gcloud.map(i=>i.key),['cli:work']);
 const fine=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,gcloud:()=>[{key:'cli:work',kind:'cli',name:'work',state:'ok'}]});
 assert.ok(!fine.argv.find(a=>a.startsWith('developer_instructions='))?.includes('gcloud'));assert.deepEqual(fine.gcloud,[]);
 writeHarness(f.bin,'codex','process.exit(0);\n');
 const acp=acpLaunch(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,gcloud:lapsed('cli:work')});
 assert.ok(JSON.parse(acp.env.CODEX_CONFIG).developer_instructions.includes(note));
});
test('gcloud: AGENT_FARM_GCLOUD_CHECK=off and --explain never check',t=>{
 const f=project(t),bundle=build(f.root,'main',f.directory),never=()=>{throw new Error('must not check');};
 command(bundle,'main',{configRoot:f.root,env:{...f.env,AGENT_FARM_GCLOUD_CHECK:'off',CLOUDSDK_ACTIVE_CONFIG_NAME:'work'},home:f.home});
 command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,prepare:false,gcloud:never});
 command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,gcloud:false});
 writeHarness(f.bin,'gcloud',fakeGcloud);
 command(bundle,'main',{configRoot:f.root,env:{...f.env,AGENT_FARM_GCLOUD_CHECK:'off',CLOUDSDK_ACTIVE_CONFIG_NAME:'work'},home:f.home});
 assert.deepEqual(f.calls(),[]);
});
test('gcloud: --print-launch prints one stderr line naming the lapsed identities',t=>{
 const f=project(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const config=path.join(f.home,'.config/gcloud/configurations');fs.mkdirSync(config,{recursive:true});
 fs.writeFileSync(path.join(config,'config_work'),'[core]\naccount = person@example.com\nproject = demo\n');
 const r=spawnSync(process.execPath,[cli,'run','main','--print-launch','--directory',f.directory],{cwd:f.directory,encoding:'utf8',env:{...f.env,CLOUDSDK_CONFIG:path.dirname(config),CLOUDSDK_ACTIVE_CONFIG_NAME:'work',GOOGLE_APPLICATION_CREDENTIALS:'/creds/work.json',FAKE_FAIL:'cli,adc'}});
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stderr.trim(),'agent-farm: gcloud sign-in has lapsed for the gcloud configuration "work" (person@example.com) and the application-default credentials at /creds/work.json; sign in again for them with your own gcloud sign-in command. Agents started now are told not to use gcloud.');
 assert.ok(!r.stdout.includes('SECRET_TOKEN'));
 const instructions=JSON.parse(r.stdout).argv.find(a=>a.startsWith('developer_instructions='));
 assert.ok(instructions.includes('the gcloud configuration \\"work\\" credentials for person@example.com and the application-default credentials at /creds/work.json have lapsed'),instructions);
});
test('gcloud: native subagents get the same note',t=>{
 for(const harness of ['claude','codex']){
  const f=project(t,harness);
  fs.writeFileSync(path.join(f.root,'agents/main.yaml'),`harness: ${harness}\nmodel: test\nsubagents:\n  helper: {agent: helper, mode: native}\n`);
  fs.writeFileSync(path.join(f.root,'agents/helper.yaml'),`harness: ${harness}\nmodel: test\ninstructions: Help.\n`);
  const bundle=build(f.root,'main',f.directory);
  const r=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,gcloud:lapsed('cli:work')});
  if(harness==='claude')assert.ok(JSON.parse(r.argv[r.argv.indexOf('--agents')+1]).helper.prompt.includes(note));
  else{const file=JSON.parse(r.argv.find(a=>a.startsWith('agents.helper.config_file=')).slice(26));assert.ok(fs.readFileSync(file,'utf8').includes(JSON.stringify(note).slice(1,-1)),file);}
 }
});
const plain=text=>text.replace(/\x1B\[[0-9;]*m/g,'');
test('gcloud: doctor shows one row per identity in the environment, asking gcloud afresh',t=>{
 const f=setup(t);writeHarness(f.bin,'gcloud',fakeGcloud);
 const env={...f.env,CLOUDSDK_ACTIVE_CONFIG_NAME:'work',GOOGLE_APPLICATION_CREDENTIALS:'/creds/work.json'};
 nativeGcloud({...env,FAKE_FAIL:'cli'},f.home);
 const r=spawnSync(process.execPath,[cli,'doctor'],{cwd:f.base,encoding:'utf8',env:{...env,FAKE_FAIL:'adc'}});
 assert.equal(r.status,0,r.stderr);
 assert.match(plain(r.stdout),/gcloud\n {4}\S+ configuration "work": ok\n {4}\S+ application-default credentials \/creds\/work\.json: lapsed; sign in again with your own gcloud sign-in command\n/);
 assert.ok(!r.stdout.includes('SECRET_TOKEN'));
 const none=spawnSync(process.execPath,[cli,'doctor'],{cwd:f.base,encoding:'utf8',env:f.env});
 assert.match(plain(none.stdout),/gcloud\n {4}\S+ No gcloud identity in this environment/);
 const unknown=spawnSync(process.execPath,[cli,'doctor'],{cwd:f.base,encoding:'utf8',env:{...env,PATH:path.join(f.base,'empty')}});
 assert.match(plain(unknown.stdout),/\? configuration "work": could not check/);
});
