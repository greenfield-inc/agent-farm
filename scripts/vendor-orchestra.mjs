#!/usr/bin/env node
// Regenerates plugins/orchestra from a pinned dcouple/orchestra commit.
// Usage: node scripts/vendor-orchestra.mjs <orchestra checkout> <skills checkout> [orchestra commit] [skills commit]
// Skill, agent, and reference text is copied byte-for-byte. The only edits are
// the PATCHES below; each must match exactly once or the script fails.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parse} from 'yaml';

const OVERSEER=`You run dcouple/orchestra: /discussion, /create-brief, /do, /investigate,
/prepare-pull-request, /postmortem, and the other bundled skills, exactly as
they are written.

Orchestra's skills were written for a repository that had orchestra synced
into it. Under Agent Farm the same files live in this bundle instead:
- \`.references/<path>\` is the bundled references folder named below.
- \`.claude/agents/<role>.md\` is \`.references/claude-agents/<role>.md\`.
- \`.claude/skills/<name>/\` is the bundled skill of that name.
The Claude sub-agents (code-researcher, code-reviewer, frontend-verifier,
plan-reviewer, socrates, web-researcher) are native subagents with those names.
Codex roles are dispatched with \`codex exec\` through the codex skill.
Implementation follows the bundled \`tdd\` skill. Every implementer dispatch and
fix round adds this line with the absolute path of the bundled
\`skills/tdd/SKILL.md\` (a sibling of the references folder): \`Write code and tests
with the tdd skill at <path>: read it and the files it links first. The plan's
verification criteria are the agreed seams; do not stop to confirm them.\`
The repository's own AGENTS.md, CLAUDE.md, and docs remain authoritative for the project.

If no starter message is supplied, wait for the user's request.`;

const CODEX_OVERSEER=`You run dcouple/orchestra's Codex pipeline: $do, $investigate, and the role
skills (implementer, backend-verifier, frontend-verifier, code-researcher,
code-reviewer, plan-reviewer, investigator, web-researcher, refactor-simple,
refactor-deep, codex-security-scan), exactly as they are written.

Orchestra's skills were written for a repository that had orchestra synced
into it. Under Agent Farm the same files live in this bundle instead:
- \`.references/<path>\` is the bundled references folder named below.
- \`.claude/agents/<role>.md\` is \`.references/claude-agents/<role>.md\`.
- \`.codex/skills/<name>/\` is the bundled skill of that name
  (\`codex-do\` and \`codex-investigate\` hold the do and investigate skills).
Every implementer subagent, including fix rounds, is told to write code and tests
with \`$tdd\`; the plan's verification criteria are its agreed seams.
Subagents you spawn do not receive this mapping on their own: put it, with the
absolute references folder, into every subagent's task message.
The repository's own AGENTS.md and docs remain authoritative for the project.

If no starter message is supplied, wait for the user's request.`;

const AGENT_FARM_SKILLS=['babysit-pr','tdd','codebase-design','session-trace'];

const EXTRA_SKILLS=[
 {from:'parsa/.claude/skills/arena',to:'arena',harness:'claude'},
 {from:'parsa/.claude/skills/hillclimb',to:'hillclimb',harness:'claude'},
 {from:'parsa/.codex/skills/hillclimb',to:'codex-hillclimb',harness:'codex'},
];

