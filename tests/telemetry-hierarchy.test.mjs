import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildHierarchy,descendants} from '../dist/telemetry-hierarchy.js';
import {TelemetryStore} from '../dist/telemetry-query.js';
import {startTelemetryUI} from '../dist/telemetry-ui.js';

const trace='a'.repeat(32),base=1700000000000;
const nanos=ms=>String(BigInt(base+ms)*1000000n);
const root={id:'root',profile:'implementer',trace_id:trace,span_id:'root-span',started_at:new Date(base).toISOString(),duration_ms:272000,status:'success'};
const span=(id,parent,kind,start,duration,attributes={})=>({trace_id:trace,span_id:id,parent_span_id:parent,name:kind==='turn'?'claude_code.interaction':kind==='request'?'claude_code.llm_request':'claude_code.tool',start_time_unix_nano:nanos(start),end_time_unix_nano:nanos(start+duration),duration_ms:duration,attributes:{'session.id':'native',...(kind==='request'?{request_id:id,input_tokens:10,output_tokens:5,cost_usd:.01,stop_reason:'end_turn','gen_ai.output.messages':JSON.stringify([{role:'assistant',content:'All tests passed.'}])}:{}),...attributes}});
function fixture(){return {session:root,events:[],spans:[span('turn','root-span','turn',0,228000,{user_prompt:'Fix retry policy'}),span('main','turn','request',0,1000),span('research','turn','tool',8000,42000,{tool_name:'Agent',subagent_type:'researcher'}),span('research-request','research','request',9000,30000),span('impl','turn','tool',32000,96000,{tool_name:'Agent',subagent_type:'implementer'}),span('test','impl','tool',72000,23000,{tool_name:'Task',subagent_type:'test-runner'}),span('test-request','test','request',73000,22000),span('final','turn','request',220000,8000),span('turn2','root-span','turn',228000,44000,{user_prompt:'Add timeout coverage'})]};}
test('explicit nested and parallel agents retain turn boundaries and deduplicate request rollups',()=>{
 const f=fixture();f.spans.push(f.spans[1]);const g=buildHierarchy([f]);const find=id=>g.nodes.find(n=>n.span_id===id);
 assert.equal(find('turn').kind,'turn');assert.equal(find('research').kind,'agent');assert.equal(find('test').parent_id,find('impl').id);
 assert.equal(find('turn').duration_ms,228000);assert.equal(find('turn').requests,4);assert.equal(find('turn').cost_usd,.04);assert.equal(find('turn').output_tokens,20);assert.equal(find('root-span').requests,4);
 assert.equal(find('turn2').name,'Turn 2');assert.ok(descendants(g.nodes,find('impl').id).has(find('test-request').id));assert.equal(find('impl').cost_usd,.01);
});
test('child launches link to their spawning span; unknown parents and cycles remain visible',()=>{
 const f=fixture(),child={...root,id:'child',parent_session_id:'root',span_id:'child-span',parent_span_id:'impl'};
 const g=buildHierarchy([f,{session:child,spans:[],events:[]}]);assert.equal(g.nodes.find(n=>n.id==='session:child').parent_id,g.nodes.find(n=>n.span_id==='impl').id);
 const malformed=fixture();malformed.spans.push(span('orphan','missing','request',100,20),span('cycle1','cycle2','tool',0,1),span('cycle2','cycle1','tool',0,1));const bad=buildHierarchy([malformed]);assert.equal(bad.nodes.find(n=>n.span_id==='orphan').parent_id,'unlinked:root');assert.match(bad.warnings.join(),/Cyclic/);
 for(const n of bad.nodes){const seen=new Set();let p=n;while(p){assert.ok(!seen.has(p.id));seen.add(p.id);p=bad.nodes.find(x=>x.id===p.parent_id);}}
});
test('trace IDs isolate repeated span IDs; missing boundaries never create synthetic completed turns',()=>{
 const f=fixture();f.spans=[span('same','missing','request',0,10),{...span('same','missing','request',10,10),trace_id:'b'.repeat(32),attributes:{'session.id':'other',request_id:'other'}}];const g=buildHierarchy([f]);assert.equal(g.nodes.filter(n=>n.kind==='request').length,2);assert.equal(g.nodes.filter(n=>n.kind==='turn').length,0);assert.equal(g.nodes.find(n=>n.kind==='session').requests,2);
});
test('Codex explicit turn IDs group log-only activity without inventing duration or completion',()=>{
 const events=[{time_unix_nano:nanos(0),attributes:{'event.name':'codex.user_prompt','conversation.id':'codex-thread','turn.id':'turn-a',prompt:'Hello'}},{time_unix_nano:nanos(20),attributes:{'event.name':'codex.api_request','conversation.id':'codex-thread','turn.id':'turn-a',request_id:'response-a'}}];
 const g=buildHierarchy([{session:root,spans:[],events}]),turn=g.nodes.find(n=>n.kind==='turn');assert.ok(turn);assert.equal(turn.duration_ms,undefined);assert.equal(turn.status,'unknown');assert.equal(turn.requests,1);assert.ok(g.warnings.length);
});

