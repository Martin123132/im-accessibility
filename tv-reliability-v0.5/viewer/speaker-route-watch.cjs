'use strict';
// Detached safety guard for Windows speaker routing.
// Reads only the known private per-session journal and static native helper.
// Restores original mute if the TV browser loses heartbeat or the session expires.
// No TV, mouse, microphone, or app launch API here.
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {runNative,JOURNAL,NATIVE,READY,HEARTBEAT_TIMEOUT_MS,MAX_TV_SESSION_MS}=require('./speaker-routing.cjs');
const intervalMs=2400;
function loaded(file=JOURNAL){
 if(!fs.existsSync(file))return null;
 const j=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!j||!/^[a-f0-9]{32}$/.test(j.sessionTag)||!/^[0-9a-f]{64}$/.test(j.deviceIdHash)||
   typeof j.originalMuted!=='boolean'||typeof j.appliedMuted!=='boolean'||
   !Number.isSafeInteger(j.startedAt)||!Number.isSafeInteger(j.lastPulse)||
   (j.viewingMode!==undefined&&!['until-stopped','four-hour'].includes(j.viewingMode)))
  throw Error('Unrecognised speaker-route journal');
 return j;
}
function inspect(now=Date.now(),native=runNative,file=JOURNAL){
 let state;
 try{state=loaded(file)}catch(e){return {action:'stop',reason:'Invalid journal; owner inspection required'}}
 if(!state)return {action:'stop',reason:'No active viewing session'};
 const maxMs=state.viewingMode==='until-stopped'?null:
   state.viewingMode==='four-hour'?4*60*60*1000:MAX_TV_SESSION_MS;
 if(now-state.lastPulse<HEARTBEAT_TIMEOUT_MS&&
    (maxMs===null||now-state.startedAt<maxMs))
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
function writeReadiness(state,now=Date.now(),readyFile=READY,fsApi=fs){
 if(!state||!/^[a-f0-9]{32}$/.test(state.sessionTag))throw Error('Invalid audio session identity');
 fsApi.mkdirSync(path.dirname(readyFile),{recursive:true});
 const tmp=readyFile+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';
 try{
  fsApi.writeFileSync(tmp,JSON.stringify({sessionTag:state.sessionTag,pid:process.pid,beatAt:now})+'\n',{flag:'wx'});
  fsApi.renameSync(tmp,readyFile);
 }finally{try{fsApi.unlinkSync(tmp)}catch{}}
}
function clearReadiness(sessionTag,readyFile=READY,fsApi=fs){
 try{
  const current=JSON.parse(fsApi.readFileSync(readyFile,'utf8'));
  if(current.sessionTag===sessionTag)fsApi.unlinkSync(readyFile);
 }catch(e){if(e.code!=='ENOENT')return false}
 return true;
}
function serviceTick(now=Date.now(),native=runNative,journal=JOURNAL,readyFile=READY){
 let record;
 try{record=loaded(journal)}catch{return {action:'stop',reason:'Invalid recovery journal'}}
 if(!record)return {action:'stop',reason:'No audio recovery journal'};
 writeReadiness(record,now,readyFile);
 const outcome=inspect(now,native,journal);
 if(outcome.action==='stop')clearReadiness(record.sessionTag,readyFile);
 return outcome;
}
if(require.main===module){
 // Owner-started sessions have no four-hour deadline; the watcher closes on
 // journal removal or a stale heartbeat. Legacy sessions retain the old bound.
 const start=Date.now();
 const taskMode=process.argv.length===3&&process.argv[2]==='--task-guardian';
 if(process.argv.length>2&&!taskMode){console.error('Invalid audio safety mode');process.exitCode=2}
 // Check now so the task can acknowledge its first heartbeat before TV-only mute.
 const first=taskMode?serviceTick():inspect();
 const timer=setInterval(()=>{
  if(!taskMode&&MAX_TV_SESSION_MS!==null&&Date.now()-start>MAX_TV_SESSION_MS+120000){
   clearInterval(timer);return;
  }
  const result=taskMode?serviceTick():inspect();
  if(result.action==='stop')clearInterval(timer);
 },intervalMs);
 if(first.action==='stop')clearInterval(timer);
 // A detached guard must remain alive until its bounded session completes.
}
module.exports={inspect,loaded,writeReadiness,clearReadiness,serviceTick};
