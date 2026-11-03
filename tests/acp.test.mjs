import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {writeHarness} from './harness.mjs';

const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

/** A profile with everything an ACP client must carry over: model, effort, instructions with launch
 *  arguments, a skill, a native subagent, and MCP servers that reference secrets by name. */
function fixture(t,harness) {
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-acp-')));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'config'),target=path.join(base,'repo'),home=path.join(base,'home'),bin=path.join(base,'bin');
 for(const directory of [target,bin,path.join(root,'agents'),path.join(home,'.codex'),path.join(root,'skills/proof')])fs.mkdirSync(directory,{recursive:true});
 const reasoning=harness==='claude'?'high':'medium';
 fs.writeFileSync(path.join(root,'agents/worker.yaml'),[
  `harness: ${harness}`,`model: {name: ${harness==='claude'?'claude-opus-5-5':'gpt-6-astra'}, reasoning: ${reasoning}${harness==='codex'?', speed: fast':''}}`,
  'instructions: Profile instructions.','skills: [proof]',
  'args:','  review: {values: [none, final], default: final}','  parent: {type: path}',
  'connections:',
  '  linear: {type: mcp, url: "https://linear.example/mcp", auth: bearer_env, env_var: LINEAR_API_KEY}',
  '  local: {type: mcp, command: node, args: [server.js], env_vars: [LOCAL_TOKEN]}',
  'subagents:','  helper: {agent: helper, mode: native}'
 ].join('\n')+'\n');
 fs.writeFileSync(path.join(root,'agents/helper.yaml'),[`harness: ${harness}`,'model: helper-model','description: Helps.',
  'connections:',
  '  linear: {type: mcp, url: "https://linear.example/mcp", auth: bearer_env, env_var: LINEAR_API_KEY}',
  '  local: {type: mcp, command: node, args: [server.js], env_vars: [LOCAL_TOKEN]}'].join('\n')+'\n');
 fs.writeFileSync(path.join(root,'skills/proof/SKILL.md'),'Proof skill');
 fs.writeFileSync(path.join(home,'.codex/auth.json'),'AUTH-SECRET-FIXTURE');
 for(const name of ['codex','claude'])writeHarness(bin,name,'process.exit(0);\n');
 const env={...process.env,AGENT_FARM_TELEMETRY:'off',HOME:home,USERPROFILE:home,CODEX_HOME:path.join(home,'.codex'),AGENT_FARM_NATIVE_CODEX_HOME:path.join(home,'.codex'),PATH:bin+path.delimiter+process.env.PATH,LINEAR_API_KEY:'LINEAR-SECRET-FIXTURE',LOCAL_TOKEN:'LOCAL-SECRET-FIXTURE'};
 const invoke=(args,extra={})=>spawnSync(process.execPath,[cli,'run','worker','--config-root',root,'--directory',target,...args],{env:{...env,...extra},encoding:'utf8'});
 return {base,root,target,home,bin,env,invoke};
}
/** Windows resolves PATHEXT in its own case (claude.CMD). */
const samePath=(actual,expected)=>assert.equal(process.platform==='win32'?actual.toLowerCase():actual,process.platform==='win32'?expected.toLowerCase():expected);
const context='LAUNCH CONTEXT\nheadless: false\nreview: none\nparent: ../status.json';
const noSecrets=(text)=>{for(const secret of ['AUTH-SECRET-FIXTURE','LINEAR-SECRET-FIXTURE','LOCAL-SECRET-FIXTURE'])assert.equal(text.includes(secret),false,secret);};

