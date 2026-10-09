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

test('the implementer is the former dcouple raw profile on Opus, Astra or Sol, with only an opt-in cross-vendor second-opinion reviewer',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-profile-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 validatePlugin(root);
 assert.equal(resolveProfile(root,'implementer').nodes.main.model,'claude-opus-5-5');
 for(const [profile,harness,model] of [['implementer:opus','claude','claude-opus-5-5'],['implementer:astra','codex','gpt-6-astra'],['implementer:sol','codex','gpt-6.1-sol']]){
  const resolved=resolveProfile(root,profile),main=resolved.nodes.main;
  assert.deepEqual([main.harness,main.model,main.reasoning_effort],[harness,model,'medium']);
  assert.deepEqual(Object.keys(main.children).sort(),['cold-reader','explorer','qa-and-verify','second-opinion']);
  const second=resolved.nodes[main.children['second-opinion']];
  assert.deepEqual([second.name,second.mode,second.harness,second.model],['pr-reviewer','process',...(harness==='claude'?['codex','gpt-6.1-sol']:['claude','claude-opus-5-5'])],profile);
  assert.ok(second.skills.includes('review'),profile);
  const prompt=fs.readFileSync(main.source_file,'utf8').replace(/\s+/g,' ');
  for(const rule of ['Use it only when you run standalone (no orchestrator) or when the person asks','Under an orchestrator, review stays with `greenfield/reviewer`'])assert.ok(prompt.includes(rule),`${profile}: ${rule}`);
  assert.equal(resolved.nodes[main.children['qa-and-verify']].name,'pr-qa');
  for(const skill of ['prepare-pr','babysit-pr','tdd','quick-verify','pr-test-automation','session-trace'])assert.ok(main.skills.includes(skill),`${profile}: ${skill}`);
  const bundle=build(root,profile,target);verify(bundle);
  const launch=command(bundle,'main',{prepare:false});
  assert.equal(launch.argv[launch.argv.indexOf('--model')+1],model);
 }
 for(const agent of ['raw-claude','raw-codex']){const text=fs.readFileSync(path.join(root,'agents',agent+'.md'),'utf8');assert.match(text,/By default, split the work into independent chunks/,agent);assert.match(text,/Work serially only when chunks share files/,agent);assert.match(text,/you, the parent, launch them/,agent);}
 for(const removed of ['agents/implementer.md','agents/implementer-claude.md','agents/reviewer.md','agents/frontend-verifier.md','instructions/implementer-identity.md','skills/work-packages','skills/build-package','skills/final-review'])assert.equal(fs.existsSync(path.join(root,removed)),false,removed);
});

