import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {hash,assertWorkspaceTrust,trustFile,validateTelemetry,mergeTelemetry,type TelemetrySettings,type WorkspaceMetadata} from './runtime.js';
import fs from 'node:fs';
import path from 'node:path';
import {parseDocument} from 'yaml';
import {configurationName} from './config.js';
import {connections} from './connections.js';
import type {Connection} from './runtime.js';

export interface Repository { root:string; common:string }
export interface WorkspaceData {name?:string; instructions:string; connections:Record<string,Connection>;telemetry?:TelemetrySettings}
export function repository(directory:string):Repository|undefined {
  let root=fs.realpathSync(directory);
  if(!fs.statSync(root).isDirectory())throw new Error(`Launch directory is not a directory: ${directory}`);
  for(;;){
    const marker=path.join(root,'.git');
    let stat:fs.Stats|undefined;
    try{stat=fs.lstatSync(marker);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    if(stat){
      let git=marker;
      if(stat.isFile()){
        const match=/^gitdir: (.+)\r?\n?$/.exec(fs.readFileSync(marker,'utf8'));
        if(!match)throw new Error(`Invalid Git directory file: ${marker}`);
        git=path.resolve(root,match[1]!);
      }else if(!stat.isDirectory())throw new Error(`Unsupported Git directory entry: ${marker}`);
      git=fs.realpathSync(git);
      if(!fs.statSync(git).isDirectory())throw new Error(`Invalid Git directory: ${git}`);
      const commonFile=path.join(git,'commondir');
      // The native realpath expands Windows short names, so every worktree of a repository shares one identity.
      const common=fs.realpathSync.native(fs.existsSync(commonFile)?path.resolve(git,fs.readFileSync(commonFile,'utf8').trim()):git);
      return {root,common};
    }
    const parent=path.dirname(root);if(parent===root)return;root=parent;
  }
}
export function repositoryFile(repo:Repository):{file:string;content:string}|undefined {
  const file=path.join(repo.root,'.agent-farm/workspace.yaml');
  let stat:fs.Stats;
  try{stat=fs.lstatSync(file);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
  if(stat.isSymbolicLink())throw new Error(`Refusing symlinked workspace file: ${file}`);
  const relative=path.relative(repo.root,fs.realpathSync(file));
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error(`Workspace resolves outside repository: ${file}`);
  if(!stat.isFile())throw new Error(`Workspace must be a regular file: ${file}`);
  return {file,content:fs.readFileSync(file,'utf8')};
}
export function mapping(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected a YAML mapping');
  return value as Record<string,unknown>;
}
export function workspaceDocument(content:string,file:string,kind:'repository'|'user'|'overlay') {
  try{
    const doc=parseDocument(content,{uniqueKeys:true});
    if(doc.errors.length)throw new Error(doc.errors.map(e=>e.message).join('; '));
    const data=mapping(doc.toJS({maxAliasCount:100}));
    const allowed=kind==='overlay'?['connections','instructions','telemetry']:['name','connections','instructions','telemetry'];
    for(const key of Object.keys(data))if(!allowed.includes(key))throw new Error(`Unsupported workspace field: ${key}`);
    if(kind==='repository'||data.name!==undefined)configurationName(data.name,'workspace name');
    if(data.instructions!==undefined&&typeof data.instructions!=='string')throw new Error('Workspace instructions must be text');
    if(data.connections!==undefined)mapping(data.connections);
    validateTelemetry(data.telemetry);
    return data;
  }catch(e){throw new Error(`${file}: ${(e as Error).message}`);}
}
export function validateWorkspace(data:Record<string,unknown>,file:string):WorkspaceData {
  const result:Record<string,Connection>=Object.create(null);
  for(const [key,value] of Object.entries(mapping(data.connections??{}))){
    try{Object.assign(result,connections({[key]:value}));}catch(e){throw new Error(`${file}: connection ${key}: ${(e as Error).message}`);}
  }
  let telemetry:TelemetrySettings|undefined;
  try{telemetry=validateTelemetry(data.telemetry);}catch(e){throw new Error(`${file}: ${(e as Error).message}`);}
  return {name:data.name as string|undefined,instructions:data.instructions as string??'',connections:result,...(telemetry===undefined?{}:{telemetry})};
}

export interface WorkspaceOptions {directory?:string;noWorkspace?:boolean;home?:string}
export interface ResolvedWorkspace extends WorkspaceData {metadata:WorkspaceMetadata;provenance:Record<string,string|string[]>}
export function noWorkspace(trust:WorkspaceMetadata['trust']='none'):ResolvedWorkspace {
  return {instructions:'',connections:{},metadata:{source:'none',trust},provenance:{}};
}
function readOptional(file:string):string|undefined {
  try{return fs.readFileSync(file,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
}
function provenance(data:Record<string,unknown>,source:string,result:Record<string,string|string[]>){
  if(data.instructions!==undefined)result.instructions=source;
  if(data.telemetry!==undefined){
    result.telemetry=source;
    for(const key of Object.keys(mapping(data.telemetry)))result[`telemetry.${key}`]=source;
    const access=mapping(data.telemetry).agent_access;
    if(access!==undefined)for(const key of Object.keys(mapping(access)))result[`telemetry.agent_access.${key}`]=source;
  }
  for(const [key,input] of Object.entries(mapping(data.connections??{}))){
    result[`connections.${key}`]=source;
    for(const [field,value] of Object.entries(mapping(input))){
      result[`connections.${key}.${field}`]=source;
      if(field==='env')for(const name of Object.keys(mapping(value)))result[`connections.${key}.env.${name}`]=source;
      if(field==='env_vars'&&Array.isArray(value))for(const name of value)result[`connections.${key}.env_vars.${name}`]=source;
    }
  }
}
export function applyOverlay(shared:WorkspaceData,content:string,file:string,sources:Record<string,string|string[]>):WorkspaceData {
  try{
    const data=workspaceDocument(content,file,'overlay'),merged:Record<string,unknown>={...shared.connections};
    for(const [key,input] of Object.entries(mapping(data.connections??{}))){
      try {
      configurationName(key);
      const patch=mapping(input),base=mapping(merged[key]??{});
      const next={...base,...patch};
      if(patch.env!==undefined){
        if(!patch.env||typeof patch.env!=='object'||Array.isArray(patch.env))throw new Error('env must map environment names to strings');
        next.env={...mapping(base.env??{}),...mapping(patch.env)};
      }
      if(patch.env_vars!==undefined){
        if(!Array.isArray(patch.env_vars))throw new Error(`connection ${key}: env_vars must be a list`);
        next.env_vars=[...new Set([...(Array.isArray(base.env_vars)?base.env_vars:[]),...patch.env_vars])];
      }
      merged[key]=next;
      } catch(e){throw new Error(`connection ${key}: ${(e as Error).message}`);}
    }
    const telemetry=mergeTelemetry(shared.telemetry,validateTelemetry(data.telemetry));
    const result=validateWorkspace({name:shared.name,connections:merged,instructions:[shared.instructions,data.instructions].filter(Boolean).join('\n\n'),telemetry},file);
    const previous={...sources};provenance(data,`overlay:${file}`,sources);
    if(data.telemetry!==undefined&&shared.telemetry!==undefined)sources.telemetry=[String(previous.telemetry),`overlay:${file}`];
    if(shared.telemetry?.agent_access!==undefined&&validateTelemetry(data.telemetry)?.agent_access!==undefined)sources['telemetry.agent_access']=[String(previous['telemetry.agent_access']),`overlay:${file}`];
    for(const key of Object.keys(mapping(data.connections??{})))if(shared.connections[key])sources[`connections.${key}`]=[String(previous[`connections.${key}`]),`overlay:${file}`];
    for(const [key,input] of Object.entries(mapping(data.connections??{}))){
      const patch=mapping(input),base=shared.connections[key];
      if(base&&'command' in base)for(const field of ['env','env_vars']){
        if(patch[field]!==undefined&&Object.keys(base[field as 'env'|'env_vars']).length)sources[`connections.${key}.${field}`]=[String(previous[`connections.${key}.${field}`]),`overlay:${file}`];
      }
      const single=result.connections[key]!;
      for(const field of Object.keys(single))sources[`connections.${key}.${field}`]??=`overlay:${file}`;
    }
    if(data.instructions!==undefined&&shared.instructions)sources.instructions=[String(previous.instructions),`overlay:${file}`];
    return result;
  }catch(e){if((e as Error).message.startsWith(file+':'))throw e;throw new Error(`${file}: ${(e as Error).message}`);}
}
interface Candidate {repo:Repository;file:string;content:string;data:WorkspaceData;metadata:WorkspaceMetadata}
function candidate(directory:string,home?:string):Candidate|undefined {
  const repo=repository(directory);if(!repo)return;
  const input=repositoryFile(repo);if(!input)return;
  const data=validateWorkspace(workspaceDocument(input.content,input.file,'repository'),input.file);
  const metadata:WorkspaceMetadata={source:`repository:${input.file}`,trust:'untrusted',repository:repo.root,common:repo.common,sha256:hash(input.content)};
  try{assertWorkspaceTrust({...metadata,trust:'trusted'},home);metadata.trust='trusted';}catch{/* The resolver reports the actionable trust error. */}
  return {...input,repo,data,metadata};
}
export function resolveWorkspace(root:string,options:WorkspaceOptions={}):ResolvedWorkspace {
  if(options.noWorkspace)return noWorkspace();
  const item=candidate(options.directory??process.cwd(),options.home);
  if(item){
    assertWorkspaceTrust(item.metadata,options.home);
    const sources:Record<string,string|string[]>={};
    provenance({...item.data},item.metadata.source,sources);
    const overlay=path.resolve(root,'overlays',item.data.name+'.yaml'),content=readOptional(overlay);
    const data=content===undefined?item.data:applyOverlay(item.data,content,overlay,sources);
    return {...data,metadata:{...item.metadata,...(content===undefined?{}:{overlay})},provenance:sources};
  }
  const file=path.resolve(root,'workspace.yaml'),content=readOptional(file);
  if(content===undefined)return noWorkspace();
  const document=workspaceDocument(content,file,'user'),data=validateWorkspace(document,file),source=`user:${file}`,sources:Record<string,string|string[]>={};
  provenance({...data},source,sources);
  return {...data,metadata:{source,trust:'personal'},provenance:sources};
}
function redacted(data:WorkspaceData){
  return {name:data.name,connections:Object.fromEntries(Object.entries(data.connections).map(([name,value])=>[name,'url' in value?value:{...value,env:Object.keys(value.env)}])),instructions:data.instructions,...(data.telemetry===undefined?{}:{telemetry:data.telemetry})};
}
function changedFields(before:unknown,after:unknown,prefix=''):string[]{
  if(JSON.stringify(before)===JSON.stringify(after))return [];
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after))return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>changedFields((before as Record<string,unknown>)[key],(after as Record<string,unknown>)[key],prefix?prefix+'.'+key:key));
  return [prefix];
}
function lastFile(common:string,home=os.homedir()){return path.join(home,'.local/state/agent-farm/workspace-trust',hash(common),'last.json');}
export function trustSummary(item:Candidate,home?:string):string {
  const previous=readOptional(lastFile(item.repo.common,home));
  let changes='';
  if(previous){
    const old=JSON.parse(previous) as {content:string;sha256:string};
    if(old.sha256!==item.metadata.sha256){
      const before=validateWorkspace(workspaceDocument(old.content,'previous approval','repository'),'previous approval');
      const fields=changedFields(before,item.data);
      changes=(fields.length?'Changed fields (environment values hidden): '+fields.join(', '):'Only file formatting, comments, or equivalent YAML representation changed.')+'\nPreviously approved:\n'+JSON.stringify(redacted(before),null,2)+'\n';
    }
  }
  return `Repository workspace: ${item.file}\nGit common directory: ${item.repo.common}\n${changes}Approve these connections, telemetry settings, and full instructions:\n${JSON.stringify(redacted(item.data),null,2)}`;
}
function saveJson(file:string,value:unknown){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temp=file+'.'+process.pid+'.tmp';
  try{fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
async function confirmApproval(summary:string,yes:boolean):Promise<boolean>{
  console.error(summary);
  if(yes)return true;
  if(!process.stdin.isTTY||!process.stderr.isTTY)throw new Error('Workspace approval requires an interactive terminal; use agent-farm workspace trust --yes for scripted approval');
  const {createInterface}=await import('node:readline/promises');
  const reader=createInterface({input:process.stdin,output:process.stderr});
  try{return /^y(es)?$/i.test((await reader.question('Trust this repository workspace? [y/N] ')).trim());}finally{reader.close();}
}
export async function trustWorkspace(directory:string,options:{home?:string;yes?:boolean;confirm?:(summary:string)=>Promise<boolean>}={}):Promise<boolean>{
  const item=candidate(directory,options.home);
  if(!item)throw new Error(`No repository workspace at ${directory}; expected .agent-farm/workspace.yaml`);
  const summary=trustSummary(item,options.home);
  const approved=await (options.confirm?options.confirm(summary):confirmApproval(summary,!!options.yes));
  if(!approved)return false;
  const current=candidate(directory,options.home);
  if(!current||current.repo.common!==item.repo.common||current.file!==item.file||current.content!==item.content)throw new Error(`Workspace changed during approval: ${item.file}; run agent-farm workspace trust again`);
  const record={version:1,common:item.repo.common,sha256:item.metadata.sha256};
  saveJson(trustFile(item.metadata,options.home),record);
  saveJson(lastFile(item.repo.common,options.home),{...record,content:item.content});
  return true;
}
export function untrustWorkspace(directory:string,home?:string){
  const repo=repository(directory);if(!repo)throw new Error(`Not inside a Git working tree: ${directory}`);
  const folder=path.dirname(lastFile(repo.common,home));
  // Revoke every approved version for this common directory, preserving the last summary.
  if(fs.existsSync(folder))for(const file of fs.readdirSync(folder))if(/^[a-f0-9]{64}\.json$/.test(file))fs.unlinkSync(path.join(folder,file));
}
export async function resolveInteractiveWorkspace(root:string,options:WorkspaceOptions={},confirm?:(summary:string)=>Promise<boolean>):Promise<ResolvedWorkspace>{
  if(options.noWorkspace)return noWorkspace();
  const directory=options.directory??process.cwd(),item=candidate(directory,options.home);
  if(item?.metadata.trust==='untrusted'){
    if(!await trustWorkspace(directory,{home:options.home,confirm})){
      console.error(`Declined ${item.file}; continuing with no workspace.`);
      return noWorkspace('declined');
    }
  }
  return resolveWorkspace(root,options);
}
export function showWorkspace(root:string,options:WorkspaceOptions={}){
  const item=options.noWorkspace?undefined:candidate(options.directory??process.cwd(),options.home);
  if(item?.metadata.trust==='untrusted'){
    // Explicit review output never enters compilation or a native harness.
    const sources:Record<string,string|string[]>={};
    provenance({...item.data},item.metadata.source,sources);
    const overlay=path.resolve(root,'overlays',item.data.name+'.yaml'),content=readOptional(overlay);
    const data=content===undefined?item.data:applyOverlay(item.data,content,overlay,sources);
    return {...data,metadata:{...item.metadata,...(content===undefined?{}:{overlay})},provenance:sources};
  }
  return resolveWorkspace(root,options);
}
export function generatedHint(directory:string,home=os.homedir()){
  const repo=repository(directory);if(!repo)return;
  const generated=path.join(directory,'.agent-farm/generated'),relative=path.relative(repo.root,generated);
  try{execFileSync('git',['-C',repo.root,'check-ignore','-q',relative+'/probe'],{stdio:'ignore'});return;}catch{/* Show once if the output is not ignored. */}
  const marker=path.join(home,'.local/state/agent-farm/generated-hints',hash(generated));
  if(fs.existsSync(marker))return;
  console.error(`Hint: add /${relative}/ to ${path.join(repo.root,'.gitignore')} to ignore generated Agent Farm bundles.`);
  fs.mkdirSync(path.dirname(marker),{recursive:true,mode:0o700});fs.writeFileSync(marker,'',{mode:0o600});
}
