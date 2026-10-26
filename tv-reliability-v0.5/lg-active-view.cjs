'use strict';
// Owner-bound LG browser activity guard. No clicks, keyboard events, changes
// to LG screen-protection settings, unattended TV power-on, or Windows inputs.
// A one-pixel LG pointer movement is permitted only while the verified,
// time-limited TV viewing session and its video feed are actually active.
const fs=require('node:fs');
const path=require('node:path');
const {readUserSettings}=require('./release-config.cjs');
const VIEWING=require('./viewing-policy.cjs');
const ROOT=__dirname;
const PERIOD_MS=75000;
const MAX_BYTES=16384;
const STATE=path.join(ROOT,'runtime','state.json');
const STOP=path.join(ROOT,'runtime','stop-request.json');
const VIEWER=path.join(ROOT,'viewer','runtime','session.json');
const LG_KEY=path.join(ROOT,'viewer','runtime','lg-client-key');

function jsonFile(file,fsApi=fs){
 if(!fsApi.existsSync(file))return null;
 const stat=fsApi.statSync(file);
 if(!stat.isFile()||stat.size<2||stat.size>MAX_BYTES)return null;
 try{return JSON.parse(fsApi.readFileSync(file,'utf8'))}catch{return null}
}
function boundSession({root=ROOT,fsApi=fs,now=Date.now(),settings}={}){
 if(!settings||!settings.network||!settings.television||!settings.television.ip)return null;
 if(fsApi.existsSync(path.join(root,'runtime','stop-request.json')))return null;
 const state=jsonFile(path.join(root,'runtime','state.json'),fsApi);
 const viewer=jsonFile(path.join(root,'viewer','runtime','session.json'),fsApi);
 if(!state||!viewer||typeof state!=='object'||typeof viewer!=='object')return null;
 if(!/^[a-f0-9]{16}$/.test(state.runId||'')||state.state!=='ready'||
    state.stream!=='ready'||state.viewer!=='ready'||state.lg!=='opened'||
    state.lgIp!==settings.television.ip)return null;
 let until=null;
 if(VIEWING.MODE==='until-stopped'){
  if(state.viewingMode!=='until-stopped'||viewer.viewingMode!=='until-stopped'||
     state.expectedEndUtc!==null||viewer.expiresAt!==null)return null;
 }else{
  const hostExpiry=Date.parse(state.expectedEndUtc||'');
  const viewerExpiry=Date.parse(viewer.expiresAt||'');
  if(!Number.isFinite(hostExpiry)||!Number.isFinite(viewerExpiry)||
     now>=hostExpiry||now>=viewerExpiry||hostExpiry-now>VIEWING.LEGACY_MAX_MS||
     viewerExpiry-now>VIEWING.LEGACY_MAX_MS)return null;
  until=Math.min(hostExpiry,viewerExpiry);
 }
 try{
  const u=new URL(viewer.url);
  if(u.protocol!=='http:'||u.hostname!==settings.network.ip||u.port!=='43198'||
      !/^\/tv\/[a-f0-9]{64}$/.test(u.pathname)||u.search||u.hash)return null;
 }catch{return null}
 return {runId:state.runId,expiresAtMs:until,viewingMode:VIEWING.MODE};
}
async function servicesReady(settings,{fetchFn=fetch}={}){
 try{
  const addresses=['43196','43198'].map(port=>'http://'+settings.network.ip+':'+port+'/health');
  const results=await Promise.all(addresses.map(addr=>
   fetchFn(addr,{redirect:'error',signal:AbortSignal.timeout(2200)})));
  if(results.some(r=>!r.ok))return false;
  const [cast,viewer]=await Promise.all(results.map(r=>r.json()));
  return cast.build==='tv-resume-v0.5'&&cast.stream==='running'&&
    viewer.build==='tv-resume-v0.5'&&viewer.ready===true&&viewer.sourceReady===true;
 }catch{return false}
}
async function activityTick({tv,socket,settings,root=ROOT,fsApi=fs,
 now=Date.now(),fetchFn=fetch,delta=1,delayFn=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const live=boundSession({root,fsApi,now,settings});
 if(!live)return {active:false,moved:false,why:'session-ended'};
 if(!await servicesReady(settings,{fetchFn}))
  return {active:true,moved:false,why:'video-not-ready'};
 const foreground=await tv.request('ssap://com.webos.applicationManager/getForegroundAppInfo',{});
 if(foreground.appId!=='com.webos.app.browser')
  return {active:true,moved:false,why:'browser-not-foreground'};
 const before=await tv.request('ssap://com.webos.service.tvpower/power/getPowerState',{});
 if(!['Active','Screen Saver'].includes(before.state))
  return {active:true,moved:false,why:'tv-state-not-active'};
 if(!Number.isInteger(delta)||Math.abs(delta)!==1)throw Error('Only one-pixel movement allowed');
 socket.send('move',{dx:delta,dy:0});
 let after=before.state;
 if(before.state==='Screen Saver'){
  await delayFn(1600);
  const updated=await tv.request('ssap://com.webos.service.tvpower/power/getPowerState',{});
  after=updated.state;
 }
 return {active:true,moved:true,previousPower:before.state,newPower:after,runId:live.runId};
}
async function connectLg(settings,{LGTV}={}){
 const Constructor=LGTV||require('./cast/node_modules/lgtv2');
 if(!fs.existsSync(LG_KEY))throw Error('Owner LG pairing credential not available');
 return new Promise((resolve,reject)=>{
  let tv,completed=false;
  const timer=setTimeout(()=>finish(Error('LG activity connection timed out')),11000);
  function finish(error,result){
   if(completed)return;completed=true;clearTimeout(timer);
   if(error){try{tv&&tv.disconnect()}catch{}reject(error)}
   else resolve(result)
  }
  try{
   tv=new Constructor({host:settings.television.ip,reconnect:0,timeout:5500,
     handshakeTimeout:5500,keyFile:LG_KEY,rejectUnauthorized:false});
   tv.on('prompt',()=>finish(Error('TV requires fresh physical pairing approval')));
   tv.on('error',e=>finish(e));
   tv.on('connect',async()=>{
    try{
     const model=await tv.request('ssap://system/getSystemInfo',{});
     if(model.modelName!==settings.television.model)throw Error('Unrecognised LG hardware model');
     const socket=await tv.getSocket('ssap://com.webos.service.networkinput/getPointerInputSocket');
     finish(null,{tv,socket});
    }catch(e){finish(e)}
   });
  }catch(e){finish(e)}
 });
}
async function main(){
 if(!process.env.IM_ACCESSIBILITY_CONFIG_PATH)
  throw Error('Owner-confirmed release settings are required');
 const settings=readUserSettings();
 if(!boundSession({settings}))throw Error('No verified active owner TV session');
 const {tv,socket}=await connectLg(settings);
 let shutdown=false,failures=0,moves=0,delta=1;
 const onSignal=()=>{shutdown=true};
 process.on('SIGTERM',onSignal);
 process.on('SIGINT',onSignal);
 try{
  // Activity never starts on a timer unconditionally; first validate the
  // foreground LG browser and live, bounded video receiver.
  while(!shutdown){
   let event;
   try{
    event=await activityTick({tv,socket,settings,delta});
    failures=0;
    if(!event.active)break;
    if(event.moved){moves++;delta=-delta}
    if(event.moved&&event.previousPower==='Screen Saver')
      console.log(JSON.stringify({event:'screen-saver-recovery',after:event.newPower}));
   }catch(e){
    failures++;
    console.error('LG_ACTIVITY_RETRY '+String(e.message||e).slice(0,110));
    if(failures>=3)break;
   }
   // Break long sleeps into bounded intervals to honour owner Stop promptly.
   for(let waited=0;waited<PERIOD_MS&&!shutdown;waited+=1500)
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
 }finally{
  try{tv.disconnect()}catch{}
  console.log(JSON.stringify({event:'LG activity guard finished',moves,reason:shutdown?'owner stop or signal':'session ended or repeated error'}));
 }
}
if(require.main===module)main().catch(e=>{
 console.error('LG_ACTIVITY_FAIL '+String(e.message||e).slice(0,160));
 process.exitCode=1;
});
module.exports={PERIOD_MS,MAX_BYTES,jsonFile,boundSession,servicesReady,activityTick,connectLg};