test('the reviewer is the former dcouple reviewer, with its Codex variant on Sol 6.1 max and one reconciled COMMENT review under an orchestrator',()=>{
 const claude=resolveProfile(root,'reviewer').nodes.main,codex=resolveProfile(root,'reviewer:codex').nodes.main;
 assert.deepEqual([claude.harness,claude.model,claude.reasoning_effort],['claude','claude-opus-5-5','high']);
 assert.deepEqual([codex.harness,codex.model,codex.reasoning_effort],['codex','gpt-6.1-sol','max']);
 for(const agent of ['claude-pr-reviewer','codex-pr-reviewer']){
  const text=fs.readFileSync(path.join(root,'agents',agent+'.md'),'utf8');
  assert.match(text,/## Launched by an orchestrator/);assert.doesNotMatch(text,/dcouple/);
  const orchestrated=/## Launched by an orchestrator\n([\s\S]*?)\n## /.exec(text)[1];
  for(const phrase of [/exactly one review/,/event `COMMENT`/,/never approve or request changes/,/<!-- greenfield-review head=<sha> -->/,/earlier greenfield reviews/,/Apply no fixes/,/only the listed must-fix items/])assert.match(orchestrated,phrase,agent);
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
 for(const text of ['runpane panes create','greenfield/planner','greenfield/implementer','greenfield/reviewer:codex','one `COMMENT` review, no fixes','agent-farm inspect greenfield/<profile> --directory <repo>'])assert.ok(skill.includes(text),text);
 assert.deepEqual(Object.keys(resolveProfile(root,'orchestrator').nodes.main.children),['advisor']);
});

test('orchestrated reviewers post one COMMENT review and apply no fixes, and orchestrated cleanup, launches, traces and review policy keep their safeguards',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-safeguards-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const flat=text=>text.replace(/\s+/g,' ');
 for(const profile of ['reviewer:claude','reviewer:codex']){
  const launch=command(build(root,profile,target),'main',{prepare:false});
  const codex=launch.argv.find(v=>v.startsWith('developer_instructions='));
  const instructions=flat(codex ? JSON.parse(codex.slice('developer_instructions='.length)) : launch.argv[launch.argv.indexOf('--append-system-prompt')+1]);
  for(const rule of ['reconciled findings to that file','post exactly one review','event `COMMENT` (never approve or request changes)','Apply no fixes','checks only the listed must-fix items'])assert.ok(instructions.includes(rule),`${profile}: ${rule}`);
 }
 const skill=flat(fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8'));
 for(const rule of ['every agent in it has stopped','1 feature = 1 worktree = 1 branch = 1 Pane','panels create --pane <feature Pane id>','--wait-ready --yes --json','agent-farm run greenfield/<role>:<variant>','Always name the variant','`greenfield/implementer:opus`','whether it explicitly grants conversation capture','a personal fallback workspace grants nothing'])assert.ok(skill.includes(rule),rule);
 assert.doesNotMatch(skill,/\[:variant\]/);
 const trace=flat(fs.readFileSync(path.join(root,'skills/session-trace/SKILL.md'),'utf8'));
 for(const rule of ['Naming a document destination is not a grant','trace not authorized','--launch <ID>','`$CODEX_HOME` before `~/.codex`'])assert.ok(trace.includes(rule),rule);
 assert.doesNotMatch(trace,/workspace instructions authorize this capture/);
 const plan=flat(fs.readFileSync(path.join(root,'skills/plan/SKILL.md'),'utf8')),sheet=flat(fs.readFileSync(path.join(root,'skills/plan/references/cover-sheet.md'),'utf8'));
 assert.ok(plan.includes('Under an orchestrator, never skip on your own'));
 assert.ok(sheet.includes("Under an orchestrator, only the user's explicit word changes the review line"));
 const babysit=flat(fs.readFileSync(path.join(root,'skills/babysit-pr/SKILL.md'),'utf8'));
 for(const rule of ["Fix every finding within the PR's goal","don't dismiss an in-scope finding as out of scope",'capture it with `create-ticket`','reply on the thread with the link','When you decline a finding as wrong, reply with the reason'])assert.ok(babysit.includes(rule),rule);
});

test('simplify-and-refactor runs the refactor and principled-review skills on Sol by default or Opus, with a refactor child per analysis',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-refactor-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const variants=Object.keys(parse(fs.readFileSync(path.join(root,'profiles/simplify-and-refactor.yaml'),'utf8')).variants);
 assert.deepEqual(variants.sort(),['opus','sol']);
 assert.equal(resolveProfile(root,'simplify-and-refactor').nodes.main.model,'gpt-6.1-sol');
 for(const [profile,agent,harness,model,effort] of [['simplify-and-refactor:sol','simplify-and-refactor','codex','gpt-6.1-sol','low'],['simplify-and-refactor:opus','simplify-and-refactor-claude','claude','claude-opus-5-5','medium']]){
  const resolved=resolveProfile(root,profile),main=resolved.nodes.main;
  assert.deepEqual([main.name,main.harness,main.model,main.reasoning_effort],[agent,harness,model,effort],profile);
  assert.deepEqual([...main.skills].sort(),['principled-review','refactor','refactor-apply','refactor-deep','refactor-simple'],profile);
  assert.deepEqual(Object.keys(main.children).sort(),['cold-reader','refactor'],profile);
  const child=resolved.nodes[main.children.refactor];
  assert.deepEqual([child.name,child.mode,child.harness,child.model,child.reasoning_effort],['refactor','native',harness,model,effort],profile);
  assert.deepEqual([...child.skills].sort(),['refactor','refactor-apply','refactor-deep','refactor-simple'],profile);
  assert.ok(resolved.nodes[main.children['cold-reader']].skills.includes('cold-read'),profile);
  const launch=command(build(root,profile,target),'main',{prepare:false});
  assert.equal(launch.argv[launch.argv.indexOf('--model')+1],model);
 }
 const orchestrate=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8');
 for(const text of ['greenfield/simplify-and-refactor:sol','The simplify checkpoint is optional and off by default','it applies only on their approval'])assert.ok(orchestrate.includes(text),text);
 const refactor=fs.readFileSync(path.join(root,'skills/refactor/SKILL.md'),'utf8').replace(/\s+/g,' ');
 assert.ok(refactor.includes('run it before QA'));
 for(const agent of ['simplify-and-refactor','simplify-and-refactor-claude']){
  const text=fs.readFileSync(path.join(root,'agents',agent+'.md'),'utf8').replace(/\s+/g,' ');
  for(const rule of ['Analysis is read-only','only after the person approves the merged plan','no other worker is writing the branch','before QA'])assert.ok(text.includes(rule),`${agent}: ${rule}`);
 }
});

test('reviewers share principled-review with simplify-and-refactor, and both raw implementers can draw PR diagrams',()=>{
 for(const profile of ['reviewer:claude','reviewer:codex']){
  const main=resolveProfile(root,profile).nodes.main;
  for(const skill of ['principled-review','review','implementer','create-plan'])assert.ok(main.skills.includes(skill),`${profile}: ${skill}`);
  assert.doesNotMatch(fs.readFileSync(main.source_file,'utf8'),/implement skill/i,profile);
 }
 for(const profile of ['implementer:opus','implementer:astra','implementer:sol'])assert.ok(resolveProfile(root,profile).nodes.main.skills.includes('excalidraw-pr-diagrams'),profile);
});

test('the unused dcouple copies are gone and nothing in the plugin names them',()=>{
 for(const file of ['skills/implement','skills/implementation-reviewer','skills/plan-reviewer'])assert.equal(fs.existsSync(path.join(root,file)),false,file);
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 for(const file of walk(root))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/(?<![\w-])(implementation-reviewer|plan-reviewer)(?![\w-])|`implement`|implement skill/,path.relative(root,file));
});

