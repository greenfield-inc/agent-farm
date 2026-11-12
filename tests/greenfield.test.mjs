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
  for(const phrase of [/exactly one review/,/event `COMMENT`/,/never approve or request changes/,/<!-- greenfield-review head=<sha> -->/,/earlier greenfield reviews/,/Apply no fixes/,/checks only the findings it was sent and the lines that fix round\s+changed/,/Noticed, not raised/,/--remerge-diff/,/Mergeable as is: yes \| no/])assert.match(orchestrated,phrase,agent);
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

test('the plugin stays tool-neutral: only one orchestrate-sessions paragraph names Grain (D-71, D-74)',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 const skill=path.join(root,'skills','orchestrate-sessions','SKILL.md');
 for(const folder of ['agents','skills','profiles','instructions'])for(const file of walk(path.join(root,folder)))if(file!==skill)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/grain/i,path.relative(root,file));
 const naming=fs.readFileSync(skill,'utf8').split(/\n\s*\n/).filter(paragraph=>/grain/i.test(paragraph));
 assert.equal(naming.length,1,'exactly one paragraph names Grain');
 assert.match(naming[0],/^\*\*Grain\.\*\* When the resolved destination is Grain/);
 for(const rule of ['one private Grain artifact','`runpane panels open --url','open the local copy as a `file://` URL instead','Never ask the person to set up Grain'])assert.ok(naming[0].replace(/\s+/g,' ').includes(rule),rule);
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
  for(const rule of ['reconciled findings to that file','post exactly one review','event `COMMENT` (never approve or request changes)','Apply no fixes','checks only the findings it was sent and the lines that fix round changed'])assert.ok(instructions.includes(rule),`${profile}: ${rule}`);
 }
 const skill=flat(fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8'));
 for(const rule of ['no agent in it is working','1 feature = 1 worktree = 1 branch = 1 Pane','panels create --pane <feature Pane id>','--wait-ready --yes --json','agent-farm run greenfield/<role>:<variant>','Always name the variant','`greenfield/implementer:opus`','whether it explicitly grants conversation capture','a personal fallback workspace grants nothing'])assert.ok(skill.includes(rule),rule);
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
  assert.deepEqual([...main.skills].sort(),['excalidraw-pr-diagrams','page','prepare-pr','principled-review','refactor','session-trace'],profile);
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
 'seo-data-pull -> plan':'names a person-level data property',
 'create-ticket -> ui-mockup':'offers a mockup only where the agent has ui-mockup',
 'create-ticket -> explain-visually':'offers a visual only where the agent has explain-visually',
 'babysit-pr -> create-ticket':"falls back to the PR's findings or handoff file where the agent cannot create tickets",
 'html-explainer -> excalidraw-pr-diagrams':'names editable diagrams as outside its scope',
 'refactor -> cold-read':'the parent runs the cold-read gate with its cold-reader child; a refactor child returns to it there',
 'principled-review -> review':"uses the review skill's context step where bundled, and otherwise reads the PR and issues itself",
 'research-and-product-design -> ui-mockup':'the orchestrator runs several features through it; the feature agents it launches draw the UI rounds with ui-mockup',
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
  for(const node of Object.values(worker.nodes))assert.equal(node.harness,'codex',`${profile}: ${node.name}`);
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

test('customer-insights-loop runs Opus 5.5 medium on Claude only, coordinates with the orchestrator\'s shared rules, and names no product, host or person',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-insights-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 assert.deepEqual(Object.keys(parse(fs.readFileSync(path.join(root,'profiles/customer-insights-loop.yaml'),'utf8')).variants),['claude']);
 const main=resolveProfile(root,'customer-insights-loop').nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['claude','claude-opus-5-5','medium']);
 for(const skill of ['customer-insights-loop','orchestrate-sessions','interview','swarm','ui-mockup','page'])assert.ok(main.skills.includes(skill),skill);
 assert.deepEqual(Object.keys(main.children).sort(),['advisor','investigator','researcher']);
 for(const profile of ['customer-insights-loop','orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.instructions.includes('# Coordination'),profile);
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 for(const file of [...walk(path.join(root,'skills/customer-insights-loop')),path.join(root,'agents/customer-insights-loop.md')])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/\b(pane|runpane|posthog|hogql|grain|parsa)\b/i,path.relative(root,file));
 includesAll(['skills/customer-insights-loop/SKILL.md'],['Before stage 1, ask how hands-on the person wants to be','record the answer in the ledger as `autonomy`','With no answer, wait']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['set concurrency to what free disk and machine load allow','relaunch that review on `greenfield/reviewer:claude` and note the swap on the PR\'s card']);
 verify(build(root,'customer-insights-loop',target));
});

const flatText=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\s+/g,' ');
const COORDINATORS=['orchestrator:claude','orchestrator:codex','customer-insights-loop'];
const instructionsIncludeAll=(profiles,rules)=>{for(const profile of profiles){const text=resolveProfile(root,profile).nodes.main.instructions.replace(/\s+/g,' ');for(const rule of rules)assert.ok(text.includes(rule),`${profile}: ${rule}`);}};
const REVIEWERS=['agents/claude-pr-reviewer.md','agents/codex-pr-reviewer.md'];
const IMPLEMENTERS=['agents/raw-claude.md','agents/raw-codex.md','agents/implementer-codex.md'];
const includesAll=(files,rules)=>{for(const file of files){const text=flatText(file);for(const rule of rules)assert.ok(text.includes(rule),`${file}: ${rule}`);}};

