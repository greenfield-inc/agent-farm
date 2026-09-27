#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePlugin,packPlugin,installPlugin,listPlugins,uninstallPlugin} from './plugins.js';
import os from 'node:os';
import {parseArgs} from 'node:util';
import {resolveWorkspace,resolveInteractiveWorkspace,trustWorkspace,untrustWorkspace,showWorkspace} from './workspaces.js';
import {build,variantLabel,resolveProfile,splitVariant} from './compiler.js';
import {run,execute,nativeResume,readLaunchRecord} from './runtime.js';
import {loginCommand} from './mcp-auth.js';
import {loadWorkspace,unloadWorkspace,loadedWorkspaces} from './user-workspaces.js';
import {inspectProfile,listProfiles} from './inspect.js';
import {chooseVariant} from './interactive.js';
import {loadProfile,unloadProfile,loadedProfiles,globalSkills,globalSkillWarning,saveGlobalSkills} from './user-skills.js';
import {configurationName,loadHostSettings} from './config.js';

// Interactive mode: bare command, `init [--full]`, or `help [COMMAND]`
const rawArgs = process.argv.slice(2);
const isInit = rawArgs[0] === 'init';
const isInitFull = isInit && rawArgs.includes('--full');
const isHelp = rawArgs[0] === 'help';
if (rawArgs.length === 0 || (isInit && rawArgs.filter(a => a !== '--full').length === 1)) {
  const configRoot = path.join(os.homedir(), '.config/agent-farm');
  const {bareCommand, initCommand} = await import('./interactive.js');
  if (isInit) await initCommand(configRoot, process.cwd(), isInitFull);
  else await bareCommand(configRoot, process.cwd());
  process.exit(0);
}
const helpArgs=rawArgs.slice(0,rawArgs.indexOf('--')<0 ? rawArgs.length : rawArgs.indexOf('--'));
if (isHelp || helpArgs.includes('--help') || helpArgs.includes('-h')) {
  const {helpCommand} = await import('./interactive.js');
  helpCommand(isHelp ? rawArgs[1] : undefined);
  process.exit(0);
}
if (rawArgs[0] === 'doctor' && rawArgs.length === 1) {
  const {doctorCommand} = await import('./interactive.js');
  doctorCommand(path.join(os.homedir(), '.config/agent-farm'));
  process.exit(0);
}

/** The profile variant that launched a recorded session, unless the command names one. */
function resumedProfile(root:string,requested:string,id:string,workspace:Parameters<typeof resolveProfile>[2]):string {
  const record=readLaunchRecord(id);
  if (splitVariant(requested).variant!==undefined || !record?.variant) return requested;
  return resolveProfile(root,requested,workspace).profile===record.profile ? `${requested}:${record.variant}` : requested;
}

