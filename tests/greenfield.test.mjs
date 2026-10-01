import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build,resolveProfile} from '../dist/compiler.js';
import {command,verify} from '../dist/runtime.js';
import {validatePlugin} from '../dist/plugins.js';
import {parse} from 'yaml';

const root=fileURLToPath(new URL('../plugins/greenfield/',import.meta.url));

test('Greenfield compiles a single Astra Low writer with verification and cross-harness review',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-profile-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 validatePlugin(root);
 for(const profile of ['implementer:standard','implementer:fast']){
  const resolved=resolveProfile(root,profile),main=resolved.nodes.main;
  assert.deepEqual(Object.keys(main.children).sort(),['frontend-verifier','reviewer','second-reviewer']);
  for(const route of Object.values(main.children))assert.deepEqual(Object.keys(resolved.nodes[route].children),[]);
  const bundle=build(root,profile,target);verify(bundle);
  const launch=command(bundle,'main',{prepare:false});
  assert.equal(launch.argv[launch.argv.indexOf('--model')+1],'gpt-6-astra');
  assert.ok(launch.argv.includes('model_reasoning_effort="low"'));
  assert.ok(launch.argv.includes(profile==='implementer:fast' ? 'service_tier="fast"' : 'service_tier="default"'));
  for(const speed of ['fast','standard']){
   const override=command(bundle,'main',{prepare:false,speed});
   assert.ok(override.argv.includes(speed==='fast' ? 'service_tier="fast"' : 'service_tier="default"'));
   assert.ok(override.argv.includes('model_reasoning_effort="low"'));
  }
  const review=command(bundle,main.children.reviewer,{prepare:false});
  assert.equal(review.argv[review.argv.indexOf('--model')+1],'claude-fable-5-1');
  assert.equal(review.argv[review.argv.indexOf('--effort')+1],'high');
  const frontend=resolved.nodes[main.children['frontend-verifier']];
  assert.equal(frontend.mode,'native');assert.equal(frontend.model,'gpt-6.1-sol');assert.equal(frontend.reasoning_effort,'low');
  assert.equal(fs.existsSync(path.join(bundle,'main/dispatch/worker')),false);
 }
});

test('the default Claude implementer variant runs Opus 5.5 with an Astra reviewer and Claude-native helpers',t=>{
 assert.equal(resolveProfile(root,'implementer').nodes.main.model,'claude-opus-5-5');
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-claude-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const resolved=resolveProfile(root,'implementer:claude'),main=resolved.nodes.main;
 assert.equal(main.harness,'claude');assert.equal(main.model,'claude-opus-5-5');assert.equal(main.reasoning_effort,'medium');
 assert.deepEqual(Object.keys(main.children).sort(),['frontend-verifier','reviewer','second-reviewer']);
 const node=name=>resolved.nodes[main.children[name]];
 assert.deepEqual([node('reviewer').mode,node('reviewer').harness,node('reviewer').model,node('reviewer').reasoning_effort],['process','codex','gpt-6-astra','high']);
 assert.deepEqual([node('second-reviewer').mode,node('second-reviewer').harness,node('second-reviewer').model,node('second-reviewer').reasoning_effort],['native','claude','claude-opus-5-5','high']);
 assert.deepEqual([node('frontend-verifier').mode,node('frontend-verifier').harness,node('frontend-verifier').model,node('frontend-verifier').reasoning_effort],['native','claude','claude-opus-5-5','medium']);
 const bundle=build(root,'implementer:claude',target);verify(bundle);
 const launch=command(bundle,'main',{prepare:false});
 assert.equal(launch.argv[launch.argv.indexOf('--model')+1],'claude-opus-5-5');
});

test('Codex roles formerly on gpt-5.6 run gpt-6.1-sol and reviewers keep their pins',()=>{
 const profiles=fs.readdirSync(path.join(root,'profiles')).map(file=>{
  const name=file.replace(/\.yaml$/,''),variants=Object.keys(parse(fs.readFileSync(path.join(root,'profiles',file),'utf8')).variants??{});
  return [name,...variants.map(variant=>name+':'+variant)];
 }).flat();
 const summary=node=>[node.mode,node.harness,node.model,node.reasoning_effort];
 const child=(profile,name)=>{const resolved=resolveProfile(root,profile);return resolved.nodes[resolved.nodes.main.children[name]];};
 for(const profile of profiles)for(const node of Object.values(resolveProfile(root,profile).nodes))assert.doesNotMatch(node.model,/^gpt-5\.6-/,`${profile} ${node.name}`);
 assert.deepEqual(summary(child('planner:claude','mockup-artist')),['process','codex','gpt-6.1-sol','medium']);
 for(const profile of ['implementer:standard','implementer:fast']){
  assert.deepEqual(summary(child(profile,'frontend-verifier')),['native','codex','gpt-6.1-sol','low']);
  assert.deepEqual(summary(child(profile,'second-reviewer')),['native','codex','gpt-6-astra','high']);
  assert.deepEqual(summary(child(profile,'reviewer')).slice(1),['claude','claude-fable-5-1','high']);
 }
 for(const name of ['investigator','researcher'])assert.deepEqual(summary(child('planner:codex',name)),['native','codex','gpt-6.1-sol','max']);
 assert.deepEqual(summary(child('implementer:claude','reviewer')),['process','codex','gpt-6-astra','high']);
 const qa=parse(/^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(root,'agents/qa.md'),'utf8'))[1]);
 assert.deepEqual([qa.harness,qa.model.name,qa.model.reasoning],['codex','gpt-6.1-sol','medium']);
});

