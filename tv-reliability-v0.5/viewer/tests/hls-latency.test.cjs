'use strict';
// Source-only simulation: native LG HLS playhead drift, stalled picture, session recovery.
// No real desktop input, LG pairing, network, audio or installed application.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.resolve(__dirname,'../web/immersive.js'),'utf8');
const broker=fs.readFileSync(path.resolve(__dirname,'../server.cjs'),'utf8');
function harness(){
 const token='a'.repeat(64),elements=new Map(),handlers={},timers=[],requests=[];
 let now=100000,loads=0;
 const ids=['desktop','surface','controls','control-toggle','control-panel','enable','pause',
  'play','catchup','quality','fast','sound','laptop','classic','stop','status','hint','marker'];
 for(const id of ids)elements.set(id,{
  id,textContent:'',disabled:false,hidden:false,style:{},controls:false,muted:true,
  currentTime:10,paused:false,videoWidth:1280,videoHeight:720,
  seekable:{length:1,start(){return 0},end(){return 22}},
  removeAttribute(){},setAttribute(k,v){this[k]=v},
  getBoundingClientRect(){return {left:0,top:0,width:1920,height:1080}},
  addEventListener(name,fn){handlers[id+':'+name]=fn},
  play(){this.paused=false;return Promise.resolve()},
  load(){loads++},
 });
 class XHR{
  constructor(){this.readyState=0;this.status=0;this.responseText=''}
  open(method,route){this.method=method;this.route=route}
  setRequestHeader(){}
  send(data){requests.push({xhr:this,route:this.route,body:data,completed:false})}
 }
 function complete(route,body,status=200){
  const q=requests.find(p=>p.route==='/api/'+route&&!p.completed);
  assert.ok(q,'Expected pending '+route);
  q.completed=true;q.xhr.status=status;q.xhr.responseText=JSON.stringify(body);q.xhr.readyState=4;
  q.xhr.onreadystatechange();
 }
 vm.runInNewContext(code,{
  location:{pathname:'/full/'+token},
  document:{visibilityState:'visible',getElementById(id){
   assert.ok(elements.has(id),'Unknown element '+id);return elements.get(id)
  }},
  XMLHttpRequest:XHR,
  Date:{now:()=>now,parse:s=>new Date(s).getTime()},
  setTimeout(){},setInterval(fn,interval){timers.push({fn,interval})},
  isFinite,Math,Number,Promise,JSON,console
 },{timeout:3000});
 const ticker=period=>{const t=timers.find(t=>t.interval===period);assert.ok(t,'timer '+period);t.fn()};
 return {video:elements.get('desktop'),events:handlers,requests,
  get loads(){return loads},tick:ticker,complete,
  advance(ms){now+=ms},
  get now(){return now}
 };
}
test('seekable playhead catches up only after meaningful drift, without replacing native HLS video',()=>{
 const h=harness();
 h.complete('status',{canArm:true,enabled:false,sourceReady:true,audioAvailable:true,
  recoveryCount:0,expiresAt:'2031-01-01T00:00:00Z'});
 h.tick(2000);
 assert.equal(h.video.currentTime,20.2,'Initial catch-up leaves 1.8 seconds of native decoder headroom');
 assert.equal(h.loads,0,'A catch-up seek must not reset the video decoder');
 assert.equal(h.requests.filter(p=>p.route==='/api/mouse').length,0);
});
test('an advancing native LG decoder is not repeatedly jerked to the live edge',()=>{
 const h=harness();
 h.complete('status',{canArm:true,enabled:false,sourceReady:true,
  recoveryCount:0,expiresAt:'2031-01-01T00:00:00Z'});
 h.tick(2000);
 assert.equal(h.video.currentTime,20.2);
 h.advance(22000);
 h.video.currentTime=25;
 h.video.seekable={length:1,start(){return 0},end(){return 40}};
 h.tick(2000);
 assert.equal(h.video.currentTime,25,'Do not repeatedly seek a progressing decoder');
});

test('stalled decoder reloads boundedly and follows explicit server encoder-recovery counter',()=>{
 const h=harness();
 h.complete('status',{canArm:true,enabled:false,sourceReady:true,recoveryCount:0,
  expiresAt:'2031-01-01T00:00:00Z'});
 h.video.currentTime=4;
 h.video.seekable={length:0};
 h.tick(2000);
 h.advance(10200);
 h.tick(2000);
 assert.equal(h.loads,1,'Stopped HLS playhead causes native video reload');
 h.tick(2000);
 assert.equal(h.loads,1,'Repeated stale checks cannot reload in a tight loop');
 h.advance(14000);
 h.events['catchup:click']();
 assert.equal(h.loads,2,'Owner can manually refresh the same native HLS player');
 h.tick(2800);
 h.complete('status',{canArm:true,enabled:false,sourceReady:true,recoveryCount:1,
  expiresAt:'2031-01-01T00:00:00Z'});
 assert.equal(h.loads,2,'A short repeat after manual reload is rate limited');
 assert.equal(h.requests.filter(p=>p.route==='/api/mouse').length,0);
});
test('Cinema mode leaves intentional HLS buffering alone and never seeks near live edge',()=>{
 const h=harness();
 h.complete('status',{canArm:true,enabled:false,sourceReady:true,
  qualityMode:'cinema',recoveryCount:0,expiresAt:'2031-01-01T00:00:00Z'});
 h.tick(2000);
 assert.equal(h.video.currentTime,10,'Cinema keeps the 12-second buffer instead of skipping forward');
 assert.equal(h.loads,0);
});
test('mouse broker refuses clicks and arming when HLS capture is stale',()=>{
 assert.match(broker,/if\(!upstream\.streamReady\)enabled=false/);
 assert.match(broker,/Live desktop picture is not current; mouse remains disabled/);
 assert.match(broker,/Desktop picture stalled; Windows mouse disabled/);
 assert.match(broker,/route==='\/api\/mouse'/);
 assert.match(code,/video\.load\(\)/);
 assert.doesNotMatch(code,/requestFullscreen|webkitEnterFullscreen/);
});
