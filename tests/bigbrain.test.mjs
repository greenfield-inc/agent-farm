import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parse} from 'yaml';
import {resolveProfile} from '../dist/compiler.js';
import {validatePlugin,installPlugin} from '../dist/plugins.js';

const repo=fileURLToPath(new URL('../',import.meta.url));
const root=path.join(repo,'plugins','bigbrain');
const cli=path.join(repo,'dist','cli.js');
const sync=path.join(repo,'scripts','sync-bigbrain-from-greenfield.mjs');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});
const tempDir=(t,prefix)=>{const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),prefix)));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
const run=(args,options={})=>spawnSync(process.execPath,args,{encoding:'utf8',...options});

const OWNED=['orchestrate','plan','implement-plan','design','investigate-issues','review','teach','documents'];
const COPIED=['page','brief','options','explain','spike','interview','architecture-diagram','codebase-design','tdd','quick-verify','investigate','gather-evidence','verify-app','pr-test-automation','prepare-pr','excalidraw-pr-diagrams','babysit-pr','create-ticket','handoff','session-trace','cold-read','research-web'];
const HELPERS=['explorer','researcher','review-worker','socrates','verifier'];

// The design's Models and Profiles tables: [harness, model, effort, skills, {child: [mode, harness, model, effort]}, args].
const OPUS='claude-opus-5-5',SONNET='claude-sonnet-5-5',SOL='gpt-6.1-sol',ASTRA='gpt-6-astra';
const WORKER_ARGS=['source','parent','docs'];
const IMPLEMENTER_SKILLS=['implement-plan','tdd','codebase-design','quick-verify','investigate','prepare-pr','excalidraw-pr-diagrams','babysit-pr','create-ticket','documents'];
const PLANNER_SKILLS=['explain','brief','options','spike','plan','page','interview','architecture-diagram','codebase-design','documents'];
const INVESTIGATOR_SKILLS=['investigate-issues','investigate','gather-evidence','page','documents'];
const MODELS={
 'orchestrator':['claude',OPUS,'medium',['orchestrate','page','interview','session-trace','handoff','documents'],{},['host_policy','docs']],
 'planner:claude':['claude',OPUS,'high',PLANNER_SKILLS,{explorer:['native','claude',SONNET,'low'],researcher:['native','claude',SONNET,'medium'],socrates:['native','claude',OPUS,'high']},WORKER_ARGS],
 'planner:codex':['codex',ASTRA,'high',PLANNER_SKILLS,{explorer:['native','codex',SOL,'low'],researcher:['native','codex',SOL,'low'],socrates:['process','claude',OPUS,'high']},WORKER_ARGS],
 'designer':['codex',SOL,'medium',['design','verify-app','page','documents'],{},WORKER_ARGS],
 'implementer:opus':['claude',OPUS,'medium',IMPLEMENTER_SKILLS,{explorer:['native','claude',SONNET,'low'],verifier:['native','claude',OPUS,'medium']},WORKER_ARGS],
 'implementer:astra':['codex',ASTRA,'medium',IMPLEMENTER_SKILLS,{explorer:['native','codex',SOL,'low'],verifier:['native','codex',SOL,'medium']},WORKER_ARGS],
 'implementer:sol':['codex',SOL,'medium',IMPLEMENTER_SKILLS,{explorer:['native','codex',SOL,'low'],verifier:['native','codex',SOL,'medium']},WORKER_ARGS],
 'reviewer:codex':['codex',SOL,'high',['review','documents'],{'bug-hunter-a':['native','codex',SOL,'medium'],'bug-hunter-b':['process','claude',OPUS,'medium'],finder:['process','claude',SONNET,'medium'],'checker-claude':['process','claude',OPUS,'medium'],'checker-codex':['native','codex',SOL,'medium']},[]],
 'reviewer:claude':['claude',OPUS,'high',['review','documents'],{'bug-hunter-a':['process','codex',SOL,'medium'],'bug-hunter-b':['native','claude',OPUS,'medium'],finder:['native','claude',SONNET,'medium'],'checker-claude':['native','claude',OPUS,'medium'],'checker-codex':['process','codex',SOL,'medium']},[]],
 'investigator:claude':['claude',OPUS,'high',INVESTIGATOR_SKILLS,{verifier:['native','claude',OPUS,'medium'],explorer:['native','claude',SONNET,'low']},['mode','area',...WORKER_ARGS]],
 'investigator:codex':['codex',SOL,'high',INVESTIGATOR_SKILLS,{verifier:['native','codex',SOL,'medium'],explorer:['native','codex',SOL,'low']},['mode','area',...WORKER_ARGS]],
 'teacher':['claude',OPUS,'high',['teach','page','documents'],{explorer:['native','claude',SONNET,'low']},WORKER_ARGS],
};
const DEFAULTS={planner:'claude',implementer:'opus',reviewer:'codex',investigator:'claude'};
const HELPER_SKILLS={verifier:['verify-app','pr-test-automation','design','documents'],explorer:['cold-read'],researcher:['research-web'],'review-worker':['review'],socrates:[]};

