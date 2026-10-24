'use strict';
// Deterministic LG MediaSource playback-stall regression. No TV/network/Windows changes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.resolve(__dirname,'../web/fast-video.js'),'utf8');
const TOKEN='a'.repeat(64);
function browser(storageData={},t=1000000){
 let now=t,timer=null,mse=null,socket=null,closed=0,loaded=0,released=0,disarm=0,reloaded=0,go=null;
 const statuses=[],store=storageData,removals=[],decoderMessages=[];
 const video={muted:true,defaultMuted:true,paused:false,readyState:4,currentTime:5,
  currentSrc:'',webkitDecodedFrameCount:12,
  buffered:{length:1,start(){return 0},end(){return 9}},
  pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},
  removeAttribute(){},load(){loaded++}};
 function MediaSource(){mse=this;this.listeners={};this.readyState='open'}
 MediaSource.isTypeSupported=()=>true;
 MediaSource.prototype.addEventListener=function(name,cb){this.listeners[name]=cb};
 MediaSource.prototype.removeSourceBuffer=function(){released++};
 MediaSource.prototype.addSourceBuffer=function(){
  return {updating:false,mode:'segments',listeners:{},appendBuffer(){},
   addEventListener(name,cb){this.listeners[name]=cb},
   remove(start,end){removals.push([start,end])}};
 };
 class WebSocket {
  constructor(u){socket=this;this.url=u;this.readyState=1;this.binaryType='arraybuffer'}
  close(){this.readyState=3;closed++}
  send(msg){decoderMessages.push(JSON.parse(String(msg)))}
 }
 class XMLHttpRequest{
  open(method,url){this.method=method;this.url=url}
  setRequestHeader(){}
  send(data){if(this.method==='POST'&&this.url==='/api/disarm'&&data==='{}')disarm++}
 }
 const win={sessionStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=String(v)},removeItem(k){delete store[k]}}};
 const location={
  protocol:'http:',host:'192.168.4.36:43198',reload(){reloaded++},
  replace(url){go=url},set href(url){go=url}
 };
 const ctx={window:win,MediaSource,WebSocket,XMLHttpRequest,location,
  document:{visibilityState:'visible'},
  URL:{createObjectURL(){return'blob:sample'},revokeObjectURL(){}},
  Date:{now:()=>now},isFinite,Number,Math,JSON,
  Promise,Uint8Array,setInterval(fn){timer=fn;return 10},
  clearInterval(){},setTimeout(){return 11},clearTimeout(){},console};
 vm.runInNewContext(code,ctx,{timeout:3000});
 const m=win.ImAccessibilityFastVideo;
 assert.equal(m.start(video,TOKEN,x=>statuses.push(String(x))),true);
 assert.ok(mse,'Expected media source');
 mse.listeners.sourceopen();
 assert.ok(socket,'Expected authenticated WebSocket');
 return {video,socket,statuses,store,
  get decoderMessages(){return decoderMessages},
  get removals(){return removals},
  step(ms,sendPacket=true){
   now+=ms;
   if(sendPacket&&socket&&socket.readyState===1)
    socket.onmessage({data:new ArrayBuffer(9)});
   timer();
  },
  get reloaded(){return reloaded},
  get goto(){return go},
  get disarm(){return disarm},
  get closed(){return closed},
  get loaded(){return loaded},
  get released(){return released}
 };
}
test('LG decoded-frame freeze attempts live seek then controlled document reconnect with mouse disarm',()=>{
 const c=browser();
 c.step(1000); // Baseline first decoder frame reading
 assert.equal(c.reloaded,0);
 c.step(8200); // No decoded-frame progress: attempt a live-edge seek
 assert.ok(c.statuses.some(x=>x.includes('Picture stalled')||x.includes('Fast picture stalled')));
 c.step(4000); // Seek failed: controlled document reload
 assert.equal(c.reloaded,1,'A stalled decoder reloads the dedicated MSE document');
 assert.equal(c.disarm,1,'Windows mouse permission was revoked before reload');
 assert.ok(c.closed>=1,'Old WebSocket was closed');
 assert.equal(c.goto,null,'One isolated freeze need not downgrade to HLS');
 assert.equal(JSON.parse(c.store['imaccess-fast-restarts-v1']).count,1);
});
test('After two short-spaced decoder freezes the third fails back to the original HLS page',()=>{
 const store={};
 for(let iteration=1;iteration<=3;iteration++){
  const c=browser(store,1000000+iteration*16000);
  c.step(1000);
  c.step(8200);
  c.step(4000);
  if(iteration<3)assert.equal(c.reloaded,1);
  else{
   assert.equal(c.reloaded,0);
   assert.equal(c.goto,'/full/'+TOKEN);
   assert.ok(!store['imaccess-fast-restarts-v1']);
  }
  assert.equal(c.disarm,1);
 }
});
test('Progressing LG decoded-frame count keeps MSE fast mode active without refresh',()=>{
 const c=browser();
 for(let i=0;i<14;i++){
  c.video.webkitDecodedFrameCount+=6;
  c.video.currentTime+=1;
  c.step(1100);
 }
 assert.equal(c.reloaded,0);
 assert.equal(c.goto,null);
 assert.equal(c.disarm,0);
});
test('An LG decoder stuck at readyState zero and playback time zero also recovers',()=>{
 const c=browser();
 c.video.readyState=0;
 c.video.currentTime=0;
 c.video.webkitDecodedFrameCount=0;
 c.step(1000);
 c.step(8200);
 c.step(4000);
 assert.equal(c.reloaded,1,'A decoder stuck before its first frame must not hang forever');
 assert.equal(c.disarm,1,'Windows mouse must be revoked even before the first picture');
});

