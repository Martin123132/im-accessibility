'use strict';
// Optional direct low-latency MSE video transport. No separate TV app or Windows input.
// Default native HLS remains untouched and is the fallback. No source file recording.
// Only one authenticated, same-origin LG viewer can own this extra bounded capture.
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const {WebSocketServer}=require('../cast/node_modules/ws');
const SOUND=require('../cast/sound.cjs');
const MAX_MP4_BOX=4*1024*1024,MAX_PARSE_BYTES=9*1024*1024,MAX_WS_BUFFER=3*1024*1024;
const MIME='video/mp4; codecs="avc1.4d001f, mp4a.40.2"';
function encoderArgs(format){
 if(!format||!['f32le','s16le','s24le','s32le'].includes(format.sampleFormat)||
  !Number.isInteger(format.sampleRate)||format.sampleRate<8000||format.sampleRate>192000||
  !Number.isInteger(format.channels)||format.channels<1||format.channels>8)
  throw Error('Unverified Windows speaker loopback format');
 return ['-hide_banner','-loglevel','warning','-nostdin',
  '-f','gdigrab','-framerate','15','-draw_mouse','1','-i','desktop',
  '-thread_queue_size','512','-f',format.sampleFormat,'-ar',String(format.sampleRate),
  '-ac',String(format.channels),'-i','pipe:3',
  '-vf','scale=1280:-2','-map','0:v:0','-map','1:a:0',
  '-c:v','libx264','-preset','veryfast','-tune','zerolatency','-crf','28',
  '-pix_fmt','yuv420p','-profile:v','main','-level','3.1',
  '-g','8','-keyint_min','8','-sc_threshold','0',
  '-c:a','aac','-ac','2','-ar','48000','-b:a','128k',
  '-af','aresample=async=1:first_pts=0',
  '-movflags','+empty_moov+default_base_moof+frag_keyframe',
  '-frag_duration','500000','-flush_packets','1','-f','mp4','pipe:1'];
}
function createFragmentParser(emit){
 let pending=Buffer.alloc(0),initial=[],fragment=[],hasInit=false,haveMoof=false,initSent=0,fragments=0;
 function push(bytes){
  pending=Buffer.concat([pending,bytes]);
  if(pending.length>MAX_PARSE_BYTES)throw Error('Excess media buffering');
  while(pending.length>=8){
   const len=pending.readUInt32BE(0);
   if(len<8||len>MAX_MP4_BOX)throw Error('Invalid MP4 atom');
   if(pending.length<len)break;
   const type=pending.toString('ascii',4,8);
   const packet=pending.subarray(0,len);
   pending=pending.subarray(len);
   if(!hasInit){
    initial.push(packet);
    if(type==='moov'){hasInit=true;emit(Buffer.concat(initial),true);initial=[];initSent++}
    continue;
   }
   if(type==='moof')haveMoof=true;
   fragment.push(packet);
   if(type==='mdat'){
    if(!haveMoof)throw Error('Fragment missing moof metadata');
    emit(Buffer.concat(fragment),false);
    fragment=[];haveMoof=false;fragments++;
   }
  }
 }
 return {push,snapshot:()=>({initSent,fragments,pendingBytes:pending.length})};
}
function attach(server,{lan,port,origin,token,expiresAt,ffmpegExe,sameSubnet}){
 if(!fs.existsSync(ffmpegExe))throw Error('Pinned FFmpeg not available');
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Private viewer token required');
 const wss=new WebSocketServer({noServer:true,maxPayload:256,perMessageDeflate:false,clientTracking:true});
 let active=null,lastConnected=0;
 function closeStream(item,reason){
  if(!item||item.closed)return;
  item.closed=true;clearInterval(item.checker);
  try{item.audio?.stdout.unpipe(item.encoder?.stdio[3])}catch{}
  try{item.audio?.kill('SIGTERM')}catch{}
  try{item.encoder?.kill('SIGTERM')}catch{}
  try{if(item.ws.readyState<2)item.ws.close(1000,String(reason||'Stream ended').slice(0,95))}catch{}
  if(active===item)active=null;
 }
 function start(ws){
  const item={ws,closed:false,audio:null,encoder:null,lastMediaAt:Date.now(),bytes:0};
  active=item;
  try{
   const f=SOUND.probe();
   const argv=encoderArgs(f);
   item.encoder=cp.spawn(ffmpegExe,argv,{windowsHide:true,stdio:['ignore','pipe','pipe','pipe']});
   item.audio=cp.spawn(SOUND.BINARY,['--capture','--device-hash',f.deviceIdHash],
     {windowsHide:true,stdio:['ignore','pipe','pipe']});
   item.audio.stdout.pipe(item.encoder.stdio[3]);
   let stderr='';
   item.encoder.stderr.on('data',b=>{stderr=(stderr+String(b)).slice(-450)});
   item.audio.stderr.on('data',()=>{}); // no raw microphone or private device output
   const send=(payload,initial)=>{
    if(item.closed||ws.readyState!==1)return;
    if(ws.bufferedAmount>MAX_WS_BUFFER)throw Error('TV decode fell behind; returning to HLS');
    ws.send(payload,{binary:true});
    item.bytes+=payload.length;
    if(!initial)item.lastMediaAt=Date.now();
   };
   const parser=createFragmentParser(send);
   item.encoder.stdout.on('data',bytes=>{
    try{parser.push(bytes)}catch(e){console.warn('FAST_VIDEO_FORMAT '+String(e.message).slice(0,120));closeStream(item,'Video fallback')}
   });
   item.encoder.once('error',()=>closeStream(item,'Encoder unavailable'));
   item.encoder.once('exit',()=>closeStream(item,'Encoder stopped'));
   item.audio.once('error',()=>closeStream(item,'Speaker output unavailable'));
   item.audio.once('exit',()=>closeStream(item,'Speaker output stopped'));
   ws.on('message',()=>closeStream(item,'No input accepted'));
   ws.once('close',()=>closeStream(item,'TV disconnected'));
   ws.once('error',()=>closeStream(item,'TV socket error'));
   item.checker=setInterval(()=>{
    if(item.closed)return;
    if(Date.now()>=expiresAt||Date.now()-item.lastMediaAt>9500)
     closeStream(item,'Video timed out; use HLS');
   },1700);
   item.checker.unref();
  }catch(e){
   console.warn('FAST_VIDEO_START '+String(e.message).slice(0,100));
   closeStream(item,'Fast video unavailable');
  }
 }
 const handler=(req,socket,head)=>{
  const now=Date.now(),ip=req.socket.remoteAddress;
  if(!sameSubnet(ip)||req.headers.host!==lan+':'+port||req.headers.origin!==origin||
   req.url!=='/fast/'+token||now>=expiresAt||active||now-lastConnected<2500){
   socket.destroy();return;
  }
  lastConnected=now;
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
 };
 server.on('upgrade',handler);
 wss.on('connection',start);
 function shutdown(){
  if(active)closeStream(active,'Owner session ended');
  try{wss.close()}catch{}
 }
 server.once('close',shutdown);
 return {shutdown,active:()=>!!active,mime:MIME};
}
module.exports={MIME,encoderArgs,createFragmentParser,attach};
