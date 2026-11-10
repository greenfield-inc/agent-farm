import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {exportTelemetry} from '../dist/telemetry-export.js';
import {writeLink} from './harness.mjs';

/** One OTLP logs export line per event; Codex names its events in an event.name attribute. */
const event=(name,extra=[])=>({attributes:[{key:'event.name',value:{stringValue:name}},...extra]});
const logs=(names,extra)=>names.map(name=>JSON.stringify({resourceLogs:[{resource:{attributes:[]},scopeLogs:[{scope:{name:'test'},logRecords:[event(name,extra)]}]}]})+'\n').join('');
const kinds=file=>fs.readFileSync(file,'utf8').trim().split('\n').flatMap(l=>JSON.parse(l).resourceLogs.flatMap(r=>r.scopeLogs.flatMap(s=>s.logRecords.map(x=>x.attributes.find(a=>a.key==='event.name')?.value.stringValue??x.eventName))));
function fixture(t){
  const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'farm-export-')));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const directory=path.join(base,'store'),projectDirectory=path.join(base,'project'),bundle=path.join(base,'bundle');
  for(const dir of [directory,projectDirectory,bundle])fs.mkdirSync(dir);
  const manifest={slug:'test',documents:['index.html'],published:{kind:'grain',id:'existing-artifact',url:'private'}};
  const manifestFile=path.join(bundle,'bundle.json');fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  function session(attributes={},state='finished'){
    const id=randomUUID(),dir=path.join(directory,id);fs.mkdirSync(dir);
    const metadata={id,state,startTimeUnixNano:'1700000000000000000',attributes:{'agent_farm.project.directory':projectDirectory,'agent_farm.capture_content':false,...attributes}};
    fs.writeFileSync(path.join(dir,'session.json'),JSON.stringify(metadata));
    fs.writeFileSync(path.join(dir,'traces.jsonl'),'{"resourceSpans":[]}\n');
    fs.writeFileSync(path.join(dir,'logs.jsonl'),logs(['user_prompt','api_request','hook_execution_start','tool_result']));
    fs.writeFileSync(path.join(dir,'metrics.jsonl'),'{"resourceMetrics":[]}\n');
    return {id,dir,metadata};
  }
  const options={directory,projectDirectory,scope:'project'};
  return {base,bundle,manifest,manifestFile,session,options,read:()=>JSON.parse(fs.readFileSync(manifestFile))};
}

test('export keeps what happened and artifact identity, selecting only roots and descendants',t=>{
  const f=fixture(t),root=f.session(),child=f.session({'agent_farm.parent.session.id':root.id}),grandchild=f.session({'agent_farm.parent.session.id':child.id});
  const unrelated=f.session(),foreign=f.session({'agent_farm.project.directory':'/another-project','agent_farm.parent.session.id':root.id});
  const result=exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[root.id],requireFinished:true});
  assert.deepEqual(new Set(result.exported_session_ids),new Set([root.id,child.id,grandchild.id]));
  assert.equal(result.complete,true);assert.equal(result.publication,'pending');
  assert.deepEqual(f.read().published,f.manifest.published);assert.deepEqual(f.read().documents,['index.html']);
  for(const s of [root,child,grandchild]){
    const dir=path.join(f.bundle,'evidence/telemetry',s.id);
    assert.deepEqual(fs.readFileSync(path.join(dir,'metrics.jsonl')),fs.readFileSync(path.join(s.dir,'metrics.jsonl')));
    assert.deepEqual(kinds(path.join(dir,'logs.jsonl')),['user_prompt','api_request','tool_result']);
    assert.equal(fs.existsSync(path.join(dir,'traces.jsonl')),false);
    if(process.platform!=='win32')assert.equal(fs.statSync(path.join(dir,'logs.jsonl')).mode&0o777,0o600);
  }
  assert.deepEqual(result.events,{kept:{api_request:3,tool_result:3,user_prompt:3},left_out:{hook_execution_start:3}});
  assert.equal(result.contents,'events');assert.ok(result.traces_left_out_bytes>0);
  for(const s of [unrelated,foreign])assert.equal(fs.existsSync(path.join(f.bundle,'evidence/telemetry',s.id)),false);
  assert.throws(()=>exportTelemetry({...f.options,scope:'machine'},{bundle:f.bundle,sessionIds:[foreign.id]}),/scope/);
});