test('bigbrain validates as a plugin: every profile and variant resolves and the checksums cover the whole plugin (J-1, S-2)',t=>{
 const {info,profiles,checksums}=validatePlugin(root);
 assert.deepEqual([info.name,info.version,info.cli_major],['bigbrain','0.1.0',0]);
 assert.match(info.source.commit,/^[0-9a-f]{40}$/);
 assert.deepEqual(profiles.map(p=>p.profile).sort(),['designer','implementer','investigator','orchestrator','planner','reviewer','teacher']);
 for(const profile of profiles)if(DEFAULTS[profile.profile])assert.equal(profile.default_variant,DEFAULTS[profile.profile],profile.profile);
 assert.deepEqual(Object.keys(info.checksums).sort(),Object.keys(checksums).sort());
 const home=tempDir(t,'bigbrain-validate-');
 const result=run([cli,'plugin','validate',root,'--config-root',home],{env:{...process.env,HOME:home,USERPROFILE:home}});
 assert.equal(result.status,0,result.stderr);
});

test('the sync check passes on the committed plugin and fails on a hand-edited copy or a stale checksum (S-3)',t=>{
 const ok=run([sync,'--check']);
 assert.equal(ok.status,0,ok.stdout+ok.stderr);
 assert.match(ok.stdout,/every checksum is current/);
 const copy=path.join(tempDir(t,'bigbrain-sync-'),'bigbrain');
 fs.cpSync(root,copy,{recursive:true});
 fs.appendFileSync(path.join(copy,'skills','tdd','SKILL.md'),'\nA local edit.\n');
 const edited=run([sync,'--check','--plugin',copy]);
 assert.equal(edited.status,1);
 assert.match(edited.stderr,/copied skill tdd has a local edit \(edited: skills\/tdd\/SKILL\.md\)/);
 fs.copyFileSync(path.join(root,'skills','tdd','SKILL.md'),path.join(copy,'skills','tdd','SKILL.md'));
 fs.appendFileSync(path.join(copy,'instructions','glossary.md'),'\nA new term.\n');
 const stale=run([sync,'--check','--plugin',copy]);
 assert.equal(stale.status,1);
 assert.match(stale.stderr,/checksums are stale for bigbrain-owned instructions\/glossary\.md/);
 fs.copyFileSync(path.join(root,'instructions','glossary.md'),path.join(copy,'instructions','glossary.md'));
 fs.rmSync(path.join(copy,'skills','page'),{recursive:true});
 const missing=run([sync,'--check','--plugin',copy]);
 assert.equal(missing.status,1);
 assert.match(missing.stderr,/copied skill page is missing/,'a deleted copy is reported by name, not as a crash (F-9)');
 assert.doesNotMatch(missing.stderr,/ENOENT|at .*sync-bigbrain/);
 const greenfield=path.join(path.dirname(copy),'greenfield');
 fs.cpSync(path.join(repo,'plugins','greenfield'),greenfield,{recursive:true});
 fs.appendFileSync(path.join(greenfield,'skills','spike','SKILL.md'),'\nUpstream change.\n');
 const drift=run([sync,'--check','--greenfield',greenfield]);
 assert.equal(drift.status,0,'drift from current greenfield is information, not failure');
 assert.match(drift.stdout,/info: greenfield's spike differs from the pinned copy/);
});

test('each installed bigbrain profile inspects to the design\'s models, efforts, skills, children and args (J-1, S-4)',t=>{
 const base=tempDir(t,'bigbrain-inspect-'),home=path.join(base,'home'),work=path.join(base,'work');
 fs.mkdirSync(home);fs.mkdirSync(work);
 installPlugin(root,home);
 const env={...process.env,HOME:home,USERPROFILE:home};
 for(const [profile,[harness,model,effort,skills,children,args]] of Object.entries(MODELS)){
  const result=run([cli,'inspect',`bigbrain/${profile}`,'--config-root',home],{cwd:work,env});
  assert.equal(result.status,0,`${profile}: ${result.stderr}`);
  const agents=JSON.parse(result.stdout).agents,main=agents.main;
  assert.deepEqual([main.harness,main.model.name,main.model.reasoning],[harness,model,effort],profile);
  assert.deepEqual(main.skills.map(s=>s.name),skills,profile);
  assert.deepEqual(Object.keys(main.argument_definitions??{}),args,profile);
  assert.deepEqual(Object.keys(main.subagents??{}).sort(),Object.keys(children).sort(),profile);
  for(const [child,[mode,childHarness,childModel,childEffort]] of Object.entries(children)){
   const node=agents[`main/children/${child}`];
   assert.deepEqual([node.mode,node.harness,node.model.name,node.model.reasoning],[mode,childHarness,childModel,childEffort],`${profile} ${child}`);
  }
 }
 assert.equal(JSON.parse(run([cli,'inspect','bigbrain/investigator','--config-root',home],{cwd:work,env}).stdout).agents.main.arguments.mode,'report');
});

test('every bigbrain skill and agent is reached by a profile, and helpers carry their skills',()=>{
 const profiles=fs.readdirSync(path.join(root,'profiles')).flatMap(file=>{const name=file.replace(/\.yaml$/,''),variants=Object.keys(parse(fs.readFileSync(path.join(root,'profiles',file),'utf8')).variants??{});return [name,...variants.map(v=>`${name}:${v}`)];});
 const skills=new Set(),agents=new Set();
 for(const profile of profiles)for(const node of Object.values(resolveProfile(root,profile).nodes)){agents.add(node.name);node.skills.forEach(s=>skills.add(s));if(HELPER_SKILLS[node.name])assert.deepEqual(node.skills,HELPER_SKILLS[node.name],node.name);}
 assert.deepEqual(fs.readdirSync(path.join(root,'skills')).sort(),[...OWNED,...COPIED].sort());
 assert.deepEqual(fs.readdirSync(path.join(root,'skills')).filter(s=>!skills.has(s)),[]);
 assert.deepEqual(fs.readdirSync(path.join(root,'agents')).map(f=>f.replace(/\.md$/,'')).filter(a=>!agents.has(a)),[]);
 for(const agent of fs.readdirSync(path.join(root,'agents'))){
  const front=parse(/^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(root,'agents',agent),'utf8'))[1]);
  const expected=['../instructions/standing-rules.md','../instructions/contract.md','../instructions/glossary.md',...(agent.startsWith('planner')?['../instructions/planner-identity.md','../instructions/planner-documents.md']:[])];
  assert.deepEqual(front.instructions_files,expected,agent);
 }
});

