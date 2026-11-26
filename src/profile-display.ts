import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseDocument} from 'yaml';
import {namespaces,qualifiedName,type Namespace} from './config.js';
import {resolveProfile,profileDisplay,orderedVariants,type Resolution} from './compiler.js';
import {readPhoto} from './svg.js';
import type {Agent} from './runtime.js';

/** The `profiles list --json` schema number. Bump it when a field changes meaning or goes away. */
export const profilesSchema=1;
type Source='plugin'|'file'|'override'|'default';
export interface TreeNode{alias:string;agent?:string;mode:'native'|'process'|'launch';any?:true;plugin?:string;variant?:string;variants?:string[];default?:string;description?:string;
 /** How a person starts this node on its own: `agent-farm run REF` (launch and process links); a native node has none. */
 command?:string;cycle?:true;error?:string;children:TreeNode[]}

/** Display overrides for an installed plugin's profile live in the config root, so they survive a plugin reinstall. */
const overrideFolder=(root:string,plugin:string)=>path.join(root,'profile-overrides',plugin);
interface Override{title?:string;description?:string;photo?:string}
function readOverride(root:string,plugin:string,name:string):Override{
 const file=path.join(overrideFolder(root,plugin),name+'.json');
 if(!fs.existsSync(file))return {};
 const value=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`Invalid profile override ${file}`);
 return value as Override;
}

/** The subagent tree under one resolved entry: native and process children from its bundle, launch links resolved
 *  on demand. A link back to an agent already on the path is marked `cycle` and not expanded. */
function tree(root:string,resolution:Resolution,route:string,trail:string[],cache:Map<string,Resolution|Error>):TreeNode[]{
 const node=resolution.nodes[route]!,result:TreeNode[]=[];
 for(const [alias,childRoute] of Object.entries(node.children)){
  const child=resolution.nodes[childRoute]!,ref=child.variant_set?.agent??child.qualified_name??child.name,variant=child.variant_set?.variant;
  result.push({alias,agent:ref,mode:child.mode!,...(variant?{variant}:{}),...(child.description?{description:child.description}:{}),...(child.mode==='process'?{command:`agent-farm run ${ref}${variant?':'+variant:''} --agent-only`}:{}),children:tree(root,resolution,childRoute,[...trail,ref],cache)});
 }
 for(const [alias,link] of Object.entries(node.links??{})){
  if(link.any){result.push({alias,mode:'launch',any:true,plugin:link.plugin,...(link.description?{description:link.description}:{}),command:`agent-farm run ${link.plugin}/<agent> --agent-only`,children:[]});continue;}
  const ref=link.agent!,target=ref+(link.variant?':'+link.variant:''),base={alias,agent:ref,mode:'launch' as const,...(link.variant?{variant:link.variant}:{}),...(link.variants?{variants:link.variants,default:link.default_variant}:{}),command:`agent-farm run ${target} --agent-only`};
  if(trail.includes(ref)){result.push({...base,...(link.description?{description:link.description}:{}),cycle:true,children:[]});continue;}
  let resolved=cache.get(target);if(!resolved){try{resolved=resolveProfile(root,target,undefined,{agentOnly:true});}catch(error){resolved=error instanceof Error?error:new Error(String(error));}cache.set(target,resolved);}
  if(resolved instanceof Error){result.push({...base,...(link.description?{description:link.description}:{}),error:resolved.message,children:[]});continue;}
  const description=link.description??resolved.nodes.main!.description;
  result.push({...base,...(description?{description}:{}),children:tree(root,resolved,'main',[...trail,ref],cache)});
 }
 return result;
}
const modelOf=(agent:Agent)=>({name:agent.model,...(agent.reasoning_effort?{reasoning:agent.reasoning_effort}:{}),...(agent.speed?{speed:agent.speed}:{})});

/** One profile's display fields as a host shows them: the plugin's or file's, with a local override merged in.
 *  A photo that fails its check is left out and reported in `photo_error`. */
