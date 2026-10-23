'use strict';
// PC Bridge TV Pointer Pilot. Separate from working 43196 TV cast server.
// A temporary LAN token can control only the mouse: click, scroll, or position.
// No keyboard, shell, app launch, file writes, or Codex submit endpoint.
const http=require('node:http');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process');
const {getFrame,metrics:previewMetrics}=require('./snapshot.cjs');
const {SpeakerRouter}=require('./speaker-routing.cjs');
const speakerRouter=new SpeakerRouter();
const SETTINGS=process.env.IM_ACCESSIBILITY_CONFIG_PATH!==undefined
 ?require('../release-config.cjs').readUserSettings():null;
const ROOT=__dirname,LAN=SETTINGS?SETTINGS.network.ip:'192.168.4.36',PORT=43198;
const ORIGIN='http://'+LAN+':'+PORT,UPSTREAM_DIR=path.resolve(ROOT,'../cast');
const SOURCE_FILE=path.join(UPSTREAM_DIR,'runtime','private-access.json');
const NATIVE=path.join(ROOT,'native','TvPointer.exe'),EVIDENCE=path.join(ROOT,'evidence');
const STOP_SIGNAL=path.resolve(ROOT,'../runtime/stop-request.json');
const EXPIRES_MS=4*60*60*1000;
const token=crypto.randomBytes(32).toString('hex'),began=Date.now(),expiresAt=began+EXPIRES_MS;
let enabled=false,enabledUntil=0,lastActionAt=0,inputsThisMinute=0,minuteStart=Date.now(),actions=0;
let revoked=false,lastReceipt=null,sourceUrl=null,sourceExpires=0;
let primaryScreen=null;
fs.mkdirSync(EVIDENCE,{recursive:true});
function sameSubnet(address){
 if(typeof address!=='string')return false;
 if(address.startsWith('::ffff:'))address=address.slice(7);
 if(SETTINGS)return address==='127.0.0.1'||address==='::1'||
   require('../release-config.cjs').subnet(address,LAN,SETTINGS.network.mask);
 return address==='127.0.0.1'||address===LAN||address.startsWith('192.168.4.')||address.startsWith('192.168.5.')||address.startsWith('192.168.6.')||address.startsWith('192.168.7.');
}
function active(){return !revoked&&Date.now()<expiresAt;}
function available(){return active()&&enabled&&Date.now()<enabledUntil;}
function tokenMatches(value){return typeof value==='string'&&value.length===token.length&&crypto.timingSafeEqual(Buffer.from(value),Buffer.from(token));}
function safelyReadUpstream(){
 if(!fs.existsSync(SOURCE_FILE))throw Error('Existing TV cast source is not active');
 const info=JSON.parse(fs.readFileSync(SOURCE_FILE,'utf8'));
 if(!info.receiverUrl||Date.now()>=Date.parse(info.expiresAt))throw Error('Original source session has expired');
 const u=new URL(info.receiverUrl);
 if(u.protocol!=='http:'||u.hostname!==LAN||u.port!=='43196'||!/^\/tv\/[a-f0-9]{48}$/.test(u.pathname))throw Error('Unexpected original receiver origin');
 sourceExpires=Date.parse(info.expiresAt);
 sourceUrl='http://'+LAN+':43196/media/'+u.pathname.slice(4)+'/';
}
function json(res,code,body){
 res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Access-Control-Allow-Origin':ORIGIN});
 res.end(JSON.stringify(body));
}
function asset(res,file,type){
 const p=path.join(ROOT,'web',file),b=fs.readFileSync(p);
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; media-src 'self' blob:; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});
 res.end(b);
}
function isValidCoord(n){return Number.isInteger(n)&&n>=0&&n<=10000}
function receiptInput(cmd,x,y,delta) {
 let args=[];
 if(cmd==='click'||cmd==='move'){
  if(!isValidCoord(x)||!isValidCoord(y))throw Error('Invalid bounded x/y');
  args=[cmd,String(x),String(y)];
 }else if(cmd==='wheel'){
  if(!Number.isInteger(delta)||delta===0||Math.abs(delta)>3||!isValidCoord(x)||!isValidCoord(y))throw Error('Invalid wheel delta or coordinates');
  args=['wheel',String(delta),String(x),String(y)];
 }else throw Error('Unsupported input');
 const result=cp.spawnSync(NATIVE,args,{encoding:'utf8',windowsHide:true,timeout:4000,maxBuffer:5000});
 if(result.status!==0)throw Error('Native input unavailable: '+String(result.stderr||result.error?.message||'error').slice(0,110));
 const parsed=JSON.parse(result.stdout);
 const exactDisplay=SETTINGS
  ?primaryScreen&&parsed.width===primaryScreen.width&&parsed.height===primaryScreen.height
  :parsed.width===1920&&parsed.height===1080;
 if(!parsed.ok||!exactDisplay||parsed.action!==cmd)throw Error('Mouse input verification failed');
 return {action:cmd,x,y,delta,windowsX:parsed.cursorX,windowsY:parsed.cursorY,at:new Date().toISOString()};
}
function consume(input){
 if(!available())throw Error('Controls disabled or expired');
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid input payload');
 const allowed=new Set(['cmd','x','y','delta']);
 if(Object.keys(input).some(k=>!allowed.has(k)))throw Error('Unexpected input fields');
 if(Date.now()-lastActionAt<250)throw Error('Input rate limit: wait');
 if(Date.now()-minuteStart>60000){minuteStart=Date.now();inputsThisMinute=0}
 if(inputsThisMinute>=45)throw Error('One-minute input limit');
 const result=receiptInput(input.cmd,input.x,input.y,input.delta);
 lastActionAt=Date.now();inputsThisMinute++;actions++;lastReceipt=result;
 fs.appendFileSync(path.join(EVIDENCE,'mouse-actions.jsonl'),JSON.stringify(result)+'\n',{flag:'a'});
 return {ok:true,receipt:result};
}
async function sourceAudioInfo(){
 if(!sourceUrl||Date.now()>=sourceExpires)return {available:false,deviceIdHash:null};
 try{
  const r=await fetch('http://'+LAN+':43196/health',{signal:AbortSignal.timeout(950),redirect:'error'});
  if(!r.ok)return {available:false,deviceIdHash:null};
  const result=await r.json();
  const hash=result.audioDeviceIdHash;
  const available=result.ok===true&&result.audioEnabled===true&&result.stream==='running'&&
   typeof hash==='string'&&/^[0-9a-f]{64}$/.test(hash);
  return {available,deviceIdHash:available?hash:null};
 }catch{return {available:false,deviceIdHash:null}}
}
async function sourceAudio(){return (await sourceAudioInfo()).available}
function state(){return{receiver:'PC Bridge Interactive TV v0.1',
 screen:SETTINGS?(primaryScreen?primaryScreen.width+'x'+primaryScreen.height:'pending native verification'):'1920x1080',
 stream:'1280x720 H.264',
 enabled:available(),canArm:active(),expiresAt:new Date(expiresAt).toISOString(),
 armedUntil:available()?new Date(enabledUntil).toISOString():null,actions,lastAction:lastReceipt,
 sourceReady:!!sourceUrl&&Date.now()<sourceExpires,preview:previewMetrics()}};
