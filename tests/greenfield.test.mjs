import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {build,resolveProfile} from '../dist/compiler.js';
import {command,verify} from '../dist/runtime.js';
import {validatePlugin} from '../dist/plugins.js';
import {parse} from 'yaml';

const root=fileURLToPath(new URL('../plugins/greenfield/',import.meta.url));

// Every runnable greenfield entry: the three profiles and, through their launch links, every agent they reach,
// each with every variant. A link target is looked up as an agent, as Agent Farm does when it starts one.
function entries(){
 const result=[],seen=new Set(),queue=fs.readdirSync(path.join(root,'profiles')).filter(file=>file.endsWith('.yaml')).map(file=>({name:file.replace(/\.yaml$/,''),kind:'profile'}));
 while(queue.length){
  const {name,kind}=queue.shift(),key=kind+':'+name;if(seen.has(key))continue;seen.add(key);
  const options=kind==='agent'?{agentOnly:true}:{},base=resolveProfile(root,name,undefined,options);
  for(const ref of base.variants?[name,...base.variants.map(variant=>name+':'+variant)]:[name]){
   const resolved=ref===name?base:resolveProfile(root,ref,undefined,options);result.push({ref,kind,resolved});
   for(const link of Object.values(resolved.nodes.main.links??{}))if(link.agent)queue.push({name:link.agent.replace(/^greenfield\//,''),kind:'agent'});
  }
 }
 return result;
}

test('the implementer is the former dcouple raw profile on Opus, Astra or Sol, with only an opt-in cross-vendor second-opinion reviewer',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-profile-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 validatePlugin(root);
 assert.equal(resolveProfile(root,'implementer').nodes.main.model,'claude-opus-5-5');
 for(const [profile,harness,model] of [['implementer:claude','claude','claude-opus-5-5'],['implementer:codex','codex','gpt-6.2-sol']]){
  const resolved=resolveProfile(root,profile),main=resolved.nodes.main;
  assert.deepEqual([main.harness,main.model,main.reasoning_effort],[harness,model,'medium']);
  assert.deepEqual(Object.keys(main.children).sort(),['cold-reader','explorer','qa-and-verify','second-opinion']);
  const second=resolved.nodes[main.children['second-opinion']];
  assert.deepEqual([second.name,second.mode,second.harness,second.model],['pr-reviewer','process',...(harness==='claude'?['codex','gpt-6.2-sol']:['claude','claude-opus-5-5'])],profile);
  assert.ok(second.skills.includes('review'),profile);
  const prompt=fs.readFileSync(main.source_file,'utf8').replace(/\s+/g,' ');
  for(const rule of ['Use it only when you run standalone (no orchestrator) or when the person asks','Under an orchestrator, review stays with the `reviewer` agent'])assert.ok(prompt.includes(rule),`${profile}: ${rule}`);
  assert.equal(resolved.nodes[main.children['qa-and-verify']].name,'pr-qa');
  for(const skill of ['prepare-pr','babysit-pr','tdd','quick-verify','pr-test-automation','session-trace'])assert.ok(main.skills.includes(skill),`${profile}: ${skill}`);
  const bundle=build(root,profile,target);verify(bundle);
  const launch=command(bundle,'main',{prepare:false});
  assert.equal(launch.argv[launch.argv.indexOf('--model')+1],model);
 }
 for(const agent of ['raw-claude','raw-codex']){const text=fs.readFileSync(path.join(root,'agents',agent+'.md'),'utf8');assert.match(text,/By default, split the work into independent chunks/,agent);assert.match(text,/Work serially only when chunks share files/,agent);assert.match(text,/you, the parent, launch them/,agent);}
 for(const removed of ['agents/implementer.md','agents/implementer-claude.md','agents/reviewer.md','agents/frontend-verifier.md','instructions/implementer-identity.md','skills/work-packages','skills/build-package','skills/final-review'])assert.equal(fs.existsSync(path.join(root,removed)),false,removed);
});

test('the reviewer is the former dcouple reviewer, with its Codex variant on Sol 6.2 low ultrafast and one reconciled COMMENT review under an orchestrator',()=>{
 const claude=resolveProfile(root,'reviewer').nodes.main,codex=resolveProfile(root,'reviewer:codex').nodes.main;
 assert.deepEqual([claude.harness,claude.model,claude.reasoning_effort],['claude','claude-opus-5-5','high']);
 assert.deepEqual([codex.harness,codex.model,codex.reasoning_effort],['codex','gpt-6.2-sol','low']);assert.equal(codex.speed,'ultrafast');
 for(const agent of ['claude-pr-reviewer','codex-pr-reviewer']){
  const text=fs.readFileSync(path.join(root,'agents',agent+'.md'),'utf8');
  assert.match(text,/## Launched by an orchestrator/);assert.doesNotMatch(text,/dcouple/);
  const orchestrated=/## Launched by an orchestrator\n([\s\S]*?)\n## /.exec(text)[1];
  for(const phrase of [/exactly one review/,/event `COMMENT`/,/never approve or request changes/,/<!-- greenfield-review head=<sha> -->/,/earlier greenfield reviews/,/Apply no fixes/,/reads the lines that fix round changed for regressions first/,/checks only the findings it was sent/,/Noticed, not raised/,/--remerge-diff/,/Mergeable as is: yes \| no/])assert.match(orchestrated,phrase,agent);
 }
});

test('agents moved from dcouple resolve from greenfield, and the dropped ones do not',()=>{
 for(const profile of ['audits','business','product-researcher','qa-and-fix','reviewer','seo','implementer'])assert.ok(resolveProfile(root,profile).nodes.main);
 for(const profile of ['ideate','pipeline','raw'])assert.throws(()=>resolveProfile(root,profile));
 const qa=resolveProfile(root,'qa-and-fix'),bug=resolveProfile(root,'bug-reporter');
 assert.equal(bug.nodes[bug.nodes.main.children.qa].name,'qa');
 assert.ok(qa.nodes.main.skills.includes('pr-test-automation'));
});

test('every greenfield Codex role runs gpt-6.2-sol ultrafast, low for review roles and medium otherwise',()=>{
 let codexNodes=0;
 for(const {ref:profile,resolved} of entries())for(const node of Object.values(resolved.nodes)){
  if(node.harness!=='codex')continue;codexNodes++;
  const effort=['codex-pr-reviewer','pr-reviewer','business-spec-reviewer','business-artifact-reviewer'].includes(node.name)?'low':'medium';
  assert.deepEqual([node.model,node.reasoning_effort,node.speed],['gpt-6.2-sol',effort,'ultrafast'],`${profile} ${node.name}`);
 }
 assert.ok(codexNodes>20,`expected many Codex nodes, saw ${codexNodes}`);
});

test('greenfield 0.1.0 has exactly three profiles; every helper is a linked agent, the two orchestrators link the same agents, and no removed name or old variant survives',()=>{
 const profiles=fs.readdirSync(path.join(root,'profiles')).filter(file=>file.endsWith('.yaml')).map(file=>file.replace(/\.yaml$/,'')).sort();
 assert.deepEqual(profiles,['business','orchestrator','seo']);
 for(const [name,title] of [['orchestrator','Orchestrator'],['business','Business'],['seo','SEO']]){
  const resolved=resolveProfile(root,name);
  assert.equal(resolved.display.title,title,name);assert.ok(resolved.display.description,name);
  assert.equal(resolved.display.photo,path.join(fs.realpathSync(root),'profiles',name+'.svg'),name);
 }
 const links=ref=>{const main=resolveProfile(root,ref).nodes.main;return Object.fromEntries(Object.entries(main.links??{}).map(([alias,link])=>[alias,link.agent]));};
 const orchestrator=links('orchestrator:claude');
 assert.deepEqual(orchestrator,links('orchestrator:codex'));
 // Each alias names the greenfield agent of the same name.
 const same=aliases=>Object.fromEntries(aliases.map(alias=>[alias,'greenfield/'+alias]));
 assert.deepEqual(orchestrator,same(['planner','implementer','reviewer','qa-and-fix','bug-reporter','simplify-and-refactor','audits','code-smell-fixes','codebase-audit','ui-polish','customer-insights-loop','product-researcher','planning-and-prioritization']));
 assert.deepEqual(Object.keys(resolveProfile(root,'orchestrator').nodes.main.children),['advisor']);
 assert.deepEqual(links('business:claude'),links('business:codex'));
 assert.deepEqual(Object.keys(links('business')).sort(),['planning-and-prioritization','product-researcher']);
 assert.deepEqual(links('seo'),same(['seo-investigator','seo-measurer','seo-strategist','seo-writer','seo-reviewer','planner','implementer','reviewer']));
 assert.deepEqual(links('business'),same(['product-researcher','planning-and-prioritization']));
 for(const [agent,expected] of [['customer-insights-loop',['implementer','planner','reviewer']],['planning-and-prioritization',['planner']],['raw-claude',['reviewer']],['raw-codex',['reviewer']],['claude-pr-reviewer',['implementer']],['codex-pr-reviewer',['implementer']],['seo-strategist',['seo-writer']],['seo-reviewer',['seo-strategist','seo-writer']]])
  assert.deepEqual(Object.keys(links(agent)).sort(),expected,agent);
 // No link uses any: true, and every agent file is reached from a profile through native, process or launch links.
 const all=entries(),reached=new Set(all.flatMap(({resolved})=>Object.values(resolved.nodes).map(node=>node.name)));
 for(const {resolved} of all)for(const link of Object.values(resolved.nodes.main.links??{}))assert.equal(link.any,undefined);
 const agentFiles=fs.readdirSync(path.join(root,'agents')).filter(file=>file.endsWith('.md')).map(file=>file.replace(/\.md$/,''));
 assert.deepEqual(agentFiles.filter(agent=>!reached.has(agent)),[]);
 // The removed names are gone, and only claude and codex name variants.
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 for(const file of walk(root)){
  const relative=path.relative(root,file);assert.doesNotMatch(relative,/free-range|seo-orchestrator|implementer-codex|process-cleanup/,relative);
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/free-range|seo-orchestrator|implementer-codex|process-cleanup/,relative);
  if(/^(profiles|agents)\/[^/]+\.yaml$/.test(relative)){const variants=Object.keys(parse(fs.readFileSync(file,'utf8')).variants??{});for(const variant of variants)assert.ok(['claude','codex'].includes(variant),relative+': '+variant);}
 }
 for(const removed of ['free-range','process-cleanup','seo-orchestrator','implementer-codex','seo-codex'])assert.throws(()=>resolveProfile(root,removed),undefined,removed);
});

test('bug-reporter, orchestrator and the Claude planner\'s Socrates run Opus 5.5',()=>{
 const bug=resolveProfile(root,'bug-reporter'),main=bug.nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['claude','claude-opus-5-5','high']);
 for(const [name,effort] of [['investigator','high'],['qa','medium']]){const node=bug.nodes[main.children[name]];assert.deepEqual([node.mode,node.harness,node.model,node.reasoning_effort],['native','claude','claude-opus-5-5',effort]);}
 const orchestrator=resolveProfile(root,'orchestrator').nodes.main;assert.deepEqual([orchestrator.harness,orchestrator.model],['claude','claude-opus-5-5']);
 const planner=resolveProfile(root,'planner');assert.equal(planner.nodes[planner.nodes.main.children.socrates].model,'claude-opus-5-5');
 const codexPlanner=resolveProfile(root,'planner:codex');assert.equal(codexPlanner.nodes[codexPlanner.nodes.main.children.socrates].model,'gpt-6.2-sol');
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

test('the plugin names no destination service: no Greenfield instruction names Grain, and the orchestrator publishes the Session artifact before it opens it (D-13, D-15)',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 for(const folder of ['agents','skills','profiles','instructions'])for(const file of walk(path.join(root,folder)))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/grain/i,path.relative(root,file));
 const publishing=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8').split(/\n\s*\n/).find(p=>p.startsWith('**Publishing.**'));
 assert.ok(publishing,'the Publishing paragraph');
 for(const rule of ['one private artifact in the Session folder','never share it','When the host shows the local status page itself, open the published page only when the person asks for it','Otherwise publish first, then open the published URL beside the person','never open the local copy in its place before a publish has been tried','"Publishing the Session\'s pages to <destination> failed: <reason>; showing the local copy."','record the failure in the ledger\'s `session.artifact.publish_error`, and retry at each refresh','check the ledger\'s `session.artifact.url` and look the artifact up in the destination','never leaves a second artifact','open the published URL and record it as `session.artifact.opened_url`, so every later refresh reuses that tab','the first time it fails rather than at every failed retry','open the local copy as a `file://` URL and say so','Never ask the person to set up the destination service'])assert.ok(publishing.replace(/\s+/g,' ').includes(rule),rule);
});

test('the orchestrator routes planner, implementer and end-of-workstream reviewer through the host\'s workspaces, with safe cleanup',()=>{
 const skill=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8');
 for(const text of ['the host\'s own workspace-create and agent-launch commands','| `planner`: investigate','| `implementer` (use','| `reviewer:codex`, one per review','one `COMMENT` review, no fixes','agent-farm inspect greenfield/<agent> --directory <repo>','Never type the name by hand or drop `--parent`'])assert.ok(skill.includes(text),text);
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
  for(const rule of ['reconciled findings to that file','post exactly one review','event `COMMENT` (never approve or request changes)','Apply no fixes','reads the lines that fix round changed for regressions first, then checks only the findings it was sent'])assert.ok(instructions.includes(rule),`${profile}: ${rule}`);
 }
 const skill=flat(fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8'));
 for(const rule of ['no agent in it is working','1 feature = 1 worktree = 1 branch = 1 workspace','launch every later worker for that feature as a new agent in the same workspace','the role\'s line from your Launch links list as the command','Always name the variant','`implementer:claude`','whether it explicitly grants conversation capture','a personal fallback workspace grants nothing'])assert.ok(skill.includes(rule),rule);
 assert.doesNotMatch(skill,/\[:variant\]/);
 const trace=flat(fs.readFileSync(path.join(root,'skills/session-trace/SKILL.md'),'utf8'));
 for(const rule of ['Naming a document destination is not a grant','trace not authorized','--launch <ID>','`$CODEX_HOME` before `~/.codex`'])assert.ok(trace.includes(rule),rule);
 assert.doesNotMatch(trace,/workspace instructions authorize this capture/);
 const plan=flat(fs.readFileSync(path.join(root,'skills/plan/SKILL.md'),'utf8')),sheet=flat(fs.readFileSync(path.join(root,'skills/plan/references/cover-sheet.md'),'utf8'));
 assert.ok(plan.includes('Under an orchestrator, never skip on your own'));
 assert.ok(sheet.includes("Under an orchestrator, only the user's explicit word changes the review line"));
 const babysit=flat(fs.readFileSync(path.join(root,'skills/babysit-pr/SKILL.md'),'utf8'));
 for(const rule of ["Fix every finding within the PR's goal","don't dismiss an in-scope finding as out of scope",'capture it with `create-ticket`','reply on the thread with the link','When you decline a finding as wrong, reply with the reason',"Leave a greenfield review's Suggestions unfixed"])assert.ok(babysit.includes(rule),rule);
});

test('simplify-and-refactor runs the refactor and principled-review skills on Sol by default or Opus, with a refactor child per analysis',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-refactor-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const variants=Object.keys(parse(fs.readFileSync(path.join(root,'agents/simplify-and-refactor.yaml'),'utf8')).variants);
 assert.deepEqual(variants.sort(),['claude','codex']);
 assert.equal(resolveProfile(root,'simplify-and-refactor').nodes.main.model,'gpt-6.2-sol');
 for(const [profile,agent,harness,model,effort] of [['simplify-and-refactor:codex','simplify-and-refactor-codex','codex','gpt-6.2-sol','medium'],['simplify-and-refactor:claude','simplify-and-refactor-claude','claude','claude-opus-5-5','medium']]){
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
 for(const text of ['`simplify-and-refactor:codex`','The simplify checkpoint is optional and off by default','it applies only on their approval'])assert.ok(orchestrate.includes(text),text);
 const refactor=fs.readFileSync(path.join(root,'skills/refactor/SKILL.md'),'utf8').replace(/\s+/g,' ');
 assert.ok(refactor.includes('run it before QA'));
 for(const agent of ['simplify-and-refactor-codex','simplify-and-refactor-claude']){
  const text=fs.readFileSync(path.join(root,'agents',agent+'.md'),'utf8').replace(/\s+/g,' ');
  for(const rule of ['Analysis is read-only','only after the person approves the merged plan','no other worker is writing the branch','before QA'])assert.ok(text.includes(rule),`${agent}: ${rule}`);
 }
});

test('reviewers share principled-review with simplify-and-refactor and leave fixes to an implementer, and both raw implementers can draw PR diagrams',()=>{
 for(const profile of ['reviewer:claude','reviewer:codex']){
  const main=resolveProfile(root,profile).nodes.main;
  assert.deepEqual(main.skills.sort(),['android-emulators','ios-simulators','machine-resources','pr-test-automation','principled-review','review'],profile);
  assert.match(fs.readFileSync(main.source_file,'utf8').replace(/\s+/g,' '),/You review; an implementer fixes\. To fix them, suggest starting your `implementer` link \(its command is in your Launch links list\) with that file/,profile);
 }
 for(const profile of ['implementer:claude','implementer:codex'])assert.ok(resolveProfile(root,profile).nodes.main.skills.includes('excalidraw-pr-diagrams'),profile);
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
 'session-trace -> prepare-pr':'names the pull request a trace attaches to; planning-and-prioritization never opens one, so it does not bundle prepare-pr',
 'page -> prepare-pr':"the post-mortem reference names a PR's companion page; only an orchestrator writes post-mortems, and planning-and-prioritization never opens a PR",
 'principled-review -> review':"uses the review skill's context step where bundled, and otherwise reads the PR and issues itself",
 'research-and-product-design -> ui-mockup':'the orchestrator runs several features through it; the feature agents it launches draw the UI rounds with ui-mockup',
};

test('every Greenfield skill and agent is reached from a profile, and every skill named in bundled text is bundled with it',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 const skills=fs.readdirSync(path.join(root,'skills')),agents=fs.readdirSync(path.join(root,'agents')).filter(file=>file.endsWith('.md')).map(file=>file.replace(/\.md$/,''));
 const pattern=name=>{const n=name.replace(/-/g,'\\-');return new RegExp('`'+n+'`|(?<![\\w-])'+n+' skill|skill `?'+n+'(?![\\w-])|\\.\\./'+n+'/SKILL\\.md');};
 const skillText=Object.fromEntries(skills.map(skill=>[skill,walk(path.join(root,'skills',skill)).map(file=>fs.readFileSync(file,'utf8')).join('\n')]));
 const reachedSkills=new Set(),reachedAgents=new Set(),usedExceptions=new Set(),unresolved=new Set();
 for(const {ref:profile,resolved} of entries()){{
   const nodes=resolved.nodes;
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

test('planning-and-prioritization runs read-only Opus lanes and a reconciler from one lane-researcher, and takes the sweep arguments',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-sweep-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const resolved=resolveProfile(root,'planning-and-prioritization'),main=resolved.nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['claude','claude-opus-5-5','high']);
 assert.deepEqual(main.skills,['research-reconcile','swarm','interview','page','session-trace']);
 assert.ok(main.instructions.includes('# Standing rules'));
 assert.ok(!main.skills.includes('prepare-pr'));
 assert.deepEqual(Object.keys(main.argument_definitions).sort(),['docs','parent','rank_by','source','topic','window']);
 const children=Object.fromEntries(Object.entries(main.children).map(([alias,route])=>{const n=resolved.nodes[route];return [alias,[n.name,n.mode,n.harness,n.model,n.reasoning_effort]];}));
 assert.deepEqual(children,{lane:['lane-researcher','native','claude','claude-opus-5-5','medium'],reconciler:['lane-researcher','native','claude','claude-opus-5-5','high']});
 const lane=fs.readFileSync(path.join(root,'agents/lane-researcher.md'),'utf8').replace(/\s+/g,' ');
 for(const rule of ['Write only the path your prompt names','record that source as `unavailable` with the exact error','create, update, comment on'])assert.ok(lane.toLowerCase().includes(rule.toLowerCase()),rule);
 const skill=fs.readFileSync(path.join(root,'skills/research-reconcile/SKILL.md'),'utf8').replace(/\s+/g,' ');
 for(const rule of ['verify and reconcile before acting',"never written without the person's approval",'Rank only on reconciled values'])assert.ok(skill.toLowerCase().includes(rule.toLowerCase()),rule);
 assert.match(fs.readFileSync(path.join(root,'skills/research-reconcile/references/reconciler-prompt.md'),'utf8'),/"record_fixes"/);
 const bundle=build(root,'planning-and-prioritization',target);verify(bundle);
 for(const alias of ['lane','reconciler'])assert.ok(fs.existsSync(path.join(bundle,'main','native-agents',alias+'.json')));
 const launch=command(bundle,'main',{prepare:false,args:['rank_by=deadline','topic=x']});
 assert.deepEqual([launch.launch.arguments.rank_by,launch.launch.arguments.topic],['deadline','x']);
 assert.throws(()=>command(bundle,'main',{prepare:false,args:['foo=1']}),/undeclared|Unknown|unknown|does not declare/);
});

const withoutStandingRules={
 'ui-polish':"runs prepare-pr for its PR format; prepare-pr's one pointer to the standing rules names the implementer's last step, which ui-polish's own done line replaces",
};

test('every agent whose own text or skills point to the standing rules loads them',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 const skillText=skill=>walk(path.join(root,'skills',skill)).map(file=>fs.readFileSync(file,'utf8')).join('\n');
 const missing=new Set();
 for(const {resolved} of entries()){
  for(const node of Object.values(resolved.nodes)){
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
 assert.deepEqual(finders,{finder:['smell-finder','native','claude','claude-sonnet-5-5','low',true],'codex-finder':['smell-finder','process','codex','gpt-6.2-sol','medium',true]});
 const bundle=build(root,'code-smell-fixes',target);verify(bundle);
 assert.ok(fs.existsSync(path.join(bundle,'main','dispatch','codex-finder')));
 assert.ok(fs.existsSync(path.join(bundle,'main','native-agents','finder.json')));
});

test('codebase-audit runs on Fable with native Sonnet researchers and an Opus curator, and bundles its executable scripts',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-audit-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const resolved=resolveProfile(root,'codebase-audit'),main=resolved.nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['claude','claude-fable-5-2','medium']);
 const children=Object.fromEntries(Object.entries(main.children).map(([alias,route])=>{const n=resolved.nodes[route];return [alias,[n.mode,n.model,n.reasoning_effort]];}));
 assert.deepEqual(children,{researcher:['native','claude-sonnet-5-5','medium'],curator:['native','claude-opus-5-5','medium'],'cold-reader':['native','claude-sonnet-5-5','medium']});
 const bundle=build(root,'codebase-audit',target);verify(bundle);
 for(const script of ['metrics.py','build.py','shoot.sh']){
  const file=fs.readdirSync(bundle,{recursive:true}).find(f=>String(f).endsWith(path.join('codebase-audit','scripts',script)));
  assert.ok(file,script);
  if(process.platform!=='win32')assert.ok(fs.statSync(path.join(bundle,file)).mode&0o100,script);
 }
});

test('Codex orchestration routes every worker and helper to Codex while retaining Claude defaults',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-codex-orchestrator-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 validatePlugin(root);
 const resolved=resolveProfile(root,'orchestrator:codex'),main=resolved.nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['codex','gpt-6.2-sol','medium']);
 const advisor=resolved.nodes[main.children.advisor];
 assert.deepEqual([advisor.mode,advisor.harness,advisor.model,advisor.reasoning_effort],['process','codex','gpt-6.2-sol','medium']);
 const workers=['bug-reporter:codex','planner:codex','implementer:codex','reviewer:codex','qa-and-fix:codex','simplify-and-refactor:codex'];
 for(const profile of workers){
  assert.ok(main.instructions.includes('`'+profile.replace(/:codex$/,'')+'`'),profile);
  const worker=resolveProfile(root,profile);
  // implementer:codex is raw-codex, whose opt-in second opinion stays cross-vendor (Claude).
  for(const node of Object.values(worker.nodes))if(!(profile==='implementer:codex'&&node.name==='pr-reviewer'))assert.equal(node.harness,'codex',`${profile}: ${node.name}`);
  verify(build(root,profile,target));
 }
 const implementer=resolveProfile(root,'implementer:codex');
 assert.deepEqual([implementer.nodes.main.model,implementer.nodes.main.reasoning_effort],['gpt-6.2-sol','medium']);
 const second=implementer.nodes[implementer.nodes.main.children['second-opinion']];
 assert.deepEqual([second.mode,second.harness],['process','claude']);
 const bug=resolveProfile(root,'bug-reporter:codex');
 for(const [alias,effort] of [['investigator','medium'],['qa','medium']]){
  const child=bug.nodes[bug.nodes.main.children[alias]];
  assert.deepEqual([child.mode,child.model,child.reasoning_effort],['native','gpt-6.2-sol',effort]);
 }
 for(const profile of ['orchestrator','orchestrator:claude','bug-reporter','bug-reporter:claude','implementer'])assert.equal(resolveProfile(root,profile).nodes.main.harness,'claude',profile);
 assert.match(main.instructions,/Preserve explicit user model overrides/);
 assert.match(main.instructions,/links as `:codex`: append `:codex` to the name in each link's command/);
 const launch=command(build(root,'orchestrator:codex',target),'main',{prepare:false});
 assert.equal(launch.argv[launch.argv.indexOf('--model')+1],'gpt-6.2-sol');assert.ok(launch.argv.includes('service_tier="ultrafast"'));
 assert.ok(main.skills.includes('orchestrate-sessions'));
 const skill=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8');
 assert.match(skill,/Use the orchestrator agent's worker routing defaults/);
});

test('customer-insights-loop runs Opus 5.5 medium on Claude only, coordinates with the orchestrator\'s shared rules, and names no product, host or person',t=>{
 const target=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-insights-')));
 t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 assert.equal(fs.existsSync(path.join(root,'agents/customer-insights-loop.yaml')),false,'a single Claude agent, not a variant set');
 const main=resolveProfile(root,'customer-insights-loop').nodes.main;
 assert.deepEqual([main.harness,main.model,main.reasoning_effort],['claude','claude-opus-5-5','medium']);
 for(const skill of ['customer-insights-loop','orchestrate-sessions','interview','swarm','ui-mockup','page'])assert.ok(main.skills.includes(skill),skill);
 assert.deepEqual(Object.keys(main.children).sort(),['advisor','investigator','researcher']);
 for(const profile of ['customer-insights-loop','orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.instructions.includes('# Coordination'),profile);
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 for(const file of [...walk(path.join(root,'skills/customer-insights-loop')),path.join(root,'agents/customer-insights-loop.md')])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/\b(pane|runpane|posthog|hogql|grain|parsa)\b/i,path.relative(root,file));
 includesAll(['skills/customer-insights-loop/SKILL.md'],['Before stage 1, ask how hands-on the person wants to be','record the answer in the ledger as `autonomy`','With no answer, wait']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['set concurrency to what free disk and machine load allow','relaunch that review on `reviewer:claude` and note the swap on the PR\'s card']);
 verify(build(root,'customer-insights-loop',target));
});

const flatText=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\s+/g,' ');
const COORDINATORS=['orchestrator:claude','orchestrator:codex','customer-insights-loop'];
const instructionsIncludeAll=(profiles,rules)=>{for(const profile of profiles){const text=resolveProfile(root,profile).nodes.main.instructions.replace(/\s+/g,' ');for(const rule of rules)assert.ok(text.includes(rule),`${profile}: ${rule}`);}};
const REVIEWERS=['agents/claude-pr-reviewer.md','agents/codex-pr-reviewer.md'];
const IMPLEMENTERS=['agents/raw-claude.md','agents/raw-codex.md'];
const includesAll=(files,rules)=>{for(const file of files){const text=flatText(file);for(const rule of rules)assert.ok(text.includes(rule),`${file}: ${rule}`);}};

test('workers raise numbered needs_you blocks, standalone workers ask in the same shape, and both orchestrators relay them',()=>{
 const rules=flatText('instructions/standing-rules.md');
 for(const rule of ['## Questions for the person','"needs_you": null','"needs_you": { "id": "Q-3", "kind": "question | choice | approval | fyi"','"files": [','"blocking": true','`answer: Q-n → <answer>. Recorded as D-n.`','`clarify: Q-n → <their question>` is not an answer: keep Q-n open','(`AskUserQuestion`)','wherever there is no question tool, a numbered list (`Files: <paths>`','`Why: <why>`','recommended one first and marked `(recommended)`','Q-n are unique per Session and never reused','write the block with `"id": null` and `"asked": "self"`','A pending result is never a reason to relay','`recorded: Q-n → <answer>. Recorded as D-n.` to you only','When the host says asking is unavailable, set `asked` to `"relay"`','and for every non-blocking question','**When the host turns your blocked report into the person\'s question**','write the block with `"asked": "relay"` and its Q-n (the one the orchestrator assigned, else the next free one), send one blocked report the way the host says, and ask nothing a second way','Pass any question text to a shell command as a literal argument: through an argv API','in single quotes with each `\'` inside it escaped for that shell (`\'\\\'\'` in a POSIX shell, `\'\'` in PowerShell)','never inside double quotes or unquoted','**When the host lets a worker ask the person itself**'])assert.ok(rules.includes(rule),rule);
 assert.doesNotMatch(rules,/"question": null/);
 for(const profile of ['planner:claude','planner:codex','implementer:claude','implementer:codex','orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.instructions.includes('## Questions for the person'),profile);
 instructionsIncludeAll(COORDINATORS,['numbered `needs_you` blocks','labelled with its role and feature and with its files opened beside the person','send it to the asking worker only']);
 includesAll(IMPLEMENTERS,['goes in that status file as a `needs_you` block; run by hand, ask the person directly in the same shape']);
 includesAll(['instructions/planner-identity.md'],['Raise each question for the person as a `needs_you`','record each `answer:` or `recorded:` line\'s D-n']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['[references/relay.md](references/relay.md)','`[Needs you · <role> · <feature>]`','to the asking worker only']);
 includesAll(['skills/orchestrate-sessions/references/relay.md'],['newest blocking question first','open them without asking','Recorded as D-n.` Nobody else gets it','even when you can answer it yourself','Q-n stays open and nothing is recorded','(raised as Q-3)','Never relay it while the host still holds it','`recorded: Q-n → <answer>. Recorded as D-n.`','in any state other than blocked on two checks at least a minute apart','never put the same question to the person a second way: relay that one with the host\'s relay command']);
 // A status file written before 0.0.65 says `notify` for a worker-owned block; a resumed orchestrator keeps it worker-owned, pending or answered.
 includesAll(['skills/orchestrate-sessions/references/relay.md'],['A block whose `asked` holds `notify`, the name Greenfield 0.0.64 and earlier used, is the same worker-owned block: treat it as `self` whether it is pending or answered, keep its answers, and never relay or re-ask it for that value alone.']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['(`"asked": "self"`, or `notify` in status files written by Greenfield 0.0.64 and earlier, which you treat the same way)']);
});

test('no Greenfield skill or rule asks for a secret in chat: the host secret prompt when the host has one, local setup confirmed without its value elsewhere (review F-1)',()=>{
 includesAll(['instructions/standing-rules.md'],['**Never ask for a secret** (an API key, token or password) in chat, a question tool, a card, a `needs_you` or a document','When the host has a secret prompt, request it there','confirm it is ready without sending its value','stop at that prerequisite and record only whether it is ready, never the value']);
 includesAll(['skills/interview/SKILL.md'],['- **Never ask for a secret.**','record only whether it is ready']);
 includesAll(['skills/deep-dive/references/bright-data.md'],['never to paste it into the conversation','when the host has a secret prompt, request it there','confirm it is ready without sending its value']);
 for(const file of ['skills/interview/SKILL.md','skills/interview/references/question-format.md','instructions/planner-identity.md','instructions/standing-rules.md'])assert.doesNotMatch(flatText(file),/credentials as plain text|provide\/configure|pasting secrets/i,file);
 for(const profile of ['planner:claude','planner:codex'])assert.ok(resolveProfile(root,profile).nodes.main.instructions.includes('**Never ask for a secret**'),profile);
});

test('greenfield 0.0.53: with a host question mechanism, asking and relaying follow the host\'s injected instructions; needs_you carries why and summary (J9)',()=>{
 assert.match(fs.readFileSync(path.join(root,'plugin.yaml'),'utf8'),/^version: 0\.1\.0$/m);
 const rules=flatText('instructions/standing-rules.md');
 for(const rule of ['**When the host has its own question mechanism**','its injected instructions decide which mechanism to use','these rules never restate them','"why": "Invoice PDFs are renamed on export','"summary": "/abs/bundle/options.html"',"Follow the host's instructions for any length or display limits.","Use the format the host's instructions accept.",'When the host has its own question mechanism, use it as its instructions say. Otherwise, on Claude, use the harness question tool (`AskUserQuestion`)'])assert.ok(rules.includes(rule),rule);
 // #205's ban on passing the status file is gone, and host card rules are not restated here.
 for(const stale of [/Never pass the status file/,/--summary '/,/--question "Q-n/,/80 to 100 characters/,/--took/,/--update/,/refuses a title/,/at most 240 characters/,/the absolute path of an `.html` page/])assert.doesNotMatch(rules,stale);
 includesAll(['skills/orchestrate-sessions/references/relay.md'],['When the host has its own way of asking the person, ask and relay the way its instructions say','When the host has its own question mechanism, put the round through it as its instructions say','Otherwise, on Claude, put the questions through the harness question tool (`AskUserQuestion`)']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['**When the host\'s injected instructions supply their own orchestration guide**, that guide runs the Session','adds only Greenfield\'s roles','On any other host, follow this skill in full','relay that one with the host\'s relay command and never ask it a second way']);
 instructionsIncludeAll(['orchestrator:claude','orchestrator:codex'],['When the host has its own question mechanism, ask and relay the way its injected instructions say','that guide runs the Session and Greenfield\'s `orchestrate-sessions` adds only those']);
 // A profile cannot pick skills by host, so Greenfield's copy still ships for every other host.
 for(const profile of ['orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.skills.includes('orchestrate-sessions'),profile);
 includesAll(['skills/interview/SKILL.md'],['**When the host has its own question mechanism, its injected instructions decide the card**','an interview round whose answers go in the decision log is the host\'s approval card, never `AskUserQuestion`','a quick clarification that only steers your next step may use Claude\'s own card']);
 includesAll(['skills/interview/references/question-format.md'],['- **A host with its own question mechanism:**','- **Claude Code otherwise:** `AskUserQuestion`']);
 includesAll(['README.md'],['When the host has its own question mechanism, agents ask and relay the way the host\'s injected instructions say','a profile cannot choose its skills by host']);
});

test('the map links self-asked questions to the asking worker and shows each PR\'s validation and unreviewed commits, and the watcher is unchanged',()=>{
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['Never write the page\'s HTML by hand','give `id: null`, and the page shows it as "a new question"','`link` is the host\'s link to where it holds the question','the asking worker\'s for a question it asked itself through the host','When the host has no question queue, give no `link`','validation still pending, from the ledger\'s `validation`','"N commits since the last review at <sha>, not reviewed"','git rev-list --count <last reviewed head>..<PR head>','`<!-- greenfield-review head=<sha> -->` marker']);
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
 includesAll(['skills/review/CRITERIA.md'],['A PHI exposure is Must-Fix at any reach, in every review, follow-ups included','## 7. Routing','keep the one that sends the finding to the person']);
 assert.equal(fs.existsSync(path.join(root,'agents','review-checker.md')),false,'no review checker (D-66)');
 for(const file of ['skills/review/SKILL.md',...REVIEWERS])assert.doesNotMatch(flatText(file),/checker|other vendor|same vendor/i,file);
 assert.equal(resolveProfile(root,'orchestrator').nodes.main.instructions.includes('review-size'),false,'the orchestrator never sizes');
});

test('reviews start on their own when any implementer is done, or when the person asks, and findings route by scope within a fix-round budget (D-44)',()=>{
 const skill=flatText('skills/orchestrate-sessions/SKILL.md');
 for(const rule of ['A review starts on its own, without asking the person or waiting for a "ready"','**Implementer done.**','**The person asks.**','**Human review: required** in a cover sheet does not hold the agent review','`<last reviewed head>...HEAD`','The reviewer sizes the range itself','Then the review of the new commits starts on its own','the PR\'s lane shows its unreviewed commits','Never mark a PR ready, or say it can merge, while it has commits since its last review','The end-of-Session sweep','## After a review','| Approach/scope: yes, at any level | the person, never the implementer','| Must-Fix, not flagged | the PR\'s implementer, with no question |','| Should-Fix, scope out | the person: re-plan it as follow-up work, fix it here anyway, or accept it |','checks only the F-n it was sent','| Should-Fix, scope in, Decision: fix, not rare | the PR\'s implementer; it can open a fix round |','| Pre-existing | the card','the budget is used and a Must-Fix is still open','a follow-up confirms a fix-caused Must-Fix','small 1, standard 2, large 3','QA rounds the implementer reports in its status file\'s `fix_rounds` count too','`Mergeable as is: yes`','more fix rounds (how many), re-plan, or accept as is'])assert.ok(skill.includes(rule),rule);
 assert.doesNotMatch(skill,/Fix the N must-fix items now|end-of-Session pass|thrash|two fix rounds|third fix round/);
 instructionsIncludeAll(COORDINATORS,['Start a review on your own as soon as an implementer reports done on a PR, for every kind of work','does not hold the agent review','Never say a PR can merge while it has unreviewed commits','Must-Fix goes to the PR\'s implementer with no question','the loop stops at the PR\'s fix-round budget']);
 for(const profile of COORDINATORS)assert.doesNotMatch(resolveProfile(root,profile).nodes.main.instructions,/fix now \(recommended\)|end-of-Session pass/,profile);
 includesAll(IMPLEMENTERS,['quick-verified, with screenshots of each changed screen when it is visual','start no reviewer yourself: the orchestrator starts one when you report done']);
 includesAll(['instructions/standing-rules.md'],['`deferred` applies only when the person asks for it','CI, QA and review wait until the person says "ready"','"Ready" runs `full` on the same branch']);
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
 includesAll(['README.md'],['numbered `needs_you` block','sends `recorded: Q-n → …`','`review-size.mjs`','Principle 13 (security and PHI) runs on every review','the review lead verifies every Must-Fix and Should-Fix itself','a planned build, a quick fix or a tweak alike, and then its review starts on its own, without asking you','`Human review: required`','There is no separate checker']);
 includesAll(['index.html'],['sized, after CI and QA','verifies each finding before posting it']);
 for(const file of ['README.md','index.html'])assert.doesNotMatch(flatText(file),/end-of-Session pass|once per workstream/,file);
});

test('review-final fixes: previews the orchestrator opens, the supplied range reaches every finder, and follow-ups catch fix-caused regressions',()=>{
 includesAll(['instructions/standing-rules.md'],['An orchestrator opens four things beside the person without asking first','the files of a question it relays, a PR waiting on their human review, and the screenshots of a visual tweak']);
 includesAll(['skills/principled-review/SKILL.md'],['When the caller supplies one','use it as `DIFF_RANGE` exactly and skip the base detection below']);
 includesAll(REVIEWERS,['pass that same range to principled-review as its `DIFF_RANGE` for every finder','a new Must-Fix in the lines that fix round changed','marked `fix-caused`']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['It raises only a new Must-Fix in the lines that fix round changed with Reach medium or high, which it marks `fix-caused`, or a PHI exposure']);
});

test('all work validates full by default and then reviews on its own; deferred only when the person asks (D-65, D-44)',()=>{
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['Every implementer runs `full` by default','every implementer runs `full` by default','runs only when the person asks for it on an item or as the Session\'s default']);
 assert.doesNotMatch(flatText('skills/orchestrate-sessions/SKILL.md'),/never on a tweak|start no reviewer|`deferred` \(your default/);
 includesAll(['instructions/standing-rules.md'],['The default is `full` for all work','under an orchestrator the review follows on its own, without waiting for the person']);
 instructionsIncludeAll(COORDINATORS,['`full` by default for all work, and `deferred` only when the person asks for it']);
 includesAll(['skills/plan/SKILL.md'],['the implementer runs full validation (CI and QA) when the build is done, then `greenfield/reviewer` reviews the PR on its own']);
 includesAll(['README.md'],['Every implementer runs full validation (CI, QA) when its work is done','Say "defer" or "skip review" for an item or the Session']);
 for(const file of ['README.md','instructions/coordination.md','skills/plan/SKILL.md','skills/babysit-pr/SKILL.md'])assert.doesNotMatch(flatText(file),/start no review|until they say "ready"|reviewed when you say it is "ready"|`deferred` by default/,file);
});

test('the status page is rendered to a fixed place, shows where the host puts it, every item has a front page, questions carry their context, and progress messages end with Next (P-1)',()=>{
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['Always write the local copy to `<Session folder>/session/index.html`','When the host shows the local status page itself, never open it as a separate page there','names its page, `items/<id>.html`','An item moves here and is never removed','<meta http-equiv="refresh" content="60">','publish it first, then open it beside the person at the first dispatch','never a file to edit','the published URL when a destination resolves, and a `file://` URL only when none does or publishing failed','it is refreshed in the same tab, never opened in another','`session.artifact.opened_url`','open the same URL again so the host reuses its tab']);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'skills/orchestrate-sessions/references/status-board.md'),'utf8'),/^Lanes /m);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"next":','"front_page":']);
 includesAll(['skills/orchestrate-sessions/references/item-hub.md'],['Every work item\'s front page','quick fix','Never hand-write it','link only files that exist','Plan or Task','Pull request','Trace, Post-mortem','"Not recorded"']);
 assert.doesNotMatch(flatText('skills/orchestrate-sessions/references/item-hub.md'),/three-line summary/);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['[references/item-hub.md](references/item-hub.md)','[references/status-board.md](references/status-board.md)','Every progress message to the person ends with "Next: …"','add the findings file, the post-mortem (if any) and the trace to its item page\'s `refs`, not to the brief']);
 includesAll(['skills/page/references/bundle.md'],['carries the findings file, the post-mortem (if any) and the trace once the PR\'s review loop closes','the orchestrator adds nothing to the brief']);
 assert.doesNotMatch(flatText('skills/page/references/bundle.md'),/the orchestrator adds the findings file/);
 includesAll(['skills/orchestrate-sessions/references/relay.md'],['Context: <where the context lives>','The status pages never show a question\'s wording']);
 assert.doesNotMatch(flatText('skills/orchestrate-sessions/references/relay.md'),/Needs you row/);
 instructionsIncludeAll(COORDINATORS,['end every progress message to the person with "Next: …"','open the published URL beside the person at the first dispatch']);
 includesAll(['instructions/standing-rules.md'],['An orchestrator opens four things beside the person without asking first','the Session\'s status page (at the first dispatch, then refreshed in the same tab; not when the host already shows it)','except that a worker opens the files of a question it asks the person itself through the host']);
});

test('the Session artifact has one home in the destination\'s sessions folder, reaches both orchestrators and names no product, and without a destination stays local with one notice (P-2)',()=>{
 const skill=flatText('skills/orchestrate-sessions/SKILL.md');
 for(const rule of ['in the Session\'s folder in the document destination','Use the Session folder rule the workspace instructions give','When they give none, use `sessions/<host Session name>`, for example `sessions/Agent Farm`','if that folder already holds another Session\'s status page, use `sessions/<host Session name> · <short id>`','`sessions/Agent Farm · 55e40e55`','the first 8 hexadecimal characters of the UUID in the host\'s stable Session id','never from the UI selection','Settle the folder once, before the first dispatch, record it in the ledger, and pass it to every worker','Settle the Session folder before the first dispatch and pass that exact folder to every worker with the destination','plus the first 8 characters of an id you generate once and record in the ledger','update that same artifact on every later publish for the life of the Session','published under an older name, keep updating it at its URL and create no second one','Opening the Session artifact shows the status page first','one notice line per Session','Never ask the person to set up a document service'])assert.ok(skill.includes(rule),rule);
 assert.ok(!skill.includes('The workspace instructions supply only the organization or folder root'),'the folder-root sentence is gone');
 for(const rule of ['publish the Session\'s pages there instead of keeping them as local files, even when the host says to keep documents local','The local files are the working copy','Fall back to local files only when no destination is named, or while publishing fails'])assert.ok(skill.includes(rule),rule);
 for(const file of ['skills/orchestrate-sessions/SKILL.md','skills/orchestrate-sessions/references/ledger.md','README.md'])assert.ok(!flatText(file).includes('<first 8 characters of the'),`${file}: the old folder rule`);
 const workspace=fs.readFileSync(path.join(root,'../../.agent-farm/workspace.yaml'),'utf8').replace(/\s+/g,' ');
 for(const rule of ['"sessions/<session-name>"','if that folder already holds another Session\'s status page, use "sessions/<session-name> · <short ID>", where the short ID is the first 8 hex characters of the UUID in the Session\'s stable id'])assert.ok(workspace.includes(rule),`.agent-farm/workspace.yaml: ${rule}`);
 instructionsIncludeAll(['orchestrator:claude','orchestrator:codex'],['rewrite it after every ledger write, and publish it to the document destination after each write','otherwise open the published URL beside the person at the first dispatch','Documents follow the document destination, not the host: when the workspace instructions name a file, artifact or bundle destination, publish there instead of keeping local files, even when the host says to keep documents local, and fall back to local files only when nothing else is available.']);
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['also publish them after every rewrite','Otherwise publish it first, then open it beside the person at the first dispatch','the published URL when a destination resolves, and a `file://` URL only when none does or publishing failed','publish it again, then open the same URL again so the host reuses its tab']);
 for(const rule of ['When the host shows the local status page itself, open the published page only when the person asks for it','Otherwise publish first, then open the published URL beside the person','never open the local copy in its place before a publish has been tried','`session.artifact.publish_error`','so a failed or uncertain attempt never leaves a second artifact'])assert.ok(skill.includes(rule),rule);
 const rule=fs.readFileSync(path.join(root,'skills/orchestrate-sessions/SKILL.md'),'utf8').split(/\n\s*\n/).find(p=>p.startsWith('**The Session artifact.**'));
 assert.ok(rule,'the sessions-folder rule');assert.doesNotMatch(rule,/grain/i);
 for(const profile of ['orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.skills.includes('orchestrate-sessions'),profile);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"artifact": { "path": "sessions/<host Session name>, or the workspace\'s Session folder rule"','"publish_error": null','"notice_shown"']);
 includesAll(['README.md'],['The plugin names no destination service.','It is published before it is opened']);
 assert.ok(!flatText('README.md').includes('names a destination service in one place only'),'README: the one-place rule is gone');
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
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['## Post-mortems','the workers\' `failure` and `attempts` fields','a timeout, a dead worker, a crash','into the PR\'s own artifact','one question listing each proposed GitHub issue with its repository and title','A yes files that one issue, with private paths, customer text and session content removed','never guessed silently','write the words "no issues hit" on the item\'s card and on its front page, its item page','the implementer\'s `pr_artifact`','never a page of your own instead']);
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
 includesAll(['README.md'],['never their wording','When the host shows it itself, the orchestrator leaves it there','clicking a card opens that item\'s own page','`sessions/<Session name>` unless the workspace instructions give another rule, with the short id added only when that folder already holds another Session\'s status page','the settled Session folder to the worker','one notice line saying so','writes a post-mortem after its review loop closes, with Issues hit and Issues to file','filing only on your yes','"no issues hit"','Every PR, however small, opens with an Excalidraw image']);
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
 instructionsIncludeAll(COORDINATORS,['`orchestrate-sessions`\' `references/status-board.md`','read it before you first write it in a Session and again before any rewrite','never write it from memory or from this paragraph','when the host already shows the local page, leave it there']);
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
 const session={title:'Refs',eyebrow:'now',counts:{running:0,queued:0,done:1},settings:'x',hostScheme:'host'};
 const html=render({session,decisions:[{id:'D-1',answer:'Approved'}],
  sources:[{label:'Cover sheet',link:'https://example.com/plan',note:'approved, D-1',group:'Plan and decisions'},
           {label:'Mockup',link:'file:///tmp/mockup.html',group:'Design'},
           {label:'Brief',link:'plans/brief.html',group:'Plan and decisions'},
           {label:'Trace',link:'javascript:alert(1)'}],
  links:[{label:'PR <#12>',link:'https://github.com/o/r/pull/12',group:'r #12'},{label:'Workspace',link:'host://open?ws=p1',group:'r #12'}]});
 const text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 assert.match(text,/Decisions 1 .*Sources 4 Plan and decisions 2 Cover sheet approved, D-1 Brief Design 1 Mockup Other 1 Trace Relevant links 2 r #12 2 PR &lt;#12\S* Workspace Settings/,'groups in first-seen order, between Decisions and Settings');
 for(const href of ['https://example.com/plan','file:///tmp/mockup.html','plans/brief.html','https://github.com/o/r/pull/12','host://open?ws=p1'])assert.ok(html.includes(`href="${href}"`),href);
 assert.match(html,/<a href="#">Trace<\/a>/);
 assert.doesNotMatch(html,/javascript:/);
 const bare=render({session});
 assert.ok(render({session:{...session,hostScheme:undefined},links:[{label:'W',link:'host://open?ws=p1'}]}).includes('<a href="#">W</a>'),'a host scheme the status JSON does not name is dropped');
 assert.ok(render({session:{...session,hostScheme:'javascript'},links:[{label:'J',link:'javascript:alert(1)'}]}).includes('<a href="#">J</a>'),'a dangerous scheme is never a host scheme');
 assert.doesNotMatch(bare,/>Sources|>Relevant links/,'empty sections are omitted');
});

test('greenfield 0.0.43 gives the planners and orchestrators research-and-product-design, and the planner builds a packet before options and the plan',()=>{
 for(const profile of ['planner:claude','planner:codex','orchestrator:claude','orchestrator:codex'])assert.ok(resolveProfile(root,profile).nodes.main.skills.includes('research-and-product-design'),profile);
 for(const profile of ['planner:claude','planner:codex'])assert.ok(resolveProfile(root,profile).nodes.main.instructions.replace(/\s+/g,' ').includes('Before the options and the plan for a feature with an interface or a system-design choice, build a research packet and design rounds with `research-and-product-design`.'),profile);
});

test('the status page renderer runs with Node alone and draws a self-contained page that links self-asked questions to the host, by count and Q-id only',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'af-status-page-'));
 fs.cpSync(path.join(root,'skills/orchestrate-sessions/assets/status-page'),path.join(dir,'renderer'),{recursive:true});
 const status={session:{title:'Two features',eyebrow:'Updated 14:40 · 1 h 10 min elapsed',counts:{running:1,queued:0,done:0},settings:'Review on "ready"',hostScheme:'host'},
  needs:[{id:null,item:'invoice-pdf',role:'Planner',blocks:'the plan',q:'Use the invoice id in the filename?',options:[{label:'Invoice id',rec:true},{label:'Invoice number'}],why:'Ids are stable.',age:'2 min',link:'host://open?ws=p1&agent=w1'},
         {id:'Q-2',item:'export',role:'Implementer',blocks:'#12',q:'Keep CSV export?',options:[{label:'Keep',rec:true},{label:'Drop'}],why:'Customers use it.',age:'5 min'}],
  items:[{id:'invoice-pdf',name:'Invoice PDF',workspace:'invoice-pdf',workspaceLink:'host://open?ws=p1',state:'need',next:'<b>Planner</b> waits on you. <img src=x onerror=alert(1)><script>alert(1)</script> <a href="javascript:alert(1)">bad</a>',rail:[{label:'Plan',state:'need'},{label:'Build',state:'todo'}]},
         {id:'export',name:'Export',pr:'#12',workspace:'export',state:'blocked',next:'Codex is not signed in.',rail:[{label:'Build',state:'done'},{label:'CI',state:'blocked'}]}],
  done:[],decisions:[]};
 fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify(status));
 const run=spawnSync(process.execPath,[path.join(dir,'renderer/render.mjs'),path.join(dir,'status.json'),path.join(dir,'index.html')],{cwd:dir,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 assert.match(html,/<a href="host:\/\/open\?ws=p1&amp;agent=w1">a new question<\/a> \(Invoice PDF\) and Q-2 \(#12\)/,'the self-asked question links where the host holds it; the relayed one is a bare Q-id');
 assert.match(html,/<a class="btn sm" href="host:\/\/open\?ws=p1&amp;agent=w1">Open questions →<\/a>/);
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
 const html=render([{id:'spent',name:'Spent',pr:'#194',workspace:'p',state:'need',next:'Waits on you.',fixRounds:{used:1,budget:1}},{id:'open',name:'Open',pr:'#12',workspace:'q',state:'now',next:'x',fixRounds:{used:1,budget:2}},{id:'old',name:'Old',workspace:'r',state:'now',next:'y'}]);
 assert.match(html,/<span class="rounds spent">Fix rounds 1 of 1<\/span>/);
 assert.match(html,/<span class="rounds">Fix rounds 1 of 2<\/span>/);
 assert.equal(html.split('Fix rounds').length-1,2,'an item without fixRounds shows no counter');
 assert.match(html,/\.rounds\.spent\{[^}]*var\(--warn\)/);
});

test('greenfield 0.0.46 tidies the Session as the host\'s rules say: archive without asking, close what it opened, wrap-up tells first and leaves the Session open (D-40, D-41, D-49, D-51, D-107)',()=>{
 const archive=['archive its workspace right after the merge, in the same turn','Never force an archive'];
 instructionsIncludeAll(COORDINATORS,['Archive a feature\'s workspace without asking','run the host\'s dry run first and archive only if it is clean',...archive,'When the host\'s injected instructions give cleanup or wrap-up rules']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['Archive a feature\'s workspace without asking or offering','Run the host\'s archive dry run first and archive only if it is clean',...archive,'When the host gives its own cleanup and wrap-up rules, they are the source','status page\'s Cleanup log','each PR with unreviewed commits goes into that notice','leave the Session open; archiving the Session is the person\'s action, never yours','Ask nothing separately.']);
 // D-107: wrap-up asks no question and never archives the Session.
 for(const file of ['skills/orchestrate-sessions/SKILL.md','README.md'])assert.doesNotMatch(flatText(file),/Keep going, or stop\?|keep going, or stop\?|"Stop" leaves/,file);
 includesAll(['instructions/standing-rules.md'],['plans, PRs and mock-ups are otherwise linked from the status page, not opened','except the status page, which stays open until the Session wraps up','with the host\'s own close command','When the host\'s injected instructions give cleanup rules, they are the source']);
 for(const file of ['instructions/coordination.md','skills/orchestrate-sessions/SKILL.md'])assert.doesNotMatch(flatText(file),/after offering the end-of-Session sweep|you have offered the end-of-Session sweep|Always offer the sweep before/,file);
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

test('greenfield 0.0.64 grades security and data loss by reach, sends common Should-Fixes to the implementer, and keeps follow-ups on regressions',()=>{
 includesAll(['skills/review/CRITERIA.md'],['about 1 in 10,000 users, or a very unusual or complex application state','An older app version still in use is normal use','when someone outside the trust boundary can trigger it by sending something (a request, file, link, message or agent output), Reach is at least medium','Security and data-loss problems are graded by reach like any other finding','a finding no user or agent acts on','One that would lead a person or agent to do the wrong thing is a Should-Fix','A rare security or data-loss problem takes the same fix, mitigate or let-go decision as any other rare finding']);
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['by the first row that matches','| Should-Fix (rare), a security or data-loss problem, not flagged | the PR\'s implementer when a fix round is open and its fix or mitigation is small; otherwise the person |','carries the reviewer\'s grading line (Harm · Reach · Recovery → level) word for word','When the budget is used with only Should-Fixes open, they go to the PR\'s notes and card, with no question','name its root cause and recommend fixing that']);
 includesAll(['instructions/standing-rules.md'],['or a Should-Fix that is not rare, starts a round','rerun the QA journeys whose code changed since they last ran']);
 includesAll(REVIEWERS,['Resolved means the finding\'s original failure scenario no longer happens','security and data loss included, goes under **Noticed, not raised**']);
 const followUp=agent=>/A follow-up reads[\s\S]*?not the whole PR\./.exec(fs.readFileSync(path.join(root,'agents',agent),'utf8'))[0];
 assert.equal(followUp('claude-pr-reviewer.md'),followUp('codex-pr-reviewer.md'));
 for(const file of fs.readdirSync(root,{recursive:true}).map(String).filter(f=>/\.(md|html)$/.test(f))){
  const text=flatText(file);
  assert.doesNotMatch(text,/whatever the reach: any security|Security, PHI, data loss and public-contract problems are always fixed|only inside a fix round a Must-Fix already opened/,file);
  if(file.split(path.sep).join('/')!=='skills/review/CRITERIA.md')assert.doesNotMatch(text,/PHI exposure is (always )?Must-Fix|PHI[^.]*always Must-Fix/,file);
 }
});

test('greenfield 0.0.48 draws a PR diagram as one layout twice on a canvas at most 1600 px wide, with argument text at 20 px and details at 14 to 16 px',()=>{
 includesAll(['skills/excalidraw-pr-diagrams/SKILL.md'],['Keep the canvas at most 1600 px wide','are 20 px or larger','are 14–16 px, and badges 14 px','defaults to 16 px, the detail size','set `label.fontSize: 20` on the skeleton\'s labels']);
});

test('greenfield 0.0.49 renders the status page from the first working turn, re-renders a stale one on each wake-up, keeps the local file canonical, and shows the goal with no workers (P6)',t=>{
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['Write it at the Session\'s first working turn, even when nothing will be dispatched, and again after every ledger write','That file is the canonical page, and the one a host that shows the status page itself displays','never instead of the local file','**Session with no workers.**']);
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
 const item={id:'a',name:'A',workspace:'a',state:'now',next:'x'};
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

test('the overview reads top-down, questions show only as a count and Q-ids, and every card opens an existing item page that links back (J1, J2, C2, C3, C6)',t=>{
 const {run,out,itemsDir,pages,html,data}=renderSession(t,null,{example:true});
 assert.equal(run.status,0,run.stderr);
 const text=pageText(html);
 // J1: the order of the overview.
 const order=[data.session.title,'Next step:','wait for you in the host\'s question queue','work items','done','in progress','waiting on you','blocked','In flight','Order of work','Done','Decisions','Sources','Relevant links','Settings'];
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
 assert.match(text,new RegExp(`${data.needs.length} questions wait for you in the host's question queue`));
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
  if(waits.length){assert.equal(rows[0],'Waiting',`${x.id}: Waiting comes first`);for(const q of waits)assert.ok(text.includes(`${q.id} waits in the host's question queue`),`${x.id}: ${q.id}`);}
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

test('greenfield 0.0.51: item pages escape every field, keep only safe links, and say where questions wait when the host has no queue (C5)',t=>{
 const evil='<img src=x onerror=alert(1)>';
 const {run,html,pages}=renderSession(t,{session:{title:'Esc',eyebrow:'now',settings:'x',hostScheme:'host',summary:`Sum ${evil} <b>bold</b>`,nextStep:'Do <a href="javascript:alert(1)">this</a>'},
  needs:[{id:'Q-1',item:'a',q:'Secret question text?'}],
  items:[{id:'a',name:`A ${evil}`,kind:'tweak',group:`G ${evil}`,state:'need" onmouseover="x',pr:'#1',prLink:'javascript:alert(1)',workspaceLink:'data:text/html,x',asked:`Ask ${evil}`,changes:'<b>ok</b>',next:'n',
   refs:{task:{label:`T ${evil}`,link:'javascript:alert(1)',note:evil},pr:{label:'PR',link:'https://example.com/pr/1'},worker:{label:'Tab',link:'host://open?ws=p&agent=w'}}}]});
 assert.equal(run.status,0,run.stderr);
 const page=pages['a.html'];
 for(const p of [html,page]){
  assert.doesNotMatch(p,/<img|javascript:|data:text|onmouseover/);
  assert.ok(!p.includes('Secret question text?'));
 }
 assert.match(html,/Sum &lt;img src=x onerror=alert\(1\)> <b>bold<\/b>/,'summary keeps <b> and escapes the rest');
 assert.match(html,/class="card item now/,'an unknown state falls back to now');
 assert.match(pageText(html),/1 question waits for you in the orchestrator's chat: Q-1/,'no question queue link: the pointer names the chat');
 assert.match(page,/Q-1 waits in the orchestrator's chat/);
 assert.match(page,/<a href="#">T &lt;img/,'unsafe ref link becomes #');
 assert.match(page,/href="host:\/\/open\?ws=p&amp;agent=w"/);
 assert.match(page,/<tr><th>QA<\/th><td><span class="nr">Not recorded<\/span>/,'an empty fixed row shows Not recorded');
 assert.match(page,/<h1>A &lt;img src=x onerror=alert\(1\)><\/h1>/);
});

test('greenfield 0.0.51: the instructions say questions live only in the host\'s question queue, every item\'s front page is its generated item page, and the overview and item pages render together (C7, D-34)',()=>{
 includesAll(['skills/orchestrate-sessions/SKILL.md'],['Questions appear only in the host\'s question queue, or in your chat when the host has none','its item page, `items/<id>.html`, which the renderer generates for every item','the same run re-renders every item page with the overview','not to the brief']);
 includesAll(['skills/orchestrate-sessions/references/status-board.md'],['The overview and the item pages are always re-rendered together','No page shows a question\'s wording','the renderer ignores any other field','A missing, repeated or unsafe id stops it','"refs"','the renderer rebases them']);
 includesAll(['skills/orchestrate-sessions/references/ledger.md'],['"page_id":']);
 includesAll(['skills/customer-insights-loop/references/handoff.md'],['the status page shows it only by its Q-id']);
 for(const file of ['skills/orchestrate-sessions/SKILL.md','skills/orchestrate-sessions/references/status-board.md','skills/orchestrate-sessions/references/item-hub.md','skills/orchestrate-sessions/references/relay.md','skills/page/references/bundle.md','skills/customer-insights-loop/references/handoff.md','README.md']){
  const text=flatText(file);
  assert.doesNotMatch(text,/three-line summary|small hub|creating its hub|Needs you row|Needs you entry|"counts"|one state bar/,file);
 }
});

test('Greenfield carries no Pane-specific instructions: a host supplies its own through its injected instructions or host_policy (D-398)',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
 for(const file of walk(root)){
  if(!/\.(md|mjs|js|json|yaml|html)$/.test(file))continue;
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/\bpanes?\b|runpane|PANE_|pane:\/\/|"Asking the person in Pane"|Keep the Session tidy|secrets_request|"asked": "(relay \| )?notify"|through Notify|panel_id|panels wait/i,path.relative(path.join(root,'..'),file));
 }
});
