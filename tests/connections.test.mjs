import {resolveWorkspace} from '../dist/workspaces.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {build,resolve} from '../dist/compiler.js';
import {command,codexHome,fileMap,files,verify} from '../dist/runtime.js';
import {fileIdentity} from './harness.mjs';
function setup(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-mcp-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const d of ['agents','one','two'])fs.mkdirSync(path.join(root,d));
 const put=(file,text)=>fs.writeFileSync(path.join(root,file),text);
 put('agents/parent.yaml','harness: codex\nmodel: test\nsubagents:\n  child:\n    agent: child\n    mode: native\n');
 put('agents/child.yaml','harness: codex\nmodel: test\n');
 put('workspace.yaml',`instructions: Use the workspace project.\nconnections:\n  service:\n    type: mcp\n    command: node\n    args: ["a path with spaces", "$(literal)"]\n    env:\n      CLOUDSDK_CORE_PROJECT: example-project\n    env_vars: [MCP_TEST_SECRET]\n  remote:\n    type: mcp\n    url: https://example.com/mcp\n    auth: native\n`);
 return {root,put,build:(dir='one')=>build(root,'parent',path.join(root,dir))};
}
test('workspace stdio configuration reaches Codex parent and native children without resolving secrets',t=>{
 const f=setup(t),b=f.build();const r=command(b,'main',{prepare:false,env:{MCP_TEST_SECRET:'NEVER_PERSIST_ME'}});
 assert.ok(r.argv.some(a=>a.includes('"env_vars" = ["MCP_TEST_SECRET"]')));
 assert.ok(r.argv.some(a=>a.includes('CLOUDSDK_CORE_PROJECT')));
 const child=fs.readFileSync(path.join(b,'main/native-agents/child.toml'),'utf8');
 assert.match(child,/env_vars = \["MCP_TEST_SECRET"\]/);
 assert.match(child,/Use the workspace project/);
 // Have the installed native parser check generated TOML when available.
 const parsed=spawnSync('codex',['-c',r.argv.find(a=>a.startsWith('mcp_servers.orchestra_service=')),'mcp','get','orchestra_service','--json'],{encoding:'utf8'});
 if (!parsed.error) {assert.equal(parsed.status,0,parsed.stderr);assert.equal(JSON.parse(parsed.stdout).transport.command,'node');}
 for(const file of Object.keys(fileMap(b))) assert.ok(!fs.readFileSync(path.join(b,file),'utf8').includes('NEVER_PERSIST_ME'));
});
test('Claude gets stdio env references and identical remote identities in different directories',t=>{
 const f=setup(t);f.put('agents/parent.yaml','harness: claude\nmodel: test\n');
 const a=f.build(),b=f.build('two');
 const config=fs.readFileSync(path.join(a,'main/mcp.json'),'utf8');
 assert.equal(config,fs.readFileSync(path.join(b,'main/mcp.json'),'utf8'));
 const service=JSON.parse(config).mcpServers.orchestra_service;
 assert.equal(service.type,'stdio');assert.deepEqual(service.args,['a path with spaces','$(literal)']);
 assert.equal(service.env.MCP_TEST_SECRET,'${MCP_TEST_SECRET}');
 assert.equal(service.env.CLOUDSDK_CORE_PROJECT,'example-project');
});
test('bearer-by-env Linear joins profile connections in a strict Claude launch without persisting secrets',t=>{
 const f=setup(t),secret='BEARER_SECRET_MUST_STAY_IN_CHILD_ENV';
 const previous=process.env.LINEAR_API_KEY;
 t.after(()=>{if(previous===undefined)delete process.env.LINEAR_API_KEY;else process.env.LINEAR_API_KEY=previous;});
 process.env.LINEAR_API_KEY=secret;
 f.put('workspace.yaml',`connections:\n  linear:\n    type: mcp\n    url: https://linear.example/mcp\n    auth: bearer_env\n    env_var: LINEAR_API_KEY\n`);
 f.put('agents/parent.yaml',`harness: claude\nmodel: test\nconnections:\n  profile_service:\n    type: mcp\n    command: node\nsubagents:\n  child:\n    agent: child\n    mode: native\n`);
 f.put('agents/child.yaml','harness: claude\nmodel: test\n');
 const b=f.build(),r=command(b,'main',{env:{LINEAR_API_KEY:secret},headless:true});
 assert.ok(r.argv.includes('--strict-mcp-config'));
 const configPath=r.argv[r.argv.indexOf('--mcp-config')+1];
 assert.equal(configPath,path.join(b,'main/mcp.json'));
 const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
 assert.deepEqual(Object.keys(config.mcpServers),['orchestra_linear','orchestra_profile_service']);
 assert.deepEqual(config.mcpServers.orchestra_linear,{type:'http',url:'https://linear.example/mcp',headers:{Authorization:'Bearer ${LINEAR_API_KEY}'}});
 assert.equal(config.mcpServers.orchestra_profile_service.command,'node');
 assert.equal(r.env.LINEAR_API_KEY,secret);
 assert.ok(!JSON.stringify(r.argv).includes(secret));
 assert.equal(JSON.parse(fs.readFileSync(path.join(b,'manifest.json'),'utf8')).nodes.main.connections.linear.env_var,'LINEAR_API_KEY');
 for(const file of files(b)) assert.ok(!fs.readFileSync(file,'utf8').includes(secret),file);
 process.env.LINEAR_API_KEY='ROTATED_SECRET_STAYS_IN_CHILD_ENV';
 assert.equal(f.build(),b);
 assert.equal(command(b,'main').env.LINEAR_API_KEY,process.env.LINEAR_API_KEY);
 verify(b);
});
test('bearer-by-env reaches Codex launch overrides and native child files as a variable name',t=>{
 const f=setup(t),secret='CODEX_BEARER_MUST_NOT_BE_PERSISTED';
 f.put('workspace.yaml',`connections:\n  linear:\n    type: mcp\n    url: https://linear.example/mcp\n    auth: bearer_env\n    env_var: LINEAR_API_KEY\n`);
 const b=f.build(),r=command(b,'main',{prepare:false,env:{LINEAR_API_KEY:secret}});
 const setting=r.argv.find(a=>a.startsWith('mcp_servers.orchestra_linear='));
 assert.match(setting,/"bearer_token_env_var" = "LINEAR_API_KEY"/);
 assert.equal(r.env.LINEAR_API_KEY,secret);
 assert.ok(!JSON.stringify(r.argv).includes(secret));
 const child=fs.readFileSync(path.join(b,'main/native-agents/child.toml'),'utf8');
 assert.match(child,/\[mcp_servers.orchestra_linear\]\nurl = "https:\/\/linear.example\/mcp"\nbearer_token_env_var = "LINEAR_API_KEY"/);
 for(const file of files(b)) assert.ok(!fs.readFileSync(file,'utf8').includes(secret),file);
 const parsed=spawnSync('codex',['-c',setting,'mcp','get','orchestra_linear','--json'],{encoding:'utf8',env:{...process.env,LINEAR_API_KEY:secret}});
 if(!parsed.error){assert.equal(parsed.status,0,parsed.stderr);assert.equal(JSON.parse(parsed.stdout).transport.bearer_token_env_var,'LINEAR_API_KEY');}
});
test('bearer-by-env rejects missing or invalid variable names and mixed authentication before writing bundles',t=>{
 const f=setup(t);
 for(const auth of [
  'auth: bearer_env',
  'auth: bearer_env\n    env_var: ""',
  'auth: bearer_env\n    env_var: 42',
  'auth: bearer_env\n    env_var: [LINEAR_API_KEY]',
  'auth: bearer_env\n    env_var: BAD-NAME',
  'auth: bearer_env\n    env_var: 1TOKEN',
  'auth: bearer_env\n    env_var: "${LINEAR_API_KEY}"',
  'auth: native\n    env_var: LINEAR_API_KEY',
  'auth: none\n    env_var: LINEAR_API_KEY',
 ]){
  f.put('workspace.yaml','connections:\n  linear:\n    type: mcp\n    url: https://linear.example/mcp\n    '+auth+'\n');
  assert.throws(()=>f.build(),/env_var/);
 }
 assert.equal(fs.existsSync(path.join(f.root,'one/.agent-farm')),false);
});
test('malformed or mixed MCP transports fail before bundles are written',t=>{
 const f=setup(t);
 for(const connection of [
  'type: mcp\n    command: node\n    url: https://example.com/mcp\n    auth: native',
  'type: mcp\n    command: node\n    args: nope',
  'type: mcp\n    command: node\n    env: {PORT: 42}',
  'type: mcp\n    command: node\n    env_vars: [BAD-NAME]',
  'type: mcp\n    command: node\n    env_vars: [TOKEN, TOKEN]',
  'type: mcp\n    command: node\n    env: {TOKEN: value}\n    env_vars: [TOKEN]',
  'type: mcp\n    args: []',
 ]) {
  f.put('workspace.yaml','connections:\n  service:\n    '+connection+'\n');
  assert.throws(()=>resolve(f.root,'parent',resolveWorkspace(f.root,{directory:f.root})));
 }
 assert.equal(fs.existsSync(path.join(f.root,'one/.agent-farm')),false);
});
test('generated Codex homes share existing native credential files across destinations',t=>{
 const f=setup(t),home=path.join(f.root,'home'),native=path.join(home,'.codex');fs.mkdirSync(native,{recursive:true});
 fs.writeFileSync(path.join(native,'.credentials.json'),'{}');fs.writeFileSync(path.join(native,'auth.json'),'{}');
 const a=codexHome(f.build(),'main',{CODEX_HOME:native},home),b=codexHome(f.build('two'),'main',{CODEX_HOME:native},home);
 assert.notEqual(a,b);
 for(const name of ['auth.json','.credentials.json'])assert.equal(fileIdentity(path.join(a,name)),fileIdentity(path.join(b,name)));
});

