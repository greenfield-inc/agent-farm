import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkSvg} from '../dist/svg.js';
import {resolveProfile} from '../dist/compiler.js';
import {validatePlugin,installPlugin} from '../dist/plugins.js';
import {profilesJson,setProfileDisplay} from '../dist/profile-display.js';
import {ProfileManager} from '../dist/profile-manager.js';
const cli=fileURLToPath(new URL('../dist/cli.js',import.meta.url));
const svg=(body='<rect x="1" y="1" width="10" height="10" fill="url(#g)"/>')=>`<?xml version="1.0" encoding="UTF-8"?>\n<!-- farm -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><title>Lead</title><defs><linearGradient id="g"><stop offset="0" stop-color="#7a4"/></linearGradient></defs>${body}<use href="#g"/><text x="2" y="12">A &amp; B</text></svg>\n`;

test('the SVG check accepts plain shapes and refuses anything it does not understand, naming the reason',()=>{
 checkSvg(svg());checkSvg('<svg viewBox="0 0 1 1"><style>rect{fill:#000}</style><g><path d="M0 0h1"/></g></svg>');
 for(const [content,reason] of [
  [svg('<script>alert(1)</script>'),/a <script> element/],
  [svg('<rect onload="x()" width="1" height="1"/>'),/event attribute onload/],
  [svg('<use href="https://evil.example/a.svg#x"/>'),/href points outside the file/],
  [svg('<use xlink:href="other.svg#x"/>'),/xlink:href points outside the file/],
  [svg('<foreignObject><div/></foreignObject>'),/a <foreignObject> element/],
  [svg('<image href="#x"/>'),/an <image> element/],
  ['<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1">&x;</svg>',/DOCTYPE or entity declaration/],
  [svg('<text>&x;</text>'),/entity other than/],
  [svg("<style>@import url(https://evil.example/a.css);</style>"),/uses @import/],
  [svg('<rect fill="url(https://evil.example/a)" width="1" height="1"/>'),/loads an external url\(|not a #fragment/],
  [svg('<rect width="1" height="1"/>'.repeat(3000)),/the limit is 65536 \(64 KB\)/],
  [Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0xff,0xfe]),/not UTF-8 text, so not an SVG/],
  ['<svg width="1"></svg>',/no viewBox/],
  ['<html viewBox="0 0 1 1"></html>',/a <html> element/],
  [svg('<rect width="1"'),/never closed|not a plain element tag/],
  [svg('<rect fill="&#x75;rl(https://evil.example/a)" width="1" height="1"/>'),/loads an external url\(|not a #fragment/],
  [svg('<style>rect{fill:u\\72l(https://evil.example/a)}</style>'),/a CSS escape/],
  [svg('<style>@im/**/port "x.css";</style>'),/a CSS comment|@import|an at-rule/],
  [svg('<style>@font-face{font-family:x}</style>'),/an at-rule/],
  [svg('<style>rect{background:image-set("https://e.example/a.png" 1x)}</style>'),/image-set\( or src\(/],
  [svg('<rect style="fill:url(&#x27;https://e.example&#x27;)" width="1" height="1"/>'),/external url\(|not a #fragment/],
  [svg('<g xml:base="https://evil.example/"><use href="#g"/></g>'),/sets xml:base/],
  [svg('<rect width="1" width="2" height="1"/>'),/repeats the width attribute/],
  [svg('<use href="#g&#x22; onload=&#x22;x"/>'),/points outside the file/],
  ['<svg viewBox="0 0 1 1"></svg><svg viewBox="0 0 1 1"></svg>',/content after the <svg> element/]]){
  assert.throws(()=>checkSvg(content),reason,String(reason));
 }
});

/** A plugin with a titled orchestrator profile whose links form a reviewer ↔ implementer cycle. */
function fixture(t){
 const base=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'agent-farm-display-')));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const source=path.join(base,'plugin'),root=path.join(base,'config');
 const put=(p,s)=>{const f=path.join(source,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
 put('plugin.yaml','name: team\nversion: 1.0.0\ncli_major: 0\n');
 put('agents/lead.md','---\nharness: claude\nmodel: claude-opus-5-5\ndescription: Leads the work\nsubagents:\n  reviewer: {agent: reviewer, mode: launch}\n  helper: {agent: helper, mode: process}\n  notes: {agent: notes, mode: native}\n  anyone: {mode: launch, any: true}\n---\nLead.\n');
 put('agents/lead-codex.md','---\nharness: codex\nmodel: gpt-6.2-sol\nsubagents:\n  reviewer: {agent: reviewer, mode: launch}\n---\nLead on Codex.\n');
 put('agents/reviewer-claude.md','---\nharness: claude\nmodel: claude-opus-5-5\ndescription: Reviews a PR\nsubagents:\n  implementer: {agent: implementer, mode: launch}\n---\nR.\n');
 put('agents/reviewer-codex.md','---\nharness: codex\nmodel: gpt-6.2-sol\nsubagents:\n  implementer: {agent: implementer, mode: launch}\n---\nR.\n');
 put('agents/reviewer.yaml','variants:\n  claude: {agent: reviewer-claude}\n  codex: {agent: reviewer-codex}\ndefault: claude\n');
 put('agents/implementer.md','---\nharness: claude\nmodel: claude-opus-5-5\ndescription: Builds it\nsubagents:\n  reviewer: {agent: reviewer, mode: launch}\n---\nI.\n');
 put('agents/helper.md','---\nharness: codex\nmodel: gpt-6.2-sol\n---\nH.\n');
 put('agents/notes.md','---\nharness: claude\nmodel: claude-sonnet-5\n---\nN.\n');
 put('profiles/lead.yaml','title: Lead\ndescription: Software work, start to finish.\nphoto: lead.svg\nvariants:\n  claude: {agent: lead}\n  codex: {agent: lead-codex}\ndefault: claude\n');
 put('profiles/lead.svg',svg());
 put('profiles/plain.yaml','agent: helper\n');
 installPlugin(source,root);
 return {base,source,root,put};
}

test('profiles carry a title, description and checked SVG photo; a bad photo fails plugin validate but not a launch',t=>{
 const f=fixture(t),r=resolveProfile(f.root,'team/lead');
 assert.deepEqual(r.display,{title:'Lead',description:'Software work, start to finish.',photo:path.join(f.root,'plugins/team/profiles/lead.svg')});
 f.put('profiles/lead.svg',svg('<script>x</script>'));
 assert.throws(()=>validatePlugin(f.source),/The photo lead\.svg of profile team\/lead is refused: it has a <script> element/);
 // The installed copy's photo is missing: the profile still resolves and lists, with the photo left out.
 fs.rmSync(path.join(f.root,'plugins/team/profiles/lead.svg'));
 assert.equal(resolveProfile(f.root,'team/lead').nodes.main.name,'lead');
 const listed=profilesJson(f.root).profiles.find(p=>p.ref==='team/lead');assert.equal(listed.photo,null);assert.match(listed.photo_error,/is missing/);
 f.put('profiles/lead.yaml','photo: lead.png\nagent: lead\n');
 assert.throws(()=>validatePlugin(f.source),/photo must name an \.svg file next to the profile, such as lead\.svg \(photos are SVG only\)/);
 f.put('profiles/lead.yaml','title: "two\\nlines"\nagent: lead\n');
 assert.throws(()=>validatePlugin(f.source),/title must be one line of text/);
});

test('profiles list --json gives display fields, variants and a tree that stops on cycles',t=>{
 const f=fixture(t),{schema,profiles}=profilesJson(f.root),lead=profiles.find(p=>p.ref==='team/lead'),plain=profiles.find(p=>p.ref==='team/plain');
 assert.equal(schema,1);
 assert.deepEqual([lead.title,lead.description,lead.photo,lead.sources],['Lead','Software work, start to finish.',path.join(f.root,'plugins/team/profiles/lead.svg'),{title:'plugin',description:'plugin',photo:'plugin'}]);
 assert.deepEqual([plain.title,plain.description,plain.photo,plain.sources.title,plain.variants,plain.default,plain.harness],['plain',null,null,'default',null,null,'codex']);
 assert.deepEqual(Object.keys(lead.variants),['claude','codex']);assert.equal(lead.variants.codex.agent,'team/lead-codex');assert.equal(lead.default,'claude');
 assert.deepEqual(lead.editable.via,'override');
 const by=(nodes,alias)=>nodes.find(n=>n.alias===alias);
 const reviewer=by(lead.tree,'reviewer');
 assert.deepEqual([reviewer.mode,reviewer.agent,reviewer.command,reviewer.variants,reviewer.default,reviewer.description],['launch','team/reviewer','agent-farm run team/reviewer --agent-only',['claude','codex'],'claude','Reviews a PR']);
 const implementer=by(reviewer.children,'implementer');assert.equal(implementer.command,'agent-farm run team/implementer --agent-only');
 const back=by(implementer.children,'reviewer');assert.equal(back.cycle,true);assert.deepEqual(back.children,[]);
 assert.deepEqual([by(lead.tree,'helper').mode,by(lead.tree,'helper').command],['process','agent-farm run team/helper --agent-only']);
 assert.deepEqual([by(lead.tree,'notes').mode,by(lead.tree,'notes').command],['native',undefined]);
 assert.deepEqual([by(lead.tree,'anyone').any,by(lead.tree,'anyone').plugin],[true,'team']);
 const result=spawnSync(process.execPath,[cli,'profiles','list','--json','--config-root',f.root],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).profiles.length,2);
 const text=spawnSync(process.execPath,[cli,'profiles','list','--config-root',f.root],{encoding:'utf8'});
 assert.match(text.stdout,/^team\/lead \(claude: claude-opus-5-5 · codex: gpt-6\.2-sol\) -> lead \| plugin team 1\.0\.0/m);
});

test('profiles set writes a display override for a plugin profile that survives a reinstall',t=>{
 const f=fixture(t),photo=path.join(f.base,'new.svg');fs.writeFileSync(photo,svg('<circle cx="8" cy="8" r="4"/>'));
 const updated=setProfileDisplay(f.root,'team/lead',{title:'Lead (mine)',photo});
 assert.deepEqual([updated.title,updated.sources.title,updated.sources.photo,updated.sources.description],['Lead (mine)','override','override','plugin']);
 assert.equal(fs.readFileSync(updated.photo,'utf8'),fs.readFileSync(photo,'utf8'));
 // The plugin's own files are untouched, so an update installs without a "file differs" error.
 f.put('plugin.yaml','name: team\nversion: 1.0.1\ncli_major: 0\n');f.put('profiles/lead.yaml','title: Lead v2\nphoto: lead.svg\nagent: lead\n');
 installPlugin(f.source,f.root);
 const after=profilesJson(f.root).profiles.find(p=>p.ref==='team/lead');
 assert.deepEqual([after.title,after.version,after.photo],['Lead (mine)','1.0.1',updated.photo]);
 // An empty value removes the override field.
 assert.equal(setProfileDisplay(f.root,'team/lead',{title:''}).title,'Lead v2');
 const bad=path.join(f.base,'bad.svg');fs.writeFileSync(bad,svg('<rect onclick="x()" width="1" height="1"/>'));
 assert.throws(()=>setProfileDisplay(f.root,'team/lead',{photo:bad}),/The photo for profile team\/lead is refused: it has an event attribute onclick/);
 const png=path.join(f.base,'face.png');fs.writeFileSync(png,Buffer.from([0x89,0x50,0x4e,0x47]));
 const cliResult=spawnSync(process.execPath,[cli,'profiles','set','team/lead','--photo',png,'--config-root',f.root],{encoding:'utf8'});
 assert.equal(cliResult.status,1);assert.match(cliResult.stderr,/photos are SVG only/);
});

test('profiles set edits a local profile file in place',t=>{
 const f=fixture(t);
 fs.mkdirSync(path.join(f.root,'profiles'),{recursive:true});fs.writeFileSync(path.join(f.root,'profiles/mine.yaml'),'# my profile\nagent: team/helper\n');
 const photo=path.join(f.base,'p.svg');fs.writeFileSync(photo,svg());
 const result=spawnSync(process.execPath,[cli,'profiles','set','mine','--title','Mine','--description','Mine to keep','--photo',photo,'--config-root',f.root],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const yaml=fs.readFileSync(path.join(f.root,'profiles/mine.yaml'),'utf8');
 assert.match(yaml,/^# my profile/);assert.match(yaml,/title: Mine/);assert.match(yaml,/photo: mine\.svg/);
 const entry=JSON.parse(result.stdout);assert.deepEqual([entry.title,entry.sources.title,entry.editable.via],['Mine','file','file']);
 const manager=new ProfileManager(f.root,f.base),got=manager.get('mine');
 assert.deepEqual([got.display.title,got.display.photo],['Mine',true]);assert.match(manager.photo('mine').toString(),/<svg/);
 assert.equal(manager.list().find(p=>p.name==='mine').title,'Mine');
});

test('the tree lists launch links under native nodes, and its commands open the agent even past a same-name profile',t=>{
 const f=fixture(t);
 f.put('agents/notes.md','---\nharness: claude\nmodel: claude-sonnet-5\nsubagents:\n  writer: {agent: helper, mode: launch}\n---\nN.\n');
 f.put('profiles/reviewer.yaml','agent: helper\n');installPlugin(f.source,f.root);
 const lead=profilesJson(f.root).profiles.find(p=>p.ref==='team/lead'),notes=lead.tree.find(n=>n.alias==='notes');
 assert.deepEqual([notes.command,notes.children.map(c=>[c.alias,c.mode,c.agent])],[undefined,[['writer','launch','team/helper']]]);
 const command=lead.tree.find(n=>n.alias==='reviewer').command.split(' ').slice(2);
 const r=spawnSync(process.execPath,[cli,'run',...command,'--explain','--config-root',f.root,'--directory',f.base,'--no-workspace'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).trace_identity,'team/reviewer:claude@1.0.0');
});

test('a local photo edit keeps permissions, never changes another profile\'s photo, and changes nothing when it fails',{skip:process.platform==='win32'&&'POSIX modes'},t=>{
 const f=fixture(t),profiles=path.join(f.root,'profiles');fs.mkdirSync(profiles,{recursive:true});
 const blue=path.join(f.base,'blue.svg'),green=path.join(f.base,'green.svg');fs.writeFileSync(blue,svg('<circle cx="1" cy="1" r="1" fill="#00f"/>'));fs.writeFileSync(green,svg('<circle cx="1" cy="1" r="1" fill="#0f0"/>'));
 fs.writeFileSync(path.join(profiles,'mine.yaml'),'agent: team/helper\n',{mode:0o600});fs.chmodSync(path.join(profiles,'mine.yaml'),0o600);
 fs.writeFileSync(path.join(profiles,'mine.svg'),fs.readFileSync(blue));fs.writeFileSync(path.join(profiles,'other.yaml'),'agent: team/helper\nphoto: mine.svg\n');
 setProfileDisplay(f.root,'mine',{title:'Mine',photo:green});
 assert.equal(fs.statSync(path.join(profiles,'mine.yaml')).mode&0o777,0o600);
 assert.match(fs.readFileSync(path.join(profiles,'mine.yaml'),'utf8'),/photo: mine-2\.svg/);
 assert.equal(fs.readFileSync(path.join(profiles,'mine.svg'),'utf8'),fs.readFileSync(blue,'utf8'));
 fs.writeFileSync(path.join(profiles,'broken.yaml'),'agent: team/missing\n');
 assert.throws(()=>setProfileDisplay(f.root,'broken',{photo:green}),/missing/);
 assert.deepEqual(fs.readdirSync(profiles).sort(),['broken.yaml','mine-2.svg','mine.svg','mine.yaml','other.yaml']);
 // A photo must be a regular file, not a link, and is read with its size bounded.
 fs.symlinkSync(green,path.join(f.base,'link.svg'));
 assert.throws(()=>setProfileDisplay(f.root,'mine',{photo:path.join(f.base,'link.svg')}),/not a regular file/);
 const override=setProfileDisplay(f.root,'team/lead',{title:'Private'});
 assert.equal(fs.statSync(path.join(f.root,'profile-overrides/team/lead.json')).mode&0o777,0o600);assert.equal(override.title,'Private');
});

test('Duplicate to local leaves the plugin photo behind, so preview works',t=>{
 const f=fixture(t),manager=new ProfileManager(f.root,f.base),{source}=manager.duplicate('team/lead');
 assert.doesNotMatch(source,/photo:/);assert.match(source,/title: Lead/);
 assert.equal(manager.preview({name:'my-lead',source,revision:null}).resolved.agent,'team/lead');
});