test('print-acp gives a Claude profile to claude-agent-acp: model, effort, instructions with LAUNCH CONTEXT, plugin, subagents and MCP servers',t=>{
 const f=fixture(t,'claude'),result=f.invoke(['--print-acp','--arg','review=none','--arg','parent=../status.json']);
 assert.equal(result.status,0,result.stderr);noSecrets(result.stdout);
 const acp=JSON.parse(result.stdout);
 assert.equal(acp.harness,'claude');
 assert.deepEqual(acp.adapter,{package:'@agentclientprotocol/claude-agent-acp',version:'0.100.0'});
 assert.deepEqual(acp.argv,['claude-agent-acp']);
 assert.equal(acp.cwd,f.target);
 samePath(acp.env.CLAUDE_CODE_EXECUTABLE,path.join(f.bin,process.platform==='win32'?'claude.cmd':'claude'));
 assert.equal(acp.launch.headless,false);assert.deepEqual(acp.launch.arguments,{review:'none',parent:'../status.json'});
 assert.equal(acp.model,'claude-opus-5-5');assert.equal(acp.effort,'high');assert.equal(acp.mode,'bypassPermissions');
 const session=acp.session,main=path.join(acp.bundle,'main');
 assert.equal(session.cwd,f.target);assert.deepEqual(session.mcpServers,[]);
 assert.ok(session._meta.systemPrompt.append.startsWith('Profile instructions.'));
 assert.ok(session._meta.systemPrompt.append.endsWith(context));
 const options=session._meta.claudeCode.options;
 assert.equal(options.model,'claude-opus-5-5');assert.equal(options.effort,'high');
 assert.deepEqual(options.plugins,[{type:'local',path:main}]);
 assert.ok(fs.existsSync(path.join(main,'skills/proof/SKILL.md')));
 assert.deepEqual(Object.keys(options.agents),['helper']);
 assert.equal(options.agents.helper.description,'Helps.');assert.equal(options.agents.helper.model,'helper-model');
 assert.equal(options.strictMcpConfig,true);
 assert.deepEqual(options.mcpServers,{
  orchestra_linear:{type:'http',url:'https://linear.example/mcp',headers:{Authorization:'Bearer ${LINEAR_API_KEY}'}},
  orchestra_local:{type:'stdio',command:'node',args:['server.js'],env:{LOCAL_TOKEN:'${LOCAL_TOKEN}'}}
 });
 assert.equal(acp.env.ANTHROPIC_MODEL,'claude-opus-5-5');
 assert.equal(options.settings,undefined,'the adapter takes the initial mode from session/set_mode, not settings');
});

test('print-acp gives a Codex profile to codex-acp: CODEX_CONFIG with instructions, effort, tier, subagents and MCP servers, and a prepared CODEX_HOME',t=>{
 const f=fixture(t,'codex'),result=f.invoke(['--print-acp','--arg','review=none','--arg','parent=../status.json']);
 assert.equal(result.status,0,result.stderr);noSecrets(result.stdout);
 const acp=JSON.parse(result.stdout),main=path.join(acp.bundle,'main');
 assert.equal(acp.harness,'codex');
 assert.deepEqual(acp.adapter,{package:'@agentclientprotocol/codex-acp',version:'2.5.0'});
 assert.deepEqual(acp.argv,['codex-acp']);
 assert.equal(acp.model,'gpt-6-astra');assert.equal(acp.effort,'medium');assert.equal(acp.mode,'agent-full-access');
 assert.deepEqual(acp.session,{cwd:f.target,mcpServers:[]});
 samePath(acp.env.CODEX_PATH,path.join(f.bin,process.platform==='win32'?'codex.cmd':'codex'));
 assert.equal(acp.env.INITIAL_AGENT_MODE,'agent-full-access');
 assert.equal(fs.readFileSync(path.join(acp.env.CODEX_HOME,'skills/proof/SKILL.md'),'utf8'),'Proof skill');
 assert.equal(acp.env.AGENT_FARM_NATIVE_CODEX_HOME,path.join(f.home,'.codex'));
 const config=JSON.parse(acp.env.CODEX_CONFIG);
 assert.equal(config.model,'gpt-6-astra');assert.equal(config.model_reasoning_effort,'medium');assert.equal(config.service_tier,'fast');
 assert.ok(config.developer_instructions.startsWith('Profile instructions.'));assert.ok(config.developer_instructions.endsWith(context));
 assert.deepEqual(config.agents,{helper:{description:'Helps.',config_file:path.join(main,'native-agents/helper.toml')}});
 assert.ok(fs.existsSync(config.agents.helper.config_file));
 assert.deepEqual(config.mcp_servers,{
  orchestra_linear:{url:'https://linear.example/mcp',bearer_token_env_var:'LINEAR_API_KEY'},
  orchestra_local:{command:'node',args:['server.js'],env:{},env_vars:['LOCAL_TOKEN']}
 });
});

test('print-acp refuses a missing harness rather than letting the adapter use its bundled copy, and rejects terminal-only options',t=>{
 const f=fixture(t,'claude');
 fs.rmSync(path.join(f.bin,process.platform==='win32'?'claude.cmd':'claude'));
 const missing=f.invoke(['--print-acp'],{PATH:f.bin});assert.equal(missing.status,1);assert.match(missing.stderr,/Missing native harness: claude/);
 for(const [args,pattern] of [
  [['--print-acp','--print-launch'],/Choose only one/],[['--print-acp','--exec'],/Choose only one/],
  [['--print-acp','--message','hi'],/does not accept --message/],[['--print-acp','--resume','abc'],/does not accept --message, --resume/],
  [['--print-acp','--','--verbose'],/native arguments/],[['--acp-adapter','x.js','--explain'],/--acp-adapter requires --print-acp/],
  [['--acp-adapter','x.js'],/^error: --acp-adapter requires --print-acp\n$/],
  [['--print-acp','--acp-adapter',''],/needs the path of an adapter file/],[['--print-acp','--acp-adapter',os.tmpdir()],/not found, or not a file/]
 ]){const r=f.invoke(args,{PATH:f.bin});assert.equal(r.status,1,args.join(' '));assert.match(r.stderr,pattern,args.join(' '));}
});

