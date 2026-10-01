import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseDocument,stringify} from 'yaml';
import {configurationName,pluginIdentity} from './config.js';
import {resolveProfile} from './compiler.js';
import {files,hash} from './runtime.js';

const sections=['profiles','agents','skills','instructions','references'];
interface Plugin{name:string;version:string;cli_major:number;source?:{repository:string;commit:string};checksums?:Record<string,string>}
interface Receipt{name:string;version:string;layout?:number;source?:unknown;checksums:Record<string,string>}

function manifest(root:string):Plugin{
 const file=path.join(root,'plugin.yaml'),doc=parseDocument(fs.readFileSync(file,'utf8'),{uniqueKeys:true});if(doc.errors.length)throw new Error(doc.errors.map(e=>e.message).join('; '));const value=doc.toJS() as Plugin;
 configurationName(value?.name,'plugin name');if(!/^\d+\.\d+\.\d+$/.test(value?.version??'')||value?.cli_major!==0)throw new Error(`Expected a valid plugin name, semantic version, and cli_major: 0 in ${file}`);return value;
}
function inventory(root:string){const entries:Record<string,string>={};for(const section of sections){const folder=path.join(root,section);if(!fs.existsSync(folder))continue;for(const file of files(folder))entries[path.relative(root,file).split(path.sep).join('/')]=hash(fs.readFileSync(file));}return entries;}
function validRelative(relative:string){const parts=relative.split(/[\\/]/);if((!sections.includes(parts[0]!)&&relative!=='plugin.yaml')||parts.includes('..')||path.isAbsolute(relative))throw new Error(`Invalid plugin receipt path: ${relative}`);}
function assertSafeTarget(root:string,relative:string){let cursor=root;for(const part of relative.split(/[\\/]/)){cursor=path.join(cursor,part);try{if(fs.lstatSync(cursor).isSymbolicLink())throw new Error(`Symlink destination: ${cursor}`);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}}

export function validatePlugin(root:string,hostRoot?:string){
 root=fs.realpathSync(root);const info=manifest(root),checksums=inventory(root);if(!Object.keys(checksums).length)throw new Error('Empty plugin');if(info.checksums&&JSON.stringify(Object.entries(info.checksums).sort())!==JSON.stringify(Object.entries(checksums).sort()))throw new Error('Plugin integrity check failed');
 const directory=path.join(root,'profiles'),names=fs.existsSync(directory)?fs.readdirSync(directory).filter(file=>file.endsWith('.yaml')).sort().map(file=>file.slice(0,-5)):[];if(!names.length)throw new Error('Plugin requires launch profiles');
 const profiles=names.map(name=>{const resolved=resolveProfile(root,`${info.name}/${name}`,undefined,{hostRoot});for(const variant of resolved.variants??[])resolveProfile(root,`${info.name}/${name}:${variant}`,undefined,{hostRoot});const agent=resolved.nodes.main!;return {profile:name,qualified:`${info.name}/${name}`,...(resolved.variants?{variants:resolved.variants,default_variant:resolved.default_variant}:{}),plugin:info.name,plugin_version:info.version,agent:agent.name,harness:agent.harness,model:{name:agent.model,reasoning:agent.reasoning_effort,speed:agent.speed??'native default'},source_file:resolved.profile_file};});
 return {info,checksums,profiles};
}

export function packPlugin(source:string,destination:string){
 source=fs.realpathSync(source);destination=path.resolve(destination);const {info,checksums}=validatePlugin(source);if(fs.existsSync(destination))throw new Error('Output already exists; choose a fresh output directory');const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();let repository=info.source?.repository;
 if(!repository){try{repository=execFileSync('git',['remote','get-url','origin'],{cwd:source,encoding:'utf8'}).trim();}catch{repository=source;}}
 fs.mkdirSync(destination,{recursive:true});for(const relative of Object.keys(checksums)){const target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(source,relative),target);}fs.writeFileSync(path.join(destination,'plugin.yaml'),stringify({...info,source:{repository,commit},checksums}));return validatePlugin(destination);
}

function readReceipt(file:string):Receipt|undefined{return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):undefined;}
function sourceDescription(source:string,info:Plugin){return info.source??{path:fs.realpathSync(source)};}

