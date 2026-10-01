// Dependency-free so generated launchers remain runnable without node_modules.
// The storage boundary accepts OTLP/HTTP JSON requests, ready for a future exporter.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {nativeCommand,type LaunchMetadata,type Manifest} from './runtime.js';
import {telemetryProject} from './telemetry-query.js';
import {exportTelemetry} from './telemetry-export.js';

interface Descriptor {directory:string;bundle:string;route:string;harness:'claude'|'codex';launch:LaunchMetadata;captureContent?:boolean}
type Attribute = {key:string;value:Record<string,unknown>};
const attributes=(values:Record<string,unknown>):Attribute[]=>Object.entries(values).filter(([,v])=>v!==undefined).map(([key,value])=>({key,value:typeof value==='boolean'?{boolValue:value}:typeof value==='number'?{intValue:String(value)}:Array.isArray(value)?{arrayValue:{values:value.map(v=>({stringValue:String(v)}))}}:{stringValue:String(value)}}));
const sensitive=/(token|secret|password|credential|authorization|api[-_]?key|cookie)/i;
const content=/(prompt|message|instructions|input|body)/i;
const hidden='[REDACTED]';

/** Preserve useful flags and paths, never generated instructions or free text prompts. */
export function redactArgs(argv:string[]):string[] {
  const result:string[]=[];
  const visible=new Set(['--model','--effort','--cd','--plugin-dir','--mcp-config','--output-format','--resume','--max-turns','--max-budget-usd']);
  const switches=new Set(['exec','resume','--yolo','--json','--print','-p','--verbose','--skip-git-repo-check','--dangerously-skip-permissions','--strict-mcp-config']);
  for(let i=0;i<argv.length;i++) {
    const arg=argv[i]!;
    if(arg==='--') {result.push('--',...argv.slice(i+1).map(()=>hidden));break;}
    if(arg==='-c'||arg==='--config') {result.push(arg,hidden);i++;continue;}
    if(arg.startsWith('-')) {
      const equal=arg.indexOf('=');
      if(equal>=0) {const key=arg.slice(0,equal);result.push(key+'='+(visible.has(key)&&!sensitive.test(key)&&!content.test(key)?arg.slice(equal+1):hidden));continue;}
      result.push(arg);
      if(!switches.has(arg) && argv[i+1]!==undefined && !argv[i+1]!.startsWith('-')) result.push(visible.has(arg)?argv[++i]!: (i++,hidden));
    } else result.push(switches.has(arg)?arg:hidden);
  }
  return result;
}

function gitMetadata(cwd:string):Record<string,string|undefined> {
  const git=(...args:string[])=>{try{return execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:1500}).trim()||undefined;}catch{return undefined;}};
  // Git prints forward slashes on Windows; resolve them to the same native paths as workspace identity.
  const native=(value:string|undefined)=>value&&fs.realpathSync.native(path.resolve(value));
  return {'agent_farm.project.directory':native(git('rev-parse','--path-format=absolute','--git-common-dir')),'vcs.worktree':native(git('rev-parse','--show-toplevel')),'vcs.ref.head.name':git('symbolic-ref','--quiet','--short','HEAD'),'vcs.ref.head.revision':git('rev-parse','--verify','HEAD')};
}

function parentContext(value:string|undefined) {
  const match=/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(value??'');
  return match && !/^0+$/.test(match[1]!) && !/^0+$/.test(match[2]!) ? {traceId:match[1]!.toLowerCase(),spanId:match[2]!.toLowerCase()}:undefined;
}

