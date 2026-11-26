import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {canonical,hash} from './runtime.js';
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
/** Files an OS file browser drops into folders. Never copied, and ignored when a snapshot is checked. */
const osMetadata=new Set(['.DS_Store','Thumbs.db','desktop.ini']);

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

/** A snapshot-relative path, with `/` on every OS, so a snapshot written on Windows checks on macOS and Linux. */
const portable=(relative:string)=>relative.split(path.sep).join('/');

/** Every regular file under `folder` by its portable relative path, following symlinks (a skill linked in from a
 *  dotfiles repo is copied as its content) and skipping OS metadata and the top-level names in `skip`. */
function walk(folder:string,skip:string[]=[]):Map<string,string>{
  const result=new Map<string,string>(),seen=new Set<string>();
  const visit=(current:string,relative:string)=>{
    for(const entry of fs.readdirSync(current,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      if(osMetadata.has(entry.name)||(!relative&&skip.includes(entry.name)))continue;
      const source=path.join(current,entry.name),name=relative?relative+'/'+entry.name:entry.name;
      // Only a link needs a stat to learn what it points to.
      const stat=entry.isSymbolicLink()?fs.statSync(source,{throwIfNoEntry:false}):entry;
      if(stat?.isDirectory()){
        // A linked folder is followed once, so a link back to an ancestor can't loop.
        if(entry.isSymbolicLink()){const real=fs.realpathSync(source);if(seen.has(real))continue;seen.add(real);}
        visit(source,name);
      }else if(stat?.isFile())result.set(name,source);
    }
  };
  seen.add(fs.realpathSync(folder));visit(folder,'');return result;
}

/** What a snapshot folder must hold, by portable path: content hash, ignoring OS metadata. */
function contents(folder:string):Record<string,string>{
  return Object.fromEntries([...walk(folder)].filter(([relative])=>relative!=='checksums.json').map(([relative,file])=>[relative,hash(fs.readFileSync(file))]));
}

/** Copies what a config root can resolve (each installed plugin's receipt files, a receipt without its source path,
 *  the root's own agents, profiles, skills, instructions and references, and default_plugin) into
 *  `<directory>/.agent-farm/snapshots/<digest>/`, a folder that reads as a config root and never changes once written.
 *  The same installed files always give the same folder. A folder already at that name is reused only when its files
 *  are exactly the ones hashed now, so a folder committed to a repository can't stand in for the installed plugins. */
export function createSnapshot(configRoot:string,directory:string):Snapshot{
  const root=fs.realpathSync(configRoot);
  const sources=new Map<string,string>(),written=new Map<string,Buffer>();
  const add=(folder:string,prefix:string,skip?:string[])=>{for(const [relative,file] of walk(folder,skip))sources.set(prefix+relative,file);};
  const plugins:Record<string,string>={};
  const [direct,...installed]=namespaces(root);
  // A config root that is itself a plugin folder (a plugin source) is copied whole, minus what a host root adds;
  // any other root gives its own sections.
  if(direct!.plugin){plugins[direct!.plugin]=direct!.version!;add(root,'',hostEntries);}
  else for(const section of localSections){const folder=path.join(root,section);if(fs.statSync(folder,{throwIfNoEntry:false})?.isDirectory())add(folder,section+'/');}
  for(const item of installed){
    if(!item.plugin)continue;
    plugins[item.plugin]=item.version!;
    // Only the files the plugin's receipt lists: never caches, virtualenvs or other files left in the folder.
    const receipt=JSON.parse(fs.readFileSync(path.join(root,'.plugins',item.plugin+'.json'),'utf8')) as {checksums?:Record<string,string>};
    // OS metadata a receipt recorded is left out, as walk() leaves it out; a listed file deleted from the folder is
    // skipped rather than failing every launch (a name that needs it still fails to resolve, naming it).
    for(const relative of Object.keys(receipt.checksums??{}).sort()){
      const file=path.join(item.root,...relative.split('/'));
      if(osMetadata.has(path.posix.basename(relative))||!fs.statSync(file,{throwIfNoEntry:false})?.isFile())continue;
      sources.set(`plugins/${item.plugin}/${relative}`,file);
    }
    written.set(`.plugins/${item.plugin}.json`,Buffer.from(JSON.stringify({name:item.plugin,version:item.version,layout:2,checksums:receipt.checksums??{}},null,2)+'\n'));
  }
  const preferred=loadHostSettings(root).default_plugin;
  written.set('settings.json',Buffer.from(JSON.stringify(preferred?{default_plugin:preferred}:{},null,2)+'\n'));
  // Read each file once: the digest, the check of a reused folder and the copy all use this content.
  const entries=[...[...sources].map(([relative,source])=>{const stat=fs.statSync(source);return {relative,content:fs.readFileSync(source),mode:stat.mode&0o777};}),
    ...[...written].map(([relative,content])=>({relative,content,mode:0o644}))].sort((a,b)=>a.relative.localeCompare(b.relative));
  const expected=Object.fromEntries(entries.map(e=>[e.relative,hash(e.content)]));
  const digest=hash(canonical({format:snapshotFormat,files:entries.map(e=>[e.relative,expected[e.relative],e.mode&0o111])})).slice(0,24);
  const parent=path.join(fs.realpathSync(directory),snapshotFolder),target=path.join(parent,digest);
  // A folder at the name is used only when it is intact and its checksums are exactly the files hashed now.
  const reuse=():Snapshot|undefined=>{
    if(!fs.existsSync(target))return undefined;
    // Another launch may be moving a bad folder aside while this one reads it: a vanished file means "not reusable".
    try{
      const opened=openSnapshot(target,directory),found=JSON.parse(fs.readFileSync(path.join(target,'checksums.json'),'utf8'));delete found['snapshot.json'];
      return canonical(found)===canonical(expected) ? opened : undefined;
    }catch(error){if(error instanceof SnapshotUnreadable||(error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
  };
  const existing=reuse();if(existing)return existing;
  generatedHint(directory,undefined,'snapshots');
  fs.mkdirSync(parent,{recursive:true});
  const staging=fs.mkdtempSync(path.join(parent,'.building-'));
  try{
    for(const entry of entries){
      const destination=path.join(staging,...entry.relative.split('/'));fs.mkdirSync(path.dirname(destination),{recursive:true});
      fs.writeFileSync(destination,entry.content,{mode:entry.mode});fs.chmodSync(destination,entry.mode);
    }
    fs.writeFileSync(path.join(staging,'snapshot.json'),JSON.stringify({format:snapshotFormat,digest,plugins,created_at:new Date().toISOString()},null,2)+'\n');
    fs.writeFileSync(path.join(staging,'checksums.json'),JSON.stringify(contents(staging),null,2));
    // A folder at the name that holds other files (damaged, or planted) is moved aside and replaced in one rename.
    if(fs.existsSync(target)&&!reuse()){const aside=path.join(parent,`.replaced-${randomUUID()}`);try{fs.renameSync(target,aside);fs.rmSync(aside,{recursive:true,force:true});}catch{/* Another launch replaced it first. */}}
    try{fs.renameSync(staging,target);}catch(error){if(!fs.existsSync(target))throw error;/* Another launch wrote it first; check that copy below. */}
  }finally{fs.rmSync(staging,{recursive:true,force:true});}
  // Launches racing to replace a bad folder can briefly leave the name empty or mid-swap; wait for the winner's copy.
  for(let attempt=0;attempt<40;attempt++){const found=reuse();if(found)return found;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);}
  return refuse(target,'does not hold the files its name was computed from, and could not be replaced');
}

/** Opens the snapshot a launch was given. A relative path resolves against the launch directory. It is refused,
 *  naming Reload, when it is missing, fails its checksum, or was written by a newer Agent Farm. OS metadata files a
 *  file browser drops into it (.DS_Store, Thumbs.db, desktop.ini) are ignored. */
export function openSnapshot(reference:string,directory:string):Snapshot{
  const location=path.resolve(directory,reference);
  if(!fs.statSync(location,{throwIfNoEntry:false})?.isDirectory())refuse(location,'is missing');
  let info:{format?:unknown;digest?:unknown;plugins?:unknown};
  try{info=JSON.parse(fs.readFileSync(path.join(location,'snapshot.json'),'utf8'));}catch{refuse(location,'has no readable snapshot.json');}
  if(typeof info.format!=='number'||info.format>snapshotFormat)refuse(location,`was written in format ${String(info.format)}, which this Agent Farm (format ${snapshotFormat}) can't read`);
  if(typeof info.digest!=='string'||!info.plugins||typeof info.plugins!=='object')refuse(location,'has an invalid snapshot.json');
  let expected:unknown;
  try{expected=JSON.parse(fs.readFileSync(path.join(location,'checksums.json'),'utf8'));}catch{refuse(location,'has no readable checksums.json');}
  if(canonical(contents(location))!==canonical(expected))refuse(location,'failed its checksum (a file in it was changed, added or removed)');
  return {path:fs.realpathSync(location),digest:info.digest,plugins:info.plugins as Record<string,string>};
}
