import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {checkBundle} from '../plugins/bigbrain/skills/documents/scripts/check-bundle.mjs';

const skill=path.resolve('plugins/bigbrain/skills/documents');
const kinds=JSON.parse(fs.readFileSync(path.join(skill,'kinds.json'),'utf8'));
const example=fs.readFileSync(path.join(skill,'formats/cover-sheet/example.html'),'utf8');
const template=fs.readFileSync(path.join(skill,'formats/cover-sheet/template.html'),'utf8');
const MOCKUPS=['share-v2-dialog','share-v2-added','share-v2-manage','shared-v2-list','shared-v2-empty'];

// A minimal page of any kind: every required section, plus the IDs it defines as elements.
function stub(kind,defines,extraIds=[]){
 const meta={kind,id:`${kind}-stub`,status:'approved',revision:1,supersedes:null,updated:'2026-10-14',defines,cites:[],open:{needs_decision:0,assumptions:0}};
 const ids=[...kinds[kind].sections,...extraIds].map(id=>`<section id="${id}"><p>n/a because this is a test stub</p></section>`).join('\n');
 return `<!doctype html><html><head><script type="application/json" id="doc-meta">${JSON.stringify(meta)}</script></head><body>\n${ids}\n${defines.map(id=>`<p id="${id}">${id}</p>`).join('\n')}\n</body></html>`;
}

const journey=(covers,evidence)=>({covers,given:'a state',when:'an action',then:'a result',check:{method:'app',evidence}});
const flow={
 version:1,revision:2,approved_by:null,
 qa:{max_rounds:2,mockups:MOCKUPS.map(m=>`mockups/${m}.html`),jank_checklist:true,viewports:['desktop','phone'],themes:['light','dark']},
 flows:{
  'J-1':journey(['SC-1','P-1','P-3'],'J-1-shared-desktop-light.png'),
  'J-2':journey(['SC-2','SC-4','P-2','P-3'],'J-2-empty-phone-dark.png'),
  'J-3':journey(['SC-3','P-1','P-3'],'J-3-revoked-desktop-light.png'),
  'J-4':journey(['SC-4','P-2','P-3'],'J-4-last-edited-desktop-light.png'),
  'J-5':{...journey(['SC-1','SC-3','P-1'],'server tests'),check:{method:'test',evidence:'server tests'}},
  'S-1':{covers:['P-1','P-2'],run:'pnpm test --filter server',expect:'0 failures'},
  'S-2':{covers:['P-3'],run:'pnpm test --filter web',expect:'0 failures'},
 },
 steps:[
  {id:'build-P-1',actor:'implementer',do:'build',package:'P-1'},
  {id:'verify-P-1',actor:'implementer',do:'verify',flows:['S-1','J-5']},
  {id:'build-P-2',actor:'implementer',do:'build',package:'P-2'},
  {id:'verify-P-2',actor:'implementer',do:'verify',flows:['S-1']},
  {id:'pr-server',actor:'implementer',do:'pr'},
  {id:'review-server',actor:'orchestrator',do:'review',scope:['P-1','P-2'],reason_kind:'schema',reason:'a new table every note read checks'},
  {id:'build-P-3',actor:'implementer',do:'build',package:'P-3'},
  {id:'verify-P-3',actor:'implementer',do:'verify',flows:['S-2']},
  {id:'qa',actor:'implementer',do:'qa',flows:['J-1','J-2','J-3','J-4','J-5'],spawn:'verifier'},
  {id:'pr-web',actor:'implementer',do:'pr'},
  {id:'review-final',actor:'orchestrator',do:'review',scope:'all'},
 ],
};

