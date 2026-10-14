import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const repo=fileURLToPath(new URL('../',import.meta.url));
const skill=path.join(repo,'plugins','bigbrain','skills','documents');
const script=path.join(skill,'scripts','check-bundle.mjs');
const fixtures=path.join(repo,'tests','fixtures','bigbrain');
const GOLDEN=['small-feature','ui-feature','bug-fix','session'];
const kinds=JSON.parse(fs.readFileSync(path.join(skill,'kinds.json'),'utf8'));
delete kinds.$comment;

const check=(target,...args)=>{
 const result=spawnSync(process.execPath,[script,target,...args,'--json'],{encoding:'utf8'});
 assert.ok(result.status===0||result.status===1,result.stderr);
 return {...JSON.parse(result.stdout),status:result.status};
};
const rules=report=>[...new Set(report.errors.map(e=>e.rule))].sort();
const copy=(t,name)=>{
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'bigbrain-bundle-')));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const dir=path.join(base,name);fs.cpSync(path.join(fixtures,name),dir,{recursive:true});return dir;
};
const edit=(dir,file,change)=>{const target=path.join(dir,file);fs.writeFileSync(target,change(fs.readFileSync(target,'utf8')));};
const editJson=(dir,file,change)=>edit(dir,file,text=>{const value=JSON.parse(text);change(value);return JSON.stringify(value,null,2);});
const meta=html=>JSON.parse(/<script[^>]*id="doc-meta"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1]);
const setMeta=(html,change)=>html.replace(/(<script[^>]*id="doc-meta"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,body,c)=>{const value=JSON.parse(body);change(value);return a+JSON.stringify(value)+c;});

test('the golden bundles pass check-bundle at every stage (J-9, S-5)',()=>{
 for(const name of GOLDEN)for(const stage of ['draft','approve','done']){
  const report=check(path.join(fixtures,name),'--stage',stage);
  assert.deepEqual(report.errors,[],`${name} at ${stage}`);
 }
});

test('every kind ships a template and a worked example, and each example is a golden-bundle page',()=>{
 const pages=GOLDEN.flatMap(name=>{const manifest=JSON.parse(fs.readFileSync(path.join(fixtures,name,'bundle.json'),'utf8'));return manifest.documents.filter(d=>d.endsWith('.html')&&!d.endsWith('trace.html')).map(d=>fs.readFileSync(path.join(fixtures,name,d),'utf8'));});
 assert.deepEqual(fs.readdirSync(path.join(skill,'formats')).sort(),Object.keys(kinds).sort());
 for(const kind of Object.keys(kinds)){
  const template=fs.readFileSync(path.join(skill,'formats',kind,'template.html'),'utf8'),example=fs.readFileSync(path.join(skill,'formats',kind,'example.html'),'utf8');
  assert.equal(meta(template).kind,kind);assert.equal(meta(template).status,'draft');
  for(const section of kinds[kind].sections)assert.match(template,new RegExp(`id="${section}"`),`${kind} template lacks #${section}`);
  assert.doesNotMatch(template.replace(/<script[\s\S]*?<\/script>/g,''),/\b(SC|P|J|S|D|Q|F|B)-[0-9]+\b/,`${kind} template has a numbered ID`);
  assert.equal(meta(example).kind,kind);
  assert.ok(pages.includes(example),`${kind} example.html is not byte-identical to a golden-bundle page`);
 }
});

test('a planted [NEEDS DECISION] fails on an approved page, and blocks the approve stage on a draft page',t=>{
 const dir=copy(t,'small-feature');
 edit(dir,'cover-sheet.html',html=>setMeta(html.replace('</main>','<p>[NEEDS DECISION: which date format?]</p></main>'),m=>{m.open.needs_decision=1;}));
 assert.deepEqual(rules(check(dir)),['needs-decision']);
 const draft=copy(t,'small-feature');
 edit(draft,'options.html',html=>setMeta(html.replace('</main>','<p>[NEEDS DECISION: which date format?]</p></main>'),m=>{m.open.needs_decision=1;m.status='draft';}));
 assert.equal(check(draft,'--stage','draft').status,0);
 assert.deepEqual(rules(check(draft,'--stage','approve')),['needs-decision']);
});