function display(root:string,context:Namespace,name:string,resolved:Resolution){
 const own:Source=context.plugin&&!context.local?'plugin':'file',main=resolved.nodes.main!;
 const override=context.plugin&&!context.local?readOverride(root,context.plugin,name):{},overrideFolderPath=context.plugin?overrideFolder(root,context.plugin):'';
 const pick=<T>(field:'title'|'description',fallback:T)=>override[field]!==undefined?{value:override[field],source:'override' as Source}:resolved.display?.[field]!==undefined?{value:resolved.display[field],source:own}:{value:fallback,source:'default' as Source};
 const title=pick('title',name),description=pick('description',main.description);
 const candidate=override.photo?{file:path.join(overrideFolderPath,override.photo),folder:overrideFolderPath,source:'override' as Source}:resolved.display?.photo?{file:resolved.display.photo,folder:path.dirname(resolved.profile_file!),source:own}:undefined;
 let photo:{value:string|undefined;source:Source;error?:string}={value:undefined,source:'default'};
 if(candidate){try{readPhoto(candidate.file,`photo of profile ${resolved.profile}`,candidate.folder);photo={value:candidate.file,source:candidate.source};}catch(error){photo={value:undefined,source:candidate.source,error:error instanceof Error?error.message:String(error)};}}
 return {title,description,photo};
}

/** The `profiles list --json` entry for one profile. */
function entry(root:string,context:Namespace,name:string,cache:Map<string,Resolution|Error>,withTree=true){
 const ref=context.plugin?`${context.plugin}/${name}`:name,profileFile=path.join(context.root,'profiles',name+'.yaml');
 try{
  const resolved=resolveProfile(root,name,undefined,{namespace:context}),main=resolved.nodes.main!,{title,description,photo}=display(root,context,name,resolved);
  const variants=resolved.variants?Object.fromEntries(orderedVariants(resolved.variants,resolved.default_variant).map(v=>{const r=v===resolved.variant?resolved:resolveProfile(root,`${name}:${v}`,undefined,{namespace:context}),a=r.nodes.main!;return [v,{agent:a.qualified_name,harness:a.harness,model:modelOf(a)}];})):undefined;
  return {ref,name,plugin:context.plugin??null,version:context.version??null,title:title.value,description:description.value??null,photo:photo.value??null,...(photo.error?{photo_error:photo.error}:{}),
   sources:{title:title.source,description:description.source,photo:photo.source},
   // A local profile is edited in its file; an installed plugin's through a display override in the config root.
   editable:{via:context.local?'file':'override',file:profileFile},
   ...(variants?{variants,default:resolved.default_variant}:{variants:null,default:null,agent:main.qualified_name,harness:main.harness,model:modelOf(main)}),
   command:`agent-farm run ${ref}`,...(withTree?{tree:tree(root,resolved,'main',[main.variant_set?.agent??main.qualified_name??main.name],cache)}:{})};
 }catch(error){return {ref,name,plugin:context.plugin??null,version:context.version??null,error:error instanceof Error?error.message:String(error)};}
}
const profileNames=(context:Namespace)=>{const directory=path.join(context.root,'profiles');return fs.existsSync(directory)?fs.readdirSync(directory).filter(file=>file.endsWith('.yaml')).sort().map(file=>file.slice(0,-5)):[];};

/** `agent-farm profiles list --json`: every profile with its display fields (overrides merged in), variants and tree. */
export function profilesJson(root:string){
 if(!fs.existsSync(root))return {schema:profilesSchema,profiles:[]};
 root=fs.realpathSync(root);const cache=new Map<string,Resolution|Error>();
 return {schema:profilesSchema,profiles:namespaces(root).flatMap(context=>profileNames(context).map(name=>entry(root,context,name,cache)))};
}
/** One profile's `profiles list --json` entry, for a host that shows a single profile. */
export function profileJson(root:string,ref:string,options:{tree?:boolean}={}){
 root=fs.realpathSync(root);const parsed=qualifiedName(ref),context=namespaces(root).find(c=>parsed.plugin?c.plugin===parsed.plugin:c.local);
 if(!context||!profileNames(context).includes(parsed.name))throw new Error(`No profile ${ref}`);
 return entry(root,context,parsed.name,new Map(),options.tree!==false);
}
/** Titles and whether a photo exists, for a listing that needs no trees. */
export function profileTitles(root:string){
 const result=new Map<string,{title:string;photo:boolean}>();if(!fs.existsSync(root))return result;root=fs.realpathSync(root);
 for(const context of namespaces(root))for(const name of profileNames(context)){try{const r=resolveProfile(root,name,undefined,{namespace:context}),o=context.plugin&&!context.local?readOverride(root,context.plugin,name):{};result.set(context.plugin?`${context.plugin}/${name}`:name,{title:o.title??r.display?.title??name,photo:!!(o.photo??r.display?.photo)});}catch{/* Listed elsewhere with its error. */}}
 return result;
}

