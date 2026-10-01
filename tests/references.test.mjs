import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {build} from '../dist/compiler.js';
import {command,verify} from '../dist/runtime.js';
import {installPlugin,validatePlugin} from '../dist/plugins.js';
import {inspectProfile} from '../dist/inspect.js';

function fixture(t) {
 const base=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-refs-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),target=path.join(base,'repo');fs.mkdirSync(target);
 const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
 put('skills/proof/SKILL.md','---\nname: proof\ndescription: Test\n---\nRead `.references/zones.md`.\n');
 put('references/shared/zones.md','ZONES');put('references/shared/rubrics/backend.md','RUBRIC');
 put('agents/lead.yaml','harness: claude\nmodel: sonnet\nskills: [proof]\nreferences: shared\nsubagents:\n  helper: {agent: helper, mode: native}\n  worker: {agent: worker, mode: process}\n  plain: {agent: plain, mode: process}\n');
 put('agents/helper.yaml','harness: claude\nmodel: sonnet\nreferences: shared\n');
 put('agents/worker.yaml','harness: codex\nmodel: gpt-6-astra\nskills: [proof]\nreferences: shared\n');
 put('agents/plain.yaml','harness: codex\nmodel: gpt-6-astra\n');
 return {base,root,target,put,build:()=>build(root,'lead',target)};
}
const note=dir=>`Bundled references: ${dir}.`;

test('selected references are bundled per agent and named in every launch',t=>{
 const f=fixture(t),b=f.build();verify(b);
 for(const route of ['main','main/children/helper','main/children/worker']){
  assert.equal(fs.readFileSync(path.join(b,route,'references/zones.md'),'utf8'),'ZONES');
  assert.equal(fs.readFileSync(path.join(b,route,'references/rubrics/backend.md'),'utf8'),'RUBRIC');
 }
 assert.ok(!fs.existsSync(path.join(b,'main/children/plain/references')));
 const claude=command(b,'main',{prepare:false});
 const system=claude.argv[claude.argv.indexOf('--append-system-prompt')+1];
 assert.ok(system.includes(note(path.join(b,'main/references'))));
 assert.ok(system.includes('`.references/<path>`'));
 const roles=JSON.parse(claude.argv[claude.argv.indexOf('--agents')+1]);
 assert.ok(roles.helper.prompt.includes(note(path.join(b,'main/children/helper/references'))));
 const codex=command(b,'main/children/worker',{prepare:false});
 assert.ok(codex.argv.find(a=>a.startsWith('developer_instructions=')).includes(note(path.join(b,'main/children/worker/references'))));
 const plain=command(b,'main/children/plain',{prepare:false});
 assert.ok(!plain.argv.some(a=>a.includes('Bundled references')));
});

test('reference edits produce a new bundle and tampering fails integrity',t=>{
 const f=fixture(t),b=f.build();f.put('references/shared/zones.md','CHANGED');
 const next=f.build();assert.notEqual(next,b);
 assert.equal(fs.readFileSync(path.join(next,'main/references/zones.md'),'utf8'),'CHANGED');
 fs.writeFileSync(path.join(next,'main/references/zones.md'),'tampered');assert.throws(()=>verify(next),/integrity/);
});

test('references must name one existing, nonempty folder',t=>{
 const f=fixture(t);
 f.put('agents/plain.yaml','harness: codex\nmodel: gpt-6-astra\nreferences: missing\n');assert.throws(()=>f.build(),/Missing references missing/);
 f.put('agents/plain.yaml','harness: codex\nmodel: gpt-6-astra\nreferences: [shared]\n');assert.throws(()=>f.build(),/references must be one/);
 fs.mkdirSync(path.join(f.root,'references/empty'));
 f.put('agents/plain.yaml','harness: codex\nmodel: gpt-6-astra\nreferences: empty\n');assert.throws(()=>f.build(),/Empty references empty/);
});

