import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parse} from 'yaml';

const root=fileURLToPath(new URL('../',import.meta.url));

/** `npm pack` runs this package's prepare script even under --ignore-scripts, and prepare rebuilds dist, which
 *  sibling test files are importing as the suite runs. Pack a copy of what the manifest ships, from a manifest
 *  with no scripts at all, so the real dist is only ever read. */
function packable(t) {
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-pack-')));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 delete manifest.scripts;
 fs.writeFileSync(path.join(base,'package.json'),JSON.stringify(manifest,null,2)+'\n');
 for (const entry of manifest.files) {
  const source=path.join(root,entry);
  // Dereference rather than relink: recreating a symlink needs a privilege Windows withholds by default.
  if (fs.existsSync(source)) fs.cpSync(source,path.join(base,entry),{recursive:true,dereference:true});
 }
 return base;
}

test('npm package contains every checksummed bundled plugin file',t=>{
 const manifest=parse(fs.readFileSync(new URL('../plugins/dcouple/plugin.yaml',import.meta.url),'utf8'));
 const checksums=Object.keys(manifest.checksums);
 assert.ok(checksums.length>0,'Bundled plugin must declare checksums');
 // npm 12 keys the report by package name; earlier versions return an array.
 const report=JSON.parse(execFileSync('npm',['pack','--dry-run','--json','--ignore-scripts'],{cwd:packable(t),encoding:'utf8',shell:process.platform==='win32'}));
 const [pack]=Array.isArray(report)?report:Object.values(report);
 const files=new Set(pack.files.map(file=>file.path));
 const missing=checksums.map(relative=>`plugins/dcouple/${relative}`).filter(file=>!files.has(file));
 assert.deepEqual(missing,[],`Checksummed plugin files omitted from npm package: ${missing.join(', ')}`);
});

test('packing never rebuilds the dist that sibling tests import',t=>{
 const before=fs.readdirSync(path.join(root,'dist')).map(name=>{
  const file=path.join(root,'dist',name);
  return `${name}:${fs.statSync(file).mtimeMs}`;
 }).join('\n');
 execFileSync('npm',['pack','--dry-run','--json','--ignore-scripts'],{cwd:packable(t),encoding:'utf8',shell:process.platform==='win32'});
 const after=fs.readdirSync(path.join(root,'dist')).map(name=>{
  const file=path.join(root,'dist',name);
  return `${name}:${fs.statSync(file).mtimeMs}`;
 }).join('\n');
 assert.equal(after,before,'npm pack rewrote the real dist; sibling test files import it while the suite runs');
});
