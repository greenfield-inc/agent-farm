import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from '../dist/compiler.js';
import {command,acpLaunch,loginHint,shellArgument} from '../dist/runtime.js';
import {loginPlan} from '../dist/mcp-auth.js';
import {writeHarness} from './harness.mjs';

const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const workspace='connections:\n  remote:\n    type: mcp\n    url: https://mcp.example.invalid/mcp\n    auth: native\n  signed:\n    type: mcp\n    url: https://signed.example/mcp\n    auth: native\n  local:\n    type: mcp\n    command: node\n';
/** A temp HOME holding the default config root, a project directory, and a bin folder for fake harnesses. */
function setup(t,harness='codex'){
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-signin-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const home=path.join(base,'home'),root=path.join(home,'.config/agent-farm'),project=path.join(base,'project'),bin=path.join(base,'bin');
 for(const d of [path.join(root,'agents'),project,bin,path.join(home,'.codex')])fs.mkdirSync(d,{recursive:true});
 fs.writeFileSync(path.join(root,'agents/main.yaml'),`harness: ${harness}\nmodel: test\n`);
 fs.writeFileSync(path.join(root,'workspace.yaml'),workspace);
 const env={...process.env,HOME:home,USERPROFILE:home,CODEX_HOME:path.join(home,'.codex'),AGENT_FARM_TELEMETRY:'off',PATH:bin};
 for(const key of ['AGENT_FARM_NATIVE_CODEX_HOME','ORCHESTRA_NATIVE_CODEX_HOME','AGENT_FARM_SIGNIN_CHECK','CLAUDE_CONFIG_DIR'])delete env[key];
 return {base,home,root,project,bin,env};
}
/** A fake Codex whose `mcp list --json` reports every -c server signed in unless it is named in FAKE_UNSIGNED. */
const fakeCodex=`const a=process.argv.slice(2);if(!a.includes('list'))process.exit(0);
const unsigned=(process.env.FAKE_UNSIGNED??'').split(',').filter(Boolean);
const names=a.filter((v,i)=>a[i-1]==='-c'&&v.startsWith('mcp_servers.')).map(v=>v.slice(12,v.indexOf('=')));
process.stdout.write(JSON.stringify(names.map(name=>({name,enabled:true,auth_status:unsigned.includes(name)?'not_logged_in':'o_auth'}))));`;
const stub=states=>(harness,connections)=>Object.fromEntries(Object.keys(connections).filter(k=>'url' in connections[k]&&connections[k].auth==='native').map(k=>[k,states[k]??'signed-in']));

