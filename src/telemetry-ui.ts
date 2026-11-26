import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {TelemetryStore,type QueryOptions} from './telemetry-query.js';
import {telemetryPage,telemetryBrowser,groupSessionsByWorktree,agentTimelineRows} from './telemetry-ui-page.js';
import {uiPage,managementBrowser} from './ui-page.js';
import {ProfileManager} from './profile-manager.js';

export async function startTelemetryUI(options:QueryOptions,port=0,management?:{configRoot:string;projectDirectory:string}){
  const store=new TelemetryStore(options),token=randomBytes(24).toString('hex');let origin='';
  const profiles=management?new ProfileManager(management.configRoot,management.projectDirectory):undefined;
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
    const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    if(req.headers.host!==new URL(origin).host||(req.headers.origin&&req.headers.origin!==origin)){send(403,{error:'Forbidden origin'});return;}
    if((req.url?.length??0)>8192){send(414,{error:'URL too long'});return;}
    let url:URL;try{url=new URL(req.url??'/',origin);}catch{send(400,{error:'Invalid URL'});return;}
    const prefix='/'+token+'/';
    if(!url.pathname.startsWith(prefix)){send(404,{error:'Not found'});return;}
    const route=url.pathname.slice(prefix.length);
    if(profiles&&route.startsWith('api/profiles/')){
      try{
        const action=route.slice('api/profiles/'.length);
        if(req.method==='GET'&&action==='list'){send(200,{profiles:profiles.list(),agents:profiles.agents(),project:management!.projectDirectory});return;}
        if(req.method==='GET'&&action==='get'){send(200,profiles.get(url.searchParams.get('name')??''));return;}
        // Checked again on every read; shown only as <img>, under a CSP that runs and loads nothing.
        if(req.method==='GET'&&action==='photo'){const photo=profiles.photo(url.searchParams.get('name')??'');res.writeHead(200,{'Content-Type':'image/svg+xml','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'",'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(photo);return;}
        if(req.method!=='POST'){send(405,{error:'Method not allowed'});return;}
        if(req.headers.origin!==origin||req.headers['x-agent-farm-ui']!=='1'||req.headers['content-type']!=='application/json'){send(403,{error:'Same-origin JSON request required'});return;}
        if(!['preview','save','duplicate','compose'].includes(action)){send(404,{error:'Not found'});return;}
        let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>96*1024){send(413,{error:'Request too large'});return;}chunks.push(chunk);}
        const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected an object');
        const allowed=action==='duplicate'?['name']:action==='compose'?['source','agent','model','reasoning','speed','args']:['name','source','revision'];if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Unknown profile fields');
        send(200,action==='compose'?profiles.compose(input):action==='duplicate'?profiles.duplicate(input.name):action==='preview'?profiles.preview(input):profiles.save(input));
      }catch(e){send(400,{error:(e as Error).message});}return;
    }
    if(req.method!=='GET'){send(405,{error:'Read only'});return;}
    if(route===''||route==='app.js'){res.writeHead(200,{'Content-Type':route?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});res.end(route?'('+telemetryBrowser.toString()+')('+groupSessionsByWorktree.toString()+','+agentTimelineRows.toString()+');'+(profiles?'('+managementBrowser.toString()+')();':''):profiles?uiPage:telemetryPage);return;}
    if(!route.startsWith('api/')){send(404,{error:'Not found'});return;}
    try{const args=JSON.parse(url.searchParams.get('args')??'{}');send(200,route==='api/explorer'?await store.explorer(args):route==='api/runs'?await store.runs(args):route==='api/conversation'?await store.conversation(args):await store.query(route.slice(4),args));}catch(e){send(400,{error:(e as Error).message});}
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{const address=server.address();if(!address||typeof address==='string')return reject(new Error('No listener'));origin='http://127.0.0.1:'+address.port;resolve();});});
  return {server,url:origin+'/'+token+'/'};
}
