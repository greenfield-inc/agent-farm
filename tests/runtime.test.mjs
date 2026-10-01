import {noWorkspace} from '../dist/workspaces.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from '../dist/compiler.js';
import {command,codexHome,loadProvider,fileMap,verify} from '../dist/runtime.js';
import {parse as parseToml} from 'smol-toml';
import {writeHarness} from './harness.mjs';

const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const stdout='{"type":"rate_limit_event","status":429}\n{"type":"turn.failed"}\n';
const stderr='HTTP 529\napi_retry: literal $(echo untouched)\n';
function fixture(t,harness='codex') {
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-launch-')));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),target=path.join(base,'repo with spaces'),home=path.join(base,'home'),bin=path.join(base,'bin'),record=path.join(base,'record.json');
 for(const directory of [target,bin,path.join(root,'agents'),path.join(home,'.codex'),path.join(root,'skills/proof')])fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(root,'agents/planner.yaml'),`harness: ${harness}\nmodel: test\nskills: [proof]\n`);
 fs.writeFileSync(path.join(root,'agents/implementer.yaml'),'harness: codex\nmodel: test\nskills: [proof]\n');
 fs.writeFileSync(path.join(root,'skills/proof/SKILL.md'),'Proof skill');
 fs.writeFileSync(path.join(home,'.codex/auth.json'),'AUTH-SECRET-FIXTURE');
 fs.writeFileSync(path.join(home,'.codex/config.toml'),'');
 const script=`#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(process.env.RECORD,JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),home:process.env.CODEX_HOME,key:process.env.LINEAR_API_KEY}));process.stdout.write(${JSON.stringify(stdout)});process.stderr.write(${JSON.stringify(stderr)});process.exit(7);\n`;
 for(const name of ['codex','claude'])writeHarness(bin,name,script);
 // These regression cases exercise the original exec path. telemetry.test.mjs
 // exercises the default supervised path, including providers and dispatch.
 const env={...process.env,AGENT_FARM_TELEMETRY:'off',AGENT_FARM_CONFIG_ROOT:root,HOME:home,USERPROFILE:home,CODEX_HOME:path.join(home,'.codex'),AGENT_FARM_NATIVE_CODEX_HOME:path.join(home,'.codex'),PATH:bin+path.delimiter+process.env.PATH,RECORD:record,LINEAR_API_KEY:'LINEAR-SECRET-FIXTURE',CLIPROXY_API_KEY:'PROXY-SECRET-FIXTURE',GH_TOKEN:'GITHUB-SECRET-FIXTURE'};
 const invoke=(args,profile='planner')=>spawnSync(process.execPath,[cli,'run',profile,'--config-root',root,'--directory',target,...args],{env,encoding:'utf8'});
 return {base,root,target,home,bin,record,env,invoke};
}

test('print-launch prepares Codex bundle and home exactly as exec, without launching or printing inherited secrets',t=>{
 const f=fixture(t),result=f.invoke(['--print-launch']);
 assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');
 const launch=JSON.parse(result.stdout);
 assert.deepEqual(Object.keys(launch).sort(),['argv','bundle','cross_plugin_dependencies','cwd','env','launch','profile','telemetry','telemetry_access','trace_identity','workspace_source']);
 assert.equal(launch.telemetry_access,false);
 assert.equal(launch.trace_identity,'local/planner@local');
 assert.equal(launch.cwd,f.target);assert.ok(fs.statSync(launch.bundle).isDirectory());
 assert.ok(fs.statSync(launch.env.CODEX_HOME).isDirectory());
 assert.equal(launch.env.AGENT_FARM_NATIVE_CODEX_HOME,path.join(f.home,'.codex'));
 assert.equal(fs.realpathSync(path.join(launch.env.CODEX_HOME,'auth.json')),path.join(f.home,'.codex/auth.json'));
 assert.equal(fs.readFileSync(path.join(launch.env.CODEX_HOME,'skills/proof/SKILL.md'),'utf8'),'Proof skill');
 const expected=command(launch.bundle,'main',{headless:true,home:f.home,env:f.env});
 assert.deepEqual(launch.argv,expected.argv);assert.deepEqual(launch.env,expected.envOverrides);
 assert.equal(fs.existsSync(f.record),false);verify(launch.bundle);
 for(const secret of ['AUTH-SECRET-FIXTURE','LINEAR-SECRET-FIXTURE','PROXY-SECRET-FIXTURE','GITHUB-SECRET-FIXTURE']) {
  assert.equal(result.stdout.includes(secret),false);
  for(const relative of Object.keys(fileMap(launch.bundle)))assert.equal(fs.readFileSync(path.join(launch.bundle,relative),'utf8').includes(secret),false);
 }
});

function launchIdentity(launch,harness) {
 if(harness==='claude')return launch.argv[launch.argv.indexOf('--append-system-prompt')+1];
 const value=launch.argv.find(v=>v.startsWith('developer_instructions='));
 return JSON.parse(value.slice('developer_instructions='.length));
}

test('entry model flags override only the entry model and report ad hoc sources',t=>{
 const f=fixture(t);fs.appendFileSync(path.join(f.root,'agents/planner.yaml'),'subagents: {worker: {agent: implementer, mode: native}}\n');
 const result=f.invoke(['--explain','--model','gpt-6-astra','--reasoning','medium','--speed','fast']);
 assert.equal(result.status,0,result.stderr);const launch=JSON.parse(result.stdout);
 assert.equal(launch.launch.override,'ad hoc');assert.deepEqual(launch.launch.model.sources,{name:'flag',reasoning:'flag',speed:'flag'});
 assert.equal(launch.argv[launch.argv.indexOf('--model')+1],'gpt-6-astra');assert.ok(launch.argv.includes('model_reasoning_effort="medium"'));assert.ok(launch.argv.includes('service_tier="fast"'));
 const manifest=JSON.parse(fs.readFileSync(path.join(launch.bundle,'manifest.json')));
 assert.equal(manifest.nodes.main.model,'gpt-6-astra');assert.equal(manifest.nodes['main/children/worker'].model,'test');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(launch.bundle,'main/agent.json'))).launch,launch.launch);verify(launch.bundle);
});