test('J7: Codex launch leaves out a connection with no stored sign-in, tells the agent, and gives the login command',t=>{
 const f=setup(t),bundle=build(f.root,'main',f.project);
 const r=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns:stub({remote:'missing'})});
 const servers=r.argv.filter((a,i)=>r.argv[i-1]==='-c'&&a.startsWith('mcp_servers.'));
 assert.ok(!servers.some(s=>s.startsWith('mcp_servers.orchestra_remote')),servers.join('\n'));
 assert.ok(servers.some(s=>s.startsWith('mcp_servers.orchestra_signed=')));
 assert.ok(servers.some(s=>s.startsWith('mcp_servers.orchestra_local=')));
 const instructions=r.argv.find(a=>a.startsWith('developer_instructions='));
 assert.match(instructions,/Unavailable connections: remote \(orchestra_remote\)\. Codex holds no sign-in for it/);
 assert.deepEqual(r.unavailable,[{connection:'remote',harness:'codex',login:`agent-farm mcp login remote --directory ${f.project}`}]);
 writeHarness(f.bin,'codex','process.exit(0);\n');
 const acp=acpLaunch(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns:stub({remote:'missing'})});
 assert.deepEqual(Object.keys(JSON.parse(acp.env.CODEX_CONFIG).mcp_servers).sort(),['orchestra_local','orchestra_signed']);
});
test('J7: Claude launch passes only signed-in servers and notes the missing one',t=>{
 const f=setup(t,'claude'),bundle=build(f.root,'main',f.project);
 const r=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns:stub({remote:'missing'})});
 const config=JSON.parse(r.argv[r.argv.indexOf('--mcp-config')+1]);
 assert.deepEqual(Object.keys(config.mcpServers).sort(),['orchestra_local','orchestra_signed']);
 assert.match(r.argv[r.argv.indexOf('--append-system-prompt')+1],/Unavailable connections: remote \(orchestra_remote\)\. Claude holds no sign-in/);
});
test('the sign-in check fails open and never runs for an unprepared launch',t=>{
 const f=setup(t),bundle=build(f.root,'main',f.project);
 const kept=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns:stub({remote:'unknown'})});
 assert.ok(kept.argv.some(a=>a.startsWith('mcp_servers.orchestra_remote=')));assert.deepEqual(kept.unavailable,[]);
 assert.ok(!kept.argv.find(a=>a.startsWith('developer_instructions='))?.includes('Unavailable connections'));
 const explained=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,prepare:false,signIns:()=>{throw new Error('must not check');}});
 assert.ok(explained.argv.some(a=>a.startsWith('mcp_servers.orchestra_remote=')));
 // A harness that cannot answer (here: no codex on PATH) keeps every connection.
 const missingHarness=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home});
 assert.ok(missingHarness.argv.some(a=>a.startsWith('mcp_servers.orchestra_remote=')));
});
test('J7: --print-launch asks the native harness and prints the login command on stderr',t=>{
 const f=setup(t);writeHarness(f.bin,'codex',fakeCodex);
 const r=spawnSync(process.execPath,[cli,'run','main','--print-launch','--directory',f.project],{cwd:f.project,encoding:'utf8',env:{...f.env,FAKE_UNSIGNED:'orchestra_remote'}});
 assert.equal(r.status,0,r.stderr);
 const printed=JSON.parse(r.stdout);
 assert.ok(!printed.argv.some(a=>a.startsWith('mcp_servers.orchestra_remote')));
 assert.ok(printed.argv.some(a=>a.startsWith('mcp_servers.orchestra_signed=')));
 assert.equal(r.stderr.trim(),`agent-farm: remote is not signed in for codex, so this session starts without it; sign in with: agent-farm mcp login remote --directory ${f.project} (for a connection set in an agent definition rather than the workspace, use codex's own MCP login instead)`);
});
test('J8: doctor lists each missing sign-in with its login command, then none once signed in',t=>{
 const f=setup(t);writeHarness(f.bin,'codex',fakeCodex);
 fs.writeFileSync(path.join(f.home,'.codex/.credentials.json'),JSON.stringify({token:'TOKEN_VALUE_NEVER_PRINTED'}));
 const doctor=unsigned=>spawnSync(process.execPath,[cli,'doctor'],{cwd:f.project,encoding:'utf8',env:{...f.env,FAKE_UNSIGNED:unsigned}});
 const gap=doctor('orchestra_remote');
 assert.equal(gap.status,0,gap.stderr);
 assert.match(gap.stdout,new RegExp(`remote: not signed in for codex\\. Run: .*agent-farm mcp login remote --directory ${f.project.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`));
 assert.match(gap.stdout,/signed: signed in/);
 assert.doesNotMatch(gap.stdout,/local/);
 const none=doctor('');
 assert.match(none.stdout,/No missing sign-ins/);assert.doesNotMatch(none.stdout,/not signed in/);
 for(const out of [gap,none])assert.doesNotMatch(out.stdout+out.stderr,/TOKEN_VALUE_NEVER_PRINTED/);
});
test('mcp login without --harness signs in only where a harness holds no sign-in',t=>{
 const f=setup(t);writeHarness(f.bin,'codex','process.exit(0);\n');writeHarness(f.bin,'claude','process.exit(0);\n');
 const plan=loginPlan(f.root,f.project,'remote',{home:f.home,env:f.env,check:harness=>({remote:harness==='codex'?'missing':'signed-in'})});
 assert.deepEqual(plan.map(p=>[p.harness,p.state,!!p.login]),[['claude','signed-in',false],['codex','missing',true]]);
 assert.deepEqual(plan[1].login.argv.slice(-3),['mcp','login','orchestra_remote']);
 assert.equal(plan[1].login.env.CODEX_HOME,path.join(f.home,'.codex'));
 writeHarness(f.bin,'claude','process.exit(0);\n');fs.rmSync(path.join(f.bin,process.platform==='win32'?'codex.cmd':'codex'));
 assert.deepEqual(loginPlan(f.root,f.project,'remote',{home:f.home,env:f.env,check:()=>({remote:'unknown'})}).map(p=>[p.harness,!!p.login]),[['claude',true]]);
 assert.throws(()=>loginPlan(f.root,f.project,'local',{home:f.home,env:f.env}),/local servers use their own login/);
});