export function installPlugin(source:string,root:string){
 source=fs.realpathSync(source);root=path.resolve(root);const {info,checksums}=validatePlugin(source,root);fs.mkdirSync(root,{recursive:true});const receipts=path.join(root,'.plugins');fs.mkdirSync(receipts,{recursive:true,mode:0o700});const lock=path.join(receipts,'install.lock');try{fs.mkdirSync(lock);}catch{throw new Error('Another plugin install is active or left a stale lock');}
 try{
  const receiptFile=path.join(receipts,info.name+'.json'),existing=readReceipt(receiptFile);
  if(existing&&existing.layout!==2)throw new Error(`Legacy flat plugin install detected for ${info.name}: ${receiptFile}. No files were changed. Ask your agent to migrate this configuration to the plugins/${info.name}/ namespace before installing again.`);
  const prior=existing?.checksums??{},pluginRoot=path.join(root,'plugins',info.name),desired:Record<string,string>={...checksums,'plugin.yaml':hash(fs.readFileSync(path.join(source,'plugin.yaml')))},changes=new Map<string,Buffer|undefined>();
  for(const relative of new Set([...Object.keys(prior),...Object.keys(desired)])){validRelative(relative);const target=path.join(pluginRoot,relative);assertSafeTarget(root,path.relative(root,target));const current=fs.existsSync(target)?fs.readFileSync(target):undefined,digest=current?hash(current):undefined;if(digest===desired[relative])continue;if(current&&digest!==prior[relative])throw new Error(`Plugin ${info.name} file differs; preserve or reconcile it before updating: ${target}`);if(!current&&prior[relative])throw new Error(`Locally removed plugin ${info.name} file: ${target}`);changes.set(relative,current);}
  const priorReceipt=fs.existsSync(receiptFile)?fs.readFileSync(receiptFile):undefined;
  try{
   for(const relative of changes.keys()){const target=path.join(pluginRoot,relative);fs.mkdirSync(path.dirname(target),{recursive:true});if(desired[relative])fs.copyFileSync(path.join(source,relative),target);else fs.unlinkSync(target);}
   const receipt:Receipt={name:info.name,version:info.version,layout:2,source:sourceDescription(source,info),checksums:desired};fs.writeFileSync(receiptFile+'.tmp',JSON.stringify(receipt,null,2),{mode:0o600});fs.renameSync(receiptFile+'.tmp',receiptFile);
  }catch(error){for(const [relative,old] of [...changes].reverse()){const target=path.join(pluginRoot,relative);if(old)fs.writeFileSync(target,old);else if(fs.existsSync(target))fs.unlinkSync(target);}if(priorReceipt)fs.writeFileSync(receiptFile,priorReceipt);else if(fs.existsSync(receiptFile))fs.unlinkSync(receiptFile);throw error;}
  return {name:info.name,version:info.version,changed:changes.size};
 }finally{fs.rmdirSync(lock);}
}

export function listPlugins(root:string){
 root=path.resolve(root);const folder=path.join(root,'.plugins');if(!fs.existsSync(folder))return [];return fs.readdirSync(folder).filter(file=>file.endsWith('.json')).sort().flatMap(file=>{const receipt=readReceipt(path.join(folder,file));if(!receipt||receipt.layout!==2)return [];const profiles=Object.keys(receipt.checksums).filter(key=>key.startsWith('profiles/')&&key.endsWith('.yaml')).length;return [{name:receipt.name,version:receipt.version,source:receipt.source,profiles}];});
}

export function uninstallPlugin(name:string,root:string){
 name=configurationName(name,'plugin name');root=path.resolve(root);const folder=path.join(root,'.plugins'),lock=path.join(folder,'install.lock');try{fs.mkdirSync(lock);}catch{throw new Error('Another plugin install is active or left a stale lock');}
 try{const receiptFile=path.join(folder,name+'.json'),receipt=readReceipt(receiptFile);if(!receipt||receipt.layout!==2)throw new Error(`Plugin is not installed: ${name}`);const pluginRoot=path.join(root,'plugins',name),removed:string[]=[],stayed:Array<{file:string;reason:string}>=[];
  for(const [relative,expected] of Object.entries(receipt.checksums)){validRelative(relative);const target=path.join(pluginRoot,relative);assertSafeTarget(root,path.dirname(path.relative(root,target)));let status:fs.Stats|undefined;try{status=fs.lstatSync(target);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}if(!status){stayed.push({file:relative,reason:'missing'});continue;}if(!status.isFile()){stayed.push({file:relative,reason:'non-file'});continue;}const current=fs.readFileSync(target);if(hash(current)!==expected){stayed.push({file:relative,reason:'modified'});continue;}fs.unlinkSync(target);removed.push(relative);}
  fs.unlinkSync(receiptFile);
  if(fs.existsSync(pluginRoot)){const directories:string[]=[];const walk=(directory:string)=>{directories.push(directory);for(const entry of fs.readdirSync(directory,{withFileTypes:true}))if(entry.isDirectory()&&!entry.isSymbolicLink())walk(path.join(directory,entry.name));};walk(pluginRoot);for(const directory of directories.sort((a,b)=>b.length-a.length))try{fs.rmdirSync(directory);}catch{}}
  return {name,removed,stayed};
 }finally{fs.rmdirSync(lock);}
}
