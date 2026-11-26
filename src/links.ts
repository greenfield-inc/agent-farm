import {resolveProfile,splitVariant,type ResolveOptions} from './compiler.js';
import {qualifiedName} from './config.js';
import {parseParentToken,type LaunchContext,type LaunchLink,type LaunchRecord} from './runtime.js';
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
 // A ref can name both a profile and an agent; the token doesn't say which started the parent. When the two would
 // give different links, refuse rather than check against the wrong ones.
 try{const asAgent=resolveProfile(root,parent.ref,workspace,{agentOnly:true});if(asAgent.entry_kind!==resolution.entry_kind&&JSON.stringify([asAgent.nodes.main!.links??{},asAgent.nodes.main!.children])!==JSON.stringify([resolution.nodes.main!.links??{},resolution.nodes.main!.children]))throw new Error(`Parent ${parent.ref} names both a profile and an agent with different links, so ${requested} can't be checked; rename one of them`);}catch(error){if(error instanceof Error&&error.message.startsWith(`Parent ${parent.ref} names both`))throw error;}
 const main=resolution.nodes.main!,links=Object.entries(main.links??{}),context={parent};
 const {name,variant}=splitVariant(requested),wanted=qualifiedName(name);
 // A name matches a link by its alias first, then by the agent it names, bare or qualified.
 const byAlias=(alias:string)=>!wanted.plugin&&wanted.name===alias;
 const byTarget=(target:string)=>wanted.plugin?`${wanted.plugin}/${wanted.name}`===target:wanted.name===target.slice(target.indexOf('/')+1);
 const children=Object.entries(main.children).map(([alias,childRoute])=>{const child=resolution.nodes[childRoute]!;return {alias,childRoute,child,target:child.variant_set?.agent??child.qualified_name??child.name};});
 const named=links.filter(([,link])=>!link.any);
 const child=children.find(c=>byAlias(c.alias))??(named.some(([alias])=>byAlias(alias))?undefined:children.find(c=>byTarget(c.target)));
 const link=child?undefined:named.find(([alias])=>byAlias(alias))??named.find(([,l])=>byTarget(l.agent!));
 if(child){
  const {alias,childRoute,target}=child;
  if(child.child.mode==='native')throw new Error(`${requested} is ${parent.ref}'s native subagent ${alias}: it runs inside your harness, use native delegation`);
  if(variant!==undefined&&variant!==child.child.variant_set?.variant)throw new Error(`Process link ${alias} of ${parent.ref} runs ${target}${child.child.variant_set?':'+child.child.variant_set.variant:''}; it refuses :${variant}`);
  return {kind:'process',parent:parent.ref,route:childRoute,context:{...context,entry_kind:'agent',link:alias}};
 }
 if(link){
  const [alias,l]=link;
  if(l.variant&&variant!==undefined&&variant!==l.variant)throw new Error(`Launch link ${alias} of ${parent.ref} pins variant ${l.variant}; it refuses :${variant}`);
  const chosen=variant??l.variant;
  return {kind:'entry',requested:l.agent!+(chosen?':'+chosen:''),options:linkOptions(l),context:{...context,entry_kind:'agent',link:alias}};
 }
 // any: true reaches agents only, as a named link does.
 for(const [alias,l] of links){
  if(!l.any||(wanted.plugin&&wanted.plugin!==l.plugin))continue;
  const qualified=`${l.plugin}/${wanted.name}${variant!==undefined?':'+variant:''}`;
  try{resolveProfile(root,qualified,workspace,{agentOnly:true});}catch{continue;}
  return {kind:'entry',requested:qualified,options:{agentOnly:true},context:{...context,entry_kind:'agent',link:alias}};
 }
 const listed=[...Object.entries(main.children).filter(([,r])=>resolution.nodes[r]!.mode==='process').map(([alias,r])=>{const c=resolution.nodes[r]!;return `  ${alias}: agent-farm run ${c.variant_set?`${c.variant_set.agent}:${c.variant_set.variant}`:c.qualified_name} --parent ${token}`;}),
  ...links.map(([alias,link])=>link.any?`  ${alias}: any agent in ${link.plugin}: agent-farm run ${link.plugin}/<agent> --parent ${token}`:`  ${alias}: agent-farm run ${link.agent}${link.variant?':'+link.variant:''} --parent ${token}`)];
 throw new Error(`${requested} is not one of ${parent.ref}'s links, so it can't be started from there (parent from ${source}). ${listed.length?`Its links:\n${listed.join('\n')}`:'It has no launch or process links.'}`);
}

/** What a launch link changes about the entry it starts: an agent lookup, and its model and description. */
function linkOptions(link:LaunchLink):ResolveOptions{return {agentOnly:true,...(link.model?{linkModel:link.model}:{}),...(link.description?{linkDescription:link.description}:{})};}

/** A resume of a launch that started through a link. The host replays the command it ran, so NAME may be the
 *  link's alias; it resumes the agent the launch recorded, not whatever else that name resolves to. It is not
 *  checked against the parent again (§6); the link's model and description apply again only while the parent
 *  still has that link pointing at the same agent and variant. Undefined when NAME is not the recorded link. */
export function resumeLink(root:string,requested:string,record:LaunchRecord,workspace:ResolvedWorkspace|undefined):{requested:string;options:ResolveOptions}|undefined{
 if(!record.link||record.entry_kind!=='agent')return undefined;
 const {name,variant}=splitVariant(requested),agent=record.profile,bare=agent.slice(agent.indexOf('/')+1);
 if(name!==record.link&&name!==agent&&name!==bare)return undefined;
 if(variant!==undefined&&variant!==record.variant)return undefined;
 let options:ResolveOptions={agentOnly:true};
 if(record.parent_ref){try{const link=resolveProfile(root,record.parent_ref,workspace).nodes.main!.links?.[record.link];if(link&&!link.any&&link.agent===agent&&(!link.variant||link.variant===record.variant))options=linkOptions(link);}catch{/* The parent is gone; resume with the agent's own settings. */}}
 return {requested:agent+(record.variant?':'+record.variant:''),options};
}