const PATCHES=[
 {
  why:'codex falls back to Claude sub-agents when Codex is unavailable',
  file:'skills/codex/SKILL.md',
  from:`classified failure, not a success, and step 3 handles it.`,
  to:`classified failure, not a success, and step 3 handles it.

**Codex unavailable**: when a dispatch fails because Codex itself is
unavailable (its \`.log\` shows a usage limit, quota, or authentication error,
or \`codex\` is not installed), do not wait for a reset. Run the same role as a
Claude sub-agent with the same prompt and the same two files. A role with a
Claude twin (code-researcher, code-reviewer, plan-reviewer, web-researcher)
uses that agent; any other role (implementer, backend-verifier, investigator,
refactor-simple, refactor-deep) runs as a \`general-purpose\` sub-agent with an
explicit \`model\` (default \`opus\`) and the leaf-agent line. Implementer fix
rounds go back to the same sub-agent. Record \`runtime_fallback: claude\` and
the \`fallback_cause\` in \`plan.md\`, and route the rest of the run's Codex roles
to Claude the same way.`,
 },
 {
  why:'do accepts a Greenfield brief or PLAN.md instead of refusing it',
  file:'skills/do/SKILL.md',
  from:`Refuse politely if \`status\` isn't \`ready\` or verification criteria are
missing.`,
  to:`A Greenfield brief (page or issue) or \`PLAN.md\` is also ready. Take its
verification criteria from the brief's Success section or the plan's done-when
checks, as \`AC1\`, \`AC2\`, and so on. Otherwise, refuse politely if \`status\`
isn't \`ready\` or verification criteria are missing.`,
 },
 {
  why:'codex-do accepts a Greenfield brief or PLAN.md instead of refusing it',
  file:'skills/codex-do/SKILL.md',
  from:`Refuse politely if \`status\` isn't \`ready\` or verification criteria are
missing.`,
  to:`A Greenfield brief (page or issue) or \`PLAN.md\` is also ready. Take its
verification criteria from the brief's Success section or the plan's done-when
checks, as \`AC1\`, \`AC2\`, and so on. Otherwise, refuse politely if \`status\`
isn't \`ready\` or verification criteria are missing.`,
 },

 {
  why:'codex dispatch resolves orchestra paths through the bundled references',
  file:'skills/codex/SKILL.md',
  from:`**Path resolution**: all paths are relative to the current repo root -
\`.references/\` and \`.claude/agents/\` are synced into every consumer repo
from \`dcouple/orchestra\`. Confirm both files exist before dispatching - a
role that can't read its instructions improvises instead of failing.`,
  to:`**Path resolution**: under Agent Farm, \`.references/\` is the bundled
references folder named in your instructions, and \`.claude/agents/<role>.md\`
is \`.references/claude-agents/<role>.md\` inside it. Write both paths into the
prompt as absolute paths, and add this line to every prompt so the role can
follow the links inside those files: \`Paths written as .references/<path>
mean <absolute bundled references folder>/<path>.\` Confirm both files exist
before dispatching - a role that can't read its instructions improvises
instead of failing.`,
 },
 {
  why:'/do browser preflight detects a daemon or local run; a local run without a browser records a note instead of stopping',
  file:'skills/do/SKILL.md',
  from:`- Classify browser need from the authoritative loaded item before any browser
  preflight. E2E-browser criteria or a manual UI journey make the run browser
  required. On the initial daemon turn, if required and
  \`ORCHESTRA_BROWSER_REQUEST_FILE\` is present, atomically replace that file
  with JSON \`{ "requested": true }\` and return exactly
  \`ORCHESTRA_BROWSER_RELAUNCH_REQUIRED\` with no other terminal text. Never
  write the marker for a non-browser item. If browser proof is required but
  neither the request file nor \`ORCHESTRA_BROWSER_EVIDENCE_DIR\` is present,
  stop with an explicit browser-prerequisite failure.`,
  to:`- Classify browser need from the authoritative loaded item before any browser
  preflight. E2E-browser criteria or a manual UI journey make the run browser
  required. Then detect the run mode. **Daemon run** (\`ORCHESTRA_BROWSER_REQUEST_FILE\`
  or \`ORCHESTRA_BROWSER_EVIDENCE_DIR\` is set): on the initial daemon turn, if
  required and \`ORCHESTRA_BROWSER_REQUEST_FILE\` is present, atomically replace
  that file with JSON \`{ "requested": true }\` and return exactly
  \`ORCHESTRA_BROWSER_RELAUNCH_REQUIRED\` with no other terminal text. Never
  write the marker for a non-browser item. **Local run** (neither is set): use
  the Playwright MCP attached to this session (its tools end in
  \`browser_snapshot\`, \`browser_navigate\`, and so on; under Agent Farm the
  server is \`orchestra_playwright\`); prove it with the snapshot-then-close probe
  in the next item, using that server's tool names. Create an evidence directory outside the
  repository, \`\${TMPDIR:-/tmp}/orchestra-evidence/<id>/<attempt>\`, and use it,
  run id \`local-<id>\`, and attempt id \`<attempt>\` (\`1\`, then one higher for each
  QA retry) wherever this skill or the
  frontend-verifier names \`ORCHESTRA_BROWSER_EVIDENCE_DIR\`,
  \`ORCHESTRA_BROWSER_RUN_ID\`, or \`ORCHESTRA_BROWSER_ATTEMPT_ID\`; pass all three
  in the frontend-verifier dispatch. If no browser MCP is attached, record a
  preflight note naming the missing transport and continue; only the QA drive
  depends on it.`,
 },
 {
  why:'/do Step 5 accepts local run and attempt ids',
  file:'skills/do/SKILL.md',
  from:'its run/attempt ids to match the current daemon environment, require every',
  to:'its run/attempt ids to match the current daemon environment (on a local run,\n  the local run and attempt ids from Step 0), require every',
 },
 {
  why:'frontend-verifier accepts a dispatch-supplied evidence directory on local runs',
  file:'references/orchestra/claude-agents/frontend-verifier.md',
  from:'The daemon supplies `ORCHESTRA_BROWSER_EVIDENCE_DIR` for the current attempt.',
  to:'The daemon supplies `ORCHESTRA_BROWSER_EVIDENCE_DIR` for the current attempt; on a local run the dispatch supplies the evidence directory, run id, and attempt id instead.',
 },
];