test('an implementer edit that rewords, adds or removes a verification check fails',t=>{
 const dir=copy(t,'small-feature');
 editJson(dir,'evidence/verification.json',v=>{v.rows[0].flow.then+=' quickly';});
 assert.deepEqual(rules(check(dir)),['verification-reworded']);
 const added=copy(t,'small-feature');
 editJson(added,'evidence/verification.json',v=>{v.rows.push({...v.rows[0],id:'J-9'});});
 assert.deepEqual(rules(check(added)),['verification-rows']);
 const removed=copy(t,'small-feature');
 editJson(removed,'evidence/verification.json',v=>{v.rows.pop();});
 assert.deepEqual(rules(check(removed)),['verification-rows']);
});

test('done needs a verdict for every J/S, and a pass needs evidence that exists',t=>{
 const dir=copy(t,'bug-fix');
 editJson(dir,'evidence/verification.json',v=>{v.rows[0].verdict='pending';});
 assert.equal(check(dir,'--stage','approve').status,0);
 assert.deepEqual(rules(check(dir,'--stage','done')),['verification-verdicts']);
 const missing=copy(t,'bug-fix');
 editJson(missing,'evidence/verification.json',v=>{v.rows[0].evidence=['evidence/qa/round-9/nowhere.png'];});
 assert.deepEqual(rules(check(missing)),['evidence']);
});

test('cited and mentioned IDs must be defined, and each defined ID needs an anchor',t=>{
 const cite=copy(t,'small-feature');
 edit(cite,'post-mortem.html',html=>setMeta(html,m=>{m.cites.push('D-99');}));
 assert.deepEqual(rules(check(cite)),['ids-defined']);
 const mention=copy(t,'small-feature');
 edit(mention,'post-mortem.html',html=>html.replace('</main>','<p>See P-77.</p></main>'));
 assert.deepEqual(rules(check(mention)),['ids-defined']);
 const map=copy(t,'session');
 edit(map,'map.html',html=>html.replace('</main>','<p>Waiting on D-41 in another bundle.</p></main>'));
 assert.equal(check(map).status,0,'the Session map may mention IDs defined in the bundles it lists');
 const anchor=copy(t,'bug-fix');
 edit(anchor,'index.html',html=>html.replace(/id="B-1"/,'id="bug-one"'));
 assert.ok(rules(check(anchor)).includes('id-anchors'));
});

test('missing sections, broken links and miscounted markers fail with their rules',t=>{
 const section=copy(t,'ui-feature');
 edit(section,'mockups/design-notes.html',html=>html.replace('id="do-dont"','id="do-and-dont"'));
 assert.ok(rules(check(section)).includes('sections'));
 const link=copy(t,'ui-feature');
 edit(link,'index.html',html=>html.replace('</main>','<p><a href="options.html#nowhere">gone</a></p></main>'));
 assert.deepEqual(rules(check(link)),['links']);
 const counted=copy(t,'small-feature');
 edit(counted,'index.html',html=>setMeta(html,m=>{m.open.assumptions+=1;}));
 assert.deepEqual(rules(check(counted)),['open-counts']);
});

test('the control flow must match its rendered section, cite real packages, and end with an end review',t=>{
 const render=copy(t,'small-feature');
 editJson(render,'control-flow.json',f=>{f.steps.reverse();});
 assert.ok(rules(check(render)).includes('control-flow-render'));
 const revision=copy(t,'small-feature');
 editJson(revision,'control-flow.json',f=>{f.revision+=1;});
 assert.ok(rules(check(revision)).includes('control-flow-render'));
 const reason=copy(t,'ui-feature');
 editJson(reason,'control-flow.json',f=>{const step=f.steps.find(s=>s.do==='review'&&Array.isArray(s.scope));delete step.reason_kind;});
 assert.deepEqual(rules(check(reason)),['control-flow-refs']);
 const end=copy(t,'bug-fix');
 editJson(end,'control-flow.json',f=>{f.steps=f.steps.filter(s=>s.do!=='review');});
 edit(end,'cover-sheet.html',html=>html.replace(/<li[^>]*data-step="review-final"[\s\S]*?<\/li>/,''));
 assert.deepEqual(rules(check(end)),['review-points']);
 const waived=copy(t,'bug-fix');
 editJson(waived,'control-flow.json',f=>{const step=f.steps.find(s=>s.scope==='all');step.review='none';step.approved_by='D-1';});
 assert.deepEqual(rules(check(waived)),['control-flow-render'],'a waiver the page does not show fails');
 edit(waived,'cover-sheet.html',html=>html.replace(/(<li[^>]*data-step="review-final"[^>]*>[\s\S]*?)<\/li>/,'$1 · no review (waived), D-1</li>'));
 assert.equal(check(waived).status,0,'"review": "none" with its D-n, shown on the page, is a valid end review');
 const trailing=copy(t,'bug-fix');
 editJson(trailing,'control-flow.json',f=>{f.steps.push({id:'build-after-review',actor:'implementer',do:'build',package:'P-1'});});
 edit(trailing,'cover-sheet.html',html=>html.replace(/(<li[^>]*data-step="review-final"[\s\S]*?<\/li>)/,'$1<li data-step="build-after-review">build · implementer · P-1</li>'));
 assert.deepEqual(rules(check(trailing)),['review-points'],'nothing may run after the end review (F-7)');
 const schema=copy(t,'bug-fix');
 editJson(schema,'control-flow.json',f=>{f.steps[0].do='deploy';});
 assert.deepEqual(rules(check(schema)),['schema:control-flow']);
});

