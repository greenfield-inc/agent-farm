/** The allowlist check for profile photos (T-83 §5). An SVG passes only when every part of it is understood and
 *  harmless; when in doubt it refuses. Pane shows photos only as <img>, which runs no script and loads nothing,
 *  as a second guard. No dependency: a small tokenizer, not an XML parser, because anything it cannot read fails. */
export const photoLimit=64*1024;
const elements=new Set(['svg','g','defs','title','desc','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','linearGradient','radialGradient','stop','style','use']);
const named:Record<string,string>={script:'a <script> element',foreignObject:'a <foreignObject> element',image:'an <image> element',iframe:'an <iframe> element',a:'an <a> link'};
const entities=/&(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g;
const externalUrl=/url\(\s*(?!['"]?#)/i;

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
  if(inStyle&&(/@import/i.test(between)||externalUrl.test(between)))fail('its <style> uses @import or an external url(');
  if(next<0){if(between.trim()&&!stack.length)fail('it has text outside the <svg> element');break;}
  if(!stack.length&&root&&rest.slice(next).trim())fail('it has content after the <svg> element');
  tag.lastIndex=next;const match=tag.exec(rest);if(!match)fail('it has markup that is not a plain element tag');
  const [whole,closing,tagName,attributes,selfClosing]=match!,name=tagName!;index=next+whole.length;
  if(closing){if(stack.pop()!==name)fail(`its </${name}> does not close the open element`);if(name==='style')inStyle=false;continue;}
  if(named[name])fail(`it has ${named[name]}`);
  if(!elements.has(name))fail(`it has a <${name}> element; photos allow only shapes, paths, text, groups, gradients, <title>, <defs>, <style> and internal <use>`);
  if(!root){root=name;if(name!=='svg')fail('its root element is not <svg>');}else if(!stack.length)fail('it has more than one root element');
  for(const a of attributes!.matchAll(attribute)){
   const key=a[1]!,value=a[2]??a[3]??'',lower=key.toLowerCase();
   if(lower.startsWith('on'))fail(`it has an event attribute ${key}`);
   if(value.replace(entities,'').includes('&'))fail(`its ${key} attribute uses an entity`);
   if((lower==='href'||lower.endsWith(':href'))&&!value.startsWith('#'))fail(`its ${key} points outside the file (${value.slice(0,60)})`);
   if(externalUrl.test(value)||/javascript:/i.test(value))fail(`its ${key} attribute loads an external url(`);
   if(lower==='style'&&/@import/i.test(value))fail('a style attribute uses @import');
   if(name==='svg'&&stack.length===0&&key==='viewBox')viewBox=true;
  }
  if(!selfClosing){stack.push(name);if(name==='style')inStyle=true;}
  else if(!stack.length)fail('its root <svg> element is empty');
 }
 if(!root)fail('it has no <svg> element (photos are SVG only)');
 if(stack.length)fail(`its <${stack.at(-1)}> element is never closed`);
 if(!viewBox)fail('its root <svg> has no viewBox');
}
