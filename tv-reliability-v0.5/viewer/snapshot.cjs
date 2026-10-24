'use strict';
// JPEG preview from the *existing* HLS stream, not a second desktop capture.
// Produces at most one bounded FFmpeg decode job at a time. Never writes frames to disk.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const SEGMENT_DIR=path.resolve(__dirname,'../cast/runtime/stream');
const FFMPEG=process.env.IM_ACCESSIBILITY_CONFIG_PATH!==undefined
 ?require('../release-config.cjs').readUserSettings().executables.ffmpegExe
 :(process.env.PC_BRIDGE_FFMPEG_EXE||'ffmpeg');
const MIN_INTERVAL_MS=1450,MAX_JPEG=700000,MAX_SEGMENT_AGE_MS=6000,ENCODE_TIMEOUT_MS=2700;
let cache=null,busy=null,successes=0,failures=0,lastError='',lastDecodeMs=0;
function isJpeg(b){return Buffer.isBuffer(b)&&b.length>1000&&b.length<MAX_JPEG&&b[0]===0xff&&b[1]===0xd8&&b[b.length-2]===0xff&&b[b.length-1]===0xd9;}
function newestSegment(){
 if(!fs.existsSync(SEGMENT_DIR))throw Error('Original desktop video source directory unavailable');
 const list=fs.readdirSync(SEGMENT_DIR).filter(x=>/^segment\d{6}\.ts$/.test(x));
 if(!list.length)throw Error('No live video segments available');
 const newest=list.map(name=>{
  const file=path.join(SEGMENT_DIR,name),stat=fs.statSync(file);
  return{name,file,mtimeMs:stat.mtimeMs,size:stat.size};
 }).filter(s=>s.size>=188 && s.size<=1024*1024).sort((a,b)=>b.mtimeMs-a.mtimeMs)[0];
 if(!newest||Date.now()-newest.mtimeMs>MAX_SEGMENT_AGE_MS)throw Error('Desktop video segment is stale');
 return newest;
}
function render(segment){
 return new Promise((resolve,reject)=>{
  const started=Date.now();
  const args=['-hide_banner','-loglevel','error','-nostdin','-i',segment.file,
   '-frames:v','1','-vf','scale=960:-2','-q:v','5','-f','image2pipe','-vcodec','mjpeg','pipe:1'];
  const child=cp.spawn(FFMPEG,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const chunks=[];let total=0,err='',settled=false;
  const timeout=setTimeout(()=>{child.kill();finish(Error('Desktop frame decode timed out'))},ENCODE_TIMEOUT_MS);
  function finish(error,result){
   if(settled)return;settled=true;clearTimeout(timeout);
   if(error)reject(error);else resolve(result);
  }
  child.stdout.on('data',chunk=>{
   total+=chunk.length;
   if(total>MAX_JPEG){child.kill();finish(Error('Frame output exceeded memory limit'))}
   else chunks.push(chunk);
  });
  child.stderr.on('data',b=>{err=(err+String(b)).slice(-450)});
  child.on('error',e=>finish(Error('FFmpeg unavailable: '+String(e.message).slice(0,120))));
  child.on('close',code=>{
   if(settled)return;
   const image=Buffer.concat(chunks);
   if(code!==0||!isJpeg(image))return finish(Error('Unable to decode a valid JPEG: '+err.slice(-120)));
   finish(null,{image,segment:segment.name,segmentTimeMs:segment.mtimeMs,
    processedAtMs:Date.now(),decodeMs:Date.now()-started});
  });
 });
}
async function getFrame(){
 if(cache&&Date.now()-cache.processedAtMs<MIN_INTERVAL_MS)return cache;
 if(busy)return busy;
 busy=(async()=>{
  try{
   const source=newestSegment(),image=await render(source);
   cache=image;successes++;lastDecodeMs=image.decodeMs;lastError='';return image;
  }catch(e){failures++;lastError=String(e.message||e).slice(0,120);throw e;}
  finally{busy=null}
 })();
 return busy;
}
function metrics(){
 return{available:fs.existsSync(SEGMENT_DIR),successfulFrames:successes,failedFrames:failures,
  encodeMs:lastDecodeMs,latestCaptureSegmentAgeMs:cache?Math.max(0,Date.now()-cache.segmentTimeMs):null,
  lastFrameAtUtc:cache?new Date(cache.processedAtMs).toISOString():null,
  lastError};
}
module.exports={getFrame,metrics,isJpeg,newestSegment,MIN_INTERVAL_MS};
