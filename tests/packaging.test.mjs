import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

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

test('every bundled plugin installs by name from the packed npm tarball',t=>{
 // npm drops some files (any .gitignore, for one) that a repo-directory install would still see.
 const base=packable(t),tarball=execFileSync('npm',['pack','--ignore-scripts','--silent'],{cwd:base,encoding:'utf8',shell:process.platform==='win32'}).trim().split('\n').at(-1);
 execFileSync('tar',['-xzf',tarball],{cwd:base});
 const unpacked=path.join(base,'package'),home=path.join(base,'home'),configRoot=path.join(base,'config');
 fs.symlinkSync(path.join(root,'node_modules'),path.join(unpacked,'node_modules'),'junction');
 fs.mkdirSync(home);
 const plugins=fs.readdirSync(path.join(unpacked,'plugins'));
 assert.deepEqual(plugins.sort(),fs.readdirSync(path.join(root,'plugins')).sort(),'Every repository plugin ships in the package');
 for (const name of plugins) {
  const result=spawnSync(process.execPath,[path.join(unpacked,'dist/cli.js'),'plugin','install',name,'--config-root',configRoot],{cwd:home,encoding:'utf8',env:{...process.env,HOME:home,USERPROFILE:home}});
  assert.equal(result.status,0,`plugins/${name}: ${result.stderr}`);
 }
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
