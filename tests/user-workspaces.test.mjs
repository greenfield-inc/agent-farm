import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {parse} from 'smol-toml';
import {loadWorkspace,unloadWorkspace,loadedWorkspaces} from '../dist/user-workspaces.js';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
function fixture(t,harness){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-global-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const root=path.join(home,'source');fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'workspace.yaml'),`name: test\ninstructions: Keep workspace context.\nconnections:\n  proof:\n    type: mcp\n    url: https://example.com/mcp\n    auth: native\n    description: Use the selected project.\n  local:\n    type: mcp\n    command: example-server\n    env_vars: [MY_SECRET]\n`);
 const nativeHome=path.join(home,harness==='codex'?'.codex':'.claude');fs.mkdirSync(nativeHome);
 const config=harness==='codex'?path.join(nativeHome,'config.toml'):path.join(home,'.claude.json');
 const instructions=path.join(nativeHome,harness==='codex'?'AGENTS.md':'CLAUDE.md');
 const original=harness==='codex'?'# keep my comment\nmodel = "test"\n[mcp_servers.unrelated]\nurl = "https://other.example/mcp"\n':JSON.stringify({theme:'dark',mcpServers:{unrelated:{type:'http',url:'https://other.example/mcp'}}});
 fs.writeFileSync(config,original);fs.writeFileSync(instructions,'Existing user instructions.\n');
 return {home,root,config,instructions,original,options:{home,harness,env:{MY_SECRET:'DO_NOT_PERSIST'}}};
}
for(const harness of ['claude','codex']){
 test(`${harness} global workspace loads idempotently and unloads only owned config/context`,t=>{
  const f=fixture(t,harness);const a=loadWorkspace(f.root,f.root,f.options);
  const installed=fs.readFileSync(f.config,'utf8');
  assert.ok(!installed.includes('DO_NOT_PERSIST'));
  assert.match(fs.readFileSync(f.instructions,'utf8'),/Use the selected project/);
  assert.deepEqual(loadWorkspace(f.root,f.root,f.options),a);
  if(harness==='codex')assert.equal(parse(installed).mcp_servers.orchestra_local.command,'example-server');
  else assert.equal(JSON.parse(installed).mcpServers.orchestra_local.env.MY_SECRET,'${MY_SECRET}');
  fs.appendFileSync(f.instructions,'\nUser added another instruction.\n');
  if(harness==='codex')fs.appendFileSync(f.config,'\n[features]\nunrelated = true\n');
  else {const d=JSON.parse(installed);d.newSetting=true;fs.writeFileSync(f.config,JSON.stringify(d));}
  // Unload uses the receipt even after the source is gone.
  fs.rmSync(f.root,{recursive:true});unloadWorkspace(f.root,f.options);
  assert.equal(loadedWorkspaces(f.options).length,0);
  assert.equal(fs.readFileSync(f.instructions,'utf8'),'Existing user instructions.\n\nUser added another instruction.\n');
  const final=fs.readFileSync(f.config,'utf8');
  if(harness==='codex')assert.equal(final,f.original+'\n[features]\nunrelated = true\n');
  else {const d=JSON.parse(final);assert.equal(d.theme,'dark');assert.equal(d.newSetting,true);assert.deepEqual(Object.keys(d.mcpServers),['unrelated']);}
 });
 test(`${harness} existing MCP collisions are refused without changes`,t=>{
  const f=fixture(t,harness);
  const existing=harness==='codex'?f.original+'\n[mcp_servers.orchestra_proof]\nurl = "https://example.com/mcp"\n':JSON.stringify({mcpServers:{orchestra_proof:{type:'http',url:'https://example.com/mcp'}}});
  fs.writeFileSync(f.config,existing);
  assert.throws(()=>loadWorkspace(f.root,f.root,f.options),/will not be overwritten or adopted/);
  assert.equal(fs.readFileSync(f.config,'utf8'),existing);
  assert.equal(fs.readFileSync(f.instructions,'utf8'),'Existing user instructions.\n');
 });
 test(`${harness} unload preserves edited connections and instructions`,t=>{
  const f=fixture(t,harness);loadWorkspace(f.root,f.root,f.options);
  const before=fs.readFileSync(f.config,'utf8');const edited=before.replace('https://example.com/mcp','https://edited.example/mcp');fs.writeFileSync(f.config,edited);
  assert.throws(()=>unloadWorkspace(f.root,f.options),/Managed connection changed/);
  assert.equal(fs.readFileSync(f.config,'utf8'),edited);
  fs.writeFileSync(f.config,before);fs.appendFileSync(f.instructions,'unrelated');
  fs.writeFileSync(f.instructions,fs.readFileSync(f.instructions,'utf8').replace('Use the selected project.','Edited guidance.'));
  assert.throws(()=>unloadWorkspace(f.root,f.options),/instructions changed/);
  assert.equal(loadedWorkspaces(f.options).length,1);
 });
}
test('global workspace enforces one selection per harness and rolls back on receipt failure',t=>{
 const f=fixture(t,'codex');const originalRename=fs.renameSync;
 fs.renameSync=(from,to)=>{if(to.endsWith(path.join('user-workspaces','state.json')))throw Error('simulated storage failure');return originalRename(from,to);};
 try{assert.throws(()=>loadWorkspace(f.root,f.root,f.options),/simulated/);}finally{fs.renameSync=originalRename;}
 assert.equal(fs.readFileSync(f.config,'utf8'),f.original);
 assert.equal(fs.readFileSync(f.instructions,'utf8'),'Existing user instructions.\n');
 loadWorkspace(f.root,f.root,f.options);
 fs.writeFileSync(path.join(f.root,'workspace.yaml'),'name: other\nconnections: {}\n');
 assert.throws(()=>loadWorkspace(f.root,f.root,f.options),/Unload the current/);
});
test('native config overrides and user instruction override file are respected',t=>{
 const f=fixture(t,'codex'),native=path.join(f.home,'.codex');
 fs.writeFileSync(path.join(native,'AGENTS.override.md'),'Override instructions.');
 const item=loadWorkspace(f.root,f.root,{...f.options,env:{CODEX_HOME:'/generated',AGENT_FARM_NATIVE_CODEX_HOME:native}});
 assert.equal(item.config,f.config);assert.equal(item.instructions,path.join(native,'AGENTS.override.md'));
 assert.equal(fs.readFileSync(f.instructions,'utf8'),'Existing user instructions.\n');
});
test('global workspace CLI load/list/unload operates on isolated user files',t=>{
 const f=fixture(t,'claude');
 const env={...process.env,HOME:f.home,USERPROFILE:f.home,CLAUDE_CONFIG_DIR:path.join(f.home,'.claude'),CODEX_HOME:path.join(f.home,'.codex')};
 delete env.AGENT_FARM_NATIVE_CODEX_HOME;delete env.ORCHESTRA_NATIVE_CODEX_HOME;
 const run=args=>spawnSync(process.execPath,[cli,...args],{env,encoding:'utf8'});
 let result=run(['workspace','load','--directory',f.root,'--harness','claude','--config-root',f.root]);assert.equal(result.status,0,result.stderr);
 assert.ok(fs.existsSync(path.join(f.home,'.claude/.claude.json')));
 result=run(['workspace','loaded']);assert.match(result.stdout,/test \(claude\)/);
 result=run(['workspace','unload','--directory',f.root,'--harness','claude']);assert.equal(result.status,0,result.stderr);
});
test('symlink native configuration is refused without replacing it',t=>{
 const f=fixture(t,'codex'),other=path.join(f.home,'other-config');fs.renameSync(f.config,other);fs.symlinkSync(other,f.config);
 assert.throws(()=>loadWorkspace(f.root,f.root,f.options),/symlink/);
 assert.equal(fs.readFileSync(other,'utf8'),f.original);
});
