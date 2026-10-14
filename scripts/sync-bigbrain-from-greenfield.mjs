#!/usr/bin/env node
// Keeps plugins/bigbrain's copies of greenfield skills pinned and checksummed.
//
//   node scripts/sync-bigbrain-from-greenfield.mjs [--commit <sha>]
//     Copies the skills below from plugins/greenfield/skills at the pinned commit (default: the one
//     plugin.yaml records), then rewrites plugin.yaml's source and whole-plugin checksums. Run it after
//     every edit to a bigbrain-owned file too: validate fails until the checksums match.
//   node scripts/sync-bigbrain-from-greenfield.mjs --check [--plugin <dir>] [--greenfield <dir>]
//     Fails on a hand-edited copy or stale checksums. Reports drift from the current greenfield as
//     information, not failure: the copies are pinned on purpose. Needs no git history.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const COPIED=['page','brief','options','explain','spike','interview','architecture-diagram','codebase-design','tdd','quick-verify','investigate','gather-evidence','verify-app','pr-test-automation','prepare-pr','excalidraw-pr-diagrams','babysit-pr','create-ticket','handoff','session-trace','cold-read','research-web'];
const SECTIONS=['profiles','agents','skills','instructions','references'];
// npm never packs these, so a checksummed copy of one would fail validation after npm install.
const NOT_SHIPPED=new Set(['.gitignore','.npmignore','.npmrc','.DS_Store']);
const shipped=file=>!NOT_SHIPPED.has(file.split(/[\\/]/).pop());
const REPOSITORY='https://github.com/greenfield-inc/agent-farm';
const repo=fileURLToPath(new URL('..',import.meta.url));

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function walk(dir){
 const out=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,entry.name);if(entry.isDirectory())out.push(...walk(file));else out.push(file);}
 return out;
}
export function inventory(plugin){
 const sums={};
 for(const section of SECTIONS){const dir=path.join(plugin,section);if(fs.existsSync(dir))for(const file of walk(dir))sums[path.relative(plugin,file).split(path.sep).join('/')]=sha256(fs.readFileSync(file));}
 return sums;
}
export function readManifest(plugin){
 const file=path.join(plugin,'plugin.yaml');
 if(!fs.existsSync(file))return {checksums:{}};
 const text=fs.readFileSync(file,'utf8');
 const field=name=>new RegExp(`^${name}:\\s*(\\S+)\\s*$`,'m').exec(text)?.[1];
 const commit=/^source:\s*\n(?:\s+.*\n)*?\s+commit:\s*([0-9a-f]{40})\s*$/m.exec(text)?.[1];
 const block=/^checksums:\s*\n((?:\s+.+\n?)*)/m.exec(text)?.[1]??'';
 const checksums=Object.fromEntries([...block.matchAll(/^\s+(\S+):\s*([0-9a-f]{64})\s*$/gm)].map(m=>[m[1],m[2]]));
 return {name:field('name'),version:field('version'),commit,checksums};
}
function writeManifest(plugin,{name,version,commit}){
 const sums=inventory(plugin),lines=Object.keys(sums).sort().map(key=>`  ${key}: ${sums[key]}`);
 fs.writeFileSync(path.join(plugin,'plugin.yaml'),`name: ${name}\nversion: ${version}\ncli_major: 0\nsource:\n  repository: ${REPOSITORY}\n  commit: ${commit}\nchecksums:\n${lines.join('\n')}\n`);
 return Object.keys(sums).length;
}

