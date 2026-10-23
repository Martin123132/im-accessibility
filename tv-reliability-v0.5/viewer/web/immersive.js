'use strict';
(function(){
 var path=location.pathname,match=path.match(/^\/(?:full|tv)\/([a-f0-9]{64})$/);
 var key=match&&match[1];
 function el(id){return document.getElementById(id)}
 var video=el('desktop'),surface=el('surface'),status=el('status'),hint=el('hint');
 var armed=false,pending=false,lastClickAt=0,expiresAt=0,confirmStopUntil=0;
 if(!key){status.textContent='Invalid private TV session';return}
 // webOS must keep an HTML hit target. Never enable the video control surface.
 video.controls=false;video.removeAttribute('controls');
 video.style.pointerEvents='none';video.src='/media/'+key+'/index.m3u8';
 video.defaultMuted=true;video.muted=true;video.autoplay=true;
 function report(s){status.textContent=s}
 function info(s){hint.textContent=s}
 function request(route,method,data,cb){
  var xhr=new XMLHttpRequest();
  xhr.open(method||'GET','/api/'+route,true);
  xhr.timeout=5500;xhr.setRequestHeader('Authorization','Bearer '+key);
  if(data!==undefined)xhr.setRequestHeader('Content-Type','application/json');
  xhr.onreadystatechange=function(){
   if(xhr.readyState!==4)return;
   var obj={};
   try{obj=JSON.parse(xhr.responseText)}catch(e){}
   if(xhr.status>=200&&xhr.status<300)cb(null,obj);
   else cb(obj.error||'Control service unavailable',obj);
  };
  xhr.onerror=function(){cb('TV not connected to PC')};
  xhr.ontimeout=function(){cb('Windows request timed out')};
  xhr.send(data===undefined?null:JSON.stringify(data));
 }
 function mark(enabled){
  armed=!!enabled;
  el('enable').disabled=armed;el('pause').disabled=!armed;
  info(armed?
   'Mouse ON for up to 10 minutes. Point at a Windows item and press OK. Pause when finished.':
   'Mouse OFF. Enable mouse to click the full-screen desktop.');
 }
 function healthy(){
  if(pending)return;
  request('status','GET',undefined,function(err,s){
   if(err){mark(false);report('Viewing controls unavailable');return}
   mark(s.enabled);
   expiresAt=Date.parse(s.expiresAt);
   if(!s.canArm){mark(false);el('enable').disabled=true;report('Session expired');return}
   var remain=Math.max(0,Math.floor((expiresAt-Date.now())/60e3));
   report('LIVE DESKTOP · '+remain+'m · Mouse '+(armed?'ON':'OFF'));
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
  if(!armed){info('Mouse OFF. Select Enable mouse at the top right.');return}
  if(pending||Date.now()-lastClickAt<350)return;
  var p=fitPosition(e);
  if(!p){info('Select inside the desktop image, not the black border.');return}
  pending=true;lastClickAt=Date.now();
  request('mouse','POST',{cmd:'click',x:p.x,y:p.y},function(err,res){
   pending=false;
   if(err){report('Click not sent: '+err);healthy();return}
   var receipt=res.receipt||{};
   report('Windows click accepted: '+receipt.windowsX+', '+receipt.windowsY);
   var marker=el('marker');marker.style.left=e.clientX+'px';marker.style.top=e.clientY+'px';
   marker.hidden=false;setTimeout(function(){marker.hidden=true},500);
  });
 });
 el('enable').addEventListener('click',function(){
  if(pending)return;pending=true;
  request('arm','POST',{confirm:true},function(err,s){
   pending=false;
   if(err){mark(false);report('Enable rejected: '+err);return}
   mark(s.enabled);report(s.enabled?'Windows mouse enabled for 10 minutes':'Mouse not enabled');
  });
 });
 el('pause').addEventListener('click',function(){
  if(pending)return;pending=true;
  request('disarm','POST',{},function(err){
   pending=false;mark(false);report(err?'Could not pause: '+err:'Windows mouse paused');
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
 mark(false);healthy();setInterval(healthy,2800);play();
})();
