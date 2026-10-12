'use strict';
(function(){
 var $=function(id){return document.getElementById(id);};
 var key=(location.pathname.match(/^\/tv\/([a-f0-9]{64})$/)||[])[1]||'';
 var video=$('display'),stage=$('stage'),layer=$('clicklayer'),flash=$('clickflash'),armed=false,pending=false,lastAt=0,lastWheel=0,lastPoint={x:5000,y:5000},hasPoint=false;
 var snapshotReady=false,snapshotBusy=false,snapshotSeq=0,snapshotAim=null,lastPictureAt=0,confirmEndUntil=0;
 if(!key){$('status').textContent='Invalid PC Bridge viewing invitation';return;}
 var hls='/media/'+key+'/index.m3u8';
 video.controls=false;video.removeAttribute("controls");video.style.pointerEvents="none";
 video.src=hls;video.muted=true;video.defaultMuted=true;video.autoplay=true;
 function show(message){$('status').textContent=message;}
 function result(message){$('result').textContent=message;}
 function request(route,method,data,cb){
  var req=new XMLHttpRequest();
  req.open(method||'GET','/api/'+route,true);
  req.timeout=5500;req.setRequestHeader('Authorization','Bearer '+key);
  if(data!==undefined)req.setRequestHeader('Content-Type','application/json');
  req.onreadystatechange=function(){if(req.readyState!==4)return;
   var reply={};
   try{reply=JSON.parse(req.responseText)}catch(e){}
   if(req.status>=200&&req.status<300)cb(null,reply);else cb(reply.error||'PC Bridge did not respond',reply);
  };
  req.onerror=function(){cb('TV is not connected to the PC pointer receiver');};
  req.ontimeout=function(){cb('Windows action timed out');};
  req.send(data===undefined?null:JSON.stringify(data));
 }
 function setArmed(value){
  armed=!!value;layer.className=armed?'clicklayer active':'clicklayer';
  $('arm').disabled=armed;$('disarm').disabled=!armed;
  $('up').disabled=!armed;$('down').disabled=!armed;$('clicklast').disabled=!armed||!hasPoint;
  padIds.forEach(function(id){$(id).disabled=!armed;});
  $('snapshot-target').disabled=!armed||!snapshotReady;
  $('aimed-click').disabled=!armed||!snapshotReady||!snapshotAim;
  $('hint').textContent=armed?
    'PC CONTROLS ON · Click the desktop with your LG pointer (no typing or message sending).':
    'PC CONTROLS OFF · Enable PC controls below before clicking Windows.';
 }
 function refresh(){
  if(pending)return;
  request('status','GET',undefined,function(err,d){
   if(err){setArmed(false);show('Control service unavailable');return;}
   setArmed(d.enabled);show(d.enabled?'LIVE · Windows controls ON':(d.canArm?'LIVE · Windows controls OFF':'Session expired'));
   var secs=Math.max(0,Math.floor((Date.parse(d.expiresAt)-Date.now())/1000));
   $('session-remaining').textContent='TV video '+Math.floor(secs/3600)+'h '+Math.floor((secs%3600)/60)+'m remaining'+(d.enabled?' · Mouse ON (10-minute lease)':' · Mouse OFF');
   if(d.preview){var age=d.preview.latestCaptureSegmentAgeMs;
    $('preview-age').textContent=d.preview.successfulFrames?('Latest preview video segment '+(age/1000).toFixed(1)+'s old · JPEG '+d.preview.encodeMs+'ms'):'Preparing a desktop picture…';}
   if(!d.canArm){$('arm').disabled=true;result('Session expired. Please request a new temporary receiver link.');}
  });
 }
 function videoPosition(e){
  var r=video.getBoundingClientRect(),vw=video.videoWidth||1280,vh=video.videoHeight||720;
  var scale=Math.min(r.width/vw,r.height/vh),actualWidth=vw*scale,actualHeight=vh*scale;
  var left=r.left+(r.width-actualWidth)/2,top=r.top+(r.height-actualHeight)/2;
  var xx=(e.clientX-left)/actualWidth,yy=(e.clientY-top)/actualHeight;
  if(xx<0||xx>1||yy<0||yy>1||!isFinite(xx)||!isFinite(yy))return null;
  return {x:Math.max(0,Math.min(10000,Math.round(xx*10000))),y:Math.max(0,Math.min(10000,Math.round(yy*10000)))};
 }
 function sendPointer(cmd,coords,steps){
  if(!armed){result('Enable PC controls first');return;}
  if(pending||Date.now()-lastAt<350)return;
  pending=true;lastAt=Date.now();
  var payload={cmd:cmd};
  if(coords){payload.x=coords.x;payload.y=coords.y;}
  if(cmd==='wheel')payload.delta=steps;
  request('mouse','POST',payload,function(err,r){
   pending=false;
   if(err){result('Not sent: '+err);refresh();return;}
   var rc=r.receipt||{};
   result('Windows '+rc.action+' confirmed · cursor '+rc.windowsX+','+rc.windowsY);
   if(cmd==='click'&&coords){
    var rect=stage.getBoundingClientRect(),v=video.getBoundingClientRect();
    flash.style.left=(v.left-rect.left+v.width*coords.x/10000)+'px';
    flash.style.top=(v.top-rect.top+v.height*coords.y/10000)+'px';
    flash.hidden=false;setTimeout(function(){flash.hidden=true;},550);
   }
  });
 }
 layer.addEventListener('mousemove',function(e){
  var v=videoPosition(e);if(v){lastPoint=v;hasPoint=true;$('clicklast').disabled=!armed;}
 });
 layer.addEventListener('click',function(e){
  if(e.preventDefault)e.preventDefault();
  if(e.stopPropagation)e.stopPropagation();
  if(!armed){result('Enable PC controls first');return;}
  var v=videoPosition(e);if(!v){result('Click inside the picture, not the black border');return;}
  lastPoint=v;hasPoint=true;sendPointer('click',v,0);
 });
 $('clicklast').addEventListener('click',function(){
  if(!armed||!hasPoint){result('First point to an item in the desktop picture');return;}
  sendPointer('click',lastPoint,0);
 });
 function scroll(e){
  if(!armed)return;
  if(e.preventDefault)e.preventDefault();
  if(Date.now()-lastWheel<500)return;
  lastWheel=Date.now();
  var v=videoPosition(e);if(v){lastPoint=v;hasPoint=true;$('clicklast').disabled=!armed;}
  var dy=e.deltaY!==undefined?e.deltaY:(e.wheelDelta!==undefined?-e.wheelDelta:0);
  if(!dy)return;
  sendPointer('wheel',lastPoint,dy>0?-1:1);
 }
 layer.addEventListener('wheel',scroll,false);
 layer.addEventListener('mousewheel',scroll,false);
 $('up').addEventListener('click',function(){sendPointer('wheel',lastPoint,2)});
 $('down').addEventListener('click',function(){sendPointer('wheel',lastPoint,-2)});
 $('arm').addEventListener('click',function(){
  if(pending)return;
  pending=true;result('Enabling mouse controls for this TV…');
  request('arm','POST',{confirm:true},function(err,d){
   pending=false;if(err){result('Enable rejected: '+err);return;}
   setArmed(d.enabled);result('Enabled. Point at a Windows item inside the video and click it.');
  });
 });
 $('end-viewing').addEventListener('click',function(){
  if(pending)return;
  if(Date.now()>confirmEndUntil){
   confirmEndUntil=Date.now()+6500;
   $('end-viewing').textContent='CONFIRM END TV';
   result('Press CONFIRM END TV again within 6 seconds to stop the private viewer.');
   setTimeout(function(){if(Date.now()>=confirmEndUntil){confirmEndUntil=0;$('end-viewing').textContent='End TV session';}},6800);
   return;
  }
  pending=true;
  request('end','POST',{confirm:true},function(err,response){
   pending=false;confirmEndUntil=0;
   $('end-viewing').textContent=err?'End TV session':'TV session stopping';
   if(!err){setArmed(false);$('end-viewing').disabled=true;result('PC Bridge TV closing at your request.');}
   else result('Stop not sent: '+err);
  });
 });
 $('disarm').addEventListener('click',function(){
  if(pending)return;
  pending=true;request('disarm','POST',{},function(err,d){
   pending=false;setArmed(false);result(err?'Pause failed: '+err:'Mouse controls paused.');
  });
 });
 $('play').addEventListener('click',function(){
  try{var p=video.play();if(p&&p.catch)p.catch(function(){show('Select Play again with your TV remote');});}catch(e){show('TV requires manual playback');}
 });
 $('full').addEventListener('click',function(){
  try{if(stage.requestFullscreen)stage.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();}catch(e){}
 });
 video.addEventListener('playing',function(){show(armed?'LIVE · Windows controls ON':'LIVE · video playing');});
 video.addEventListener('waiting',function(){show('Buffering video stream…');});
 video.addEventListener('error',function(){show('TV video playback failed · try Play video or old receiver');});

 var navTarget={x:5000,y:5000},padIds=['preset-chat','preset-center','preset-right','move-left','move-up','move-down','move-right','clickpc'];
 function redrawNav(){
  var x=Math.round(navTarget.x/100),y=Math.round(navTarget.y/100);
  $('target-readout').textContent='Windows target: '+x+'% across, '+y+'% down';
 }
 function selectTarget(x,y){
  if(!armed){result('Enable PC controls first');return;}
  navTarget={x:Math.max(0,Math.min(10000,Math.round(x))),y:Math.max(0,Math.min(10000,Math.round(y)))};
  redrawNav();
  sendPointer('move',navTarget,0);
 }
 function deltaTarget(dx,dy){var step=Number($('step').value)||900;selectTarget(navTarget.x+dx*step,navTarget.y+dy*step)}
 $('showpad').addEventListener('click',function(){
  if(!$('picture-pad').hidden){$('picture-pad').hidden=true;$('showpicture').textContent='Click desktop picture';}
  var wasHidden=$('remote-pad').hidden;
  $('remote-pad').hidden=!wasHidden;
  $('showpad').textContent=wasHidden?'Hide click pad':'Remote click pad';
  document.body.className=wasHidden?'nav-open':'';
  redrawNav();
 });
 $('preset-chat').addEventListener('click',function(){selectTarget(2300,4500)});
 $('preset-center').addEventListener('click',function(){selectTarget(5000,5000)});
 $('preset-right').addEventListener('click',function(){selectTarget(7800,4500)});
 $('move-left').addEventListener('click',function(){deltaTarget(-1,0)});
 $('move-up').addEventListener('click',function(){deltaTarget(0,-1)});
 $('move-down').addEventListener('click',function(){deltaTarget(0,1)});
 $('move-right').addEventListener('click',function(){deltaTarget(1,0)});
 $('clickpc').addEventListener('click',function(){
  if(!armed){result('Enable PC controls first');return;}
  sendPointer('click',navTarget,0);
 });

 function picturePosition(e){
  var rect=$('snapshot-target').getBoundingClientRect();
  if(!rect||rect.width<50||rect.height<30)return null;
  var fx=(e.clientX-rect.left)/rect.width,fy=(e.clientY-rect.top)/rect.height;
  if(!isFinite(fx)||!isFinite(fy)||fx<0||fx>1||fy<0||fy>1)return null;
  return{x:Math.round(fx*10000),y:Math.round(fy*10000)};
 }
 function markPicture(point){
  if(!point)return;
  snapshotAim=point;var cross=$('aim-point');
  cross.hidden=false;cross.style.left=(point.x/100)+'%';cross.style.top=(point.y/100)+'%';
  $('picture-coords').textContent='Selected: '+Math.round(point.x/100)+'% across / '+Math.round(point.y/100)+'% down';
  $('aimed-click').disabled=!armed||!snapshotReady;
 }
 function refreshPicture(){
  if($('picture-pad').hidden||snapshotBusy)return;
  snapshotBusy=true;
  var img=$('snapshot');
  snapshotSeq=(snapshotSeq+1)%1000000000;
  img.src='/frame/'+key+'/'+snapshotSeq+'.jpg';
 }
 $('snapshot').addEventListener('load',function(){
  snapshotBusy=false;snapshotReady=true;lastPictureAt=Date.now();
  var imageBox=$('snapshot').getBoundingClientRect(),frameBox=$('snapshot-frame').getBoundingClientRect();
  $('picture-size').textContent='JPEG '+($('snapshot').naturalWidth||'?')+'×'+($('snapshot').naturalHeight||'?')+' · displayed '+Math.round(imageBox.width)+'×'+Math.round(imageBox.height)+' (frame '+Math.round(frameBox.width)+'×'+Math.round(frameBox.height)+')';
  $('snapshot-target').disabled=!armed;
  $('aimed-click').disabled=!armed||!snapshotAim;
  $('snapshot-hint').textContent='CLICK THIS PICTURE to click Windows. The TV video above remains view-only.';
 });
 $('snapshot').addEventListener('error',function(){
  snapshotBusy=false;snapshotReady=false;
  $('picture-size').textContent='Desktop JPEG image failed to load';
  $('snapshot-target').disabled=true;$('aimed-click').disabled=true;
  $('preview-age').textContent='Picture unavailable · check the desktop stream or press Refresh';
 });
 $('snapshot-target').addEventListener('mousemove',function(e){
  if(!snapshotReady||!armed)return;
  var point=picturePosition(e);if(point)markPicture(point);
 });
 $('snapshot-target').addEventListener('click',function(e){
  if(e.preventDefault)e.preventDefault();if(e.stopPropagation)e.stopPropagation();
  if(!armed||!snapshotReady){result('Enable PC controls and wait for the desktop picture');return;}
  var point=picturePosition(e);
  if(!point){result('Select a point inside the clickable picture, or use the selected-position button');return;}
  markPicture(point);sendPointer('click',point,0);
 });
 $('aimed-click').addEventListener('click',function(){
  if(!armed||!snapshotReady||!snapshotAim){result('Select a position in the desktop picture first');return;}
  sendPointer('click',snapshotAim,0);
 });
 $('refresh-picture').addEventListener('click',function(){snapshotBusy=false;refreshPicture()});
 $('showpicture').addEventListener('click',function(){
  var opening=$('picture-pad').hidden;
  $('picture-pad').hidden=!opening;
  if(opening){$('remote-pad').hidden=true;$('showpad').textContent='Arrow fallback';}
  document.body.className=opening?'picture-open':'';
  $('showpicture').textContent=opening?'Back to live video':'Click desktop picture';
  if(opening)refreshPicture();
 });
 function reportBuffer(){
  try{var window=video.seekable;
   if(window&&window.length&&isFinite(video.currentTime)){
    var seconds=Math.max(0,window.end(window.length-1)-video.currentTime);
    $('video-lag').textContent='TV video behind playable edge: '+seconds.toFixed(1)+'s (approx)';
   }else $('video-lag').textContent='TV buffer estimate unavailable';
  }catch(e){$('video-lag').textContent='TV buffer estimate unavailable'}
 }
 setInterval(function(){if(!$('picture-pad').hidden)refreshPicture()},2400);
 setInterval(reportBuffer,1800);
 setArmed(false);redrawNav();refresh();setInterval(refresh,2600);
 try{var p=video.play();if(p&&p.catch)p.catch(function(){show('Select Play video on this TV');});}catch(e){}
})();
