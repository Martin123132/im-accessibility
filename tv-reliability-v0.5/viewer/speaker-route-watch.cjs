'use strict';
// Detached safety guard for Windows speaker routing.
// Reads only the known private per-session journal and static native helper.
// Restores original mute if the TV browser loses heartbeat or the session expires.
// No TV, mouse, microphone, or app launch API here.
const fs=require('node:fs'),path=require('node:path');
const {runNative,JOURNAL,NATIVE,HEARTBEAT_TIMEOUT_MS,MAX_TV_SESSION_MS}=require('./speaker-routing.cjs');
const intervalMs=2400;
function loaded(){
 if(!fs.existsSync(JOURNAL))return null;
 const j=JSON.parse(fs.readFileSync(JOURNAL,'utf8'));
 if(!j||!/^[a-f0-9]{32}$/.test(j.sessionTag)||!/^[0-9a-f]{64}$/.test(j.deviceIdHash)||
   typeof j.originalMuted!=='boolean'||typeof j.appliedMuted!=='boolean'||
   !Number.isSafeInteger(j.startedAt)||!Number.isSafeInteger(j.lastPulse))
  throw Error('Unrecognised speaker-route journal');
 return j;
}
function inspect(now=Date.now(),native=runNative,file=JOURNAL){
 let state;
 try{state=loaded()}catch(e){return {action:'stop',reason:'Invalid journal; owner inspection required'}}
 if(!state)return {action:'stop',reason:'No active viewing session'};
 if(now-state.lastPulse<HEARTBEAT_TIMEOUT_MS&&now-state.startedAt<MAX_TV_SESSION_MS)
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
 // Bound this independent guard even if a device never returns.
 const start=Date.now();
 const timer=setInterval(()=>{
  if(Date.now()-start>MAX_TV_SESSION_MS+120000){
   clearInterval(timer);return;
  }
  if(inspect().action==='stop')clearInterval(timer);
 },intervalMs);
 // A detached guard must remain alive until its bounded session completes.
}
module.exports={inspect,loaded};