test('workers raise numbered needs_you blocks, standalone workers ask in the same shape, and both orchestrators relay them',()=>{
 const rules=flatText('instructions/standing-rules.md');
 for(const rule of ['## Questions for the person','"needs_you": null','"needs_you": { "id": "Q-3", "kind": "question | choice | approval | fyi"','"files": [','"blocking": true','`answer: Q-n → <answer>. Recorded as D-n.`','`clarify: Q-n → <their question>` is not an answer: keep Q-n open','(`AskUserQuestion`)','wherever there is no question tool, a numbered list (`Files: <paths>`','`Why: <why>`','recommended one first and marked `(recommended)`','Q-n are unique per Session and never reused','Write the block with `"id": null` and `"asked": "notify"`','call `notify` again with `resume`; that is never a reason to relay','`recorded: Q-n → <answer>. Recorded as D-n.` to your tab only','When `notify` returns `unavailable`, set `asked` to `"relay"`','every non-blocking question, which never becomes a card','**In a Pane Session, the one blocked report is the card.**','Write the block with `"asked": "relay"` and its Q-n (the one the orchestrator assigned, else the next free one), then send one blocked report and call no `notify`','Pass both as literal arguments: through an argv API','each value in single quotes and each `\'` inside it escaped for that shell: `\'\\\'\'` in a POSIX shell (sh, bash, zsh), `\'\'` in PowerShell','Never put question or step text inside double quotes or unquoted','`runpane report --state blocked --question \'Q-3: Use the invoice id or number in the PDF filename? (Invoice id (recommended) / Invoice number)\' --summary \'Invoice PDFs\'`','Never pass the status file as `--summary` or `--summary-file`','**Inside Pane outside a Pane Session, a blocking question goes through Notify.**'])assert.ok(rules.includes(rule),rule);
 assert.doesNotMatch(rules,/"question": null/);
 for(const profile of ['planner:claude','planner:codex','implementer:opus','implementer:astra','implementer:sol','implementer:codex','orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.instructions.includes('## Questions for the person'),profile);
 instructionsIncludeAll(COORDINATORS,['numbered `needs_you` blocks','labelled with its role and feature and with its files opened beside the person','send it to the asking tab only']);
 includesAll(IMPLEMENTERS,['goes in that status file as a `needs_you` block; run by hand, ask the person directly in the same shape']);
 includesAll(['instructions/planner-identity.md'],['Raise each question for the person as a `needs_you`','record each `answer:` or `recorded:` line\'s D-n']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['[references/relay.md](references/relay.md)','`[Needs you · <role> · <feature>]`','to the asking tab only']);
 includesAll(['skills/orchestrate-sessions/references/relay.md'],['newest blocking question first','open them without asking','Recorded as D-n.` Nobody else gets it','even when you can answer it yourself','Q-n stays open and nothing is recorded','(raised as Q-3)','Never relay it while its card is live','`recorded: Q-n → <answer>. Recorded as D-n.`','in any state other than `blocked` on two checks at least a minute apart','Never put the same question to the person a second way: relay that card with `runpane notify --relays <item>`','`runpane inbox ack <item> --decision <D-n>`']);
});

test('the map links Notify questions to the asking tab and shows each PR\'s validation and unreviewed commits, and the watcher is unchanged',()=>{
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['Never write the page\'s HTML by hand','give `id: null`, and the page shows it as "a new question"','`pane://open?pane=<pane id>&panel=<panel id>` of the tab that holds its card','the asking worker\'s for a question asked through Notify','Outside Pane, give no `link`','validation still pending, from the ledger\'s `validation`','"N commits since the last review at <sha>, not reviewed"','git rev-list --count <last reviewed head>..<PR head>','`<!-- greenfield-review head=<sha> -->` marker']);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"last_reviewed_head"']);
 instructionsIncludeAll(COORDINATORS,['relaying any `needs_you` a wake-up finds the same way as one an event brings']);
 const skill=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8');
 for(const line of ['schedule:         3 checks each at 5, 10, 15, then 30 minutes; after 3 quiet 30-minute checks, expire','on start:         fire one test wake-up in the background','on dispatch:      start a fresh watcher at 5 minutes (or reset the running one to 5)','whenever active:  if the last wake-up is more than one interval overdue, tell the user the watcher failed, then restart it','a new needs_you is relayed as Questions and resumption says, files opened','"Set up a watcher? I\'ll check in at 5 minutes, slow down while nothing changes, and tell you only when something does." Start it unless the user says no'])assert.ok(skill.includes(line),line);
});

test('reviewers size every review with the bundled script, run security and PHI always, and have the lead verify each finding itself',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-review-pipeline-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 for(const profile of ['reviewer:claude','reviewer:codex']){
  const resolved=resolveProfile(root,profile),main=resolved.nodes.main;
  // No cross-vendor checker (D-66): the lead verifies its own findings.
  assert.equal(main.children.checker,undefined,profile);
  assert.ok(Object.values(resolved.nodes).every(node=>node.name!=='review-checker'),profile);
  const bundle=build(root,profile,target);verify(bundle);
  const script=fs.readdirSync(bundle,{recursive:true}).find(file=>String(file).endsWith(path.join('review','scripts','review-size.mjs')));
  assert.ok(script,`${profile} bundles review-size.mjs`);
 }
 includesAll(REVIEWERS,['and run the principles for that size, with principle 13 (security and PHI) on every review','Verify each Must-Fix and Should-Fix yourself as the review skill says','`Size: … because …` and `Budget:` lines','`Scope:` and `Approach/scope:` line']);
 includesAll(['skills/review/SKILL.md'],['scripts/review-size.mjs','Never lower it.','### Verify each finding','verify every Must-Fix and Should-Fix candidate yourself','Post one you can\'t verify as Should-Fix marked "unverified"','**Size:** [small|standard|large] because','Scope: in | out ([why]) · Approach/scope: no | yes','Source: [where the value comes from] → Sink: [where it ends up] → Missing control:']);
 includesAll(['skills/principled-review/SKILL.md'],['| small | 4, 5 and 13;','Principle 13 (security and PHI) runs at every size','### Principle 13: Security Boundaries & PHI','missing control redaction','### Principle 9: Query, Data & Hot-Path Cost','names the hot path, the scale and an estimate']);
 includesAll(['skills/review/CRITERIA.md'],['any PHI exposure','## 7. Routing','keep the one that sends the finding to the person']);
 assert.equal(fs.existsSync(path.join(root,'agents','review-checker.md')),false,'no review checker (D-66)');
 for(const file of ['skills/review/SKILL.md',...REVIEWERS])assert.doesNotMatch(flatText(file),/checker|other vendor|same vendor/i,file);
 assert.equal(resolveProfile(root,'orchestrator').nodes.main.instructions.includes('review-size'),false,'the orchestrator never sizes');
});

