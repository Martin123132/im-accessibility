'use strict';
// PC Bridge TV Cast Pilot, isolated from the installed bridge. LAN-only MPEG-TS HLS.
// The TV receives its own stream, independent of the iPhone Safari page.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),
 cp=require('node:child_process'),crypto=require('node:crypto');
const {LAN_IP,PORT,isLocalIp}=require('./lan.cjs');
const {discover}=require('./tv-discovery.cjs');
const {launchTv}=require('./lg-launch.cjs');
const ROOT=__dirname,RUNTIME=path.join(ROOT,'runtime'),SEGMENTS=path.join(RUNTIME,'stream');
const FFMPEG=process.env.PC_BRIDGE_FFMPEG_EXE||'ffmpeg';
const WEB=path.join(ROOT,'web'),MAX_MS=4*60*60*1000,created=Date.now();
const controlKey=crypto.randomBytes(24).toString('hex'),watchKey=crypto.randomBytes(24).toString('hex');
const ctrlOrigin='http://'+LAN_IP+':'+PORT;
let capture=null,captureState='stopped',capturePid=null,captureError=null,
 captureStarted=null,watchHits=0,lastWatchAt=null,lgState='idle',lastDeviceIp=null;
fs.mkdirSync(SEGMENTS,{recursive:true});
function atomic(file,obj){
 const temp=file+'.'+process.pid+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(obj,null,2)+'\n');
 fs.renameSync(temp,file);
}
function status(){
 const manifest=path.join(SEGMENTS,'index.m3u8'),exists=fs.existsSync(manifest);
 let lastModified=null,segmentCount=0;
 try{if(exists)lastModified=fs.statSync(manifest).mtime.toISOString();
  segmentCount=fs.readdirSync(SEGMENTS).filter(x=>/^segment\d{6}\.ts$/.test(x)).length;}catch{}
 return {mode:'LAN-direct-TV-receiver',source:'Windows desktop',state:captureState,pid:capturePid,
   captureStarted,streamReady:exists&&captureState==='running'&&Date.now()-fs.statSync(manifest).mtimeMs<8000,lastManifestModified:lastModified,
   segments:segmentCount,resolution:'1280 x 720',targetFps:15,watchHits,lastWatchAt,phoneIndependent:true,
   expiresAt:new Date(created+MAX_MS).toISOString(),lgState,lastDeviceIp,LAN_IP,port:PORT,receiverUrl:ctrlOrigin+'/tv/'+watchKey,error:captureError};
}
function clearSegments(){
 for(const name of fs.readdirSync(SEGMENTS)){
  if(/^(?:segment\d{6}\.ts|index\.m3u8|index\.m3u8\.tmp)$/.test(name))
   try{fs.unlinkSync(path.join(SEGMENTS,name))}catch{}
 }
}
function captureAlive(){return !!capture&&capture.exitCode===null&&!capture.killed;}
function startCapture(){
 if(Date.now()>=created+MAX_MS)throw Error('Receiver session has expired');
 if(captureAlive())return status();
 if(!fs.existsSync(FFMPEG))throw Error('Pinned FFmpeg executable is missing');
 clearSegments();captureState='starting';captureError=null;captureStarted=new Date().toISOString();
 const args=['-hide_banner','-loglevel','warning','-nostdin','-f','gdigrab','-framerate','15','-draw_mouse','1',
   '-i','desktop','-vf','scale=1280:-2','-an','-c:v','libx264','-preset','veryfast','-tune','zerolatency',
   '-crf','28','-pix_fmt','yuv420p','-profile:v','main','-level','3.1','-g','15','-keyint_min','15','-sc_threshold','0',
   '-f','hls','-hls_time','1','-hls_list_size','6','-hls_delete_threshold','3',
   '-hls_flags','delete_segments+temp_file+independent_segments',
   '-hls_segment_filename',path.join(SEGMENTS,'segment%06d.ts'),path.join(SEGMENTS,'index.m3u8')];
 capture=cp.spawn(FFMPEG,args,{cwd:ROOT,windowsHide:true,stdio:['ignore','ignore','pipe']});
 capturePid=capture.pid||null;captureState='running';
 let err='';
 capture.stderr.on('data',b=>{err=(err+String(b)).slice(-1600)});
 capture.once('error',e=>{captureState='failed';captureError=String(e.message).slice(0,160);capturePid=null});
 capture.once('exit',(code,signal)=>{
  captureError=code===0?null:('FFmpeg stopped '+code+'/'+signal+' '+err.slice(-160)).slice(0,200);
  captureState='stopped';capturePid=null;capture=null;
 });
 return status();
}
function stopCapture(){
 if(capture){try{capture.kill('SIGTERM')}catch{}}
 captureState='stopped';return status();
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
   if(req.method==='GET'&&route==='/health')return send(res,200,{ok:true,mode:'LAN TV receiver',build:'tv-resume-v0.5',stream:status().state});
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
 atomic(file,{createdAt:new Date().toISOString(),expiresAt:new Date(created+MAX_MS).toISOString(),
  controllerUrl:ctrlOrigin+'/controller#key='+controlKey,
  receiverUrl:ctrlOrigin+'/tv/'+watchKey,lan:LAN_IP,port:PORT});
 console.log(JSON.stringify({state:'ready',LAN_IP,port:PORT,controllerUrl:ctrlOrigin+'/controller#key='+controlKey,
  receiverUrl:ctrlOrigin+'/tv/'+watchKey,expiresAt:new Date(created+MAX_MS).toISOString()}));
 let closed=false;
 const exit=()=>{
  if(closed)return;closed=true;stopCapture();server.close();
  try{fs.unlinkSync(file)}catch{}
 };
 process.once('SIGINT',exit);process.once('SIGTERM',exit);
 const timer=setTimeout(()=>{exit();},MAX_MS);timer.unref();
}
if(require.main===module)serve().catch(e=>{console.error('TVCAST_FAILED '+e.message);process.exitCode=1});
module.exports={makeServer,status,startCapture,stopCapture,validMedia,equalToken,LAN_IP,PORT};
