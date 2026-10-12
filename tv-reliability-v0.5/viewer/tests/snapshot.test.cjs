'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const snapshot=require('../snapshot.cjs');
const server=require('../server.cjs');
const path=require('node:path');
const streamDir=path.resolve(__dirname,'../../cast/runtime/stream');
const hasLiveSource=fs.existsSync(streamDir)&&fs.readdirSync(streamDir).some(n=>/^segment\d{6}\.ts$/.test(n)&&Date.now()-fs.statSync(path.join(streamDir,n)).mtimeMs<6000);
const liveOnly=hasLiveSource?false:'Requires a currently running, fresh TV HLS stream';
test('single desktop snapshot is bounded JPEG decoded from the inherited live stream', {timeout:12000,skip:liveOnly},async()=>{
 const f=await snapshot.getFrame();
 assert.ok(snapshot.isJpeg(f.image),'JPEG header/footer and size are valid');
 assert.ok(f.image.length>1500&&f.image.length<700000,'Encoded image stays under bounded size');
 assert.match(f.segment,/^segment\d{6}\.ts$/);
 assert.ok(f.decodeMs>=0&&f.decodeMs<=2700);
 const metrics=snapshot.metrics();
 assert.ok(metrics.successfulFrames>=1);
 assert.ok(metrics.latestCaptureSegmentAgeMs>=0&&metrics.latestCaptureSegmentAgeMs<8000);
});
test('snapshot deduplicates near-simultaneous image requests', {timeout:12000,skip:liveOnly},async()=>{
 const before=await snapshot.getFrame();
 const [a,b]=await Promise.all([snapshot.getFrame(),snapshot.getFrame()]);
 assert.ok(snapshot.isJpeg(a.image)&&snapshot.isJpeg(b.image));
 assert.deepEqual(a.image,b.image,'Repeated requests use same cached desktop JPEG');
 assert.ok(snapshot.MIN_INTERVAL_MS>=1000,'Cache has rate limiting');
});
test('snapshot authentication stays independent from mouse arming',()=>{
 assert.equal(server.state().enabled,false,'Mouse input must default to disarmed');
 assert.equal(server.sameSubnet('192.168.4.39'),true);
 assert.equal(server.isValidCoord(10000),true);
 assert.equal(server.isValidCoord(10001),false);
 assert.equal(snapshot.isJpeg(Buffer.from('not an image')),false);
});
test('no second desktop capture or Codex submission API in the touchpad source',()=>{
 const code=fs.readFileSync(require('node:path').resolve(__dirname,'../server.cjs'),'utf8');
 assert.match(code,/getFrame\(\)/);
 assert.doesNotMatch(code,/gdigrab|Start-Process|codex\/submit|SendKeys|keybd_event/i);
 assert.match(code,/PORT=43198/);
});
