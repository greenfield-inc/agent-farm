import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {resolve,resolveProfile,splitVariant} from './compiler.js';
import {stringify} from 'yaml';
import {files,hash,symlink} from './runtime.js';
import {userSkillSource} from './skill-layout.js';
import {namespaces} from './config.js';

type Harness = 'claude' | 'codex';
interface Entry { name:string; plugin?:string; source: string; destination: string }
interface Loaded { profile: string; variant?: string; plugin?:string; plugin_version?:string; harness: Harness; root: string; skills: Entry[] }
interface State { version: 1; profiles: Record<string,Loaded> }
export interface UserSkillOptions { home?: string; env?: NodeJS.ProcessEnv; harness?: string }
function harness(value: string): Harness {
  if (value!=='claude' && value!=='codex') throw new Error('harness must be claude or codex');
  return value;
}
function stat(file: string) {
  try { return fs.lstatSync(file); } catch (e) { if ((e as NodeJS.ErrnoException).code==='ENOENT') return undefined; throw e; }
}
function owned(entry: Entry): boolean {
  return !!stat(entry.destination)?.isSymbolicLink() && path.resolve(path.dirname(entry.destination),fs.readlinkSync(entry.destination))===entry.source;
}
function withState<T>(options: UserSkillOptions, action: (state: State, save: ()=>void)=>T): T {
  const dir=path.join(options.home ?? os.homedir(),'.local/state/agent-farm/user-skills');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const lock=path.join(dir,'lock');
  try { fs.mkdirSync(lock); } catch (e) {
    if ((e as NodeJS.ErrnoException).code==='EEXIST') throw new Error(`Another skill operation is active (or left a stale lock): ${lock}`);
    throw e;
  }
  const file=path.join(dir,'state.json');
  try {
    const state: State=fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : {version:1,profiles:{}};
    if (state.version!==1 || !state.profiles || typeof state.profiles!=='object' || Array.isArray(state.profiles)) throw new Error('Invalid user-skill ownership registry');
    return action(state,()=>{
      const temp=path.join(dir,'state.tmp');
      fs.writeFileSync(temp,JSON.stringify(state,null,2),{mode:0o600});
      fs.renameSync(temp,file);
    });
  } finally { fs.rmdirSync(lock); }
}
export function loadedProfiles(options: UserSkillOptions={}): Loaded[] {
  return withState(options,state=>Object.values(state.profiles));
}
export function loadProfile(root: string, profile: string, options: UserSkillOptions={}): Loaded {
  root=fs.realpathSync(root);
  const resolved=resolveProfile(root,profile),agent=resolved.nodes.main!;
  const selected=harness(options.harness ?? agent.harness);
  const home=options.home ?? os.homedir(),env=options.env ?? process.env;
  const nativeHome=selected==='codex' ? env.AGENT_FARM_NATIVE_CODEX_HOME ?? env.ORCHESTRA_NATIVE_CODEX_HOME ?? env.CODEX_HOME ?? path.join(home,'.codex') : env.CLAUDE_CONFIG_DIR ?? path.join(home,'.claude');
  const directory=path.resolve(nativeHome,'skills');
  return withState(options,(state,save)=>{
    fs.mkdirSync(directory,{recursive:true});
    const target=fs.realpathSync(directory);
    const item: Loaded={profile:resolved.profile,...(resolved.variant?{variant:resolved.variant}:{}),plugin:resolved.plugin,plugin_version:resolved.plugin_version,harness:selected,root,skills:agent.skills.map(skill=>({name:skill,plugin:agent.skill_plugins?.[skill]?.plugin,source:userSkillSource(fs.realpathSync(agent.skill_sources![skill]!),selected,home),destination:path.join(target,skill)}))};
    const key=selected+':'+resolved.profile,previous=state.profiles[key];
    if (previous) {
      if (JSON.stringify(previous)!==JSON.stringify(item)) throw new Error('Profile selection changed; unload the existing profile before loading it again');
      for (const entry of previous.skills) if (!owned(entry)) throw new Error(`Managed skill changed or disappeared; preserving it: ${entry.destination}`);
      return previous;
    }
    const tracked=Object.values(state.profiles).flatMap(p=>p.skills);
    for (const entry of item.skills) {
      const shared=tracked.find(e=>e.destination===entry.destination);
      if (shared && (shared.source!==entry.source || !owned(shared))) {
        const owner=Object.values(state.profiles).find(p=>p.skills.some(e=>e.destination===entry.destination));
        throw new Error(`Skill ${entry.name} from plugin ${entry.plugin??resolved.plugin??'local'} conflicts with plugin ${owner?.plugin??'local'} (${owner?.profile??'unknown profile'}) at ${entry.destination}`);
      }
      if (!shared && stat(entry.destination)) throw new Error(`Skill ${entry.name} from plugin ${entry.plugin??resolved.plugin??'local'} conflicts with an existing user skill at ${entry.destination}; it will not be overwritten`);
    }
    const created: Entry[]=[];
    try {
      for (const entry of item.skills) if (!tracked.some(e=>e.destination===entry.destination)) {
        symlink(entry.source,entry.destination); created.push(entry);
      }
      state.profiles[key]=item;save();
    } catch (e) {
      for (const entry of created.reverse()) if (owned(entry)) fs.unlinkSync(entry.destination);
      throw e;
    }
    return item;
  });
}
export function unloadProfile(profile: string, options: UserSkillOptions={}): Loaded[] {
  if (options.harness) harness(options.harness);
  // Loaded state is keyed by profile, so `name:variant` unloads whichever variant of that profile is loaded.
  profile=splitVariant(profile).name;
  return withState(options,(state,save)=>{
    let matches=Object.entries(state.profiles).filter(([,p])=>(p.profile===profile||(!profile.includes('/')&&p.profile.endsWith('/'+profile)))&&(!options.harness||p.harness===options.harness));
    if(!profile.includes('/')&&new Set(matches.map(([,p])=>p.profile)).size>1)throw new Error(`Loaded profile ${profile} is ambiguous; use one of: ${[...new Set(matches.map(([,p])=>p.profile))].join(', ')}`);
    if (!matches.length) throw new Error(`Profile is not loaded: ${profile}`);
    const remaining=Object.entries(state.profiles).filter(([key])=>!matches.some(([remove])=>remove===key));
    const retained=new Set(remaining.flatMap(([,p])=>p.skills.map(s=>s.destination)));
    const removals=[...new Map(matches.flatMap(([,p])=>p.skills).filter(s=>!retained.has(s.destination)).map(s=>[s.destination,s])).values()];
    // Preflight everything before removing anything. Missing links are already unloaded.
    for (const entry of removals) if (stat(entry.destination) && !owned(entry)) throw new Error(`Managed skill was replaced; preserving it: ${entry.destination}`);
    const removed: Entry[]=[];
    try {
      for (const entry of removals) if (owned(entry)) { fs.unlinkSync(entry.destination); removed.push(entry); }
      for (const [key] of matches) delete state.profiles[key];
      save();
    } catch (e) {
      for (const entry of removed) if (!stat(entry.destination)) symlink(entry.source,entry.destination);
      throw e;
    }
    return matches.map(([,p])=>p);
  });
}