test('MSE pruning retains at least eight seconds behind playhead and avoids frequent remove()',()=>{
 const c=browser();
 c.video.currentTime=29;
 c.video.buffered={length:1,start(){return 0},end(){return 34}};
 c.step(1100);
 assert.equal(c.removals.length,1,'Old MSE frames are eventually pruned');
 const first=c.removals[0];
 assert.ok(first[1]<=c.video.currentTime-8,'Never prune close to decoded playhead');
 assert.ok(first[1]<=34-12,'Retain 12 seconds near live edge');
 c.video.webkitDecodedFrameCount+=5;
 c.step(1100);
 c.video.webkitDecodedFrameCount+=5;
 c.step(1100);
 assert.equal(c.removals.length,1,'Repeated small trims must not churn LG decoder');
});
test('LG MSE pruning includes stale earlier disjoint buffered ranges',()=>{
 const c=browser();
 c.video.currentTime=29;
 c.video.buffered={length:2,
  start(i){return i===0?0:24},
  end(i){return i===0?6:34}};
 c.step(1100);
 assert.equal(c.removals.length,1,'Disjoint old frames must not remain retained');
 assert.equal(c.removals[0][0],0,'Prune from the oldest range, not the live range');
 assert.ok(c.removals[0][1]<=c.video.currentTime-8,'Preserve eight seconds behind actual seek-adjusted playhead');
 assert.ok(c.removals[0][1]<=22,'Retain twelve seconds before buffered live edge');
});

test('Closing a frozen MSE stream releases SourceBuffer and detaches video decoder',()=>{
 const c=browser();
 c.step(1000);
 c.step(8200);
 c.step(4000);
 assert.equal(c.released,1,'Release old SourceBuffer instead of leaving an orphan');
 assert.ok(c.loaded>=1,'Detach src and request hardware decoder release');
});

test('MSE seek throttling avoids repeated hardware decoder resets',()=>{
 const c=browser();
 c.video.buffered={length:1,start(){return 0},end(){return 12}};
 c.video.currentTime=1;
 c.video.webkitDecodedFrameCount+=1;
 c.step(1100);
 assert.ok(c.video.currentTime>10,'Large drift is corrected');
 c.video.currentTime=1;
 c.video.webkitDecodedFrameCount+=1;
 c.step(1100);
 assert.equal(c.video.currentTime,1,'A second seek inside cooldown is refused');
 c.video.webkitDecodedFrameCount+=1;
 c.step(3900);
 assert.ok(c.video.currentTime>10,'Later real drift may be corrected');
});
test('Real LG decoder health is sampled over its existing authenticated media WebSocket',()=>{
 const c=browser();
 for(let i=0;i<10;i++){
  c.video.webkitDecodedFrameCount+=15;
  c.video.currentTime+=1;
  c.step(1100);
 }
 assert.ok(c.decoderMessages.length>=3&&c.decoderMessages.length<=5,'Bounded 2.2s telemetry cadence');
 const record=c.decoderMessages[c.decoderMessages.length-1];
 assert.equal(record.kind,'decoder');
 assert.ok(record.frameCount>15);
 assert.equal(record.paused,false);
 assert.equal(record.readyState,4);
 assert.equal(record.visible,true);
 assert.ok(record.positionMs>10000);
 assert.ok(record.gapMs===null||Number.isInteger(record.gapMs));
 assert.ok(record.queueLength>=0);
 assert.equal(c.reloaded,0);
 assert.equal(c.closed,0);
});
test('Fast video source defines authenticated same-LAN server-side disarm on disconnect',()=>{
 const backend=fs.readFileSync(path.resolve(__dirname,'../fast-video.cjs'),'utf8');
 const viewer=fs.readFileSync(path.resolve(__dirname,'../server.cjs'),'utf8');
 assert.match(backend,/onDisconnect\(lastCloseReason\)/);
 assert.match(viewer,/onDisconnect:\(\)=>\{enabled=false;enabledUntil=0\}/);
 assert.match(viewer,/fastVideoStatus:fastVideoController\?fastVideoController.snapshot/);
});
