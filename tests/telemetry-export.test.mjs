import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {exportTelemetry} from '../dist/telemetry-export.js';

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
    for(const signal of ['traces','logs','metrics'])fs.writeFileSync(path.join(dir,signal+'.jsonl'),'{"signal":"'+signal+'"}\n');
    return {id,dir,metadata};
  }
  const options={directory,projectDirectory,scope:'project'};
  return {base,bundle,manifest,manifestFile,session,options,read:()=>JSON.parse(fs.readFileSync(manifestFile))};
}

test('export preserves raw signals and artifact identity, selecting only roots and descendants',t=>{
  const f=fixture(t),root=f.session(),child=f.session({'agent_farm.parent.session.id':root.id}),grandchild=f.session({'agent_farm.parent.session.id':child.id});
  const unrelated=f.session(),foreign=f.session({'agent_farm.project.directory':'/another-project','agent_farm.parent.session.id':root.id});
  const result=exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[root.id],requireFinished:true});
  assert.deepEqual(new Set(result.exported_session_ids),new Set([root.id,child.id,grandchild.id]));
  assert.equal(result.complete,true);assert.equal(result.publication,'pending');
  assert.deepEqual(f.read().published,f.manifest.published);assert.deepEqual(f.read().documents,['index.html']);
  for(const s of [root,child,grandchild])for(const name of ['traces.jsonl','logs.jsonl','metrics.jsonl']){
    const target=path.join(f.bundle,'evidence/telemetry',s.id,name);
    assert.deepEqual(fs.readFileSync(target),fs.readFileSync(path.join(s.dir,name)));
    if(process.platform!=='win32')assert.equal(fs.statSync(target).mode&0o777,0o600);
  }
  for(const s of [unrelated,foreign])assert.equal(fs.existsSync(path.join(f.bundle,'evidence/telemetry',s.id)),false);
  assert.throws(()=>exportTelemetry({...f.options,scope:'machine'},{bundle:f.bundle,sessionIds:[foreign.id]}),/scope/);
});

test('running snapshots refresh using recorded roots, and completion is enforced',t=>{
  const f=fixture(t),s=f.session({},'running');
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id],requireFinished:true}),/not finished/);
  assert.equal(f.read().telemetry,undefined);
  assert.equal(exportTelemetry({...f.options,currentSession:s.id},{bundle:f.bundle,sessionIds:['current']}).complete,false);
  fs.writeFileSync(path.join(s.dir,'session.json'),JSON.stringify({...s.metadata,state:'finished'}));
  fs.appendFileSync(path.join(s.dir,'traces.jsonl'),'{"final":true}\n');
  assert.equal(exportTelemetry(f.options,{bundle:f.bundle,requireFinished:true}).complete,true);
  assert.match(fs.readFileSync(path.join(f.bundle,'evidence/telemetry',s.id,'traces.jsonl'),'utf8'),/final/);
});

test('content export requires explicit consent, and rejects invalid roots and unsafe paths',t=>{
  const f=fixture(t),s=f.session({'agent_farm.capture_content':true});
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]}),/include-content/);
  assert.equal(fs.existsSync(path.join(f.bundle,'.agent-farm-export.lock')),false);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle}),/explicit session/);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:['../secret']}),/session ID/);
  exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id],includeContent:true});
  const target=path.join(f.bundle,'evidence/telemetry',s.id,'traces.jsonl');fs.unlinkSync(target);fs.symlinkSync(path.join(s.dir,'traces.jsonl'),target);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,includeContent:true}),/symlinks/);
});

test('source symlinks, locked bundles, and oversized signals fail without a successful snapshot',t=>{
  const f=fixture(t),s=f.session(),signal=path.join(s.dir,'logs.jsonl');
  fs.unlinkSync(signal);fs.symlinkSync(path.join(s.dir,'traces.jsonl'),signal);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]}));
  fs.unlinkSync(signal);fs.writeFileSync(signal,'');fs.truncateSync(signal,65*1024*1024);
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]}),/byte limits/);
  fs.writeFileSync(path.join(f.bundle,'.agent-farm-export.lock'),'');
  assert.throws(()=>exportTelemetry(f.options,{bundle:f.bundle,sessionIds:[s.id]}),/EEXIST/);
  assert.equal(f.read().telemetry,undefined);
});

test('CLI exports explicit sessions and rejects machine-wide exports',t=>{
  const f=fixture(t),s=f.session();
  const args=['dist/cli.js','telemetry','export','--bundle',f.bundle,'--session',s.id,'--project',f.options.projectDirectory,'--directory',f.options.directory];
  const r=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).complete,true);
  assert.notEqual(spawnSync(process.execPath,[...args,'--scope','machine'],{encoding:'utf8'}).status,0);
});
