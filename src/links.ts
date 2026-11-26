import {resolveProfile,splitVariant,type ResolveOptions} from './compiler.js';
import {qualifiedName} from './config.js';
import {parseParentToken,type LaunchContext} from './runtime.js';
import type {ResolvedWorkspace} from './workspaces.js';

/** What a launch with a parent runs once its name passed the parent's links. */
export type CheckedLaunch =
  | {kind:'entry';requested:string;options:ResolveOptions;context:LaunchContext}
  /** A process link started by name: the parent's compiled route, run the way its dispatcher runs it. */
  | {kind:'process';parent:string;route:string;context:LaunchContext};

/** Checks NAME against the parent's launch and process links (D2): the link is the permission. It is not a
 *  security boundary (an agent with a shell can drop the parent); it catches wrong and stale names and records who
 *  started whom. `source` says where the token came from, for the error. */
export function checkParent(root:string,requested:string,token:string,workspace:ResolvedWorkspace|undefined,source:'--parent'|'AGENT_FARM_PARENT'):CheckedLaunch{
 const parent=parseParentToken(token);
 let resolution:ReturnType<typeof resolveProfile>;
 try{resolution=resolveProfile(root,parent.ref,workspace);}catch(error){throw new Error(`Parent ${parent.ref} (from ${source}) does not resolve here, so ${requested} can't be checked against its links: ${error instanceof Error?error.message:error}`);}
 const main=resolution.nodes.main!,links=Object.entries(main.links??{}),context={parent};
 const {name,variant}=splitVariant(requested),wanted=qualifiedName(name);
 // A name matches a link by its alias or by the agent it names, bare or qualified.
 const matches=(alias:string,target:string)=>wanted.plugin?`${wanted.plugin}/${wanted.name}`===target:wanted.name===alias||wanted.name===target.slice(target.indexOf('/')+1);
 for(const [alias,childRoute] of Object.entries(main.children)){
  const child=resolution.nodes[childRoute]!,target=child.variant_set?.agent??child.qualified_name??child.name;
  if(!matches(alias,target))continue;
  if(child.mode==='native')throw new Error(`${requested} is ${parent.ref}'s native subagent ${alias}: it runs inside your harness, use native delegation`);
  if(variant!==undefined&&variant!==child.variant_set?.variant)throw new Error(`Process link ${alias} of ${parent.ref} runs ${target}${child.variant_set?':'+child.variant_set.variant:''}; it refuses :${variant}`);
  return {kind:'process',parent:parent.ref,route:childRoute,context:{...context,entry_kind:'agent',link:alias}};
 }
 for(const [alias,link] of links){
  if(link.any||!matches(alias,link.agent!))continue;
  if(link.variant&&variant!==undefined&&variant!==link.variant)throw new Error(`Launch link ${alias} of ${parent.ref} pins variant ${link.variant}; it refuses :${variant}`);
  const chosen=variant??link.variant;
  return {kind:'entry',requested:link.agent!+(chosen?':'+chosen:''),options:{agentOnly:true,...(link.model?{linkModel:link.model}:{})},context:{...context,entry_kind:'agent',link:alias}};
 }
 for(const [alias,link] of links){
  if(!link.any||(wanted.plugin&&wanted.plugin!==link.plugin))continue;
  const qualified=`${link.plugin}/${wanted.name}${variant!==undefined?':'+variant:''}`;
  let entry:ReturnType<typeof resolveProfile>|undefined;try{entry=resolveProfile(root,qualified,workspace);}catch{continue;}
  return {kind:'entry',requested:qualified,options:{},context:{...context,entry_kind:entry.entry_kind,link:alias}};
 }
 const listed=[...Object.entries(main.children).filter(([,r])=>resolution.nodes[r]!.mode==='process').map(([alias,r])=>{const c=resolution.nodes[r]!;return `  ${alias}: agent-farm run ${c.variant_set?`${c.variant_set.agent}:${c.variant_set.variant}`:c.qualified_name} --parent ${token}`;}),
  ...links.map(([alias,link])=>link.any?`  ${alias}: any agent in ${link.plugin}: agent-farm run ${link.plugin}/<agent> --parent ${token}`:`  ${alias}: agent-farm run ${link.agent}${link.variant?':'+link.variant:''} --parent ${token}`)];
 throw new Error(`${requested} is not one of ${parent.ref}'s links, so it can't be started from there (parent from ${source}). ${listed.length?`Its links:\n${listed.join('\n')}`:'It has no launch or process links.'}`);
}
