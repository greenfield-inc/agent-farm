import {resolveWorkspace,type WorkspaceOptions} from './workspaces.js';
import {resolveTelemetry,telemetryAccess} from './runtime.js';
import fs from 'node:fs';
import path from 'node:path';
import {namespaces} from './config.js';
import {resolveProfile,traceIdentity} from './compiler.js';
const variantModels=(root:string,profile:string,variants:string[],context:Parameters<typeof resolveProfile>[3])=>Object.fromEntries(variants.map(v=>{try{const a=resolveProfile(root,`${profile}:${v}`,undefined,context).nodes.main!;return [v,{name:a.model,reasoning:a.reasoning_effort,speed:a.speed,harness:a.harness}];}catch{return [v,{name:'unresolved'}];}}));

export function inspectProfile(root:string,profile:string,options:WorkspaceOptions={}){
 root=fs.realpathSync(root);const workspace=resolveWorkspace(root,options),resolved=resolveProfile(root,profile,workspace);
 const telemetry=resolveTelemetry(root,workspace.telemetry,process.env,options.home);
 return {profile:resolved.profile,...(resolved.variant?{variant:resolved.variant,variants:resolved.variants,default_variant:resolved.default_variant}:{}),plugin:resolved.plugin,plugin_version:resolved.plugin_version,trace_identity:traceIdentity(resolved),profile_file:resolved.profile_file,
  workspace_source:workspace.metadata,telemetry,telemetry_access:telemetryAccess(telemetry,resolved.profile),cross_plugin_dependencies:resolved.cross_plugin_dependencies,
  agents:Object.fromEntries(Object.entries(resolved.nodes).map(([route,agent])=>[route,{agent:agent.name,qualified_agent:agent.qualified_name,plugin:agent.plugin,plugin_version:agent.plugin_version,source_file:agent.source_file,harness:agent.harness,
    model:{name:agent.model,reasoning:agent.reasoning_effort,speed:agent.speed??'native default',sources:agent.launch?.model.sources},arguments:agent.launch?.arguments??{},argument_definitions:agent.argument_definitions??{},preset:agent.launch?.preset,override:agent.launch?.override,instructions:agent.instructions,mode:route==='main'?'entry point':agent.mode,description:agent.description,
    skills:agent.skills.map(name=>({name,plugin:agent.skill_plugins?.[name]?.plugin,plugin_version:agent.skill_plugins?.[name]?.version,source_file:path.join(agent.skill_sources![name]!,'SKILL.md')})),references:agent.references?{name:agent.references.name,plugin:agent.references.plugin,plugin_version:agent.references.version,source:agent.references.source}:undefined,connections:agent.connections,subagents:agent.children}]))};
}

export function listProfiles(root:string){
 if(!fs.existsSync(root))return [];
 root=fs.realpathSync(root);const entries=namespaces(root).flatMap(context=>{const directory=path.join(context.root,'profiles');if(!fs.existsSync(directory))return [];return fs.readdirSync(directory).filter(file=>file.endsWith('.yaml')).sort().map(file=>({context,profile:file.slice(0,-5)}));}),counts=new Map<string,number>();
 for(const entry of entries)counts.set(entry.profile,(counts.get(entry.profile)??0)+1);
 return entries.map(({context,profile})=>{const qualified=context.plugin?`${context.plugin}/${profile}`:profile,resolved=resolveProfile(root,profile,undefined,{namespace:context}),agent=resolved.nodes.main!;return {profile,qualified,...(resolved.variants?{variants:resolved.variants,default_variant:resolved.default_variant,variant_models:variantModels(root,profile,resolved.variants,{namespace:context})}:{}),plugin:context.plugin,plugin_version:context.version,description:agent.description,ambiguous:(counts.get(profile)??0)>1,agent:agent.name,harness:agent.harness,model:{name:agent.model,reasoning:agent.reasoning_effort,speed:agent.speed??'native default'},source_file:resolved.profile_file};});
}