/** Replaces a file in one rename, keeping the permissions of the file it replaces (a private profile stays private). */
function writeAtomic(file:string,data:string|Buffer,created=0o644){fs.mkdirSync(path.dirname(file),{recursive:true});const mode=fs.statSync(file,{throwIfNoEntry:false})?.mode??created,temp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,data,{mode:mode&0o777});fs.chmodSync(temp,mode&0o777);fs.renameSync(temp,file);}finally{fs.rmSync(temp,{force:true});}}

/** `agent-farm profiles set REF`: writes a local profile's file, or the display override for an installed plugin's
 *  profile. An empty value removes the field (back to the plugin's or the default). Every value is checked first. */
export function setProfileDisplay(root:string,ref:string,input:{title?:string;description?:string;photo?:string}){
 if(input.title===undefined&&input.description===undefined&&input.photo===undefined)throw new Error('Use: agent-farm profiles set REF [--title TEXT] [--description TEXT] [--photo FILE.svg]; an empty value removes the field');
 root=fs.realpathSync(root);const parsed=qualifiedName(ref),catalog=namespaces(root);
 const context:Namespace|undefined=parsed.plugin?catalog.find(c=>c.plugin===parsed.plugin):catalog.find(c=>c.local);
 const file=context&&path.join(context.root,'profiles',parsed.name+'.yaml');
 if(!context||!fs.existsSync(file!))throw new Error(`No profile ${ref}${parsed.plugin?'':' in the local configuration; name a plugin profile as PLUGIN/NAME'}`);
 const shown=`Profile ${ref}`;
 if(input.photo&&!input.photo.toLowerCase().endsWith('.svg'))throw new Error(`The photo for profile ${ref} is refused: photos are SVG only (${path.basename(input.photo)})`);
 const photo=input.photo?readPhoto(path.resolve(input.photo),`photo for profile ${ref}`):undefined;
 // Same rules as the profile file, so an override can't hold what the file couldn't.
 profileDisplay({title:input.title||undefined,description:input.description||undefined},file!,shown);
 if(context.local){
  const doc=parseDocument(fs.readFileSync(file!,'utf8'),{uniqueKeys:true});
  for(const key of ['title','description'] as const)if(input[key]!==undefined){if(input[key])doc.set(key,input[key]);else doc.delete(key);}
  // A new photo gets a name no other local profile uses, and lands only after the profile file is written, so a
  // failed edit changes nothing and an edit never changes another profile's photo.
  let photoName:string|undefined;
  if(input.photo!==undefined){if(input.photo){photoName=photoFileName(context,parsed.name);doc.set('photo',photoName);}else doc.delete('photo');}
  resolveProfile(root,parsed.name,undefined,{namespace:context,profileDocument:doc.toJS() as Record<string,unknown>});
  const staged=photoName?path.join(path.dirname(file!),'.'+randomUUID()+'.svg.tmp'):undefined;
  try{
   if(staged)fs.writeFileSync(staged,photo!,{flag:'wx',mode:0o644});
   writeAtomic(file!,doc.toString());
   if(staged)fs.renameSync(staged,path.join(path.dirname(file!),photoName!));
  }finally{if(staged)fs.rmSync(staged,{force:true});}
 }else{
  const folder=overrideFolder(root,context.plugin!),current=readOverride(root,context.plugin!,parsed.name),next:Override={...current};
  for(const key of ['title','description'] as const)if(input[key]!==undefined){if(input[key])next[key]=input[key];else delete next[key];}
  if(input.photo!==undefined){if(input.photo){writeAtomic(path.join(folder,parsed.name+'.svg'),photo!,0o600);next.photo=parsed.name+'.svg';}else{delete next.photo;fs.rmSync(path.join(folder,parsed.name+'.svg'),{force:true});}}
  if(Object.keys(next).length)writeAtomic(path.join(folder,parsed.name+'.json'),JSON.stringify(next,null,2)+'\n',0o600);else fs.rmSync(path.join(folder,parsed.name+'.json'),{force:true});
 }
 return profileJson(root,context.plugin?`${context.plugin}/${parsed.name}`:parsed.name);
}
/** `NAME.svg`, unless another local profile's file names it; then `NAME-2.svg`, `NAME-3.svg` and so on. */
function photoFileName(context:Namespace,name:string):string{
 const used=new Set(profileNames(context).filter(other=>other!==name).flatMap(other=>{try{const value=parseDocument(fs.readFileSync(path.join(context.root,'profiles',other+'.yaml'),'utf8')).toJS();return typeof value?.photo==='string'?[value.photo]:[];}catch{return [];}}));
 for(let n=1;;n++){const candidate=n===1?name+'.svg':`${name}-${n}.svg`;if(!used.has(candidate))return candidate;}
}
