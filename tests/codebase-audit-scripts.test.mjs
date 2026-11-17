import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

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
const embedded=html=>JSON.parse(html.match(/const D=(.*?);\r?\n/)[1]);

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

// Every example in references/data-contract.md, made buildable: placeholders become real keys, dates and
// enums take a valid value, and zero counts become 400 so every part clears the page's size floor.
const contractDir=fileURLToPath(new URL('../plugins/greenfield/skills/codebase-audit/references/',import.meta.url));
const PLACEHOLDERS={'<bucket key>':'apps/web','<node id>':'api-gateway','<layer>':'API'};
const swapText=(v,from,to)=>JSON.parse(JSON.stringify(v).split(JSON.stringify(from).slice(1,-1)).join(JSON.stringify(to).slice(1,-1)));
function contract(){
 const md=fs.readFileSync(path.join(contractDir,'data-contract.md'),'utf8'),files={};
 for(const [,file,body] of md.matchAll(/^## (\S+\.json)[^\n]*\n[\s\S]*?```json\n([\s\S]*?)```/gm))files[file]=JSON.parse(body);
 const fill=v=>Array.isArray(v)?v.map(fill):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fill(x)])):
  v==='YYYY-MM-DD'?'2025-06-15':v==='YYYY-MM'?'2025-06':typeof v==='string'&&v.includes(' | ')?v.split(' | ')[0]:v===0?400:v;
 return Object.entries(PLACEHOLDERS).reduce((v,[name,value])=>swapText(v,name,value),fill(files));
}
const leaves=(v,at=[])=>typeof v==='string'?[at]:v&&typeof v==='object'?Object.entries(v).flatMap(([k,x])=>leaves(x,[...at,k])):[];
const setAt=(v,at,x)=>{at.slice(0,-1).reduce((o,k)=>o[k],v)[at.at(-1)]=x;return v};

// Runs the page's script against a stand-in DOM and returns every HTML string it assigned and every text it set.
function render(page){
 const html=[],text=[],handlers=[];
 class El{
  constructor(){this.style={};this.dataset={};this.classList={toggle(){}};this.parentNode={remove(){}};this.offsetWidth=this.offsetHeight=0;this.id='x';this.h=''}
  set innerHTML(v){html.push(v);this.h=v} get innerHTML(){return this.h}
  set textContent(v){text.push(String(v))} get textContent(){return ''}
  setAttribute(k,v){text.push(String(v))} appendChild(c){return c} append(){} replaceChildren(){} remove(){} closest(){return null}
  addEventListener(type,f){handlers.push(f)}
 }
 const document={querySelector:()=>new El(),querySelectorAll:q=>q==='[data-t]'?[...page.matchAll(/data-t="(\w+)"/g)].map(m=>Object.assign(new El(),{dataset:{t:m[1]}})):[],createElement:()=>new El(),createElementNS:()=>new El(),documentElement:new El(),title:''};
 vm.runInNewContext(page.match(/<script>([\s\S]*)<\/script>/)[1],{document,getComputedStyle:()=>({getPropertyValue:()=>'#000'}),innerWidth:1200,innerHeight:800});
 for(const f of handlers)f({clientX:0,clientY:0,target:new El()});  // every hover tooltip and click detail
 return {html,text:[...text,document.title]};
}

test('build.py and the page keep markup in every string field of the data contract as text',t=>{
 const PAYLOAD='"\'><img src=x onerror=alert(1)>',base=contract(),reached=[],refused=[];
 const variants=[...leaves(base).map(at=>[at.join('.'),setAt(structuredClone(base),at,PAYLOAD)]),
  ...Object.entries(PLACEHOLDERS).map(([name,value])=>[name,swapText(base,value,PAYLOAD)])];
 const build=files=>{const dir=tmp(t);for(const [f,v] of Object.entries(files))json(dir,f,v);const r=run('build.py',[dir,path.join(dir,'out.html')]);return {r,out:path.join(dir,'out.html')}};
 assert.equal(build(base).r.status,0,'the filled-in contract builds');
 for(const [field,files] of variants){
  const {r,out}=build(files);
  if(r.status!==0){assert.match(r.stderr,/Fix these fields/,`${field}: ${r.stderr}`);refused.push(field);continue}
  const page=fs.readFileSync(out,'utf8');
  assert.ok(!page.includes(PAYLOAD),`${field} appears unescaped in the page source`);
  const {html,text}=render(page);
  assert.ok(!html.some(s=>s.includes('<img')),`${field} reached innerHTML as markup`);
  if(html.some(s=>s.includes('&lt;img src=x'))||text.some(s=>s.toLowerCase().includes(PAYLOAD.toLowerCase())))reached.push(field);
 }
 t.diagnostic(variants.map(v=>v[0]).filter(f=>!reached.includes(f)&&!refused.includes(f)).join(", "));t.diagnostic(`${reached.length} fields reached the page as text, ${refused.length} refused by the builder, ${variants.length-reached.length-refused.length} not shown`);
 assert.ok(reached.length>variants.length/2,`most fields reach the page: ${reached.length} of ${variants.length}`);
});
