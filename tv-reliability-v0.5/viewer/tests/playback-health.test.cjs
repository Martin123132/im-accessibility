'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PlaybackHealth}=require('../playback-health.cjs');
const report={currentTime:1,readyState:3,paused:false,ended:false,hidden:false,error:false};
test('only selected TV with advancing media reports playing; stalled/lost telemetry expires',()=>{
 let now=1000;const h=new PlaybackHealth('192.168.4.27',()=>now);
 assert.equal(h.state(),'unconfirmed');
 assert.throws(()=>h.report('192.168.4.28',report),/selected TV/);
 h.report('::ffff:192.168.4.27',report);assert.equal(h.state(),'buffering');
 now+=3000;h.report('192.168.4.27',{...report,currentTime:4});assert.equal(h.state(),'playing');
 now+=10001;assert.equal(h.state(),'unconfirmed');
 h.report('192.168.4.27',{...report,currentTime:4});assert.equal(h.state(),'buffering');
});
test('pause, hidden page, buffering and errors revoke playback confirmation',()=>{
 for(const patch of [{paused:true},{hidden:true},{ended:true},{error:true},{readyState:1}]){
  let now=0;const h=new PlaybackHealth('10.1.2.3',()=>now);
  h.report('10.1.2.3',report);now=3000;h.report('10.1.2.3',{...report,currentTime:4});
  assert.equal(h.state(),'playing');now+=3000;h.report('10.1.2.3',{...report,currentTime:7,...patch});assert.notEqual(h.state(),'playing');
 }
});
test('malformed telemetry and a seek alone cannot prove playback',()=>{
 let now=0;const h=new PlaybackHealth('10.1.2.3',()=>now);
 for(const patch of [{currentTime:NaN},{currentTime:-1},{readyState:5},{paused:'false'},{unexpected:true}])assert.throws(()=>h.report('10.1.2.3',{...report,...patch}),/Invalid/);
 h.report('10.1.2.3',report);now=3000;h.report('10.1.2.3',{...report,currentTime:200});assert.equal(h.state(),'buffering');
});