function bundle(t,coverSheet=example){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bigbrain-bundle-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const put=(file,text)=>{fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),text);};
 put('index.html',stub('brief',['SC-1','SC-2','SC-3','SC-4']));
 put('decisions.html',stub('decisions',['D-1','D-2','D-3','D-4','D-5']));
 put('mockups/index.html',stub('mockups',[],kinds.mockups.sections.includes('current')?[]:['current']));
 for(const m of MOCKUPS){put(`mockups/${m}.html`,'<!doctype html><title>frame</title>');put(`mockups/${m}.png`,'png');}
 put('cover-sheet.html',coverSheet);
 put('control-flow.json',JSON.stringify(flow));
 put('evidence/verification.json',JSON.stringify({version:1,control_flow_revision:flow.revision,tested:{},qa:{rounds_used:0,max_rounds:2},
  rows:Object.entries(flow.flows).map(([id,f])=>({id,flow:f,verdict:'pending',method:null,evidence:[],commit:null,round:null}))}));
 put('bundle.json',JSON.stringify({documents:['index.html','decisions.html','mockups/index.html','cover-sheet.html','control-flow.json','evidence/verification.json']}));
 return dir;
}
const rules=report=>report.errors.map(e=>`${e.rule}: ${e.message}`);
const moveSection=(html,id,beforeId)=>{
 const section=new RegExp(`<section id="${id}"[\\s\\S]*?</section>\\n\\n`).exec(html)[0];
 return html.replace(section,'').replace(`<section id="${beforeId}"`,`${section}<section id="${beforeId}"`);
};

test('the cover-sheet example passes check-bundle at approve',t=>{
 const report=checkBundle(bundle(t),{stage:'approve'});
 assert.deepEqual(rules(report),[]);
});

test('the template and example list every cover-sheet section in order',()=>{
 for(const html of [template,example]){
  const at=kinds['cover-sheet'].sections.map(id=>html.search(new RegExp(`\\sid="${id}"`)));
  assert.ok(at.every(i=>i>=0),`missing: ${kinds['cover-sheet'].sections.filter((_,i)=>at[i]<0)}`);
  assert.deepEqual(at,[...at].sort((a,b)=>a-b));
 }
});

test('an unapproved cover sheet with sections out of order fails section-order',t=>{
 const report=checkBundle(bundle(t,moveSection(example,'schema-changes','decisions-locked')));
 assert.ok(rules(report).some(r=>r.startsWith('section-order: #packages comes before #schema-changes')),rules(report).join('\n'));
});

test('schema groups show their DDL, visible, above the table',t=>{
 const below=example.replace(/(<div class="ddl">[\s\S]*?<\/div>\n)(<table class="schema-table">[\s\S]*?<\/table>\n)/,'$2$1');
 assert.ok(rules(checkBundle(bundle(t,below))).some(r=>r.includes('schema-note-shares shows its table before its DDL')));
 const hidden=example.replace('<div class="ddl"><pre><code>CREATE TABLE note_shares','<details><summary>Exact DDL</summary></details><div class="ddl"><pre><code>CREATE TABLE note_shares');
 assert.ok(rules(checkBundle(bundle(t,hidden))).some(r=>r.includes('schema-note-shares hides its DDL')));
 const empty=example.replace(/<h3>New tables<\/h3>[\s\S]*?<h3>Considered and not needed<\/h3>/,'<h3>Considered and not needed</h3>');
 assert.ok(rules(checkBundle(bundle(t,empty))).some(r=>r.startsWith('schema-changes: #schema-changes has no schema-group')));
});

test('the Control flow section needs its diagram',t=>{
 const plain=example.replace(/<figure class="cf-diagram">[\s\S]*?<\/figure>\n/,'');
 assert.ok(rules(checkBundle(bundle(t,plain))).some(r=>r.startsWith('control-flow-render: the Control flow section has no inline-SVG diagram')));
});

test('a cover sheet approved before the new sections keeps its shape',t=>{
 let old=example.replace('"status": "ready-for-review"','"status": "approved"');
 for(const id of ['what-we-build','schema-changes'])old=old.replaceAll(`"${id}"`,`"${id}-old"`).replaceAll(`"#${id}"`,`"#${id}-old"`);
 old=moveSection(old,'packages','change-log').replace(/<figure class="cf-diagram">[\s\S]*?<\/figure>\n/,'');
 assert.deepEqual(rules(checkBundle(bundle(t,old))),[]);
 const draft=old.replace('"status": "approved"','"status": "draft"');
 const failed=rules(checkBundle(bundle(t,draft)));
 for(const expected of ['sections: missing the cover-sheet section #what-we-build','sections: missing the cover-sheet section #schema-changes','section-order:','control-flow-render: the Control flow section has no inline-SVG diagram'])
  assert.ok(failed.some(r=>r.startsWith(expected)),`${expected}\n${failed.join('\n')}`);
});
