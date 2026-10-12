'use strict';
(function(){
 var video=document.getElementById('display'),status=document.getElementById('status'),
 detail=document.getElementById('detail');
 var match=location.pathname.match(/^\/tv\/([a-f0-9]{48})$/);
 if(!match){status.textContent='Invalid viewing invitation';return;}
 var manifest='/media/'+match[1]+'/index.m3u8';
 video.src=manifest;video.muted=true;video.defaultMuted=true;video.autoplay=true;
 function state(s){status.textContent=s;}
 video.addEventListener('loadedmetadata',function(){state('Video stream ready');});
 video.addEventListener('playing',function(){state('LIVE · Windows desktop');});
 video.addEventListener('waiting',function(){state('Buffering live desktop…');});
 video.addEventListener('stalled',function(){state('Waiting for next video segment…');});
 video.addEventListener('pause',function(){state('Paused · select Play desktop to continue');});
 video.addEventListener('error',function(){
  var code=video.error&&video.error.code;
  state('Unable to play H.264 HLS on this TV browser (error '+code+').');
  detail.textContent='The receiver may need a different player or a firmware update. The PC Bridge phone controller remains available.';
 });
 function play(){try{var p=video.play();if(p&&p.catch)p.catch(function(){state('TV requires you to select Play desktop');});}catch(e){state('Select Play desktop using your TV remote');}}
 document.getElementById('play').addEventListener('click',play);
 document.getElementById('fullscreen').addEventListener('click',function(){
  try{if(video.requestFullscreen)video.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen()}catch(e){}
 });
 play();
})();
