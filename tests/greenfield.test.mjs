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
  for(const skill of ['tdd','codebase-design','verify-app','prepare-pr','session-trace'])assert.ok(main.skills.includes(skill),`${profile}: ${skill}`);
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
  assert.deepEqual([...main.skills].sort(),['excalidraw-pr-diagrams','prepare-pr','principled-review','refactor'],profile);
  assert.deepEqual(Object.keys(main.children).sort(),['cold-reader','refactor'],profile);
  const child=resolved.nodes[main.children.refactor];
  assert.deepEqual([child.name,child.mode,child.harness,child.model,child.reasoning_effort],['refactor','native',harness,model,effort],profile);
  assert.deepEqual([...child.skills].sort(),['refactor'],profile);
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

test('reviewers share principled-review with simplify-and-refactor and leave fixes to an implementer, and both raw implementers can draw PR diagrams',()=>{
 for(const profile of ['reviewer:claude','reviewer:codex']){
  const main=resolveProfile(root,profile).nodes.main;
  assert.deepEqual(main.skills.sort(),['pr-test-automation','principled-review','review'],profile);
  assert.match(fs.readFileSync(main.source_file,'utf8').replace(/\s+/g,' '),/You review; an implementer fixes\. To fix them, suggest launching `greenfield\/implementer` with that file/,profile);
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
 'prepare-pr -> session-trace':'attaches a trace only when session-trace is installed',
 'seo-data-pull -> plan':'names a person-level data property',
 'create-ticket -> ui-mockup':'offers a mockup only where the agent has ui-mockup',
 'create-ticket -> explain-visually':'offers a visual only where the agent has explain-visually',
 'babysit-pr -> create-ticket':"falls back to the PR's findings or handoff file where the agent cannot create tickets",
 'html-explainer -> excalidraw-pr-diagrams':'names editable diagrams as outside its scope',
 'refactor -> cold-read':'the parent runs the cold-read gate with its cold-reader child; a refactor child returns to it there',
 'principled-review -> review':"uses the review skill's context step where bundled, and otherwise reads the PR and issues itself",
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
});

const withoutStandingRules={
 'ui-polish':"runs prepare-pr for its PR format; prepare-pr's one pointer to the standing rules names the implementer's last step, which ui-polish's own done line replaces",
};

test('every agent whose own text or skills point to the standing rules loads them',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 const skillText=skill=>walk(path.join(root,'skills',skill)).map(file=>fs.readFileSync(file,'utf8')).join('\n');
 const missing=new Set();
 for(const file of fs.readdirSync(path.join(root,'profiles'))){
  const name=file.replace(/\.yaml$/,''),variants=Object.keys(parse(fs.readFileSync(path.join(root,'profiles',file),'utf8')).variants??{});
  for(const profile of [name,...variants.map(variant=>name+':'+variant)])for(const node of Object.values(resolveProfile(root,profile).nodes)){
   const text=[fs.readFileSync(node.source_file,'utf8'),...node.skills.map(skillText)].join('\n');
   if(/standing rules/i.test(text)&&!node.instructions?.includes('# Standing rules')&&!Object.hasOwn(withoutStandingRules,node.name))missing.add(node.name);
  }
 }
 assert.deepEqual([...missing],[]);
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

test('Codex orchestration routes every worker and helper to Codex while retaining Claude defaults',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-codex-orchestrator-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 validatePlugin(root);
 const resolved=resolveProfile(root,'orchestrator:codex'),main=resolved.nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['codex','gpt-6-astra','high']);
 const advisor=resolved.nodes[main.children.advisor];
 assert.deepEqual([advisor.mode,advisor.harness,advisor.model,advisor.reasoning_effort],['process','codex','gpt-6-astra','high']);
 const workers=['bug-reporter:codex','planner:codex','implementer:codex','reviewer:codex','qa-and-fix:codex','simplify-and-refactor:sol'];
 for(const profile of workers){
  assert.ok(main.instructions.includes('greenfield/'+profile),profile);
  const worker=resolveProfile(root,profile);
  // The reviewer's checker runs on the other vendor by design (D-57); every other helper stays on Codex.
  for(const node of Object.values(worker.nodes))assert.equal(node.harness,profile==='reviewer:codex'&&node.name==='review-checker'?'claude':'codex',`${profile}: ${node.name}`);
  verify(build(root,profile,target));
 }
 const implementer=resolveProfile(root,'implementer:codex');
 assert.deepEqual([implementer.nodes.main.model,implementer.nodes.main.reasoning_effort],['gpt-6.1-sol','medium']);
 const second=implementer.nodes[implementer.nodes.main.children['second-opinion']];
 assert.deepEqual([second.mode,second.harness,second.model,second.reasoning_effort],['process','codex','gpt-6.1-sol','low']);
 const bug=resolveProfile(root,'bug-reporter:codex');
 for(const [alias,effort] of [['investigator','high'],['qa','medium']]){
  const child=bug.nodes[bug.nodes.main.children[alias]];
  assert.deepEqual([child.mode,child.model,child.reasoning_effort],['native','gpt-6.1-sol',effort]);
 }
 for(const profile of ['orchestrator','orchestrator:claude','bug-reporter','bug-reporter:claude','implementer'])assert.equal(resolveProfile(root,profile).nodes.main.harness,'claude',profile);
 assert.match(main.instructions,/Preserve explicit user model overrides/);
 const launch=command(build(root,'orchestrator:codex',target),'main',{prepare:false});
 assert.equal(launch.argv[launch.argv.indexOf('--model')+1],'gpt-6-astra');
 assert.ok(main.skills.includes('orchestrate-sessions'));
 const skill=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8');
 assert.match(skill,/Use the orchestrator agent's worker routing defaults/);
});

const flatText=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\s+/g,' ');
const ORCHESTRATORS=['agents/orchestrator.md','agents/orchestrator-codex.md'];
const REVIEWERS=['agents/claude-pr-reviewer.md','agents/codex-pr-reviewer.md'];
const IMPLEMENTERS=['agents/raw-claude.md','agents/raw-codex.md','agents/implementer-codex.md'];
const includesAll=(files,rules)=>{for(const file of files){const text=flatText(file);for(const rule of rules)assert.ok(text.includes(rule),`${file}: ${rule}`);}};