export async function startSession(descriptor:Descriptor,argv:string[],env:NodeJS.ProcessEnv) {
  const manifest:Manifest=JSON.parse(fs.readFileSync(path.join(descriptor.bundle,'manifest.json'),'utf8'));
  const agent=manifest.nodes[descriptor.route]!;
  const id=randomUUID(),parent=parentContext(env.TRACEPARENT ?? env.AGENT_FARM_TRACEPARENT);
  const traceId=parent?.traceId??randomBytes(16).toString('hex'),spanId=randomBytes(8).toString('hex');
  const startTimeUnixNano=(BigInt(Date.now())*1_000_000n).toString(),started=process.hrtime.bigint();
  const directory=path.join(descriptor.directory,id);
  fs.mkdirSync(descriptor.directory,{recursive:true,mode:0o700});
  fs.mkdirSync(directory,{mode:0o700});
  const user=os.userInfo();
  const metadata={
    'agent_farm.session.id':id,'agent_farm.parent.session.id':env.AGENT_FARM_SESSION_ID,
    'agent_farm.capture_content':descriptor.captureContent===true,
    'agent_farm.session.trace_id':traceId,'agent_farm.session.span_id':spanId,
    'agent_farm.profile':manifest.profile,'agent_farm.profile.variant':manifest.variant,'agent_farm.plugin':agent.plugin??manifest.plugin,
    'agent_farm.plugin.version':agent.plugin_version??manifest.plugin_version,'agent_farm.trace_identity':manifest.trace_identity,
    'agent_farm.route':descriptor.route,'agent_farm.workspace':manifest.workspace_source?.source,
    'agent_farm.workspace.trust':manifest.workspace_source?.trust,'agent_farm.workspace.overlay':manifest.workspace_source?.overlay,
    'agent_farm.harness':descriptor.harness,'agent_farm.agent':agent.name,
    'agent_farm.bundle':descriptor.bundle,'agent_farm.headless':descriptor.launch.headless,
    'gen_ai.request.model':descriptor.launch.model.name,'agent_farm.model.reasoning':descriptor.launch.model.reasoning,
    'agent_farm.model.speed':descriptor.launch.model.speed,'agent_farm.preset':descriptor.launch.preset,
    'process.owner':user.username,'user.id':String(user.uid),'host.name':os.hostname(),
    'agent_farm.launcher.pid':process.pid,'process.working_directory':manifest.directory,
    'process.command_args':[descriptor.harness,...redactArgs(argv.slice(argv.indexOf(descriptor.harness)+1))],
    ...Object.fromEntries(Object.entries(descriptor.launch.arguments).map(([k,v])=>['agent_farm.argument.'+k,sensitive.test(k)||content.test(k)?hidden:v])),
    ...gitMetadata(manifest.directory),
    'agent_farm.project.directory':telemetryProject(manifest.directory).id
  };
  const resourceAttributes=attributes(metadata);
  // Each line is an unwrapped OTLP Export*ServiceRequest, not a custom envelope.
  const write=(signal:string,payload:unknown)=>fs.appendFileSync(path.join(directory,signal+'.jsonl'),JSON.stringify(payload)+'\n',{mode:0o600});
  const summary={id,traceId,spanId,parentSpanId:parent?.spanId,startTimeUnixNano,attributes:metadata};
  const save=(extra:Record<string,unknown>)=>{
    const temporary=path.join(directory,'session.json.tmp');
    fs.writeFileSync(temporary,JSON.stringify({...summary,...extra},null,2)+'\n',{mode:0o600});
    fs.renameSync(temporary,path.join(directory,'session.json'));
  };
  save({state:'running'});
  const token=randomBytes(24).toString('hex');
  const signals={traces:'resourceSpans',logs:'resourceLogs',metrics:'resourceMetrics'} as const;
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    const signal=(Object.keys(signals) as Array<keyof typeof signals>).find(s=>req.url===`/${token}/v1/${s}`);
    if(req.method!=='POST'||!signal) {res.writeHead(404).end('{}');req.resume();return;}
    if(!req.headers['content-type']?.startsWith('application/json') || (req.headers['content-encoding'] && req.headers['content-encoding']!=='identity')) {res.writeHead(415).end('{}');req.resume();return;}
    let size=0;const chunks:Buffer[]=[];
    try {
      for await(const chunk of req) {
        size+=chunk.length;
        if(size>8*1024*1024) {res.writeHead(413).end('{}');req.resume();return;}
        chunks.push(chunk);
      }
      const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const resources=payload?.[signals[signal]];
      if(!Array.isArray(resources)) {res.writeHead(400).end('{}');return;}
      for(const item of resources) {
        if(!item || typeof item!=='object' || Array.isArray(item) || (item.resource!==undefined && (!item.resource || typeof item.resource!=='object' || Array.isArray(item.resource)))) throw new Error('Invalid resource');
        item.resource??={};
        const existing=item.resource.attributes??[];
        if(!Array.isArray(existing)) throw new Error('Invalid attributes');
        // Session correlation works even for harnesses that start independent traces.
        const owned=new Set(resourceAttributes.map(a=>a.key));
        item.resource.attributes=[...existing.filter(a=>a && !owned.has(a.key)),...resourceAttributes];
      }
      try {write(signal,payload);} catch {res.writeHead(503).end('{}');return;}
      res.end('{}');
    } catch {if(!res.headersSent)res.writeHead(400).end('{}');}
  });
  server.requestTimeout=5000;server.headersTimeout=5000;
  try {
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
  } catch(error) {server.close();throw error;}
  const address=server.address();if(!address||typeof address==='string')throw new Error('Missing telemetry listener');
  const endpoint=`http://127.0.0.1:${address.port}/${token}`;
  const traceparent=`00-${traceId}-${spanId}-01`;
  let finished=false;
  return {directory,endpoint,traceparent,id,
    async finish(code:number|null,signal:NodeJS.Signals|null,error?:string) {
      if(finished)return;finished=true;
      // Bound shutdown even if a client leaves a partial export in flight.
      await new Promise<void>(resolve=>{
        const timer=setTimeout(()=>server.closeAllConnections(),1000);timer.unref();
        server.close(()=>{clearTimeout(timer);resolve();});
      });
      const endTimeUnixNano=(BigInt(startTimeUnixNano)+process.hrtime.bigint()-started).toString();
      const outcome={'process.exit.code':code??undefined,'process.exit.signal':signal??undefined,'error.type':error};
      write('traces',{resourceSpans:[{resource:{attributes:attributes({'service.name':'agent-farm',...metadata})},scopeSpans:[{scope:{name:'agent-farm'},spans:[{
        traceId,spanId,...(parent?{parentSpanId:parent.spanId}:{}),name:'agent_farm.session',kind:1,startTimeUnixNano,endTimeUnixNano,
        attributes:attributes(outcome),status:{code:code===0&&!signal&&!error?1:2}
      }]}]}]});
      save({state:'finished',endTimeUnixNano,exitCode:code,signal,error});
    }
  };
}

