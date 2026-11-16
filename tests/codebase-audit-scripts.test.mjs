import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const scripts=fileURLToPath(new URL('../plugins/greenfield/skills/codebase-audit/scripts/',import.meta.url));
const python=process.platform==='win32'?'python':'python3';
const run=(script,args)=>spawnSync(python,[path.join(scripts,script),...args],{encoding:'utf8'});
function tmp(t){const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'codebase-audit-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
const put=(dir,file,text)=>{fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),text);};
const json=(dir,file,value)=>put(dir,file,JSON.stringify(value));

// The smallest data set build.py accepts: one 400-line part, last committed in January 2024.
function data(dir,extra={}){
 json(dir,'metrics.json',{parts:{src:{code_loc:400,test_loc:0,loc:400,commits:10,c30:0,c90:0,c365:0,top:10,first:'2024-01-03',last:'2024-01-20'}},monthly:[{m:'2024-01',n:10,f:10}]});
 json(dir,'scores.json',{buckets:{src:{label:'Settings',group:'App',score:2,reason:'Half-built.'}}});
 json(dir,'hand.json',{page:{title:'Acme, mapped',today:'2026-11-16'},focus:[{k:'src',n:'Settings',said:'“Settings need polish”',found:[]}]});
 for(const [file,value] of Object.entries(extra))json(dir,file,value);
}
const embedded=html=>JSON.parse(html.match(/const D=(.*?);\r?\n/)[1].replace(/<\\\//g,'</'));

test('metrics.py counts test folders at the repository root as tests',t=>{
 const repo=tmp(t),out=tmp(t);
 put(repo,'tests/test_math.py','a = 1\nb = 2\n');put(repo,'e2e/checkout.ts','x();\ny();\n');put(repo,'src/app.ts','a();\nb();\n');
 const git=args=>assert.equal(spawnSync('git',['-c','user.name=t','-c','user.email=t@example.com',...args],{cwd:repo}).status,0);
 git(['init','-q']);git(['add','.']);git(['commit','-qm','init']);
 json(out,'cfg.json',{buckets:[{prefix:'',depth:1}],today:'2026-11-16'});
 const r=run('metrics.py',[repo,path.join(out,'cfg.json'),path.join(out,'metrics.json')]);
 assert.equal(r.status,0,r.stderr);
 const {parts}=JSON.parse(fs.readFileSync(path.join(out,'metrics.json'),'utf8'));
 assert.deepEqual(Object.fromEntries(Object.entries(parts).map(([k,p])=>[k,[p.code_loc,p.test_loc]])),{tests:[0,2],e2e:[0,2],src:[2,0]});
});

test('build.py counts recent activity by calendar month through the audit date, reading UTF-8 on any platform',t=>{
 const dir=tmp(t);data(dir);
 const r=run('build.py',[dir,path.join(dir,'out.html')]);
 assert.equal(r.status,0,r.stderr);
 const html=fs.readFileSync(path.join(dir,'out.html'),'utf8'),D=embedded(html);
 assert.equal(D.monthly.length,35,'January 2024 through November 2026');
 assert.deepEqual(D.monthly.slice(-3).map(m=>[m.m,m.n]),[['2026-09',0],['2026-10',0],['2026-11',0]]);
 assert.ok(html.includes('“Settings need polish”'));
});

test('build.py refuses research fields that are not the documented numbers, dates or enums',t=>{
 const dir=tmp(t);
 data(dir,{'timeline.json':{milestones:[{date:'2025-02-01',type:'feature"><img src=x onerror=alert(1)>',title:'Launch',detail:''}]},
  'top50.json':{low:[{rank:'<b>1</b>',title:'',why:'',area:'',impact:'high',verified:'code',files:[]}],high:[]}});
 const r=run('build.py',[dir,path.join(dir,'out.html')]);
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/timeline\.milestones\[0\]\.type/);
 assert.match(r.stderr,/top50\.low\[0\]\.rank/);
 assert.equal(fs.existsSync(path.join(dir,'out.html')),false);
});

test('build.py refuses a monthly commit count that is not a number',t=>{
 const dir=tmp(t);
 data(dir,{'timeline.json':{milestones:[],monthly:[{m:'2024-01',n:'<img src=x onerror=alert(1)>',f:0}]}});
 const r=run('build.py',[dir,path.join(dir,'out.html')]);
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/timeline\.monthly\[0\]\.n/);
 assert.equal(fs.existsSync(path.join(dir,'out.html')),false);
});

test('build.py refuses a month outside 1 to 12 instead of looping',t=>{
 const dir=tmp(t);
 data(dir,{'timeline.json':{milestones:[],monthly:[{m:'2024-13',n:1,f:1}]}});
 const r=spawnSync(python,[path.join(scripts,'build.py'),dir,path.join(dir,'out.html')],{encoding:'utf8',timeout:30000});
 assert.equal(r.signal,null,'build.py did not finish');
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/timeline\.monthly\[0\]\.m/);
});
