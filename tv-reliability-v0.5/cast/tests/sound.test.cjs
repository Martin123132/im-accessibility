'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
fs=require('node:fs'),path=require('node:path');
const sound=require('../sound.cjs');
const server=fs.readFileSync(path.resolve(__dirname,'../server.cjs'),'utf8');
const pack=fs.readFileSync(path.resolve(__dirname,'../../../packaging/build-preview.cjs'),'utf8');
test('speaker output is exact opt-in with no microphone endpoint',()=>{
 assert.equal(sound.isAudioOptIn('1'),true);
 for(const v of ['true','yes','0','',undefined,null,' 1'])assert.equal(sound.isAudioOptIn(v),false);
 assert.match(server,/IM_ACCESSIBILITY_TV_AUDIO/);
 const c=fs.readFileSync(path.join(__dirname,'../native/LoopbackCapture.cs.txt'),'utf8');
 assert.match(c,/GetDefaultAudioEndpoint\(0,1,out device\)/);
 assert.doesNotMatch(c,/GetDefaultAudioEndpoint\(1,/);
 assert.match(pack,/StartSound\.cmd/);
});
test('Windows speaker-loopback helper validates bounded raw format',()=>{
 const f={ok:true,sampleFormat:'f32le',sampleRate:48000,channels:2,
  bitsPerSample:32,blockAlign:8,deviceIdHash:'a'.repeat(64),capture:'default-speaker-output-loopback'};
 assert.equal(sound.validFormat(f),true);
 for(const p of [{capture:'microphone'},{sampleFormat:'unknown'},{channels:0},{channels:10},{sampleRate:999999},{blockAlign:16},{ok:false}])
  assert.equal(sound.validFormat({...f,...p}),false);
 assert.deepEqual(sound.probe(sound.BINARY,()=>({status:0,stdout:JSON.stringify(f)})),
  {sampleFormat:'f32le',sampleRate:48000,channels:2,deviceIdHash:'a'.repeat(64)});
 assert.throws(()=>sound.probe(sound.BINARY,()=>({status:1})),/unavailable/);
});
test('original HLS remains video-only; opt-in adds copied speaker audio',()=>{
 const out=path.resolve(__dirname,'_not_created');
 const classic=sound.argsFor(out);
 assert.ok(classic.includes('-an'));
 assert.equal(classic[classic.indexOf('-start_number')+1],'0');
 const afterRestart=sound.argsFor(out,null,1266);
 assert.equal(afterRestart[afterRestart.indexOf('-start_number')+1],'1266');
 assert.throws(()=>sound.argsFor(out,null,-1),/start number/);
 assert.throws(()=>sound.argsFor(out,null,1000000),/start number/);
 assert.ok(!classic.includes('pipe:3'));
 assert.equal(classic[classic.indexOf('-hls_time')+1],'1');
 assert.equal(classic[classic.indexOf('-g')+1],'15');
 assert.equal(classic[classic.indexOf('-keyint_min')+1],'15');
 assert.equal(classic[classic.indexOf('-hls_list_size')+1],'4','Bound live playlist close to current video');
 const av=sound.argsFor(out,{sampleFormat:'f32le',sampleRate:48000,channels:2});
 assert.ok(av.includes('pipe:3')&&av.includes('aac'));
 assert.deepEqual(av.slice(av.indexOf('-map'),av.indexOf('-map')+4),
  ['-map','0:v:0','-map','1:a:0']);
 assert.ok(!av.includes('-an'));
 assert.ok(av.includes('aresample=async=1:first_pts=0'));
 assert.throws(()=>sound.argsFor(out,{sampleFormat:'mp3',sampleRate:48000,channels:2}),/Unverified/);
 assert.match(server,/recoveryTried/);
 assert.match(server,/safeEndAudio/);
});