export interface GlobalSkill { name:string; destination:string; status:'managed'|'unmanaged'|'changed'; profiles:string[] }
function skillDirectories(selected:Harness,options:UserSkillOptions):string[] {
  const home=options.home ?? os.homedir(),env=options.env ?? process.env;
  const native=selected==='codex' ? env.AGENT_FARM_NATIVE_CODEX_HOME ?? env.ORCHESTRA_NATIVE_CODEX_HOME ?? env.CODEX_HOME ?? path.join(home,'.codex') : env.CLAUDE_CONFIG_DIR ?? path.join(home,'.claude');
  return [...new Set([path.resolve(native,'skills'),...(selected==='codex'?[path.join(home,'.agents/skills')]:[])].map(d=>fs.existsSync(d)?fs.realpathSync(d):d))];
}
function scanSkills(selected:Harness,options:UserSkillOptions,state:State):GlobalSkill[] {
  const result:GlobalSkill[]=[];
  for(const dir of skillDirectories(selected,options)) {
    if(!fs.existsSync(dir))continue;
    for(const name of fs.readdirSync(dir).sort()) {
      if(name.startsWith('.') || (selected==='claude' && name.toLowerCase()==='synced'))continue;
      const destination=path.join(dir,name);
      const tracked=Object.values(state.profiles).filter(p=>p.skills.some(e=>e.destination===destination));
      if(!tracked.length && !fs.existsSync(path.join(destination,'SKILL.md')))continue;
      const intact=tracked.every(p=>p.skills.filter(e=>e.destination===destination).every(owned));
      result.push({name,destination,status:tracked.length?(intact?'managed':'changed'):'unmanaged',profiles:tracked.map(p=>p.profile)});
    }
  }
  return result;
}
export function globalSkills(options:UserSkillOptions):GlobalSkill[] {
  const selected=harness(options.harness ?? '');
  return withState(options,state=>scanSkills(selected,options,state));
}
export function globalSkillWarning(options:UserSkillOptions):string|undefined {
  const entries=globalSkills(options);
  if(!entries.length)return undefined;
  const selected=harness(options.harness!);
  const lines=[`Warning: ${entries.length} global skill(s) may add context outside this agent profile (${selected}).`,
    ...entries.map(e=>`  ${e.name}: ${e.status}${e.profiles.length?' ('+e.profiles.join(', ')+')':''} — ${e.destination}`)];
  for(const profile of new Set(entries.filter(e=>e.status==='managed').flatMap(e=>e.profiles)))lines.push(`Unmount managed skills: agent-farm unset global ${profile} --harness ${selected}`);
  if(entries.some(e=>e.status==='unmanaged'))lines.push(`Save and unmount pre-existing skills: agent-farm unset global --save my-global-skills --harness ${selected} --model <model-id>`);
  if(entries.some(e=>e.status==='changed'))lines.push('Changed managed links are preserved. Restore their recorded links before unsetting the profile.');
  lines.push('The launch will continue. Use agent-farm status global for ownership details.');
  return lines.join('\n');
}
function snapshot(folder:string):string {
  return hash(JSON.stringify(files(folder).map(file=>[path.relative(folder,file),fs.statSync(file).mode,hash(fs.readFileSync(file))])));
}
/** Preserve a complete, validated copy before moving any pre-existing skill. */
export function saveGlobalSkills(root:string,profile:string,model:string,options:UserSkillOptions):{profile:string;backup:string;skills:number} {
  const selected=harness(options.harness ?? '');
  if(!/^[a-z][a-z0-9_-]{0,63}$/.test(profile))throw new Error('Expected a lowercase profile name, not a path');
  if(!model?.trim())throw new Error('Saving a profile requires --model MODEL to pin its launch model');
  fs.mkdirSync(root,{recursive:true});root=fs.realpathSync(root);
  return withState(options,state=>{
    const entries=scanSkills(selected,options,state).filter(e=>e.status==='unmanaged');
    if(!entries.length)throw new Error('No unmanaged global skills to save; use unset global PROFILE for managed skills');
    if(new Set(entries.map(e=>e.name)).size!==entries.length)throw new Error('Duplicate skill directory names across global roots; resolve them before saving');
    for(const e of entries) {
      const source=fs.realpathSync(e.destination);
      if(root===source || root.startsWith(source+path.sep))throw new Error('Configuration library must be outside the skills being saved');
      if(!/^[a-z][a-z0-9_-]{0,63}$/.test(e.name))throw new Error(`Skill directory name is not supported by profiles: ${e.name}`);
      if(stat(path.join(root,'skills',e.name)))throw new Error(`Saved skill would overwrite an existing file: ${e.name}`);
    }
    const profileFile=path.join(root,'profiles',profile+'.yaml'),agentFile=path.join(root,'agents',profile+'.md');
    if(stat(profileFile)||stat(agentFile)||stat(path.join(root,'agents',profile+'.yaml'))||stat(path.join(root,'agents',profile,'agent.yaml')))throw new Error('Profile or agent already exists; choose another name');
    // Originals (including symlinks) remain recoverable outside native discovery roots.
    const backupRoot=path.join(options.home ?? os.homedir(),'.local/state/agent-farm/skill-backups');
    fs.mkdirSync(backupRoot,{recursive:true,mode:0o700});
    const backup=fs.mkdtempSync(path.join(backupRoot,'saved-'));
    const stage=fs.mkdtempSync(path.join(root,'.saving-skills-'));
    const installed:string[]=[],moved:{from:string;to:string}[]=[];
    let saved=false;
    try {
      for(const e of entries) {
        const dest=path.join(stage,'skills',e.name);
        fs.cpSync(e.destination,dest,{recursive:true,dereference:true,errorOnExist:true,force:false});
        // A second copy catches source edits and validates dereferenced content before unmounting.
        const verify=path.join(stage,'verify',e.name);
        fs.cpSync(e.destination,verify,{recursive:true,dereference:true});
        if(snapshot(dest)!==snapshot(verify))throw new Error(`Skill changed while saving: ${e.destination}`);
      }
      fs.mkdirSync(path.join(stage,'profiles'));fs.mkdirSync(path.join(stage,'agents'));
      fs.writeFileSync(path.join(stage,'profiles',profile+'.yaml'),stringify({agent:profile}));
      fs.writeFileSync(path.join(stage,'agents',profile+'.md'),'---\n'+stringify({harness:selected,model,skills:entries.map(e=>e.name)})+'---\n');
      resolve(stage,profile);
      const outputs=[...entries.map(e=>path.join('skills',e.name)),path.join('agents',profile+'.md'),path.join('profiles',profile+'.yaml')];
      for(const relative of outputs) {
        const dest=path.join(root,relative);
        fs.mkdirSync(path.dirname(dest),{recursive:true});
        if(stat(dest))throw new Error(`Destination appeared while saving: ${dest}`);
        fs.renameSync(path.join(stage,relative),dest);installed.push(dest);
      }
      resolveProfile(root,profile,undefined,{namespace:namespaces(root)[0]});saved=true;
      const receipt={profile,root,harness:selected,entries:entries.map((e,i)=>({from:e.destination,to:path.join(backup,String(i))}))};
      fs.writeFileSync(path.join(backup,'receipt.json'),JSON.stringify(receipt,null,2),{mode:0o600});
      for(const e of receipt.entries) {
        fs.renameSync(e.from,e.to);moved.push(e);
      }
      return {profile,backup,skills:entries.length};
    } catch(error) {
      for(const e of moved.reverse())if(!stat(e.from))fs.renameSync(e.to,e.from);
      // Once validated, retain the saved profile even if unmounting fails.
      if(!saved)for(const file of installed.reverse())fs.rmSync(file,{recursive:true,force:true});
      throw new Error(`${error instanceof Error?error.message:error}${saved?`; saved profile retained at ${profileFile}; originals/receipt: ${backup}`:''}`);
    } finally {fs.rmSync(stage,{recursive:true,force:true});}
  });
}
