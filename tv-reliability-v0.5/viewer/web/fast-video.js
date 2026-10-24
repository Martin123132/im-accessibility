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
  if(c){
   c.closed=true;
   try{clearInterval(c.monitor)}catch(e){}
   try{clearTimeout(c.openTimer)}catch(e){}
   try{if(c.ws)c.ws.close()}catch(e){}
   try{if(c.url)URL.revokeObjectURL(c.url)}catch(e){}
  }
  if(restore!==false){
   var muted=video.muted;
   try{
    video.pause();video.removeAttribute('src');
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
 function start(video,key,callback){
  if(!supported()||!/^[0-9a-f]{64}$/.test(key))return false;
  stop(video,false);
  var c={video:video,key:key,cb:callback,ms:null,ws:null,sb:null,url:null,
   queue:[],queueBytes:0,closed:false,lastData:Date.now(),lastAppend:0,
   fragmentCount:0,monitor:null,openTimer:null};
  current=c;
  function fail(message){
   if(c.closed||current!==c)return;
   report(c,'Fast video unavailable: '+message+'. Returning to HLS');
   stop(video,true);
  }
  function trim(){
   if(!c.sb||c.sb.updating||!video.buffered||!video.buffered.length)return false;
   try{
    var r=video.buffered,end=r.end(r.length-1),begin=r.start(r.length-1);
    if(end-begin>6){
     c.sb.remove(begin,Math.max(begin,end-3));return true
    }
   }catch(e){}
   return false;
  }
  function follow(){
   if(c.closed||current!==c||!video.buffered||!video.buffered.length)return;
   try{
    var r=video.buffered,end=r.end(r.length-1),begin=r.start(r.length-1);
    if(!isFinite(end)||!isFinite(begin))return;
    var lag=end-video.currentTime;
    if(lag>1.7&&end-begin>1.0)video.currentTime=Math.max(begin+0.05,end-0.7);
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
   video.pause();video.removeAttribute('src');video.load();
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
   c.monitor=setInterval(function(){
    if(c.closed||current!==c)return;
    if(c.ws&&c.ws.readyState===1&&Date.now()-c.lastData>9500)fail('no fresh frames');
    else if(c.sb){follow();drain()}
   },1100);
   report(c,'Starting fast desktop video…');
   return true;
  }catch(e){fail('could not start MSE');return false}
 }
 window.ImAccessibilityFastVideo={supported:supported,start:start,stop:stop,jumpLive:jumpLive,
  active:function(){return !!current&&!current.closed}};
})();
