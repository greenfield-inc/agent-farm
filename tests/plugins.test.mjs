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

// A small checksummed plugin that other plugins depend on (profile implementer, agent socrates, skill review).
const shared=fileURLToPath(new URL('./fixtures/plugins/shared',import.meta.url));
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
 installPlugin(shared,root);
 installPlugin(source.root,root);
 return {root,source};
}

function cliRun(root,args){
 return spawnSync(process.execPath,[cli,...args,'--config-root',root],{encoding:'utf8'});
}

test('plugins install into isolated namespaces and list overlapping profiles',t=>{
 const root=fixture(t),source=makePlugin(root);
 put(root,'workspace.yaml','LOCAL');
 const {profiles}=validatePlugin(shared);
 assert.ok(profiles.length>0&&profiles.every(profile=>profile.agent),'Every fixture profile validates to an agent');
 const shipped=profiles[0].profile;
 assert.ok(installPlugin(shared,root).changed>0);
 assert.equal(installPlugin(shared,root).changed,0);
 assert.ok(installPlugin(source.root,root).changed>0);
 assert.equal(fs.readFileSync(path.join(root,`plugins/shared/profiles/${shipped}.yaml`),'utf8'),fs.readFileSync(path.join(shared,`profiles/${shipped}.yaml`),'utf8'));
 assert.equal(fs.readFileSync(path.join(root,'workspace.yaml'),'utf8'),'LOCAL');
 assert.deepEqual(listPlugins(root).map(item=>item.name),['fixture','shared']);
 const listed=listProfiles(root).filter(item=>item.profile==='implementer');
 assert.deepEqual(listed.map(item=>item.qualified),['fixture/implementer','shared/implementer']);
 assert.ok(listed.every(item=>item.ambiguous));
 const result=cliRun(root,['profiles','list']);
 assert.equal(result.status,0,result.stderr);
 const sharedVersion=validatePlugin(shared).info.version.replaceAll('.','\\.');
 assert.match(result.stdout,new RegExp(`shared/implementer(?: \\(.*?\\))? -> .*\\[ambiguous bare name\\].*plugin shared ${sharedVersion}`));
 assert.match(result.stdout,/fixture\/implementer -> .*\[ambiguous bare name\].*plugin fixture 1\.0\.0/);
});

test('qualified launches remain isolated and bare names honor default_plugin',t=>{
 const {root}=installPair(t);
 assert.throws(()=>build(root,'implementer',root),/fixture\/implementer.*shared\/implementer/);
 const explain=name=>cliRun(root,['run',name,'--directory',root,'--explain']);
 let launched=explain('fixture/implementer');
 assert.equal(launched.status,0,launched.stderr);
 assert.equal(JSON.parse(launched.stdout).trace_identity,'fixture/implementer@1.0.0');
 launched=explain('shared/implementer');
 assert.equal(launched.status,0,launched.stderr);
 assert.equal(JSON.parse(launched.stdout).plugin,'shared');
 launched=explain('implementer');
 assert.notEqual(launched.status,0);
 assert.match(launched.stderr,/fixture\/implementer.*shared\/implementer/);
 fs.writeFileSync(path.join(root,'settings.json'),'{"default_plugin":"fixture"}\n');
 const preferred=build(root,'implementer',root),preferredManifest=JSON.parse(fs.readFileSync(path.join(preferred,'manifest.json')));
 assert.equal(preferredManifest.trace_identity,'fixture/implementer@1.0.0');
 assert.equal(preferredManifest.nodes.main.plugin,'fixture');
 const own=build(root,'shared/implementer',root),other=build(root,'fixture/implementer',root);
 assert.notEqual(own,other);
 assert.equal(JSON.parse(fs.readFileSync(path.join(own,'manifest.json'))).plugin,'shared');
 assert.equal(inspectProfile(root,'fixture/implementer',{directory:root}).plugin_version,'1.0.0');
 assert.match(fs.readFileSync(path.join(other,'main/instructions.md'),'utf8'),/FIXTURE/);
 assert.doesNotMatch(fs.readFileSync(path.join(other,'main/instructions.md'),'utf8'),/Socratic/);
});

test('updating one plugin leaves every other plugin byte-identical',t=>{
 const {root,source}=installPair(t);
 const beforeReceipt=fs.readFileSync(path.join(root,'.plugins/shared.json'));
 const beforeFiles=fileMap(path.join(root,'plugins/shared'));
 source.put('agents/worker.md','---\nharness: codex\nmodel: updated\nskills: [review]\ninstructions_files: [../instructions/worker.md]\n---\nFixture body.\n');
 installPlugin(source.root,root);
 assert.deepEqual(fs.readFileSync(path.join(root,'.plugins/shared.json')),beforeReceipt);
 assert.deepEqual(fileMap(path.join(root,'plugins/shared')),beforeFiles);
});

test('uninstall preserves modified files and leaves other plugins runnable',t=>{
 const {root}=installPair(t),skill=path.join(root,'plugins/fixture/skills/review/SKILL.md');
 fs.appendFileSync(skill,'\nUSER EDIT');
 const result=uninstallPlugin('fixture',root);
 assert.ok(result.removed.length>0);
 assert.equal(result.stayed.find(item=>item.file==='skills/review/SKILL.md')?.reason,'modified');
 assert.match(fs.readFileSync(skill,'utf8'),/USER EDIT/);
 assert.equal(listPlugins(root).some(item=>item.name==='fixture'),false);
 assert.ok(build(root,'shared/implementer',root));
});

