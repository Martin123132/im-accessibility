'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../native');
const source=fs.readFileSync(path.join(root,'LoopbackCapture.cs.txt'),'utf8');
const binary=fs.readFileSync(path.join(root,'LoopbackCapture.exe'));
test('owner-tested 48kHz speaker loopback clock binary is correctly pinned',()=>{
 const hash=crypto.createHash('sha256').update(binary).digest('hex').toUpperCase();
 assert.equal(hash,'E0BE8C56EDDADEF0F604906FAA8CFE7CD7A120782D9CC24D55CEAAB83F7A5995');
 assert.ok(binary.length>4096&&binary.length<500000,'Small bounded native helper');
});
test('WASAPI silent-packet pacing uses bounded measured audio-clock deficit',()=>{
 assert.match(source,/Stopwatch\.StartNew\(\)/);
 assert.match(source,/int maxSilenceFrames=Math\.Max\(1,rate\/8\)/);
 assert.match(source,/long deficit=expected-framesWritten/);
 assert.match(source,/int fill=\(int\)Math\.Min\(Math\.Max\(0,wanted\),maxSilenceFrames\)/);
 assert.match(source,/framesWritten\+=fill/);
 assert.doesNotMatch(source,/Math\.Min\(deficit-rate\/40,silenceFrames\)/);
 assert.match(source,/GetDefaultAudioEndpoint\(0,1,out device\)/);
 assert.doesNotMatch(source,/GetDefaultAudioEndpoint\(1,/);
});
