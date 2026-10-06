import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {installPlugin,validatePlugin,listPlugins,uninstallPlugin} from '../dist/plugins.js';
import {build} from '../dist/compiler.js';
import {fileMap,hash} from '../dist/runtime.js';
import {listProfiles,inspectProfile} from '../dist/inspect.js';
import {writeLink} from './harness.mjs';

const dcouple=fileURLToPath(new URL('../plugins/dcouple',import.meta.url));
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-plugin-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return root;
}

function put(root,relative,text){
 const file=path.join(root,relative);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,text);
}

function makePlugin(base,name='fixture',version='1.0.0'){
 const root=path.join(base,name+'-source');
 put(root,'plugin.yaml',`name: ${name}\nversion: ${version}\ncli_major: 0\n`);
 put(root,'profiles/planner.yaml','agent: worker\n');
 put(root,'profiles/implementer.yaml','agent: worker\n');
 put(root,'agents/worker.md','---\nharness: codex\nmodel: fixture-model\nskills: [review]\ninstructions_files: [../instructions/worker.md]\n---\nFixture body.\n');
 put(root,'skills/review/SKILL.md','---\nname: review\ndescription: Fixture review.\n---\nFIXTURE REVIEW\n');
 put(root,'instructions/worker.md','FIXTURE INSTRUCTIONS');
 return {root,put:(relative,text)=>put(root,relative,text)};
}

function installPair(t){
 const root=fixture(t),source=makePlugin(root);
 installPlugin(dcouple,root);
 installPlugin(source.root,root);
 return {root,source};
}

function cliRun(root,args){
 return spawnSync(process.execPath,[cli,...args,'--config-root',root],{encoding:'utf8'});
}

test('plugins install into isolated namespaces and list overlapping profiles',t=>{
 const root=fixture(t),source=makePlugin(root);
 put(root,'workspace.yaml','LOCAL');
 const {profiles}=validatePlugin(dcouple);
 assert.ok(profiles.length>0&&profiles.every(profile=>profile.agent),'Every bundled profile validates to an agent');
 const shipped=profiles[0].profile;
 assert.ok(installPlugin(dcouple,root).changed>0);
 assert.equal(installPlugin(dcouple,root).changed,0);
 assert.ok(installPlugin(source.root,root).changed>0);
 assert.equal(fs.readFileSync(path.join(root,`plugins/dcouple/profiles/${shipped}.yaml`),'utf8'),fs.readFileSync(path.join(dcouple,`profiles/${shipped}.yaml`),'utf8'));
 assert.equal(fs.readFileSync(path.join(root,'workspace.yaml'),'utf8'),'LOCAL');
 assert.deepEqual(listPlugins(root).map(item=>item.name),['dcouple','fixture']);
 const listed=listProfiles(root).filter(item=>item.profile==='implementer');
 assert.deepEqual(listed.map(item=>item.qualified),['dcouple/implementer','fixture/implementer']);
 assert.ok(listed.every(item=>item.ambiguous));
 const result=cliRun(root,['profiles','list']);
 assert.equal(result.status,0,result.stderr);
 const bundledVersion=validatePlugin(dcouple).info.version.replaceAll('.','\\.');
 assert.match(result.stdout,new RegExp(`dcouple/implementer(?: \\(.*?\\))? -> .*\\[ambiguous bare name\\].*plugin dcouple ${bundledVersion}`));
 assert.match(result.stdout,/fixture\/implementer -> .*\[ambiguous bare name\].*plugin fixture 1\.0\.0/);
});

