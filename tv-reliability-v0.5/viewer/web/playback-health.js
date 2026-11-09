'use strict';
(function(){
 var key=(location.pathname.match(/^\/(?:tv|full|fastfull)\/([a-f0-9]{64})$/)||[])[1];
 var video=document.querySelector('video'),busy=false;
 if(!key||!video)return;
 function report(){
  if(busy)return;busy=true;
  var req=new XMLHttpRequest();
  req.open('POST','/api/playback-health',true);req.timeout=2500;
  req.setRequestHeader('Authorization','Bearer '+key);
  req.setRequestHeader('Content-Type','application/json');
  req.onloadend=function(){busy=false;};
  req.send(JSON.stringify({currentTime:isFinite(video.currentTime)?video.currentTime:0,
   paused:!!video.paused,ended:!!video.ended,error:!!video.error,
   hidden:document.visibilityState==='hidden',readyState:video.readyState}));
 }
 setInterval(report,3000);
 document.addEventListener('visibilitychange',report);
})();