test('running snapshots refresh using recorded roots, and completion is enforced',t=>{
  const f=fixture(t),s=f.session({},'running');
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id],requireFinished:true}),/not finished/);
  assert.equal(f.read().telemetry,undefined);
  assert.equal(exportTelemetry({...f.options,currentSession:s.id},{bundle:f.bundle,sessionIds:['current']}).complete,false);
  fs.writeFileSync(path.join(s.dir,'session.json'),JSON.stringify({...s.metadata,state:'finished'}));
  fs.appendFileSync(path.join(s.dir,'logs.jsonl'),logs(['subagent_completed']));
  assert.equal(exportTelemetry(f.options,{bundle:f.bundle,requireFinished:true}).complete,true);
  assert.ok(kinds(path.join(f.bundle,'evidence/telemetry',s.id,'logs.jsonl')).includes('subagent_completed'));
});

test('content export requires explicit consent, and rejects invalid roots and unsafe paths',t=>{
  const f=fixture(t),s=f.session({'agent_farm.capture_content':true});
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]}),/include-content/);
  assert.equal(fs.existsSync(path.join(f.bundle,'.agent-farm-export.lock')),false);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle}),/explicit session/);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:['../secret']}),/session ID/);
  exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id],includeContent:true});
  const target=path.join(f.bundle,'evidence/telemetry',s.id,'logs.jsonl');fs.unlinkSync(target);writeLink(s.dir,target);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,includeContent:true}),/symlinks/);
});

test('source symlinks, locked bundles, and oversized signals fail without a successful snapshot',t=>{
  const f=fixture(t),s=f.session(),signal=path.join(s.dir,'logs.jsonl');
  fs.unlinkSync(signal);writeLink(s.dir,signal);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]}));
  // Grain takes at most 50 MiB per file, so an exported file stops at 48 MiB.
  fs.unlinkSync(signal);fs.writeFileSync(signal,logs(['api_request']));
  fs.writeFileSync(path.join(s.dir,'metrics.jsonl'),Buffer.alloc(49*1024*1024,'{"resourceMetrics":[]}\n'));
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]}),/byte limits/);
  fs.writeFileSync(path.join(f.bundle,'.agent-farm-export.lock'),'');
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]}),/EEXIST/);
  assert.equal(f.read().telemetry,undefined);
});

test('CLI exports explicit sessions and rejects machine-wide exports',t=>{
  const f=fixture(t),s=f.session();
  const args=['dist/cli.js','telemetry','export','--bundle',f.bundle,'--session',s.id,'--project',f.options.projectDirectory,'--directory',f.options.directory];
  const r=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).complete,true);
  const launched=f.session({'agent_farm.launch.id':'cli-launch'});
  const byLaunch=spawnSync(process.execPath,['dist/cli.js','telemetry','export','--bundle',f.bundle,'--launch','cli-launch','--require-finished','--project',f.options.projectDirectory,'--directory',f.options.directory],{encoding:'utf8'});
  assert.equal(byLaunch.status,0,byLaunch.stderr);assert.ok(JSON.parse(byLaunch.stdout).exported_session_ids.includes(launched.id));
  assert.notEqual(spawnSync(process.execPath,[...args,'--scope','machine'],{encoding:'utf8'}).status,0);
});

