'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SpeakerRouter,HEARTBEAT_TIMEOUT_MS}=require('../speaker-routing.cjs');
function fixture(initialMuted=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-speaker-route-'));
 const journal=path.join(dir,'speaker-route.json'),calls=[];
 let now=1000000,device='a'.repeat(64),muted=initialMuted,guards=0;
 const router=new SpeakerRouter({journal,clock:()=>now,sessionTag:'1'.repeat(32),
  statusFn:()=>({deviceIdHash:device,muted,endpoint:'default-speaker-output'}),
  casFn:(hash,old,next)=>{
   assert.equal(hash,device);
   assert.equal(muted,old,'CAS protects external speaker changes');
   muted=next;calls.push({old,next});
  },
  watchFn:()=>{guards++}
 });
 return {router,journal,calls,tick(ms){now+=ms},setMuted(v){muted=v},setDevice(v){device=v},
  get muted(){return muted},get guards(){return guards},cleanup(){fs.rmSync(dir,{recursive:true,force:true})}};
}
test('TV only mutes laptop, Both restores laptop, TV only restores on session end',()=>{
 const x=fixture();
 try{
  assert.equal(x.muted,false);
  const tv=x.router.setMode('tv-only','a'.repeat(64));
  assert.equal(tv.audioRoute,'tv-only');assert.equal(x.muted,true);
  assert.ok(fs.existsSync(x.journal),'Crashes have a restoration journal');
  assert.equal(x.guards,1);
  const both=x.router.setMode('both','a'.repeat(64));
  assert.equal(both.audioRoute,'both');assert.equal(x.muted,false);
  x.router.setMode('tv-only','a'.repeat(64));
  assert.equal(x.muted,true);
  assert.equal(x.guards,1,'Only one independent restoration watchdog');
  assert.equal(x.router.restore(),true);
  assert.equal(x.muted,false);
  assert.equal(fs.existsSync(x.journal),false);
 }finally{x.cleanup()}
});
test('Owner may choose laptop sound again without disabling TV image, and it expires safely',()=>{
 const x=fixture();
 try{
  x.router.setMode('tv-only','a'.repeat(64));
  x.router.setMode('laptop-only');
  assert.equal(x.muted,false);
  assert.equal(x.router.snapshot().audioRoute,'laptop-only');
  x.tick(HEARTBEAT_TIMEOUT_MS-1000);
  x.router.pulse();
  assert.equal(x.router.expire(),false);
  x.tick(HEARTBEAT_TIMEOUT_MS+1);
  assert.equal(x.router.expire(),true);
  assert.equal(x.muted,false);
  assert.equal(fs.existsSync(x.journal),false);
 }finally{x.cleanup()}
});
test('If laptop was originally muted, both explicitly unmutes temporarily then restores mute',()=>{
 const x=fixture(true);
 try{
  x.router.setMode('both','a'.repeat(64));
  assert.equal(x.muted,false);
  x.router.setMode('tv-only','a'.repeat(64));
  assert.equal(x.muted,true);
  x.router.restore();
  assert.equal(x.muted,true);
 }finally{x.cleanup()}
});
test('Mute changes from Windows user are never overwritten by session cleanup',()=>{
 const x=fixture();
 try{
  x.router.setMode('tv-only','a'.repeat(64));
  x.setMuted(false); // user unmuted Windows independently
  assert.throws(()=>x.router.setMode('both','a'.repeat(64)),/outside this app/);
  assert.equal(x.muted,false);
  assert.equal(fs.existsSync(x.journal),false);
 }finally{x.cleanup()}
});
test('Device change keeps recovery journal; old endpoint can later be restored',()=>{
 const x=fixture();
 try{
  x.router.setMode('tv-only','a'.repeat(64));
  x.setDevice('b'.repeat(64));
  assert.equal(x.router.restore(),false);
  assert.equal(fs.existsSync(x.journal),true);
  x.setDevice('a'.repeat(64));
  const result=x.router.recover();
  assert.equal(result.recovered,true);
  assert.equal(x.muted,false);
  assert.equal(fs.existsSync(x.journal),false);
 }finally{x.cleanup()}
});
test('Another Windows device cannot be muted by a TV audio stream captured elsewhere',()=>{
 const x=fixture();
 try{
  assert.throws(()=>x.router.setMode('tv-only','b'.repeat(64)),/differs from active/);
  assert.equal(x.calls.length,0);
  assert.equal(x.muted,false);
 }finally{x.cleanup()}
});
test('Invalid routing modes and raw identifiers never reach Windows',()=>{
 const x=fixture();
 try{
  assert.throws(()=>x.router.setMode('phone-only'),/Unknown/);
  assert.equal(x.calls.length,0);
 }finally{x.cleanup()}
});
