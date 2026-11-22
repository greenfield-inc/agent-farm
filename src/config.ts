import fs from 'node:fs';
import path from 'node:path';
import {parseDocument} from 'yaml';

export const configurationNamePattern=/^[a-z][a-z0-9_-]{0,63}$/;

export function configurationName(value:unknown,label='configuration name'):string {
  if(typeof value!=='string'||!configurationNamePattern.test(value))throw new Error(`Expected a lowercase ${label}, not a path`);
  return value;
}

export function qualifiedName(value:unknown):{plugin?:string;name:string} {
  if(typeof value!=='string')throw new Error('Expected a lowercase configuration name, not a path');
  const parts=value.split('/');
  if(parts.length===1)return {name:configurationName(parts[0])};
  if(parts.length===2)return {plugin:configurationName(parts[0],'plugin name'),name:configurationName(parts[1])};
  throw new Error('Expected NAME or PLUGIN/NAME with exactly one slash');
}

export interface PluginIdentity {name:string;version:string;source?:{repository:string;commit:string}}
export interface Namespace {root:string;plugin?:string;version?:string;local:boolean}

export function pluginIdentity(root:string):PluginIdentity|undefined {
  const file=path.join(root,'plugin.yaml');
  if(!fs.existsSync(file))return;
  const doc=parseDocument(fs.readFileSync(file,'utf8'),{uniqueKeys:true});
  if(doc.errors.length)throw new Error(`${file}: ${doc.errors.map(e=>e.message).join('; ')}`);
  const value=doc.toJS() as Record<string,unknown>;
  if(!value||typeof value!=='object')throw new Error(`${file}: expected a plugin manifest`);
  const name=configurationName(value.name,'plugin name');
  if(typeof value.version!=='string'||!/^\d+\.\d+\.\d+$/.test(value.version)||value.cli_major!==0)throw new Error(`${file}: expected a semantic version and cli_major: 0`);
  return {name,version:value.version,...(value.source&&typeof value.source==='object'?{source:value.source as PluginIdentity['source']}:{})};
}

interface Receipt {name?:unknown;version?:unknown;layout?:unknown}
export function namespaces(root:string,additionalRoot?:string):Namespace[] {
  root=fs.realpathSync(root);
  const direct=pluginIdentity(root);
  const result:Namespace[]=[{root,plugin:direct?.name,version:direct?.version,local:!direct}];
  const host=path.resolve(additionalRoot??root),receipts=path.join(host,'.plugins');
  if(!fs.existsSync(receipts))return result;
  for(const file of fs.readdirSync(receipts).filter(file=>file.endsWith('.json')).sort()) {
    let receipt:Receipt;
    try{receipt=JSON.parse(fs.readFileSync(path.join(receipts,file),'utf8'));}catch(error){throw new Error(`Invalid plugin receipt ${path.join(receipts,file)}: ${error instanceof Error?error.message:error}`);}
    if(receipt.layout!==2)continue;
    const plugin=configurationName(receipt.name,'plugin name');
    if(file!==plugin+'.json')throw new Error(`Plugin receipt filename does not match plugin ${plugin}: ${file}`);
    if(result.some(item=>item.plugin===plugin))continue;
    const pluginRoot=path.join(host,'plugins',plugin);
    if(!fs.existsSync(pluginRoot))throw new Error(`Installed plugin ${plugin} is missing: ${pluginRoot}`);
    const identity=pluginIdentity(pluginRoot);
    if(!identity||identity.name!==plugin)throw new Error(`Installed plugin manifest does not match receipt: ${pluginRoot}`);
    result.push({root:fs.realpathSync(pluginRoot),plugin,version:identity.version,local:false});
  }
  return result;
}

export interface HostSettings {default_plugin?:string;provider?:unknown;telemetry?:unknown;mcp?:'inherit'|'strict'}
export function loadHostSettings(root:string):HostSettings {
  const file=path.join(root,'settings.json');
  if(!fs.existsSync(file))return {};
  let value:unknown;
  try{value=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new Error('Host settings must be valid JSON');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Host settings must be a JSON object');
  const settings=value as Record<string,unknown>,extra=Object.keys(settings).filter(k=>!['provider','default_plugin','telemetry','mcp'].includes(k));
  if(extra.length)throw new Error(`Host settings support only provider, default_plugin, telemetry, and mcp (unsupported: ${extra.join(', ')})`);
  if(settings.mcp!==undefined&&settings.mcp!=='inherit'&&settings.mcp!=='strict')throw new Error('Host settings mcp must be "inherit" or "strict"');
  if(settings.default_plugin!==undefined)configurationName(settings.default_plugin,'default plugin');
  return settings as HostSettings;
}