test('cross-plugin children resolve, are inspected in metadata, and name missing dependencies',t=>{
 const root=fixture(t),source=makePlugin(root);
 source.put('agents/worker.md','---\nharness: codex\nmodel: fixture-model\nskills: [shared/review]\nsubagents: {socrates: {agent: shared/socrates, mode: process}}\ninstructions_files: [../instructions/worker.md]\n---\nFixture body.\n');
 installPlugin(shared,root);
 installPlugin(source.root,root);
 const bundle=build(root,'fixture/implementer',root),manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json')));
 assert.equal(manifest.nodes['main/children/socrates'].plugin,'shared');
 assert.equal(manifest.nodes.main.skill_plugins.review.plugin,'shared');
 assert.deepEqual(manifest.cross_plugin_dependencies.map(item=>item.plugin),['shared']);
 uninstallPlugin('shared',root);
 assert.throws(()=>build(root,'fixture/implementer',root),/Missing plugin shared/);
 assert.throws(()=>validatePlugin(source.root,root),/Missing plugin shared/);
});

test('legacy flat installs are refused without changing user files',t=>{
 const root=fixture(t),planner='agent: planner\n',local='harness: codex\nmodel: local\n';
 put(root,'profiles/planner.yaml',planner);
 put(root,'agents/local-only.yaml',local);
 put(root,'.plugins/shared.json',JSON.stringify({name:'shared',version:'0.1.7',checksums:{'profiles/planner.yaml':hash(Buffer.from(planner))}}));
 const receipt=fs.readFileSync(path.join(root,'.plugins/shared.json'));
 assert.throws(()=>installPlugin(shared,root),/Legacy flat plugin install detected.*No files were changed.*Ask your agent to migrate.*plugins\/shared\//);
 assert.deepEqual(fs.readFileSync(path.join(root,'.plugins/shared.json')),receipt);
 assert.equal(fs.readFileSync(path.join(root,'profiles/planner.yaml'),'utf8'),planner);
 assert.equal(fs.readFileSync(path.join(root,'agents/local-only.yaml'),'utf8'),local);
 assert.equal(fs.existsSync(path.join(root,'plugins/shared')),false);
});

test('plugin tampering and namespaced symlink destinations are rejected before installation',t=>{
 const root=fixture(t),copy=path.join(root,'plugin');
 fs.cpSync(shared,copy,{recursive:true});
 fs.appendFileSync(path.join(copy,'agents/socrates.md'),'tampered');
 assert.throws(()=>validatePlugin(copy),/^Error: Plugin shared failed its integrity check: agents\/socrates\.md changed$/);
 fs.rmSync(path.join(copy,'agents/socrates.md'));
 assert.throws(()=>validatePlugin(copy),/: agents\/socrates\.md missing$/);
 const target=path.join(root,'target');
 fs.mkdirSync(path.join(target,'plugins'),{recursive:true});
 writeLink(path.join(root,'missing'),path.join(target,'plugins/shared'));
 assert.throws(()=>installPlugin(shared,target),/Symlink/);
});

test('other manifests validate and direct plugin roots remain runnable',t=>{
 const root=fixture(t),source=makePlugin(root,'roles');
 assert.equal(validatePlugin(source.root).info.name,'roles');
 const bundle=build(source.root,'planner',root),manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json')));
 assert.equal(manifest.trace_identity,'roles/planner@1.0.0');
 assert.equal(hash(fs.readFileSync(path.join(bundle,'main/skills/review/SKILL.md'))),hash(fs.readFileSync(path.join(source.root,'skills/review/SKILL.md'))));
});

test('plugin CLI lists complete receipt metadata and uninstalls bundled plugins',t=>{
 const root=fixture(t),run=args=>cliRun(root,['plugin',...args]),bundled=fileURLToPath(new URL('../plugins/machine-security',import.meta.url));
 let result=run(['install','machine-security']);
 assert.equal(result.status,0,result.stderr);
 result=run(['list']);
 assert.equal(result.status,0,result.stderr);
 const [installed]=JSON.parse(result.stdout);
 assert.equal(installed.name,'machine-security');
 assert.equal(installed.version,validatePlugin(bundled).info.version);
 assert.equal(installed.profiles,validatePlugin(bundled).profiles.length);
 assert.deepEqual(installed.source,validatePlugin(bundled).info.source??{path:fs.realpathSync(bundled)});
 result=run(['uninstall','machine-security']);
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).name,'machine-security');
 assert.deepEqual(listPlugins(root),[]);
});

test('removed bundled plugins are not found by name (J15)',t=>{
 const root=fixture(t);
 for(const name of ['bigbrain','dcouple']){
  const result=cliRun(root,['plugin','install',name]);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,new RegExp(`Plugin source or bundled plugin not found: ${name}`));
 }
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
 assert.deepEqual(profiles,['audits','bug-reporter','business','code-smell-fixes','codebase-audit','customer-insights-loop','free-range','implementer','orchestrator','planner','planning-and-prioritization','process-cleanup','product-researcher','qa-and-fix','reviewer','seo','seo-investigator','seo-measurer','seo-orchestrator','seo-reviewer','seo-strategist','seo-writer','simplify-and-refactor','ui-polish']);
});

test('every plugin in the repository installs from its directory',t=>{
 const root=fixture(t),plugins=fileURLToPath(new URL('../plugins',import.meta.url));
 for(const name of fs.readdirSync(plugins)){
  const result=cliRun(root,['plugin','install',path.join(plugins,name)]);
  assert.equal(result.status,0,`plugins/${name}: ${result.stderr}`);
 }
});

test('plugin pack accepts a plugin without a source',t=>{
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