test('reviews start on ready, a plan\'s end or a cleared human review, never on tweaks, and findings route by scope within a fix-round budget',()=>{
 const skill=flatText('skills/orchestrate-sessions/SKILL.md');
 for(const rule of ['A review starts on one of three triggers, and never on a tweak or a quick fix','**"ready".**','**A plan\'s end.**','**Human review: required.**','`<last reviewed head>...HEAD`','The reviewer sizes the range itself','No reviewer starts, and the PR\'s lane shows its unreviewed commits','Never mark a PR ready, or say it can merge, while it has commits since its last review','The end-of-Session sweep','## After a review','| Approach/scope: yes, at any level | the person, never the implementer','| Must-Fix, not flagged | the PR\'s implementer, with no question |','| Should-Fix, scope out | the person: re-plan it as follow-up work, fix it here anyway, or accept it |','checks only the F-n it was sent','| Should-Fix, scope in, Decision: fix, Fix size: small | the PR\'s implementer, but only inside a fix round a Must-Fix already opened','| Pre-existing | the card','the budget is used and a Must-Fix is still open','a follow-up confirms a fix-caused Must-Fix','small 1, standard 2, large 3','QA rounds the implementer reports in its status file\'s `fix_rounds` count too','`Mergeable as is: yes`','more fix rounds (how many), re-plan, or accept as is'])assert.ok(skill.includes(rule),rule);
 assert.doesNotMatch(skill,/Fix the N must-fix items now|end-of-Session pass|thrash|two fix rounds|third fix round/);
 instructionsIncludeAll(COORDINATORS,['Tweaks and quick fixes start no reviewer','Never say a PR can merge while it has unreviewed commits','Must-Fix goes to the PR\'s implementer with no question','the loop stops at the PR\'s fix-round budget']);
 for(const profile of COORDINATORS)assert.doesNotMatch(resolveProfile(root,profile).nodes.main.instructions,/fix now \(recommended\)|end-of-Session pass/,profile);
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

test('greenfield documents the relay, the map, sized and verified reviews, and review on ready',()=>{
 includesAll(['README.md'],['numbered `needs_you` block','sends `recorded: Q-n → …`','`review-size.mjs`','Principle 13 (security and PHI) runs on every review','the review lead verifies every Must-Fix and Should-Fix itself','a quick fix or tweaked PR is reviewed when you say it is "ready"','`Human review: required`','There is no separate checker']);
 includesAll(['index.html'],['sized, after CI and QA','verifies each finding before posting it']);
 for(const file of ['README.md','index.html'])assert.doesNotMatch(flatText(file),/end-of-Session pass|once per workstream/,file);
});

test('review-final fixes: previews the orchestrator opens, the supplied range reaches every finder, and follow-ups catch fix-caused regressions',()=>{
 includesAll(['instructions/standing-rules.md'],['An orchestrator opens four things beside the person without asking first','the files of a question it relays, a PR waiting on their human review, and the screenshots of a visual tweak']);
 includesAll(['skills/principled-review/SKILL.md'],['When the caller supplies one','use it as `DIFF_RANGE` exactly and skip the base detection below']);
 includesAll(REVIEWERS,['pass that same range to principled-review as its `DIFF_RANGE` for every finder','a new Must-Fix in the lines that fix round changed','marked `fix-caused`']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['plus any new Must-Fix in the lines that fix round changed, which it marks `fix-caused`']);
});

test('planned work always validates full and then reviews on its own; deferred and ready are for quick fixes and tweaks (D-65)',()=>{
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['A planned feature\'s implementer always runs `full` when its build is done','it needs no "ready"','an implementer building an approved plan always runs `full`','`deferred` and "ready" apply only to quick fixes and tweaks']);
 includesAll(['instructions/standing-rules.md'],['Building an approved plan is always `full`','`deferred` and "ready" apply only to quick fixes and tweaks']);
 instructionsIncludeAll(COORDINATORS,['`full` for an approved plan, and `deferred` by default for quick fixes and tweaks','reports done after its `full` validation']);
 includesAll(['skills/plan/SKILL.md'],['the implementer runs full validation (CI and QA) when the build is done, then `greenfield/reviewer` reviews the PR on its own']);
 includesAll(['README.md'],['A planned feature\'s implementer always runs full validation (CI, QA) when its build is done','Quick fixes and tweaks run `deferred` by default']);
});

test('the status page is rendered to a fixed place, shows in Pane\'s Overview, every item has a front page, questions carry their context, and progress messages end with Next (P-1)',()=>{
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['Always write the local copy to `<Session folder>/session/index.html`','In Pane, the Session\'s Overview tab shows this page, so never open it as a separate tab there','names its page, `items/<id>.html`','An item moves here and is never removed','<meta http-equiv="refresh" content="60">','open it beside the person at the first dispatch','never a file to edit','`session.artifact.opened_url`','open the same URL again so the host reuses its tab']);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'skills/orchestrate-sessions/references/status-board.md'),'utf8'),/^Lanes /m);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"next":','"front_page":']);
 includesAll(['skills/orchestrate-sessions/references/item-hub.md'],['Every work item\'s front page','quick fix','Never hand-write it','link only files that exist','Plan or Task','Pull request','Trace, Post-mortem','"Not recorded"']);
 assert.doesNotMatch(flatText('skills/orchestrate-sessions/references/item-hub.md'),/three-line summary/);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['[references/item-hub.md](references/item-hub.md)','[references/status-board.md](references/status-board.md)','Every progress message to the person ends with "Next: …"','add the findings file, the post-mortem (if any) and the trace to its item page\'s `refs`, not to the brief']);
 includesAll(['skills/page/references/bundle.md'],['carries the findings file, the post-mortem (if any) and the trace once the PR\'s review loop closes','the orchestrator adds nothing to the brief']);
 assert.doesNotMatch(flatText('skills/page/references/bundle.md'),/the orchestrator adds the findings file/);
 includesAll(['skills/orchestrate-sessions/references/relay.md'],['Context: <where the context lives>','The status pages never show a question\'s wording']);
 assert.doesNotMatch(flatText('skills/orchestrate-sessions/references/relay.md'),/Needs you row/);
 instructionsIncludeAll(COORDINATORS,['end every progress message to the person with "Next: …"','open it beside the person at the first dispatch']);
 includesAll(['instructions/standing-rules.md'],['An orchestrator opens four things beside the person without asking first','the Session\'s status page outside Pane (at the first dispatch, then refreshed in the same tab; in Pane it shows in the Session\'s Overview tab)','except that a worker opens the files of a question it asks through Notify']);
});

test('the Session artifact has one home in the destination\'s sessions folder, reaches both orchestrators and names no product, and without a destination stays local with one notice (P-2)',()=>{
 const skill=flatText('skills/orchestrate-sessions/SKILL.md');
 for(const rule of ['a `sessions` folder in the document destination','`sessions/<host Session name> · <first 8 characters of the stable Session id>`','`sessions/Agent Farm · 55e40e55`','never from the UI selection','plus the first 8 characters of an id you generate once and record in the ledger','update that same artifact on every later publish for the life of the Session','published under an older name, keep updating it at its URL and create no second one','Opening the Session artifact shows the status page first','The workspace instructions supply only the organization or folder root','one notice line per Session','Never ask the person to set up a document service'])assert.ok(skill.includes(rule),rule);
 const rule=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8').split(/\n\s*\n/).find(p=>p.startsWith('**The Session artifact.**'));
 assert.ok(rule,'the sessions-folder rule');assert.doesNotMatch(rule,/grain/i);
 for(const profile of ['orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.skills.includes('orchestrate-sessions'),profile);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"artifact": { "path": "sessions/<host Session name> · <first 8 characters of the Session id>"','"notice_shown"']);
 includesAll(['README.md'],['names a destination service in one place only']);
});

test('every PR, however small, opens with its Excalidraw image from the pr-assets release and links its one artifact (P-4, D-73, D-75, D-78)',()=>{
 const pr=flatText('skills/prepare-pr/SKILL.md');
 assert.doesNotMatch(pr,/skips steps 6|a docs-only or few-line PR skips|overriding release uploads/);
 for(const rule of ['Every PR, however small, gets the diagram image and its own artifact','a one-region diagram and a short companion page','right under the summary','`<!-- pr-artifact: <url> -->`','never a second one for the same PR','holds the diagram image, QA media, reports made for the PR and, later, the post-mortem','The pr-assets release still hosts the PR body\'s image','local companion folder with the same contents outside the repository\'s tracked files','"Material for this PR is kept locally by its author."','no personal path','a Mermaid diagram takes the image\'s place and the body says the image was not rendered'])assert.ok(pr.includes(rule),rule);
 const ex=flatText('skills/excalidraw-pr-diagrams/SKILL.md');
 for(const rule of ['right under the PR\'s summary','followed by the link to the PR\'s own artifact','In a private repository','The image may not show for everyone','once per repository'])assert.ok(ex.includes(rule),rule);
 includesAll(IMPLEMENTERS,['Every PR you open, however small, starts with its diagram image and links its own artifact (`prepare-pr`).']);
});