test('qualified launches remain isolated and bare names honor default_plugin',t=>{
 const {root}=installPair(t);
 assert.throws(()=>build(root,'implementer',root),/dcouple\/implementer.*fixture\/implementer/);
 const explain=name=>cliRun(root,['run',name,'--directory',root,'--explain']);
 let launched=explain('fixture/implementer');
 assert.equal(launched.status,0,launched.stderr);
 assert.equal(JSON.parse(launched.stdout).trace_identity,'fixture/implementer@1.0.0');
 launched=explain('dcouple/implementer');
 assert.equal(launched.status,0,launched.stderr);
 assert.equal(JSON.parse(launched.stdout).plugin,'dcouple');
 launched=explain('implementer');
 assert.notEqual(launched.status,0);
 assert.match(launched.stderr,/dcouple\/implementer.*fixture\/implementer/);
 fs.writeFileSync(path.join(root,'settings.json'),'{"default_plugin":"fixture"}\n');
 const preferred=build(root,'implementer',root),preferredManifest=JSON.parse(fs.readFileSync(path.join(preferred,'manifest.json')));
 assert.equal(preferredManifest.trace_identity,'fixture/implementer@1.0.0');
 assert.equal(preferredManifest.nodes.main.plugin,'fixture');
 const own=build(root,'dcouple/implementer',root),other=build(root,'fixture/implementer',root);
 assert.notEqual(own,other);
 assert.equal(JSON.parse(fs.readFileSync(path.join(own,'manifest.json'))).plugin,'dcouple');
 assert.equal(inspectProfile(root,'fixture/implementer',{directory:root}).plugin_version,'1.0.0');
 assert.match(fs.readFileSync(path.join(other,'main/instructions.md'),'utf8'),/FIXTURE/);
 assert.doesNotMatch(fs.readFileSync(path.join(other,'main/instructions.md'),'utf8'),/Socratic/);
});

test('updating one plugin leaves every other plugin byte-identical',t=>{
 const {root,source}=installPair(t);
 const beforeReceipt=fs.readFileSync(path.join(root,'.plugins/dcouple.json'));
 const beforeFiles=fileMap(path.join(root,'plugins/dcouple'));
 source.put('agents/worker.md','---\nharness: codex\nmodel: updated\nskills: [review]\ninstructions_files: [../instructions/worker.md]\n---\nFixture body.\n');
 installPlugin(source.root,root);
 assert.deepEqual(fs.readFileSync(path.join(root,'.plugins/dcouple.json')),beforeReceipt);
 assert.deepEqual(fileMap(path.join(root,'plugins/dcouple')),beforeFiles);
});

test('uninstall preserves modified files and leaves other plugins runnable',t=>{
 const {root}=installPair(t),skill=path.join(root,'plugins/fixture/skills/review/SKILL.md');
 fs.appendFileSync(skill,'\nUSER EDIT');
 const result=uninstallPlugin('fixture',root);
 assert.ok(result.removed.length>0);
 assert.equal(result.stayed.find(item=>item.file==='skills/review/SKILL.md')?.reason,'modified');
 assert.match(fs.readFileSync(skill,'utf8'),/USER EDIT/);
 assert.equal(listPlugins(root).some(item=>item.name==='fixture'),false);
 assert.ok(build(root,'dcouple/implementer',root));
});

test('cross-plugin children resolve, are inspected in metadata, and name missing dependencies',t=>{
 const root=fixture(t),source=makePlugin(root);
 source.put('agents/worker.md','---\nharness: codex\nmodel: fixture-model\nskills: [dcouple/review]\nsubagents: {socrates: {agent: dcouple/socrates, mode: process}}\ninstructions_files: [../instructions/worker.md]\n---\nFixture body.\n');
 installPlugin(dcouple,root);
 installPlugin(source.root,root);
 const bundle=build(root,'fixture/implementer',root),manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json')));
 assert.equal(manifest.nodes['main/children/socrates'].plugin,'dcouple');
 assert.equal(manifest.nodes.main.skill_plugins.review.plugin,'dcouple');
 assert.deepEqual(manifest.cross_plugin_dependencies.map(item=>item.plugin),['dcouple']);
 uninstallPlugin('dcouple',root);
 assert.throws(()=>build(root,'fixture/implementer',root),/Missing plugin dcouple/);
 assert.throws(()=>validatePlugin(source.root,root),/Missing plugin dcouple/);
});

