import os from 'node:os';
import path from 'node:path';
import {resolveWorkspace} from './workspaces.js';
import {claudeProbeDirectory,codexConnection,connectionName,findExecutable,loginHint,nativeCodexHome,nativeConnections,nativeSignIns,toml,type Connection,type SignInCheck,type SignInState} from './runtime.js';

type Harness='claude'|'codex';
interface LoginOptions {home?:string;env?:NodeJS.ProcessEnv;noWorkspace?:boolean}
function nativeConnection(root: string, directory: string, connection: string, options: LoginOptions): Connection {
  const value=resolveWorkspace(root,{directory,home:options.home,noWorkspace:options.noWorkspace}).connections[connection];
  if (!value) throw new Error(`Unknown workspace connection: ${connection}`);
  if (!('url' in value) || value.auth!=='native') throw new Error('Native OAuth login requires a remote MCP connection with auth: native; local servers use their own login');
  return value;
}
/** Hand authentication to the native client, using launch-identical server identity. */
export function loginCommand(root: string, directory: string, connection: string, harness: Harness, options: LoginOptions={}) {
  const value=nativeConnection(root,directory,connection,options);
  const env={...(options.env ?? process.env)},name=connectionName(connection);
  if (harness==='codex') {
    // A login launched from an Agent Farm session must target the original home.
    env.CODEX_HOME=nativeCodexHome(env,options.home);
    return {argv:['codex','-c',`mcp_servers.${name}=${toml(codexConnection(value))}`,'mcp','login',name],cwd:directory,env};
  }
  // Claude's login subcommand reads project configuration, not --mcp-config.
  return {argv:['claude','--settings','{"enableAllProjectMcpServers":true}','mcp','login',name],cwd:claudeProbeDirectory(connection,value,options.home),env};
}
/** The logins `mcp login` without --harness runs: one for each installed harness that does not report a stored sign-in. */
export function loginPlan(root: string, directory: string, connection: string, options: LoginOptions & {check?: SignInCheck}={}) {
  const value=nativeConnection(root,directory,connection,options),env=options.env ?? process.env,check=options.check ?? nativeSignIns;
  return (['claude','codex'] as const).filter(harness=>findExecutable(harness,env)).map(harness=>({harness,state:check(harness,{[connection]:value},env,options.home ?? os.homedir())[connection] ?? 'unknown'}))
    .map(({harness,state})=>({harness,state,...(state==='signed-in' ? {} : {login:loginCommand(root,directory,connection,harness,options)})}));
}
/** Every `auth: native` workspace connection that an installed harness holds no sign-in for, with the command that fixes it. */
export function signInGaps(root: string, directory: string, options: LoginOptions & {check?: SignInCheck}={}) {
  const workspace=resolveWorkspace(root,{directory,home:options.home}),env=options.env ?? process.env,check=options.check ?? nativeSignIns,home=options.home ?? os.homedir();
  const connections=Object.fromEntries(nativeConnections(workspace.connections));
  const harnesses=(['claude','codex'] as const).filter(harness=>findExecutable(harness,env));
  const results=harnesses.flatMap(harness=>Object.entries(check(harness,connections,env,home)).map(([connection,state])=>({connection,harness,state:state as SignInState})));
  const login=(connection: string)=>loginHint(connection,directory,path.resolve(root),home);
  return {source:workspace.metadata.source,connections:Object.keys(connections),harnesses,
    missing:results.filter(r=>r.state==='missing').map(r=>({...r,login:login(r.connection)})),
    unknown:results.filter(r=>r.state==='unknown')};
}