test('launch arguments validate, include defaults, preserve paths, and enter both identities byte-for-byte',t=>{
 for(const harness of ['codex','claude']) {
  const f=fixture(t,harness);fs.writeFileSync(path.join(f.root,'agents/planner.yaml'),`harness: ${harness}\nmodel: test\nargs:\n  mode: {values: [standard, fast], default: standard}\n  review: {values: [none, final, full], default: final}\n  parent: {type: path}\n  source: {type: string}\n`);
  const values=['--arg','mode=fast','--arg','review=full','--arg','parent=../worktrees/invoice-pdf/.agent/status.json','--arg','source=docs/agent/plans/invoice-pdf/handoff/WP-01.md'];
  for(const message of [[],['--message','Start']]) {
   const result=f.invoke(['--print-launch',...values,...message]);assert.equal(result.status,0,result.stderr);const launch=JSON.parse(result.stdout);
   const expected='LAUNCH CONTEXT\nheadless: true\nmode: fast\nreview: full\nparent: ../worktrees/invoice-pdf/.agent/status.json\nsource: docs/agent/plans/invoice-pdf/handoff/WP-01.md';
   assert.ok(launchIdentity(launch,harness).endsWith(expected));assert.deepEqual(launch.launch.arguments,{mode:'fast',review:'full',parent:'../worktrees/invoice-pdf/.agent/status.json',source:'docs/agent/plans/invoice-pdf/handoff/WP-01.md'});
  }
  const interactive=command(build(f.root,'planner',f.target),'main',{prepare:false});assert.ok(launchIdentity(interactive,harness).endsWith('LAUNCH CONTEXT\nheadless: false\nmode: standard\nreview: final'));
  for(const [arg,pattern] of [['review=maybe',/planner.*review.*maybe.*none, final, full/i],['unknown=x',/planner.*unknown.*accepted arguments/i],['review',/planner.*review.*malformed.*key=value/i]]) {
   const invalid=f.invoke(['--explain','--arg',arg]);assert.equal(invalid.status,1);assert.match(invalid.stderr,pattern);
  }
 }
});

test('different launch argument values create valid independent content-addressed bundles',t=>{
 const f=fixture(t);fs.appendFileSync(path.join(f.root,'agents/planner.yaml'),'args: {review: {values: [final, full], default: final}}\n');
 const first=f.invoke(['--print-launch','--arg','review=final']),second=f.invoke(['--print-launch','--arg','review=full']);
 assert.equal(first.status,0,first.stderr);assert.equal(second.status,0,second.stderr);
 const a=JSON.parse(first.stdout),b=JSON.parse(second.stdout);assert.notEqual(a.bundle,b.bundle);verify(a.bundle);verify(b.bundle);
 assert.equal(JSON.parse(fs.readFileSync(path.join(a.bundle,'main/agent.json'))).launch.arguments.review,'final');assert.equal(JSON.parse(fs.readFileSync(path.join(b.bundle,'main/agent.json'))).launch.arguments.review,'full');
});

test('model flag validation is harness-specific and launch-only',t=>{
 const claude=fixture(t,'claude');let result=claude.invoke(['--explain','--speed','fast']);assert.equal(result.status,1);assert.match(result.stderr,/model\.speed supports fast or standard for Codex only/);
 result=claude.invoke(['--explain','--reasoning','minimal']);assert.equal(result.status,1);assert.match(result.stderr,/accepted: low, medium, high, xhigh, max/);
 const nonRun=spawnSync(process.execPath,[cli,'inspect','planner','--config-root',claude.root,'--model','test'],{encoding:'utf8'});assert.equal(nonRun.status,1);assert.match(nonRun.stderr,/only supported by run and unset global/);
});

test('print-launch resumes in the same home after plugin skill and profile changes',t=>{
 const f=fixture(t),native=['exec','resume','stable-thread','--json'];
 const print=()=>{
  const result=f.invoke(['--print-launch','--',...native],'implementer');
  assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');
  const launch=JSON.parse(result.stdout);
  assert.deepEqual(launch.argv.slice(-native.length),native);
  assert.equal(fs.existsSync(f.record),false);verify(launch.bundle);return launch;
 };
 const before=print(),session=path.join(before.env.CODEX_HOME,'sessions/2026/09/17/stable-thread.jsonl');
 fs.mkdirSync(path.dirname(session),{recursive:true});fs.writeFileSync(session,'persisted thread');
 const oldFiles=fileMap(before.bundle);
 fs.writeFileSync(path.join(f.root,'skills/proof/SKILL.md'),'Updated plugin skill');
 const after=print();
 assert.notEqual(after.bundle,before.bundle);assert.deepEqual(fileMap(before.bundle),oldFiles);
 assert.equal(after.env.CODEX_HOME,before.env.CODEX_HOME);
 assert.equal(fs.readFileSync(session,'utf8'),'persisted thread');
 assert.equal(fs.readFileSync(path.join(after.env.CODEX_HOME,'skills/proof/SKILL.md'),'utf8'),'Updated plugin skill');
 fs.writeFileSync(path.join(f.root,'agents/implementer.yaml'),'harness: codex\nmodel: updated\nskills: [proof]\n');
 const edited=print();assert.notEqual(edited.bundle,after.bundle);
 assert.equal(edited.env.CODEX_HOME,before.env.CODEX_HOME);assert.equal(fs.readFileSync(session,'utf8'),'persisted thread');
 assert.equal(edited.argv[edited.argv.indexOf('--model')+1],'updated');
});

test('resume identity survives profile retargeting and compiler/runtime upgrades',async t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.root,'profiles'));
 fs.writeFileSync(path.join(f.root,'profiles/entry.yaml'),'agent: planner\n');
 const launch=bundle=>command(bundle,'main',{home:f.home,env:f.env});
 const before=build(f.root,'entry',f.target),runtime=launch(before).env.CODEX_HOME;
 const session=path.join(runtime,'sessions/thread.jsonl');fs.mkdirSync(path.dirname(session));fs.writeFileSync(session,'thread');
 fs.writeFileSync(path.join(f.root,'profiles/entry.yaml'),'agent: implementer\n');
 const retargeted=build(f.root,'entry',f.target);assert.notEqual(retargeted,before);
 assert.equal(launch(retargeted).env.CODEX_HOME,runtime);
 // Change the compiler/runtime bytes in an isolated installation, so both
 // content hashes change without altering the identity contract.
 const installation=path.join(f.base,'upgrade');fs.mkdirSync(installation);
 fs.writeFileSync(path.join(installation,'package.json'),'{"type":"module"}');
 fs.symlinkSync(fileURLToPath(new URL('../node_modules',import.meta.url)),path.join(installation,'node_modules'));
 for(const name of ['compiler.js','runtime.js','telemetry.js','telemetry-query.js','telemetry-mcp.js','telemetry-conversation.js','telemetry-hierarchy.js','telemetry-export.js','skill-layout.js','config.js','connections.js','workspaces.js']) {
  fs.copyFileSync(fileURLToPath(new URL('../dist/'+name,import.meta.url)),path.join(installation,name));
 }
 for(const name of ['compiler.js','runtime.js'])fs.appendFileSync(path.join(installation,name),'\n// Upgrade fixture\n');
 const upgraded=await import(pathToFileURL(path.join(installation,'compiler.js')).href);
 const bundle=upgraded.build(f.root,'entry',f.target);assert.notEqual(bundle,retargeted);verify(bundle);
 assert.equal(upgraded.command(bundle,'main',{home:f.home,env:f.env}).env.CODEX_HOME,runtime);
 assert.equal(fs.readFileSync(session,'utf8'),'thread');
});

