import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const plugin=path.resolve('plugins/bigbrain');
const read=file=>fs.readFileSync(path.join(plugin,file),'utf8');
const frontmatter=file=>/^---\n([\s\S]*?)\n---\n/.exec(read(file))[1];

test('every implementer agent declares a native builder beside explorer and verifier',()=>{
 for(const file of ['agents/implementer-opus.md','agents/implementer-codex.md']){
  const meta=frontmatter(file);
  for(const child of ['explorer','verifier','builder'])assert.match(meta,new RegExp(`\\n  ${child}:\\n    agent: ${child}\\n`),`${file} lacks ${child}`);
  assert.match(meta,/\n  builder:\n    agent: builder\n[\s\S]*?mode: native/);
 }
});

test('the builder edits only its files and never commits',()=>{
 const body=read('agents/builder.md');
 assert.match(body,/Edit only the files your brief lists/);
 assert.match(body,/Never commit/);
});

test('the review skill names its size script, and the script exists',()=>{
 assert.match(read('skills/review/SKILL.md'),/scripts\/review-size\.mjs/);
 assert.ok(fs.existsSync(path.join(plugin,'skills/review/scripts/review-size.mjs')));
});
