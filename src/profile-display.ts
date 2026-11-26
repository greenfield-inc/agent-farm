import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseDocument} from 'yaml';
import {namespaces,qualifiedName,type Namespace} from './config.js';
import {resolveProfile,profileDisplay,orderedVariants,type Resolution} from './compiler.js';
import {checkSvg} from './svg.js';
import type {Agent} from './runtime.js';

/** The `profiles list --json` schema number. Bump it when a field changes meaning or goes away. */
export const profilesSchema=1;
type Source='plugin'|'file'|'override'|'default';
export interface TreeNode{alias:string;agent?:string;mode:'native'|'process'|'launch';any?:true;plugin?:string;variant?:string;variants?:string[];default_variant?:string;description?:string;
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
  result.push({alias,agent:ref,mode:child.mode!,...(variant?{variant}:{}),...(child.description?{description:child.description}:{}),...(child.mode==='process'?{command:`agent-farm run ${ref}${variant?':'+variant:''}`}:{}),children:child.mode==='process'?tree(root,resolution,childRoute,[...trail,ref],cache):[]});
 }
 for(const [alias,link] of Object.entries(node.links??{})){
  if(link.any){result.push({alias,mode:'launch',any:true,plugin:link.plugin,...(link.description?{description:link.description}:{}),command:`agent-farm run ${link.plugin}/<agent>`,children:[]});continue;}
  const ref=link.agent!,target=ref+(link.variant?':'+link.variant:''),base={alias,agent:ref,mode:'launch' as const,...(link.variant?{variant:link.variant}:{}),...(link.variants?{variants:link.variants,default_variant:link.default_variant}:{}),command:`agent-farm run ${target}`};
  if(trail.includes(ref)){result.push({...base,...(link.description?{description:link.description}:{}),cycle:true,children:[]});continue;}
  let resolved=cache.get(target);if(!resolved){try{resolved=resolveProfile(root,target,undefined,{agentOnly:true});}catch(error){resolved=error instanceof Error?error:new Error(String(error));}cache.set(target,resolved);}
  if(resolved instanceof Error){result.push({...base,...(link.description?{description:link.description}:{}),error:resolved.message,children:[]});continue;}
  const description=link.description??resolved.nodes.main!.description;
  result.push({...base,...(description?{description}:{}),children:tree(root,resolved,'main',[...trail,ref],cache)});
 }
 return result;
}
const modelOf=(agent:Agent)=>({name:agent.model,...(agent.reasoning_effort?{reasoning:agent.reasoning_effort}:{}),...(agent.speed?{speed:agent.speed}:{})});

/** `agent-farm profiles list --json`: every profile with its display fields (overrides merged in), variants and tree. */
export function profilesJson(root:string){
 if(!fs.existsSync(root))return {schema:profilesSchema,profiles:[]};
 root=fs.realpathSync(root);const cache=new Map<string,Resolution|Error>();
 const profiles=namespaces(root).flatMap(context=>{
  const directory=path.join(context.root,'profiles');if(!fs.existsSync(directory))return [];
  return fs.readdirSync(directory).filter(file=>file.endsWith('.yaml')).sort().map(file=>{
   const name=file.slice(0,-5),ref=context.plugin?`${context.plugin}/${name}`:name,profileFile=path.join(directory,file);
   try{
    const resolved=resolveProfile(root,name,undefined,{namespace:context}),main=resolved.nodes.main!,own=context.plugin&&!context.local?'plugin':'file';
    const override=context.plugin&&!context.local?readOverride(root,context.plugin,name):{},overridePhoto=override.photo?path.join(overrideFolder(root,context.plugin!),override.photo):undefined;
    const pick=<T>(field:'title'|'description',fallback:T)=>override[field]!==undefined?{value:override[field],source:'override' as Source}:resolved.display?.[field]!==undefined?{value:resolved.display[field],source:own as Source}:{value:fallback,source:'default' as Source};
    const title=pick('title',name),description=pick('description',main.description),photo=overridePhoto?{value:overridePhoto,source:'override' as Source}:resolved.display?.photo?{value:resolved.display.photo,source:own as Source}:{value:undefined,source:'default' as Source};
    const variants=resolved.variants?Object.fromEntries(orderedVariants(resolved.variants,resolved.default_variant).map(v=>{const r=v===resolved.variant?resolved:resolveProfile(root,`${name}:${v}`,undefined,{namespace:context}),a=r.nodes.main!;return [v,{agent:a.qualified_name,harness:a.harness,model:modelOf(a)}];})):undefined;
    return {ref,name,plugin:context.plugin??null,version:context.version??null,title:title.value,description:description.value??null,photo:photo.value??null,
     sources:{title:title.source,description:description.source,photo:photo.source},
     // A local profile is edited in its file; an installed plugin's through a display override in the config root.
     editable:{via:context.local?'file':'override',file:profileFile},
     ...(variants?{variants,default_variant:resolved.default_variant}:{variants:null,default_variant:null,agent:main.qualified_name,harness:main.harness,model:modelOf(main)}),
     command:`agent-farm run ${ref}`,tree:tree(root,resolved,'main',[main.variant_set?.agent??main.qualified_name??main.name],cache)};
   }catch(error){return {ref,name,plugin:context.plugin??null,version:context.version??null,error:error instanceof Error?error.message:String(error)};}
  });
 });
 return {schema:profilesSchema,profiles};
}