test('profiles, workspaces, canonical directories and process child routes isolate homes',t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.root,'profiles'));
 for(const profile of ['a','b'])fs.writeFileSync(path.join(f.root,'profiles',profile+'.yaml'),'agent: planner\n');
 fs.writeFileSync(path.join(f.root,'workspace.yaml'),'connections: {}\n');
 const other=path.join(f.base,'other repo');fs.mkdirSync(other);
 const alias=path.join(f.base,'repo alias');fs.symlinkSync(f.target,alias);
 const home=(profile,target=f.target,workspace)=>command(build(f.root,profile,target,workspace),'main',{home:f.home,env:f.env}).env.CODEX_HOME;
 const first=home('a');assert.notEqual(home('b'),first);
 assert.notEqual(home('a',other),first);assert.notEqual(home('a',f.target,noWorkspace()),first);
 assert.equal(home('a',alias),first);
 fs.appendFileSync(path.join(f.root,'agents/planner.yaml'),'subagents: {worker: {agent: implementer, mode: process}}\n');
 const bundle=build(f.root,'a',f.target);
 assert.equal(command(bundle,'main',{home:f.home,env:f.env}).env.CODEX_HOME,first);
 assert.notEqual(command(bundle,'main/children/worker',{home:f.home,env:f.env}).env.CODEX_HOME,first);
});

test('reused homes refresh overlays, restore native skills and remove obsolete or dangling links',t=>{
 const f=fixture(t),native=path.join(f.home,'.codex/skills');
 fs.mkdirSync(path.join(native,'proof'),{recursive:true});fs.writeFileSync(path.join(native,'proof/SKILL.md'),'Native proof');
 fs.mkdirSync(path.join(f.root,'skills/extra'));fs.writeFileSync(path.join(f.root,'skills/extra/SKILL.md'),'Extra');
 fs.writeFileSync(path.join(f.root,'agents/planner.yaml'),'harness: codex\nmodel: test\nskills: [proof, extra]\n');
 const before=build(f.root,'planner',f.target),runtime=command(before,'main',{home:f.home,env:f.env}).env.CODEX_HOME;
 assert.equal(fs.readFileSync(path.join(runtime,'skills/proof/SKILL.md'),'utf8'),'Proof skill');
 // Bundle retention is a consumer concern; dangling old skill links must
 // still recover on the next launch without touching runtime session files.
 fs.rmSync(before,{recursive:true});
 fs.writeFileSync(path.join(f.root,'agents/planner.yaml'),'harness: codex\nmodel: test\nskills: []\n');
 const after=build(f.root,'planner',f.target);
 assert.equal(command(after,'main',{home:f.home,env:f.env}).env.CODEX_HOME,runtime);
 assert.equal(fs.readFileSync(path.join(runtime,'skills/proof/SKILL.md'),'utf8'),'Native proof');
 assert.deepEqual(fs.readdirSync(path.join(runtime,'skills')),['proof']);
 fs.mkdirSync(path.join(runtime,'skills/unmanaged'));
 assert.throws(()=>command(after,'main',{home:f.home,env:f.env}),/Conflicting runtime path/);
 assert.ok(fs.statSync(path.join(runtime,'skills/unmanaged')).isDirectory());
});

test('print-launch and standalone bundle runtime reject hand-edited bundles',t=>{
 const f=fixture(t),printed=f.invoke(['--print-launch']);assert.equal(printed.status,0,printed.stderr);
 const launch=JSON.parse(printed.stdout);
 fs.appendFileSync(path.join(launch.bundle,'main/skills/proof/SKILL.md'),'Tampered');
 const result=f.invoke(['--print-launch']);assert.equal(result.status,1);
 assert.match(result.stderr,/Bundle integrity check failed; refusing modified bundle/);assert.equal(result.stdout,'');
 const script=`import {run} from ${JSON.stringify(pathToFileURL(path.join(launch.bundle,'runtime.mjs')).href)};run(${JSON.stringify(launch.bundle)},'main',['--print-launch']);`;
 const standalone=spawnSync(process.execPath,['--input-type=module','--eval',script],{env:f.env,encoding:'utf8'});
 assert.equal(standalone.status,1);assert.match(standalone.stderr,/refusing modified bundle/);
 assert.equal(standalone.stdout,'');assert.equal(fs.existsSync(f.record),false);
});

const provider={name:'cliproxy',base_url:'http://127.0.0.1:8317',api_key_env:'CLIPROXY_API_KEY'};
function configureProvider(f,value=provider) {
 fs.writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({provider:value}));
 assert.deepEqual(loadProvider(f.root),value);
}
function assertNoSecrets(launch,printed,extra=[]) {
 for(const secret of ['AUTH-SECRET-FIXTURE','LINEAR-SECRET-FIXTURE','PROXY-SECRET-FIXTURE','GITHUB-SECRET-FIXTURE',...extra]) {
  assert.equal(printed.includes(secret),false);
  for(const relative of Object.keys(fileMap(launch.bundle)))assert.equal(fs.readFileSync(path.join(launch.bundle,relative),'utf8').includes(secret),false);
 }
 verify(launch.bundle);
}

test('host provider settings parse and validate without leaking invalid input',t=>{
 const f=fixture(t),file=path.join(f.root,'settings.json');
 assert.equal(loadProvider(f.root),undefined);
 fs.writeFileSync(file,'{}');assert.equal(loadProvider(f.root),undefined);
 configureProvider(f);
 const invalid=[null,[],{provider:null},{provider:[]},{other:'SECRET-INVALID'},
  ...[{name:'../escape'},{name:'openai'},{name:'x.y'},{base_url:'ftp://example.com'},
   {base_url:'https://SECRET-INVALID@example.com'},{base_url:'https://example.com/?key=SECRET-INVALID'},
   {base_url:'https://example.com/#SECRET-INVALID'},{base_url:'http://example.com/ bad'},
   {base_url:'https://example.com/?'},{base_url:'https://example.com/#'},{base_url:'http:\\example.com'},
   {base_url:'SECRET-INVALID'},{api_key_env:'SECRET-INVALID'},{api_key_env:'ANTHROPIC_AUTH_TOKEN'},
   {api_key_env:null},{api_key:'SECRET-INVALID'}].map(value=>({provider:{...provider,...value}})),
  {provider:{name:'cliproxy'}},'{SECRET-INVALID'];
 for(const value of invalid) {
  fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));
  assert.throws(()=>loadProvider(f.root),error=>!error.message.includes('SECRET-INVALID'));
  const result=f.invoke(['--print-launch']);
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr.includes('SECRET-INVALID'),false);
 }
});