test('workers raise numbered needs_you blocks, standalone workers ask in the same shape, and both orchestrators relay them',()=>{
 const rules=flatText('instructions/standing-rules.md');
 for(const rule of ['## Questions for the person','"needs_you": null','"needs_you": { "id": "Q-3", "kind": "question | choice | approval | fyi"','"files": [','"blocking": true','`answer: Q-n → <answer>. Recorded as D-n.`','`clarify: Q-n → <their question>` is not an answer: keep Q-n open','(`AskUserQuestion`)','wherever there is no question tool, a numbered list (`Files: <paths>`','`Why: <why>`','recommended one first and marked `(recommended)`','Q-n are unique per Session and never reused'])assert.ok(rules.includes(rule),rule);
 assert.doesNotMatch(rules,/"question": null/);
 for(const profile of ['planner:claude','planner:codex','implementer:opus','implementer:astra','implementer:sol','implementer:codex','orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.instructions.includes('## Questions for the person'),profile);
 includesAll(ORCHESTRATORS,['numbered `needs_you` blocks','labelled with its role and feature and with its files opened beside the person','send it to the asking tab only']);
 includesAll(IMPLEMENTERS,['goes in that status file as a `needs_you` block; run by hand, ask the person directly in the same shape']);
 includesAll(['instructions/planner-identity.md'],['Raise each question for the person as a `needs_you`','record each `answer:` as its D-n']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['[references/relay.md](references/relay.md)','`[Needs you · <role> · <feature>]`','to the asking tab only']);
 includesAll(['skills/orchestrate-sessions/references/relay.md'],['newest blocking question first','open them without asking','Recorded as D-n.` Nobody else gets it','even when you can answer it yourself','Q-n stays open and nothing is recorded','(raised as Q-3)']);
});

test('the map leads with Needs you and shows each PR\'s validation and unreviewed commits, and the watcher is unchanged',()=>{
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['Needs you the first section','Q-n | feature | role | question | recommended answer | files','checks (required CI: green, failing or pending) | QA (passed, failed, not run) | review','"N commits since the last review at <sha>, not reviewed"','git rev-list --count <last reviewed head>..<PR head>','`<!-- greenfield-review head=<sha> -->` marker']);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"last_reviewed_head"']);
 includesAll(ORCHESTRATORS,['Needs you first, then each PR\'s checks, QA, review state and commits since its last review','relaying any `needs_you` a wake-up finds the same way as one an event brings']);
 const skill=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8');
 for(const line of ['schedule:         3 checks each at 5, 10, 15, then 30 minutes; after 3 quiet 30-minute checks, expire','on start:         fire one test wake-up in the background','on dispatch:      start a fresh watcher at 5 minutes (or reset the running one to 5)','whenever active:  if the last wake-up is more than one interval overdue, tell the user the watcher failed, then restart it','a new needs_you is relayed as Questions and resumption says, files opened','"Set up a watcher? I\'ll check in at 5 minutes, slow down while nothing changes, and tell you only when something does." Start it unless the user says no'])assert.ok(skill.includes(line),line);
});

test('reviewers size every review with the bundled script, run security and PHI always, and have one checker on the other vendor',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-review-pipeline-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 for(const [profile,vendor,model] of [['reviewer:claude','codex','gpt-6.1-sol'],['reviewer:codex','claude','claude-opus-5-5']]){
  const resolved=resolveProfile(root,profile),main=resolved.nodes.main,checker=resolved.nodes[main.children.checker];
  assert.deepEqual([checker.name,checker.mode,checker.harness,checker.model,checker.reasoning_effort],['review-checker','process',vendor,model,'medium'],profile);
  assert.notEqual(checker.harness,main.harness,profile);
  const bundle=build(root,profile,target);verify(bundle);
  const script=fs.readdirSync(bundle,{recursive:true}).find(file=>String(file).endsWith(path.join('review','scripts','review-size.mjs')));
  assert.ok(script,`${profile} bundles review-size.mjs`);
 }
 includesAll(REVIEWERS,['and run the principles for that size, with principle 13 (security and PHI) on every review','Send every Must-Fix and Should-Fix to `checker` in one call, on the other vendor','`Size: … because …` line','`Scope:` and `Approach/scope:` line']);
 includesAll(['skills/review/SKILL.md'],['scripts/review-size.mjs','Never lower it.','make **one** call to the `checker` subagent','Never send the finders\' reasoning','Codex for `greenfield/reviewer:claude`, Claude for `greenfield/reviewer:codex`','Mark each `Checked by: same vendor (<why the checker could not run>)`','node <checker launcher> --message "$(cat "$brief_file")" < /dev/null','**Size:** [small|standard|large] because','Scope: in | out ([why]) · Approach/scope: no | yes','Source: [where the value comes from] → Sink: [where it ends up] → Missing control:']);
 includesAll(['skills/principled-review/SKILL.md'],['| small | 4, 5 and 13;','Principle 13 (security and PHI) runs at every size','### Principle 13: Security Boundaries & PHI','missing control redaction','### Principle 9: Query, Data & Hot-Path Cost','names the hot path, the scale and an estimate']);
 includesAll(['skills/review/CRITERIA.md'],['any PHI exposure','## 7. Routing','keep the one that sends the finding to the person']);
 includesAll(['agents/review-checker.md'],['start from the claim that it is wrong','one candidate\'s verdict never decides another\'s','You are read-only']);
 assert.equal(resolveProfile(root,'orchestrator').nodes.main.instructions.includes('review-size'),false,'the orchestrator never sizes');
});

