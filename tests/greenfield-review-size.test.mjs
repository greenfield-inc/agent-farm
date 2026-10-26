import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {sizeReview,parseNumstat} from '../plugins/greenfield/skills/review/scripts/review-size.mjs';

const script=path.resolve('plugins/greenfield/skills/review/scripts/review-size.mjs');
// n files under src/, splitting `lines` changed lines between them.
const files=(n,lines,dir='src')=>Array.from({length:n},(_,i)=>({path:`${dir}/file-${i}.ts`,added:Math.floor(lines/n)+(i<lines%n?1:0),deleted:0}));

test('4 files and 38 lines with no risk trigger size as small',()=>{
 const r=sizeReview(files(4,38));
 assert.equal(r.size,'small');
 assert.deepEqual([r.files,r.lines,r.triggers],[4,38,[]]);
 assert.equal(r.reason,'4 files, 38 lines');
});

test('14 files and 600 lines size as standard',()=>{
 const r=sizeReview(files(14,600));
 assert.equal(r.size,'standard');
 assert.deepEqual([r.files,r.lines],[14,600]);
});

test('a migration sizes as large however small the diff',()=>{
 const r=sizeReview([...files(2,10),{path:'db/migrations/20261022_add_index.sql',added:3,deleted:0}]);
 assert.equal(r.size,'large');
 assert.deepEqual(r.triggers.map(t=>t.kind),['schema']);
 assert.match(r.reason,/risk trigger schema \(db\/migrations\/20261022_add_index\.sql\)/);
});

test('over 1,000 lines sizes as large, and so do more than 30 files',()=>{
 assert.equal(sizeReview(files(8,1001)).size,'large');
 assert.equal(sizeReview(files(8,1000)).size,'standard');
 assert.equal(sizeReview(files(31,62)).size,'large');
});

test('the small limits are inclusive, and either one crossed makes it standard',()=>{
 assert.equal(sizeReview(files(10,300)).size,'small');
 assert.equal(sizeReview(files(11,30)).size,'standard');
 assert.equal(sizeReview(files(3,301)).size,'standard');
});

test('lockfiles, generated and vendored files are not counted',()=>{
 const r=sizeReview([...files(2,20),{path:'pnpm-lock.yaml',added:4000,deleted:900},{path:'dist/cli.js',added:500,deleted:0},{path:'vendor/lib/a.go',added:700,deleted:0}]);
 assert.equal(r.size,'small');
 assert.deepEqual([r.files,r.lines,r.excluded],[2,20,3]);
});

test('auth, secrets, public contracts and irreversible changes are risk triggers',()=>{
 const kind=p=>sizeReview([{path:p,added:5,deleted:0}]).triggers.map(t=>t.kind);
 assert.deepEqual(kind('server/auth/session.ts'),['auth']);
 assert.deepEqual(kind('config/secrets.example.env'),['auth']);
 assert.deepEqual(kind('api/openapi.yaml'),['contract']);
 assert.deepEqual(kind('proto/billing.proto'),['contract']);
 assert.deepEqual(kind('prisma/schema.prisma'),['schema']);
 assert.deepEqual(kind('infra/main.tf'),['irreversible']);
 assert.deepEqual(kind('src/components/Button.tsx'),[]);
});

test('one file and one line read in the singular',()=>{
 assert.equal(sizeReview([{path:'src/a.ts',added:1,deleted:0}]).reason,'1 file, 1 line');
});


test('-z numstat parsing keeps unusual paths and renames verbatim',()=>{
 const z='1\t0\tmigrations/\u00e9.js\x00-\t-\tlogo.png\x002\t1\t\x00src/old name.ts\x00src/new name.ts\x00';
 assert.deepEqual(parseNumstat(z),[
  {path:'migrations/\u00e9.js',added:1,deleted:0},{path:'logo.png',added:0,deleted:0},{path:'src/new name.ts',added:2,deleted:1}]);
});

test('a path containing a tab is kept whole',()=>{
 assert.deepEqual(parseNumstat('1\t0\tdb/note\tdata.sql\x00'),[{path:'db/note\tdata.sql',added:1,deleted:0}]);
 assert.equal(sizeReview(parseNumstat('1\t0\tdb/note\tdata.sql\x00')).size,'large');
});

test('paths git would quote still hit the risk triggers',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-review-size-quoted-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',['-c','user.name=t','-c','user.email=t@example.com','-c','core.quotepath=true',...args],{cwd:dir});
 git('init','-q','-b','main');fs.writeFileSync(path.join(dir,'README.md'),'x\n');git('add','.');git('commit','-qm','base');
 for(const d of ['migrations','auth','db'])fs.mkdirSync(path.join(dir,d));
 fs.writeFileSync(path.join(dir,'migrations','\u00e9.js'),'a\n');fs.writeFileSync(path.join(dir,'auth','\u00e9.js'),'a\n');fs.writeFileSync(path.join(dir,'db','\u00e9.sql'),'a\n');
 git('add','.');git('commit','-qm','quoted');
 const out=JSON.parse(execFileSync(process.execPath,[script,'main~1...main','--repo',dir,'--json']).toString());
 assert.equal(out.size,'large');
 assert.deepEqual(out.triggers.map(t=>t.kind).sort(),['auth','schema']);
});

test('the command sizes a real git range, prints the size line, and rejects bad usage',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'greenfield-review-size-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',['-c','user.name=t','-c','user.email=t@example.com',...args],{cwd:dir});
 git('init','-q','-b','main');fs.writeFileSync(path.join(dir,'README.md'),'x\n');git('add','.');git('commit','-qm','base');
 fs.mkdirSync(path.join(dir,'migrations'));fs.writeFileSync(path.join(dir,'migrations','001.sql'),'create index a on t(b);\n');
 fs.writeFileSync(path.join(dir,'README.md'),'x\ny\n');git('add','.');git('commit','-qm','change');
 const out=JSON.parse(execFileSync(process.execPath,[script,'main~1...main','--repo',dir,'--json']).toString());
 assert.equal(out.size,'large');
 assert.deepEqual([out.files,out.lines],[2,2]);
 assert.equal(execFileSync(process.execPath,[script,'main~1...main','--repo',dir]).toString(),'Size: large because 2 files, 2 lines; risk trigger schema (migrations/001.sql)\n');
 assert.throws(()=>execFileSync(process.execPath,[script],{stdio:'pipe'}),e=>e.status===2);
 assert.throws(()=>execFileSync(process.execPath,[script,'nope...main','--repo',dir],{stdio:'pipe'}),e=>e.status===2);
});
