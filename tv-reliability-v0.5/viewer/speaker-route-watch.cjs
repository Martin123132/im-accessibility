'use strict';
// Detached safety guard for Windows speaker routing.
// Reads only the known private per-session journal and static native helper.
// Restores original mute if the TV browser loses heartbeat or the session expires.
// No TV, mouse, microphone, or app launch API here.
const fs=require('node:fs'),path=require('node:path');
const {runNative,JOURNAL,NATIVE,HEARTBEAT_TIMEOUT_MS,MAX_TV_SESSION_MS}=require('./speaker-routing.cjs');
const intervalMs=2400;
function loaded(file=JOURNAL){
 if(!fs.existsSync(file))return null;
 const j=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!j||!/^[a-f0-9]{32}$/.test(j.sessionTag)||!/^[0-9a-f]{64}$/.test(j.deviceIdHash)||
   typeof j.originalMuted!=='boolean'||typeof j.appliedMuted!=='boolean'||
   !Number.isSafeInteger(j.startedAt)||!Number.isSafeInteger(j.lastPulse))
  throw Error('Unrecognised speaker-route journal');
 return j;
}
function inspect(now=Date.now(),native=runNative,file=JOURNAL){
 let state;
 try{state=loaded(file)}catch(e){return {action:'stop',reason:'Invalid journal; owner inspection required'}}
 if(!state)return {action:'stop',reason:'No active viewing session'};
 if(now-state.lastPulse<HEARTBEAT_TIMEOUT_MS&&
    (MAX_TV_SESSION_MS===null||now-state.startedAt<MAX_TV_SESSION_MS))
  return {action:'watch'};
 try{
  const current=native(NATIVE,['--status']);
  if(current.deviceIdHash!==state.deviceIdHash)return {action:'watch',reason:'Playback device changed; wait for original to return'};
  if(current.muted===state.appliedMuted&&current.muted!==state.originalMuted){
   native(NATIVE,['--cas',state.deviceIdHash,current.muted?'1':'0',state.originalMuted?'1':'0']);
  }else if(current.muted!==state.originalMuted){
   return {action:'stop',reason:'User modified speaker state'};
  }
  try{fs.unlinkSync(file)}catch(e){if(e.code!=='ENOENT')throw e}
  return {action:'stop',reason:'Original speaker state restored'};
 }catch(e){return {action:'watch',reason:String(e.message).slice(0,90)}}
}
if(require.main===module){
 // Owner-started sessions have no four-hour deadline; the watcher closes on
 // journal removal or a stale heartbeat. Legacy sessions retain the old bound.
 const start=Date.now();
 const timer=setInterval(()=>{
  if(MAX_TV_SESSION_MS!==null&&Date.now()-start>MAX_TV_SESSION_MS+120000){
   clearInterval(timer);return;
  }
  if(inspect().action==='stop')clearInterval(timer);
 },intervalMs);
 // A detached guard must remain alive until its bounded session completes.
}
module.exports={inspect,loaded};
