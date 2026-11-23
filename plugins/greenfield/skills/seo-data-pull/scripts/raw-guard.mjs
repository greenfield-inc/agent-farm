#!/usr/bin/env node
// Refuses a push that would publish raw SEO data. Uses only node: builtins.
//
//   node raw-guard.mjs [--repo <dir>] --base <ref> [--head <ref>]
//
// Walks every commit in base..head (what the push would publish, not only the tip). A raw path is .seo/data
// (the folder or the link) or anything in a data/ folder under .seo/archive/. A commit that adds, changes,
// copies, renames to or retypes a raw path is exposure, even when a later commit removes it. Deleting a raw
// path is never exposure: removing one the base already has is cleanup of an older commit.
// Exit 0 when nothing raw is published; exit 1 naming each commit and path, or on bad usage or a git failure.
import {execFileSync} from 'node:child_process';
import path from 'node:path';

function fail(message){
  process.stderr.write(`raw-guard.mjs: ${message}\n`);
  process.exit(1);
}

const opts={repo:process.cwd(),base:null,head:'HEAD'};
const argv=process.argv.slice(2);
for(let i=0;i<argv.length;i++){
  if(!['--repo','--base','--head'].includes(argv[i])||i+1>=argv.length)fail('usage: node raw-guard.mjs [--repo <dir>] --base <ref> [--head <ref>]');
  opts[argv[i].slice(2)]=argv[++i];
}
if(!opts.base)fail('--base is required: the default branch the push goes to, for example origin/main');
const repo=path.resolve(opts.repo);

function git(args){
  try{
    return execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1<<28});
  }catch(error){
    fail(`git ${args[0]} failed: ${String(error.stderr||error.message).trim()}`);
  }
}

const raw=file=>file==='.seo/data'||file.startsWith('.seo/data/')||/^\.seo\/archive\/(.+\/)?data(\/|$)/.test(file);

const base=git(['merge-base',opts.base,opts.head]).trim();
const exposed=[];
for(const commit of git(['rev-list','--reverse',`${base}..${opts.head}`]).split('\n').filter(Boolean)){
  // -m with --first-parent shows a merge against the branch it was merged into.
  const lines=git(['diff-tree','-r','-m','--first-parent','--no-commit-id','--name-status','-C',commit]).split('\n').filter(Boolean);
  for(const line of lines){
    const [status,...files]=line.split('\t');
    const target=files[files.length-1];
    if(!raw(target))continue;
    // A deletion never publishes data: one of a path the base has is cleanup, and a path added earlier in the
    // range was already reported at its addition.
    if(status==='D')continue;
    exposed.push(`${commit.slice(0,12)} ${status[0]} ${target}`);
  }
}

if(exposed.length){
  process.stderr.write(`raw-guard.mjs: this push would publish raw SEO data in ${exposed.length} change(s):\n${exposed.map(line=>`  ${line}`).join('\n')}\n`+
    `Rewrite the branch so no commit adds these files (for example, rebuild it from ${opts.base} with only reviewed files), then push.\n`);
  process.exitCode=1;
}else{
  process.stdout.write('raw-guard.mjs: nothing raw in the outgoing commits\n');
}
