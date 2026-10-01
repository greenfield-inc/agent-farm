import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from '../dist/compiler.js';
import {command,fileMap,verify} from '../dist/runtime.js';
import {writeHarness} from './harness.mjs';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
function fixture(t) {
 const base=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-ts-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),target=path.join(base,'repo with spaces');fs.mkdirSync(target);
 const put=(p,s)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
 put('agents/planner.yaml','harness: claude\nmodel: sonnet\nskills: [proof]\nsubagents: {worker: {agent: worker, mode: process}}\n');
 put('agents/worker.yaml','harness: codex\nmodel: gpt-6-astra\nskills: [proof]\n');
 put('skills/proof/SKILL.md','---\nname: proof\ndescription: Test\n---\nPROOF\n');put('skills/proof/helper.txt','SUPPORT');
 put('workspace.yaml','connections:\n  docs:\n    type: mcp\n    auth: none\n    url: https://example.com/mcp\n');
 return {base,root,target,put,build:()=>build(root,'planner',target)};
}
test('complete child/support bundle reuses inputs',t=>{
 const f=fixture(t),b=f.build();assert.equal(f.build(),b);
 assert.equal(fs.readFileSync(path.join(b,'main/children/worker/skills/proof/helper.txt'),'utf8'),'SUPPORT');
 const m=JSON.parse(fs.readFileSync(path.join(b,'manifest.json')));
 assert.deepEqual(m.nodes.main.connections,m.nodes['main/children/worker'].connections);
 assert.equal(m.directory,f.target);verify(b);
});
test('changed skills coexist with unchanged old bundle',t=>{
 const f=fixture(t),b=f.build(),before=fileMap(b);f.put('skills/proof/helper.txt','NEW');
 assert.notEqual(f.build(),b);assert.deepEqual(fileMap(b),before);
});
test('modified or unexpected files fail integrity',t=>{
 const f=fixture(t),b=f.build();fs.writeFileSync(path.join(b,'extra.txt'),'oops');
 assert.throws(()=>f.build(),/integrity/);assert.throws(()=>verify(b),/integrity/);
});
test('nested checksum support files are protected',t=>{
 const f=fixture(t);f.put('skills/proof/checksums.json','{}');const b=f.build();
 fs.writeFileSync(path.join(b,'main/skills/proof/checksums.json'),'changed');assert.throws(()=>verify(b),/integrity/);
});
test('cycles and unsupported fields fail before generation',t=>{
 const f=fixture(t);f.put('agents/worker.yaml','harness: codex\nmodel: test\nsubagents: {parent: {agent: planner, mode: process}}\n');assert.throws(f.build,/cycle/);
 f.put('agents/worker.yaml','harness: codex\nmodel: test\nmax_calls: 2\n');assert.throws(f.build,/Unsupported/);
 assert.equal(fs.existsSync(path.join(f.target,'.agent-farm')),false);
});
test('malformed and duplicate YAML entries fail',t=>{
 const f=fixture(t);f.put('agents/planner.yaml','harness: claude\nmodel: test\nskills: [{source: remote}]\n');assert.throws(f.build,/unique list/);
 f.put('agents/planner.yaml','harness: claude\nmodel: one\nmodel: two\n');assert.throws(f.build,/unique/);
});
test('conflicting endpoints and secret URLs fail',t=>{
 const f=fixture(t);f.put('agents/planner.yaml','harness: claude\nmodel: test\nconnections:\n  docs:\n    type: mcp\n    auth: none\n    url: https://different.example/mcp\n');assert.throws(f.build,/Conflicting/);
 f.put('workspace.yaml','connections:\n  docs:\n    type: mcp\n    auth: native\n    url: https://example.com/mcp?token=secret\n');assert.throws(f.build,/credentials/);
});
test('symlink skill inputs fail',t=>{
 const f=fixture(t);fs.symlinkSync(path.join(f.root,'skills/proof/helper.txt'),path.join(f.root,'skills/proof/link'));assert.throws(f.build,/Symlink/);
});
test('Claude command preserves cwd and literal starter',t=>{
 const f=fixture(t),b=f.build(),r=command(b,'main',{message:'$(not-a-command)',prepare:false});
 assert.equal(r.cwd,f.target);assert.deepEqual(r.argv.slice(-2),['--','$(not-a-command)']);assert.ok(r.argv.includes('--plugin-dir'));
 assert.ok(r.argv.some(s=>s.includes(path.join(b,'main/dispatch/worker'))));
});
test('interactive and headless launches bypass permissions for both harnesses',t=>{
 const f=fixture(t);
 for(const harness of ['claude','codex']) {
  f.put('agents/planner.yaml',`harness: ${harness}\nmodel: test\nskills: [proof]\n`);
  const b=f.build();
  for(const headless of [false,true]) {
   const {argv}=command(b,'main',{headless,prepare:false});
   const flag=harness==='claude' ? '--dangerously-skip-permissions' : '--yolo';
   assert.ok(argv.includes(flag),`${harness} headless=${headless}`);
  }
 }
});
test('Codex references native auth without copying payloads',t=>{
 const f=fixture(t),b=f.build(),home=path.join(f.base,'home'),original=path.join(home,'.codex');fs.mkdirSync(original,{recursive:true});
 fs.writeFileSync(path.join(original,'auth.json'),'SECRET-FIXTURE');fs.writeFileSync(path.join(original,'config.toml'),'');
 const r=command(b,'main/children/worker',{home,env:{CODEX_HOME:original}});
 assert.equal(fs.realpathSync(path.join(r.env.CODEX_HOME,'auth.json')),path.join(original,'auth.json'));
 assert.ok(fs.lstatSync(path.join(r.env.CODEX_HOME,'auth.json')).isSymbolicLink());
 for (const p of Object.keys(fileMap(b))) assert.equal(fs.readFileSync(path.join(b,p),'utf8').includes('SECRET-FIXTURE'),false);
});
test('profiles coexist without changing repo instructions',t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.target,'AGENTS.md'),'ORIGINAL');const b=f.build();
 assert.notEqual(build(f.root,'worker',f.target),b);assert.equal(fs.readFileSync(path.join(f.target,'AGENTS.md'),'utf8'),'ORIGINAL');
});
test('child aliases cannot collide with bundle support directories',t=>{
 const f=fixture(t);f.put('agents/planner.yaml','harness: claude\nmodel: test\nskills: [proof]\nsubagents: {skills: {agent: worker, mode: process}, dispatch: {agent: worker, mode: process}}\n');
 const b=f.build();verify(b);assert.ok(fs.existsSync(path.join(b,'main/children/skills/agent.json')));
});
test('native exec preserves args, cwd, environment and exit status; dispatch runs standalone',t=>{
 const f=fixture(t),bin=path.join(f.base,'bin'),home=path.join(f.base,'home');fs.mkdirSync(bin);fs.mkdirSync(path.join(home,'.codex'),{recursive:true});
 const out=path.join(f.base,'record.json');
 const script=`#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.RECORD,JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),home:process.env.CODEX_HOME}));process.exit(7);\n`;
 for(const harness of ['claude','codex'])writeHarness(bin,harness,script);
 const env={...process.env,HOME:home,USERPROFILE:home,CODEX_HOME:path.join(home,'.codex'),AGENT_FARM_NATIVE_CODEX_HOME:path.join(home,'.codex'),PATH:bin+path.delimiter+process.env.PATH,RECORD:out};
 const message='$(touch NEVER) `echo no`\nquoted "text"';
 const run=spawnSync(process.execPath,[cli,'agent','planner','--config-root',f.root,'--directory',f.target,'--message',message],{env,encoding:'utf8'});
 assert.equal(run.status,7,run.stderr);let result=JSON.parse(fs.readFileSync(out));assert.ok(result.args.includes('--dangerously-skip-permissions'));assert.equal(result.cwd,f.target);assert.deepEqual(result.args.slice(-2),['--',message]);
 const b=f.build();const child=spawnSync(process.execPath,[path.join(b,'main/dispatch/worker'),'--message',message],{env,encoding:'utf8'});
 assert.equal(child.status,7,child.stderr);result=JSON.parse(fs.readFileSync(out));assert.equal(result.cwd,f.target);assert.equal(result.args[0],'exec');assert.ok(result.args.includes('--yolo'));assert.deepEqual(result.args.slice(-2),['--',message]);
 assert.ok(result.home.includes('.cache/agent-farm/native-proof'));assert.equal(fs.existsSync(path.join(f.target,'NEVER')),false);verify(b);
});
test('profile model settings reach both native harnesses and override legacy entrypoints',t=>{
 const f=fixture(t);
 f.put('agents/planner.yaml','harness: claude\nmodel: {name: claude-fable-5-1, reasoning: high}\nskills: [proof]\n');
 let b=f.build(),r=command(b,'main',{prepare:false});
 assert.equal(r.argv[r.argv.indexOf('--model')+1],'claude-fable-5-1');
 assert.equal(r.argv[r.argv.indexOf('--effort')+1],'high');
 f.put('agents/planner.yaml','harness: codex\nmodel: {name: gpt-6-astra, reasoning: medium, speed: fast}\nskills: [proof]\n');
 b=f.build();r=command(b,'main',{prepare:false});
 assert.ok(r.argv.includes('model_reasoning_effort="medium"'));
 assert.ok(r.argv.includes('service_tier="fast"'));
 const result=spawnSync(process.execPath,[cli,'run','planner','--config-root',f.root,'--directory',f.target,'--explain'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 assert.ok(JSON.parse(result.stdout).argv.includes('service_tier="fast"'));
});
test('invalid model settings fail rather than silently dropping options',t=>{
 const f=fixture(t);
 for(const model of ['{name: test, reasoning: typo}','{name: test, speed: fast}','{name: test, typo: high}']) {
  f.put('agents/planner.yaml',`harness: claude\nmodel: ${model}\n`);
  assert.throws(f.build,/invalid|model.speed|Unsupported/);
 }
 f.put('agents/planner.yaml','harness: codex\nmodel: {name: test, reasoning: high}\nreasoning_effort: medium\n');
 assert.throws(f.build,/model.reasoning/);
});
test('profiles preset partial models and declared arguments but reject other behavior overrides',t=>{
 const f=fixture(t);
 f.put('agents/base.md','---\nharness: codex\nmodel: {name: first, reasoning: medium, speed: standard}\nargs:\n  mode: {values: [standard, fast], default: standard}\n  source: {type: path}\nskills: [proof]\n---\nBase intent.\n');
 f.put('profiles/entry.yaml','agent: base\nmodel: {name: second, speed: fast}\nargs: {mode: fast, source: ../plan.md}\n');
 const b=build(f.root,'entry',f.target),m=JSON.parse(fs.readFileSync(path.join(b,'manifest.json')));
 assert.equal(m.nodes.main.name,'base');assert.equal(m.nodes.main.model,'second');assert.equal(m.nodes.main.reasoning_effort,'medium');assert.equal(m.nodes.main.speed,'fast');
 assert.equal(m.nodes.main.instructions,'Base intent.');
 assert.deepEqual(m.nodes.main.launch.model.sources,{name:'preset',reasoning:'agent',speed:'preset'});
 assert.deepEqual(m.nodes.main.launch.arguments,{mode:'fast',source:'../plan.md'});assert.equal(m.nodes.main.launch.override,'preset');assert.equal(m.nodes.main.launch.preset,'entry');
 for(const extra of ['instructions: Extra','subagents: {}','harness: claude','skills: []']){
  f.put('profiles/entry.yaml',`agent: base\n${extra}\n`);assert.throws(()=>build(f.root,'entry',f.target),/Unsupported/);
 }
 f.put('profiles/entry.yaml','agent: base\nmodel: second\n');assert.throws(()=>build(f.root,'entry',f.target),/mapping/);
 f.put('profiles/entry.yaml','agent: base\nargs: {unknown: value}\n');assert.throws(()=>build(f.root,'entry',f.target),/base.*unknown.*accepted arguments/i);
 f.put('profiles/entry.yaml','agent: missing\n');assert.throws(()=>build(f.root,'entry',f.target),/ENOENT/);
});
test('agent argument declarations validate enum, string, path, defaults, and names',t=>{
 const f=fixture(t);
 f.put('agents/planner.yaml','harness: codex\nmodel: test\nargs:\n  review: {values: [none, final, full], default: final}\n  parent: {type: path, description: Status file}\n  source: {type: string}\n');
 const manifest=JSON.parse(fs.readFileSync(path.join(f.build(),'manifest.json')));
 assert.deepEqual(manifest.nodes.main.launch.arguments,{review:'final'});
 assert.deepEqual(manifest.nodes.main.argument_definitions.parent,{type:'path',description:'Status file'});
 for(const args of ['{bad: {type: number}}','{Bad: {type: string}}','{mode: {values: []}}','{mode: {values: [one], default: two}}','{mode: {values: [one], type: string}}']) {
  f.put('agents/planner.yaml',`harness: codex\nmodel: test\nargs: ${args}\n`);assert.throws(f.build,/Argument|configuration name/);
 }
});
test('native Codex roles retain child model and skill paths and inherit parent connections',t=>{
 const f=fixture(t);
 f.put('agents/planner.yaml','harness: codex\nmodel: {name: parent, reasoning: medium, speed: fast}\nsubagents:\n  proof-worker:\n    agent: worker\n    mode: native\n    model: {name: child, reasoning: max}\n    description: Check the proof.\nconnections:\n  extra:\n    type: mcp\n    auth: native\n    url: https://extra.example/mcp\n');
 const b=f.build(),r=command(b,'main',{prepare:false});
 const file=path.join(b,'main/native-agents/proof-worker.toml'),s=fs.readFileSync(file,'utf8');
 assert.ok(r.argv.includes('agents.proof-worker.config_file='+JSON.stringify(file)));
 assert.match(s,/model = "child"/);assert.match(s,/model_reasoning_effort = "max"/);
 assert.match(s,/service_tier = "default"/);assert.match(s,/extra.example/);assert.match(s,/example.com/);
 assert.ok(s.includes(path.join(b,'main/children/proof-worker/skills/proof/SKILL.md')));
 assert.equal(fs.existsSync(path.join(b,'main/dispatch/proof-worker')),false);
});
test('native Claude definitions use configured model effort and child prompt',t=>{
 const f=fixture(t);
 f.put('agents/planner.yaml','harness: claude\nmodel: test\nsubagents:\n  worker:\n    agent: worker\n    mode: native\n    harness: claude\n    model: {name: claude-fable-5-1, reasoning: high}\n');
 const b=f.build(),r=command(b,'main',{prepare:false});
 const roles=JSON.parse(r.argv[r.argv.indexOf('--agents')+1]);
 assert.equal(roles.worker.model,'claude-fable-5-1');assert.equal(roles.worker.effort,'high');
 assert.ok(roles.worker.prompt.includes('/skills/proof/SKILL.md'));
});
test('unsupported native delegation cannot silently become a process',t=>{
 const f=fixture(t);
 f.put('agents/planner.yaml','harness: claude\nmodel: test\nsubagents: {worker: {agent: worker, mode: native}}\n');
 assert.throws(f.build,/parent harness/);
 f.put('agents/planner.yaml','harness: codex\nmodel: test\nsubagents: {worker: {agent: worker, mode: unknown}}\n');
 assert.throws(f.build,/mode/);
});
test('directory agents compose Markdown and invalidate bundles',t=>{
 const f=fixture(t);
 f.put('agents/writer/agent.yaml','harness: codex\nmodel: test\ninstructions_files: [../../instructions/shared.md, instructions.md]\n');
 f.put('instructions/shared.md','Shared guidance.');f.put('agents/writer/instructions.md','Role guidance.');
 f.put('profiles/writer.yaml','agent: writer\n');
 const b=build(f.root,'writer',f.target);
 assert.equal(fs.readFileSync(path.join(b,'main/instructions.md'),'utf8'),'Shared guidance.\n\nRole guidance.');
 f.put('instructions/shared.md','Updated guidance.');assert.notEqual(build(f.root,'writer',f.target),b);verify(b);
});
test('instruction files fail on missing files, escapes, and ambiguous sources',t=>{
 const f=fixture(t);
 const run=()=>build(f.root,'writer',f.target);
 f.put('agents/writer/agent.yaml','harness: codex\nmodel: test\ninstructions_file: missing.md\n');assert.throws(run,/ENOENT/);
 fs.writeFileSync(path.join(f.base,'outside.md'),'outside');
 f.put('agents/writer/agent.yaml','harness: codex\nmodel: test\ninstructions_file: ../../../outside.md\n');assert.throws(run,/configuration root/);
 f.put('agents/writer/agent.yaml','harness: codex\nmodel: test\ninstructions_file: instructions.md\ninstructions: inline\n');assert.throws(run,/one instructions source/);
 f.put('agents/writer.yaml','harness: codex\nmodel: test\n');assert.throws(run,/Ambiguous/);
});

test('Markdown agents compose shared instructions and reject malformed frontmatter',t=>{
 const f=fixture(t);
 f.put('agents/writer.md','---\nharness: codex\nmodel: test\ninstructions_files: [../instructions/shared.md]\n---\n\nRole body.\n');
 f.put('instructions/shared.md','Shared.');
 const run=()=>build(f.root,'writer',f.target),b=run();
 assert.equal(fs.readFileSync(path.join(b,'main/instructions.md'),'utf8'),'Shared.\n\nRole body.');
 f.put('agents/writer.md','No frontmatter');assert.throws(run,/frontmatter/);
 f.put('agents/writer.md','---\nharness: codex\nmodel: one\nmodel: two\n---\nBody');assert.throws(run,/unique/);
 f.put('agents/writer.md','---\nharness: codex\nmodel: test\ninstructions: wrong\n---\nBody');assert.throws(run,/Markdown body/);
});
test('skill metadata is translated only for Codex while support files remain intact',t=>{
 const f=fixture(t),metadata='interface:\n  display_name: Proof\npolicy:\n  allow_implicit_invocation: false\n';
 f.put('skills/proof/metadata/codex.yaml',metadata);
 const b=f.build();
 assert.equal(fs.readFileSync(path.join(b,'main/children/worker/skills/proof/agents/openai.yaml'),'utf8'),metadata);
 assert.equal(fs.existsSync(path.join(b,'main/skills/proof/metadata/codex.yaml')),false);
 assert.equal(fs.existsSync(path.join(b,'main/skills/proof/agents/openai.yaml')),false);
 assert.equal(fs.readFileSync(path.join(b,'main/children/worker/skills/proof/helper.txt'),'utf8'),'SUPPORT');
 f.put('skills/proof/metadata/codex.yaml',metadata.replace('false','true'));assert.notEqual(f.build(),b);verify(b);
 f.put('skills/proof/agents/openai.yaml',metadata);assert.throws(f.build,/Ambiguous Codex skill metadata/);
});
test('child modes are mandatory for both shorthand and mapping definitions',t=>{
 const f=fixture(t);
 for(const child of ['worker','{agent: worker}']){
  f.put('agents/planner.yaml',`harness: claude\nmodel: test\nsubagents: {worker: ${child}}\n`);
  assert.throws(f.build,/explicit|mode/);
 }
});
test('inspection reports resolved sources and child settings without generating bundles',t=>{
 const f=fixture(t);f.put('profiles/entry.yaml','agent: planner\n');
 const run=spawnSync(process.execPath,[cli,'inspect','entry','--config-root',f.root,'--directory',f.target],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);const info=JSON.parse(run.stdout);
 assert.equal(info.profile_file,path.join(f.root,'profiles/entry.yaml'));
 assert.equal(info.agents.main.source_file,path.join(f.root,'agents/planner.yaml'));
 assert.equal(info.agents['main/children/worker'].mode,'process');
 assert.equal(info.agents.main.connections.docs.url,'https://example.com/mcp');
 assert.equal(info.agents.main.model.sources.name,'agent');assert.deepEqual(info.agents.main.arguments,{});
 assert.equal(info.agents.main.skills[0].source_file,path.join(f.root,'skills/proof/SKILL.md'));
 const list=spawnSync(process.execPath,[cli,'profiles','list','--config-root',f.root],{encoding:'utf8'});
 assert.equal(list.status,0,list.stderr);assert.match(list.stdout,/entry -> planner/);
 assert.equal(fs.existsSync(path.join(f.target,'.agent-farm')),false);
});