test('legacy flat installs are refused without changing user files',t=>{
 const root=fixture(t),planner='agent: planner\n',local='harness: codex\nmodel: local\n';
 put(root,'profiles/planner.yaml',planner);
 put(root,'agents/local-only.yaml',local);
 put(root,'.plugins/dcouple.json',JSON.stringify({name:'dcouple',version:'0.1.7',checksums:{'profiles/planner.yaml':hash(Buffer.from(planner))}}));
 const receipt=fs.readFileSync(path.join(root,'.plugins/dcouple.json'));
 assert.throws(()=>installPlugin(dcouple,root),/Legacy flat plugin install detected.*No files were changed.*Ask your agent to migrate.*plugins\/dcouple\//);
 assert.deepEqual(fs.readFileSync(path.join(root,'.plugins/dcouple.json')),receipt);
 assert.equal(fs.readFileSync(path.join(root,'profiles/planner.yaml'),'utf8'),planner);
 assert.equal(fs.readFileSync(path.join(root,'agents/local-only.yaml'),'utf8'),local);
 assert.equal(fs.existsSync(path.join(root,'plugins/dcouple')),false);
});

test('plugin tampering and namespaced symlink destinations are rejected before installation',t=>{
 const root=fixture(t),copy=path.join(root,'plugin');
 fs.cpSync(dcouple,copy,{recursive:true});
 fs.appendFileSync(path.join(copy,'agents/planner.md'),'tampered');
 assert.throws(()=>validatePlugin(copy),/integrity/);
 const target=path.join(root,'target');
 fs.mkdirSync(path.join(target,'plugins'),{recursive:true});
 writeLink(path.join(root,'missing'),path.join(target,'plugins/dcouple'));
 assert.throws(()=>installPlugin(dcouple,target),/Symlink/);
});

test('non-dcouple manifests validate and direct plugin roots remain runnable',t=>{
 const root=fixture(t),source=makePlugin(root,'roles');
 assert.equal(validatePlugin(source.root).info.name,'roles');
 const bundle=build(source.root,'planner',root),manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json')));
 assert.equal(manifest.trace_identity,'roles/planner@1.0.0');
 assert.equal(hash(fs.readFileSync(path.join(bundle,'main/skills/review/SKILL.md'))),hash(fs.readFileSync(path.join(source.root,'skills/review/SKILL.md'))));
});

test('plugin CLI lists complete receipt metadata and uninstalls bundled plugins',t=>{
 const root=fixture(t),run=args=>cliRun(root,['plugin',...args]);
 let result=run(['install','dcouple']);
 assert.equal(result.status,0,result.stderr);
 result=run(['list']);
 assert.equal(result.status,0,result.stderr);
 const [installed]=JSON.parse(result.stdout);
 assert.equal(installed.name,'dcouple');
 assert.equal(installed.version,validatePlugin(dcouple).info.version);
 assert.equal(installed.profiles,validatePlugin(dcouple).profiles.length);
 assert.deepEqual(installed.source,validatePlugin(dcouple).info.source);
 result=run(['uninstall','dcouple']);
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).name,'dcouple');
 assert.deepEqual(listPlugins(root),[]);
});

test('a bare plugin install installs the bundled greenfield plugin with the moved profiles',t=>{
 const root=fixture(t),run=args=>cliRun(root,['plugin',...args]);
 let result=run(['install']);
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).name,'greenfield');
 result=run(['list']);
 assert.deepEqual(JSON.parse(result.stdout).map(plugin=>plugin.name),['greenfield']);
 const profiles=fs.readdirSync(path.join(root,'plugins/greenfield/profiles')).map(file=>file.replace(/\.yaml$/,'')).sort();
 assert.deepEqual(profiles,['audits','bug-reporter','business','free-range','implementer','orchestrator','planner','product-researcher','qa-and-fix','reviewer','seo','simplify-and-refactor']);
});

test('plugin pack accepts a non-dcouple plugin',t=>{
 const root=fixture(t),source=makePlugin(root,'roles'),output=path.join(root,'packed-roles');
 execFileSync('git',['init','-q'],{cwd:source.root});
 execFileSync('git',['add','.'],{cwd:source.root});
 execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.com','commit','-qm','fixture'],{cwd:source.root});
 const result=cliRun(root,['plugin','pack',source.root,output]);
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).name,'roles');
 const packed=validatePlugin(output);
 assert.equal(packed.info.name,'roles');
 assert.ok(Object.keys(packed.info.checksums).length>0);
 assert.equal(packed.info.source.repository,fs.realpathSync(source.root));
});