try {
  if(rawArgs[0]==='ui'||rawArgs[0]==='traces'||rawArgs[0]==='telemetry'){
    await (await import('./telemetry-cli.js')).telemetryCommand(rawArgs);
  }else{
  const {values,tokens}=parseArgs({args:rawArgs,allowPositionals:true,strict:true,tokens:true,options:{
    'config-root':{type:'string',default:path.join(os.homedir(),'.config/agent-farm')},
    save:{type:'string'},model:{type:'string'},reasoning:{type:'string'},speed:{type:'string'},arg:{type:'string',multiple:true},harness:{type:'string'},'no-workspace':{type:'boolean'},yes:{type:'boolean'},directory:{type:'string',default:process.cwd()},'base-url':{type:'string'},'api-key-env':{type:'string'},
    build:{type:'boolean'},exec:{type:'boolean'},message:{type:'string'},explain:{type:'boolean'},
    'print-launch':{type:'boolean'},'native-arg':{type:'string',multiple:true},resume:{type:'string'}
  }});
  const separator=tokens.find(t=>t.kind==='option-terminator')?.index ?? rawArgs.length;
  const positionals=tokens.flatMap(t=>t.kind==='positional' && t.index<separator ? [t.value] : []);
  const nativeArgs=[...(values['native-arg'] ?? []),...rawArgs.slice(separator+1)];
  const runCommand=['run','agent'].includes(positionals[0] ?? '');
  if ((values['print-launch'] || values['native-arg'] || values.resume!==undefined || separator<rawArgs.length) && !['run','agent'].includes(positionals[0] ?? '')) throw new Error('Prepared launches, --resume and native arguments require run or agent');
  const globalCommand=['set','unset','status'].includes(positionals[0] ?? '') && positionals[1]==='global';
  if(values.yes && !(positionals[0]==='workspace'&&positionals[1]==='trust'))throw new Error('--yes is only supported by workspace trust');
  if(values['no-workspace'] && !runCommand && positionals[0]!=='inspect' && !(positionals[0]==='mcp'&&positionals[1]==='login') && !(positionals[0]==='workspace'&&positionals[1]==='show'))throw new Error('--no-workspace is supported by run, inspect, mcp login, and workspace show');
  if (values.save!==undefined && !globalCommand) throw new Error('--save is only supported by unset global');
  if (values.model!==undefined && !globalCommand && !runCommand) throw new Error('--model is only supported by run and unset global');
  if ((values.reasoning!==undefined || values.speed!==undefined || values.arg!==undefined) && !runCommand) throw new Error('--reasoning, --speed, and --arg are only supported by run');
  if (globalCommand) {
    const operation=positionals[0],profile=positionals[2];
    if (values.message!==undefined || values.build || values.exec || values.explain) throw new Error('Global commands do not accept launch options');
    if (positionals.length>3) throw new Error('Use set global PROFILE, unset global PROFILE, or status global');
    if(values.harness && !['claude','codex'].includes(values.harness))throw new Error('harness must be claude or codex');
    if(operation==='status') {
      if(profile || values['no-workspace'] || values.save || values.model)throw new Error('Use status global [--harness claude|codex]');
      for(const harness of values.harness?[values.harness]:['claude','codex']) {
        const entries=globalSkills({harness});
        console.log(`${harness}: ${entries.length} global skill(s)`);
        for(const e of entries)console.log(`  ${e.name}: ${e.status}${e.profiles.length?' ('+e.profiles.join(', ')+')':''} — ${e.destination}`);
      }
      for(const w of loadedWorkspaces().filter(w=>!values.harness||w.harness===values.harness))console.log(`Workspace: ${w.workspace} (${w.harness})`);
    } else if(values.save!==undefined) {
      if(operation!=='unset'||profile||values['no-workspace'])throw new Error('Use unset global --save NAME --harness HARNESS --model MODEL');
      const saved=saveGlobalSkills(path.resolve(values['config-root']!),values.save,values.model ?? '',{harness:values.harness});
      console.log(`Saved and unmounted ${saved.skills} pre-existing skills as ${saved.profile}. Original files: ${saved.backup}. Remount: agent-farm set global ${saved.profile} --harness ${values.harness} --config-root ${JSON.stringify(path.resolve(values['config-root']!))}`);
    } else if(!profile) {
      if(values.model)throw new Error('Set/unset a global workspace separately from a profile');
      const item=operation==='set'?loadWorkspace(path.resolve(values['config-root']!),path.resolve(values.directory!),{harness:values.harness}):unloadWorkspace(path.resolve(values.directory!),{harness:values.harness});
      console.log(`${operation==='set'?'Mounted':'Unmounted'} workspace ${item.workspace} (${item.harness}). Start a fresh session.`);
    } else {
      if(!profile || values.model)throw new Error('Use set global PROFILE or unset global PROFILE; pre-existing skills require unset global --save NAME --harness HARNESS --model MODEL');
      if(operation==='set') {
        const item=loadProfile(path.resolve(values['config-root']!),profile,{harness:values.harness});
        console.log(`Mounted ${item.profile}: ${item.skills.length} skills for ${item.harness}. Skills only; start a fresh session.`);
      } else {
        const items=unloadProfile(profile,{harness:values.harness});
        console.log(`Unmounted ${items.map(p=>p.profile+' ('+p.harness+')').join(', ')}. Shared skills remain mounted. Start a fresh session.`);
      }
    }
  } else if (positionals[0]==='workspace') {
    const operation=positionals[1];
    if (!['load','unload','loaded','trust','untrust','show'].includes(operation ?? '') || positionals.length!==2) throw new Error('Use: agent-farm workspace load|unload|trust|untrust|show [--directory PATH], or workspace loaded');
    if (values.message!==undefined || values.build || values.exec || values.explain) throw new Error('Workspace commands do not accept launch options');
    const directory=path.resolve(values.directory!),root=path.resolve(values['config-root']!);
    if(operation==='trust') {
      console.log(await trustWorkspace(directory,{yes:values.yes})?'Workspace trusted.':'Workspace approval declined.');
    } else if(operation==='untrust') {
      untrustWorkspace(directory);console.log('Repository workspace approvals revoked.');
    } else if(operation==='show') {
      console.log(JSON.stringify(showWorkspace(root,{directory,noWorkspace:values['no-workspace']}),null,2));
    } else if (operation==='loaded') {
      if (values.harness) throw new Error('workspace loaded lists both harnesses; omit --harness');
      const entries=loadedWorkspaces();
      console.log(entries.length ? entries.map(e=>`${e.workspace} (${e.harness}): ${Object.keys(e.servers).join(', ')}`).join('\n') : 'No global workspaces loaded.');
    } else {
      const entry=operation==='load' ? loadWorkspace(root,directory,{harness:values.harness}) : unloadWorkspace(directory,{harness:values.harness});
      console.log(`${operation==='load'?'Loaded':'Unloaded'} workspace ${entry.workspace} (${entry.harness}). Start a fresh native session.`);
    }
  } else if (positionals[0]==='provider') {
    const operation=positionals[1];
    const root=path.resolve(values['config-root']!);
    const settingsPath=path.join(root,'settings.json');
    if (operation==='set') {
      if (!positionals[2]) throw new Error('Use: agent-farm provider set NAME --base-url URL --api-key-env VAR');
      const baseUrl=values['base-url'];
      const apiKeyEnv=values['api-key-env'];
      if (!baseUrl || !apiKeyEnv) throw new Error('Provide --base-url and --api-key-env');
      const settings={...loadHostSettings(root),provider:{name:positionals[2],base_url:baseUrl,api_key_env:apiKeyEnv}};
      fs.mkdirSync(root,{recursive:true});
      fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2)+'\n');
      console.log(`Provider saved to ${settingsPath}`);
      console.log(`  name: ${positionals[2]}`);
      console.log(`  base_url: ${baseUrl}`);
      console.log(`  api_key_env: ${apiKeyEnv}`);
      console.log('\nAll launches will route through this provider by default.');
      console.log('Set provider.match to "slash-models" in settings.json to route only model slugs containing /.');
      if (!process.env[apiKeyEnv]) console.log(`\nWarning: ${apiKeyEnv} is not set in your environment. Export it before launching a profile.`);
    } else if (operation==='show') {
      if (fs.existsSync(settingsPath)) {
        const settings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
        if (settings.provider) {
          console.log(`Provider: ${settings.provider.name}`);
          console.log(`  base_url: ${settings.provider.base_url}`);
          console.log(`  api_key_env: ${settings.provider.api_key_env}`);
          console.log(`  key set: ${process.env[settings.provider.api_key_env] ? 'yes' : 'NO — export ' + settings.provider.api_key_env}`);
        } else console.log('No provider configured.');
      } else console.log('No provider configured.');
    } else if (operation==='clear') {
      if (fs.existsSync(settingsPath)) {
        const settings=loadHostSettings(root);delete settings.provider;
        if(Object.keys(settings).length)fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2)+'\n');else fs.unlinkSync(settingsPath);
        console.log('Provider configuration removed. All profiles will use their native harness.');
      } else console.log('No provider to clear.');
    } else throw new Error('Use: agent-farm provider set|show|clear');
  } else if (positionals[0]==='mcp') {
    if (positionals.length!==3 || positionals[1]!=='login' || !['claude','codex'].includes(values.harness ?? '')) throw new Error('Use: agent-farm mcp login CONNECTION [--directory PATH] --harness claude|codex');
    if (values.message!==undefined || values.build || values.exec || values.explain) throw new Error('MCP login does not accept launch options');
    const launch=loginCommand(path.resolve(values['config-root']!),path.resolve(values.directory!),positionals[2]!,values.harness as 'claude'|'codex',{noWorkspace:values['no-workspace']});
    execute(launch.argv,launch.cwd,launch.env);
  } else if (positionals[0]==='plugin') {
    const operation=positionals[1];
    if (operation==='validate' && positionals.length===3) console.log(JSON.stringify(validatePlugin(path.resolve(positionals[2]!),path.resolve(values['config-root']!)),null,2));
    else if (operation==='pack' && positionals.length===4) console.log(JSON.stringify(packPlugin(path.resolve(positionals[2]!),path.resolve(positionals[3]!)).info,null,2));
    else if (operation==='install' && (positionals.length===2 || positionals.length===3)) {
      const input=positionals[2],candidate=input?path.resolve(input):undefined,bundledName=input&&candidate&&!fs.existsSync(candidate)?configurationName(input,'bundled plugin name'):'dcouple',bundled=fileURLToPath(new URL('../plugins/'+bundledName,import.meta.url));
      const source=candidate&&fs.existsSync(candidate)?candidate:bundled;if(input&&!fs.existsSync(source))throw new Error(`Plugin source or bundled plugin not found: ${input}`);
      console.log(JSON.stringify(installPlugin(source,path.resolve(values['config-root']!)),null,2));
    } else if(operation==='list'&&positionals.length===2)console.log(JSON.stringify(listPlugins(path.resolve(values['config-root']!)),null,2));
    else if(operation==='uninstall'&&positionals.length===3)console.log(JSON.stringify(uninstallPlugin(positionals[2]!,path.resolve(values['config-root']!)),null,2));
    else throw new Error('Use: agent-farm plugin validate SOURCE | pack SOURCE OUTPUT | install [SOURCE|BUNDLED-NAME] | list | uninstall NAME');
  } else if (positionals[0]==='profiles' || positionals[0]==='inspect') {
    if (positionals.length!==2 || (positionals[0]==='profiles' && positionals[1]!=='list')) throw new Error('Use: agent-farm profiles list or agent-farm inspect NAME');
    if (values.harness || values.message!==undefined || values.build || values.exec || values.explain) throw new Error('Inspection does not accept launch options');
    const root=path.resolve(values['config-root']!);
    if (positionals[0]==='inspect') console.log(JSON.stringify(inspectProfile(root,positionals[1]!,{directory:values.directory,noWorkspace:values['no-workspace']}),null,2));
    else {
      const profiles=listProfiles(root);
      console.log(profiles.length ? profiles.map(p=>`${p.qualified}${variantLabel(p)} -> ${p.agent}${p.ambiguous?' [ambiguous bare name]':''} | plugin ${p.plugin??'local'} ${p.plugin_version??'-'} | ${p.harness} | ${p.model.name} ${p.model.reasoning ?? 'default'} | ${p.model.speed}`).join('\n') : 'No launch profiles found.');
    }
  } else if (['load','unload','loaded'].includes(positionals[0] ?? '')) {
    const operation=positionals[0];
    if (positionals.length!==(operation==='loaded' ? 1 : 2)) throw new Error('Use: agent-farm load NAME, unload NAME, or loaded');
    if (values['no-workspace'] || values.message!==undefined || values.build || values.exec || values.explain) throw new Error('User-skill commands do not accept launch options');
    if (operation==='loaded') {
      if (values.harness) throw new Error('agent-farm loaded lists all harnesses');
      const entries=loadedProfiles();
      console.log(entries.length ? entries.map(p=>`${p.profile}${p.variant?':'+p.variant:''} [plugin ${p.plugin??'local'}] (${p.harness}): ${p.skills.map(s=>`${path.basename(s.destination)} [plugin ${s.plugin??p.plugin??'local'}]`).join(', ') || 'no skills'}`).join('\n') : 'No profiles loaded into user skills.');
    } else if (operation==='load') {
      const entry=loadProfile(path.resolve(values['config-root']!),positionals[1]!,{harness:values.harness});
      console.log(`Loaded ${entry.profile}: ${entry.skills.length} skills for ${entry.harness}. Skills only; start a fresh native session to verify discovery.`);
    } else {
      const entries=unloadProfile(positionals[1]!,{harness:values.harness});
      console.log(`Unloaded ${entries.map(p=>p.profile+' ('+p.harness+')').join(', ')}. Shared skills remain loaded. Start a fresh session to clear previously loaded context.`);
    }
  } else {
    if (values.harness) throw new Error('--harness is only supported by load/unload; run uses the profile harness');
    if (positionals.length!==2 || !['run','agent'].includes(positionals[0]!)) throw new Error('Unknown command. Run agent-farm help for usage.');
    if ([values.build,values.explain,values.exec,values['print-launch']].filter(Boolean).length>1) throw new Error('Choose only one of --build, --explain, --exec or --print-launch');
    if (values.build && nativeArgs.length) throw new Error('--build does not accept native arguments');
    if (values.build && (values.model!==undefined || values.reasoning!==undefined || values.speed!==undefined || values.arg!==undefined || values.resume!==undefined)) throw new Error('--build does not accept launch overrides, arguments or --resume');
    const root=path.resolve(values['config-root']!),directory=path.resolve(values.directory!),options={directory,noWorkspace:values['no-workspace']};
    const interactive=!values.exec&&!values['print-launch']&&!values.build&&!values.explain&&!!process.stdin.isTTY&&!!process.stderr.isTTY;
    const workspace=interactive?await resolveInteractiveWorkspace(root,options):resolveWorkspace(root,options);
    // A first interactive launch asks which variant to run. A resume reopens the
    // variant that started the session, and scripts get the profile's default.
    const requested=values.resume!==undefined ? resumedProfile(root,positionals[1]!,values.resume,workspace)
      : interactive && !nativeResume(nativeArgs) ? await chooseVariant(root,positionals[1]!,workspace) : positionals[1]!;
    const bundle=build(root,requested,directory,workspace);
    if (!values.build && !values.explain && !values['print-launch']) {
      const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json'),'utf8'));
      try {
        const warning=globalSkillWarning({harness:manifest.nodes.main.harness});
        if(warning)console.error(warning);
      } catch(error) { console.error('Warning: unable to inspect global skills:',error instanceof Error?error.message:error); }
    }
    if (values.build) console.log(bundle);
    else {
      const args: string[]=[];
      if (values.exec) args.push('--exec');
      if (values.explain) args.push('--explain');
      if (values['print-launch']) args.push('--print-launch');
      if (values.model!==undefined) args.push('--model='+values.model);
      if (values.reasoning!==undefined) args.push('--reasoning='+values.reasoning);
      if (values.speed!==undefined) args.push('--speed='+values.speed);
      for (const value of values.arg ?? []) args.push('--arg='+value);
      if (values.message!==undefined) args.push('--message='+values.message);
      if (values.resume!==undefined) args.push('--resume='+values.resume);
      if (nativeArgs.length) args.push('--',...nativeArgs);
      run(bundle,'main',args,undefined,path.resolve(values['config-root']!));
    }
  }
  }
} catch (error) { console.error('error:',error instanceof Error ? error.message : error); process.exitCode=1; }
