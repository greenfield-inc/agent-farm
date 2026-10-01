import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build,resolveProfile} from '../dist/compiler.js';
import {listProfiles,inspectProfile} from '../dist/inspect.js';
import {validatePlugin,installPlugin} from '../dist/plugins.js';
import {ProfileManager} from '../dist/profile-manager.js';
import {loadProfile,loadedProfiles,unloadProfile} from '../dist/user-skills.js';
import {chooseVariant} from '../dist/interactive.js';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

function fixture(t) {
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-variants-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),target=path.join(base,'repo');fs.mkdirSync(target);
 const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
 put('agents/planner-claude.md','---\nharness: claude\nmodel: claude-fable-5-1\n---\nClaude planner.\n');
 put('agents/planner-codex.md','---\nharness: codex\nmodel: gpt-6-astra\n---\nCodex planner.\n');
 put('profiles/planner.yaml','variants:\n  claude:\n    agent: planner-claude\n  codex:\n    agent: planner-codex\n    model: {reasoning: high}\ndefault: codex\n');
 put('profiles/plain.yaml','agent: planner-claude\n');
 return {base,root,target,put};
}

test('a profile resolves its default variant or the one named after a colon',t=>{
 const f=fixture(t);
 const byDefault=resolveProfile(f.root,'planner');
 assert.equal(byDefault.variant,'codex');assert.equal(byDefault.nodes.main.harness,'codex');assert.equal(byDefault.nodes.main.reasoning_effort,'high');
 assert.deepEqual(byDefault.variants,['claude','codex']);assert.equal(byDefault.default_variant,'codex');
 const named=resolveProfile(f.root,'planner:claude');
 assert.equal(named.variant,'claude');assert.equal(named.nodes.main.harness,'claude');assert.equal(named.profile,'planner');
 assert.equal(resolveProfile(f.root,'plain').variant,undefined);
});

test('variant mistakes fail with the accepted choices',t=>{
 const f=fixture(t);
 assert.throws(()=>resolveProfile(f.root,'planner:gemini'),/no variant gemini; choose one of: claude, codex/);
 assert.throws(()=>resolveProfile(f.root,'plain:codex'),/Profile plain has no variants/);
 assert.throws(()=>resolveProfile(f.root,'planner-claude:codex'),/is an agent, not a profile with variants/);
 f.put('profiles/planner.yaml','variants:\n  claude:\n    agent: planner-claude\ndefault: codex\n');
 assert.throws(()=>resolveProfile(f.root,'planner'),/default must name one of its variants: claude/);
 f.put('profiles/planner.yaml','agent: planner-claude\nvariants:\n  claude:\n    agent: planner-claude\ndefault: claude\n');
 assert.throws(()=>resolveProfile(f.root,'planner'),/Unsupported prototype fields: agent/);
});

test('each variant builds its own bundle and records its identity',t=>{
 const f=fixture(t);
 const codex=build(f.root,'planner',f.target),claude=build(f.root,'planner:claude',f.target);
 assert.notEqual(codex,claude);assert.match(path.basename(claude),/^planner--claude-/);
 const manifest=JSON.parse(fs.readFileSync(path.join(claude,'manifest.json'),'utf8'));
 assert.equal(manifest.profile,'planner');assert.equal(manifest.variant,'claude');assert.equal(manifest.trace_identity,'local/planner:claude@local');
 const report=inspectProfile(f.root,'planner:claude',{directory:f.target});
 assert.equal(report.trace_identity,'local/planner:claude@local');assert.equal(report.agents.main.harness,'claude');
});