test('the login hint passes each path as one literal shell argument, so pasting it runs nothing',{skip:process.platform==='win32'},()=>{
 const home=path.join(os.tmpdir(),'hint-home');
 for(const directory of ['/srv/repo','/tmp/a b','/tmp/repo-$(printf INJECTED)','/tmp/`id`',"/tmp/it's","/tmp/x'$(id)'y",'/tmp/semi;colon&&$HOME']){
  const hint=loginHint('linear',directory,'/tmp/root $(id)',home);
  // Ask a real shell how it splits the printed command: the path must come back byte for byte.
  const echoed=spawnSync('/bin/sh',['-c',`set -- ${hint.slice('agent-farm '.length)}; printf '%s\\n' "$@"`],{encoding:'utf8'});
  assert.deepEqual(echoed.stdout.split('\n').slice(0,-1),['mcp','login','linear','--directory',directory,'--config-root','/tmp/root $(id)'],hint);
 }
 assert.equal(loginHint('linear','/srv/repo',undefined,home),'agent-farm mcp login linear --directory /srv/repo');
});
test('on Windows the login hint double-quotes a plain path and shows a placeholder for one cmd or PowerShell would expand',()=>{
 assert.equal(shellArgument('C:\\Users\\me\\repo','<p>','win32'),'C:\\Users\\me\\repo');
 assert.equal(shellArgument('C:\\Users\\me\\my repo','<p>','win32'),'"C:\\Users\\me\\my repo"');
 for(const text of ['C:\\repo-$(calc)','C:\\%PATH%','C:\\a`b','C:\\a"b','C:\\a!b'])assert.equal(shellArgument(text,'<this repository>','win32'),'<this repository>');
});
test('J7: an omitted connection still turns off the project bridge it replaces',t=>{
 const f=setup(t);
 fs.mkdirSync(path.join(f.project,'.codex'));
 fs.writeFileSync(path.join(f.project,'.codex/config.toml'),'[mcp_servers.remote_bridge]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "https://mcp.example.invalid/mcp"]\n');
 const bundle=build(f.root,'main',f.project),signIns=stub({remote:'missing'});
 const r=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns});
 assert.ok(r.argv.includes('mcp_servers.remote_bridge.enabled=false'),r.argv.join('\n'));
 assert.ok(!r.argv.some(a=>a.startsWith('mcp_servers.orchestra_remote')));
 writeHarness(f.bin,'codex','process.exit(0);\n');
 const servers=JSON.parse(acpLaunch(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns}).env.CODEX_CONFIG).mcp_servers;
 assert.equal(servers.remote_bridge?.enabled,false);assert.equal(servers.orchestra_remote,undefined);
});
test('J7: a native Codex child gets this launch\'s config without the left-out connections, child-only ones included, and the bundle stays as built',t=>{
 const f=setup(t);
 fs.writeFileSync(path.join(f.root,'agents/main.yaml'),'harness: codex\nmodel: test\nsubagents:\n  helper: {agent: helper, mode: native}\n');
 fs.writeFileSync(path.join(f.root,'agents/helper.yaml'),'harness: codex\nmodel: test\ninstructions: Help.\nconnections:\n  child_only:\n    type: mcp\n    url: https://child.example.invalid/mcp\n    auth: native\n');
 const bundle=build(f.root,'main',f.project),built=path.join(bundle,'main/native-agents/helper.toml'),before=fs.readFileSync(built,'utf8');
 const asked=[];
 const signIns=(harness,connections,...rest)=>{asked.push(...Object.keys(connections));return stub({remote:'missing',child_only:'missing'})(harness,connections,...rest);};
 const r=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns});
 assert.ok(asked.includes('child_only'),'child-only connections are checked');
 const file=JSON.parse(r.argv.find(a=>a.startsWith('agents.helper.config_file=')).slice('agents.helper.config_file='.length));
 assert.ok(file.startsWith(path.join(f.home,'.cache/agent-farm/native-children')),file);
 const child=fs.readFileSync(file,'utf8');
 assert.ok(!child.includes('[mcp_servers.orchestra_remote]')&&!child.includes('[mcp_servers.orchestra_child_only]'),child);
 assert.ok(child.includes('[mcp_servers.orchestra_signed]'));
 assert.match(child,/Unavailable connections: remote \(orchestra_remote\), child_only \(orchestra_child_only\)\. Codex holds no sign-in for them/);
 assert.equal(fs.readFileSync(built,'utf8'),before);
 // The parent's note names only its own connections; the person hears about both.
 assert.match(r.argv.find(a=>a.startsWith('developer_instructions=')),/Unavailable connections: remote \(orchestra_remote\)\. Codex/);
 assert.deepEqual(r.unavailable.map(u=>u.connection).sort(),['child_only','remote']);
 writeHarness(f.bin,'codex','process.exit(0);\n');
 assert.equal(JSON.parse(acpLaunch(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns}).env.CODEX_CONFIG).agents.helper.config_file,file);
 // With every sign-in in place, the child uses the bundle's own file.
 const signed=command(bundle,'main',{configRoot:f.root,env:f.env,home:f.home,signIns:stub({})});
 assert.ok(signed.argv.includes(`agents.helper.config_file=${JSON.stringify(built)}`));
});
