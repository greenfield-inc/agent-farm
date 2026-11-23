#!/usr/bin/env node
// The product's memory lock: one run at a time changes working memory or takes a recorded host action.
// Uses only node: builtins.
//
//   node lock.mjs acquire --dir <memory folder> --owner <run id> [--wait <seconds>] [--stale <seconds>]
//   node lock.mjs release --dir <memory folder> --owner <run id>
//
// The lock is the directory <memory folder>/lock, created atomically, with owner.json naming the holder and
// when it last took or renewed the lock. acquire succeeds when the lock is free, already this owner's (which
// renews it), or stale: not renewed for --stale seconds (default 1800), so its holder is taken to have died.
// It retries every second for --wait seconds (default 120). Prints one JSON line.
// Exit 0 when this owner holds the lock; exit 2 when another live owner still holds it; exit 1 on bad usage.
import fs from 'node:fs';
import path from 'node:path';

function fail(message){
  process.stderr.write(`lock.mjs: ${message}\n`);
  process.exit(1);
}

const [command,...rest]=process.argv.slice(2);
const opts={dir:null,owner:null,wait:120,stale:1800};
for(let i=0;i<rest.length;i++){
  const key=rest[i].replace(/^--/,'');
  if(!(key in opts)||i+1>=rest.length)fail('usage: node lock.mjs acquire|release --dir <memory folder> --owner <run id> [--wait <s>] [--stale <s>]');
  opts[key]=['wait','stale'].includes(key)?Number(rest[++i]):rest[++i];
}
if(!['acquire','release'].includes(command)||!opts.dir||!opts.owner||!(opts.wait>=0)||!(opts.stale>0))fail('usage: node lock.mjs acquire|release --dir <memory folder> --owner <run id> [--wait <s>] [--stale <s>]');

const lock=path.join(opts.dir,'lock');
const takeover=path.join(opts.dir,'lock.takeover');
const ownerFile=path.join(lock,'owner.json');
const holder=()=>{try{return JSON.parse(fs.readFileSync(ownerFile,'utf8'));}catch{return null;}};
const claim=()=>fs.writeFileSync(ownerFile,`${JSON.stringify({owner:opts.owner,at:new Date().toISOString()})}\n`);
const age=info=>info?(Date.now()-Date.parse(info.at))/1000:Infinity;

function tryAcquire(){
  try{
    fs.mkdirSync(lock);
    claim();
    return true;
  }catch(error){
    if(error.code!=='EEXIST')throw error;
  }
  const info=holder();
  if(info?.owner===opts.owner){claim();return true;}
  // A lock whose owner.json is missing may be mid-creation; treat it as fresh until it is older than --stale.
  const since=info?age(info):(Date.now()-fs.statSync(lock).mtimeMs)/1000;
  if(since<opts.stale)return false;
  // Only the run that creates the takeover marker may replace a stale lock, so two takers cannot both win.
  try{fs.mkdirSync(takeover);}catch(error){
    if(error.code!=='EEXIST')throw error;
    if((Date.now()-fs.statSync(takeover).mtimeMs)/1000>=opts.stale)fs.rmSync(takeover,{recursive:true,force:true});
    return false;
  }
  try{
    const again=holder();
    if(again&&again.owner!==info?.owner)return false;
    fs.rmSync(lock,{recursive:true,force:true});
    fs.mkdirSync(lock);
    claim();
    return true;
  }finally{
    fs.rmSync(takeover,{recursive:true,force:true});
  }
}

fs.mkdirSync(opts.dir,{recursive:true});
if(command==='release'){
  const info=holder();
  const released=info?.owner===opts.owner;
  if(released)fs.rmSync(lock,{recursive:true,force:true});
  process.stdout.write(`${JSON.stringify({ok:true,released})}\n`);
}else{
  const deadline=Date.now()+opts.wait*1000;
  let held=tryAcquire();
  while(!held&&Date.now()<deadline){
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
    held=tryAcquire();
  }
  if(held){
    process.stdout.write(`${JSON.stringify({ok:true,owner:opts.owner})}\n`);
  }else{
    const info=holder();
    process.stdout.write(`${JSON.stringify({ok:false,holder:info?.owner??null,since:info?.at??null})}\n`);
    process.exitCode=2;
  }
}
