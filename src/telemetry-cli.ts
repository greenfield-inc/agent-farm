import path from 'node:path';
import os from 'node:os';
import {parseArgs} from 'node:util';
import {spawn} from 'node:child_process';
import {resolveWorkspace} from './workspaces.js';
import {assertWorkspaceTrust,resolveTelemetry} from './runtime.js';
import {serveTelemetryMcp} from './telemetry-mcp.js';
import {startTelemetryUI} from './telemetry-ui.js';
import type {QueryOptions} from './telemetry-query.js';
import {exportTelemetry} from './telemetry-export.js';

export async function telemetryCommand(args:string[]){
  const ui=args[0]==='traces'||args[0]==='ui';
  const exporting=!ui&&args[1]==='export';
  if(!ui&&!exporting&&args[1]!=='mcp')throw new Error('Use agent-farm telemetry mcp|export');
  const {values,positionals}=parseArgs({args:args.slice(ui?1:2),options:{directory:{type:'string'},project:{type:'string'},scope:{type:'string',default:'project'},'config-root':{type:'string',default:path.join(os.homedir(),'.config/agent-farm')},'no-open':{type:'boolean'},port:{type:'string',default:'0'},bundle:{type:'string'},session:{type:'string' as const,multiple:true},launch:{type:'string' as const,multiple:true},'include-content':{type:'boolean'},'require-finished':{type:'boolean' as const}}});
  if(positionals.length)throw new Error('Unexpected arguments');
  if(!exporting&&(values.bundle!==undefined||values.session!==undefined||values.launch!==undefined||values['include-content']!==undefined||values['require-finished']!==undefined))throw Error('Export options require telemetry export');
  if(values.scope!=='project'&&values.scope!=='machine')throw new Error('scope must be project or machine');
  const projectDirectory=path.resolve(values.project??process.cwd()),root=path.resolve(values['config-root']!);
  const workspace=values.directory?undefined:resolveWorkspace(root,{directory:projectDirectory});
  if(workspace)assertWorkspaceTrust(workspace.metadata);
  const settings=resolveTelemetry(root,workspace?.telemetry);
  const options:QueryOptions={directory:path.resolve(values.directory??(exporting?process.env.AGENT_FARM_TELEMETRY_STORE:undefined)??settings.directory),projectDirectory,scope:values.scope,currentSession:process.env.AGENT_FARM_SESSION_ID||undefined};
  if(exporting){if(!values.bundle)throw Error('telemetry export requires --bundle DIR');if(values.scope!=='project')throw Error('Artifact exports must be project-scoped');const result=exportTelemetry(options,{bundle:path.resolve(values.bundle),sessionIds:values.session,launchIds:values.launch,includeContent:values['include-content'],requireFinished:values['require-finished']});if(result.note)console.error('agent-farm: '+result.note);console.log(JSON.stringify(result,null,2));return;}
  if(!ui){await serveTelemetryMcp(options);return;}
  const port=Number(values.port);if(!/^\d+$/.test(values.port!)||!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');
  const {url,server}=await startTelemetryUI(options,port,{configRoot:root,projectDirectory});console.log('Agent Farm UI: '+url+'\nPress Ctrl-C to stop.');
  process.once('SIGINT',()=>server.close());process.once('SIGTERM',()=>server.close());
  if(!values['no-open']){const child=spawn(process.platform==='darwin'?'open':process.platform==='win32'?'explorer.exe':'xdg-open',[url],{stdio:'ignore'});child.on('error',()=>console.error('Open the URL above in your browser.'));child.unref();}
}