// S-6: rules over bigbrain-owned text. Copied skills are governed by standing-rules (A-8, A-11).
const owned=()=>[
 ...walk(path.join(root,'agents')),...walk(path.join(root,'instructions')),
 ...OWNED.flatMap(skill=>walk(path.join(root,'skills',skill))).filter(f=>/\.(md|html)$/.test(f)),
];
const text=file=>fs.readFileSync(file,'utf8');
const rel=file=>path.relative(root,file).split(path.sep).join('/');

test('static: exactly five helper definitions, and the implementer has only explorer and verifier, writes alone and starts no reviewer (S-6)',()=>{
 const entry=new Set(fs.readdirSync(path.join(root,'profiles')).flatMap(file=>{const doc=parse(fs.readFileSync(path.join(root,'profiles',file),'utf8'));return doc.variants?Object.values(doc.variants).map(v=>v.agent):[doc.agent];}));
 assert.deepEqual(fs.readdirSync(path.join(root,'agents')).map(f=>f.replace(/\.md$/,'')).filter(a=>!entry.has(a)).sort(),HELPERS);
 const implementerFiles=[...walk(path.join(root,'agents')).filter(f=>/implementer-/.test(f)),...walk(path.join(root,'skills','implement-plan'))];
 for(const variant of ['opus','astra','sol'])assert.deepEqual(Object.keys(resolveProfile(root,`implementer:${variant}`).nodes.main.children).sort(),['explorer','verifier']);
 for(const file of implementerFiles){
  assert.doesNotMatch(text(file),/runpane\s+(panels|panes)\s+create|agent-farm\s+run/,`${rel(file)} starts another agent`);
  assert.doesNotMatch(text(file),/split the work into independent chunks|concurrently as native subagents|parallel writ\w+ subagents (?!—|-)/i,`${rel(file)} runs parallel writers`);
 }
});

