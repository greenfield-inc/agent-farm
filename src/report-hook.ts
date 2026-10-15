// Turn-end safety net for agents that declare `auto_report`. Copied into launch bundles as
// report-hook.mjs, so it imports only node: builtins. It must never fail the harness: every
// error ends in a silent exit 0.
//   Claude Stop hook:  node report-hook.mjs claude <status file>        (hook JSON on stdin)
//   Codex notify:      node report-hook.mjs codex <status file> <chained notify JSON> <payload>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';

type Entry=Record<string,any>;
interface Report {state:'ready'|'blocked'|'failed'|'done';question?:string;pr?:string;head?:string;summary:string}

const reportCall=/\brunpane\b[^\n]*?\breport\b/;
const jsonLines=(file:string):Entry[]=>fs.readFileSync(file,'utf8').split('\n').flatMap(line=>{try{const value=JSON.parse(line);return value&&typeof value==='object'?[value]:[];}catch{return [];}});
const text=(content:unknown):string=>typeof content==='string'?content:Array.isArray(content)?content.map(part=>typeof part==='string'?part:part?.type==='text'||part?.type==='output_text'?part.text??'':'').join(''):'';

/** Claude: the turn runs from the last message a person (or Pane, for them) submitted. */
function claudeTurn(entries:Entry[]){
  const human=(e:Entry)=>e.type==='user'&&!e.isMeta&&(e.origin?e.origin.kind==='human':text(e.message?.content).trim()!==''&&!text(e.message?.content).startsWith('<task-notification>'));
  let start=-1;for(let i=entries.length-1;i>=0;i--)if(human(entries[i]!)){start=i;break;}
  const turn=entries.slice(start+1);
  const reported=turn.some(e=>e.type==='assistant'&&Array.isArray(e.message?.content)&&e.message.content.some((part:Entry)=>part?.type==='tool_use'&&reportCall.test(JSON.stringify(part.input??{}))));
  // Background shells and agents announce themselves in their tool result and finish with a task notification.
  const pending=new Set<string>();
  for(const e of entries){
    if(e.type!=='user')continue;
    const content=e.message?.content;
    if(Array.isArray(content))for(const part of content)if(part?.type==='tool_result'&&/running in background with ID|Async agent launched/.test(text(part.content)))pending.add(part.tool_use_id);
    for(const match of text(content).matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>/g))pending.delete(match[1]!);
  }
  const last=[...turn].reverse().find(e=>e.type==='assistant'&&text(e.message?.content).trim());
  return {boundary:String(entries[start]?.uuid??'start'),reported,pending:pending.size>0,lastMessage:last?text(last.message.content):''};
}

/** Codex: the turn notify names, from its task_started event to the end of the rollout. */
function codexTurn(entries:Entry[],turn:string){
  let start=entries.findLastIndex(e=>e.payload?.type==='task_started'&&e.payload.turn_id===turn);
  if(start<0)start=entries.findLastIndex(e=>e.payload?.type==='task_started');
  const call=(e:Entry)=>(e.type==='response_item'&&/_call$/.test(e.payload?.type??''))||(e.payload?.type==='item_completed'&&e.payload.item?.type==='CommandExecution');
  const reported=entries.slice(start+1).some(e=>call(e)&&reportCall.test(JSON.stringify(e.payload)));
  return {reported};
}
function rollout(home:string,thread:string):string|undefined{
  const sessions=path.join(home,'sessions');
  const walk=(dir:string,depth:number):string|undefined=>{
    let names:string[];try{names=fs.readdirSync(dir).sort().reverse();}catch{return undefined;}
    for(const name of names){
      if(depth===3){if(name.endsWith(thread+'.jsonl'))return path.join(dir,name);continue;}
      const found=walk(path.join(dir,name),depth+1);if(found)return found;
    }
    return undefined;
  };
  return walk(sessions,0);
}

