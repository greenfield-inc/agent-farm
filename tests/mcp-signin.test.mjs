import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from '../dist/compiler.js';
import {command,acpLaunch} from '../dist/runtime.js';
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
 assert.equal(r.stderr.trim(),`agent-farm: remote is not signed in for codex, so this session starts without it; sign in with: agent-farm mcp login remote --directory ${f.project}`);
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