test('native login uses launch-identical identities and restores the original Codex home',async t=>{
 const {loginCommand}=await import('../dist/mcp-auth.js');
 const f=setup(t),home=path.join(f.root,'home');
 const env={CODEX_HOME:'/generated-home',AGENT_FARM_NATIVE_CODEX_HOME:'/native-home'};
 const codex=loginCommand(f.root,f.root,'remote','codex',{home,env});
 assert.equal(codex.env.CODEX_HOME,'/native-home');
 assert.deepEqual(codex.argv.slice(-3),['mcp','login','orchestra_remote']);
 const claude=loginCommand(f.root,f.root,'remote','claude',{home,env});
 assert.deepEqual(claude.argv.slice(-3),['mcp','login','orchestra_remote']);
 const authConfig=JSON.parse(fs.readFileSync(path.join(claude.cwd,'.mcp.json')));
 f.build();
 f.put('agents/parent.yaml','harness: claude\nmodel: test\n');
 const launchConfig=JSON.parse(fs.readFileSync(path.join(f.build(),'main/mcp.json')));
 assert.deepEqual(authConfig.mcpServers.orchestra_remote,launchConfig.mcpServers.orchestra_remote);
 assert.deepEqual(Object.keys(authConfig.mcpServers),['orchestra_remote']);
 assert.throws(()=>loginCommand(f.root,f.root,'service','codex',{home,env}),/local servers use their own login/);
 assert.throws(()=>loginCommand(f.root,f.root,'missing','claude',{home,env}),/Unknown/);
});