test('free-range defaults to Opus 5.5 and keeps an Astra variant',()=>{
 for(const [profile,harness,model] of [['free-range','claude','claude-opus-5-5'],['free-range:claude','claude','claude-opus-5-5'],['free-range:codex','codex','gpt-6-astra']]){
  const main=resolveProfile(root,profile).nodes.main;assert.deepEqual([main.harness,main.model],[harness,model]);
 }
});

test('bug-reporter, orchestrator and the Claude planner\'s Socrates run Opus 5.5',()=>{
 const bug=resolveProfile(root,'bug-reporter'),main=bug.nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['claude','claude-opus-5-5','high']);
 for(const [name,effort] of [['investigator','high'],['qa','medium']]){const node=bug.nodes[main.children[name]];assert.deepEqual([node.mode,node.harness,node.model,node.reasoning_effort],['native','claude','claude-opus-5-5',effort]);}
 const orchestrator=resolveProfile(root,'orchestrator').nodes.main;assert.deepEqual([orchestrator.harness,orchestrator.model],['claude','claude-opus-5-5']);
 const planner=resolveProfile(root,'planner');assert.equal(planner.nodes[planner.nodes.main.children.socrates].model,'claude-opus-5-5');
 const codexPlanner=resolveProfile(root,'planner:codex');assert.equal(codexPlanner.nodes[codexPlanner.nodes.main.children.socrates].model,'gpt-6-astra');
});

test('planners leave implementation launches to the person',()=>{
 for(const profile of ['planner','planner:codex'])assert.equal(Object.hasOwn(resolveProfile(root,profile).nodes.main.children,'implementer'),false);
});

test('orchestrator accepts host guidance and planners accept coordinated handoffs',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-host-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const policy=path.join(target,'host.md'),source=path.join(target,'brief.html'),parent=path.join(target,'status.json');
 fs.writeFileSync(policy,'Use the host workspace and event tools.');
 fs.writeFileSync(source,'<h1>Task brief</h1>');
 for(const [profile,args] of [['orchestrator',[`host_policy=${policy}`]],['planner',[`source=${source}`,`parent=${parent}`]],['planner:codex',[`source=${source}`,`parent=${parent}`]]]){
  const bundle=build(root,profile,target);verify(bundle);
  const launch=command(bundle,'main',{prepare:false,args});
  assert.ok(launch.argv.length>0);
  for(const arg of args){const split=arg.indexOf("=");assert.equal(launch.launch.arguments[arg.slice(0,split)],arg.slice(split+1));}
  assert.throws(()=>command(bundle,'main',{prepare:false,args:['undeclared=bad']}),/undeclared|Unknown|unknown/);
 }
});


test('planners retain small-fix skills and the removed one-shot route cannot resolve',()=>{
 for(const profile of ['planner','planner:codex']){
  const main=resolveProfile(root,profile).nodes.main;
  for(const skill of ['tdd','codebase-design','verify-app','open-pr','session-trace'])assert.ok(main.skills.includes(skill),`${profile}: ${skill}`);
 }
 assert.equal(fs.existsSync(path.join(root,'profiles/one-shot.yaml')),false);
 assert.equal(fs.existsSync(path.join(root,'agents/one-shot.md')),false);
 assert.throws(()=>resolveProfile(root,'one-shot'));
});


test('Greenfield CLI arguments reach both harnesses and reject invalid profile inputs',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-cli-args-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const home=path.join(target,'home');fs.mkdirSync(home);
 const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
 const source='https://example.test/plan?revision=3&mode=review';
 const parent=path.join(target,'status files','task.json'),policy=path.join(target,'host guidance.md');
 const invoke=(profile,args)=>spawnSync(process.execPath,[cli,'run',profile,'--config-root',root,'--directory',target,'--no-workspace','--explain',...args.flatMap(a=>['--arg',a])],{encoding:'utf8',env:{...process.env,HOME:home,USERPROFILE:home,AGENT_FARM_TELEMETRY:'off'}});
 for(const [profile,args] of [['planner',[`source=${source}`,`parent=${parent}`]],['planner:codex',[`source=${source}`,`parent=${parent}`]],['orchestrator',[`host_policy=${policy}`]],['implementer',[`source=${source}`,`parent=${parent}`]],['implementer:fast',[`source=${source}`]],['implementer:claude',[`source=${source}`,`parent=${parent}`]]]){
  const result=invoke(profile,args);assert.equal(result.status,0,result.stderr);
  const launch=JSON.parse(result.stdout);
  const codex=launch.argv.find(v=>v.startsWith('developer_instructions='));
  const instructions=codex ? JSON.parse(codex.slice('developer_instructions='.length)) : launch.argv[launch.argv.indexOf('--append-system-prompt')+1];
  for(const pair of args){const i=pair.indexOf('='),key=pair.slice(0,i),value=pair.slice(i+1);assert.equal(launch.launch.arguments[key],value);assert.ok(instructions.includes(`${key}: ${value}`));}
  if(profile.startsWith('implementer')){
   assert.equal(launch.launch.arguments.review,'single');
   assert.equal(launch.launch.arguments.priority,profile==='implementer:fast'?'speed':'usage');
  }
 }
 for(const [profile,args,pattern] of [['planner',['review=single'],/does not declare argument review/],['orchestrator',['host_policy'],/malformed/],['implementer',['review=triple'],/invalid/]]){
  const result=invoke(profile,args);assert.equal(result.status,1);assert.match(result.stderr,pattern);
 }
});


test('planners retain Socrates without a separate plan-reviewer agent',()=>{
 assert.equal(fs.existsSync(path.join(root,'agents/plan-reviewer.md')),false);
 for(const profile of ['planner','planner:codex']){
  const resolved=resolveProfile(root,profile),children=resolved.nodes.main.children;
  assert.ok(children.socrates);
  assert.equal(resolved.nodes[children.socrates].mode,'native');
  assert.equal(Object.hasOwn(children,'plan-reviewer'),false);
 }
});