export function harnessTelemetry(harness:Descriptor['harness'],argv:string[],environment:NodeJS.ProcessEnv,session:Awaited<ReturnType<typeof startSession>>,captureContent=false) {
  const env:NodeJS.ProcessEnv={...environment,TRACEPARENT:session.traceparent,AGENT_FARM_TRACEPARENT:session.traceparent,AGENT_FARM_SESSION_ID:session.id};
  // No inherited remote destinations, headers, TLS options, or compression.
  for(const key of Object.keys(env))if(key.startsWith('OTEL_EXPORTER_OTLP_'))delete env[key];
  if(harness==='claude') {
    Object.assign(env,{CLAUDE_CODE_ENABLE_TELEMETRY:'1',CLAUDE_CODE_ENHANCED_TELEMETRY_BETA:'1',OTEL_EXPORTER_OTLP_ENDPOINT:session.endpoint,OTEL_EXPORTER_OTLP_PROTOCOL:'http/json',OTEL_TRACES_EXPORTER:'otlp',OTEL_LOGS_EXPORTER:'otlp',OTEL_METRICS_EXPORTER:'otlp',OTEL_LOG_USER_PROMPTS:'0',OTEL_LOG_TOOL_DETAILS:'0',OTEL_LOG_TOOL_CONTENT:'0',OTEL_LOG_RAW_API_BODIES:'0'});
    for(const key of ['OTEL_LOG_USER_PROMPTS','OTEL_LOG_ASSISTANT_RESPONSES','OTEL_LOG_TOOL_DETAILS','OTEL_LOG_TOOL_CONTENT','OTEL_LOG_RAW_API_BODIES'])env[key]=captureContent?'1':'0';
    if(captureContent)env.CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH='262144';
    delete env.BETA_TRACING_ENDPOINT;
  } else {
    const config=['-c',`otel.log_user_prompt=${captureContent}`];
    for(const [key,signal] of [['exporter','logs'],['trace_exporter','traces'],['metrics_exporter','metrics']])config.push('-c',`otel.${key}={ otlp-http = { endpoint = ${JSON.stringify(session.endpoint+'/v1/'+signal)}, protocol = "json" } }`);
    // Insert before the prompt terminator, after caller options (CLI precedence).
    const separator=argv.indexOf('--');const index=separator<0?argv.length:separator;
    argv=[...argv.slice(0,index),...config,...argv.slice(index)];
  }
  return {argv,env};
}

