'use strict';
(function(){
 var path=location.pathname,match=path.match(/^\/(?:full|tv)\/([a-f0-9]{64})$/);
 var key=match&&match[1];
 function el(id){return document.getElementById(id)}
 var video=el('desktop'),surface=el('surface'),status=el('status'),hint=el('hint');
 var armed=false,pending=false,pausePending=false,pauseEpoch=0,lastClickAt=0,expiresAt=0,confirmStopUntil=0;
 var audioAvailable=false,audioBusy=false,audioRoute='laptop-only',controlsOpen=false;
 var fastVideoActive=false,fastVideoAllowed=false;
 // TV playback can lag behind a healthy capture after network stalls.
 var streamFresh=false,lastRecoveryCount=-1,lastVideoClock=0,lastVideoProgressAt=Date.now(),
  lastVideoReloadAt=0,lastLiveSeekAt=0,reportedGapSeconds=null;
 if(!key){status.textContent='Invalid private TV session';return}
 // webOS must keep an HTML hit target. Never enable the video control surface.
 video.controls=false;video.removeAttribute('controls');
 video.style.pointerEvents='none';video.src='/media/'+key+'/index.m3u8';
 video.defaultMuted=true;video.muted=true;video.autoplay=true;
 function setMenu(open){
  controlsOpen=!!open;
  el('control-panel').hidden=!controlsOpen;
  var toggle=el('control-toggle');
  toggle.setAttribute('aria-expanded',controlsOpen?'true':'false');
  toggle.textContent=controlsOpen?'Hide controls ▼':(armed?'Controls ▲ · Mouse ON':'Controls ▲');
 }
 el('control-toggle').addEventListener('click',function(e){
  if(e.preventDefault)e.preventDefault();
  if(e.stopPropagation)e.stopPropagation();
  setMenu(!controlsOpen);
 });
 function report(s){status.textContent=s}
 function info(s){hint.textContent=s}
 function request(route,method,data,cb){
  var xhr=new XMLHttpRequest();
  xhr.open(method||'GET','/api/'+route,true);
  xhr.timeout=5500;xhr.setRequestHeader('Authorization','Bearer '+key);
  if(data!==undefined)xhr.setRequestHeader('Content-Type','application/json');
  var done=false;
  function settle(err,reply){if(done)return;done=true;cb(err,reply)}
  xhr.onreadystatechange=function(){
   if(xhr.readyState!==4)return;
   var obj={};
   try{obj=JSON.parse(xhr.responseText)}catch(e){}
   if(xhr.status>=200&&xhr.status<300)settle(null,obj);
   else settle(obj.error||'Control service unavailable',obj);
  };
  xhr.onerror=function(){settle('TV not connected to PC')};
  xhr.ontimeout=function(){settle('Windows request timed out')};
  xhr.send(data===undefined?null:JSON.stringify(data));
 }
 function mark(enabled){
  armed=!!enabled&&!pausePending;
  el('enable').disabled=armed||pausePending;el('pause').disabled=!armed||pausePending;
  info(armed?
   'Mouse ON for up to 10 minutes. Point at a Windows item and press OK. Pause when finished.':
   'Mouse OFF. Open Controls to enable desktop clicks.');
  setMenu(controlsOpen);
 }
 function setSound(allowed,mode){
  audioAvailable=!!allowed;
  if(mode==='tv-only'||mode==='both'||mode==='laptop-only')audioRoute=mode;
  if(!audioAvailable){video.muted=true;video.defaultMuted=true}
  var tvOn=audioAvailable&&!video.muted;
  el('sound').disabled=!audioAvailable||audioBusy;
  el('laptop').disabled=!tvOn||audioBusy;
  el('sound').textContent=tvOn?'TV sound ON':(audioAvailable?'TV sound OFF':'TV sound unavailable');
  el('laptop').textContent=audioRoute==='tv-only'?'Laptop sound OFF':'Laptop sound ON';
 }
 function audioChange(mode,done){
  if(audioBusy)return;
  audioBusy=true;setSound(audioAvailable,audioRoute);
  request('audio-route','POST',{mode:mode},function(err,reply){
   audioBusy=false;
   if(err){setSound(audioAvailable,audioRoute);report('Sound routing not changed: '+err);return}
   audioRoute=reply.audioRoute||mode;
   setSound(audioAvailable,audioRoute);
   if(done)done();
  });
 }
 function tvSoundStop(){
  video.muted=true;video.defaultMuted=true;
  audioChange('laptop-only',function(){
   setSound(audioAvailable,'laptop-only');report('TV sound OFF · Laptop sound restored');
  });
 }
 function reconnectLiveVideo(reason,manual){
  if(fastVideoActive)return;
  var now=Date.now();
  if(now-lastVideoReloadAt<(manual?4000:12000))return;
  lastVideoReloadAt=now;lastVideoProgressAt=now;lastVideoClock=0;
  report('Reconnecting live desktop: '+reason);
  try{
   // Preserve the existing high-quality HLS video element and native LG plane.
   // load() re-reads the same authenticated no-store playlist after an encoder restart.
   video.load();
   play();
  }catch(e){report('Video reconnect failed; select Play video')}
 }
 function monitorLiveVideo(){
  if(fastVideoActive)return;
  if(!streamFresh||video.paused||document.visibilityState==='hidden')return;
  var t=Number(video.currentTime),now=Date.now();
  if(isFinite(t)&&t>0){
   if(t>lastVideoClock+0.15){lastVideoClock=t;lastVideoProgressAt=now}
   else if(now-lastVideoProgressAt>9000){
    reconnectLiveVideo('picture stopped changing');return
   }
  }
  var ranges=video.seekable;
  if(!ranges||!ranges.length||!isFinite(t)||t<0||now-lastLiveSeekAt<7000)return;
  try{
   var end=ranges.end(ranges.length-1),begin=ranges.start(ranges.length-1);
   if(!isFinite(end)||!isFinite(begin))return;
   var lag=end-t;
   reportedGapSeconds=lag;
   // LG supports live seeking, but not faster-than-real-time HLS playback.
   // Only jump after substantial drift and leave 1.5 s decode headroom.
   if(lag>3&&end-begin>1.2){
    var target=Math.max(begin+0.1,end-0.9);
    if(target>t+1.2){video.currentTime=target;lastLiveSeekAt=now;
     lastVideoClock=target;lastVideoProgressAt=now;info('Catching up to live Windows desktop…')}
   }
  }catch(e){}
 }
 function healthy(){
  if(pending||pausePending)return;
  var epoch=pauseEpoch;
  request('status','GET',undefined,function(err,s){
   if(pausePending||epoch!==pauseEpoch)return;
   if(err){mark(false);streamFresh=false;report('Viewing controls unavailable');return}
   mark(s.enabled);
   if(!audioBusy)setSound(s.audioAvailable===true,s.audioRoute);
   fastVideoAllowed=s.fastVideoAvailable===true;
   el('fast').disabled=!fastVideoAllowed&&!fastVideoActive;
   streamFresh=s.sourceReady===true;
   var count=Number(s.recoveryCount);
   if(isFinite(count)&&count>=0){
    if(lastRecoveryCount>=0&&count>lastRecoveryCount&&streamFresh)
     reconnectLiveVideo('encoder restarted');
    lastRecoveryCount=count;
   }
   if(!streamFresh){
    report('Desktop video stalled · capture recovery in progress');
    return;
   }
   expiresAt=Date.parse(s.expiresAt);
   if(!s.canArm){mark(false);el('enable').disabled=true;report('Session expired');return}
   var remain=Math.max(0,Math.floor((expiresAt-Date.now())/60e3));
   report((fastVideoActive?'FAST DESKTOP':'LIVE DESKTOP')+' · '+remain+'m · Mouse '+(armed?'ON':'OFF')+
   (!fastVideoActive&&reportedGapSeconds>0?' · Video '+Math.round(reportedGapSeconds)+'s behind':''));
  });
 }
 function play(){
  try{var p=video.play();if(p&&p.catch)p.catch(function(){report('Select Play video on this TV')});}
  catch(e){report('Play video requires TV approval')}
 }
 video.addEventListener('playing',function(){report(armed?'LIVE · Mouse ON':'LIVE VIDEO · Mouse OFF')});
 video.addEventListener('waiting',function(){report('Buffering live desktop…')});
 video.addEventListener('error',function(){report('Live video unavailable. Try Play video.')});
 el('play').addEventListener('click',play);
 el('catchup').addEventListener('click',function(){
  if(fastVideoActive){
   try{window.ImAccessibilityFastVideo.jumpLive(video)}catch(e){}
   report('Catching up the fast desktop video');
  }else reconnectLiveVideo('manual catch up',true);
 });
 el('fast').disabled=true;
 el('fast').addEventListener('click',function(){
  if(fastVideoActive){
   fastVideoActive=false;
   el('fast').textContent='Try faster video (experimental)';
   reportedGapSeconds=null;lastVideoClock=0;lastVideoProgressAt=Date.now();
   try{window.ImAccessibilityFastVideo.stop(video,true)}
   catch(e){reconnectLiveVideo('return to HLS',true)}
   report('Original HLS desktop restored');return
  }
  if(!fastVideoAllowed||!window.ImAccessibilityFastVideo||
     !window.ImAccessibilityFastVideo.supported()){
   report('Fast video is not supported by this TV; original HLS stays in use');return
  }
  var started=window.ImAccessibilityFastVideo.start(video,key,function(message){
   report(message);
   if(message.indexOf('Returning to HLS')>=0){
    fastVideoActive=false;el('fast').textContent='Try faster video (experimental)';
    reportedGapSeconds=null;lastVideoClock=0;lastVideoProgressAt=Date.now();
   }
  });
  if(started){
   fastVideoActive=true;
   el('fast').textContent='Use original HLS video';
   setMenu(false);
  }
 });
 el('sound').addEventListener('click',function(){
  if(!audioAvailable||audioBusy)return;
  if(!video.muted){tvSoundStop();return}
  // TV sound is intentionally paired with Windows laptop mute by default.
  // Separate Laptop sound button lets the owner enable BOTH outputs.
  audioChange('tv-only',function(){
   video.muted=false;video.defaultMuted=false;
   setSound(true,'tv-only');
   try{
    var p=video.play();
    if(p&&p.catch)p.catch(function(){tvSoundStop();report('TV audio was not accepted; laptop restored')});
   }catch(e){tvSoundStop();report('TV sound not playing; laptop restored')}
  });
 });
 el('laptop').addEventListener('click',function(){
  if(!audioAvailable||audioBusy||video.muted)return;
  var next=audioRoute==='tv-only'?'both':'tv-only';
  audioChange(next,function(){
   setSound(true,next);
   report(next==='both'?'Sound on TV AND laptop':'Sound on TV only · Laptop muted');
  });
 });
 // Heartbeat prevents a permanent Windows mute if this browser, TV or session stops.
 // Keep the laptop-only mode alive too if the owner explicitly switched sound back.
 setInterval(function(){
  if(audioBusy||!audioAvailable||document.visibilityState==='hidden'||video.paused||
     (video.muted&&audioRoute!=='laptop-only'))return;
  request('audio-heartbeat','POST',{},function(err){
   if(err&&audioRoute!=='laptop-only'){
    video.muted=true;video.defaultMuted=true;
    setSound(false,'laptop-only');
    report('Audio connection lost; laptop sound recovery requested');
   }
  });
 },6500);
 function fitPosition(e){
  var box=video.getBoundingClientRect(),width=video.videoWidth||1280,height=video.videoHeight||720;
  if(!(box.width>0&&box.height>0&&width>0&&height>0))return null;
  var scale=Math.min(box.width/width,box.height/height);
  var w=width*scale,h=height*scale,left=box.left+(box.width-w)/2,top=box.top+(box.height-h)/2;
  var px=(e.clientX-left)/w,py=(e.clientY-top)/h;
  if(!isFinite(px)||!isFinite(py)||px<0||px>1||py<0||py>1)return null;
  return {x:Math.round(px*10000),y:Math.round(py*10000)};
 }
 surface.addEventListener('click',function(e){
  if(e.preventDefault)e.preventDefault();
  if(e.stopPropagation)e.stopPropagation();
  if(!armed){info('Mouse OFF. Open Controls at the bottom-right to enable mouse.');return}
  if(pending||Date.now()-lastClickAt<350)return;
  var p=fitPosition(e);
  if(!p){info('Select inside the desktop image, not the black border.');return}
  pending=true;lastClickAt=Date.now();
  var epoch=pauseEpoch;
  request('mouse','POST',{cmd:'click',x:p.x,y:p.y},function(err,res){
   pending=false;
   if(epoch!==pauseEpoch)return; // An already-issued click cannot be undone by Pause.
   if(err){report('Click not sent: '+err);healthy();return}
   var receipt=res.receipt||{};
   report('Windows click accepted: '+receipt.windowsX+', '+receipt.windowsY);
   var marker=el('marker');marker.style.left=e.clientX+'px';marker.style.top=e.clientY+'px';
   marker.hidden=false;setTimeout(function(){marker.hidden=true},500);
  });
 });
 el('enable').addEventListener('click',function(){
  if(pending||pausePending)return;
  pending=true;
  var epoch=pauseEpoch;
  el('enable').disabled=true;
  el('pause').disabled=false; // Allow an immediate Pause even while arming is in flight.
  request('arm','POST',{confirm:true},function(err,s){
   pending=false;
   if(epoch!==pauseEpoch){
    // Pause happened during arming. Revoke again after the stale arm response:
    // request arrival order is not guaranteed across separate XHR connections.
    pausePending=true;mark(false);
    request('disarm','POST',{},function(revokeError){
     pausePending=false;mark(false);
     if(revokeError){el('enable').disabled=true;el('pause').disabled=false}
     report(revokeError?'Pause not confirmed: '+revokeError:'Windows mouse paused');
    });
    return;
   }
   if(err){mark(false);report('Enable rejected: '+err);return}
   mark(s.enabled);if(s.enabled)setMenu(false);
   report(s.enabled?'Windows mouse enabled for 10 minutes':'Mouse not enabled');
  });
 });
 el('pause').addEventListener('click',function(){
  if(pausePending)return;
  pauseEpoch++;
  pausePending=true;
  armed=false; // Reject every new browser click before requesting server-side disarm.
  el('enable').disabled=true;
  el('pause').disabled=true;
  info('Mouse OFF locally. Confirming Windows input pause…');
  request('disarm','POST',{},function(err){
   pausePending=false;mark(false);
   if(err){ // A network error is NOT evidence that the native service was disarmed.
    el('enable').disabled=true;
    el('pause').disabled=false; // Allow retry even when local state is OFF.
   }
   if(!err)setMenu(false);
   report(err?'Pause not confirmed: '+err:'Windows mouse paused');
  });
 });
 el('classic').addEventListener('click',function(){
  // Preserve the user's known working buttons and JPEG fallback.
  location.href='/tv/'+key;
 });
 el('stop').addEventListener('click',function(){
  if(pending)return;
  if(Date.now()>confirmStopUntil){
   confirmStopUntil=Date.now()+6500;
   el('stop').textContent='CONFIRM END SESSION';
   report('Press CONFIRM END SESSION again to stop viewing');
   setTimeout(function(){if(Date.now()>=confirmStopUntil){
    confirmStopUntil=0;el('stop').textContent='End TV session';
   }},7000);
   return;
  }
  pending=true;request('end','POST',{confirm:true},function(err){
   pending=false;mark(false);
   report(err?'Unable to stop: '+err:'TV session ending');
  });
 });
 setMenu(false);mark(false);setSound(false,'laptop-only');healthy();setInterval(healthy,2800);
 setInterval(monitorLiveVideo,2000);play();
})();
