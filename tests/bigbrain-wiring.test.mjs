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

test('the size script sits in documents, which every agent that sizes a review loads',()=>{
 assert.ok(fs.existsSync(path.join(plugin,'skills/documents/scripts/review-size.mjs')));
 for(const file of ['skills/review/SKILL.md','skills/orchestrate/SKILL.md'])assert.match(read(file),/documents` skill's `scripts\/review-size\.mjs/,file);
 for(const file of ['agents/orchestrator.md','agents/reviewer-codex.md','agents/reviewer-claude.md'])assert.match(frontmatter(file),/\nskills:\n(?:  - .+\n)*  - documents\n/,file);
});