function storeFixture(t){
 const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'farm-hierarchy-'))),project=path.join(dir,'project'),telemetry=path.join(dir,'telemetry');fs.mkdirSync(project);fs.mkdirSync(telemetry);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const rootId=randomUUID(),childId=randomUUID(),foreignId=randomUUID();
 const attrs=a=>Object.entries(a).map(([key,v])=>({key,value:typeof v==='number'?{doubleValue:v}:{stringValue:String(v)}}));
 const save=(id,parent,foreign=false)=>{const folder=path.join(telemetry,id);fs.mkdirSync(folder);fs.writeFileSync(path.join(folder,'session.json'),JSON.stringify({id,traceId:trace,spanId:id===rootId?'root-span':'child-span',parentSpanId:parent?'impl':undefined,startTimeUnixNano:nanos(0),endTimeUnixNano:nanos(272000),state:'finished',exitCode:0,attributes:{'agent_farm.parent.session.id':parent,'agent_farm.profile':parent?'child':'implementer','agent_farm.project.directory':foreign?'/outside':project}}));return folder;};
 const folder=save(rootId);save(childId,rootId);save(foreignId,rootId,true);
 const f=fixture();fs.writeFileSync(path.join(folder,'traces.jsonl'),JSON.stringify({resourceSpans:[{scopeSpans:[{spans:f.spans.map(r=>({name:r.name,traceId:r.trace_id,spanId:r.span_id,parentSpanId:r.parent_span_id,startTimeUnixNano:r.start_time_unix_nano,endTimeUnixNano:r.end_time_unix_nano,attributes:attrs(r.attributes)}))}]}]})+'\n');
 return {options:{directory:telemetry,projectDirectory:project,scope:'project'},rootId,childId,foreignId};
}
test('run lists group before pagination/filtering, explorer isolates scope and exposes exact final response',async t=>{
 const f=storeFixture(t),store=new TelemetryStore(f.options);const runs=await store.runs({profile:'child',limit:1});assert.equal(runs.items.length,1);assert.equal(runs.items[0].id,f.rootId);assert.equal(runs.items[0].child_sessions,1);
 const data=await store.explorer({session_id:f.rootId});assert.equal(data.nodes.filter(n=>n.kind==='session').length,2);const turn=data.nodes.find(n=>n.kind==='turn');
 const detail=await store.explorer({session_id:f.rootId,node_id:turn.id,limit:1});assert.equal(detail.prompt,'Fix retry policy');assert.equal(detail.total_requests,2);assert.equal(detail.requests.length,1);assert.equal(detail.next_cursor,'1');assert.equal(detail.final_output[0].text,'All tests passed.');
 await assert.rejects(store.explorer({session_id:f.foreignId}),/not found/);await assert.rejects(store.explorer({session_id:f.rootId,node_id:'session:'+f.foreignId}),/not found/);await assert.rejects(store.explorer({session_id:f.rootId,node_id:{}}),/Invalid/);await assert.rejects(store.explorer({session_id:f.rootId,limit:-1}),/Invalid/);await assert.rejects(store.runs({directory:'/'}),/Unknown/);
 const ui=await startTelemetryUI(f.options);t.after(()=>new Promise(r=>ui.server.close(r)));assert.equal((await fetch(ui.url+'api/runs')).status,200);const response=await fetch(ui.url+'api/explorer?args='+encodeURIComponent(JSON.stringify({session_id:f.rootId})));assert.equal(response.status,200);assert.equal((await response.json()).root_session_id,f.rootId);
});
test('partial scans never promote the last visible request to a final turn response',async t=>{
 const f=storeFixture(t),store=new TelemetryStore(f.options);fs.writeFileSync(path.join(f.options.directory,f.rootId,'logs.jsonl'),' '.repeat(2*1024*1024+1));
 const run=await store.explorer({session_id:f.rootId}),turn=run.nodes.find(n=>n.kind==='turn');const detail=await store.explorer({session_id:f.rootId,node_id:turn.id});assert.equal(detail.partial,true);assert.deepEqual(detail.final_output,[]);assert.ok(detail.warnings.length);
});

test('project facets cover the scoped scan and exact project filters apply before run pagination',async t=>{
 const f=storeFixture(t),store=new TelemetryStore({...f.options,scope:'machine'});
 const all=await store.runs({limit:1});
 assert.deepEqual(all.projects.map(p=>p.id).sort(),['/outside',f.options.projectDirectory].sort());
 const filtered=await store.runs({project_id:f.options.projectDirectory,limit:1});
 assert.equal(filtered.items.length,1);assert.equal(filtered.items[0].id,f.rootId);
 assert.equal(filtered.projects.length,2);
 assert.equal((await store.runs({project_id:f.options.projectDirectory+'-other'})).total_matching,0);
 const scoped=await new TelemetryStore(f.options).runs({});assert.equal(scoped.projects.length,1);
});