test('provider match rejects unsupported values at load and print without leaking them',t=>{
 const f=fixture(t);
 for(const match of ['SECRET-INVALID','',null,true,0,[],{}]) {
  fs.writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({provider:{...provider,match}}));
  assert.throws(()=>loadProvider(f.root),/^Error: Provider match must be "all" or "slash-models"$/);
  const result=f.invoke(['--print-launch']);
  assert.equal(result.status,1);assert.equal(result.stdout,'');
  assert.match(result.stderr,/Provider match must be "all" or "slash-models"/);
  assert.equal(result.stderr.includes('SECRET-INVALID'),false);
 }
 assert.equal(fs.existsSync(f.record),false);
});

for(const harness of ['codex','claude'])for(const match of [undefined,'all','slash-models'])for(const slash of [false,true]) {
 test(`${harness} provider match ${match ?? '(absent)'} ${slash ? 'routes slash model' : 'selects native model routing'}`,t=>{
  const f=fixture(t,harness),model=slash ? 'deepseek/deepseek-v4.1-flash' : harness==='codex' ? 'gpt-6-astra' : 'claude-fable-5-1';
  configureProvider(f,{...provider,...(match===undefined ? {} : {match})});
  fs.writeFileSync(path.join(f.root,'agents/planner.yaml'),`harness: ${harness}\nmodel: ${model}\nskills: [proof]\n`);
  const result=f.invoke(['--print-launch']);assert.equal(result.status,0,result.stderr);
  const launch=JSON.parse(result.stdout),applied=match!=='slash-models' || slash;
  const direct=command(launch.bundle,'main',{headless:true,home:f.home,env:f.env,configRoot:f.root});
  assert.deepEqual(launch.argv,direct.argv);assert.deepEqual(launch.env,direct.envOverrides);
  assert.equal(launch.argv[launch.argv.indexOf('--model')+1],model);
  if(harness==='codex') {
   const config=path.join(launch.env.CODEX_HOME,'config.toml');
   assert.equal(fs.lstatSync(config).isSymbolicLink(),!applied);
   if(applied)assert.equal(parseToml(fs.readFileSync(config,'utf8')).model_provider,provider.name);
   else assert.equal(fs.realpathSync(config),path.join(f.home,'.codex/config.toml'));
  } else {
   assert.equal(launch.argv[0],applied ? process.execPath : 'claude');
   assert.equal(launch.env.ANTHROPIC_BASE_URL,applied ? provider.base_url : undefined);
   assert.equal(launch.env.ANTHROPIC_AUTH_TOKEN,applied ? '${CLIPROXY_API_KEY}' : undefined);
   for(const alias of ['HAIKU','SONNET','OPUS','FABLE'])assert.equal(launch.env['ANTHROPIC_DEFAULT_'+alias+'_MODEL'],applied ? model : undefined);
  }
  assert.equal(fs.readFileSync(path.join(f.home,'.codex/config.toml'),'utf8'),'');
  assert.equal(fs.existsSync(f.record),false);assertNoSecrets(launch,result.stdout);
 });
}