const [checkout,skillsCheckout,ref='cd3d468682fdb727d109a762ebb131daa4e7ece8',skillsRef='a79b9fde21a94e1f21e9ce03ab0e9e5b9f61739e']=process.argv.slice(2);
if(!checkout||!skillsCheckout)throw new Error('Usage: node scripts/vendor-orchestra.mjs <orchestra checkout> <skills checkout> [orchestra commit] [skills commit]');
const skillsCommit=execFileSync('git',['rev-parse',skillsRef+'^{commit}'],{cwd:skillsCheckout,encoding:'utf8'}).trim();
const commit=execFileSync('git',['rev-parse',ref+'^{commit}'],{cwd:checkout,encoding:'utf8'}).trim();
const plugin=fileURLToPath(new URL('../plugins/orchestra/',import.meta.url));
const source=fs.mkdtempSync(path.join(os.tmpdir(),'orchestra-vendor-'));
try{
 execFileSync('sh',['-c','git archive "$1" claude codex references templates | tar -x -C "$2"','sh',commit,source],{cwd:checkout});
 execFileSync('sh',['-c','mkdir "$2/dcouple-skills" && git archive "$1" '+EXTRA_SKILLS.map(e=>e.from).join(' ')+' | tar -x -C "$2/dcouple-skills"','sh',skillsCommit,source],{cwd:skillsCheckout});
 fs.rmSync(plugin,{recursive:true,force:true});
 // npm never packs a file named .gitignore, so a vendored one would fail the installed plugin's checksums.
 const shipped=file=>path.basename(file)!=='.gitignore';
 const copy=(from,to)=>fs.cpSync(path.join(source,from),path.join(plugin,to),{recursive:true,filter:shipped});
 const write=(relative,text)=>{const file=path.join(plugin,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
 const skills=dir=>fs.readdirSync(path.join(source,dir)).filter(name=>fs.statSync(path.join(source,dir,name)).isDirectory());

 // Claude skills keep their names. Codex skills that share a name with a Claude
 // skill get a codex- directory; their frontmatter names are unchanged.
 const claudeSkills=skills('claude/skills'),codexSkills=skills('codex/skills');
 for(const name of claudeSkills)copy(`claude/skills/${name}`,`skills/${name}`);
 const codexDirectory=name=>claudeSkills.includes(name)?`codex-${name}`:name;
 for(const name of codexSkills)copy(`codex/skills/${name}`,`skills/${codexDirectory(name)}`);
 // Skills /do still calls after orchestra moved them to dcouple/skills.
 for(const extra of EXTRA_SKILLS)copy(`dcouple-skills/${extra.from}`,`skills/${extra.to}`);
 // Agent Farm's own general-purpose skills, copied so this plugin stays self-contained.
 for(const name of AGENT_FARM_SKILLS)fs.cpSync(fileURLToPath(new URL(`../plugins/greenfield/skills/${name}/`,import.meta.url)),path.join(plugin,'skills',name),{recursive:true,filter:shipped});
 const claudeExtras=EXTRA_SKILLS.filter(e=>e.harness==='claude').map(e=>e.to),codexExtras=EXTRA_SKILLS.filter(e=>e.harness==='codex').map(e=>e.to);

 // One shared folder stands in for the repo-root .references/ that orchestra's
 // sync.sh used to install, plus the Claude agent files the Codex dispatch reads.
 copy('references','references/orchestra');
 copy('claude/agents','references/orchestra/claude-agents');
 copy('templates','references/orchestra/templates');
 fs.rmSync(path.join(plugin,'references/orchestra/claude-agents/README.md'),{force:true});

 for(const patch of PATCHES){
  const file=path.join(plugin,patch.file),text=fs.readFileSync(file,'utf8'),count=text.split(patch.from).length-1;
  if(count!==1)throw new Error(`Patch "${patch.why}" matched ${count} times in ${patch.file}`);
  fs.writeFileSync(file,text.replace(patch.from,patch.to));
 }

 // Claude sub-agents: the orchestra body verbatim, with Agent Farm frontmatter.
 const roles=fs.readdirSync(path.join(source,'claude/agents')).filter(f=>f.endsWith('.md')&&f!=='README.md').map(f=>f.slice(0,-3)).sort();
 for(const role of roles){
  const text=fs.readFileSync(path.join(plugin,'references/orchestra/claude-agents',role+'.md'),'utf8'),match=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if(!match)throw new Error(`Missing frontmatter: claude/agents/${role}.md`);
  const meta=parse(match[1]);if(typeof meta.model!=='string'||typeof meta.description!=='string')throw new Error(`claude/agents/${role}.md needs a model and a description`);
  write(`agents/${role}.md`,`---\nharness: claude\nmodel: ${meta.model}\ndescription: ${JSON.stringify(meta.description.trim())}\nreferences: orchestra\n---\n${match[2].replace(/^\n+/,'')}`);
 }
 const subagents=roles.map(role=>`  ${role}:\n    agent: ${role}\n    mode: native\n`).join('');
 write('agents/overseer.md',`---
harness: claude
model:
  name: claude-opus-5-5
description: "The full Orchestra workflow: talk a task through, write the brief, then build, test, and review it into a pull request with little hand-holding."
skills: [${[...claudeSkills,...claudeExtras,...AGENT_FARM_SKILLS].join(', ')}]
references: orchestra
connections:
  linear:
    type: mcp
    url: https://mcp.linear.app/mcp
    auth: native
  playwright:
    type: mcp
    command: npx
    args: ["-y", "@playwright/mcp@latest"]
subagents:
${subagents}---
${OVERSEER}`);
 write('agents/codex-overseer.md',`---
harness: codex
model:
  name: gpt-6-astra
  reasoning: high
description: "The full Orchestra workflow: talk a task through, write the brief, then build, test, and review it into a pull request with little hand-holding."
skills: [${[...codexSkills.map(codexDirectory),...codexExtras,...AGENT_FARM_SKILLS].join(', ')}]
references: orchestra
connections:
  linear:
    type: mcp
    url: https://mcp.linear.app/mcp
    auth: native
---
${CODEX_OVERSEER}`);
 write('profiles/overseer.yaml','variants:\n  claude:\n    agent: overseer\n  codex:\n    agent: codex-overseer\ndefault: claude\n');
 // A hand-written guide to the plugin; edit scripts/orchestra-guide.html, not the copy.
 fs.copyFileSync(fileURLToPath(new URL('orchestra-guide.html',import.meta.url)),path.join(plugin,'index.html'));
 write('README.md',`# orchestra

dcouple/orchestra at [\`${commit.slice(0,7)}\`](https://github.com/dcouple/orchestra/tree/${commit}), packaged for Agent Farm.
Regenerate with \`node scripts/vendor-orchestra.mjs <orchestra checkout> <skills checkout> [orchestra commit] [skills commit]\`; do not edit these files by hand.

For a one-page visual map of the workflow, open [index.html](index.html) (edit \`scripts/orchestra-guide.html\`, not the copy). It's also on Grain: [view the guide](https://rungrain.com/share/dmnwnvk2hbvsxcart76f29jk).

<img alt="Orchestra map: /discussion, /create-brief and /do, with your steps in green" src="../../docs/assets/guides/orchestra-map.png">

\`/do\` still calls \`arena\` and \`hillclimb\`, which orchestra had moved to dcouple/skills before this commit. They are bundled from dcouple/skills at [\`${skillsCommit.slice(0,7)}\`](https://github.com/greenfield-inc/skills/tree/${skillsCommit}): ${EXTRA_SKILLS.map(e=>`\`${e.from}\` as \`${e.to}\``).join(', ')}. No Codex \`arena\` exists, so the Codex \`/do\` arena step stays unavailable, as it was before.

Both variants also get Agent Farm's ${AGENT_FARM_SKILLS.map(n=>`\`${n}\``).join(', ')}, copied from \`plugins/greenfield/skills/\`, \`babysit-pr\` watches a pull request's CI and review bots after \`/do\` or \`/prepare-pull-request\` opens it; \`tdd\` (with \`codebase-design\`) is how every implementer writes code and tests, passed to each implementer dispatch; \`session-trace\` publishes the run as a trace page in Grain when the task has one.

| Profile | Harness and model | What it loads |
| --- | --- | --- |
| \`orchestra/overseer:claude\` (default) | Claude, claude-opus-5-5 | The ${claudeSkills.length} Claude skills (${claudeSkills.join(', ')}) plus ${claudeExtras.join(' and ')}, the ${roles.length} Claude agents as native subagents, Linear and Playwright MCP. Codex roles run through \`codex exec\` as in orchestra. |
| \`orchestra/overseer:codex\` | Codex, gpt-6-astra (high) | The ${codexSkills.length} Codex skills, with \`do\` and \`investigate\` in \`codex-do\` and \`codex-investigate\`, plus ${codexExtras.join(', ')}. |

Both variants select \`references: orchestra\`, which holds orchestra's \`references/\` folder, its Claude agent files under \`claude-agents/\`, and \`templates/\`.
Skills cite \`.references/<path>\`; Agent Farm maps that to the bundled folder at launch.

Text is copied unchanged except for ${PATCHES.length} patches listed in the vendor script:
${PATCHES.map(patch=>`- \`${patch.file}\`: ${patch.why}.`).join('\n')}