test('status files: a valid needs_you passes; state and blocks must agree',t=>{
 const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'bigbrain-status-')));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const base={profile:'bigbrain/planner:claude',source:'/abs/bundle/index.html@rev1',state:'needs_you',step:'interview round 2',needs_you:{id:'Q-7',kind:'question',title:'Invoice filename',questions:[{q:'Use the invoice id or number?',why:'Ids are stable',options:['Invoice id (recommended)','Invoice number']}],files:['/abs/bundle/options.html#decision-2'],blocking:true,waiting:'P-2'},checks:{pass:[],fail:[],undetermined:[]},assumptions:[],pr:null,updated:'2026-10-14T16:02:00Z'};
 const write=(name,value)=>{const file=path.join(dir,name);fs.writeFileSync(file,JSON.stringify(value));return file;};
 assert.equal(check('--status',write('ok.json',base)).status,0);
 assert.deepEqual(rules(check('--status',write('missing.json',{...base,needs_you:null}))),['status-state']);
 assert.deepEqual(rules(check('--status',write('checkpoint.json',{...base,state:'checkpoint',needs_you:null}))),['status-state']);
 assert.equal(check('--status',write('cp.json',{...base,profile:'bigbrain/implementer:opus',state:'checkpoint',needs_you:null,checkpoint:{step:'review-P-1',scope:['P-1'],head:'3f9c2ab'},pr:12})).status,0);
 assert.deepEqual(rules(check('--status',write('kind.json',{...base,needs_you:{...base.needs_you,kind:'chat'}}))),['schema:status']);
});

test('a falsy JSON root is validated, not skipped: null, false, 0 and "" each fail their schema (F-1)',t=>{
 for(const [file,rule] of [['control-flow.json','schema:control-flow'],['evidence/verification.json','schema:verification']])
  for(const value of ['null','false','0','""']){
   const dir=copy(t,'small-feature');
   fs.writeFileSync(path.join(dir,file),value);
   assert.ok(rules(check(dir,'--stage','done')).includes(rule),`${file} = ${value}`);
  }
});

test('the rendered Control flow must show what each step will do, not only its id (F-4)',t=>{
 const reason=copy(t,'ui-feature');
 edit(reason,'cover-sheet.html',html=>html.replace(/(data-step="review-p1"[\s\S]*?)shared-contract/,'$1planned'));
 assert.deepEqual(rules(check(reason)),['control-flow-render'],'a checkpoint shown without its reason_kind');
 const scope=copy(t,'bug-fix');
 editJson(scope,'control-flow.json',f=>{f.steps.find(s=>s.id==='review-final').scope=['P-1'];f.steps.find(s=>s.id==='review-final').reason_kind='schema';f.steps.find(s=>s.id==='review-final').reason='x';});
 assert.ok(rules(check(scope)).includes('control-flow-render'),'scope changed in the JSON but not on the page');
 const rounds=copy(t,'small-feature');
 editJson(rounds,'control-flow.json',f=>{f.qa.max_rounds=9;});
 editJson(rounds,'evidence/verification.json',v=>{v.qa.max_rounds=9;});
 assert.deepEqual(rules(check(rounds)),['control-flow-render'],'QA rounds raised without re-rendering');
 const theme=copy(t,'ui-feature');
 edit(theme,'cover-sheet.html',html=>html.replace(/(<section[^>]*id="control-flow"[\s\S]*?)light, dark/,'$1light'));
 assert.deepEqual(rules(check(theme)),['control-flow-render'],'a QA theme dropped from the page');
});
