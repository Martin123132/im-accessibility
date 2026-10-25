'use strict';
// Synthetic-only safety regression: no LG, Windows speaker modification,
// installed task, shell service, or real audio capture.
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
 cp=require('node:child_process');
const {SpeakerRouter,MAX_TV_SESSION_MS,HEARTBEAT_TIMEOUT_MS}=
 require('../speaker-routing.cjs');
const guard=require('../speaker-route-watch.cjs');

const audioId='b'.repeat(64);

function configuredChild(){
 assert.equal(MAX_TV_SESSION_MS,null);
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'owner-audio-5h-'));
 const journal=path.join(d,'speaker-route.json'),hash='b'.repeat(64);
 let now=1000000,muted=false,watchStarts=0;
 try{
  const router=new SpeakerRouter({journal,clock:()=>now,sessionTag:'c'.repeat(32),
   statusFn:()=>({deviceIdHash:hash,muted,endpoint:'default-speaker-output'}),
   casFn:(_hash,old,next)=>{assert.equal(_hash,hash);assert.equal(old,muted);muted=next},
   watchFn:()=>{watchStarts++}
  });
  router.setMode('tv-only',hash);assert.equal(muted,true);
  now+=5*60*60*1000;router.pulse();
  assert.equal(router.expire(),false,'No configured four-hour cutoff');
  const native=(_exe,args)=>{
   if(args[0]==='--status')return {deviceIdHash:hash,muted,endpoint:'default-speaker-output'};
   assert.equal(args[0],'--cas');assert.equal(args[1],hash);
   assert.equal(args[2],'1');assert.equal(args[3],'0');
   assert.equal(muted,true);muted=false;
   return {deviceIdHash:hash,muted};
  };
  assert.equal(guard.inspect(now,native,journal).action,'watch','Fresh five-hour heartbeat remains valid');
  now+=HEARTBEAT_TIMEOUT_MS+1;
  const report=guard.inspect(now,native,journal);
  assert.equal(report.action,'stop');assert.equal(report.reason,'Original speaker state restored');
  assert.equal(muted,false);assert.equal(fs.existsSync(journal),false);assert.equal(watchStarts,1);
 }finally{fs.rmSync(d,{recursive:true,force:true})}
}
if(process.argv[2]==='--owner-child')configuredChild();
else{
 const host=require('../../resume-host.cjs');
 test('failed restoration guard blocks TV-only mute before any native change',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'audio-watch-fails-'));
  const journal=path.join(dir,'speaker-route.json');
  let muted=false,mutations=0;
  try{
   const router=new SpeakerRouter({journal,
    statusFn:()=>({deviceIdHash:audioId,muted,endpoint:'default-speaker-output'}),
    casFn:()=>{mutations++},
    watchFn:()=>{throw Error('independent restoration guard unavailable')}
   });
   assert.throws(()=>router.setMode('tv-only',audioId),/Cannot change playback without restoration guard/);
   assert.equal(mutations,0);assert.equal(muted,false);
   assert.equal(fs.existsSync(journal),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 });
 test('supervisor attempts second audio journal recovery after viewer exit',()=>{
  const calls=[],logs=[];
  assert.equal(host.restoreAudioAfterViewerExit({
   routerFactory:()=>({recover(){calls.push('recovered');return {recovered:true,hadJournal:true}}}),
   logFn:msg=>logs.push(msg)
  }),true);
  assert.deepEqual(calls,['recovered']);
  assert.match(logs.join(' '),/LAPTOP_AUDIO_RESTORED/);
  assert.equal(host.restoreAudioAfterViewerExit({
   routerFactory:()=>({recover(){return {recovered:false,reason:'device changed'}}}),
   logFn:msg=>logs.push(msg)
  }),false);
  assert.match(logs.join(' '),/LAPTOP_AUDIO_RESTORE_PENDING/);
  assert.equal(host.restoreAudioAfterViewerExit({
   routerFactory:()=>{throw Error('helper unavailable')},logFn:msg=>logs.push(msg)
  }),false);
 });
 test('historical unconfigured audio tests retain four-hour limit',()=>{
  assert.equal(MAX_TV_SESSION_MS,4*60*60*1000);
  let now=9000000,muted=false,changes=0;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'audio-legacy-test-'));
  const journal=path.join(dir,'journal.json');
  try{
   const router=new SpeakerRouter({journal,clock:()=>now,
    statusFn:()=>({deviceIdHash:audioId,muted,endpoint:'default-speaker-output'}),
    casFn:(_id,from,to)=>{assert.equal(from,muted);muted=to;changes++},
    watchFn:()=>{}
   });
   router.setMode('tv-only',audioId);now+=4*60*60*1000+1;
   assert.equal(router.expire(),true);assert.equal(muted,false);assert.equal(changes,2);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 });
 test('configured five-hour owner audio stays guarded, then restores after lost heartbeat',()=>{
  const result=cp.spawnSync(process.execPath,[__filename,'--owner-child'],{
   encoding:'utf8',windowsHide:true,timeout:7000,
   env:{...process.env,IM_ACCESSIBILITY_CONFIG_PATH:'C:/not-connected-owner-audio-test.json'}
  });
  assert.equal(result.status,0,result.stderr||result.error?.message);
 });
}
