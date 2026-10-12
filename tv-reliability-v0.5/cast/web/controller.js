'use strict';
(function(){
 const $=id=>document.getElementById(id),raw=new URLSearchParams(location.hash.slice(1)).get('key')||'';
 if(/^[a-f0-9]{48}$/.test(raw))sessionStorage.setItem('pcbridge_tv_controller',raw);
 const token=sessionStorage.getItem('pcbridge_tv_controller')||'';
 history.replaceState(null,'',location.pathname);
 if(!/^[a-f0-9]{48}$/.test(token)){
   $('app-error').textContent='Open the private controller link created on your PC.';
   for(const id of ['start','stop','cast','discover'])$(id).disabled=true;
   return;
 }
 let busy=false,lastStatus=null;
 async function api(route,{method='GET',body}={}){
  const h={'Authorization':'Bearer '+token};
  if(body!==undefined)h['Content-Type']='application/json';
  const r=await fetch('/api/'+route,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(30000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||('Request rejected: '+r.status));return data;
 }
 function writeError(e){$('app-error').textContent=String(e.message||e).slice(0,220)}
 async function refresh(){
  if(busy)return;
  try{
   const s=await api('status');lastStatus=s;
   $('stream-status').textContent=s.streamReady?'Streaming desktop to TV receiver · ready':
     s.state==='running'?'Starting live video segments…':
     s.state==='failed'?'Encoder failed: '+(s.error||'unknown'): 'Desktop stream is stopped';
   $('frame').textContent=s.resolution+' · '+s.targetFps+' fps H.264 HLS';
   $('viewers').textContent=s.lastWatchAt?'TV last requested video at '+new Date(s.lastWatchAt).toLocaleTimeString():'No TV receiver yet';
   $('tv-link').textContent=s.receiverUrl||'Preparing receiver…';
   $('start').disabled=(s.state==='running');
   $('stop').disabled=s.state!=='running';
   $('cast').disabled=!s.streamReady;
  }catch(e){writeError(e)}
 }
 async function operation(fn){if(busy)return;busy=true;$('app-error').textContent='';try{await fn()}catch(e){writeError(e)}finally{busy=false;await refresh()}}
 $('start').onclick=()=>operation(async()=>{await api('start',{method:'POST',body:{}});$('stream-status').textContent='Starting PC video encoder…'});
 $('stop').onclick=()=>operation(async()=>{await api('stop',{method:'POST',body:{}});$('cast-status').textContent='Stream stopped on PC.'});
 $('discover').onclick=()=>operation(async()=>{
  $('discover').textContent='Searching…';
  try{
   const x=await api('devices'),select=$('device');
   while(select.firstChild)select.removeChild(select.firstChild);
   const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select a discovered screen';select.appendChild(placeholder);
   for(const d of x.devices){
    const opt=document.createElement('option');opt.value=d.address;opt.textContent=d.name+' — '+d.address+(d.type==='lg'?' (auto-open)':' (browser only)');opt.dataset.type=d.type;select.appendChild(opt);
   }
   $('cast-status').textContent=x.devices.length?x.devices.length+' local screen(s) discovered.':'No LG TV responded. Turn it on or enter its IP from TV settings.';
  }finally{$('discover').textContent='Find screens on Wi-Fi'}
 });
 $('device').onchange=()=>{
  if($('device').value)$('tv-ip').value=$('device').value;
  const opt=$('device').selectedOptions?.[0];
  if(opt?.dataset?.type==='manual')$('cast-status').textContent='This screen needs the browser fallback link below; LG auto-open will not work on it.';
 };
 $('cast').onclick=()=>operation(async()=>{
  const ip=$('tv-ip').value.trim();
  if(!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip))throw Error('Enter your LG TV address from its Network Settings');
  $('cast-status').textContent='Contacting LG TV. If prompted, approve LG Connect Apps with the TV remote…';
  const result=await api('launch-lg',{method:'POST',body:{ip}});
  $('cast-status').textContent=result.ok?'LG browser launch requested. Watch the TV screen for the receiver.':'LG launch not yet confirmed.';
 });
 $('copy').onclick=async()=>{
  const text=$('tv-link').textContent;
  try{
   await navigator.clipboard.writeText(text);
   $('copy').textContent='Copied TV link';
  }catch(e){
   $('cast-status').textContent='Your browser may block clipboard on LAN HTTP. Long-press the receiver link above to copy it.';
  }
 };
 setInterval(refresh,2500);refresh();
})();
