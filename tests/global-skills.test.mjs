import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {globalSkills,globalSkillWarning,saveGlobalSkills,loadProfile,unloadProfile} from '../dist/user-skills.js';
import {resolve} from '../dist/compiler.js';
import {writeHarness} from './harness.mjs';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
function fixture(t,harness='codex') {
 const home=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-save-')));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const root=path.join(home,'library'),native=path.join(home,harness==='codex'?'.codex':'.claude');
 fs.mkdirSync(root);const options={home,harness,env:{}};
 const put=(relative,text)=>{const file=path.join(home,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);return file;};
 return {home,root,native,options,put};
}
for(const harness of ['codex','claude'])test(`${harness}: save/unmount unmanaged skills and remount as owned profile`,t=>{
 const f=fixture(t,harness),prefix=harness==='codex'?'.codex':'.claude';
 f.put(`${prefix}/skills/research/SKILL.md`,'---\nname: research\ndescription: Research\n---\nResearch.');
 const script=f.put(`${prefix}/skills/research/scripts/run.sh`,'#!/bin/sh\nexit 0\n');fs.chmodSync(script,0o755);
 f.put(`${prefix}/skills/.system/builtin/SKILL.md`,'builtin');
 if(harness==='claude')f.put(`${prefix}/skills/synced/vendor/SKILL.md`,'account');
 assert.equal(globalSkills(f.options)[0].status,'unmanaged');assert.match(globalSkillWarning(f.options),/unset global --save/);
 const saved=saveGlobalSkills(f.root,'saved','test-model',f.options);
 assert.equal(saved.skills,1);assert.equal(globalSkills(f.options).length,0);
 assert.equal(fs.readFileSync(path.join(saved.backup,'0/SKILL.md'),'utf8').includes('Research.'),true);
 assert.equal(resolve(f.root,'saved').main.model,'test-model');
 if(process.platform!=='win32')assert.equal(fs.statSync(path.join(f.root,'skills/research/scripts/run.sh')).mode&0o777,0o755);
 loadProfile(f.root,'saved',f.options);assert.equal(globalSkills(f.options)[0].status,'managed');
 assert.match(globalSkillWarning(f.options),/unset global saved/);unloadProfile('saved',f.options);
 assert.equal(globalSkillWarning(f.options),undefined);
 assert.ok(fs.existsSync(path.join(f.native,'skills/.system/builtin/SKILL.md')));
});
test('shared Codex user root and external symlink skills are captured without moving targets',t=>{
 const f=fixture(t);f.put('external/SKILL.md','skill');f.put('external/references/a.md','reference');
 fs.mkdirSync(path.join(f.home,'.agents/skills'),{recursive:true});fs.symlinkSync(path.join(f.home,'external'),path.join(f.home,'.agents/skills/linked'));
 const saved=saveGlobalSkills(f.root,'saved','test',f.options);
 assert.ok(fs.lstatSync(path.join(saved.backup,'0')).isSymbolicLink());assert.ok(fs.existsSync(path.join(f.home,'external/SKILL.md')));
 assert.equal(fs.readFileSync(path.join(f.root,'skills/linked/references/a.md'),'utf8'),'reference');
 assert.ok(!fs.lstatSync(path.join(f.root,'skills/linked')).isSymbolicLink());
});
test('changed managed links remain classified as changed and cannot be adopted by saving',t=>{
 const f=fixture(t);f.put('.codex/skills/one/SKILL.md','original');saveGlobalSkills(f.root,'saved','test',f.options);loadProfile(f.root,'saved',f.options);
 fs.unlinkSync(path.join(f.native,'skills/one'));f.put('.codex/skills/one/SKILL.md','replacement');
 assert.equal(globalSkills(f.options)[0].status,'changed');assert.throws(()=>saveGlobalSkills(f.root,'other','test',f.options),/No unmanaged/);
 assert.throws(()=>unloadProfile('saved',f.options),/preserving/);
});
test('collisions, duplicate names, and invalid models preserve pre-existing files',t=>{
 const f=fixture(t);f.put('.codex/skills/one/SKILL.md','original');f.put('.agents/skills/one/SKILL.md','second');
 assert.throws(()=>saveGlobalSkills(f.root,'saved','test',f.options),/Duplicate/);
 fs.rmSync(path.join(f.home,'.agents'),{recursive:true});f.put('library/skills/one/SKILL.md','existing');
 assert.throws(()=>saveGlobalSkills(f.root,'saved','test',f.options),/overwrite/);
 assert.throws(()=>saveGlobalSkills(f.root,'saved','',f.options),/--model/);
 assert.equal(fs.readFileSync(path.join(f.native,'skills/one/SKILL.md'),'utf8'),'original');
});
test('unmount failure rolls back moved originals and retains a validated saved profile',t=>{
 const f=fixture(t);f.put('.codex/skills/one/SKILL.md','one');f.put('.codex/skills/two/SKILL.md','two');
 const original=fs.renameSync;
 fs.renameSync=(from,to)=>{if(from===path.join(f.native,'skills/two'))throw Error('simulated move failure');return original(from,to);};
 try{assert.throws(()=>saveGlobalSkills(f.root,'saved','test',f.options),/saved profile retained/);}finally{fs.renameSync=original;}
 assert.equal(globalSkills(f.options).length,2);assert.deepEqual(resolve(f.root,'saved').main.skills,['one','two']);
});
test('CLI global syntax, scoped workspace aliases, and pre-launch warnings',t=>{
 const f=fixture(t);f.put('.codex/skills/one/SKILL.md','one');fs.mkdirSync(path.join(f.home,'repo'));
 const env={...process.env,HOME:f.home,USERPROFILE:f.home,CODEX_HOME:f.native,AGENT_FARM_NATIVE_CODEX_HOME:f.native};
 const run=args=>spawnSync(process.execPath,[cli,...args,'--config-root',f.root],{env,encoding:'utf8'});
 let r=run(['unset','global','--save','saved','--harness','codex','--model','test']);assert.equal(r.status,0,r.stderr);
 r=run(['set','global','saved']);assert.equal(r.status,0,r.stderr);
 r=run(['status','global','--harness','codex']);assert.match(r.stdout,/one: managed \(saved\)/);
 r=run(['run','saved','--directory',path.join(f.home,'repo'),'--explain']);assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stderr,/Warning/);
 fs.mkdirSync(path.join(f.home,'bin'),{recursive:true});writeHarness(path.join(f.home,'bin'),'codex',"console.log('native-started');\n");env.PATH=path.join(f.home,'bin')+path.delimiter+env.PATH;
 r=run(['run','saved','--directory',path.join(f.home,'repo')]);assert.equal(r.status,0,r.stderr);assert.match(r.stderr,/global skill\(s\)/);assert.match(r.stdout,/native-started/);
 r=run(['unset','global','saved']);assert.equal(r.status,0,r.stderr);
 f.put('library/workspace.yaml','connections: {}\n');
 r=run(['set','global','--directory',f.root,'--harness','codex']);assert.equal(r.status,0,r.stderr);
 r=run(['unset','global','--directory',f.root,'--harness','codex']);assert.equal(r.status,0,r.stderr);
 r=run(['unset','global']);assert.notEqual(r.status,0);r=run(['set','global','saved','--save','other']);assert.notEqual(r.status,0);
});