test('reviews start on ready, a plan\'s end or a cleared human review, never on tweaks, and findings route by scope with a thrash pause',()=>{
 const skill=flatText('skills/orchestrate-sessions/SKILL.md');
 for(const rule of ['A review starts on one of three triggers, and never on a tweak or a quick fix','**"ready".**','**A plan\'s end.**','**Human review: required.**','`<last reviewed head>...HEAD`','The reviewer sizes the range itself','No reviewer starts, and the PR\'s lane shows its unreviewed commits','Never mark a PR ready, or say it can merge, while it has commits since its last review','The end-of-Session sweep','## After a review','| Approach/scope: yes, at any level | the person, never the implementer','| Must-Fix, not flagged | the PR\'s implementer, with no question |','| Should-Fix, scope out | the person: re-plan it as follow-up work, fix it here anyway, or accept it |','checks only the F-n it was sent','an F-n is still open after two fix rounds','a third fix round would start','more fix rounds (how many), re-plan, or accept as is'])assert.ok(skill.includes(rule),rule);
 assert.doesNotMatch(skill,/Fix the N must-fix items now|end-of-Session pass/);
 includesAll(ORCHESTRATORS,['Tweaks and quick fixes start no reviewer','Never say a PR can merge while it has unreviewed commits','in-scope Must-Fix and Should-Fix go to the PR\'s implementer with no question','the loop pauses on the thrash rule']);
 for(const file of ORCHESTRATORS)assert.doesNotMatch(flatText(file),/fix now \(recommended\)|end-of-Session pass/,file);
 includesAll(IMPLEMENTERS,['quick-verified, with screenshots of each changed screen when it is visual','start no reviewer for it']);
 includesAll(['instructions/standing-rules.md'],['CI, QA and review wait until the person says "ready"','"Ready" runs `full` on the same branch']);
 includesAll(['skills/plan/SKILL.md'],['`Review: at the plan\'s end · Human review: none`','Default to `required` when the plan changes UI']);
 includesAll(['skills/plan/references/cover-sheet.md'],['Human review: required | none']);
});