test('listings show one entry per profile with its variants, default first',t=>{
 const f=fixture(t);
 const planner=listProfiles(f.root).find(p=>p.profile==='planner');
 assert.deepEqual(planner.variants,['claude','codex']);assert.equal(planner.default_variant,'codex');assert.equal(planner.harness,'codex');
 const result=spawnSync(process.execPath,[cli,'profiles','list','--config-root',f.root],{encoding:'utf8',env:{...process.env,AGENT_FARM_TELEMETRY:'off'}});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/^planner \(codex: gpt-6-astra high · claude: claude-fable-5-1\) -> planner-codex/m);
 assert.match(result.stdout,/^plain -> planner-claude/m);
});

test('plugin validation checks every variant, not only the default',t=>{
 const f=fixture(t);
 f.put('plugin.yaml','name: fixture\nversion: 1.0.0\ncli_major: 0\n');
 assert.deepEqual(validatePlugin(f.root).profiles.find(p=>p.profile==='planner').variants,['claude','codex']);
 f.put('profiles/planner.yaml','variants:\n  claude:\n    agent: missing-agent\n  codex:\n    agent: planner-codex\ndefault: codex\n');
 assert.throws(()=>validatePlugin(f.root),/missing agent/);
});

function withPlugin(t,f){
 const source=path.join(f.base,'plugin'),host=path.join(f.base,'host');
 const put=(p,text)=>{const file=path.join(source,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
 put('plugin.yaml','name: fixture\nversion: 1.0.0\ncli_major: 0\n');
 put('agents/planner-claude.md','---\nharness: claude\nmodel: claude-fable-5-1\n---\nPlugin Claude planner.\n');
 put('agents/planner-codex.md','---\nharness: codex\nmodel: gpt-6-astra\n---\nPlugin Codex planner.\n');
 put('profiles/planner.yaml','variants:\n  claude:\n    agent: planner-claude\n  codex:\n    agent: planner-codex\ndefault: claude\n');
 installPlugin(source,host);return host;
}

test('duplicating a plugin profile with variants qualifies every variant agent',t=>{
 const f=fixture(t),host=withPlugin(t,f),manager=new ProfileManager(host,f.target);
 const {source}=manager.duplicate('fixture/planner');
 assert.match(source,/agent: fixture\/planner-claude/);assert.match(source,/agent: fixture\/planner-codex/);
 const preview=manager.preview({name:'my-planner',source,revision:null});
 assert.equal(preview.resolved.harness,'claude');
 assert.throws(()=>manager.compose({source,agent:'x',model:'',reasoning:'',speed:'',args:'{}'}),/edit them in the YAML source/);
});

test('unload and loaded understand NAME:VARIANT',t=>{
 const f=fixture(t),home=path.join(f.base,'home');fs.mkdirSync(home);const options={home,env:{}};
 loadProfile(f.root,'planner:claude',options);
 assert.deepEqual(loadedProfiles(options).map(p=>[p.profile,p.variant]),[['planner','claude']]);
 assert.equal(unloadProfile('planner:claude',options).length,1);
 assert.deepEqual(loadedProfiles(options),[]);
});

test('default_plugin picks the plugin for a bare NAME:VARIANT',t=>{
 const f=fixture(t),host=withPlugin(t,f);
 fs.cpSync(path.join(f.root,'agents'),path.join(host,'agents'),{recursive:true});fs.cpSync(path.join(f.root,'profiles'),path.join(host,'profiles'),{recursive:true});
 assert.throws(()=>resolveProfile(host,'planner:codex'),/Ambiguous profile planner/);
 fs.writeFileSync(path.join(host,'settings.json'),'{"default_plugin":"fixture"}\n');
 const resolved=resolveProfile(host,'planner:codex');
 assert.equal(resolved.plugin,'fixture');assert.equal(resolved.variant,'codex');
 assert.throws(()=>resolveProfile(host,'planner:gemini'),/Profile fixture\/planner has no variant gemini/);
});

test('the variant question is skipped when a variant is named or there is only one',async t=>{
 const f=fixture(t);
 assert.equal(await chooseVariant(f.root,'planner:claude'),'planner:claude');
 assert.equal(await chooseVariant(f.root,'plain'),'plain');
});