// Agent Farm mounts only the skills an agent bundles, so a skill or agent that
// no profile reaches is dead weight, and a skill named in bundled text must be
// bundled by that agent or one of its children, or name one of its children. Each exception says why.
const unbundledMentions={
 'pr-test-automation -> cold-read':"orders the implementer's PR-body cold-read before QA; QA agents do not run it",
 'session-trace -> handoff':'names the page a handoff publishes, as an example of where a trace attaches',
 'session-trace -> prepare-pr':'names the page prepare-pr publishes, as an example of where a trace attaches',
 'orchestrate-sessions -> implementer':'names the greenfield/implementer profile, not the skill',
 'seo-data-pull -> plan':'names a person-level data property',
 'create-ticket -> ui-mockup':'offers a mockup only where the agent has ui-mockup',
 'create-ticket -> explain-visually':'offers a visual only where the agent has explain-visually',
 'babysit-pr -> create-ticket':"falls back to the PR's findings or handoff file where the agent cannot create tickets",
 'html-explainer -> excalidraw-pr-diagrams':'names editable diagrams as outside its scope',
 'refactor-apply -> prepare-pr':'names who owns the commit when the person runs it by hand',
 'refactor -> cold-read':'the parent runs the cold-read gate with its cold-reader child; a refactor child returns to it there',
 'principled-review -> review':"uses the review skill's context step where bundled, and otherwise reads the PR and issues itself",
 'refactor-simple -> refactor':'names the orchestrator that may run it; elsewhere it points to greenfield/simplify-and-refactor',
 'refactor-simple -> refactor-deep':'elsewhere it points to greenfield/simplify-and-refactor for the deep pass',
 'refactor-simple -> refactor-apply':'elsewhere it points to greenfield/simplify-and-refactor to apply a plan',
};