test('one rule for every harness: Claude and Codex keep the same kinds of event, unknown kinds are left out, long fields are cut',t=>{
  const f=fixture(t),claude=f.session({'agent_farm.harness':'claude'}),codex=f.session({'agent_farm.harness':'codex'});
  const happened={claude:['user_prompt','api_request','assistant_response','tool_decision','tool_result','subagent_completed','api_error'],
    codex:['codex.user_prompt','codex.websocket_request','codex.sse_event','codex.tool_decision','codex.tool_result','codex.agent_communication','codex.conversation_starts']};
  const noise={claude:['hook_execution_start','hook_execution_complete','plugin_loaded','a_kind_from_a_future_release'],codex:['codex.startup_phase','codex.turn_ttft','codex.websocket_connect']};
  fs.writeFileSync(path.join(claude.dir,'logs.jsonl'),logs([...happened.claude,...noise.claude],[{key:'output',value:{stringValue:'x'.repeat(10000)}}]));
  // Codex also writes plain log lines, such as credential lookups, with no event.name.
  fs.writeFileSync(path.join(codex.dir,'logs.jsonl'),logs([...happened.codex,...noise.codex])+JSON.stringify({resourceLogs:[{scopeLogs:[{scope:{name:'codex_otel::auth_storage'},logRecords:[{eventName:'event auth.rs:12',body:{stringValue:'lookup'}}]}]}]})+'\n');
  const result=exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[claude.id,codex.id]});
  for(const [s,harness] of [[claude,'claude'],[codex,'codex']]){
    const dir=path.join(f.bundle,'evidence/telemetry',s.id);
    assert.deepEqual(kinds(path.join(dir,'logs.jsonl')),happened[harness]);
    assert.deepEqual(fs.readdirSync(dir).sort(),['logs.jsonl','metrics.jsonl','session.json']);
  }
  for(const kind of [...happened.claude,...happened.codex])assert.equal(result.events.kept[kind],1,kind);
  assert.deepEqual(Object.keys(result.events.left_out).sort(),[...noise.claude,...noise.codex,'log:codex_otel::auth_storage'].sort());
  const cut=fs.readFileSync(path.join(f.bundle,'evidence/telemetry',claude.id,'logs.jsonl'),'utf8');
  assert.match(cut,/x{4096}… \[5904 more characters left out\]/);assert.equal(result.shortened_fields,happened.claude.length);
});

test('--launch exports every session of a launch, refuses one still running, and a worker cannot finish its own export',t=>{
  const f=fixture(t),launch='3f0c2a1e-0000-4000-8000-000000000001';
  const first=f.session({'agent_farm.launch.id':launch}),resumed=f.session({'agent_farm.launch.id':launch}),child=f.session({'agent_farm.parent.session.id':resumed.id}),other=f.session({'agent_farm.launch.id':'another-launch'});
  const result=exportTelemetry(f.options,{bundle:f.bundle,launchIds:[launch],requireFinished:true});
  assert.equal(result.complete,true);assert.deepEqual(result.launch_ids,[launch]);
  assert.deepEqual(new Set(result.exported_session_ids),new Set([first.id,resumed.id,child.id]));
  assert.equal(fs.existsSync(path.join(f.bundle,'evidence/telemetry',other.id)),false);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,launchIds:['no-such-launch']}),/No recorded sessions for launch no-such-launch/);
  const running=f.session({'agent_farm.launch.id':'running-launch'},'running');
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,launchIds:['running-launch'],requireFinished:true}),/has not finished/);
  assert.throws(()=>exportTelemetry({...f.options,currentSession:running.id},{bundle:f.bundle,sessionIds:['current'],requireFinished:true}),/your orchestrator exports it after you exit/);
});

test('a hand-written telemetry key is replaced with the export record, keeping every other field',t=>{
  for(const written of ['evidence/telemetry/',{directory:'evidence/telemetry',sessions:['by hand']}]){
    const f=fixture(t),s=f.session();
    fs.writeFileSync(f.manifestFile,JSON.stringify({...f.manifest,telemetry:written}));
    const result=exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]});
    assert.match(result.note,/did not write; replaced it/);
    const manifest=f.read();assert.equal(manifest.telemetry.version,1);assert.deepEqual(manifest.telemetry.session_ids,[s.id]);
    assert.deepEqual(manifest.published,f.manifest.published);assert.deepEqual(manifest.documents,f.manifest.documents);
  }
});

test('re-exporting removes a traces file an earlier export left',t=>{
  const f=fixture(t),s=f.session(),dir=path.join(f.bundle,'evidence/telemetry',s.id);
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'traces.jsonl'),'old raw spans\n');
  exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]});
  assert.equal(fs.existsSync(path.join(dir,'traces.jsonl')),false);
});
