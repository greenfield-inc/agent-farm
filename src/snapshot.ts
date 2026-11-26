import fs from 'node:fs';
import path from 'node:path';
import {canonical,fileMap,files,hash} from './runtime.js';
export {snapshotReference,snapshotVariable} from './runtime.js';
import {loadHostSettings,namespaces} from './config.js';
import {generatedHint} from './workspaces.js';

/** The snapshot layout this CLI writes and reads. A snapshot with a higher format is refused, never guessed at. */
export const snapshotFormat=1;
/** Where snapshots live, under a launch directory. Outside `.agent-farm/generated`, so a Pane Session move copies them. */
export const snapshotFolder=path.join('.agent-farm','snapshots');
/** The config root's own sections, copied so local profiles and agents resolve from the snapshot too. */
const localSections=['agents','profiles','skills','instructions','references'];
/** What a config root holds beside its own sections: installed plugins, settings, and Agent Farm's output. */
const hostEntries=['.plugins','plugins','settings.json','.agent-farm','.git','node_modules'];

export interface Snapshot {
  /** The snapshot folder, absolute. It reads as a config root. */
  path: string;
  digest: string;
  /** Installed plugins it holds, by name, with their versions. */
  plugins: Record<string,string>;
}

/** Why a snapshot that was asked for can't be used. Agent Farm never falls back to the installed plugins for it. */
export class SnapshotUnreadable extends Error {}

function refuse(location:string,reason:string):never{
  throw new SnapshotUnreadable(`Snapshot ${location} ${reason}. Agent Farm will not fall back to the installed plugins. Use Reload profile (in Pane), or resume with --resume ID --reload, to take a new snapshot of what is installed now.`);
}

/** Copies what a config root can resolve (every installed plugin, its receipt, the root's own agents, profiles, skills,
 *  instructions and references, and default_plugin) into `<directory>/.agent-farm/snapshots/<digest>/`, a folder that
 *  reads as a config root and never changes once written. The same installed files always give the same folder. */
export function createSnapshot(configRoot:string,directory:string):Snapshot{
  const root=fs.realpathSync(configRoot);
  const inputs=new Map<string,string>();
  const add=(folder:string,relative:string,skip?:(relative:string)=>boolean)=>{for(const file of files(folder,skip))inputs.set(path.join(relative,path.relative(folder,file)),file);};
  const plugins:Record<string,string>={};
  const [direct,...installed]=namespaces(root);
  // A config root that is itself a plugin folder (a plugin source) is copied whole, minus what a host root adds;
  // any other root gives its own sections.
  if(direct!.plugin){plugins[direct!.plugin]=direct!.version!;add(root,'',relative=>hostEntries.includes(relative));}
  else for(const section of localSections){const folder=path.join(root,section);if(fs.statSync(folder,{throwIfNoEntry:false})?.isDirectory())add(folder,section);}
  for(const item of installed){
    if(!item.plugin)continue;
    plugins[item.plugin]=item.version!;
    add(item.root,path.join('plugins',item.plugin));
    inputs.set(path.join('.plugins',item.plugin+'.json'),path.join(root,'.plugins',item.plugin+'.json'));
  }
  const preferred=loadHostSettings(root).default_plugin,settings=JSON.stringify(preferred?{default_plugin:preferred}:{},null,2)+'\n';
  const entries=[...inputs].sort(([a],[b])=>a.localeCompare(b)).map(([relative,source])=>({relative,source,content:fs.readFileSync(source),mode:fs.statSync(source).mode&0o111}));
  const digest=hash(canonical({format:snapshotFormat,settings,files:entries.map(e=>[e.relative.split(path.sep).join('/'),hash(e.content),e.mode])})).slice(0,24);
  const parent=path.join(fs.realpathSync(directory),snapshotFolder),target=path.join(parent,digest);
  if(fs.existsSync(target)){
    try{return openSnapshot(target,directory);}catch(error){if(!(error instanceof SnapshotUnreadable))throw error;fs.rmSync(target,{recursive:true,force:true});}
  }
  generatedHint(directory,undefined,'snapshots');
  fs.mkdirSync(parent,{recursive:true});
  const staging=fs.mkdtempSync(path.join(parent,'.building-'));
  try{
    for(const entry of entries){
      const destination=path.join(staging,entry.relative);fs.mkdirSync(path.dirname(destination),{recursive:true});
      // A clone where the file system has them (APFS, Btrfs), a plain copy elsewhere.
      fs.copyFileSync(entry.source,destination,fs.constants.COPYFILE_FICLONE);fs.chmodSync(destination,entry.mode?0o755:0o644);
    }
    fs.writeFileSync(path.join(staging,'settings.json'),settings);
    fs.writeFileSync(path.join(staging,'snapshot.json'),JSON.stringify({format:snapshotFormat,digest,plugins,created_at:new Date().toISOString(),source_root:root},null,2)+'\n');
    fs.writeFileSync(path.join(staging,'checksums.json'),JSON.stringify(fileMap(staging),null,2));
    try{fs.renameSync(staging,target);}catch(error){if(!fs.existsSync(target))throw error;/* Another launch wrote it first; check that copy below. */}
  }finally{fs.rmSync(staging,{recursive:true,force:true});}
  return openSnapshot(target,directory);
}

/** Opens the snapshot a launch was given. A relative path resolves against the launch directory. It is refused,
 *  naming Reload, when it is missing, fails its checksum, or was written by a newer Agent Farm. */
export function openSnapshot(reference:string,directory:string):Snapshot{
  const location=path.resolve(directory,reference);
  if(!fs.statSync(location,{throwIfNoEntry:false})?.isDirectory())refuse(location,'is missing');
  let info:{format?:unknown;digest?:unknown;plugins?:unknown};
  try{info=JSON.parse(fs.readFileSync(path.join(location,'snapshot.json'),'utf8'));}catch{refuse(location,'has no readable snapshot.json');}
  if(typeof info.format!=='number'||info.format>snapshotFormat)refuse(location,`was written in format ${String(info.format)}, which this Agent Farm (format ${snapshotFormat}) can't read`);
  if(typeof info.digest!=='string'||!info.plugins||typeof info.plugins!=='object')refuse(location,'has an invalid snapshot.json');
  let expected:unknown;
  try{expected=JSON.parse(fs.readFileSync(path.join(location,'checksums.json'),'utf8'));}catch{refuse(location,'has no readable checksums.json');}
  if(canonical(fileMap(location))!==canonical(expected))refuse(location,'failed its checksum (a file in it was changed, added or removed)');
  return {path:fs.realpathSync(location),digest:info.digest,plugins:info.plugins as Record<string,string>};
}
