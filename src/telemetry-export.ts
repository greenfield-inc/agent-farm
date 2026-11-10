import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {TelemetryStore,type QueryOptions} from './telemetry-query.js';

type Options={bundle:string;sessionIds?:string[];launchIds?:string[];includeContent?:boolean;requireFinished?:boolean};
/** True for a telemetry record this exporter wrote; anything else in that key was written by hand. */
const ours=(value:any)=>!!value&&typeof value==='object'&&value.version===1&&Array.isArray(value.session_ids)&&value.session_ids.every((id:unknown)=>typeof id==='string');
function regular(file:string){const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.size>1024*1024)throw Error('Expected a regular bundle manifest, at most 1 MiB');}
function directory(parent:string,name:string){const result=path.join(parent,name);try{fs.mkdirSync(result,{mode:0o700});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}const s=fs.lstatSync(result);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Artifact directories must not be symlinks');return result;}
function write(file:string,data:string|Buffer){if(fs.existsSync(file)&&(!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink()))throw Error('Artifact files must not be symlinks');const temp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,data,{flag:'wx',mode:0o600});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}

/** Copy only explicitly associated sessions, keeping the record of what happened (TelemetryStore.exportSnapshot).
 *  Publishing remains the destination's job. */
export function exportTelemetry(storeOptions:QueryOptions,options:Options){
  const bundle=fs.realpathSync(options.bundle);if(!fs.statSync(bundle).isDirectory())throw Error('Bundle must be a directory');
  const manifestFile=path.join(bundle,'bundle.json');regular(manifestFile);
  const lock=path.join(bundle,'.agent-farm-export.lock'),fd=fs.openSync(lock,'wx',0o600);
  try{
    const original=fs.readFileSync(manifestFile,'utf8'),manifest=JSON.parse(original);
    if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw Error('Invalid bundle manifest');
    // A key the exporter didn't write (a path, or an object without version) is replaced, keeping every other field.
    const previous=ours(manifest.telemetry)?manifest.telemetry:undefined;
    const note=manifest.telemetry!==undefined&&!previous?'bundle.json had a telemetry key the exporter did not write; replaced it with the export record':undefined;
    const store=new TelemetryStore({...storeOptions,scope:'project'});
    const launched=(options.launchIds??[]).flatMap(id=>store.launchSessions(id));
    const ids=[...new Set<string>([...(previous?.session_ids??[]),...(options.sessionIds??[]),...launched].map(id=>id==='current'?storeOptions.currentSession??'':id))];
    const snapshots=store.exportSnapshot(ids,options.includeContent,options.requireFinished);
    const target=directory(directory(bundle,'evidence'),'telemetry');
    // Validate every destination before replacing any telemetry files. A signal an earlier export wrote and this one
    // leaves out (traces.jsonl) is removed, so the folder matches the record; unlinking never follows a link.
    const stale:string[]=[];
    for(const s of snapshots){const dir=directory(target,s.id);for(const name of ['traces.jsonl','logs.jsonl','metrics.jsonl'])if(!(name in s.files)&&fs.lstatSync(path.join(dir,name),{throwIfNoEntry:false}))stale.push(path.join(dir,name));for(const name of Object.keys(s.files)){const f=path.join(dir,name);if(fs.existsSync(f)&&(!fs.lstatSync(f).isFile()||fs.lstatSync(f).isSymbolicLink()))throw Error('Artifact files must not be symlinks');}}
    if(fs.readFileSync(manifestFile,'utf8')!==original)throw Error('Bundle manifest changed during export; retry');
    const total=(pick:(s:typeof snapshots[number])=>Record<string,number>)=>{const sum:Record<string,number>={};for(const s of snapshots)for(const [k,n] of Object.entries(pick(s)))sum[k]=(sum[k]??0)+n;return Object.fromEntries(Object.entries(sum).sort());};
    const launch_ids=[...new Set([...(Array.isArray(previous?.launch_ids)?previous.launch_ids:[]),...(options.launchIds??[])])];
    const telemetry={version:1,session_ids:ids,...(launch_ids.length?{launch_ids}:{}),exported_session_ids:snapshots.map(s=>s.id),directory:'evidence/telemetry',exported_at:new Date().toISOString(),complete:snapshots.every(s=>s.finished),publication:'pending',
      contents:'events',events:{kept:total(s=>s.events.kept),left_out:total(s=>s.events.left_out)},shortened_fields:snapshots.reduce((n,s)=>n+s.shortened_fields,0),traces_left_out_bytes:snapshots.reduce((n,s)=>n+s.traces_left_out_bytes,0)};
    // A failed refresh must never leave an earlier "complete" claim over mixed files.
    const pending=JSON.stringify({...manifest,telemetry:{...telemetry,complete:false}},null,2)+'\n';
    write(manifestFile,pending);
    for(const s of snapshots){const dir=path.join(target,s.id);for(const [name,data] of Object.entries(s.files))write(path.join(dir,name),data);}
    for(const file of stale)fs.unlinkSync(file);
    if(fs.readFileSync(manifestFile,'utf8')!==pending)throw Error('Bundle manifest changed during export; retry');
    write(manifestFile,JSON.stringify({...manifest,telemetry},null,2)+'\n');
    return {bundle,...telemetry,...(note?{note}:{})};
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