test('plugins package, install, and inspect their references',t=>{
 const f=fixture(t),source=path.join(f.base,'plugin');
 const put=(p,s)=>{const file=path.join(source,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,s);};
 put('plugin.yaml','name: refs\nversion: 1.0.0\ncli_major: 0\n');put('profiles/lead.yaml','agent: lead\n');
 put('agents/lead.md','---\nharness: codex\nmodel: gpt-6-astra\nreferences: shared\n---\nLead.\n');put('references/shared/zones.md','PLUGIN ZONES');
 assert.ok(Object.keys(validatePlugin(source).checksums).includes('references/shared/zones.md'));
 const host=path.join(f.base,'host');installPlugin(source,host);
 assert.equal(fs.readFileSync(path.join(host,'plugins/refs/references/shared/zones.md'),'utf8'),'PLUGIN ZONES');
 const b=build(host,'refs/lead',f.target);
 assert.equal(fs.readFileSync(path.join(b,'main/references/zones.md'),'utf8'),'PLUGIN ZONES');
 const report=inspectProfile(host,'refs/lead',{directory:f.target});
 assert.equal(report.agents.main.references.name,'shared');assert.equal(report.agents.main.references.plugin,'refs');
});

test('cross-plugin references reach native Codex children and are recorded as dependencies',t=>{
 const f=fixture(t),host=path.join(f.base,'host');
 const plugin=(name,entries)=>{const source=path.join(f.base,name);for(const [p,text] of Object.entries({'plugin.yaml':`name: ${name}\nversion: 1.0.0\ncli_major: 0\n`,...entries})){const file=path.join(source,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}installPlugin(source,host);};
 plugin('lib',{'references/orch/zones.md':'LIB ZONES','profiles/unused.yaml':'agent: unused\n','agents/unused.md':'---\nharness: codex\nmodel: gpt-6-astra\n---\nUnused.\n'});
 plugin('app',{'profiles/lead.yaml':'agent: lead\n','agents/lead.md':'---\nharness: codex\nmodel: gpt-6-astra\nreferences: lib/orch\nsubagents:\n  helper: {agent: helper, mode: native}\n---\nLead.\n','agents/helper.md':'---\nharness: codex\nmodel: gpt-6-astra\nreferences: lib/orch\n---\nHelper.\n'});
 const b=build(host,'app/lead',f.target),m=JSON.parse(fs.readFileSync(path.join(b,'manifest.json'),'utf8'));
 assert.deepEqual(m.cross_plugin_dependencies,[{plugin:'lib',version:'1.0.0',references:['reference:lib/orch']}]);
 assert.equal(fs.readFileSync(path.join(b,'main/children/helper/references/zones.md'),'utf8'),'LIB ZONES');
 assert.ok(fs.readFileSync(path.join(b,'main/native-agents/helper.toml'),'utf8').includes(note(path.join(b,'main/children/helper/references'))));
});

test('launch-specific bundles carry references and name their own copy',t=>{
 const f=fixture(t),b=f.build(),dispatch=path.join(b,'main/dispatch/worker'),home=path.join(f.base,'home'),codex=path.join(home,'.codex');fs.mkdirSync(codex,{recursive:true});
 const result=spawnSync(process.execPath,[dispatch,'--model','gpt-6-astra-override','--print-launch'],{encoding:'utf8',env:{...process.env,HOME:home,USERPROFILE:home,CODEX_HOME:codex,AGENT_FARM_NATIVE_CODEX_HOME:codex,AGENT_FARM_TELEMETRY:'off',AGENT_FARM_CONFIG_ROOT:f.root}});
 assert.equal(result.status,0,result.stderr);
 const launch=JSON.parse(result.stdout);assert.notEqual(launch.bundle,b);
 assert.equal(fs.readFileSync(path.join(launch.bundle,'main/children/worker/references/zones.md'),'utf8'),'ZONES');
 assert.ok(launch.argv.find(a=>a.startsWith('developer_instructions=')).includes(note(path.join(launch.bundle,'main/children/worker/references'))));
});