async function supervise(descriptor:Descriptor,argv:string[]) {
  let session:Awaited<ReturnType<typeof startSession>>|undefined;
  let env=process.env;
  try {session=await startSession(descriptor,argv,env);({argv,env}=harnessTelemetry(descriptor.harness,argv,env,session,descriptor.captureContent===true));env.AGENT_FARM_TELEMETRY_STORE=descriptor.directory;}
  catch {console.error('agent-farm: local telemetry unavailable; continuing session');}
  const artifactSession=process.env.AGENT_FARM_ARTIFACT_SESSION_ID??session?.id;
  if(session&&process.env.AGENT_FARM_ARTIFACT_BUNDLE&&artifactSession)env.AGENT_FARM_ARTIFACT_SESSION_ID=artifactSession;
  const [file,...args]=nativeCommand(argv,env);
  const child=spawn(file!,args,{cwd:JSON.parse(fs.readFileSync(path.join(descriptor.bundle,'manifest.json'),'utf8')).directory,env,stdio:'inherit'});
  const handlers=new Map<NodeJS.Signals,()=>void>();
  // Windows sends Ctrl+C to the whole console and kill() terminates outright, so there the supervisor only stays alive.
  if(process.platform==='win32')process.on('SIGINT',()=>{});
  else for(const signal of ['SIGINT','SIGTERM','SIGHUP','SIGQUIT'] as NodeJS.Signals[]) {
    const handler=()=>{child.kill(signal);};handlers.set(signal,handler);process.on(signal,handler);
  }
  let failure:string|undefined;
  child.once('error',error=>{failure=(error as NodeJS.ErrnoException).code??'spawn_error';console.error(`agent-farm: harness launch failed (${failure})`);});
  child.once('close',async(code,signal)=>{
    try {await session?.finish(code,signal,failure);}catch {console.error('agent-farm: could not finish local telemetry');}
    if(session&&process.env.AGENT_FARM_ARTIFACT_BUNDLE){
      try{const result=exportTelemetry({directory:descriptor.directory,projectDirectory:JSON.parse(fs.readFileSync(path.join(descriptor.bundle,'manifest.json'),'utf8')).directory,scope:'project'},{bundle:process.env.AGENT_FARM_ARTIFACT_BUNDLE,sessionIds:[artifactSession??session.id],includeContent:process.env.AGENT_FARM_EXPORT_CONTENT==='on'});console.error('agent-farm: artifact telemetry exported; '+(result.complete?'complete':'incomplete')+' snapshot, publication pending');}
      catch(error){console.error('agent-farm: artifact telemetry export failed: '+(error as Error).message);}
    }
    for(const [name,handler] of handlers)process.removeListener(name,handler);
    if(signal)process.kill(process.pid,signal);
    else process.exitCode=failure?1:code??1;
  });
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const descriptor:Descriptor=JSON.parse(process.argv[2]!);
  await supervise(descriptor,process.argv.slice(4));
}
