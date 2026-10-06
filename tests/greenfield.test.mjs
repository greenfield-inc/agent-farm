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

test('the implementer is the former dcouple raw profile on Opus, Astra or Sol, without a reviewer child',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-profile-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 validatePlugin(root);
 assert.equal(resolveProfile(root,'implementer').nodes.main.model,'claude-opus-5-5');
 for(const [profile,harness,model] of [['implementer:opus','claude','claude-opus-5-5'],['implementer:astra','codex','gpt-6-astra'],['implementer:sol','codex','gpt-6.1-sol']]){
  const resolved=resolveProfile(root,profile),main=resolved.nodes.main;
  assert.deepEqual([main.harness,main.model,main.reasoning_effort],[harness,model,'medium']);
  assert.deepEqual(Object.keys(main.children).sort(),['cold-reader','explorer','qa-and-verify']);
  assert.equal(resolved.nodes[main.children['qa-and-verify']].name,'pr-qa');
  for(const skill of ['prepare-pr','babysit-pr','tdd','quick-verify','pr-test-automation','session-trace'])assert.ok(main.skills.includes(skill),`${profile}: ${skill}`);
  const bundle=build(root,profile,target);verify(bundle);
  const launch=command(bundle,'main',{prepare:false});
  assert.equal(launch.argv[launch.argv.indexOf('--model')+1],model);
 }
 for(const removed of ['agents/implementer.md','agents/implementer-claude.md','agents/reviewer.md','agents/frontend-verifier.md','instructions/implementer-identity.md','skills/work-packages','skills/build-package','skills/final-review'])assert.equal(fs.existsSync(path.join(root,removed)),false,removed);
});

test('the reviewer is the former dcouple reviewer, with its Codex variant on Sol 6.1 max and an orchestrated report-only mode',()=>{
 const claude=resolveProfile(root,'reviewer').nodes.main,codex=resolveProfile(root,'reviewer:codex').nodes.main;
 assert.deepEqual([claude.harness,claude.model,claude.reasoning_effort],['claude','claude-opus-5-5','high']);
 assert.deepEqual([codex.harness,codex.model,codex.reasoning_effort],['codex','gpt-6.1-sol','max']);
 for(const agent of ['claude-pr-reviewer','codex-pr-reviewer']){
  const text=fs.readFileSync(path.join(root,'agents',agent+'.md'),'utf8');
  assert.match(text,/## Launched by an orchestrator/);assert.doesNotMatch(text,/dcouple/);
 }
});

test('profiles moved from dcouple resolve from greenfield, and the dropped ones do not',()=>{
 for(const profile of ['audits','business','product-researcher','qa-and-fix','reviewer','seo','implementer'])assert.ok(resolveProfile(root,profile).nodes.main);
 for(const profile of ['ideate','pipeline','raw'])assert.throws(()=>resolveProfile(root,profile));
 const qa=resolveProfile(root,'qa-and-fix'),bug=resolveProfile(root,'bug-reporter');
 assert.equal(bug.nodes[bug.nodes.main.children.qa].name,'qa');
 assert.ok(qa.nodes.main.skills.includes('pr-test-automation'));
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
 for(const name of ['investigator','researcher'])assert.deepEqual(summary(child('planner:codex',name)),['native','codex','gpt-6.1-sol','max']);
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
 for(const [profile,args] of [['planner',[`source=${source}`,`parent=${parent}`]],['planner:codex',[`source=${source}`,`parent=${parent}`]],['orchestrator',[`host_policy=${policy}`]]]){
  const result=invoke(profile,args);assert.equal(result.status,0,result.stderr);
  const launch=JSON.parse(result.stdout);
  const codex=launch.argv.find(v=>v.startsWith('developer_instructions='));
  const instructions=codex ? JSON.parse(codex.slice('developer_instructions='.length)) : launch.argv[launch.argv.indexOf('--append-system-prompt')+1];
  for(const pair of args){const i=pair.indexOf('='),key=pair.slice(0,i),value=pair.slice(i+1);assert.equal(launch.launch.arguments[key],value);assert.ok(instructions.includes(`${key}: ${value}`));}
 }
 for(const [profile,args,pattern] of [['planner',['review=single'],/does not declare argument review/],['orchestrator',['host_policy'],/malformed/]]){
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

test('the plugin stays tool-neutral: no agent, skill, profile or instruction names Grain',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 for(const folder of ['agents','skills','profiles','instructions'])for(const file of walk(path.join(root,folder)))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/grain/i,path.relative(root,file));
});

test('the orchestrator routes planner, implementer and end-of-workstream reviewer through Pane, with safe cleanup',()=>{
 const skill=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8');
 for(const text of ['runpane panes create','greenfield/planner','greenfield/implementer','greenfield/reviewer:codex','report only','--dry-run','Never pass `--force`','agent-farm inspect greenfield/<profile> --directory <repo>'])assert.ok(skill.includes(text),text);
 assert.deepEqual(Object.keys(resolveProfile(root,'orchestrator').nodes.main.children),['advisor']);
});

test('orchestrated reviewers stay report-only, and orchestrated cleanup, launches, traces and review policy keep their safeguards',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-safeguards-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const flat=text=>text.replace(/\s+/g,' ');
 for(const profile of ['reviewer:claude','reviewer:codex']){
  const launch=command(build(root,profile,target),'main',{prepare:false});
  const codex=launch.argv.find(v=>v.startsWith('developer_instructions='));
  const instructions=flat(codex ? JSON.parse(codex.slice('developer_instructions='.length)) : launch.argv[launch.argv.indexOf('--append-system-prompt')+1]);
  for(const rule of ['write the reconciled findings to that file','Do not post a GitHub review unless the message asks for one','do not plan or apply fixes','check only the listed must-fix items'])assert.ok(instructions.includes(rule),`${profile}: ${rule}`);
 }
 const skill=flat(fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8'));
 for(const rule of ['the worker has stopped','Archive only when Pane reports the worktree clean and pushed or merged','Never pass `--force`','If Pane refuses, keep the Pane','deleting remote branches is ask-first','agent-farm run greenfield/<role>:<variant>','Always name the variant','`greenfield/implementer:opus`','whether it explicitly grants conversation capture','a personal fallback workspace grants nothing'])assert.ok(skill.includes(rule),rule);
 assert.doesNotMatch(skill,/\[:variant\]/);
 const trace=flat(fs.readFileSync(path.join(root,'skills/session-trace/SKILL.md'),'utf8'));
 for(const rule of ['Naming a document destination is not a grant','trace not authorized','--launch <ID>','`$CODEX_HOME` before `~/.codex`'])assert.ok(trace.includes(rule),rule);
 assert.doesNotMatch(trace,/workspace instructions authorize this capture/);
 const plan=flat(fs.readFileSync(path.join(root,'skills/plan/SKILL.md'),'utf8')),sheet=flat(fs.readFileSync(path.join(root,'skills/plan/references/cover-sheet.md'),'utf8'));
 assert.ok(plan.includes('Under an orchestrator, never skip on your own'));
 assert.ok(sheet.includes("Under an orchestrator, only the user's explicit word changes the review line"));
});
