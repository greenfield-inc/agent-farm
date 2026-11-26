import fs from 'node:fs';
import path from 'node:path';
/** The allowlist check for profile photos (T-83 §5). An SVG passes only when every part of it is understood and
 *  harmless; when in doubt it refuses. Pane shows photos only as <img>, which runs no script and loads nothing,
 *  as a second guard. No dependency: a small tokenizer, not an XML parser, because anything it cannot read fails. */
export const photoLimit=64*1024;
const elements=new Set(['svg','g','defs','title','desc','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','linearGradient','radialGradient','stop','style','use']);
const named:Record<string,string>={script:'a <script> element',foreignObject:'a <foreignObject> element',image:'an <image> element',iframe:'an <iframe> element',a:'an <a> link'};
const entities=/&(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g;
const externalUrl=/url\(\s*(?!['"]?#)/i;
/** Text as a consumer reads it: the five XML entities and character references decoded, so `&#x75;rl(` is `url(`. */
const decoded=(text:string)=>text.replace(/&#x([0-9a-fA-F]{1,6});/g,(_,h)=>String.fromCodePoint(Math.min(parseInt(h,16),0x10ffff))).replace(/&#(\d{1,7});/g,(_,d)=>String.fromCodePoint(Math.min(Number(d),0x10ffff))).replace(/&(amp|lt|gt|quot|apos);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[n]!);
/** Why a style (a <style> body or a style attribute, decoded) is refused, or undefined. CSS escapes and comments
 *  could spell a load in pieces (`u\72l(`, `@im/**\/port`), so they are refused outright, with anything that loads. */
function styleProblem(css:string):string|undefined{
 if(css.includes('\\'))return 'a CSS escape';
 // A narrow grammar: plain selectors and declarations; no at-rules, escapes or comments.
 if(css.includes('@')&&!/@import/i.test(css))return 'an at-rule';
 
 if(css.includes('/*'))return 'a CSS comment';
 if(/@import/i.test(css))return '@import';
 if(externalUrl.test(css))return 'an external url(';
 if(/image-set\s*\(|\bsrc\s*\(/i.test(css))return 'image-set( or src(';
 const unknown=css.replace(/[\w\s#.,:;%()\-{}*>+~"'=!/]/g,'');if(unknown)return `the character ${JSON.stringify(unknown[0])}`;
 return undefined;
}

/** Throws with the reason when `content` is not an SVG photo Agent Farm accepts. */
export function checkSvg(content:Buffer|string,label='photo'):void{
 const bytes=typeof content==='string'?Buffer.from(content):content;
 const fail=(reason:string):never=>{throw new Error(`The ${label} is refused: ${reason}`);};
 if(bytes.length>photoLimit)fail(`it is ${bytes.length} bytes; the limit is ${photoLimit} (64 KB)`);
 let text:string;try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{text=fail('it is not UTF-8 text, so not an SVG (photos are SVG only)');}
 text=text.replace(/^﻿/,'');
 if(/<!DOCTYPE|<!ENTITY/i.test(text))fail('it has a DOCTYPE or entity declaration');
 if(/<!\[CDATA\[/i.test(text))fail('it has a CDATA section');
 text=text.replace(/^\s*<\?xml[^?]*\?>/,'');
 if(/<\?/.test(text))fail('it has a processing instruction');
 const rest=text.replace(/<!--[\s\S]*?-->/g,'');
 if(rest.includes('<!--'))fail('it has an unclosed comment');
 const tag=/<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=<>\/"']+(?:\s*=\s*(?:"[^"<]*"|'[^'<]*'))?)*)\s*(\/?)>/y;
 const attribute=/\s+([^\s=<>\/"']+)(?:\s*=\s*(?:"([^"<]*)"|'([^'<]*)'))?/g;
 const stack:string[]=[];let root:string|undefined,viewBox=false,index=0,inStyle=false;
 while(index<rest.length){
  const next=rest.indexOf('<',index);
  const between=rest.slice(index,next<0?rest.length:next);
  if(between.replace(entities,'').includes('&'))fail('it uses an entity other than the five XML ones or a character reference');
  if(inStyle){const problem=styleProblem(decoded(between));if(problem)fail(`its <style> uses ${problem}`);}
  if(next<0){if(between.trim()&&!stack.length)fail('it has text outside the <svg> element');break;}
  if(!stack.length&&root&&rest.slice(next).trim())fail('it has content after the <svg> element');
  tag.lastIndex=next;const match=tag.exec(rest);if(!match)fail('it has markup that is not a plain element tag');
  const [whole,closing,tagName,attributes,selfClosing]=match!,name=tagName!;index=next+whole.length;
  if(closing){if(stack.pop()!==name)fail(`its </${name}> does not close the open element`);if(name==='style')inStyle=false;continue;}
  if(named[name])fail(`it has ${named[name]}`);
  if(!elements.has(name))fail(`it has a <${name}> element; photos allow only shapes, paths, text, groups, gradients, <title>, <defs>, <style> and internal <use>`);
  if(!root){root=name;if(name!=='svg')fail('its root element is not <svg>');}else if(!stack.length)fail('it has more than one root element');
  const seen=new Set<string>();
  for(const a of attributes!.matchAll(attribute)){
   if(seen.has(a[1]!))fail(`it repeats the ${a[1]} attribute`);seen.add(a[1]!);
   const key=a[1]!,raw=a[2]??a[3]??'',value=decoded(raw),lower=key.toLowerCase();
   if(lower.startsWith('on'))fail(`it has an event attribute ${key}`);
   if(raw.replace(entities,'').includes('&'))fail(`its ${key} attribute uses an entity`);
   if(!/^[A-Za-z][\w:.-]*$/.test(key))fail(`it has an attribute named ${JSON.stringify(key.slice(0,40))}`);
   if(lower==='xml:base')fail('it sets xml:base');
   if((lower==='href'||lower.endsWith(':href'))&&!/^#[A-Za-z_][\w.-]*$/.test(value))fail(`its ${key} points outside the file (${value.slice(0,60)})`);
   if(/url\(/i.test(value)&&value.replace(/url\(\s*(['"]?)#[A-Za-z_][\w.-]*\1\s*\)/gi,'').match(/url\(/i))fail(`its ${key} attribute uses a url( that is not a #fragment`);
   if(externalUrl.test(value)||/javascript:/i.test(value))fail(`its ${key} attribute loads an external url(`);
   if(lower==='style'){const problem=styleProblem(value);if(problem)fail(`a style attribute uses ${problem}`);}
   if(name==='svg'&&stack.length===0&&key==='viewBox')viewBox=true;
  }
  if(!selfClosing){stack.push(name);if(name==='style')inStyle=true;}
  else if(!stack.length)fail('its root <svg> element is empty');
 }
 if(!root)fail('it has no <svg> element (photos are SVG only)');
 if(stack.length)fail(`its <${stack.at(-1)}> element is never closed`);
 if(!viewBox)fail('its root <svg> has no viewBox');
}

/** Reads a photo for checking or serving: a regular file (not a link), no larger than the limit, read through one
 *  descriptor, then checked. With `folder`, the file must also sit directly in that folder. */
export function readPhoto(file:string,label:string,folder?:string):Buffer{
 const fail=(reason:string):never=>{throw new Error(`The ${label} is refused: ${reason}`);};
 const status=fs.lstatSync(file,{throwIfNoEntry:false});
 if(!status)return fail(`${file} is missing`);
 if(status.isSymbolicLink()||!status.isFile())fail('it is not a regular file');
 if(status.size>photoLimit)fail(`it is ${status.size} bytes; the limit is ${photoLimit} (64 KB)`);
 if(folder&&path.dirname(fs.realpathSync(file))!==fs.realpathSync(folder))fail('it is not next to the profile');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
 try{
  const opened=fs.fstatSync(fd);if(!opened.isFile()||opened.size>photoLimit)fail('it changed while it was read');
  const buffer=Buffer.alloc(photoLimit+1),length=fs.readSync(fd,buffer,0,buffer.length,0);
  const content=buffer.subarray(0,length);checkSvg(content,label);return content;
 }finally{fs.closeSync(fd);}
}
