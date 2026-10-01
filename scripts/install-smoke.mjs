// Installs the packed CLI the way a user does (npm i -g) and runs first-use commands
// against fake claude/codex npm packages, so Windows exercises real .cmd shims.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const windows=process.platform==='win32';
const root=fileURLToPath(new URL('..',import.meta.url));
const base=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-install-smoke-')));
const prefix=path.join(base,'prefix'),home=path.join(base,'home'),repo=path.join(base,'repo'),fake=path.join(base,'fake-harness'),record=path.join(base,'record.jsonl');
for(const dir of [prefix,home,repo,fake])fs.mkdirSync(dir,{recursive:true});
// npm resolves through cmd.exe on Windows.
const npm=(args,options={})=>execFileSync('npm',args,{encoding:'utf8',shell:windows,...options});

npm(['pack','--pack-destination',base],{cwd:root,stdio:['ignore','ignore','inherit']});
const tarball=path.join(base,fs.readdirSync(base).find(f=>f.endsWith('.tgz')));
fs.writeFileSync(path.join(fake,'package.json'),JSON.stringify({name:'fake-harness',version:'1.0.0',bin:{claude:'harness.js',codex:'harness.js'}}));
fs.writeFileSync(path.join(fake,'harness.js'),"#!/usr/bin/env node\nrequire('node:fs').appendFileSync(process.env.FAKE_RECORD,JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()})+'\\n');\n");
npm(['install','--global','--prefix',prefix,tarball,fake],{stdio:'inherit'});

const bin=windows?prefix:path.join(prefix,'bin');
const pathKey=Object.keys(process.env).find(k=>k.toUpperCase()==='PATH')??'PATH';
const env={...process.env,HOME:home,USERPROFILE:home,FAKE_RECORD:record,AGENT_FARM_CONFIG_ROOT:path.join(home,'.config','agent-farm'),[pathKey]:bin+path.delimiter+process.env[pathKey]};
execFileSync('git',['init','-q'],{cwd:repo});
const cli=path.join(prefix,windows?'':'lib','node_modules','@greenfieldco','agent-farm','dist','cli.js');
// The npm bin shim must start the CLI; later calls skip cmd.exe so arguments keep their spaces.
const shim=spawnSync('agent-farm',['--help'],{cwd:repo,env,encoding:'utf8',shell:windows});
assert.equal(shim.status,0,shim.stderr);
const agentFarm=(...args)=>{
 const result=spawnSync(process.execPath,[cli,...args],{cwd:repo,env,encoding:'utf8'});
 assert.equal(result.status,0,`agent-farm ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
 return result.stdout;
};
const launches=()=>fs.existsSync(record)?fs.readFileSync(record,'utf8').trim().split('\n').map(line=>JSON.parse(line)):[];

assert.match(agentFarm('doctor'),/claude\s.*found/);
agentFarm('plugin','install');
assert.match(agentFarm('profiles','list'),/dcouple\/raw/);
for(const [profile,flag] of [['dcouple/raw:opus','--append-system-prompt'],['dcouple/raw:astra','developer_instructions']]){
 const before=launches().length;
 agentFarm('run',profile,'--exec','--message','hello from the smoke test');
 const launch=launches()[before];
 assert.ok(launch,`${profile} did not reach the harness`);
 assert.equal(fs.realpathSync(launch.cwd),repo);
 assert.ok(launch.args.some(a=>a.includes(flag)),`${profile} lost its instructions`);
 assert.equal(launch.args.at(-1),'hello from the smoke test');
}
const bundle=agentFarm('run','dcouple/raw:opus','--build').trim();
const dispatch=spawnSync(process.execPath,[path.join(bundle,'main','dispatch','reviewer'),'--print-launch'],{cwd:repo,env,encoding:'utf8'});
assert.equal(dispatch.status,0,dispatch.stderr);
agentFarm('set','global','dcouple/raw:opus','--harness','claude');
assert.match(agentFarm('status','global'),/managed/i);
agentFarm('unset','global','dcouple/raw:opus','--harness','claude');
fs.rmSync(base,{recursive:true,force:true});
console.log('Install smoke passed');
