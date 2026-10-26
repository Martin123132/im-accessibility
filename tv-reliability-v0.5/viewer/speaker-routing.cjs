'use strict';
// Windows laptop speaker routing for an authorised LG viewing session.
// The TV receives WASAPI loopback audio even when Windows renders speaker output muted.
// The ORIGINAL Windows mute state is restored on session end / TV heartbeat expiry.
// Only the exact playback endpoint can be touched; never changes volume or capture devices.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const VIEWING=require('../viewing-policy.cjs');
const ROOT=__dirname,NATIVE=path.resolve(ROOT,'../cast/native/SpeakerEndpoint.exe');
const JOURNAL=path.join(ROOT,'runtime','speaker-route.json');
const WATCH=path.join(ROOT,'speaker-route-watch.cjs');
const READY=path.join(ROOT,'runtime','audio-guard-ready.json');
const TASK_NAME='ImAccessibility-AudioGuard-v1';
// The audio restoration lifetime must follow the *same* owner/legacy policy as video.
// A null deadline means: keep the guard until journal removal or lost heartbeat.
const HEARTBEAT_TIMEOUT_MS=22000, MAX_TV_SESSION_MS=VIEWING.maxMs();
function startIndependentGuard({taskName=TASK_NAME,readyFile=READY,sessionTag,execFn=cp.spawnSync,
 fsApi=fs,nowFn=()=>Date.now(),pauseFn=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}={}){
 if(!/^[a-f0-9]{32}$/.test(sessionTag||''))throw Error('No verified audio guard session identity');
 const started=nowFn();
 const r=execFn('schtasks.exe',['/Run','/TN',taskName],{
  encoding:'utf8',windowsHide:true,timeout:6000,maxBuffer:2500});
 if(r.error||r.status!==0)throw Error('Independent Windows audio guardian is not enabled for this user');
 const until=started+9000;
 while(nowFn()<until){
  try{
   const stat=fsApi.lstatSync(readyFile);
   if(!stat.isFile()||stat.isSymbolicLink())throw Error('Unsafe audio guardian readiness file');
   const ready=JSON.parse(fsApi.readFileSync(readyFile,'utf8'));
   if(ready.sessionTag===sessionTag&&Number.isSafeInteger(ready.beatAt)&&
      ready.beatAt>=started-1000&&ready.beatAt<=nowFn()&&nowFn()-ready.beatAt<=5000&&
      Number.isSafeInteger(ready.pid)&&ready.pid>0)return true;
  }catch(e){if(e.code!=='ENOENT'&&e.code!=='EBUSY'&&
     e.message==='Unsafe audio guardian readiness file')throw e}
  pauseFn(125);
 }
 throw Error('Independent Windows audio guardian did not report readiness');
}
function guardianReady(sessionTag,{file=READY,fsApi=fs,now=Date.now()}={}){
 try{
  const st=fsApi.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink())return false;
  const data=JSON.parse(fsApi.readFileSync(file,'utf8'));
  return data.sessionTag===sessionTag&&Number.isSafeInteger(data.beatAt)&&
   data.beatAt<=now&&now-data.beatAt<=7000&&Number.isSafeInteger(data.pid)&&data.pid>0;
 }catch{return false}
}
function isBit(v){return v===true||v===false}
function validDeviceId(v){return typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)}
function runNative(binary,args,spawnSync=cp.spawnSync){
 const r=spawnSync(binary,args,{encoding:'utf8',windowsHide:true,timeout:3600,maxBuffer:2100});
 if(r.error||r.status!==0)throw Error('Windows playback control unavailable: '+String(r.stderr||r.error?.message||'error').slice(0,110));
 let data;try{data=JSON.parse(r.stdout)}catch{throw Error('Invalid Windows playback response')}
 if(!validDeviceId(data.deviceIdHash)||!isBit(data.muted)||data.endpoint!=='default-speaker-output')throw Error('Unexpected playback endpoint');
 return data;
}
function atomic(file,obj,fsApi=fs){
 fsApi.mkdirSync(path.dirname(file),{recursive:true});
 const tmp=file+'.'+process.pid+'.tmp';
 fsApi.writeFileSync(tmp,JSON.stringify(obj)+'\n',{flag:'w'});
 fsApi.renameSync(tmp,file);
}
class SpeakerRouter{
 constructor({binary=NATIVE,journal=JOURNAL,fsApi=fs,clock=()=>Date.now(),
  statusFn=null,casFn=null,watchFn=null,guardianReadyFn=guardianReady,
  enforceIndependentGuard=null,sessionTag=crypto.randomBytes(16).toString('hex')}={}){
  this.binary=binary;this.journal=journal;this.fs=fsApi;this.clock=clock;
  this.statusFn=statusFn||(()=>runNative(binary,['--status']));
  this.casFn=casFn||((hash,old,next)=>runNative(binary,['--cas',hash,old?'1':'0',next?'1':'0']));
  this.watchFn=watchFn||(()=>{
   if(VIEWING.MODE==='until-stopped')
    return startIndependentGuard({sessionTag:this.tag});
   const child=cp.spawn(process.execPath,[WATCH],{
    cwd:ROOT,detached:true,windowsHide:true,stdio:'ignore'});
   if(!child||!child.pid)throw Error('Playback-restoration guard unavailable');
   child.unref();
  });
  this.guardRequired=enforceIndependentGuard===null?(watchFn===null&&VIEWING.MODE==='until-stopped'):
    enforceIndependentGuard===true;
  this.guardReady=guardianReadyFn;this.tag=sessionTag;
  this.ownership=null;this.route='laptop-only';this.guardStarted=false;
  this.lastPulse=0;this.lastError=null;
 }
 snapshot(){return {audioRoute:this.route,laptopMuted:this.ownership?this.ownership.appliedMuted:null,
  laptopControlled:!!this.ownership,playbackRoutingError:this.lastError};}
 readJournal(){try{
  if(!this.fs.existsSync(this.journal))return null;
  const x=JSON.parse(this.fs.readFileSync(this.journal,'utf8'));
  if(!x||!validDeviceId(x.deviceIdHash)||!isBit(x.originalMuted)||!isBit(x.appliedMuted)||
    !/^[a-f0-9]{32}$/.test(x.sessionTag)||!Number.isFinite(x.lastPulse)||!Number.isFinite(x.startedAt))
   throw Error('Invalid playback recovery record');
  return x;
 }catch(e){throw Error('Playback recovery requires owner inspection: '+String(e.message).slice(0,70))}
 }
 journalSave(now=this.clock()){
  if(!this.ownership)return;
  atomic(this.journal,{...this.ownership,viewingMode:VIEWING.MODE,lastPulse:now},this.fs);
 }
 recover(){
  const x=this.readJournal();
  if(!x||(x.sessionTag===this.tag&&this.ownership))return {recovered:true,hadJournal:!!x};
  const s=this.statusFn();
  if(s.deviceIdHash!==x.deviceIdHash)return {recovered:false,reason:'Original playback device is not selected'};
  if(s.muted===x.appliedMuted&&x.appliedMuted!==x.originalMuted){
   this.casFn(x.deviceIdHash,x.appliedMuted,x.originalMuted);
  }else if(s.muted!==x.originalMuted){
   return {recovered:false,reason:'Playback state changed externally'};
  }
  this.fs.unlinkSync(this.journal);
  return {recovered:true,hadJournal:true};
 }
 setMode(mode,expectedAudioDevice=null){
  if(!['tv-only','both','laptop-only'].includes(mode))throw Error('Unknown playback mode');
  const oldMode=this.route,now=this.clock();
  if(oldMode===mode&&mode!=='laptop-only'){this.pulse();return this.snapshot()}
  // Only one session may change a Windows output at a time.
  const previous=this.readJournal();
  if(previous&&previous.sessionTag!==this.tag){
   const recovery=this.recover();
   if(!recovery.recovered)throw Error('Previous playback session requires recovery: '+recovery.reason);
  }
  const current=this.statusFn();
  if(mode!=='laptop-only' && (!validDeviceId(expectedAudioDevice)||
       current.deviceIdHash!==expectedAudioDevice))
   throw Error('Windows speaker device differs from active TV audio capture');
  const target=mode==='tv-only';
  if(!this.ownership){
   this.ownership={sessionTag:this.tag,deviceIdHash:current.deviceIdHash,
    originalMuted:current.muted,appliedMuted:current.muted,
    startedAt:now,lastPulse:now};
  }
  const record=this.ownership;
  if(current.deviceIdHash!==record.deviceIdHash){
   this.lastError='Windows playback device changed';throw Error(this.lastError)
  }
  if(current.muted!==record.appliedMuted){
   this.lastError='Windows playback setting was changed outside this app';
   this.ownership=null;this.route='laptop-only';this.guardStarted=false;
   try{this.fs.unlinkSync(this.journal)}catch{}
   throw Error(this.lastError);
  }
  // Start the safety watcher before altering playback mute: if protection cannot
  // start, fail closed with the original Windows setting still unchanged.
  if(!this.guardStarted){
   this.journalSave(now);
   try{this.watchFn();this.guardStarted=true}catch(e){
    this.lastError=String(e.message).slice(0,120);
    this.ownership=null;this.route='laptop-only';
    try{this.fs.unlinkSync(this.journal)}catch{}
    throw Error('Cannot change playback without restoration guard: '+this.lastError);
   }
  }
  if(current.muted!==target){
   // Persist intent BEFORE mutating Windows so a crash can still restore it.
   record.appliedMuted=target;
   this.journalSave(now);
   try{this.casFn(record.deviceIdHash,current.muted,target)}
   catch(err){
    record.appliedMuted=current.muted;
    this.journalSave(now);
    this.lastError=String(err.message).slice(0,140);
    throw err;
   }
  }
  this.route=mode;this.lastPulse=now;this.lastError=null;
  this.journalSave(now);
  if(mode==='laptop-only'){ /* explicitly restores listening to laptop */
   // Keep ownership until End to reinstate the original (possibly muted) speaker state.
  }
  return this.snapshot();
 }
 pulse(){
  if(!this.ownership)return this.snapshot();
  if(this.guardRequired&&!this.guardReady(this.tag)){
   // A stalled independent guardian is not permission to keep the laptop muted.
   const restored=this.restore();
   throw Error(restored?'Independent audio guardian stopped: original Windows sound restored':
    'Independent audio guardian stopped: Windows sound recovery requires inspection');
  }
  this.lastPulse=this.clock();this.journalSave(this.lastPulse);
  return this.snapshot();
 }
 expire(){
  if(!this.ownership)return false;
  if(this.clock()-this.lastPulse < HEARTBEAT_TIMEOUT_MS &&
     (MAX_TV_SESSION_MS===null||this.clock()-this.ownership.startedAt < MAX_TV_SESSION_MS))return false;
  return this.restore();
 }
 restore(){
  const owned=this.ownership;
  if(!owned){this.route='laptop-only';return true}
  let state;
  try{state=this.statusFn()}catch(e){
   this.lastError='Cannot read Windows mute state for restoration';return false
  }
  if(state.deviceIdHash!==owned.deviceIdHash){
   this.lastError='Original speaker device was changed; recovery journal retained';
   this.route='laptop-only';this.ownership=null;return false;
  }
  if(state.muted===owned.appliedMuted&&state.muted!==owned.originalMuted){
   try{this.casFn(owned.deviceIdHash,owned.appliedMuted,owned.originalMuted)}
   catch(e){this.lastError=String(e.message).slice(0,140);return false}
  }
  // If the user manually altered the mute state, preserve their choice.
  try{this.fs.unlinkSync(this.journal)}catch(e){if(e.code!=='ENOENT')return false}
  this.ownership=null;this.route='laptop-only';this.lastPulse=0;this.lastError=null;this.guardStarted=false;return true;
 }
}
module.exports={SpeakerRouter,runNative,validDeviceId,HEARTBEAT_TIMEOUT_MS,MAX_TV_SESSION_MS,JOURNAL,NATIVE,
 READY,TASK_NAME,startIndependentGuard,guardianReady};