for(const parentSlash of [false,true])for(const childSlash of [false,true]) {
 test(`slash-models process child uses host settings with ${parentSlash ? 'slash' : 'native'} parent and ${childSlash ? 'slash' : 'native'} child`,t=>{
  const f=fixture(t);configureProvider(f,{...provider,match:'slash-models'});
  const model=slash=>slash ? 'deepseek/deepseek-v4.1-flash' : 'gpt-6-astra';
  fs.writeFileSync(path.join(f.root,'agents/planner.yaml'),`harness: codex\nmodel: ${model(parentSlash)}\nskills: [proof]\nsubagents: {worker: {agent: implementer, mode: process}}\n`);
  fs.writeFileSync(path.join(f.root,'agents/implementer.yaml'),`harness: codex\nmodel: ${model(childSlash)}\nskills: [proof]\n`);
  const result=f.invoke(['--print-launch']);assert.equal(result.status,0,result.stderr);
  const parent=JSON.parse(result.stdout);
  assert.equal(parent.env.AGENT_FARM_CONFIG_ROOT,f.root);
  const child=spawnSync(process.execPath,[path.join(parent.bundle,'main/dispatch/worker'),'--print-launch'],{env:{...f.env,...parent.env},encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);const launch=JSON.parse(child.stdout);
  const direct=command(parent.bundle,'main/children/worker',{headless:true,home:f.home,env:{...f.env,...parent.env}});
  assert.deepEqual(launch.argv,direct.argv);assert.deepEqual(launch.env,direct.envOverrides);
  const config=path.join(launch.env.CODEX_HOME,'config.toml');
  assert.equal(fs.lstatSync(config).isSymbolicLink(),!childSlash);
  if(childSlash)assert.equal(parseToml(fs.readFileSync(config,'utf8')).model_provider,provider.name);
  else assert.equal(fs.realpathSync(config),path.join(f.home,'.codex/config.toml'));
  assert.equal(fs.existsSync(f.record),false);assertNoSecrets(launch,child.stdout);
  configureProvider(f);
  const updated=spawnSync(process.execPath,[path.join(parent.bundle,'main/dispatch/worker'),'--print-launch'],{env:{...f.env,...parent.env},encoding:'utf8'});
  assert.equal(updated.status,0,updated.stderr);const routed=JSON.parse(updated.stdout);
  assert.equal(routed.bundle,launch.bundle);
  assert.equal(parseToml(fs.readFileSync(path.join(routed.env.CODEX_HOME,'config.toml'),'utf8')).model_provider,provider.name);
  assertNoSecrets(routed,updated.stdout);
 });
}

test('Codex provider configuration routes the profile without copying native config or secrets',t=>{
 const f=fixture(t);configureProvider(f);
 const native=path.join(f.home,'.codex/config.toml'),nativeText='model_provider = "openai"\n# NATIVE-CONFIG-SECRET\n';
 fs.writeFileSync(native,nativeText);
 const result=f.invoke(['--print-launch'],'implementer');assert.equal(result.status,0,result.stderr);
 const launch=JSON.parse(result.stdout),config=path.join(launch.env.CODEX_HOME,'config.toml');
 assert.equal(fs.lstatSync(config).isSymbolicLink(),false);
 const text=fs.readFileSync(config,'utf8'),data=parseToml(text);
 assert.deepEqual(data,{model_provider:'cliproxy',model_providers:{cliproxy:{name:'cliproxy',base_url:provider.base_url+'/v1',wire_api:'responses',env_key:'CLIPROXY_API_KEY'}}});
 assert.equal(text.includes('PROXY-SECRET-FIXTURE'),false);assert.equal(text.includes('NATIVE-CONFIG-SECRET'),false);
 assert.equal(fs.readFileSync(native,'utf8'),nativeText);
 assert.equal(fs.realpathSync(path.join(launch.env.CODEX_HOME,'auth.json')),path.join(f.home,'.codex/auth.json'));
 assert.equal(launch.argv[launch.argv.indexOf('--model')+1],'test');assert.equal(launch.env.AGENT_FARM_CONFIG_ROOT,f.root);
 assertNoSecrets(launch,result.stdout,['NATIVE-CONFIG-SECRET']);
 // Host updates affect the same bundle; switching providers never writes through native links.
 configureProvider(f,{...provider,name:'second',base_url:'https://gateway.example/api/v1/'});
 const next=f.invoke(['--print-launch'],'implementer');assert.equal(next.status,0,next.stderr);
 assert.equal(JSON.parse(next.stdout).bundle,launch.bundle);
 assert.equal(parseToml(fs.readFileSync(config,'utf8')).model_provider,'second');
 assert.equal(parseToml(fs.readFileSync(config,'utf8')).model_providers.second.base_url,'https://gateway.example/api/v1');
 fs.unlinkSync(path.join(f.root,'settings.json'));assert.equal(loadProvider(f.root),undefined);
 const restored=f.invoke(['--print-launch'],'implementer');assert.equal(restored.status,0,restored.stderr);
 assert.equal(fs.realpathSync(config),native);assert.equal(fs.readFileSync(config,'utf8'),nativeText);
 assert.deepEqual(Object.keys(JSON.parse(restored.stdout).env).sort(),['AGENT_FARM_CONFIG_ROOT','AGENT_FARM_NATIVE_CODEX_HOME','CODEX_HOME']);
 configureProvider(f);
 const again=f.invoke(['--print-launch'],'implementer');assert.equal(again.status,0,again.stderr);
 assert.equal(fs.lstatSync(config).isSymbolicLink(),false);assert.equal(fs.readFileSync(native,'utf8'),nativeText);
});

test('Codex provider launch has no native home or login dependency and does not require the key to prepare',t=>{
 const f=fixture(t);configureProvider(f);
 fs.rmSync(path.join(f.home,'.codex'),{recursive:true});assert.equal(fs.existsSync(path.join(f.home,'.codex')),false);
 delete f.env.CLIPROXY_API_KEY;
 const result=f.invoke(['--print-launch'],'implementer');assert.equal(result.status,0,result.stderr);
 const launch=JSON.parse(result.stdout);
 assert.equal(parseToml(fs.readFileSync(path.join(launch.env.CODEX_HOME,'config.toml'),'utf8')).model_provider,'cliproxy');
 assert.equal(fs.existsSync(path.join(launch.env.CODEX_HOME,'auth.json')),false);
 assert.equal(fs.existsSync(path.join(f.home,'.codex')),false);assert.equal(fs.existsSync(f.record),false);
 assertNoSecrets(launch,result.stdout);
});

test('Claude provider print exports references and aliases; verbatim argv resolves the child key and preserves streams',t=>{
 const f=fixture(t,'claude');configureProvider(f);
 const script=`#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(process.env.RECORD,JSON.stringify({pid:process.pid,args:process.argv.slice(2),token:process.env.ANTHROPIC_AUTH_TOKEN,base:process.env.ANTHROPIC_BASE_URL,aliases:['HAIKU','SONNET','OPUS','FABLE'].map(a=>process.env['ANTHROPIC_DEFAULT_'+a+'_MODEL'])}));process.stdout.write(${JSON.stringify(stdout)});process.stderr.write(${JSON.stringify(stderr)});process.exit(7);\n`;
 writeHarness(f.bin,'claude',script);
 const native=['-p','--output-format','stream-json','--resume','session with spaces'],message='$(literal) `text`\n"quoted"';
 delete f.env.CLIPROXY_API_KEY;
 const result=f.invoke(['--print-launch','--message',message,'--',...native]);assert.equal(result.status,0,result.stderr);
 const launch=JSON.parse(result.stdout);assert.equal(fs.existsSync(f.record),false);
 assert.equal(launch.env.ANTHROPIC_BASE_URL,provider.base_url);assert.equal(launch.env.ANTHROPIC_AUTH_TOKEN,'${CLIPROXY_API_KEY}');
 for(const alias of ['HAIKU','SONNET','OPUS','FABLE'])assert.equal(launch.env['ANTHROPIC_DEFAULT_'+alias+'_MODEL'],'test');
 assert.ok(launch.argv.includes('--strict-mcp-config'));assert.deepEqual(launch.argv.slice(-native.length-2),[...native,'--',message]);
 assert.equal(launch.argv[0],process.execPath);assertNoSecrets(launch,result.stdout);
 const missing=spawnSync(launch.argv[0],launch.argv.slice(1),{cwd:launch.cwd,env:{...f.env,...launch.env},encoding:'utf8'});
 assert.equal(missing.status,1);assert.match(missing.stderr,/Provider environment variable is unavailable/);assert.equal(fs.existsSync(f.record),false);
 const childEnv={...f.env,...launch.env,CLIPROXY_API_KEY:'CHILD-ONLY-SECRET $(literal) `token`'};
 // Windows has no exec, so the launcher spawns there and the next assertions are POSIX-only.
 if(process.platform!=='win32'){const unavailableArgv=[...launch.argv];unavailableArgv[3]='process.execve=undefined; '+unavailableArgv[3];
 const unavailable=spawnSync(unavailableArgv[0],unavailableArgv.slice(1),{cwd:launch.cwd,env:childEnv,encoding:'utf8'});
 assert.equal(unavailable.status,1);assert.match(unavailable.stderr,/Native launch requires Node 22.15\+/);
 assert.equal(fs.existsSync(f.record),false);assert.equal(unavailable.stdout,'');}
 const execution=spawnSync(launch.argv[0],launch.argv.slice(1),{cwd:launch.cwd,env:childEnv,encoding:'utf8'});
 assert.equal(execution.status,7,execution.stderr);assert.equal(execution.stdout,stdout);assert.equal(execution.stderr,stderr);
 const record=JSON.parse(fs.readFileSync(f.record));if(process.platform!=='win32')assert.equal(record.pid,execution.pid);
 assert.equal(record.token,childEnv.CLIPROXY_API_KEY);assert.equal(record.base,provider.base_url);
 assert.deepEqual(record.aliases,['test','test','test','test']);assert.deepEqual(record.args,launch.argv.slice(launch.argv.indexOf('claude')+1));
 f.env.CLIPROXY_API_KEY='EXEC-ONLY-SECRET';
 const direct=f.invoke(['--exec','--message',message,'--',...native]);assert.equal(direct.status,7,direct.stderr);
 assert.equal(direct.stdout,stdout);assert.ok(direct.stderr.endsWith(stderr));assert.equal(JSON.parse(fs.readFileSync(f.record)).token,'EXEC-ONLY-SECRET');
 assertNoSecrets(launch,result.stdout,[childEnv.CLIPROXY_API_KEY,'EXEC-ONLY-SECRET']);
});

test('process dispatch inherits custom host provider root and rereads host changes outside the bundle',t=>{
 const f=fixture(t,'claude');configureProvider(f);
 fs.appendFileSync(path.join(f.root,'agents/planner.yaml'),'subagents: {worker: {agent: implementer, mode: process}}\n');
 const result=f.invoke(['--print-launch']);assert.equal(result.status,0,result.stderr);
 const launch=JSON.parse(result.stdout),dispatch=path.join(launch.bundle,'main/dispatch/worker');
 configureProvider(f,{...provider,name:'updated'});
 const child=spawnSync(process.execPath,[dispatch,'--print-launch'],{env:{...f.env,...launch.env},encoding:'utf8'});assert.equal(child.status,0,child.stderr);
 const prepared=JSON.parse(child.stdout);
 assert.equal(parseToml(fs.readFileSync(path.join(prepared.env.CODEX_HOME,'config.toml'),'utf8')).model_provider,'updated');
 assert.equal(prepared.env.AGENT_FARM_CONFIG_ROOT,f.root);assertNoSecrets(prepared,child.stdout);
});

test('provider config refuses unmanaged runtime files without modifying them',t=>{
 const f=fixture(t),bundle=build(f.root,'implementer',f.target),env={...f.env};
 const runtime=codexHome(bundle,'main',env,f.home);
 const config=path.join(runtime,'config.toml');fs.unlinkSync(config);fs.writeFileSync(config,'# unmanaged\n');
 assert.throws(()=>codexHome(bundle,'main',{...f.env},f.home,provider),/Conflicting runtime path/);
 assert.equal(fs.readFileSync(config,'utf8'),'# unmanaged\n');assert.equal(fs.readFileSync(path.join(f.home,'.codex/config.toml'),'utf8'),'');
});

test('explain keeps runtime home unprepared',t=>{
 const f=fixture(t),result=f.invoke(['--explain']);
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).env,undefined);
 assert.equal(fs.existsSync(path.join(f.home,'.cache/agent-farm/native-proof')),false);
 assert.equal(fs.existsSync(f.record),false);
});