test('the orchestrator writes a post-mortem after review only when something broke, into the PR\'s own artifact, and offers GitHub issues that it files only on a yes (P-3, D-72)',()=>{
 includesAll(['skills/page/references/post-mortem.md'],['The orchestrator writes it','after the PR\'s review loop closes, or when the PR merges or closes unreviewed','only when something went wrong','the PR\'s own artifact','**Issues hit:**','**Issues to file:**','repository and title','files nothing without the person\'s yes','Standalone, with no orchestrator, the implementer writes it the same way']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['## Post-mortems','the workers\' `failure` and `attempts` fields','a timeout, a dead tab, a crash','into the PR\'s own artifact','one question listing each proposed GitHub issue with its repository and title','A yes files that one issue, with private paths, customer text and session content removed','never guessed silently','write the words "no issues hit" on the item\'s card and on its front page, its item page','the implementer\'s `pr_artifact`','never a page of your own instead']);
 includesAll(['instructions/standing-rules.md'],['`failure`: what got in the way','`attempts`: what was tried for each problem','"pr_artifact": null','`pr_artifact`: where the PR\'s own artifact is']);
 includesAll(['skills/prepare-pr/SKILL.md'],['record where the PR\'s artifact is in your status file\'s `pr_artifact`','the path belongs there and not in the PR body']);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"pr_artifact":']);
 includesAll(IMPLEMENTERS,['record what got in the way (a timeout, a missing permission, a crash, a flaky tool) in its `failure` field and what you tried in `attempts`']);
 const bundle=flatText('skills/page/references/bundle.md');
 assert.doesNotMatch(bundle,/Add `post-mortem\.html` when implementation finishes|At the end of implementation, write `post-mortem\.html`/);
 assert.ok(bundle.includes('lives in the PR\'s own artifact'),'bundle.md: post-mortem home');
 includesAll(['instructions/planner-identity.md'],['the orchestrator writes a post-mortem only when something went wrong']);
 includesAll(['skills/plan/references/presentation.md'],['Link the trace, and the post-mortem in the PR\'s own artifact, once they exist']);
});

test('greenfield documents the status page, front pages, post-mortems, the PR image and artifact, and the Session artifact',()=>{
 includesAll(['README.md'],['never their wording','shows in the Session\'s Overview tab','clicking a card opens that item\'s own page','`sessions/<Session name> · <first 8 characters of the Session id>`','one notice line saying so','writes a post-mortem after its review loop closes, with Issues hit and Issues to file','filing only on your yes','"no issues hit"','Every PR, however small, opens with an Excalidraw image']);
 includesAll(['index.html'],['a status page beside you says what is next','image + its own page','post-mortem if it broke','leads with a diagram and links a page of its own']);
 for(const file of ['README.md','index.html'])assert.doesNotMatch(flatText(file),/workstream map per Session:|Lanes/,file);
});

test('greenfield asks planners and reviewers for the worst case at production size, with the numbers left to each repo',()=>{
 includesAll(['skills/review/CRITERIA.md'],['Cost at production size:','the largest real input','an unmeasured or unbounded worst case is Must-Fix','the missing measurement is the finding, so it needs no estimate of your own','The repo\'s AGENTS.md names its hot paths, budget and where production sizes are recorded; if it names none, the finding asks the author for them']);
 includesAll(['skills/plan/SKILL.md'],['its criteria name the worst-case production size and the budget it must meet','Passing on staging or test fixtures is not a worst case']);
 includesAll(['skills/review/severity-examples.md'],['never states the cost for the largest team in production']);
});

