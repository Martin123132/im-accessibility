'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path');
const sound=require('../sound.cjs');
const target=path.join(__dirname,'_never_created');
const value=(args,key)=>args[args.indexOf(key)+1];
test('legacy x264 video arguments are unchanged without LGPL selection',()=>{
 const original=process.env.IM_ACCESSIBILITY_H264_ENCODER;
 try {
  delete process.env.IM_ACCESSIBILITY_H264_ENCODER;
  const args=sound.argsFor(target,null,0,'cinema');
  assert.equal(value(args,'-c:v'),'libx264');
  assert.equal(value(args,'-preset'),'veryfast');
  assert.equal(value(args,'-profile:v'),'high');
  assert.equal(value(args,'-crf'),'18');
 }finally{
  if(original===undefined)delete process.env.IM_ACCESSIBILITY_H264_ENCODER;
  else process.env.IM_ACCESSIBILITY_H264_ENCODER=original;
 }
});
test('LGPL Media Foundation builds use legal H.264 and retain HLS quality settings',()=>{
 const original=process.env.IM_ACCESSIBILITY_H264_ENCODER;
 try{
  process.env.IM_ACCESSIBILITY_H264_ENCODER='h264_mf';
  const cinema=sound.argsFor(target,null,30,'cinema');
  assert.equal(value(cinema,'-c:v'),'h264_mf');
  assert.equal(value(cinema,'-scenario'),'live_streaming');
  assert.equal(value(cinema,'-b:v'),'5000k');
  assert.equal(value(cinema,'-g'),'60');
  assert.equal(value(cinema,'-framerate'),'30');
  assert.equal(value(cinema,'-hls_time'),'2');
  assert.equal(value(cinema,'-vf'),'scale=1920:-2');
  assert.ok(!cinema.includes('libx264')&&!cinema.includes('-crf'));
  assert.ok(!cinema.includes('-profile:v'),'MF must not inherit x264 profile text');
  assert.ok(cinema.includes('-an'),'Owner chooses audio separately');
  const interactive=sound.argsFor(target,null,40,'interactive');
  assert.equal(value(interactive,'-b:v'),'2000k');
  assert.equal(value(interactive,'-g'),'15');
  assert.equal(value(interactive,'-hls_time'),'1');
 }finally{
  if(original===undefined)delete process.env.IM_ACCESSIBILITY_H264_ENCODER;
  else process.env.IM_ACCESSIBILITY_H264_ENCODER=original;
 }
});
test('LGPL software fallback path uses only approved OpenH264 encoder',()=>{
 const original=process.env.IM_ACCESSIBILITY_H264_ENCODER;
 try{
  process.env.IM_ACCESSIBILITY_H264_ENCODER='libopenh264';
  const args=sound.argsFor(target,{sampleFormat:'f32le',sampleRate:48000,channels:2},0,'cinema');
  assert.equal(value(args,'-c:v'),'libopenh264');
  assert.equal(value(args,'-b:v'),'5000k');
  assert.equal(value(args,'-c:a'),'aac');
  assert.ok(args.includes('pipe:3'));
  process.env.IM_ACCESSIBILITY_H264_ENCODER='h264_nvenc';
  assert.throws(()=>sound.argsFor(target),/Unsupported H.264 encoder selection/);
 }finally{
  if(original===undefined)delete process.env.IM_ACCESSIBILITY_H264_ENCODER;
  else process.env.IM_ACCESSIBILITY_H264_ENCODER=original;
 }
});
test('unverified fixed-profile MSE fast mode remains disabled in LGPL preview',()=>{
 const viewer=fs.readFileSync(path.resolve(__dirname,'../../viewer/server.cjs'),'utf8');
 assert.match(viewer,/fastVideoAvailable:!!SETTINGS&&ENCODER\.encoderKind\(\)==='libx264'/);
 assert.match(viewer,/if\(SETTINGS&&ENCODER\.encoderKind\(\)==='libx264'\)/);
 assert.doesNotMatch(viewer,/IM_ACCESSIBILITY_H264_ENCODER\s*=\s*'libx264'/);
});
test('installer selects strictly checked encoder profile without changing live owner config',()=>{
 const gui=fs.readFileSync(path.resolve(__dirname,'../../../packaging/windows-oneclick/ImAccessibilityApp.cs'),'utf8');
 const builder=fs.readFileSync(path.resolve(__dirname,'../../../packaging/windows-oneclick/build-oneclick.ps1'),'utf8');
 assert.match(gui,/encoder-profile\.txt/);
 assert.match(gui,/IM_ACCESSIBILITY_H264_ENCODER/);
 assert.match(builder,/71ac0a64a4e3e0caaf7a8c25c7e73d161ac1b269cca930d207e89e1b23959dfb/);
 assert.match(builder,/encoder-profile\.txt/);
});
