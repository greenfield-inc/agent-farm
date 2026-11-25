import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build,resolveProfile} from '../dist/compiler.js';
import {listProfiles,inspectProfile} from '../dist/inspect.js';
import {validatePlugin} from '../dist/plugins.js';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

function fixture(t) {
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-listed-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),target=path.join(base,'repo');fs.mkdirSync(target);
 const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
 put('agents/worker.md','---\nharness: claude\nmodel: claude-fable-5-1\n---\nWorker.\n');
 put('agents/worker-codex.md','---\nharness: codex\nmodel: gpt-6-astra\n---\nCodex worker.\n');
 put('profiles/shown.yaml','agent: worker\n');
 put('profiles/hidden.yaml','listed: false\nagent: worker\n');
 put('profiles/hidden-variants.yaml','listed: false\nvariants:\n  claude:\n    agent: worker\n  codex:\n    agent: worker-codex\ndefault: claude\n');
 put('profiles/explicit.yaml','listed: true\nagent: worker\n');
 const run=(...args)=>spawnSync(process.execPath,[cli,...args,'--config-root',root],{encoding:'utf8',env:{...process.env,HOME:base,AGENT_FARM_TELEMETRY:'off'}});
 return {base,root,target,put,run};
}

test('listed defaults to true and is reported as a boolean on every profile',t=>{
 const f=fixture(t);
 assert.equal(resolveProfile(f.root,'shown').listed,true);
 assert.equal(resolveProfile(f.root,'explicit').listed,true);
 assert.equal(resolveProfile(f.root,'hidden').listed,false);
 assert.equal(resolveProfile(f.root,'hidden-variants:codex').listed,false);
 const byName=Object.fromEntries(listProfiles(f.root).map(p=>[p.profile,p.listed]));
 assert.deepEqual(byName,{explicit:true,hidden:false,'hidden-variants':false,shown:true});
 assert.equal(inspectProfile(f.root,'hidden',{noWorkspace:true}).listed,false);
});

test('a listed: false profile resolves and builds exactly like the same profile without it',t=>{
 const f=fixture(t);
 const strip=r=>{const {listed,profile_file,profile,profile_name,...rest}=r;return rest;};
 const hidden=resolveProfile(f.root,'hidden'),shown=resolveProfile(f.root,'shown');
 assert.deepEqual(strip(hidden),strip(shown));
 const bundle=build(f.root,'hidden',f.target);
 assert.ok(fs.existsSync(path.join(bundle,'manifest.json')));
 const variant=resolveProfile(f.root,'hidden-variants:codex');
 assert.equal(variant.variant,'codex');assert.equal(variant.nodes.main.harness,'codex');
});

test('profiles list hides nothing and --json reports listed',t=>{
 const f=fixture(t);
 const text=f.run('profiles','list');
 assert.equal(text.status,0,text.stderr);
 for(const name of ['shown','hidden','hidden-variants','explicit'])assert.match(text.stdout,new RegExp(`^${name}\\b`,'m'));
 assert.match(text.stdout,/^hidden -> worker .*\| unlisted$/m);
 assert.doesNotMatch(text.stdout,/^shown .*unlisted/m);
 const json=f.run('profiles','list','--json');
 assert.equal(json.status,0,json.stderr);
 const entries=JSON.parse(json.stdout);
 assert.equal(entries.length,4);
 assert.equal(entries.find(p=>p.profile==='hidden').listed,false);
 assert.equal(entries.find(p=>p.profile==='shown').listed,true);
 const misuse=f.run('inspect','hidden','--json');
 assert.notEqual(misuse.status,0);assert.match(misuse.stderr,/--json is only supported by profiles list/);
});

test('listed must be a boolean and only sits at the top of a profile',t=>{
 const f=fixture(t);
 f.put('plugin.yaml','name: fixture\nversion: 1.0.0\ncli_major: 0\n');
 assert.equal(validatePlugin(f.root).profiles.find(p=>p.profile==='hidden').listed,false);
 for(const bad of ['"no"','"false"','0','null','[false]']){
  f.put('profiles/hidden.yaml',`listed: ${bad}\nagent: worker\n`);
  assert.throws(()=>validatePlugin(f.root),/Profile fixture\/hidden listed must be true or false/,bad);
 }
 f.put('profiles/hidden.yaml','agent: worker\n');
 f.put('profiles/hidden-variants.yaml','variants:\n  claude:\n    agent: worker\n    listed: false\ndefault: claude\n');
 assert.throws(()=>validatePlugin(f.root),/Profile fixture\/hidden-variants sets listed inside variant claude; put listed at the top of the file/);
 f.put('profiles/hidden-variants.yaml','listed: false\nvariants:\n  claude:\n    agent: worker\ndefault: claude\n');
 const cliResult=spawnSync(process.execPath,[cli,'plugin','validate',f.root,'--config-root',path.join(f.base,'empty')],{encoding:'utf8',env:{...process.env,HOME:f.base,AGENT_FARM_TELEMETRY:'off'}});
 assert.equal(cliResult.status,0,cliResult.stderr);
 f.put('profiles/hidden.yaml','listed: yes\nagent: worker\n');
 const rejected=spawnSync(process.execPath,[cli,'plugin','validate',f.root,'--config-root',path.join(f.base,'empty')],{encoding:'utf8',env:{...process.env,HOME:f.base,AGENT_FARM_TELEMETRY:'off'}});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/listed must be true or false/);
});

test('bundled plugins hide the profiles their orchestrators start by name',()=>{
 const plugins=fileURLToPath(new URL('../plugins/',import.meta.url));
 const hidden=name=>validatePlugin(path.join(plugins,name)).profiles.filter(p=>!p.listed).map(p=>p.profile).sort();
 assert.deepEqual(hidden('greenfield'),['bug-reporter','implementer','qa-and-fix','reviewer','seo','seo-investigator','seo-measurer','seo-reviewer','seo-strategist','seo-writer','simplify-and-refactor']);
 assert.deepEqual(validatePlugin(path.join(plugins,'bigbrain')).profiles.filter(p=>p.listed).map(p=>p.profile),['orchestrator']);
 assert.deepEqual(hidden('dcouple'),[]);
});
