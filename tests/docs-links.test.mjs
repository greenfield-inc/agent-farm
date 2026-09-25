import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
// GitHub's heading anchor: lowercase, drop punctuation, spaces become hyphens.
const slug=heading=>heading.trim().toLowerCase().replace(/[^\p{L}\p{N} _-]/gu,'').replace(/ /g,'-');
const anchors=file=>new Set(fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'').split('\n').flatMap(line=>{const m=line.match(/^#{1,6}\s+(.*)/);return m?[slug(m[1].replace(/[`*]/g,''))]:[];}));

test('relative links and anchors in tracked Markdown resolve',()=>{
 const files=execFileSync('git',['ls-files','*.md'],{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean);
 const broken=[];
 for(const file of files){
  const text=fs.readFileSync(path.join(root,file),'utf8').replace(/```[\s\S]*?```/g,'').replace(/`[^`\n]*`/g,'');
  for(const m of text.matchAll(/\]\(([^)\s]+)\)|src="([^"]+)"/g)){
   const link=m[1]??m[2];
   if(/^[a-z][a-z0-9+.-]*:/i.test(link))continue;
   const [target,anchor]=link.split('#');
   const resolved=target?path.join(root,path.dirname(file),target):path.join(root,file);
   if(!fs.existsSync(resolved))broken.push(`${file}: ${link}`);
   else if(anchor&&resolved.endsWith('.md')&&!anchors(resolved).has(anchor))broken.push(`${file}: ${link} (missing anchor)`);
  }
 }
 assert.deepEqual(broken,[]);
});