test('the orchestrator is pointed at the status page and item hub specs, saying when to read them, instead of summarising the page (D-8, D-9)',()=>{
 const paragraph=(file,start)=>{const found=fs.readFileSync(path.join(root,file),'utf8').split(/\n\s*\n/).find(p=>p.startsWith(start));assert.ok(found,`${file}: ${start}`);return found.replace(/\s+/g,' ');};
 instructionsIncludeAll(COORDINATORS,['`orchestrate-sessions`\' `references/status-board.md`','read it before you first write it in a Session and again before any rewrite','never write it from memory or from this paragraph','in Pane it shows in the Session\'s Overview tab']);
 for(const profile of COORDINATORS){
  const text=resolveProfile(root,profile).nodes.main.instructions.replace(/\s+/g,' ');
  for(const removed of ['Needs you first','one card per item','a "Next step" line'])assert.ok(!text.includes(removed),`${profile} still summarises the page: ${removed}`);
 }
 const board=paragraph('skills/orchestrate-sessions/SKILL.md','Keep one status page');
 for(const rule of ['[references/status-board.md](references/status-board.md)','before you first write it in a Session, and again before any rewrite, read status-board.md and write it from that','never from memory or from a summary such as this paragraph'])assert.ok(board.includes(rule),rule);
 assert.doesNotMatch(board,/opens with|one card per item|Needs you \(/);
 const hub=paragraph('skills/orchestrate-sessions/SKILL.md','Every item has a front page');
 for(const rule of ['[references/item-hub.md](references/item-hub.md)','Before you first fill an item\'s page fields in a Session, and again before any rewrite, read item-hub.md','never write one from memory or by hand'])assert.ok(hub.includes(rule),rule);
});

test('the status page groups Sources and Relevant links by kind of work and keeps only safe links',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'af-status-refs-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'skills/orchestrate-sessions/assets/status-page'),path.join(dir,'renderer'),{recursive:true});
 const render=status=>{
  fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify(status));
  const run=spawnSync(process.execPath,[path.join(dir,'renderer/render.mjs'),path.join(dir,'status.json'),path.join(dir,'index.html')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  return fs.readFileSync(path.join(dir,'index.html'),'utf8');
 };
 const session={title:'Refs',eyebrow:'now',counts:{running:0,queued:0,done:1},settings:'x'};
 const html=render({session,decisions:[{id:'D-1',answer:'Approved'}],
  sources:[{label:'Cover sheet',link:'https://example.com/plan',note:'approved, D-1',group:'Plan and decisions'},
           {label:'Mockup',link:'file:///tmp/mockup.html',group:'Design'},
           {label:'Brief',link:'plans/brief.html',group:'Plan and decisions'},
           {label:'Trace',link:'javascript:alert(1)'}],
  links:[{label:'PR <#12>',link:'https://github.com/o/r/pull/12',group:'r #12'},{label:'Pane',link:'pane://open?pane=p1',group:'r #12'}]});
 const text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 assert.match(text,/Decisions 1 .*Sources 4 Plan and decisions 2 Cover sheet approved, D-1 Brief Design 1 Mockup Other 1 Trace Relevant links 2 r #12 2 PR &lt;#12\S* Pane Settings/,'groups in first-seen order, between Decisions and Settings');
 for(const href of ['https://example.com/plan','file:///tmp/mockup.html','plans/brief.html','https://github.com/o/r/pull/12','pane://open?pane=p1'])assert.ok(html.includes(`href="${href}"`),href);
 assert.match(html,/<a href="#">Trace<\/a>/);
 assert.doesNotMatch(html,/javascript:/);
 const bare=render({session});
 assert.doesNotMatch(bare,/>Sources|>Relevant links/,'empty sections are omitted');
});

test('greenfield 0.0.43 gives the planners and orchestrators research-and-product-design, and the planner builds a packet before options and the plan',()=>{
 for(const profile of ['planner:claude','planner:codex','orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.skills.includes('research-and-product-design'),profile);
 for(const profile of ['planner:claude','planner:codex'])assert.ok(resolveProfile(root,profile).nodes.main.instructions.replace(/\s+/g,' ').includes('Before the options and the plan for a feature with an interface or a system-design choice, build a research packet and design rounds with `research-and-product-design`.'),profile);
});

test('the status page renderer runs with Node alone and draws a self-contained page that links Notify questions to their tab, by count and Q-id only',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'af-status-page-'));
 fs.cpSync(path.join(root,'skills/orchestrate-sessions/assets/status-page'),path.join(dir,'renderer'),{recursive:true});
 const status={session:{title:'Two features',eyebrow:'Updated 14:40 · 1 h 10 min elapsed',counts:{running:1,queued:0,done:0},settings:'Review on "ready"'},
  needs:[{id:null,item:'invoice-pdf',role:'Planner',blocks:'the plan',q:'Use the invoice id in the filename?',options:[{label:'Invoice id',rec:true},{label:'Invoice number'}],why:'Ids are stable.',age:'2 min',link:'pane://open?pane=p1&panel=w1'},
         {id:'Q-2',item:'export',role:'Implementer',blocks:'#12',q:'Keep CSV export?',options:[{label:'Keep',rec:true},{label:'Drop'}],why:'Customers use it.',age:'5 min'}],
  items:[{id:'invoice-pdf',name:'Invoice PDF',pane:'invoice-pdf',paneLink:'pane://open?pane=p1',state:'need',next:'<b>Planner</b> waits on you. <img src=x onerror=alert(1)><script>alert(1)</script> <a href="javascript:alert(1)">bad</a>',rail:[{label:'Plan',state:'need'},{label:'Build',state:'todo'}]},
         {id:'export',name:'Export',pr:'#12',pane:'export',state:'blocked',next:'Codex is not signed in.',rail:[{label:'Build',state:'done'},{label:'CI',state:'blocked'}]}],
  done:[],decisions:[]};
 fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify(status));
 const run=spawnSync(process.execPath,[path.join(dir,'renderer/render.mjs'),path.join(dir,'status.json'),path.join(dir,'index.html')],{cwd:dir,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 assert.match(html,/<a href="pane:\/\/open\?pane=p1&amp;panel=w1">a new question<\/a> \(Invoice PDF\) and Q-2 \(#12\)/,'the Notify question links its tab; the relayed one is a bare Q-id');
 assert.match(html,/<a class="btn sm" href="pane:\/\/open\?pane=p1&amp;panel=w1">Open Approvals →<\/a>/);
 for(const leaked of ['Use the invoice id in the filename?','Keep CSV export?','Ids are stable.','Customers use it.'])assert.ok(!html.includes(leaked),leaked);
 assert.match(html,/<meta http-equiv="refresh" content="60">/);
 assert.match(html,/data:font\/woff2;base64,/);
 assert.match(html,/<b>Planner<\/b> waits on you\. &lt;img src=x onerror=alert\(1\)>&lt;script>alert\(1\)&lt;\/script> bad/,'next keeps <b> and escapes the rest');
 assert.doesNotMatch(html,/<script|<img|src="https?:|url\(https?:|@import|javascript:/);
 const example=spawnSync(process.execPath,[path.join(dir,'renderer/render.mjs'),path.join(dir,'renderer/example-status.json'),path.join(dir,'example.html')],{encoding:'utf8'});
 assert.equal(example.status,0,example.stderr);
 assert.ok(fs.statSync(path.join(dir,'example.html')).size<200*1024,'the example page stays under the page standard\'s 200 KB');
});

test('the status page shows a PR\'s fix rounds of its budget, marked when spent, and old status files without them still render',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'af-status-rounds-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'skills/orchestrate-sessions/assets/status-page'),path.join(dir,'renderer'),{recursive:true});
 const render=items=>{
  fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify({session:{title:'Rounds',eyebrow:'now',counts:{running:1,queued:0,done:0},settings:'x'},items}));
  const run=spawnSync(process.execPath,[path.join(dir,'renderer/render.mjs'),path.join(dir,'status.json'),path.join(dir,'index.html')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  return fs.readFileSync(path.join(dir,'index.html'),'utf8');
 };
 const html=render([{id:'spent',name:'Spent',pr:'#194',pane:'p',state:'need',next:'Waits on you.',fixRounds:{used:1,budget:1}},{id:'open',name:'Open',pr:'#12',pane:'q',state:'now',next:'x',fixRounds:{used:1,budget:2}},{id:'old',name:'Old',pane:'r',state:'now',next:'y'}]);
 assert.match(html,/<span class="rounds spent">Fix rounds 1 of 1<\/span>/);
 assert.match(html,/<span class="rounds">Fix rounds 1 of 2<\/span>/);
 assert.equal(html.split('Fix rounds').length-1,2,'an item without fixRounds shows no counter');
 assert.match(html,/\.rounds\.spent\{[^}]*var\(--warn\)/);
});

test('greenfield 0.0.46 tidies the Session as Pane\'s rules say: archive without asking, close what it opened, /wrap-up tells first and leaves the Session open (D-40, D-41, D-49, D-51, D-107)',()=>{
 const pane=['"Keep the Session tidy" section of the Session folder\'s AGENTS.md','follow the wrap-up guide that AGENTS.md points to'];
 const archive=['`runpane panes archive --pane <id> --dry-run --json`','archive its Pane right after the merge, in the same turn','Never pass `--force`'];
 instructionsIncludeAll(COORDINATORS,['Archive a feature\'s Pane without asking',...archive,...pane]);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['Archive a feature\'s Pane without asking or offering',...archive,...pane,'status page\'s Cleanup log','each PR with unreviewed commits goes into that notice','leaves the Session open; archiving the Session is the person\'s action, never yours','Ask nothing separately.']);
 // D-107: /wrap-up asks no question and never archives the Session.
 for(const file of ['skills/orchestrate-sessions/SKILL.md','README.md'])assert.doesNotMatch(flatText(file),/Keep going, or stop\?|keep going, or stop\?|"Stop" leaves/,file);
 // Status-page open commands mark the tab as the agent's, so panels close can close it at /wrap-up.
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['--source agent']);
 for(const file of ['skills/orchestrate-sessions/SKILL.md','skills/orchestrate-sessions/references/status-board.md'])assert.doesNotMatch(flatText(file),/runpane panels open --url <[^>]+>`/,file);
 includesAll(['instructions/standing-rules.md'],['plans, PRs and mock-ups are otherwise linked from the status page, not opened','except the status page, which stays open until the Session wraps up','`runpane panels close --panel <id> --yes --json`','it adds `--force` only for a stuck tab or one the person asked it to close',pane[0]]);
 for(const file of ['instructions/coordination.md','skills/orchestrate-sessions/SKILL.md'])assert.doesNotMatch(flatText(file),/after offering the end-of-Session sweep|you have offered the end-of-Session sweep|Always offer the sweep before/,file);
 const bigbrain=fs.readFileSync(path.join(root,'../bigbrain/skills/orchestrate/SKILL.md'),'utf8').replace(/\s+/g,' ');
 for(const rule of ['Archive a feature\'s workspace without asking','`runpane panels close --panel <id> --yes --json`',...pane])assert.ok(bigbrain.includes(rule),rule);
});

test('greenfield 0.0.47 lets rare bugs stop blocking merge, weighs every fix by its cost, and gives each PR one fix-round budget QA and review share',()=>{
 includesAll(['skills/review/CRITERIA.md'],['**Must-Fix (blocks merge):** high harm with reach medium or high','high harm with low reach (mark it `rare`, silent or not)','If the only trigger is an input you made up, or an unusual way of writing a supported one, Reach is low','a normal use of a feature the product documents','## Fix or let go','cheapest safe one first','**Mitigate:**','**Let go:**','**Fix the class once.**','A repo\'s or plan\'s own rule wins over this list','**Pre-existing: yes**']);
 includesAll(['skills/review/SKILL.md'],['`Budget: N fix rounds`','**Budget:** [1|2|3] fix rounds','Reached by:','Fix size: small | large','Decision: fix | mitigate (option 1) | let go','Mergeable as is: yes | no','defined only in `CRITERIA.md`\'s Severity section']);
 includesAll(['instructions/standing-rules.md'],['## Fixing what review and QA find','1 for a small PR, 2 for standard, 3 for large','the first QA pass and the first review are free','"fix_rounds": null','within the PR\'s fix-round budget']);
 includesAll(['agents/pr-qa.md'],['Harm · Reach · Recovery line','or that you invented it','Your parent decides what gets fixed']);
 includesAll(['agents/qa-lead.md','agents/qa-lead-codex.md'],['or the PR\'s fix-round budget is spent','a break-it case you invented is rare']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['`Outcome: fixed | mitigated | let go | accepted | wrong | didn\'t matter`','`first_checked_head`','Before the PR\'s first review, take the budget from the implementer\'s `fix_rounds`']);
 // One home for the severity definitions: no other greenfield file restates the old Must-Fix line.
 for(const file of fs.readdirSync(root,{recursive:true}).map(String).filter(f=>/\.(md|html)$/.test(f))){
  const text=flatText(file);
  assert.doesNotMatch(text,/high reach or silent|high harm and \(high reach or silent\)|still open after two fix rounds|thrash rule/i,file);
 }
});

test('greenfield 0.0.48 draws a PR diagram as one layout twice on a canvas at most 1600 px wide, with argument text at 20 px and details at 14 to 16 px',()=>{
 includesAll(['skills/excalidraw-pr-diagrams/SKILL.md'],['Keep the canvas at most 1600 px wide','are 20 px or larger','are 14–16 px, and badges 14 px','defaults to 16 px, the detail size','set `label.fontSize: 20` on the skeleton\'s labels']);
});

test('greenfield 0.0.49 renders the status page from the first working turn, re-renders a stale one on each wake-up, keeps the local file canonical, and shows the goal with no workers (P6)',t=>{
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['Write it at the Session\'s first working turn, even when nothing will be dispatched, and again after every ledger write','That file is the canonical page and the one Pane\'s Overview tab shows','never instead of the local file','**Session with no workers.**']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['if the ledger or any in-flight worker\'s status file is newer than session/index.html, re-render the status page, and say so in this wake-up\'s one-line log','at the Session\'s first working turn, even when nothing will be dispatched, and again after every ledger write','always with the renderer, never by hand','never instead of the local file','The status page\'s canonical copy is always the local `<Session folder>/session/index.html`']);
 for(const file of ['skills/orchestrate-sessions/references/status-board.md','instructions/coordination.md'])assert.doesNotMatch(flatText(file),/Write it at the first dispatch/,file);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'af-status-empty-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'skills/orchestrate-sessions/assets/status-page'),path.join(dir,'renderer'),{recursive:true});
 const render=status=>{
  fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify(status));
  const run=spawnSync(process.execPath,[path.join(dir,'renderer/render.mjs'),path.join(dir,'status.json'),path.join(dir,'index.html')],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  return fs.readFileSync(path.join(dir,'index.html'),'utf8');
 };
 const session={title:'Release questions',eyebrow:'Updated 09:12',counts:{running:0,queued:0,done:0},settings:'x',flow:{caption:'Goal: decide whether <0.3> ships',steps:[]}};
 const empty=render({session,decisions:[{id:'D-1',answer:'Ship after the docs fix'}]});
 assert.match(empty,/<h1>Release questions<\/h1><p class="goal">Goal: decide whether &lt;0\.3> ships<\/p>/,'the goal shows under the title with no flow steps');
 assert.match(empty,/No workers yet\./);
 assert.match(empty,/Ship after the docs fix/);
 assert.doesNotMatch(empty,/Order of work/);
 const steps=[{label:'A',state:'now'},{label:'B',state:'todo'}];
 const item={id:'a',name:'A',pane:'a',state:'now',next:'x'};
 const busy=render({session:{...session,flow:{caption:'Goal: two items',steps}},items:[item,{...item,id:'b',name:'B'}]});
 assert.equal(busy.split('Goal: two items').length-1,1,'with the diagram drawn, the caption shows once, under it');
 assert.match(busy,/<p class="flowcap">Goal: two items<\/p>/);
 assert.doesNotMatch(busy,/class="goal"|No workers yet/);
});

test('greenfield 0.0.50 names the exact wrap-up steps: the orchestrator exports workers by launch, reviews are checked through the PR comments endpoint, and PR images roll to the next pr-assets release (setup-fixes P4, Q-90, Q-93)',()=>{
 assert.ok(flatText('skills/orchestrate-sessions/SKILL.md').includes('`agent-farm telemetry export --bundle <item bundle> --launch <id> --require-finished`, then republish the bundle. Workers never export their own.'));
 const bundle=flatText('skills/page/references/bundle.md');
 for(const rule of ['never write it by hand','workers do not export their own'])assert.ok(bundle.includes(rule),rule);
 assert.ok(flatText('skills/review/SKILL.md').includes('`gh api repos/<owner>/<repo>/pulls/<n>/comments --paginate`, filtered by `pull_request_review_id`'));
 for(const agent of ['codex','claude'])assert.ok(flatText(`agents/${agent}-pr-reviewer.md`).includes('`git worktree add --detach <dir> <sha>`'),agent);
 const ex=flatText('skills/excalidraw-pr-diagrams/SKILL.md');
 for(const rule of ['highest-numbered one that has room','990 or more','without asking, and say so in your report'])assert.ok(ex.includes(rule),rule);
 assert.ok(flatText('skills/prepare-pr/SKILL.md').includes('highest-numbered `pr-assets` release with room'));
});

// Renders a status JSON with a fresh copy of the renderer; returns the exit status, stderr, the overview and every item page.
const renderSession=(t,status,{example=false}={})=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'af-session-pages-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'skills/orchestrate-sessions/assets/status-page'),path.join(dir,'renderer'),{recursive:true});
 const input=example?path.join(dir,'renderer/example-status.json'):path.join(dir,'status.json');
 if(!example)fs.writeFileSync(input,JSON.stringify(status));
 const out=path.join(dir,'session/index.html');fs.mkdirSync(path.dirname(out));
 const run=spawnSync(process.execPath,[path.join(dir,'renderer/render.mjs'),input,out],{encoding:'utf8'});
 const itemsDir=path.join(dir,'session/items');
 const pages=fs.existsSync(itemsDir)?Object.fromEntries(fs.readdirSync(itemsDir).map(f=>[f,fs.readFileSync(path.join(itemsDir,f),'utf8')])):{};
 return {run,dir,out,itemsDir,pages,html:fs.existsSync(out)?fs.readFileSync(out,'utf8'):null,data:JSON.parse(fs.readFileSync(input,'utf8'))};
};
const pageText=html=>html.replace(/<style>[\s\S]*?<\/style>/,'').replace(/<svg[\s\S]*?<\/svg>/g,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');
const localHrefs=html=>[...html.matchAll(/href="([^"]*)"/g)].map(m=>m[1].replace(/&amp;/g,'&')).filter(h=>!/^([a-z]+:|#)/i.test(h));

test('greenfield 0.0.51: the overview reads top-down, questions show only as a count and Q-ids, and every card opens an existing item page that links back (J1, J2, C2, C3, C6)',t=>{
 assert.match(fs.readFileSync(path.join(root,'plugin.yaml'),'utf8'),/^version: 0\.0\.51$/m);
 const {run,out,itemsDir,pages,html,data}=renderSession(t,null,{example:true});
 assert.equal(run.status,0,run.stderr);
 const text=pageText(html);
 // J1: the order of the overview.
 const order=[data.session.title,'Next step:','wait for you in Approvals','work items','done','in progress','waiting on you','blocked','In flight','Order of work','Done','Decisions','Sources','Relevant links','Settings'];
 let at=-1;for(const marker of order){const i=text.indexOf(marker,at+1);assert.ok(i>at,`"${marker}" comes after the one before it`);at=i;}
 assert.ok(text.indexOf(pageText(data.session.summary).trim().slice(0,40))>text.indexOf(data.session.title),'the summary follows the title');
 assert.doesNotMatch(html,/Needs you|class="counts"|class="state /,'no counters, state bar or Needs you section');
 // Tiles count the cards, and the bar's widths follow the tiles.
 const all=[...data.items,...data.done];
 const tile=label=>Number(html.match(new RegExp(`<b>(\\d+)</b><span>${label}</span>`))?.[1]);
 assert.equal(tile('work items'),all.length);
 assert.equal(tile('done'),data.done.length+data.items.filter(i=>i.state==='done').length);
 assert.equal(tile('in progress'),data.items.filter(i=>i.state==='now').length);
 assert.equal(tile('waiting on you'),data.items.filter(i=>i.state==='need').length);
 assert.equal(tile('blocked'),data.items.filter(i=>['blocked','failed'].includes(i.state)).length);
 const widths=[...html.matchAll(/<i class="(ok|run|need|blk)" style="width:([\d.]+)%"><\/i>/g)].map(m=>[m[1],Number(m[2])]);
 for(const [cls,w] of widths)assert.ok(Math.abs(w-100*tile({ok:'done',run:'in progress',need:'waiting on you',blk:'blocked'}[cls])/all.length)<0.1,cls);
 // C3: no question wording on any page; the pointer names the count and each Q-id.
 const named=data.needs.filter(q=>q.id);
 assert.match(text,new RegExp(`${data.needs.length} questions wait for you in Approvals`));
 for(const q of named)assert.ok(text.includes(q.id),q.id);
 const wording=data.needs.flatMap(q=>[q.q,q.why,...(q.options||[]).map(o=>o.label)]).filter(Boolean);
 assert.ok(wording.length>=4,'the example\'s needs carry question text to leak');
 for(const [name,page] of [['index.html',html],...Object.entries(pages)])for(const w of wording)assert.ok(!page.includes(w),`${name} shows question text: ${w}`);
 // C2: one page per item with an id; every card and Details link opens one; every item page links back and to siblings that exist.
 const ids=all.filter(x=>x.id).map(x=>x.id);
 assert.deepEqual(Object.keys(pages).sort(),ids.map(id=>`${id}.html`).sort());
 for(const id of data.items.map(i=>i.id)){
  assert.ok(html.includes(`<a class="name" href="items/${id}.html">`),`${id}: the card's name is its stretched link`);
  assert.ok(html.includes(`<a class="more" href="items/${id}.html">Details →</a>`),`${id}: Details link`);
 }
 for(const h of localHrefs(html))if(h.startsWith('items/'))assert.ok(fs.existsSync(path.join(path.dirname(out),h)),h);
 for(const [name,page] of Object.entries(pages)){
  assert.equal(page.split('href="../index.html"').length-1,2,`${name}: breadcrumb and ↑ Back to overview`);
  assert.match(page,/↑ Back to overview/);
  const between=localHrefs(page).filter(h=>/^[a-z0-9-]+\.html$/.test(h));
  for(const h of between)assert.ok(fs.existsSync(path.join(itemsDir,h)),`${name} → ${h}`);
  for(const h of localHrefs(page).filter(h=>!/^[a-z0-9-]+\.html$/.test(h)))assert.ok(h.startsWith('../'),`${name}: ${h} is rebased to the overview's folder`);
  assert.ok(page.length<120*1024,`${name} stays under 120 KB`);
  assert.match(page,/<meta http-equiv="Content-Security-Policy" content="script-src 'none'">/);
  assert.doesNotMatch(page,/<script|onclick=/);
 }
 assert.ok(html.length<200*1024,'the overview stays under 200 KB');
 assert.doesNotMatch(html,/<script|onclick=/);
 // J2: prev/next walk a group in order and stop at its ends.
 const groups=new Map();for(const x of all.filter(x=>x.id)){const g=x.group||'';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(x.id);}
 for(const members of groups.values())members.forEach((id,i)=>{
  const nav=pages[`${id}.html`].match(/<nav class="navbtns">[\s\S]*?<\/nav>/)[0];
  assert.equal(nav.includes('class="prev"'),i>0,`${id}: prev`);assert.equal(nav.includes('class="next"'),i<members.length-1,`${id}: next`);
  if(i>0)assert.ok(nav.includes(`href="${members[i-1]}.html"`),`${id}: prev is ${members[i-1]}`);
  if(i<members.length-1)assert.ok(nav.includes(`href="${members[i+1]}.html"`),`${id}: next is ${members[i+1]}`);
 });
});

test('greenfield 0.0.51: every item kind gets a cover page with the fixed Everything rows, and a waiting item shows only its Q-id (J3, J4)',t=>{
 const {run,pages,data}=renderSession(t,null,{example:true});
 assert.equal(run.status,0,run.stderr);
 const all=[...data.items,...data.done].filter(x=>x.id);
 for(const kind of ['planned','quick fix','tweak','picked-up PR'])assert.ok(all.some(x=>x.kind===kind),`the example has a ${kind} item`);
 assert.ok(data.done.some(x=>x.id),'the example has a finished item with a page');
 assert.ok(data.needs.some(q=>all.some(x=>x.id===q.item)),'the example has an item waiting on a question');
 const KIND={planned:'Planned','quick fix':'Quick fix',tweak:'Tweak','picked-up PR':'Picked-up PR'};
 for(const x of all){
  const page=pages[`${x.id}.html`],text=pageText(page);
  assert.match(page,new RegExp(`<div class="eyebrow">${KIND[x.kind]}`),`${x.id}: kind in the eyebrow`);
  for(const label of ['Asked for','What changes','Where it stands','Everything for this item'])assert.ok(text.includes(label),`${x.id}: ${label}`);
  assert.match(page,/<svg class="fw"/,`${x.id}: its rail`);
  const rows=[...page.matchAll(/<tr[^>]*><th>([^<]+)<\/th>/g)].map(m=>m[1]);
  for(const row of [x.kind==='planned'?'Plan':'Task','Pull request','QA','Review','Worker','Trace','Post-mortem'])assert.ok(rows.includes(row),`${x.id}: ${row} row`);
  if(x.kind==='planned')assert.match(page,/<tr><th>Plan<\/th><td><a href="[^"]+">/,`${x.id}: the Plan row links its plan`);
  const waits=data.needs.filter(q=>q.item===x.id&&q.id);
  if(waits.length){assert.equal(rows[0],'Waiting',`${x.id}: Waiting comes first`);for(const q of waits)assert.ok(text.includes(`${q.id} waits in Approvals`),`${x.id}: ${q.id}`);}
  else assert.ok(!rows.includes('Waiting'),`${x.id}: no Waiting row`);
 }
});

test('greenfield 0.0.51: a missing, duplicate or unsafe item id stops the renderer before it writes anything (C4)',t=>{
 const session={title:'Ids',eyebrow:'now',settings:'x'};
 const item=(id,name)=>({id,name,state:'now',next:'x'});
 for(const [items,done,named] of [
  [[{name:'No id here',state:'now',next:'x'}],[],'No id here'],
  [[item('a','First A'),item('a','Second A')],[],'Second A'],
  [[item('a','Live A')],[{id:'a',label:'Done A'}],'Done A'],
  [[item('../evil','Climber')],[],'Climber'],
  [[item('Has Space','Spacey')],[],'Spacey'],
 ]){
  const {run,out,itemsDir}=renderSession(t,{session,items,done});
  assert.notEqual(run.status,0,`${named}: exits non-zero`);
  assert.ok(run.stderr.includes(named),`${named}: the message names the item (${run.stderr.trim()})`);
  assert.ok(!fs.existsSync(out)&&!fs.existsSync(itemsDir),`${named}: nothing written`);
 }
});

test('greenfield 0.0.51: item pages escape every field, keep only safe links, and say where questions wait outside Pane (C5)',t=>{
 const evil='<img src=x onerror=alert(1)>';
 const {run,html,pages}=renderSession(t,{session:{title:'Esc',eyebrow:'now',settings:'x',summary:`Sum ${evil} <b>bold</b>`,nextStep:'Do <a href="javascript:alert(1)">this</a>'},
  needs:[{id:'Q-1',item:'a',q:'Secret question text?'}],
  items:[{id:'a',name:`A ${evil}`,kind:'tweak',group:`G ${evil}`,state:'need" onmouseover="x',pr:'#1',prLink:'javascript:alert(1)',paneLink:'data:text/html,x',asked:`Ask ${evil}`,changes:'<b>ok</b>',next:'n',
   refs:{task:{label:`T ${evil}`,link:'javascript:alert(1)',note:evil},pr:{label:'PR',link:'https://example.com/pr/1'},worker:{label:'Tab',link:'pane://open?pane=p&panel=w'}}}]});
 assert.equal(run.status,0,run.stderr);
 const page=pages['a.html'];
 for(const p of [html,page]){
  assert.doesNotMatch(p,/<img|javascript:|data:text|onmouseover/);
  assert.ok(!p.includes('Secret question text?'));
 }
 assert.match(html,/Sum &lt;img src=x onerror=alert\(1\)> <b>bold<\/b>/,'summary keeps <b> and escapes the rest');
 assert.match(html,/class="card item now/,'an unknown state falls back to now');
 assert.match(pageText(html),/1 question waits for you in the orchestrator's chat: Q-1/,'no Approvals link: the pointer names the chat');
 assert.match(page,/Q-1 waits in the orchestrator's chat/);
 assert.match(page,/<a href="#">T &lt;img/,'unsafe ref link becomes #');
 assert.match(page,/href="pane:\/\/open\?pane=p&amp;panel=w"/);
 assert.match(page,/<tr><th>QA<\/th><td><span class="nr">Not recorded<\/span>/,'an empty fixed row shows Not recorded');
 assert.match(page,/<h1>A &lt;img src=x onerror=alert\(1\)><\/h1>/);
});

test('greenfield 0.0.51: the instructions say questions live only in Approvals, every item\'s front page is its generated item page, and the overview and item pages render together (C7, D-34)',()=>{
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['Questions appear only in Approvals in Pane, and in your chat elsewhere','its item page, `items/<id>.html`, which the renderer generates for every item','the same run re-renders every item page with the overview','not to the brief']);
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['The overview and the item pages are always re-rendered together','No page shows a question\'s wording','the renderer ignores any other field','A missing, repeated or unsafe id stops it','"refs"','the renderer rebases them']);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"page_id":']);
 includesAll(['skills/customer-insights-loop/references/handoff.md'],['the status page shows it only by its Q-id']);
 for(const file of ['skills/orchestrate-sessions/SKILL.md','skills/orchestrate-sessions/references/status-board.md','skills/orchestrate-sessions/references/item-hub.md','skills/orchestrate-sessions/references/relay.md','skills/page/references/bundle.md','skills/customer-insights-loop/references/handoff.md','README.md']){
  const text=flatText(file);
  assert.doesNotMatch(text,/three-line summary|small hub|creating its hub|Needs you row|Needs you entry|"counts"|one state bar/,file);
 }
});
