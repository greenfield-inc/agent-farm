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

test('numstat parsing counts binary files with no lines and keeps renamed paths',()=>{
 assert.deepEqual(parseNumstat('3\t1\tsrc/a.ts\n-\t-\tassets/logo.png\n2\t0\tsrc/{old => new}/b.ts\n'),[
  {path:'src/a.ts',added:3,deleted:1},{path:'assets/logo.png',added:0,deleted:0},{path:'src/new/b.ts',added:2,deleted:0}]);
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