test('static: no owned worker text puts a question to the person directly, and nothing loads every skill up front (S-6)',()=>{
 const workerFiles=owned().filter(f=>!/agents[\\/]orchestrator\.md$|skills[\\/]orchestrate[\\/]/.test(f));
 const direct=[/(?<!orchestrator (then )?)\bask(s|ed|ing)? (the person|the user)\b/i,/\bAskUserQuestion\b|\brequest_user_input\b/,/(?<!orchestrator )\bwait(s|ing)? (for|on) (the person|the user)\b/i,/(?<!orchestrator )\btell(s|ing)? the (person|user)\b/i];
 for(const file of workerFiles)for(const pattern of direct)assert.doesNotMatch(text(file),pattern,rel(file));
 const eager=/\bread (every|all) (of )?(your |the |its )?(`?SKILL\.md`?|skills)/i;
 for(const file of owned())for(const line of text(file).split('\n'))if(eager.test(line))assert.match(line,/\b(never|not|no)\b/i,`${rel(file)}: ${line}`);
});

test('writing limits: always-loaded instructions under 200 lines, owned SKILL.md under 500, no dates or model names in owned skill prose',()=>{
 for(const file of walk(path.join(root,'instructions')))assert.ok(text(file).split('\n').length<200,rel(file));
 for(const skill of OWNED){
  assert.ok(text(path.join(root,'skills',skill,'SKILL.md')).split('\n').length<500,skill);
  for(const file of walk(path.join(root,'skills',skill)).filter(f=>f.endsWith('.md'))){
   assert.doesNotMatch(text(file),/\b20\d\d-\d\d-\d\d\b/,`${rel(file)} has a date`);
   assert.doesNotMatch(text(file),/\b(claude-[a-z0-9-]+|gpt-[0-9][a-z0-9.-]*|Opus|Sonnet|Astra|Sol)\b/,`${rel(file)} names a model`);
  }
 }
});

test('the relay and control-flow contract keep the review-P-2 fixes (F-2, F-3, F-5, F-6, F-8)',()=>{
 const orchestrate=text(path.join(root,'skills','orchestrate','SKILL.md')).replace(/\s+/g,' ');
 const contract=text(path.join(root,'instructions','contract.md')).replace(/\s+/g,' ');
 const flow=text(path.join(root,'skills','documents','references','control-flow.md')).replace(/\s+/g,' ');
 const relay=text(path.join(root,'skills','orchestrate','references','relay.md')).replace(/\s+/g,' ');
 assert.match(orchestrate,/send `continue: <step>` only when no must-fix remains/,'F-2: the follow-up result is read before release');
 assert.match(orchestrate,/Checkpoint at a waived review step.{0,80}Confirm its `approved_by` D-n.{0,60}Start no reviewer\./,'F-3: a waiver starts no reviewer');
 assert.match(orchestrate,/Only an explicit "review now" starts a reviewer/);
 assert.match(contract,/A waived end review .* starts no reviewer/);
 assert.match(flow,/the orchestrator starts no reviewer/);
 assert.match(orchestrate,/Approval is two steps\..*do not start anything yet\..*When the planner reports `done` for that revision/,'F-5: dispatch after the planner persists approval');
 assert.match(contract,/`clarify: Q-7 → .*`: not an answer\. Keep Q-7 open/,'F-6: a question back is not an answer');
 assert.match(relay,/send `clarify: Q-n → <their question>`/);
 assert.doesNotMatch(relay,/answer: Q-n → \(question back\)/);
 assert.match(orchestrate,/a `quiz` skips steps 1, 4 and 5 and shows no recommended answer in step 3 \(no answering from a source, no recommended answer, no D-n\)/,'F-8: quiz semantics come first');
});