/** Exports one span to the collector the way each harness is configured: Claude from OTEL env, Codex from -c otel args. */
const exporter=`
const fs=require('node:fs');
module.exports=async(record,args)=>{
 let endpoint=process.env.OTEL_EXPORTER_OTLP_ENDPOINT&&process.env.OTEL_EXPORTER_OTLP_ENDPOINT+'/v1/traces';
 const codex=args.findLast(a=>a.startsWith('otel.trace_exporter='));
 if(codex)endpoint=JSON.parse(codex.match(/endpoint = ("[^"]*")/)[1]);
 if(endpoint){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({resourceSpans:[{resource:{attributes:[]},scopeSpans:[{scope:{name:'fake'},spans:[{traceId:'a'.repeat(32),spanId:'b'.repeat(16),name:'harness.turn',kind:1,startTimeUnixNano:'1',endTimeUnixNano:'2'}]}]}]})});if(!r.ok)throw new Error('export '+r.status);}
 fs.writeFileSync(record,JSON.stringify({args,endpoint,session:process.env.AGENT_FARM_SESSION_ID,mode:process.env.INITIAL_AGENT_MODE,shim:process.env.AGENT_FARM_CODEX_PATH??null}));
};`;

for(const harness of ['claude','codex'])test(`a client spawning the printed ${harness} command gets the telemetry wrapper, and the harness under the adapter reports to it`,t=>{
 const f=fixture(t,harness),telemetry=path.join(f.base,'telemetry'),record=path.join(f.base,'record.json');
 fs.writeFileSync(path.join(f.base,'exporter.cjs'),exporter);
 // The fake harness exports a span; the fake adapter starts it as the real adapters do (Claude from env, Codex as CODEX_PATH app-server).
 writeHarness(f.bin,harness,`require(${JSON.stringify(path.join(f.base,'exporter.cjs'))})(${JSON.stringify(record)},process.argv.slice(2)).catch(e=>{console.error(e);process.exit(1);});\n`);
 const adapter=path.join(f.base,'adapter.mjs');
 fs.writeFileSync(adapter,`import {spawnSync} from 'node:child_process';
const harness=process.env.CODEX_PATH??process.env.CLAUDE_CODE_EXECUTABLE,args=process.env.CODEX_PATH?['app-server']:['--print'];
// codex-acp uses cross-spawn on Windows, which runs a node shebang script (codex-otel.mjs) with node.
const r=process.platform==='win32'&&/\\.m?js$/.test(harness)?spawnSync(process.execPath,[harness,...args],{stdio:'inherit'}):spawnSync(harness,args,{stdio:'inherit',shell:process.platform==='win32'});
process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:0,result:{}})+'\\n');process.exit(r.status??1);`);
 fs.writeFileSync(path.join(f.root,'settings.json'),JSON.stringify({telemetry:{directory:telemetry}}));
 const printed=f.invoke(['--print-acp','--acp-adapter',adapter],{AGENT_FARM_TELEMETRY:'on'});
 assert.equal(printed.status,0,printed.stderr);const acp=JSON.parse(printed.stdout);
 assert.equal(acp.argv[1],path.join(acp.bundle,'telemetry.mjs'));assert.deepEqual(acp.argv.slice(-3),['--',process.execPath,adapter]);
 const run=spawnSync(acp.argv[0],acp.argv.slice(1),{cwd:acp.cwd,env:{...f.env,...acp.env},encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.deepEqual(JSON.parse(run.stdout),{jsonrpc:'2.0',id:0,result:{}},'ACP stdout passes through the wrapper untouched');
 const seen=JSON.parse(fs.readFileSync(record,'utf8'));
 assert.ok(seen.endpoint?.startsWith('http://127.0.0.1:'),'the harness found the collector');
 const [id]=fs.readdirSync(telemetry);assert.equal(seen.session,id);
 const session=JSON.parse(fs.readFileSync(path.join(telemetry,id,'session.json'),'utf8'));
 assert.equal(session.state,'finished');assert.equal(session.exitCode,0);
 assert.equal(session.attributes['agent_farm.headless'],false);
 assert.deepEqual(session.attributes['process.command_args'],[harness==='claude'?'claude-agent-acp':'codex-acp']);
 const spans=fs.readFileSync(path.join(telemetry,id,'traces.jsonl'),'utf8');
 assert.match(spans,/harness\.turn/);assert.match(spans,/agent_farm\.session/);
 if(harness==='codex'){assert.equal(seen.args[0],'app-server');assert.equal(seen.mode,'agent-full-access');assert.equal(seen.shim,null);}
});
