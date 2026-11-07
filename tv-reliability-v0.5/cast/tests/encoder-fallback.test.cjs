'use strict';
// Pure failure-policy tests: no network, TV, FFmpeg spawn, sound or user input.
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path');
const policy=require('../encoder-fallback.cjs');
const sound=require('../sound.cjs');
const fixture=Object.freeze({
 encoder:'h264_mf',alreadyUsed:false,ownerStopped:false,
 pendingRestart:false,recoveryTried:false,hadManifest:false,
 sinceStartMs:1300,exitCode:1,signal:null,spawnError:false,
 captureAlive:true
});
test('switch once to OpenH264 on an early nonzero MF exit before a first playlist',()=>{
 const choice=policy.next(fixture,'early-exit');
 assert.deepEqual(choice,{
  switchIt:true,encoder:'libopenh264',
  reason:'Media Foundation did not start HLS; retrying with OpenH264'
 });
 assert.equal(policy.next({...fixture,encoder:'libopenh264',alreadyUsed:true},'early-exit').switchIt,false);
});
test('never switch codecs because of an intentional stop or quality restart',()=>{
 for(const delta of [
  {ownerStopped:true},{pendingRestart:true},{recoveryTried:true},
  {signal:'SIGTERM',exitCode:null},{signal:'SIGINT'},
  {exitCode:0},{exitCode:null},{spawnError:true},
  {hadManifest:true},{sinceStartMs:15000},{sinceStartMs:-4},
  {encoder:'libx264'},{encoder:'libopenh264'},{alreadyUsed:true}
 ]){
  assert.equal(policy.afterEarlyExit({...fixture,...delta}),false,JSON.stringify(delta));
 }
});
test('a stalled MF process with no playlist after the grace may switch exactly once',()=>{
 assert.equal(policy.next({...fixture,sinceStartMs:policy.STARTUP_GRACE_MS+1},'missing-playlist').switchIt,true);
 for(const delta of [
  {sinceStartMs:policy.STARTUP_GRACE_MS},
  {captureAlive:false},{alreadyUsed:true},{hadManifest:true},
  {ownerStopped:true},{pendingRestart:true},{recoveryTried:true},
  {encoder:'libx264'},{encoder:'libopenh264'}
 ]){
  assert.equal(policy.afterMissingPlaylist({...fixture,sinceStartMs:25000,...delta}),false,JSON.stringify(delta));
 }
});
test('does not hide or repeat failure if the software fallback also fails',()=>{
 const first=policy.next(fixture,'early-exit');
 const second=policy.next({...fixture,encoder:first.encoder,alreadyUsed:true,
  sinceStartMs:25000},'missing-playlist');
 assert.equal(second.switchIt,false);
 assert.equal(second.encoder,'libopenh264');
 assert.equal(second.reason,null);
 assert.throws(()=>policy.next(fixture,'retry-all'),/Unrecognised encoder failure/);
});
test('explicit software encoder override does not mutate the user/owner environment',()=>{
 const saved=process.env.IM_ACCESSIBILITY_H264_ENCODER;
 try{
  process.env.IM_ACCESSIBILITY_H264_ENCODER='h264_mf';
  const out=path.join(__dirname,'__does_not_exist__');
  const original=sound.argsFor(out,null,0,'cinema');
  const fallback=sound.argsFor(out,null,0,'cinema','libopenh264');
  assert.equal(original[original.indexOf('-c:v')+1],'h264_mf');
  assert.equal(fallback[fallback.indexOf('-c:v')+1],'libopenh264');
  assert.equal(fallback[fallback.indexOf('-g')+1],'60');
  assert.equal(fallback[fallback.indexOf('-hls_time')+1],'2');
  assert.equal(process.env.IM_ACCESSIBILITY_H264_ENCODER,'h264_mf');
  assert.throws(()=>sound.argsFor(out,null,0,'cinema','bad-encoder'),/Unsupported H.264/);
 }finally{
  if(saved===undefined)delete process.env.IM_ACCESSIBILITY_H264_ENCODER;
  else process.env.IM_ACCESSIBILITY_H264_ENCODER=saved;
 }
});
test('the production LG session still requires owner approval and original sound safety',()=>{
 const root=path.resolve(__dirname,'..');
 const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
 const preview=fs.readFileSync(path.join(root,'../../packaging/build-preview.cjs'),'utf8');
 assert.match(server,/ENCODER_FALLBACK\.next\(/);
 assert.match(server,/SOUND\.argsFor\(SEGMENTS,format,nextSegment,qualityMode,videoEncoder\)/);
 assert.match(server,/pendingRestart=\{format:captureFormat\}/);
 assert.match(server,/safeEndAudio\(audioChild\)/);
 assert.match(server,/videoEncoder=CONFIGURED_VIDEO_ENCODER;encoderFallbackUsed=false/);
 assert.match(server,/encoderFallbackUsed&&videoEncoder==='libopenh264'/);
 assert.match(preview,/encoder-fallback\.cjs/);
 assert.match(server,/ownerStopped=true;captureState='failed'/);
 assert.match(server,/recoveryCount\+\+/);
});
