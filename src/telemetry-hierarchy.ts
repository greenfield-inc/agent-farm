import {normalizeConversation,type ConversationTurn} from './telemetry-conversation.js';
type Data=Record<string,any>;
export interface ActivityNode {
  id:string;session_id:string;parent_id?:string;kind:'session'|'turn'|'agent'|'request'|'tool'|'activity'|'unlinked';
  name:string;started_at?:string;duration_ms?:number;status:string;trace_id?:string;span_id?:string;
  requests:number;cost_usd:number|null;cost_coverage:number;input_tokens:number|null;output_tokens:number|null;
}
export interface Dataset {session:Data;spans:Data[];events:Data[]}
const str=(v:unknown)=>typeof v==='string'?v.slice(0,300):undefined;
const key=(trace:unknown,span:unknown)=>trace&&span?String(trace)+'/'+String(span):undefined;
const time=(v:unknown)=>{if(typeof v!=='string'||!/^\d{1,24}$/.test(v))return;const date=new Date(Number(BigInt(v)/1000000n));return Number.isFinite(date.getTime())?date.toISOString():undefined;};
const blank={requests:0,cost_usd:null,cost_coverage:0,input_tokens:null,output_tokens:null};

/** Only explicit session/trace edges establish ownership. Timestamps never do. */
export function buildHierarchy(datasets:Dataset[]){
  const nodes:ActivityNode[]=[],byId=new Map<string,ActivityNode>(),spanIndex=new Map<string,ActivityNode[]>();
  const records=new Map<string,Data>(),contents=new Map<string,ConversationTurn[]>(),warnings:string[]=[];
  const add=(n:ActivityNode)=>{nodes.push(n);byId.set(n.id,n);return n;};
  const index=(n:ActivityNode)=>{const k=key(n.trace_id,n.span_id);if(k)spanIndex.set(k,[...(spanIndex.get(k)??[]),n]);};
  const lookup=(trace:unknown,span:unknown,session?:string)=>{const matches=spanIndex.get(key(trace,span)??'')??[];const own=matches.filter(n=>n.session_id===session);return own.length===1?own[0]:matches.length===1?matches[0]:undefined;};
  for(const {session:s} of datasets){const n=add({id:'session:'+s.id,session_id:s.id,kind:'session',name:s.profile??'Profile session',started_at:s.started_at,duration_ms:s.duration_ms,status:s.status,trace_id:s.trace_id,span_id:s.span_id,...blank});index(n);}
  for(const {session:s,spans} of datasets){
    const seen=new Set<string>();let turn=0;
    for(const row of [...spans].sort((a,b)=>String(a.start_time_unix_nano??'').localeCompare(String(b.start_time_unix_nano??'')))){
      const k=key(row.trace_id,row.span_id);if(!k||seen.has(k)||row.name==='agent_farm.session')continue;seen.add(k);
      const a=row.attributes??{},tool=str(a.tool_name??a['gen_ai.tool.name']),operation=a['gen_ai.operation.name'];
      const kind:ActivityNode['kind']=row.name==='claude_code.interaction'||a['span.type']==='interaction'||operation==='invoke_agent_turn'?'turn':operation==='invoke_agent'||['Agent','Task','spawn_agent'].includes(tool??'')?'agent':a['span.type']==='llm_request'||row.name==='claude_code.llm_request'||['chat','generate_content'].includes(operation)?'request':tool||a['span.type']==='tool'?'tool':'activity';
      const n=add({id:s.id+':'+k,session_id:s.id,kind,name:kind==='turn'?'Turn '+(++turn):kind==='agent'?(str(a['gen_ai.agent.name']??a['agent.name']??a.subagent_type)??'Sub-agent'):kind==='request'?'Model request':tool??str(row.name)??'Activity',started_at:time(row.start_time_unix_nano),duration_ms:row.duration_ms,status:row.error||a.success===false||a.success==='false'?'failed':row.end_time_unix_nano?'completed':'unfinished',trace_id:row.trace_id,span_id:row.span_id,...blank});
      records.set(n.id,row);index(n);
    }
  }
  function unlinked(session:string){const id='unlinked:'+session;return byId.get(id)??add({id,session_id:session,parent_id:'session:'+session,kind:'unlinked',name:'Unlinked activity',status:'unknown',...blank});}
  for(const n of [...nodes]){
    if(n.kind==='session'){
      const s=datasets.find(d=>d.session.id===n.session_id)!.session;
      const parentId=s.launch_parent_session_id??s.parent_session_id,parent=parentId?byId.get('session:'+parentId):undefined;
      const span=lookup(s.trace_id,s.parent_span_id,parent?.session_id);
      n.parent_id=span&&span.id!==n.id?span.id:parent?.id;
    }else{
      const row=records.get(n.id)!;const parent=lookup(row.trace_id,row.parent_span_id,n.session_id);
      n.parent_id=parent?.id??(n.kind==='turn'&&!row.parent_span_id?'session:'+n.session_id:unlinked(n.session_id).id);
    }
  }
  // Corrupt/cyclic edges must not hang traversal or hide records.
  for(const n of nodes){const seen=new Set([n.id]);let p=n.parent_id;while(p){if(seen.has(p)){n.parent_id=n.kind==='session'?undefined:unlinked(n.session_id).id;warnings.push('Cyclic ancestry was detached.');break;}seen.add(p);p=byId.get(p)?.parent_id;}}
  for(const {session:s,spans,events} of datasets){
    const normalized=normalizeConversation(spans,events);
    const promptTurns=new Map<string,ActivityNode>();
    const promptKey=(r:ConversationTurn)=>r.prompt_id?JSON.stringify([r.native_session??'',r.prompt_id]):undefined;
    for(const request of normalized.turns){let n=lookup(request.trace_id,request.span_id,s.id);const visited=new Set<string>();while(n&&!visited.has(n.id)){visited.add(n.id);if(n.kind==='turn'){const k=promptKey(request);if(k)promptTurns.set(k,n);break;}n=n.parent_id?byId.get(n.parent_id):undefined;}}
    for(const request of normalized.turns){
      let n=lookup(request.trace_id,request.span_id,s.id);
      if(!n){
        const k=promptKey(request);let parent=k?promptTurns.get(k):undefined;
        if(k&&!parent){parent=add({id:s.id+':prompt:'+encodeURIComponent(k),session_id:s.id,parent_id:'session:'+s.id,kind:'turn',name:'Turn · incomplete boundaries',status:'unknown',...blank});promptTurns.set(k,parent);warnings.push('Some turns are grouped by explicit prompt/turn IDs; elapsed time and completion were not exported.');}
        n=add({id:s.id+':content:'+request.id,session_id:s.id,parent_id:parent?.id??unlinked(s.id).id,kind:request.kind==='request'?'request':'activity',name:request.kind==='request'?'Model request':'Captured message',started_at:request.started_at,duration_ms:request.duration_ms,status:request.error?'failed':'unknown',...blank});
      }
      contents.set(n.id,[...(contents.get(n.id)??[]),request]);
      if(request.kind!=='request')continue;
      // Each normalized request contributes once to each ancestor, never span rollups.
      let current:ActivityNode|undefined=n;const seen=new Set<string>();
      while(current&&!seen.has(current.id)){seen.add(current.id);current.requests++;if(request.cost_usd!==undefined){current.cost_usd=(current.cost_usd??0)+request.cost_usd;current.cost_coverage++;}for(const field of ['input','output'] as const){const value=request.usage[field];if(value!==undefined){const dest=field==='input'?'input_tokens':'output_tokens';current[dest]=(current[dest]??0)+value;}}current=current.parent_id?byId.get(current.parent_id):undefined;}
    }
  }
  nodes.sort((a,b)=>(a.started_at??'').localeCompare(b.started_at??'')||a.id.localeCompare(b.id));
  return {nodes,contents,records,warnings:[...new Set(warnings)]};
}

export function descendants(nodes:ActivityNode[],id:string){
  const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const n of nodes)if(n.parent_id&&ids.has(n.parent_id)&&!ids.has(n.id)){ids.add(n.id);changed=true;}}return ids;
}