test('the implementer runs the control flow alone, with the QA loop, narrow writes, the D-24 post-mortem and the D-25 quick fix (P-3)',()=>{
 const skill=text(path.join(root,'skills','implement-plan','SKILL.md')).replace(/\s+/g,' ');
 for(const section of ['Unexpected issues','Critical decisions','Assumptions that were wrong','Thrashing'])assert.match(skill,new RegExp(`\\*\\*${section}:\\*\\*`),`post-mortem section ${section}`);
 assert.match(skill,/Each says "none" explicitly when there is nothing/);
 assert.match(skill,/## Quick fix .*No planner, no cover sheet, no reviewer\..*draft PR labelled `no-plan`.*Never start a reviewer, and never merge\./);
 assert.match(skill,/may set only `verdict`, `method`, `evidence`, `commit` and `round` on a row/);
 assert.match(skill,/Never add, remove or reword a row/);
 assert.match(skill,/the default is 3/);
 assert.match(skill,/Never mark it pass\./);
 assert.match(skill,/You never start a reviewer or a designer\./);
 for(const agent of ['implementer-opus','implementer-codex']){const body=text(path.join(root,'agents',agent+'.md'));assert.match(body,/Quick fix/);assert.match(body,/post-mortem\.html/);}
 const quality=text(path.join(root,'skills','design','references','design-quality.md'));
 for(const item of ['Layout shift','Overflow and clipping','Misalignment','Spacing off-scale','Missing states','Flicker','Focus and keyboard','Touch targets','Contrast','Dark mode','Phone width','Double submit','Slow feedback'])assert.match(quality,new RegExp(`\\| ${item} \\|`),item);
 const kinds=JSON.parse(text(path.join(root,'skills','documents','kinds.json')));
 for(const id of ['unexpected','critical-decisions','wrong-assumptions','thrashing'])assert.ok(kinds['post-mortem'].sections.includes(id),id);
});

test('reviewer v2: two-vendor bug hunters, other-vendor checkers, one COMMENT review with the step marker, no fixes (P-4)',()=>{
 const skill=text(path.join(root,'skills','review','SKILL.md')).replace(/\s+/g,' ');
 assert.match(skill,/post exactly one GitHub review with event `COMMENT`/);
 assert.match(skill,/<!-- bigbrain-review step=<step id> head=<sha> -->/);
 assert.match(skill,/\*\*Must-Fix\*\* only if a checker confirmed it/);
 assert.match(skill,/Suggestion\*\* at most five/);
 assert.match(skill,/Check only those F-n on the new head/);
 assert.match(skill,/You never fix, never approve or request changes/);
 assert.match(skill,/`checker-claude` for a candidate from a Codex worker, `checker-codex` for one from a Claude worker/);
 assert.ok(fs.existsSync(path.join(root,'skills','review','CRITERIA.md')));
 for(const variant of ['codex','claude']){
  const resolved=resolveProfile(root,`reviewer:${variant}`),nodes=resolved.nodes,children=nodes.main.children;
  const harness=name=>nodes[children[name]].harness;
  assert.notEqual(harness('bug-hunter-a'),harness('bug-hunter-b'),'bug hunters on different vendors');
  assert.deepEqual([harness('checker-claude'),harness('checker-codex')],['claude','codex']);
  for(const name of Object.keys(children))assert.equal(nodes[children[name]].name,'review-worker',`${variant} ${name} is the one review-worker definition`);
 }
});

test('designer and investigator: image tool checked first, options relayed, never edits source; reproduce before counting, route per D-17 (P-5)',()=>{
 const design=text(path.join(root,'skills','design','SKILL.md')).replace(/\s+/g,' ');
 assert.match(design,/## 0\. Check the image tool/);
 assert.match(design,/three genuinely different options/);
 assert.match(design,/`needs_you` of kind `choice`/);
 assert.match(design,/Only an explicit approval selects the final design/);
 assert.match(design,/\*\*must-match\*\* list/);
 assert.match(design,/Edit product source to make a mockup/);
 const investigate=text(path.join(root,'skills','investigate-issues','SKILL.md')).replace(/\s+/g,' ');
 for(const route of ['direct-to-implementer','options-first','cannot-reproduce'])assert.match(investigate,new RegExp('`'+route+'`'));
 assert.match(investigate,/An issue counts as confirmed only when it reproduced/);
 assert.match(investigate,/direct-to-implementer only once the person has said yes/);
 assert.match(investigate,/Fix, patch, refactor or plan\./);
});