test('every Greenfield skill and agent is bundled by a profile, and every skill named in bundled text is bundled with it',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 const skills=fs.readdirSync(path.join(root,'skills')),agents=fs.readdirSync(path.join(root,'agents')).map(file=>file.replace(/\.md$/,''));
 const pattern=name=>{const n=name.replace(/-/g,'\\-');return new RegExp('`'+n+'`|(?<![\\w-])'+n+' skill|skill `?'+n+'(?![\\w-])|\\.\\./'+n+'/SKILL\\.md');};
 const skillText=Object.fromEntries(skills.map(skill=>[skill,walk(path.join(root,'skills',skill)).map(file=>fs.readFileSync(file,'utf8')).join('\n')]));
 const reachedSkills=new Set(),reachedAgents=new Set(),usedExceptions=new Set(),unresolved=new Set();
 for(const file of fs.readdirSync(path.join(root,'profiles'))){
  const name=file.replace(/\.yaml$/,''),variants=Object.keys(parse(fs.readFileSync(path.join(root,'profiles',file),'utf8')).variants??{});
  for(const profile of [name,...variants.map(variant=>name+':'+variant)]){
   const nodes=resolveProfile(root,profile).nodes;
   for(const node of Object.values(nodes)){
    reachedAgents.add(node.name);node.skills.forEach(skill=>reachedSkills.add(skill));
    const available=new Set([...node.skills,...Object.values(node.children).flatMap(child=>nodes[child].skills)]);
    const sources=[[node.name,fs.readFileSync(node.source_file,'utf8')],...node.skills.map(skill=>[skill,skillText[skill]])];
    for(const [source,text] of sources)for(const skill of skills){
     if(skill===source||available.has(skill)||Object.hasOwn(node.children,skill)||!pattern(skill).test(text))continue;
     const key=`${source} -> ${skill}`;
     if(Object.hasOwn(unbundledMentions,key))usedExceptions.add(key);else unresolved.add(`${profile} (${node.name}): ${key}`);
    }
   }
  }
 }
 assert.deepEqual(skills.filter(skill=>!reachedSkills.has(skill)),[]);
 assert.deepEqual(agents.filter(agent=>!reachedAgents.has(agent)),[]);
 assert.deepEqual([...unresolved],[]);
 assert.deepEqual(Object.keys(unbundledMentions).filter(key=>!usedExceptions.has(key)),[],'stale exception');
 assert.match(skillText['refactor-simple'],/greenfield\/simplify-and-refactor/);
});

test('code-smell-fixes runs on Sonnet 5.5 low with a native Claude finder and a Sol process finder sharing its lenses',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-smell-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const resolved=resolveProfile(root,'code-smell-fixes'),main=resolved.nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['claude','claude-sonnet-5-5','low']);
 assert.deepEqual(main.launch.arguments,{lenses:'all',area:'all',mode:'prs'});
 const finders=Object.fromEntries(Object.entries(main.children).map(([alias,route])=>{const n=resolved.nodes[route];return [alias,[n.name,n.mode,n.harness,n.model,n.reasoning_effort,n.skills.includes('smell-finder')]];}));
 assert.deepEqual(finders,{finder:['smell-finder','native','claude','claude-sonnet-5-5','low',true],'codex-finder':['smell-finder','process','codex','gpt-6.1-sol','low',true]});
 const bundle=build(root,'code-smell-fixes',target);verify(bundle);
 assert.ok(fs.existsSync(path.join(bundle,'main','dispatch','codex-finder')));
 assert.ok(fs.existsSync(path.join(bundle,'main','native-agents','finder.json')));
});
