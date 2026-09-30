import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const packageJson=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

for(const argument of ['version','--version','-v']){
 test(`agent-farm ${argument} prints the package version`,()=>{
  const result=spawnSync(process.execPath,[cli,argument],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),packageJson.version);
 });
}