test('reviews check a cover sheet\'s criteria against their evidence, and implementers update docs in the same commit',()=>{
 includesAll(['skills/review/SKILL.md'],['### Read the cover sheet','**How we will know it works**','open the evidence it names','record the criterion as supported, when the evidence shows its outcome, or unsupported','An unsupported claim is a Should-Fix, and a Must-Fix when the behaviour is in fact broken','[J-n / check from the cover sheet] - supported']);
 includesAll(REVIEWERS,['the cover sheet when there is one; check the plan\'s criteria against their evidence under Claims']);
 includesAll(IMPLEMENTERS,['A commit that changes what a doc states (a command, flag, config key, env var, path, default, API or UI copy) updates every doc that states it, in the same commit.']);
 includesAll(['skills/principled-review/SKILL.md'],['flag each doc still stating the old value']);
});

test('greenfield 0.0.34 documents the relay, the map, sized and cross-checked reviews, and review on ready',()=>{
 assert.match(fs.readFileSync(path.join(root,'plugin.yaml'),'utf8'),/^version: 0\.0\.34$/m);
 includesAll(['README.md'],['numbered `needs_you` block','"N commits since the last review at <sha>"','`review-size.mjs`','Principle 13 (security and PHI) runs on every review','One batched `checker` call on the other vendor','a quick fix or tweaked PR is reviewed when you say it is "ready"','`Human review: required`','| `checker` (agent `review-checker`) | reviewer |']);
 includesAll(['index.html'],['sized, after CI and QA','has the other vendor confirm what to fix']);
 for(const file of ['README.md','index.html'])assert.doesNotMatch(flatText(file),/end-of-Session pass|once per workstream/,file);
});

test('review-final fixes: previews the orchestrator opens, the supplied range reaches every finder, and follow-ups catch fix-caused regressions',()=>{
 includesAll(['instructions/standing-rules.md'],['An orchestrator opens three things beside the person without asking first','the files of a question it relays, a PR waiting on their human review, and the screenshots of a visual tweak']);
 includesAll(['skills/principled-review/SKILL.md'],['When the caller supplies one','use it as `DIFF_RANGE` exactly and skip the base detection below']);
 includesAll(REVIEWERS,['pass that same range to principled-review as its `DIFF_RANGE` for every finder','a new Must-Fix in the lines that fix round changed','marked `fix-caused`']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['plus any new Must-Fix in the lines that fix round changed, which it marks `fix-caused`']);
});

test('planned work always validates full and then reviews on its own; deferred and ready are for quick fixes and tweaks (D-65)',()=>{
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['A planned feature\'s implementer always runs `full` when its build is done','it needs no "ready"','an implementer building an approved plan always runs `full`','`deferred` and "ready" apply only to quick fixes and tweaks']);
 includesAll(['instructions/standing-rules.md'],['Building an approved plan is always `full`','`deferred` and "ready" apply only to quick fixes and tweaks']);
 includesAll(ORCHESTRATORS,['`full` for an approved plan, and `deferred` by default for quick fixes and tweaks','reports done after its `full` validation']);
 includesAll(['skills/plan/SKILL.md'],['the implementer runs full validation (CI and QA) when the build is done, then `greenfield/reviewer` reviews the PR on its own']);
 includesAll(['README.md'],['A planned feature\'s implementer always runs full validation (CI, QA) when its build is done','Quick fixes and tweaks run `deferred` by default']);
});
