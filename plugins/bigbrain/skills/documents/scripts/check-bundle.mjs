#!/usr/bin/env node
// Validates a bigbrain bundle, or one worker status file, using only node: builtins.
//
//   node check-bundle.mjs <bundle dir> [--stage draft|approve|done] [--json]
//   node check-bundle.mjs --status <status file> [--json]
//
// Exit 0 when every rule passes, 1 when any fails, 2 on bad usage. Each failure names its rule.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';

const here=path.dirname(fileURLToPath(import.meta.url));
const skill=path.dirname(here);
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const schemas=Object.fromEntries(['doc-meta','control-flow','verification','status'].map(name=>[name,readJson(path.join(skill,'schemas',`${name}.schema.json`))]));
const kinds=readJson(path.join(skill,'kinds.json'));
const ID=/\b(SC|P|J|S|D|Q|F|B)-[0-9]+\b/g;
const SETTLED=new Set(['approved','in-build','done']);

// A JSON Schema subset: exactly the keywords bigbrain's schemas use.
function validate(schema,value,root=schema,where='$'){
 const errors=[];
 if(schema.$ref){const name=schema.$ref.replace(/^#\/\$defs\//,'');const target=root.$defs?.[name];if(!target)return [`${where}: unknown $ref ${schema.$ref}`];return validate(target,value,root,where);}
 const type=value===null?'null':Array.isArray(value)?'array':Number.isInteger(value)?'integer':typeof value;
 if(schema.type){const allowed=[schema.type].flat();if(!allowed.some(t=>t===type||(t==='number'&&type==='integer')))return [`${where}: expected ${allowed.join(' or ')}, got ${type}`];}
 if('const' in schema&&!isDeepStrictEqual(schema.const,value))errors.push(`${where}: must be ${JSON.stringify(schema.const)}`);
 if(schema.enum&&!schema.enum.some(item=>isDeepStrictEqual(item,value)))errors.push(`${where}: must be one of ${schema.enum.map(v=>JSON.stringify(v)).join(', ')}`);
 if(schema.anyOf&&!schema.anyOf.some(option=>!validate(option,value,root,where).length))errors.push(`${where}: matches none of the allowed shapes`);
 if(type==='string'){
  if(schema.minLength!==undefined&&value.length<schema.minLength)errors.push(`${where}: must not be empty`);
  if(schema.pattern&&!new RegExp(schema.pattern).test(value))errors.push(`${where}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
 }
 if(type==='integer'||type==='number'){
  if(schema.minimum!==undefined&&value<schema.minimum)errors.push(`${where}: must be at least ${schema.minimum}`);
  if(schema.maximum!==undefined&&value>schema.maximum)errors.push(`${where}: must be at most ${schema.maximum}`);
 }
 if(type==='array'){
  if(schema.minItems!==undefined&&value.length<schema.minItems)errors.push(`${where}: needs at least ${schema.minItems} item(s)`);
  if(schema.uniqueItems&&new Set(value.map(v=>JSON.stringify(v))).size!==value.length)errors.push(`${where}: items must be unique`);
  if(schema.items)value.forEach((item,i)=>errors.push(...validate(schema.items,item,root,`${where}[${i}]`)));
 }
 if(type==='object'){
  for(const key of schema.required??[])if(!(key in value))errors.push(`${where}: missing ${key}`);
  for(const [key,item] of Object.entries(value)){
   const at=`${where}.${key}`;
   if(schema.properties&&key in schema.properties){errors.push(...validate(schema.properties[key],item,root,at));continue;}
   const pattern=Object.entries(schema.patternProperties??{}).find(([p])=>new RegExp(p).test(key));
   if(pattern){errors.push(...validate(pattern[1],item,root,at));continue;}
   if(schema.additionalProperties===false)errors.push(`${at}: not allowed`);
   else if(typeof schema.additionalProperties==='object')errors.push(...validate(schema.additionalProperties,item,root,at));
  }
 }
 return errors;
}

const stripCode=html=>html.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ');
const decode=text=>text.replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const visibleText=html=>decode(stripCode(html).replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]+>/g,' '));
const elementIds=html=>new Set([...stripCode(html).matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]));
const count=(text,needle)=>text.split(needle).length-1;

function docMeta(html){
 const match=/<script\b[^>]*\bid\s*=\s*["']doc-meta["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
 if(!match)return {missing:true};
 try{return {value:JSON.parse(match[1])};}catch(error){return {error:error.message};}
}

export function checkBundle(dir,{stage='draft'}={}){
 const errors=[],fail=(rule,file,message)=>errors.push({rule,file,message});
 dir=path.resolve(dir);
 const manifestFile=path.join(dir,'bundle.json');
 let manifest;
 try{manifest=readJson(manifestFile);}catch(error){fail('bundle-json','bundle.json',`cannot read: ${error.message}`);return finish(errors);}
 if(!Array.isArray(manifest.documents)||manifest.documents.some(d=>typeof d!=='string')){fail('bundle-json','bundle.json','documents must be a list of paths');return finish(errors);}
 for(const doc of manifest.documents)if(!fs.existsSync(path.join(dir,doc)))fail('bundle-json','bundle.json',`lists ${doc}, which does not exist`);

 const pages=[];
 for(const doc of manifest.documents.filter(d=>d.endsWith('.html')&&path.posix.basename(d)!=='trace.html'&&fs.existsSync(path.join(dir,d)))){
  const html=fs.readFileSync(path.join(dir,doc),'utf8'),meta=docMeta(html);
  if(meta.missing){fail('doc-meta',doc,'no <script type="application/json" id="doc-meta"> block');continue;}
  if(meta.error){fail('doc-meta',doc,`doc-meta is not JSON: ${meta.error}`);continue;}
  const problems=validate(schemas['doc-meta'],meta.value);
  if(problems.length){problems.forEach(p=>fail('doc-meta',doc,p));continue;}
  pages.push({doc,html,meta:meta.value,ids:elementIds(html),text:visibleText(html)});
 }

 // Definitions: page doc-meta, plus F-n headings in findings files.
 const defined=new Map();
 const define=(id,doc)=>{if(defined.has(id))fail('ids-unique',doc,`${id} is also defined in ${defined.get(id)}`);else defined.set(id,doc);};
 for(const page of pages)if(page.meta.status!=='superseded'&&page.meta.status!=='withdrawn')for(const id of page.meta.defines)define(id,page.doc);
 const findings=path.join(dir,'findings');
 if(fs.existsSync(findings))for(const file of fs.readdirSync(findings).filter(f=>f.endsWith('.md'))){
  const text=fs.readFileSync(path.join(findings,file),'utf8');
  for(const m of text.matchAll(/^(?:#+\s*)?(F-[0-9]+)\b/gm))if(!defined.has(m[1]))defined.set(m[1],`findings/${file}`);
 }

 for(const page of pages){
  const {doc,html,meta,ids,text}=page,spec=kinds[meta.kind];
  for(const section of spec.sections)if(!ids.has(section))fail('sections',doc,`missing the ${meta.kind} section #${section}`);
  for(const id of meta.defines){
   if(!ids.has(id))fail('id-anchors',doc,`defines ${id} but has no element with id="${id}"`);
   const prefix=id.split('-')[0];if(!spec.defines.includes(prefix))fail('id-anchors',doc,`a ${meta.kind} page cannot define ${prefix}-n IDs (${id})`);
  }
  for(const id of meta.cites)if(!defined.has(id))fail('ids-defined',doc,`cites ${id}, which no page defines`);
  // The Session map spans bundles, so the IDs it mentions live in other bundles.
  if(meta.kind!=='map')for(const id of new Set([...text.matchAll(ID)].map(m=>m[0])))if(!defined.has(id))fail('ids-defined',doc,`mentions ${id}, which no page defines`);
  const decisions=count(text,'[NEEDS DECISION'),assumptions=count(text,'[ASSUMPTION');
  if(decisions!==meta.open.needs_decision)fail('open-counts',doc,`doc-meta says ${meta.open.needs_decision} NEEDS DECISION marker(s), the page has ${decisions}`);
  if(assumptions!==meta.open.assumptions)fail('open-counts',doc,`doc-meta says ${meta.open.assumptions} ASSUMPTION marker(s), the page has ${assumptions}`);
  if(decisions&&(SETTLED.has(meta.status)||stage!=='draft'))fail('needs-decision',doc,`${decisions} open [NEEDS DECISION] marker(s) on a page that is ${stage==='draft'?meta.status:`going to ${stage}`}; each must become a relay question and a D-n first`);
  checkLinks(dir,doc,html,fail);
 }

 const coverSheet=pages.find(p=>p.meta.kind==='cover-sheet'&&p.meta.status!=='superseded');
 const flowFile=path.join(dir,'control-flow.json');
 let flow;
 if(fs.existsSync(flowFile)){
  try{flow=readJson(flowFile);}catch(error){fail('schema:control-flow','control-flow.json',`not JSON: ${error.message}`);}
  const problems=flow?validate(schemas['control-flow'],flow):[];
  problems.forEach(p=>fail('schema:control-flow','control-flow.json',p));
  if(flow&&!problems.length)checkFlow(dir,flow,coverSheet,defined,fail);
  else flow=undefined;
 }else if(coverSheet)fail('control-flow-refs','control-flow.json','the bundle has a cover sheet but no control-flow.json');

 const verificationFile=path.join(dir,'evidence','verification.json');
 if(fs.existsSync(verificationFile)){
  let record;
  try{record=readJson(verificationFile);}catch(error){fail('schema:verification','evidence/verification.json',`not JSON: ${error.message}`);}
  const problems=record?validate(schemas.verification,record):[];
  problems.forEach(p=>fail('schema:verification','evidence/verification.json',p));
  if(record&&!problems.length&&flow)checkVerification(dir,record,flow,stage,fail);
 }else if(flow&&stage!=='draft')fail('verification-rows','evidence/verification.json',`missing; the planner creates one row per J/S before ${stage}`);
 return finish(errors);
}

function checkLinks(dir,doc,html,fail){
 const base=path.dirname(path.join(dir,doc));
 for(const m of stripCode(html).matchAll(/\s(?:href|src)\s*=\s*["']([^"']*)["']/gi)){
  const link=decode(m[1]).trim();
  if(!link||/^[a-z][a-z0-9+.-]*:/i.test(link)||link.startsWith('//'))continue;
  const [target,anchor]=link.split('#');
  const file=target?path.resolve(base,decodeURIComponent(target)):path.join(dir,doc);
  const relative=path.relative(dir,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){fail('links',doc,`${link} points outside the bundle`);continue;}
  if(!fs.existsSync(file)){fail('links',doc,`${link} does not resolve`);continue;}
  if(anchor&&file.endsWith('.html')&&!elementIds(fs.readFileSync(file,'utf8')).has(decodeURIComponent(anchor)))fail('links',doc,`${link}: no element with id="${anchor}"`);
 }
}

function checkFlow(dir,flow,coverSheet,defined,fail){
 const file='control-flow.json',flowIds=Object.keys(flow.flows),steps=flow.steps;
 const declared=new Set(coverSheet?coverSheet.meta.defines:[]);
 for(const id of flowIds)if(!declared.has(id))fail('control-flow-refs',file,`flow ${id} is not defined by the cover sheet`);
 for(const id of declared)if(/^(J|S)-/.test(id)&&!flowIds.includes(id))fail('control-flow-refs',file,`the cover sheet defines ${id}, but control-flow.json has no flow for it`);
 for(const [id,item] of Object.entries(flow.flows))for(const cover of item.covers)if(!defined.has(cover))fail('control-flow-refs',file,`${id} covers ${cover}, which no page defines`);
 const seen=new Set();
 for(const step of steps){
  if(seen.has(step.id))fail('control-flow-refs',file,`step id ${step.id} is used twice`);seen.add(step.id);
  const need=(cond,message)=>{if(!cond)fail('control-flow-refs',file,`${step.id}: ${message}`);};
  need((step.actor==='orchestrator')===(step.do==='review'||step.do==='design'),`${step.do} steps belong to the ${step.do==='review'||step.do==='design'?'orchestrator':'implementer'}`);
  if(step.do==='build'){need(step.package,'a build step names its package');need(!step.package||declared.has(step.package),`package ${step.package} is not on the cover sheet`);}
  if(step.do==='verify'||step.do==='qa')need(step.flows,'names the flows it proves');
  for(const id of step.flows??[])need(flowIds.includes(id),`flow ${id} is not in flows`);
  if(step.do==='review'){
   need(step.scope,'a review step names its scope');
   for(const id of Array.isArray(step.scope)?step.scope:[])need(declared.has(id),`scope ${id} is not on the cover sheet`);
   if(step.scope&&step.scope!=='all'&&step.review!=='none'){need(step.reason_kind,'a checkpoint review needs a reason_kind');need(step.reason,'a checkpoint review needs a one-line reason');}
   if(step.review==='none'){need(step.approved_by,'"review": "none" needs the D-n that approved it');need(!step.approved_by||defined.has(step.approved_by),`${step.approved_by} is not defined`);}
  }
 }
 for(const id of declared)if(/^P-/.test(id)&&!steps.some(s=>s.do==='build'&&s.package===id))fail('control-flow-refs',file,`package ${id} has no build step`);
 const reviews=steps.filter(s=>s.do==='review');
 if(!reviews.length||reviews.at(-1).scope!=='all')fail('review-points',file,'the last review step must be the end review (scope "all"), or a "review": "none" waiver with its D-n');
 for(const mockup of flow.qa.mockups??[])if(!fs.existsSync(path.join(dir,mockup)))fail('links',file,`qa.mockups lists ${mockup}, which does not exist`);
 if(coverSheet){
  const match=/<[^>]+\bid\s*=\s*["']control-flow["'][^>]*>([\s\S]*?)<\/section>/i.exec(coverSheet.html)??/<[^>]+\bid\s*=\s*["']control-flow["'][^>]*>([\s\S]*)/i.exec(coverSheet.html);
  const opening=/<[^>]+\bid\s*=\s*["']control-flow["'][^>]*>/i.exec(coverSheet.html)?.[0]??'';
  const section=match?.[1]??'';
  const revision=/data-control-flow-revision\s*=\s*["'](\d+)["']/.exec(opening+section)?.[1];
  if(Number(revision)!==flow.revision)fail('control-flow-render',coverSheet.doc,`the Control flow section shows revision ${revision??'none'}, control-flow.json is revision ${flow.revision}; re-render it from the JSON`);
  const rendered=[...section.matchAll(/data-step\s*=\s*["']([^"']+)["']/g)].map(m=>m[1]);
  if(!isDeepStrictEqual(rendered,steps.map(s=>s.id)))fail('control-flow-render',coverSheet.doc,`the Control flow section lists steps [${rendered.join(', ')}], control-flow.json has [${steps.map(s=>s.id).join(', ')}]`);
 }
}

function checkVerification(dir,record,flow,stage,fail){
 const file='evidence/verification.json',rows=record.rows,ids=rows.map(r=>r.id);
 if(record.control_flow_revision!==flow.revision)fail('verification-rows',file,`rows were made from control-flow revision ${record.control_flow_revision}, the flow is revision ${flow.revision}`);
 if(new Set(ids).size!==ids.length)fail('verification-rows',file,'a check has more than one row');
 for(const id of Object.keys(flow.flows))if(!ids.includes(id))fail('verification-rows',file,`no row for ${id}; nobody removes a check`);
 for(const row of rows){
  if(!flow.flows[row.id]){fail('verification-rows',file,`row ${row.id} is not a flow in control-flow.json; nobody adds a check`);continue;}
  if(!isDeepStrictEqual(row.flow,flow.flows[row.id]))fail('verification-reworded',file,`row ${row.id} no longer matches control-flow.json; checks are copied exactly and never reworded`);
  if(stage==='done'&&row.verdict==='pending')fail('verification-verdicts',file,`${row.id} has no verdict; every J/S needs pass, fail or undetermined before done`);
  if(row.verdict==='pass'&&!row.evidence.length)fail('verification-verdicts',file,`${row.id} passes with no evidence`);
 }
 // Evidence entries are bundle-relative paths, or a short quoted result (which contains a space).
 const entries=[...rows.flatMap(r=>r.evidence.map(e=>[r.id,e])),...(record.jank??[]).flatMap(j=>(j.evidence??[]).map(e=>[j.item,e])),...(record.mockup_fidelity??[]).flatMap(m=>[[m.screen,m.mockup],[m.screen,m.built]])];
 for(const [owner,entry] of entries)if(!/\s/.test(entry)&&!fs.existsSync(path.join(dir,entry)))fail('evidence',file,`${owner}: evidence ${entry} does not exist in the bundle`);
}

export function checkStatus(file){
 const errors=[],fail=(rule,message)=>errors.push({rule,file:path.basename(file),message});
 let status;
 try{status=readJson(file);}catch(error){fail('schema:status',`cannot read: ${error.message}`);return finish(errors);}
 validate(schemas.status,status).forEach(p=>fail('schema:status',p));
 if(!errors.length){
  if(status.state==='needs_you'&&!status.needs_you)fail('status-state','state needs_you needs a needs_you block');
  if(status.state!=='needs_you'&&status.needs_you&&status.needs_you.blocking)fail('status-state',`a blocking needs_you belongs with state needs_you, not ${status.state}`);
  if(status.state==='checkpoint'&&!status.checkpoint)fail('status-state','state checkpoint needs a checkpoint block with the step and pushed head');
 }
 return finish(errors);
}

function finish(errors){return {result:errors.length?'fail':'pass',errors};}

function main(argv){
 const args=[...argv],flag=name=>{const i=args.indexOf(name);if(i<0)return undefined;const value=args[i+1];args.splice(i,2);return value;};
 const json=args.includes('--json');if(json)args.splice(args.indexOf('--json'),1);
 const statusFile=flag('--status'),stage=flag('--stage')??'draft';
 if(!['draft','approve','done'].includes(stage)||(!statusFile&&args.length!==1)||(statusFile&&args.length)){
  process.stderr.write('Usage: check-bundle.mjs <bundle dir> [--stage draft|approve|done] [--json]\n       check-bundle.mjs --status <status file> [--json]\n');return 2;
 }
 const report=statusFile?checkStatus(statusFile):checkBundle(args[0],{stage});
 if(json)process.stdout.write(JSON.stringify(report,null,2)+'\n');
 else if(report.result==='pass')process.stdout.write(`check-bundle: pass (${statusFile?'status '+path.basename(statusFile):`stage ${stage}`})\n`);
 else{for(const e of report.errors)process.stdout.write(`FAIL ${e.rule} ${e.file}: ${e.message}\n`);process.stdout.write(`check-bundle: fail (${report.errors.length} problem${report.errors.length===1?'':'s'})\n`);}
 return report.result==='pass'?0:1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main(process.argv.slice(2));