function sync(plugin,commit){
 const git=(...args)=>execFileSync('git',args,{cwd:repo,maxBuffer:64*1024*1024});
 commit=git('rev-parse','--verify',`${commit}^{commit}`).toString().trim();
 for(const name of COPIED){
  const prefix=`plugins/greenfield/skills/${name}/`,target=path.join(plugin,'skills',name);
  const entries=git('ls-tree','-r','-z',commit,prefix).toString().split('\0').filter(Boolean);
  if(!entries.length)throw new Error(`greenfield@${commit.slice(0,7)} has no skill ${name}`);
  fs.rmSync(target,{recursive:true,force:true});
  for(const entry of entries){
   const [meta,file]=entry.split('\t'),[mode,type,object]=meta.split(' ');
   if(!shipped(file))continue;
   if(type!=='blob')throw new Error(`Unexpected ${type} in ${file}`);
   const destination=path.join(target,...file.slice(prefix.length).split('/'));
   fs.mkdirSync(path.dirname(destination),{recursive:true});
   fs.writeFileSync(destination,git('cat-file','blob',object),{mode:mode==='100755'?0o755:0o644});
  }
 }
 const current=readManifest(plugin);
 const files=writeManifest(plugin,{name:current.name??'bigbrain',version:current.version??'0.1.0',commit});
 console.log(`Synced ${COPIED.length} greenfield skills from ${commit.slice(0,7)}; plugin.yaml now checksums ${files} files.`);
}

export function check(plugin,greenfield){
 const manifest=readManifest(plugin),problems=[],notes=[];
 if(!manifest.commit)problems.push('plugin.yaml records no source commit for the copied skills');
 const recorded=manifest.checksums,actual=inventory(plugin);
 const copiedSkill=key=>{const m=/^skills\/([^/]+)\//.exec(key);return m&&COPIED.includes(m[1])?m[1]:null;};
 for(const key of new Set([...Object.keys(recorded),...Object.keys(actual)]).values()){
  if(recorded[key]===actual[key])continue;
  const change=!actual[key]?'deleted':!recorded[key]?'added':'edited';
  const skill=copiedSkill(key);
  if(skill)problems.push(`copied skill ${skill} has a local edit (${change}: ${key}). Copies are generated: undo the edit, or change greenfield and re-sync.`);
  else problems.push(`checksums are stale for bigbrain-owned ${key} (${change}). Run node scripts/sync-bigbrain-from-greenfield.mjs.`);
 }
 for(const name of COPIED)if(!fs.existsSync(path.join(plugin,'skills',name,'SKILL.md')))problems.push(`copied skill ${name} is missing`);
 if(greenfield&&fs.existsSync(greenfield)){
  for(const name of COPIED){
   const ours=path.join(plugin,'skills',name),theirs=path.join(greenfield,'skills',name);
   if(!fs.existsSync(theirs)){notes.push(`greenfield no longer has ${name}`);continue;}
   if(!fs.existsSync(ours))continue; // already reported as missing above
   const list=dir=>Object.fromEntries(walk(dir).filter(shipped).map(file=>[path.relative(dir,file).split(path.sep).join('/'),sha256(fs.readFileSync(file))]));
   const a=list(ours),b=list(theirs),changed=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(key=>a[key]!==b[key]);
   if(changed.length)notes.push(`greenfield's ${name} differs from the pinned copy (${changed.join(', ')}); re-sync when you want it`);
  }
 }
 return {problems,notes,commit:manifest.commit};
}

function main(argv){
 const option=name=>{const i=argv.indexOf(name);return i<0?undefined:argv[i+1];};
 const plugin=path.resolve(option('--plugin')??path.join(repo,'plugins','bigbrain'));
 if(argv.includes('--check')){
  const greenfield=path.resolve(option('--greenfield')??path.join(repo,'plugins','greenfield'));
  const {problems,notes,commit}=check(plugin,greenfield);
  for(const note of notes)console.log(`info: ${note}`);
  if(problems.length){for(const problem of problems)console.error(`FAIL ${problem}`);return 1;}
  console.log(`bigbrain copies match greenfield@${commit.slice(0,7)} and every checksum is current.`);
  return 0;
 }
 const commit=option('--commit')??readManifest(plugin).commit;
 if(!commit){console.error('No pinned commit: pass --commit <sha> the first time.');return 2;}
 sync(plugin,commit);
 return 0;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main(process.argv.slice(2));