/** Maps the worker's status file to a report the way bigbrain's contract.md does. */
function statusReport(status:Entry,file:string,lastMessage:string):Report|undefined{
  const pr=typeof status.pr==='number'||typeof status.pr==='string'?String(status.pr):undefined;
  const head=typeof status.checkpoint?.head==='string'?status.checkpoint.head:typeof status.head==='string'?status.head:undefined;
  const summary=[`Automatic report: the agent ended its turn without running runpane report, so this comes from its status file ${file}.`,'',JSON.stringify(status,null,2),...(lastMessage?['','Last message:',lastMessage]:[])].join('\n');
  const question=status.needs_you?[status.needs_you.id,status.needs_you.title].filter(Boolean).join(': '):undefined;
  switch(status.state){
    // Still working, for example waiting on a background task.
    case 'running':return undefined;
    case 'needs_you':return {state:'blocked',question:question||'needs_you (see the status file)',summary};
    case 'checkpoint':return {state:'ready',pr,head,summary};
    case 'blocked':return {state:'blocked',question:question||(typeof status.failure==='string'&&status.failure)||'Blocked (see the status file)',summary};
    case 'done':return pr?{state:'ready',pr,head,summary}:{state:'done',summary};
    case 'failed':return {state:'failed',summary};
    default:return {state:'blocked',question:`Status file state ${JSON.stringify(status.state)} is not one the contract defines`,summary};
  }
}

function send(report:Report,marker:string){
  const signature=JSON.stringify([report.state,report.question,report.pr,report.head]);
  try{if(fs.readFileSync(marker,'utf8')===signature)return;}catch{}
  const args=['report','--state',report.state,...(report.pr&&/^\d+$/.test(report.pr)?['--pr',report.pr]:[]),...(report.head&&/^[0-9a-f]{7,40}$/i.test(report.head)?['--head',report.head]:[]),...(report.question?['--question',report.question]:[]),'--summary-file','-'];
  const result=spawnSync(process.env.PANE_RUNPANE_BIN||'runpane',args,{input:report.summary.slice(0,16000),stdio:['pipe','ignore','ignore'],timeout:20000});
  if(result.status===0){fs.mkdirSync(path.dirname(marker),{recursive:true,mode:0o700});fs.writeFileSync(marker,signature);}
}

async function main(){
  const [harness,statusFile,...rest]=process.argv.slice(2);
  if(!statusFile)return;
  let payload:Entry,turn:{boundary:string;reported:boolean;pending?:boolean;lastMessage:string};
  if(harness==='claude'){
    const chunks:Buffer[]=[];for await(const chunk of process.stdin)chunks.push(chunk as Buffer);
    payload=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
    const found=payload.transcript_path?claudeTurn(jsonLines(payload.transcript_path)):{boundary:'start',reported:false,pending:false,lastMessage:''};
    turn={...found,lastMessage:typeof payload.last_assistant_message==='string'?payload.last_assistant_message:found.lastMessage};
  }else if(harness==='codex'){
    const [chained,raw]=[rest[0],rest.at(-1)];
    // Codex runs one notify program; pass the turn on to the one this one replaced.
    try{const program=JSON.parse(chained??'[]');if(Array.isArray(program)&&program.length&&program.every(v=>typeof v==='string'))spawn(program[0]!,[...program.slice(1),raw??''],{detached:true,stdio:'ignore'}).on('error',()=>{}).unref();}catch{}
    payload=JSON.parse(raw??'{}');
    if(payload.type!=='agent-turn-complete')return;
    const file=rollout(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),String(payload['thread-id']??''));
    // Side threads, such as the one that writes the thread title, notify too but keep no rollout.
    if(!file)return;
    turn={boundary:String(payload['turn-id']??'start'),reported:codexTurn(jsonLines(file),String(payload['turn-id']??'')).reported,lastMessage:String(payload['last-assistant-message']??'')};
  }else return;
  if(!process.env.PANE_PANEL_ID||turn.reported)return;
  let report:Report|undefined;
  if(fs.existsSync(statusFile)){
    let status:Entry;try{status=JSON.parse(fs.readFileSync(statusFile,'utf8'));}catch{status={state:'unreadable'};}
    report=statusReport(status,statusFile,turn.lastMessage);
  }else if(!turn.pending)report={state:'done',summary:[`Automatic report: the agent ended its turn without running runpane report and wrote no status file (${statusFile}).`,'',turn.lastMessage||'(no final message)'].join('\n')};
  if(!report)return;
  const key=createHash('sha256').update([process.env.PANE_PANEL_ID,statusFile,String(payload.session_id??payload['thread-id']??''),turn.boundary].join('\0')).digest('hex').slice(0,32);
  send(report,path.join(os.tmpdir(),'agent-farm-auto-report',key));
}

main().catch(()=>{}).finally(()=>{process.exitCode=0;});
