import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {parseDocument,stringify} from 'yaml';
import {configurationName,namespaces,qualifiedName} from './config.js';
import {resolveProfile} from './compiler.js';
import {resolveWorkspace} from './workspaces.js';
import {resolveTelemetry,telemetryAccess} from './runtime.js';
import {profilesJson} from './profile-display.js';
import {checkSvg} from './svg.js';

const revision=(text:string)=>createHash('sha256').update(text).digest('hex');
function document(text:unknown){
  if(typeof text!=='string'||Buffer.byteLength(text)>65536)throw Error('Profile source must be text, at most 64 KiB');
  const doc=parseDocument(text,{uniqueKeys:true});if(doc.errors.length)throw Error(doc.errors.map(e=>e.message).join('; '));
  const value=doc.toJS({maxAliasCount:100});if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a YAML mapping');return value as Record<string,unknown>;
}

/** Configuration files remain authoritative. Preview never writes or launches anything. */
export class ProfileManager{
  constructor(readonly root:string,readonly project:string){}
  private catalog(){return fs.existsSync(this.root)?namespaces(this.root):[];}
  private context(name:string){const parsed=qualifiedName(name),context=this.catalog().find(c=>c.plugin===parsed.plugin);if(!context)throw Error('Profile namespace not found');return {context,name:parsed.name};}
  private source(file:string){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.size>65536)throw Error('Profile must be a regular file at most 64 KiB');return fs.readFileSync(file,'utf8');}
  /** Display fields as `profiles list --json` reports them (local overrides merged in), keyed by qualified name. */
  private displays(){const map=new Map<string,Record<string,unknown>>();try{for(const p of profilesJson(this.root).profiles)map.set(p.ref,p as Record<string,unknown>);}catch{/* Listing still works without them. */}return map;}
  /** The profile's SVG photo, checked again before it is served. */
  photo(name:string){const entry=this.displays().get(name);if(!entry||typeof entry.photo!=='string')throw Error('This profile has no photo');const content=fs.readFileSync(entry.photo);checkSvg(content);return content;}
  list(){const displays=this.displays();return this.catalog().flatMap(context=>{const dir=path.join(context.root,'profiles');if(!fs.existsSync(dir))return [];return fs.readdirSync(dir).filter(f=>f.endsWith('.yaml')).sort().map(file=>{const name=file.slice(0,-5),qualified=context.plugin?context.plugin+'/'+name:name;try{const r=resolveProfile(this.root,name,undefined,{namespace:context}),a=r.nodes.main!,d=displays.get(qualified);return {name:qualified,plugin:context.plugin,harness:a.harness,model:a.model,agent:a.qualified_name,title:d?.title,photo:typeof d?.photo==='string'};}catch(e){return {name:qualified,plugin:context.plugin,error:(e as Error).message};}});});}
  agents(){return this.catalog().flatMap(context=>{const dir=path.join(context.root,'agents');if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const name=e.isDirectory()&&fs.existsSync(path.join(dir,e.name,'agent.yaml'))?e.name:e.isFile()&&/\.(md|yaml)$/.test(e.name)?e.name.replace(/\.(md|yaml)$/,''):undefined;return name?[context.plugin?context.plugin+'/'+name:name]:[];});}).sort();}
  get(name:string){const {context,name:local}=this.context(name),file=path.join(context.root,'profiles',local+'.yaml'),source=this.source(file);let resolved:unknown,definition:unknown,error:string|undefined;try{definition=document(source);resolved=this.resolve(local,definition as Record<string,unknown>,context);}catch(e){error=(e as Error).message;}const d=this.displays().get(name);return {name,source,definition,revision:revision(source),readOnly:!context.local,file,resolved,error,display:d?{title:d.title,description:d.description,photo:typeof d.photo==='string',sources:d.sources}:undefined};}
  compose(input:{source:string;agent:string;model:string;reasoning:string;speed:string;args:string}){
    if(document(input.source).variants!==undefined)throw Error('This profile has variants; edit them in the YAML source');qualifiedName(input.agent);
    const doc=parseDocument(input.source,{uniqueKeys:true});doc.set('agent',input.agent);
    for(const key of ['model','reasoning','speed'] as const){const value=input[key];if(typeof value!=='string')throw Error('Expected text fields');const field=key==='model'?'name':key;if(value.trim())doc.setIn(['model',field],value.trim());else doc.deleteIn(['model',field]);}
    const model=doc.get('model') as {items?:unknown[]}|undefined;if(model?.items?.length===0)doc.delete('model');
    const args=JSON.parse(input.args);if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Arguments must be a JSON object');if(Object.keys(args).length)doc.set('args',args);else doc.delete('args');
    return {source:doc.toString()};
  }
  private resolve(name:string,value:Record<string,unknown>,context={root:fs.realpathSync(this.root),local:true}){
    const workspace=resolveWorkspace(this.root,{directory:this.project});
    const result=resolveProfile(this.root,name,workspace,{namespace:context,profileDocument:value}),a=result.nodes.main!;
    const telemetry=resolveTelemetry(this.root,workspace.telemetry);
    // Do not expose connection secrets or provider credentials in the browser inspector.
    return {profile:result.profile,agent:a.qualified_name,harness:a.harness,model:a.launch?.model,args:a.launch?.arguments,argument_definitions:a.argument_definitions,instructions:a.instructions,skills:a.skills,subagents:a.children,source_file:a.source_file,workspace_source:workspace.metadata,telemetry_access:telemetryAccess(telemetry,result.profile)};
  }
  duplicate(name:string){const current=this.get(name),{context}=this.context(name),value=document(current.source);
    // A copy lands in the local namespace, so plugin agents it names must be qualified, including every variant's.
    const qualify=(entry:Record<string,unknown>)=>{if(context.plugin&&typeof entry.agent==='string'&&!entry.agent.includes('/'))entry.agent=context.plugin+'/'+entry.agent;};
    qualify(value);if(value.variants&&typeof value.variants==='object')for(const entry of Object.values(value.variants as Record<string,unknown>))if(entry&&typeof entry==='object')qualify(entry as Record<string,unknown>);
    return {source:stringify(value)};}
  preview(input:{name:string;source:string;revision:string|null}){
    const name=configurationName(input.name,'profile name'),value=document(input.source);
    const local=this.catalog().find(c=>c.local);if(!local)throw Error('Use a host configuration root, not a plugin directory');
    const file=this.target(name),before=fs.existsSync(file)?this.source(file):null;
    if(input.revision!==(before===null?null:revision(before)))throw Error('Profile changed on disk or already exists. Reload before saving.');
    return {name,file,before,after:input.source,resolved:this.resolve(name,value,local)};
  }
  private target(name:string){
    const root=fs.realpathSync(this.root),dir=path.join(root,'profiles');
    if(fs.existsSync(dir)&&(!fs.lstatSync(dir).isDirectory()||fs.realpathSync(dir)!==dir))throw Error('Profiles directory must not be a symlink');
    const file=path.join(dir,name+'.yaml');if(fs.existsSync(file)&&!fs.lstatSync(file).isFile())throw Error('Profile must not be a symlink');return file;
  }
  save(input:{name:string;source:string;revision:string|null}){
    const preview=this.preview(input),dir=path.dirname(preview.file);fs.mkdirSync(dir,{recursive:true});
    const temp=path.join(dir,'.ui-'+randomUUID()+'.tmp');
    try{fs.writeFileSync(temp,input.source,{flag:'wx',mode:0o600});this.preview(input);
      if(input.revision===null)fs.linkSync(temp,preview.file);else fs.renameSync(temp,preview.file);
    }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
    return this.get(input.name);
  }
}
