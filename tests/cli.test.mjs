import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));

test('bare agent-farm starts setup on first launch',t=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-first-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const env={...process.env,HOME:home,USERPROFILE:home};delete env.AGENT_FARM_CONFIG_ROOT;
 const result=spawnSync(process.execPath,[cli],{cwd:home,env,encoding:'utf8',input:''});
 assert.match(result.stdout,/First-time setup/);
});