test('connection descriptions follow resolved connections into parent, native, and process instructions',t=>{
 const f=setup(t);
 f.put('workspace.yaml',`instructions: Global workspace guidance.\nconnections:\n  remote:\n    type: mcp\n    url: https://example.com/mcp\n    auth: native\n    description: Read the workspace project.\n`);
 f.put('agents/child.yaml',`harness: codex\nmodel: test\nconnections:\n  child_only:\n    type: mcp\n    command: example-server\n    description: Child-specific tool guidance.\n`);
 const b=f.build(),nodes=resolve(f.root,'parent',resolveWorkspace(f.root,{directory:f.root}));
 assert.match(nodes.main.instructions,/Global workspace guidance/);
 assert.match(nodes.main.instructions,/remote \(orchestra_remote\)\nRead the workspace project/);
 assert.doesNotMatch(nodes.main.instructions,/Child-specific/);
 const child=nodes['main/children/child'];
 assert.match(child.instructions,/Child-specific tool guidance/);
 assert.equal(child.instructions.split('Read the workspace project').length-1,1);
 const native=fs.readFileSync(path.join(b,'main/native-agents/child.toml'),'utf8');
 assert.match(native,/Child-specific tool guidance/);
 const launch=command(b,'main',{prepare:false});
 assert.ok(launch.argv.some(v=>v.startsWith('developer_instructions=') && v.includes('Read the workspace project')));
 const transport=launch.argv.find(v=>v.startsWith('mcp_servers.orchestra_remote='));
 assert.ok(!transport.includes('description'));
 f.put('agents/parent.yaml','harness: claude\nmodel: test\nsubagents:\n  child:\n    agent: child\n    mode: process\n');
 const c=f.build();
 assert.match(fs.readFileSync(path.join(c,'main/children/child/instructions.md'),'utf8'),/Child-specific tool guidance/);
 const mcp=JSON.parse(fs.readFileSync(path.join(c,'main/mcp.json')));
 assert.equal(mcp.mcpServers.orchestra_remote.description,undefined);
 assert.ok(command(c,'main',{prepare:false}).argv.some(v=>v.includes('# Workspace tools')));
});
test('Claude native children receive connection descriptions and invalid descriptions fail',t=>{
 const f=setup(t);
 f.put('agents/parent.yaml','harness: claude\nmodel: test\nsubagents:\n  child:\n    agent: child\n    mode: native\n');
 f.put('agents/child.yaml','harness: claude\nmodel: test\n');
 f.put('workspace.yaml','connections:\n  local:\n    type: mcp\n    command: test-server\n    description: Use this project.\n');
 const b=f.build();
 const child=JSON.parse(fs.readFileSync(path.join(b,'main/native-agents/child.json')));
 assert.match(child.prompt,/Use this project/);
 for(const value of ['42','[bad]','{bad: value}']){
  f.put('workspace.yaml',`connections:\n  local:\n    type: mcp\n    command: test-server\n    description: ${value}\n`);
  assert.throws(()=>f.build(),/description must be text/);
 }
 f.put('workspace.yaml','connections:\n  local:\n    type: mcp\n    command: test-server\n    description: "   "\n');
 assert.doesNotMatch(resolve(f.root,'parent',resolveWorkspace(f.root,{directory:f.root})).main.instructions,/# Workspace tools/);
});