function writeAtomic(file:string,data:string|Buffer){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,data,{mode:0o644});fs.renameSync(temp,file);}finally{fs.rmSync(temp,{force:true});}}

/** `agent-farm profiles set REF`: writes a local profile's file, or the display override for an installed plugin's
 *  profile. An empty value removes the field (back to the plugin's or the default). Every value is checked first. */
export function setProfileDisplay(root:string,ref:string,input:{title?:string;description?:string;photo?:string}){
 if(input.title===undefined&&input.description===undefined&&input.photo===undefined)throw new Error('Use: agent-farm profiles set REF [--title TEXT] [--description TEXT] [--photo FILE.svg]; an empty value removes the field');
 root=fs.realpathSync(root);const parsed=qualifiedName(ref),catalog=namespaces(root);
 const context:Namespace|undefined=parsed.plugin?catalog.find(c=>c.plugin===parsed.plugin):catalog.find(c=>c.local);
 const file=context&&path.join(context.root,'profiles',parsed.name+'.yaml');
 if(!context||!fs.existsSync(file!))throw new Error(`No profile ${ref}${parsed.plugin?'':' in the local configuration; name a plugin profile as PLUGIN/NAME'}`);
 const shown=`Profile ${ref}`,photo=input.photo?fs.readFileSync(path.resolve(input.photo)):undefined;
 if(input.photo&&!input.photo.toLowerCase().endsWith('.svg'))throw new Error(`The photo for profile ${ref} is refused: photos are SVG only (${path.basename(input.photo)})`);
 if(photo)checkSvg(photo,`photo for profile ${ref}`);
 // Same rules as the profile file, so an override can't hold what the file couldn't.
 profileDisplay({title:input.title||undefined,description:input.description||undefined},file!,shown);
 if(context.local){
  const doc=parseDocument(fs.readFileSync(file!,'utf8'),{uniqueKeys:true});
  for(const key of ['title','description'] as const)if(input[key]!==undefined){if(input[key])doc.set(key,input[key]);else doc.delete(key);}
  if(input.photo!==undefined){if(input.photo){writeAtomic(path.join(path.dirname(file!),parsed.name+'.svg'),photo!);doc.set('photo',parsed.name+'.svg');}else doc.delete('photo');}
  resolveProfile(root,parsed.name,undefined,{namespace:context,profileDocument:doc.toJS() as Record<string,unknown>});
  writeAtomic(file!,doc.toString());
 }else{
  const folder=overrideFolder(root,context.plugin!),current=readOverride(root,context.plugin!,parsed.name),next:Override={...current};
  for(const key of ['title','description'] as const)if(input[key]!==undefined){if(input[key])next[key]=input[key];else delete next[key];}
  if(input.photo!==undefined){if(input.photo){writeAtomic(path.join(folder,parsed.name+'.svg'),photo!);next.photo=parsed.name+'.svg';}else{delete next.photo;fs.rmSync(path.join(folder,parsed.name+'.svg'),{force:true});}}
  if(Object.keys(next).length)writeAtomic(path.join(folder,parsed.name+'.json'),JSON.stringify(next,null,2)+'\n');else fs.rmSync(path.join(folder,parsed.name+'.json'),{force:true});
 }
 return profilesJson(root).profiles.find(p=>p.ref===(context.plugin?`${context.plugin}/${parsed.name}`:parsed.name));
}
