'use strict';
// PC Bridge TV Cast Pilot, isolated from the installed bridge. LAN-only MPEG-TS HLS.
// The TV receives its own stream, independent of the iPhone Safari page.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),
 cp=require('node:child_process'),crypto=require('node:crypto');
const {LAN_IP,PORT,isLocalIp}=require('./lan.cjs');
const {discover}=require('./tv-discovery.cjs');
const {launchTv}=require('./lg-launch.cjs');
const SOUND=require('./sound.cjs');
const VIEWING=require('../viewing-policy.cjs');
const ROOT=__dirname,RUNTIME=path.join(ROOT,'runtime'),SEGMENTS=path.join(RUNTIME,'stream');
const FFMPEG=process.env.IM_ACCESSIBILITY_CONFIG_PATH!==undefined
 ?require('../release-config.cjs').readUserSettings().executables.ffmpegExe
 :(process.env.PC_BRIDGE_FFMPEG_EXE||'ffmpeg');
const WEB=path.join(ROOT,'web'),MAX_MS=VIEWING.maxMs(),created=Date.now(),expiresAt=VIEWING.deadline(created);
// Capture speaker output only when explicitly selected with Start with Sound.
const WANT_AUDIO=SOUND.isAudioOptIn(process.env.IM_ACCESSIBILITY_TV_AUDIO);
const controlKey=crypto.randomBytes(24).toString('hex'),watchKey=crypto.randomBytes(24).toString('hex');
const ctrlOrigin='http://'+LAN_IP+':'+PORT;
let capture=null,captureState='stopped',capturePid=null,captureError=null,
 captureStarted=null,watchHits=0,lastWatchAt=null,lgState='idle',lastDeviceIp=null;
let audioChild=null,audioDeviceIdHash=null,audioState=WANT_AUDIO?'pending':'off',audioError=null,
    ownerStopped=false,recoveryTried=false;
// Detect a blocked encoder even when FFmpeg's process is still alive.
const MAX_MANIFEST_AGE_MS=8500,STARTUP_GRACE_MS=14000,RECOVERY_WINDOW_MS=120000;
let nextSegment=0,pendingRestart=null,recoveries=[],recoveryCount=0,
 lastRecoveryReason=null,lastRecoveryUtc=null,captureFormat=null;