async function getBody(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Error('JSON content type required');
 let s='',size=0;for await(const c of req){size+=c.length;if(size>512)throw Error('JSON too large');s+=c}
 return JSON.parse(s);
}
async function proxy(res,name){
 if(!sourceUrl||Date.now()>sourceExpires)return json(res,503,{error:'Source session ended'});
 try{
  const r=await fetch(sourceUrl+name,{cache:'no-store',signal:AbortSignal.timeout(3500),redirect:'error'});
  if(!r.ok)return json(res,503,{error:'Upstream video not ready'});
  const buf=Buffer.from(await r.arrayBuffer());
  if(buf.length>1024*1024)return json(res,503,{error:'Oversized media response'});
  res.writeHead(200,{'Content-Type':name.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t',
   'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
  res.end(buf);
 }catch(e){return json(res,503,{error:'Desktop streaming service not available'})}
}
function createServer(){
 return http.createServer(async(req,res)=>{
  try{
   if(!sameSubnet(req.socket.remoteAddress))return json(res,403,{error:'LAN only'});
   if(req.headers.host!==LAN+':'+PORT)return json(res,403,{error:'Wrong host'});
   const u=new URL(req.url,ORIGIN);
   if(u.search)return json(res,404,{error:'Not found'});
   const route=u.pathname;
   if(req.method==='GET'&&route==='/health')return json(res,200,{service:'interactive-tv',build:'tv-resume-v0.5',ready:active(),sourceReady:state().sourceReady});
   if(req.method==='GET'&&route==='/tv/'+token){
    if(!active())return json(res,410,{error:'Session expired'});
    return asset(res,'viewer.html','text/html; charset=utf-8');
   }
   // Optional minimal full-viewport browser HTML page. Original /tv/ page is unchanged.
   // The same time-limited viewer key protects both routes and their HLS/media APIs.
   if(req.method==='GET'&&route==='/full/'+token){
    if(!active())return json(res,410,{error:'Session expired'});
    return asset(res,'immersive.html','text/html; charset=utf-8');
   }
   if(req.method==='GET'&&route==='/immersive.js')return asset(res,'immersive.js','text/javascript; charset=utf-8');
   if(req.method==='GET'&&route==='/immersive.css')return asset(res,'immersive.css','text/css; charset=utf-8');
   if(req.method==='GET'&&route==='/viewer.js')return asset(res,'viewer.js','text/javascript; charset=utf-8');
   if(req.method==='GET'&&route==='/style.css')return asset(res,'style.css','text/css; charset=utf-8');
   // Static JPEG preview of the same HLS source, independently clickable by LG Magic Remote.
   const frameRoute=route.match(/^\/frame\/([a-f0-9]{64})\/([0-9]{1,10})\.jpg$/);
   if(req.method==='GET'&&frameRoute){
    if(!active()||frameRoute[1]!==token)return json(res,403,{error:'Private preview key required'});
    if(!sourceUrl||Date.now()>sourceExpires)return json(res,503,{error:'Desktop source not active'});
    try{
     const frame=await getFrame();
     res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'X-Frame-Segment-Age-Ms':String(Math.max(0,Date.now()-frame.segmentTimeMs)),
      'X-Frame-Encode-Ms':String(frame.decodeMs),
      'Cross-Origin-Resource-Policy':'same-origin'});
     return res.end(frame.image);
    }catch(e){return json(res,503,{error:'Frame preview temporarily unavailable'})}
   }
   const media=route.match(/^\/media\/([a-f0-9]{64})\/(index\.m3u8|segment\d{6}\.ts)$/);
   if(req.method==='GET'&&media){if(!active()||media[1]!==token)return json(res,403,{error:'No video permission'});return await proxy(res,media[2])}
   if(!route.startsWith('/api/'))return json(res,404,{error:'Not found'});
   const auth=(req.headers.authorization||'').replace(/^Bearer /,'');
   if(!tokenMatches(auth)||!active())return json(res,401,{error:'Viewer permission required'});
   if(req.method==='GET'&&route==='/api/status')return json(res,200,{...state(),audioAvailable:await sourceAudio(),...speakerRouter.snapshot()});
   if(req.method!=='POST')return json(res,405,{error:'Method denied'});
   if(req.headers.origin&&req.headers.origin!==ORIGIN)return json(res,403,{error:'Origin denied'});
   if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Cross-site request denied'});
   const input=await getBody(req);
   if(route==='/api/audio-route'){
    if(!input||Object.keys(input).length!==1||typeof input.mode!=='string')
     throw Error('One explicit audio destination is required');
    const audio=await sourceAudioInfo();
    if(input.mode!=='laptop-only'&&!audio.available)
     return json(res,409,{error:'Windows desktop audio is not available'});
    const result=speakerRouter.setMode(input.mode,audio.deviceIdHash);
    return json(res,200,{ok:true,...result});
   }
   if(route==='/api/audio-heartbeat'){
    if(!input||Object.keys(input).length!==0)throw Error('No arguments');
    if(!(await sourceAudio())){
     speakerRouter.restore();
     return json(res,409,{error:'TV audio source stopped; laptop playback restored'});
    }
    return json(res,200,{ok:true,...speakerRouter.pulse()});
   }
   if(route==='/api/arm'){
    if(input?.confirm!==true||Object.keys(input).length!==1)throw Error('Explicit click to enable required');
    enabled=true;enabledUntil=Math.min(expiresAt,Date.now()+10*60*1000);
    return json(res,200,state());
   }
   if(route==='/api/disarm'){
    if(!input||Object.keys(input).length!==0)throw Error('No arguments');
    enabled=false;return json(res,200,state());
   }
   if(route==='/api/end'){
    if(!input||Object.keys(input).join(',')!=='confirm'||input.confirm!==true)throw Error('Explicit end-session confirmation required');
    fs.writeFileSync(STOP_SIGNAL,JSON.stringify({reason:'owner-pressed-stop',requestedAtUtc:new Date().toISOString()})+'\n',{flag:'wx'});
    enabled=false;speakerRouter.restore();return json(res,200,{accepted:true,message:'PC Bridge TV session stopping'});
   }
   if(route==='/api/mouse')return json(res,200,consume(input));
   return json(res,404,{error:'Not found'});
  }catch(e){if(!res.headersSent)json(res,400,{error:String(e.message||e).slice(0,150)});else res.destroy()}
 });
}
async function serve(){
 safelyReadUpstream();
 // Recover a previous crashed session's speaker state before opening new control.
 const old=speakerRouter.recover();
 if(!old.recovered)console.error('SPEAKER_RESTORE_PENDING: '+old.reason);
 const native=cp.spawnSync(NATIVE,['status'],{encoding:'utf8',windowsHide:true,timeout:3500});
 if(native.status!==0)throw Error('Mouse driver unavailable');
 const details=JSON.parse(native.stdout);
 const bounded=Number.isInteger(details.width)&&details.width>=640&&details.width<=8192&&
  Number.isInteger(details.height)&&details.height>=480&&details.height<=4320;
 if(SETTINGS?!bounded:(details.width!==1920||details.height!==1080))
  throw Error('Desktop resolution unavailable or unsupported; no input allowed');
 primaryScreen={width:details.width,height:details.height};
 const upstream=await fetch('http://'+LAN+':43196/health',{signal:AbortSignal.timeout(4000)});if(!upstream.ok)throw Error('Original desktop video receiver unavailable');
 const srv=createServer();
 await new Promise((resolve,reject)=>{srv.once('error',reject);srv.listen(PORT,LAN,resolve)});
 const url=ORIGIN+'/tv/'+token;
 fs.writeFileSync(path.join(ROOT,'runtime','session.json'),JSON.stringify({
  createdAt:new Date(began).toISOString(),expiresAt:new Date(expiresAt).toISOString(),
  url,port:PORT,sourcePort:43196,control:'mouse-only, opt-in on TV, 10-minute arm',sourceExpires:new Date(sourceExpires).toISOString()
 },null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({ready:true,port:PORT,expiresAt:new Date(expiresAt).toISOString(),url}));
 const maintenance=setInterval(async()=>{
  try{
   if(!active()||!(await sourceAudio()))speakerRouter.restore();
   else speakerRouter.expire();
  }catch(e){console.error('SPEAKER_ROUTING_CHECK '+String(e.message).slice(0,90))}
 },3100);maintenance.unref();
 function shutdown(){
  revoked=true;enabled=false;clearInterval(maintenance);
  speakerRouter.restore();
  try{srv.close()}catch{}
 }
 process.once('SIGTERM',shutdown);
 process.once('SIGINT',shutdown);
 srv.once('close',()=>{clearInterval(maintenance);speakerRouter.restore()});
 const expire=setTimeout(shutdown,EXPIRES_MS);expire.unref();
}
if(require.main===module){
 if(process.env.IM_ACCESSIBILITY_CONFIG_PATH===undefined){
  console.error('IM_ACCESSIBILITY_CONFIG_REQUIRED: mouse viewer will not start without validated settings');
  process.exitCode=1;
 }else serve().catch(e=>{console.error('TV_POINTER_SERVICE_FAILED '+e.message);process.exitCode=1});
}
module.exports={createServer,consume,state,isValidCoord,tokenMatches,sameSubnet,receiptInput};