Orchestra's Claude agents restrict their tools (reviewers and researchers are read-only). Agent Farm native subagents get a prompt, model, and effort only, so those allowlists are not enforced; the agents stay read-only by their written charters.

Skills with the same name in \`~/.claude/skills\` or \`~/.codex/skills\` are still visible to the launched harness. Save and unmount them with \`agent-farm unset global --save <name> --harness claude|codex --model <model-id>\` to run orchestra's versions only.
`);

 const checksums={};
 const walk=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else checksums[path.relative(plugin,file)]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');}};
 for(const section of ['agents','profiles','references','skills'])walk(path.join(plugin,section));
 const lines=Object.keys(checksums).sort().map(key=>`  ${key}: ${checksums[key]}`);
 write('plugin.yaml',`name: orchestra\nversion: 0.1.8\ncli_major: 0\nsource:\n  repository: https://github.com/dcouple/orchestra\n  commit: ${commit}\nchecksums:\n${lines.join('\n')}\n`);
 console.log(`Vendored dcouple/orchestra@${commit.slice(0,7)} + dcouple/skills@${skillsCommit.slice(0,7)} (${EXTRA_SKILLS.length} skills): ${claudeSkills.length} Claude skills, ${codexSkills.length} Codex skills, ${roles.length} Claude agents, ${Object.keys(checksums).length} files`);
}finally{fs.rmSync(source,{recursive:true,force:true});}

