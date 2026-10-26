'use strict';
// Optional fast MSE playback on LG webOS. HLS remains the default and fallback.
// Preserves the same <video> and full-screen HTML click overlay.
(function(){
 var MIME='video/mp4; codecs="avc1.4d001f, mp4a.40.2"';
 var current=null;
 function supported(){
  try{return typeof MediaSource!=='undefined'&&typeof WebSocket!=='undefined'&&
   typeof MediaSource.isTypeSupported==='function'&&MediaSource.isTypeSupported(MIME)}
  catch(e){return false}
 }
 function report(c,state){
  if(c&&typeof c.cb==='function')c.cb(state);
 }
 function stop(video,restore){
  var c=current;current=null;
  var muted=video.muted;
  if(c){
   c.closed=true;
   try{clearInterval(c.monitor)}catch(e){}
   try{clearTimeout(c.openTimer)}catch(e){}
   try{if(c.ws)c.ws.close()}catch(e){}
   // Release the MSE instance, queued fragments and hardware-backed video
   // before navigating to HLS or reconnecting. Only for an owned fast stream;
   // never call load() on an unrelated, already-playing HLS element.
   try{
    if(c.ms&&c.sb&&c.ms.readyState==='open'&&!c.sb.updating&&
       typeof c.ms.removeSourceBuffer==='function')c.ms.removeSourceBuffer(c.sb);
   }catch(e){}
   if(c.queue){c.queue.length=0;c.queueBytes=0}
   try{video.pause();video.removeAttribute('src');video.load()}catch(e){}
   try{if(c.url)URL.revokeObjectURL(c.url)}catch(e){}
   c.ms=null;c.sb=null;c.ws=null;c.url=null;
  }
  if(restore!==false){
   try{
    if(!c){video.pause();video.removeAttribute('src')}
    video.src='/media/'+(c?c.key:'')+'/index.m3u8';
    video.defaultMuted=muted;video.muted=muted;
    video.load();
    var p=video.play();if(p&&p.catch)p.catch(function(){});
   }catch(e){}
  }
 }
 function jumpLive(video){
  try{
   var r=video.buffered;
   if(!r||!r.length)return false;
   var i=r.length-1;
   video.currentTime=Math.max(r.start(i)+0.05,r.end(i)-0.7);
   return true;
  }catch(e){return false}
 }
 function decodedFrames(video){
  try{
   if(typeof video.getVideoPlaybackQuality==='function'){
    var quality=video.getVideoPlaybackQuality();
    if(quality&&isFinite(quality.totalVideoFrames))return Number(quality.totalVideoFrames);
   }
   if(isFinite(video.webkitDecodedFrameCount))return Number(video.webkitDecodedFrameCount);
  }catch(e){}
  return null;
 }
 function recoverFrozenPicture(c,reason){
  if(!c||c.closed||current!==c)return;
  var now=Date.now(),count=0,storage=null,canReload=false;
  try{
   storage=window.sessionStorage;
   if(storage){
    var old=JSON.parse(storage.getItem('imaccess-fast-restarts-v1')||'{}');
    if(old&&isFinite(old.at)&&now-old.at>=0&&now-old.at<120000)
     count=Number(old.count)||0;
    if(count<2){
     storage.setItem('imaccess-fast-restarts-v1',JSON.stringify({at:now,count:count+1}));
     canReload=true;
    }else storage.removeItem('imaccess-fast-restarts-v1');
   }
  }catch(e){canReload=false}
  report(c,canReload?'Picture stalled; reconnecting fast video…':
   'Fast video repeatedly stalled; returning to original HLS');
  // A frozen picture must not retain Windows mouse permission.
  // The WS close additionally revokes the mouse lease in the PC viewer service.
  try{
   var revoke=new XMLHttpRequest();
   revoke.open('POST','/api/disarm',true);
   revoke.setRequestHeader('Authorization','Bearer '+c.key);
   revoke.setRequestHeader('Content-Type','application/json');
   revoke.send('{}');
  }catch(e){}
  stop(c.video,false);
  try{
   if(canReload)location.reload();
   else location.replace('/full/'+c.key);
  }catch(e){location.href='/full/'+c.key}
 }
 function start(video,key,callback){
  if(!supported()||!/^[0-9a-f]{64}$/.test(key))return false;
  stop(video,false);
  var c={video:video,key:key,cb:callback,ms:null,ws:null,sb:null,url:null,
   queue:[],queueBytes:0,closed:false,lastData:Date.now(),lastAppend:0,
   fragmentCount:0,monitor:null,openTimer:null,
   lastProgressAt:Date.now(),lastTime:0,lastFrames:null,stallNudgeAt:0,
   lastSeekAt:0,lastTrimAt:0,lastDecoderReportAt:0,initialCatchupDone:false};
  current=c;
  function fail(message){
   if(c.closed||current!==c)return;
   report(c,'Fast video unavailable: '+message+'. Returning to HLS');
   // Separate webOS HLS document is the fallback; do not switch decoders in-place.
   stop(video,false);
   if(typeof c.cb!=='function'){
    try{location.replace('/full/'+c.key)}catch(e){}
   }
  }
  function trim(){
   if(!c.sb||c.sb.updating||!video.buffered||!video.buffered.length)return false;
   try{
    // Always consider the oldest range: repeated live-edge seeks can split
    // buffered media into disjoint ranges and hide old memory from last-range
    // only pruning.
    var r=video.buffered,end=r.end(r.length-1),begin=r.start(0);
    var now=Date.now();
    // Older LG webOS decoders can stall when a SourceBuffer is repeatedly
    // pruned close to the active playhead. Retain a larger safety window.
    if(end-begin>24&&now-c.lastTrimAt>10000){
     var safeEnd=Math.min(Number(video.currentTime)-8,end-12);
     if(isFinite(safeEnd)&&safeEnd>begin+3){
      c.sb.remove(begin,safeEnd);c.lastTrimAt=now;return true
     }
    }
   }catch(e){}
   return false;
  }
  function follow(){
   if(c.closed||current!==c||!video.buffered||!video.buffered.length)return;
   try{
    var r=video.buffered,end=r.end(r.length-1),begin=r.start(r.length-1);
    if(!isFinite(end)||!isFinite(begin))return;
    var now=Date.now(),lag=end-video.currentTime;
    // Leave a progressing LG hardware decoder alone. One initial alignment,
    // then only seek if decoded playback has truly stalled for five seconds.
    var stalled=now-c.lastProgressAt>5000;
    if(lag>2.5&&end-begin>1.2&&
       (!c.initialCatchupDone||(stalled&&now-c.lastSeekAt>12000))){
     var target=Math.max(begin+0.05,end-1.25);
     if(target>video.currentTime+1){video.currentTime=target;c.lastSeekAt=now}
     c.initialCatchupDone=true;
    }
    if(c.fragmentCount>12)c.initialCatchupDone=true;
   }catch(e){}
  }
  function drain(){
   if(c.closed||!c.sb||c.sb.updating)return;
   follow();
   if(trim())return;
   if(!c.queue.length)return;
   var data=c.queue.shift();c.queueBytes-=data.byteLength;
   try{
    c.sb.appendBuffer(data);c.lastAppend=Date.now();c.fragmentCount++;
    if(video.paused){
     var p=video.play();if(p&&p.catch)p.catch(function(){});
    }
   }catch(e){fail('decoder rejected fragment')}
  }
  try{
   var keepMuted=video.muted;
   // A fresh dedicated MSE-only page has no HLS source. Never call load()
   // on the LG's active HLS decoder; it can block the browser transition.
   if(video.currentSrc){video.pause();video.removeAttribute('src');video.load()}
   c.ms=new MediaSource();
   c.url=URL.createObjectURL(c.ms);
   video.src=c.url;video.defaultMuted=keepMuted;video.muted=keepMuted;
   c.ms.addEventListener('sourceopen',function(){
    if(c.closed)return;
    clearTimeout(c.openTimer);
    try{
     c.sb=c.ms.addSourceBuffer(MIME);c.sb.mode='segments';
     c.sb.addEventListener('updateend',drain);
     c.sb.addEventListener('error',function(){fail('decode error')});
    }catch(e){fail('codec initialisation');return}
    var scheme=location.protocol==='https:'?'wss://':'ws://';
    c.ws=new WebSocket(scheme+location.host+'/fast/'+key);
    c.ws.binaryType='arraybuffer';
    c.ws.onmessage=function(ev){
     if(c.closed||current!==c)return;
     var data=new Uint8Array(ev.data);
     c.queueBytes+=data.byteLength;
     c.queue.push(data);c.lastData=Date.now();
     if(c.queue.length>32||c.queueBytes>3*1024*1024){
      fail('decoder queue full');return
     }
     drain();
    };
    c.ws.onopen=function(){report(c,'FAST VIDEO • direct Windows desktop')};
    c.ws.onerror=function(){fail('connection lost')};
    c.ws.onclose=function(){fail('encoder stopped')};
   });
   c.openTimer=setTimeout(function(){fail('startup timed out')},9000);
   function publishDecodeHealth(now,time,frames,visible){
    if(!c.ws||c.ws.readyState!==1||now-c.lastDecoderReportAt<2200)return;
    var gap=null,range=video.buffered;
    try{
     if(range&&range.length){
      var end=range.end(range.length-1);
      if(isFinite(end)&&isFinite(time))gap=Math.max(0,Math.min(60000,Math.round((end-time)*1000)));
     }
    }catch(e){}
    var position=isFinite(time)?Math.max(0,Math.min(20000000,Math.round(time*1000))):0;
    var count=frames===null||!isFinite(frames)?null:
     Math.max(0,Math.min(2000000000,Math.round(frames)));
    var packet={kind:'decoder',positionMs:position,frameCount:count,
     readyState:Math.max(0,Math.min(4,Math.round(Number(video.readyState)||0))),
     paused:!!video.paused,visible:!!visible,gapMs:gap,
     queueLength:Math.max(0,Math.min(32,c.queue.length))};
    try{
     c.ws.send(JSON.stringify(packet));
     c.lastDecoderReportAt=now;
    }catch(e){}
   }
   c.monitor=setInterval(function(){
    if(c.closed||current!==c)return;
    var now=Date.now();
    if(c.ws&&c.ws.readyState===1&&now-c.lastData>9500){fail('no fresh frames');return}
    if(c.sb){follow();drain()}
    // Packets can still arrive while the LG's decoded picture is frozen.
    // Track actually decoded frames where supported, otherwise the playhead.
    var visible=typeof document==='undefined'||document.visibilityState!=='hidden';
    var time=Number(video.currentTime),frames=decodedFrames(video);
    publishDecodeHealth(now,time,frames,visible);
    if(!visible||video.paused){
     c.lastProgressAt=now;c.lastFrames=frames;c.lastTime=isFinite(time)?time:0;
     c.stallNudgeAt=0;return;
    }
    // Even a decoded video that drops to HAVE_NOTHING must not stay frozen forever.
    // Allow normal startup grace, then recover if neither frames nor time advances.
    var moved=frames!==null?(c.lastFrames===null||frames!==c.lastFrames):
       (isFinite(time)&&time>c.lastTime+0.12);
    if(moved){
     c.lastProgressAt=now;c.stallNudgeAt=0;
    }else if(now-c.lastProgressAt>7500){
     if(!c.stallNudgeAt){
      c.stallNudgeAt=now;
      jumpLive(video);report(c,'Fast picture stalled; seeking to the live edge…');
     }else if(now-c.stallNudgeAt>3500){
      recoverFrozenPicture(c,'Decoder stopped');return;
     }
    }
    c.lastTime=time;c.lastFrames=frames;
   },1100);
   report(c,'Starting fast desktop video…');
   return true;
  }catch(e){fail('could not start MSE');return false}
 }
 window.ImAccessibilityFastVideo={supported:supported,start:start,stop:stop,jumpLive:jumpLive,
  active:function(){return !!current&&!current.closed}};
})();