test('Claude passthrough keeps strict MCP and caller streaming, resume, hooks and limits before the literal message',t=>{
 const f=fixture(t,'claude'),message='$(touch NEVER) `echo no`\n"quoted"';
 const native=['-p','--output-format','stream-json','--verbose','--resume','session id','--settings','hooks with spaces.json','--max-turns','3','--max-budget-usd','2'];
 const result=f.invoke(['--print-launch','--message',message,'--',...native]);
 assert.equal(result.status,0,result.stderr);const launch=JSON.parse(result.stdout);
 assert.deepEqual(launch.env,{AGENT_FARM_CONFIG_ROOT:f.root});assert.ok(launch.argv.includes('--strict-mcp-config'));
 assert.deepEqual(launch.argv.slice(-native.length-2),[...native,'--',message]);
 assert.equal(launch.argv.filter(a=>a==='--output-format').length,1);assert.equal(launch.argv.includes('--print'),false);
 assert.equal(fs.existsSync(f.record),false);
 const execution=f.invoke(['--exec','--message',message,'--',...native]);
 assert.equal(execution.status,7,execution.stderr);assert.equal(execution.stdout,stdout);assert.ok(execution.stderr.endsWith(stderr));
 assert.deepEqual(JSON.parse(fs.readFileSync(f.record)).args,launch.argv.slice(1));
});

test('printed Codex resume argv spawns unchanged with caller-owned streams and environment',{skip:process.platform==='win32'&&'printed argv names the harness, and Windows consumers resolve npm shims themselves'},t=>{
 const f=fixture(t),message='Continue ENG-123\n$(literal)',native=['exec','resume','thread with spaces','--json'];
 const result=f.invoke(['--print-launch','--message',message,'--',...native],'implementer');
 assert.equal(result.status,0,result.stderr);const launch=JSON.parse(result.stdout);
 assert.deepEqual(launch.argv.slice(-native.length-2),[...native,'--',message]);
 assert.equal(launch.argv.filter(a=>a==='exec').length,1);
 assert.equal(fs.existsSync(f.record),false);
 const execution=spawnSync(launch.argv[0],launch.argv.slice(1),{cwd:launch.cwd,env:{...f.env,...launch.env},encoding:'utf8'});
 assert.equal(execution.status,7);assert.equal(execution.stdout,stdout);assert.equal(execution.stderr,stderr);
 const record=JSON.parse(fs.readFileSync(f.record));
 assert.deepEqual(record.args,launch.argv.slice(1));assert.equal(record.cwd,launch.cwd);
 assert.equal(record.home,launch.env.CODEX_HOME);assert.equal(record.key,f.env.LINEAR_API_KEY);
});

test('repeatable native arguments precede terminator arguments and native help bypasses Agent Farm help',t=>{
 const f=fixture(t),result=f.invoke(['--print-launch','--message=--help','--native-arg=exec','--native-arg=--json','--','resume','thread','--help']);
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(JSON.parse(result.stdout).argv.slice(-7),['exec','--json','resume','thread','--help','--','--help']);
 const repeated=f.invoke(['--print-launch','--native-arg=exec','--native-arg=--help']);
 assert.equal(repeated.status,0,repeated.stderr);assert.deepEqual(JSON.parse(repeated.stdout).argv.slice(-2),['exec','--help']);
});