fs.mkdirSync(SEGMENTS,{recursive:true});
function atomic(file,obj){
 const temp=file+'.'+process.pid+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(obj,null,2)+'\n');
 fs.renameSync(temp,file);
}
function manifestAgeMs(dir=SEGMENTS,now=Date.now()){
 try{return Math.max(0,now-fs.statSync(path.join(dir,'index.m3u8')).mtimeMs)}
 catch{return null}
}
function shouldRecover({alive,ageMs,sinceStartMs,recovering=false}){
 return !!alive&&!recovering&&Number.isFinite(ageMs)&&ageMs>MAX_MANIFEST_AGE_MS&&
  Number.isFinite(sinceStartMs)&&sinceStartMs>STARTUP_GRACE_MS;
}
function status(){
 const manifest=path.join(SEGMENTS,'index.m3u8'),exists=fs.existsSync(manifest);
 const streamAgeMs=manifestAgeMs();
 let lastModified=null,segmentCount=0;
 try{if(exists)lastModified=fs.statSync(manifest).mtime.toISOString();
  segmentCount=fs.readdirSync(SEGMENTS).filter(x=>/^segment\d{6}\.ts$/.test(x)).length;}catch{}
 return {mode:'LAN-direct-TV-receiver',source:'Windows desktop',state:captureState,pid:capturePid,
   captureStarted,streamReady:exists&&captureState==='running'&&streamAgeMs!==null&&streamAgeMs<8000,lastManifestModified:lastModified,
   streamAgeMs:streamAgeMs===null?null:Math.round(streamAgeMs),recoveryCount,lastRecoveryUtc,lastRecoveryReason,
   segments:segmentCount,resolution:'1280 x 720',targetFps:15,watchHits,lastWatchAt,phoneIndependent:true,
   expiresAt:VIEWING.iso(expiresAt),viewingMode:VIEWING.MODE,lgState,lastDeviceIp,LAN_IP,port:PORT,receiverUrl:ctrlOrigin+'/tv/'+watchKey,
   error:captureError,audioRequested:WANT_AUDIO,audioState,audioEnabled:audioState==='active'&&captureAlive(),
   audioDeviceIdHash:audioState==='active'?audioDeviceIdHash:null,audioError};
}
function clearSegments(){
 for(const name of fs.readdirSync(SEGMENTS)){
  const segment=name.match(/^segment(\d{6})\.ts$/);
  if(segment)nextSegment=Math.max(nextSegment,Number(segment[1])+1);
  if(/^(?:segment\d{6}\.ts|index\.m3u8|index\.m3u8\.tmp)$/.test(name))
   try{fs.unlinkSync(path.join(SEGMENTS,name))}catch{}
 }
}
function captureAlive(){return !!capture&&capture.exitCode===null&&!capture.killed;}
function safeEndAudio(child){
 if(!child)return;
 try{child.kill('SIGTERM')}catch{}
}
function spawnCapture(format=null){
 captureState='starting';captureError=null;captureStarted=new Date().toISOString();
 captureFormat=format;
 const args=SOUND.argsFor(SEGMENTS,format,nextSegment);
 const ff=cp.spawn(FFMPEG,args,{cwd:ROOT,windowsHide:true,
  stdio:format?['ignore','ignore','pipe','pipe']:['ignore','ignore','pipe']});
 capture=ff;capturePid=ff.pid||null;captureState='running';
 audioState=format?'active':WANT_AUDIO?(audioError?'fallback':'unavailable'):'off';
 audioDeviceIdHash=format?format.deviceIdHash:null;
 let errors='',thisAudio=null;
 ff.stderr.on('data',b=>{errors=(errors+String(b)).slice(-1200)});
 function fallback(message){
  if(ownerStopped||pendingRestart||capture!==ff||!format||recoveryTried)return;
  recoveryTried=true;audioError=String(message||'speaker output stopped').slice(0,140);
  audioState='fallback';
  try{ff.kill('SIGTERM')}catch{}
 }
 ff.once('error',err=>{
  captureError=String(err.message).slice(0,160);
  if(format)fallback('Audio/video encoder launch failure');
  else captureState='failed';
 });
 if(format){
  // Audio subprocess has only stdout PCM and stderr diagnostics.
  thisAudio=cp.spawn(SOUND.BINARY,['--capture','--device-hash',format.deviceIdHash],{cwd:ROOT,windowsHide:true,
   stdio:['ignore','pipe','pipe']});
  audioChild=thisAudio;
  let err='';
  thisAudio.stderr.on('data',b=>{err=(err+String(b)).slice(-500)});
  thisAudio.once('error',failure=>fallback('Speaker loopback unavailable: '+String(failure.message).slice(0,80)));
  thisAudio.once('exit',code=>fallback('Speaker loopback stopped: '+code+' '+err.slice(-80)));
  thisAudio.stdout.pipe(ff.stdio[3]);
 }
 ff.once('exit',(code,signal)=>{
  if(capture!==ff)return;
  capture=null;capturePid=null;
  if(thisAudio){
   try{thisAudio.stdout.unpipe(ff.stdio[3])}catch{}
   if(audioChild===thisAudio)audioChild=null;
   safeEndAudio(thisAudio);
  }
  const watchRecovery=pendingRestart;
  if(watchRecovery)pendingRestart=null;
  if(watchRecovery&&!ownerStopped&&VIEWING.active(expiresAt)){
   captureState='recovering';captureError=null;
   setTimeout(()=>{
    if(ownerStopped||capture||!VIEWING.active(expiresAt))return;
    try{clearSegments();spawnCapture(watchRecovery.format)}
    catch(e){captureState='failed';captureError=String(e.message).slice(0,180)}
   },350);
   return;
  }
  // Unexpected FFmpeg exits should recover desktop video automatically as well.
  // Bound consecutive attempts to avoid a rapid encoder crash/restart loop.
  if(!ownerStopped&&VIEWING.active(expiresAt)){
   const now=Date.now();
   recoveries=recoveries.filter(t=>now-t<RECOVERY_WINDOW_MS);
   if(recoveries.length<4){
    recoveries.push(now);recoveryCount++;
    lastRecoveryUtc=new Date(now).toISOString();
    lastRecoveryReason='FFmpeg exited unexpectedly '+String(code)+'/'+String(signal);
    const nextFormat=format?null:captureFormat;
    if(format){recoveryTried=true;audioState='fallback';
     audioError='Audio/video encoder exited; recovering desktop video without sound'}
    captureState='recovering';captureError=null;
    setTimeout(()=>{
     if(ownerStopped||capture||!VIEWING.active(expiresAt))return;
     try{clearSegments();spawnCapture(nextFormat)}
     catch(e){captureState='failed';captureError=String(e.message).slice(0,180)}
    },450);
    return;
   }
   captureError='Too many encoder exits; automatic recovery paused';
  }
  captureState='stopped';
  if(!captureError)captureError=code===0?null:('FFmpeg stopped '+code+'/'+signal+' '+errors.slice(-120)).slice(0,200);
 });
 return status();
}
function startCapture(){
 if(!VIEWING.active(expiresAt))throw Error('Receiver session has expired');
 if(captureAlive())return status();
 if(!fs.existsSync(FFMPEG))throw Error('Pinned FFmpeg executable is missing');
 ownerStopped=false;recoveryTried=false;
 let format=null;audioError=null;
 if(WANT_AUDIO){
  try{format=SOUND.probe()}
  catch(e){audioError=String(e.message).slice(0,140);audioState='unavailable'}
 }
 clearSegments();
 return spawnCapture(format);
}
function stopCapture(){
 ownerStopped=true;pendingRestart=null;
 safeEndAudio(audioChild);audioChild=null;
 if(capture)try{capture.kill('SIGTERM')}catch{}
 captureState='stopped';audioState='off';audioDeviceIdHash=null;
 return status();
}
function watchdogTick(now=Date.now()){
 if(ownerStopped||captureState!=='running'||pendingRestart||!captureAlive())return false;
 const ageMs=manifestAgeMs(SEGMENTS,now);
 const sinceStartMs=now-Date.parse(captureStarted);
 if(!shouldRecover({alive:true,ageMs,sinceStartMs}))return false;
 recoveries=recoveries.filter(t=>now-t<RECOVERY_WINDOW_MS);
 if(recoveries.length>=4){
  // A repeatedly failing machine should not be restarted in an infinite tight loop.
  captureError='Repeated video stalls; recovery paused for cooldown';
  return false;
 }
 const audioTooUnstable=!!captureFormat&&recoveries.length>0;
 if(audioTooUnstable){
  audioError='Repeated A/V stalls; video-only fallback to maintain desktop control';
  audioState='fallback';
 }
 const nextFormat=audioTooUnstable?null:captureFormat;
 pendingRestart={format:nextFormat};
 recoveries.push(now);recoveryCount++;lastRecoveryUtc=new Date(now).toISOString();
 lastRecoveryReason='No fresh HLS video segments for '+Math.round(ageMs/1000)+' seconds';
 captureState='recovering';
 console.warn('HLS_CAPTURE_STALL_AUTO_RECOVER '+lastRecoveryReason+
  ' recovery='+recoveryCount+' audio='+Boolean(nextFormat));
 safeEndAudio(audioChild);
 try{capture.kill('SIGTERM')}catch(e){captureError=String(e.message).slice(0,120)}
 return true;
}
function validMedia(p){
 const m=p.match(/^\/media\/([a-f0-9]{48})\/(index\.m3u8|segment[0-9]{6}\.ts)$/);
 return m&&m[1]===watchKey?m[2]:null;
}
function equalToken(a,b){
 if(typeof a!=='string'||a.length!==b.length)return false;
 return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
function send(res,code,payload,type='application/json; charset=utf-8',extra={}){
 res.writeHead(code,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  'Content-Type':type,...extra});
 res.end(type.startsWith('application/json')?JSON.stringify(payload):payload);
}
async function body(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Error('JSON body required');
 let bytes=0,value='';for await(const part of req){bytes+=part.length;if(bytes>2048)throw Error('Request too large');value+=part}
 return JSON.parse(value);
}
function makeServer(){
 const server=http.createServer(async(req,res)=>{
  try{
   if(!isLocalIp(req.socket.remoteAddress))return send(res,403,{error:'LAN only'});
   const allowedHosts=new Set([LAN_IP+':'+PORT,'127.0.0.1:'+PORT,'localhost:'+PORT]);
   if(!allowedHosts.has(req.headers.host))return send(res,403,{error:'Host not allowed'});
   const u=new URL(req.url,ctrlOrigin);
   if(u.search)return send(res,404,{error:'Not found'});
   const route=u.pathname;
   if(req.method==='GET'&&route==='/health'){
    const h=status();
    return send(res,200,{ok:true,mode:'LAN TV receiver',build:'tv-resume-v0.5',
     stream:h.state,streamReady:h.streamReady,streamAgeMs:h.streamAgeMs,
     recoveryCount:h.recoveryCount,lastRecoveryUtc:h.lastRecoveryUtc,
     audioEnabled:h.audioEnabled&&h.streamReady,audioState:h.audioState,audioDeviceIdHash:h.audioDeviceIdHash});
   }
   if(req.method==='GET'&&route==='/controller')return send(res,200,fs.readFileSync(path.join(WEB,'controller.html')),'text/html; charset=utf-8');
   if(req.method==='GET'&&route==='/controller.js')return send(res,200,fs.readFileSync(path.join(WEB,'controller.js')),'application/javascript; charset=utf-8');
   if(req.method==='GET'&&route==='/tv.js')return send(res,200,fs.readFileSync(path.join(WEB,'tv.js')),'application/javascript; charset=utf-8');
   if(req.method==='GET'&&route==='/style.css')return send(res,200,fs.readFileSync(path.join(WEB,'style.css')),'text/css; charset=utf-8');
   if(req.method==='GET'&&route==='/')return send(res,200,'Open your private controller URL on the phone.','text/plain; charset=utf-8');
   if(req.method==='GET'&&route==='/tv/'+watchKey){
    watchHits++;lastWatchAt=new Date().toISOString();
    return send(res,200,fs.readFileSync(path.join(WEB,'tv.html')),'text/html; charset=utf-8');
   }
   if(req.method==='GET'&&route.startsWith('/media/')){
    const name=validMedia(route);
    if(!name)return send(res,403,{error:'Invalid receiver capability'});
    const file=path.join(SEGMENTS,name);
    if(!fs.existsSync(file))return send(res,404,{error:'Segment not ready'});
    watchHits++;lastWatchAt=new Date().toISOString();
    return send(res,200,fs.readFileSync(file),name.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t',
      {'Accept-Ranges':'bytes','Access-Control-Allow-Origin':ctrlOrigin});
   }
   if(!route.startsWith('/api/'))return send(res,404,{error:'Not found'});
   const token=(req.headers.authorization||'').replace(/^Bearer /,'');
   if(!equalToken(token,controlKey))return send(res,401,{error:'Private controller key required'});
   if(req.method==='GET'&&route==='/api/status')return send(res,200,status());
   if(req.method==='GET'&&route==='/api/devices')return send(res,200,{devices:await discover({durationMs:2300}),
     hint:'If your LG is powered on but not discovered, enter its local IP from TV Network Settings.'});
   if(req.method!=='POST'||req.headers.origin!==ctrlOrigin||req.headers['sec-fetch-site']==='cross-site')
    return send(res,403,{error:'Same-origin POST required'});
   const input=await body(req);
   if(route==='/api/start'){
    if(Object.keys(input).length)throw Error('No arguments accepted');
    return send(res,200,startCapture());
   }
   if(route==='/api/stop'){
    if(Object.keys(input).length)throw Error('No arguments accepted');
    return send(res,200,stopCapture());
   }
   if(route==='/api/launch-lg'){
    if(!input||Object.keys(input).join(',')!=='ip'||typeof input.ip!=='string')
     throw Error('Only one TV IP may be supplied');
    if(captureState!=='running')throw Error('Start the stream first');
    lgState='connecting';lastDeviceIp=input.ip;
    const target=ctrlOrigin+'/tv/'+watchKey;
    // Set a definite upper bound: the browser controls the TV only after its pairing approval.
    try{const result=await launchTv(input.ip,target,ev=>{lgState=ev.state});
     lgState='launched';return send(res,200,result);
    }catch(e){lgState='pairing-or-launch-failed';throw e;}
   }
   return send(res,404,{error:'Not found'});
  }catch(e){if(!res.headersSent)send(res,400,{error:String(e.message||e).slice(0,180)});else res.destroy();}
 });
 server.requestTimeout=9000;server.headersTimeout=9000;server.keepAliveTimeout=4000;server.maxConnections=15;
 return server;
}
async function serve(){
 const server=makeServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,LAN_IP,resolve)});
 const file=path.join(RUNTIME,'private-access.json');
 atomic(file,{createdAt:new Date().toISOString(),expiresAt:VIEWING.iso(expiresAt),viewingMode:VIEWING.MODE,
  controllerUrl:ctrlOrigin+'/controller#key='+controlKey,
  receiverUrl:ctrlOrigin+'/tv/'+watchKey,lan:LAN_IP,port:PORT});
 console.log(JSON.stringify({state:'ready',LAN_IP,port:PORT,controllerUrl:ctrlOrigin+'/controller#key='+controlKey,
  receiverUrl:ctrlOrigin+'/tv/'+watchKey,expiresAt:VIEWING.iso(expiresAt),viewingMode:VIEWING.MODE}));
 let closed=false;
 const exit=()=>{
  if(closed)return;closed=true;stopCapture();server.close();
  try{fs.unlinkSync(file)}catch{}
 };
 process.once('SIGINT',exit);process.once('SIGTERM',exit);
 const monitor=setInterval(()=>{try{watchdogTick()}catch(e){console.warn('HLS_WATCHDOG_ERROR '+String(e.message).slice(0,110))}},1500);
 monitor.unref();
 server.once('close',()=>clearInterval(monitor));
 if(MAX_MS!==null){const timer=setTimeout(()=>{exit();},MAX_MS);timer.unref()}
}
if(require.main===module){
 if(process.env.IM_ACCESSIBILITY_CONFIG_PATH===undefined){
  console.error('IM_ACCESSIBILITY_CONFIG_REQUIRED: video cast will not start without validated settings');
  process.exitCode=1;
 }else serve().catch(e=>{console.error('TVCAST_FAILED '+e.message);process.exitCode=1});
}
module.exports={makeServer,status,startCapture,stopCapture,validMedia,equalToken,
 manifestAgeMs,shouldRecover,watchdogTick,MAX_MANIFEST_AGE_MS,LAN_IP,PORT};