test('print-launch preserves a wrapper executable and prefix for verbatim spawning before native flags and message',{skip:process.platform==='win32'&&'the wrapper is a shebang script'},t=>{
 for(const harness of ['claude','codex']) {
  const f=fixture(t,harness),bundle=build(f.root,'planner',f.target);
  const wrapper=path.join(f.bin,'launch-wrapper'),wrapperRecord=path.join(f.base,'wrapper.json');
  const prefix=['--wrapper-label','label with spaces','--'];
  // Replace the wrapper with the harness so neither it nor Agent Farm reads stdio.
  fs.writeFileSync(wrapper,`#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');const input=process.argv.slice(2);fs.writeFileSync(${JSON.stringify(wrapperRecord)},JSON.stringify(input));const [flag,label,separator,bin,...args]=input;require('node:assert/strict').deepEqual([flag,label,separator],${JSON.stringify(prefix)});process.execve(path.join(__dirname,bin),[bin,...args],process.env);\n`,{mode:0o755});
  const message='Continue ENG-123\n$(literal)',native=harness==='codex' ? ['exec','resume','thread with spaces','--json'] : ['-p','--output-format','stream-json','--verbose','--resume','session id'];
  const runtime=new URL('../dist/runtime.js',import.meta.url).href;
  // Compose a future wrapper-style command through the normal run/print path.
  const script=`import {command,run} from ${JSON.stringify(runtime)};run(${JSON.stringify(bundle)},'main',process.argv.slice(1),(...args)=>{const launch=command(...args);return {...launch,argv:[${JSON.stringify(wrapper)},...${JSON.stringify(prefix)},...launch.argv]};});`;
  const result=spawnSync(process.execPath,['--input-type=module','--eval',script,'--','--print-launch','--message',message,'--',...native],{env:f.env,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');const launch=JSON.parse(result.stdout);
  assert.deepEqual(launch.argv.slice(0,5),[wrapper,...prefix,harness]);
  assert.equal(['claude','codex'].includes(launch.argv[0]),false);
  assert.deepEqual(launch.argv.slice(-native.length-2),[...native,'--',message]);
  assert.equal(fs.existsSync(wrapperRecord),false);assert.equal(fs.existsSync(f.record),false);
  const [bin,...args]=launch.argv;
  const execution=spawnSync(bin,args,{cwd:launch.cwd,env:{...f.env,...launch.env},encoding:'utf8'});
  assert.equal(execution.status,7,execution.stderr);assert.equal(execution.stdout,stdout);assert.equal(execution.stderr,stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(wrapperRecord)),launch.argv.slice(1));
  const record=JSON.parse(fs.readFileSync(f.record));
  assert.deepEqual(record.args,launch.argv.slice(5));assert.equal(record.cwd,launch.cwd);
  if(harness==='codex')assert.equal(record.home,launch.env.CODEX_HOME);
  verify(bundle);
 }
});

test('standalone bundled dispatch supports prepared prints and both passthrough forms',t=>{
 const f=fixture(t,'claude');
 fs.appendFileSync(path.join(f.root,'agents/planner.yaml'),'subagents: {worker: {agent: implementer, mode: process}}\n');
 const bundle=build(f.root,'planner',f.target),dispatch=path.join(bundle,'main/dispatch/worker');
 const result=spawnSync(process.execPath,[dispatch,'--print-launch','--message','Continue','--native-arg=exec','--','resume','thread','--json'],{env:f.env,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const launch=JSON.parse(result.stdout);
 assert.deepEqual(launch.argv.slice(-6),['exec','resume','thread','--json','--','Continue']);
 assert.ok(fs.statSync(launch.env.CODEX_HOME).isDirectory());assert.equal(fs.existsSync(f.record),false);
});

test('process dispatch accepts and forwards explicit model overrides and arguments without parent inheritance',t=>{
 const f=fixture(t,'claude');
 fs.appendFileSync(path.join(f.root,'agents/planner.yaml'),'args: {parent: {type: string}}\nsubagents: {worker: {agent: implementer, mode: process}}\n');
 fs.appendFileSync(path.join(f.root,'agents/implementer.yaml'),'args: {review: {values: [final, full], default: final}}\n');
 const parentResult=f.invoke(['--print-launch','--arg','parent=parent-only']);assert.equal(parentResult.status,0,parentResult.stderr);const parent=JSON.parse(parentResult.stdout);
 const child=spawnSync(process.execPath,[path.join(parent.bundle,'main/dispatch/worker'),'--print-launch','--model','gpt-6-astra','--reasoning','medium','--speed','fast','--arg','review=full'],{env:{...f.env,...parent.env},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);const launch=JSON.parse(child.stdout);
 assert.equal(launch.launch.model.name,'gpt-6-astra');assert.equal(launch.launch.override,'ad hoc');assert.deepEqual(launch.launch.arguments,{review:'full'});assert.equal(launchIdentity(launch,'codex').includes('parent-only'),false);verify(launch.bundle);
});

test('profile presets match equivalent flags and flags take precedence',t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.root,'profiles'));
 fs.appendFileSync(path.join(f.root,'agents/implementer.yaml'),'args: {mode: {values: [standard, fast], default: standard}}\n');
 fs.writeFileSync(path.join(f.root,'profiles/implementer-fast.yaml'),'agent: implementer\nmodel: {name: gpt-6-astra, reasoning: medium, speed: fast}\nargs: {mode: fast}\n');
 const preset=f.invoke(['--explain'],'implementer-fast'),flags=f.invoke(['--explain','--model','gpt-6-astra','--reasoning','medium','--speed','fast','--arg','mode=fast'],'implementer');
 assert.equal(preset.status,0,preset.stderr);assert.equal(flags.status,0,flags.stderr);const a=JSON.parse(preset.stdout),b=JSON.parse(flags.stdout);
 assert.deepEqual({...a.launch,model:{...a.launch.model,sources:undefined},preset:undefined,override:undefined},{...b.launch,model:{...b.launch.model,sources:undefined},preset:undefined,override:undefined});
 assert.equal(a.launch.preset,'implementer-fast');assert.equal(a.launch.override,'preset');assert.equal(b.launch.override,'ad hoc');
 const overridden=f.invoke(['--explain','--model','different'],'implementer-fast');assert.equal(overridden.status,0,overridden.stderr);assert.equal(JSON.parse(overridden.stdout).launch.model.name,'different');assert.equal(JSON.parse(overridden.stdout).launch.model.sources.name,'flag');
});

test('conflicting modes and non-launch passthrough fail before generation',t=>{
 const f=fixture(t);
 for(const mode of ['--exec','--explain','--build']) {
  const result=f.invoke(['--print-launch',mode]);assert.equal(result.status,1);assert.match(result.stderr,/Choose only one/);
 }
 const result=spawnSync(process.execPath,[cli,'profiles','list','--config-root',f.root,'--print-launch'],{encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/require run or agent/);
 assert.equal(fs.existsSync(path.join(f.target,'.agent-farm')),false);
});

// Codex owns skills/.system in its CODEX_HOME: it replaces whatever is there
// with its own folder whenever the marker differs from its build.
function nativeSystem(f,marker='A') {
 const system=path.join(f.home,'.codex/skills/.system');
 fs.mkdirSync(path.join(system,'imagegen'),{recursive:true});
 fs.writeFileSync(path.join(system,'.codex-system-skills.marker'),marker);
 fs.writeFileSync(path.join(system,'imagegen/SKILL.md'),'Native imagegen');
 return system;
}
const snapshot=folder=>Object.fromEntries(files(folder).map(p=>[path.relative(folder,p),fs.readFileSync(p,'utf8')]));
function files(folder){return fs.readdirSync(folder,{recursive:true}).map(p=>path.join(folder,p)).filter(p=>fs.lstatSync(p).isFile()).sort();}
function codexWritesSystem(runtime,marker='B') {
 const system=path.join(runtime,'skills/.system');
 fs.rmSync(system,{recursive:true,force:true});
 fs.mkdirSync(path.join(system,'plugin-creator'),{recursive:true});
 fs.writeFileSync(path.join(system,'.codex-system-skills.marker'),marker);
 fs.writeFileSync(path.join(system,'plugin-creator/SKILL.md'),'Codex plugin-creator');
 return system;
}

test('a real skills/.system written by Codex does not break the next launch',t=>{
 const f=fixture(t),native=nativeSystem(f),before=snapshot(native);
 const bundle=build(f.root,'planner',f.target);
 const runtime=codexHome(bundle,'main',{...f.env},f.home);
 const system=codexWritesSystem(runtime),written=snapshot(system);
 assert.equal(codexHome(bundle,'main',{...f.env},f.home),runtime);
 assert.equal(fs.lstatSync(system).isSymbolicLink(),false);
 assert.deepEqual(snapshot(system),written);
 assert.deepEqual(snapshot(native),before);
 assert.equal(fs.readFileSync(path.join(runtime,'skills/proof/SKILL.md'),'utf8'),'Proof skill');
});

test('legacy skills/.system links are removed without touching native skills; fresh homes never get one',t=>{
 const f=fixture(t),native=nativeSystem(f),before=snapshot(native);
 fs.mkdirSync(path.join(f.home,'.codex/skills/mine'));fs.writeFileSync(path.join(f.home,'.codex/skills/mine/SKILL.md'),'Mine');
 const bundle=build(f.root,'planner',f.target);
 const runtime=codexHome(bundle,'main',{...f.env},f.home),skills=path.join(runtime,'skills');
 assert.deepEqual(fs.readdirSync(skills).sort(),['mine','proof']);
 fs.symlinkSync(native,path.join(skills,'.system'));
 codexHome(bundle,'main',{...f.env},f.home);
 assert.deepEqual(fs.readdirSync(skills).sort(),['mine','proof']);
 assert.equal(fs.readlinkSync(path.join(skills,'mine')),path.join(f.home,'.codex/skills/mine'));
 assert.equal(fs.readFileSync(path.join(skills,'proof/SKILL.md'),'utf8'),'Proof skill');
 assert.deepEqual(snapshot(native),before);
});

test('concurrent launches sharing a runtime home all succeed',async t=>{
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
 const f=fixture(t),native=nativeSystem(f),before=snapshot(native);
 for(const name of ['one','two','three']){fs.mkdirSync(path.join(f.root,'skills',name));fs.writeFileSync(path.join(f.root,'skills',name,'SKILL.md'),name);}
 const runtimeModule=pathToFileURL(fileURLToPath(new URL('../dist/runtime.js',import.meta.url))).href;
 const prepare=bundle=>promisify(execFile)(process.execPath,['--input-type=module','--eval',
  `import {codexHome} from ${JSON.stringify(runtimeModule)};process.stdout.write(codexHome(${JSON.stringify(bundle)},'main',{...process.env},${JSON.stringify(f.home)}));`],{env:f.env});
 const rounds=[['proof','one'],['proof','two','three'],['three'],[]];
 let runtime;
 for(const [index,selected] of rounds.entries()) {
  fs.writeFileSync(path.join(f.root,'agents/planner.yaml'),`harness: codex\nmodel: test\nskills: [${selected.join(', ')}]\n`);
  const bundle=build(f.root,'planner',f.target);
  if(runtime&&index%2===0)codexWritesSystem(runtime);
  if(runtime&&index%2===1){fs.rmSync(path.join(runtime,'skills/.system'),{recursive:true,force:true});fs.symlinkSync(native,path.join(runtime,'skills/.system'));}
  const results=await Promise.all(Array.from({length:8},()=>prepare(bundle)));
  runtime=results[0].stdout;
  for(const result of results)assert.equal(result.stdout,runtime);
  const skills=path.join(runtime,'skills');
  assert.deepEqual(fs.readdirSync(skills).filter(name=>name!=='.system').sort(),[...selected].sort());
  for(const name of selected)assert.equal(fs.readlinkSync(path.join(skills,name)),path.join(bundle,'main/skills',name));
  if(fs.readdirSync(skills).includes('.system'))assert.equal(fs.lstatSync(path.join(skills,'.system')).isSymbolicLink(),false);
 }
 assert.deepEqual(snapshot(native),before);
});

test('a Codex .system folder written while a legacy link is being removed is accepted',t=>{
 const f=fixture(t),native=nativeSystem(f),bundle=build(f.root,'planner',f.target);
 const runtime=codexHome(bundle,'main',{...f.env},f.home),system=path.join(runtime,'skills/.system');
 fs.symlinkSync(native,system);
 // A sibling removes the link and Codex writes its folder just before this unlink.
 const unlink=fs.unlinkSync;t.after(()=>{fs.unlinkSync=unlink;});
 fs.unlinkSync=(target,...rest)=>{if(target===system&&fs.lstatSync(system).isSymbolicLink()){unlink(system);codexWritesSystem(runtime);}return unlink(target,...rest);};
 codexHome(bundle,'main',{...f.env},f.home);
 fs.unlinkSync=unlink;
 assert.equal(fs.lstatSync(system).isDirectory(),true);
 assert.equal(fs.readFileSync(path.join(system,'.codex-system-skills.marker'),'utf8'),'B');
});
