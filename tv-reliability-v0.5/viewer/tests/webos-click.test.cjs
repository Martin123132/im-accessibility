'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web','viewer.html'),'utf8');
const css=fs.readFileSync(path.join(root,'web','style.css'),'utf8');
const script=fs.readFileSync(path.join(root,'web','viewer.js'),'utf8');
test('LG remote OK is reserved for overlay, not video play/pause',()=>{
 const tag=html.match(/<video\b[^>]*>/i)?.[0];
 assert.ok(tag,'Video tag exists');
 assert.doesNotMatch(tag,/\scontrols(?:\s|>|=)/,'Native video controls must be absent');
 assert.match(css,/\.stage video\{pointer-events:none!important/,'Ignore pointer interactions on video decoding surface');
 assert.match(html,/id="clicklayer"/);
 assert.match(html,/id="clicklast" disabled/);
 assert.match(script,/video\.controls=false/);
 assert.match(script,/video\.removeAttribute\("controls"\)/);
});
test('armed Magic Remote overlay click forwards one bounded Windows click, fallback matches',()=>{
 const events=new Map(),els=new Map(),posts=[],removed=[],callbacks=[];
 for(const id of ['video','display','stage','clicklayer','clickflash','hint','status','result','arm','disarm','up','down','clicklast','play','full','showpad','remote-pad','target-readout','step','preset-chat','preset-center','preset-right','move-left','move-up','move-down','move-right','clickpc','picture-pad','showpicture','snapshot-target','snapshot','snapshot-frame','picture-size','aim-point','snapshot-hint','preview-age','picture-coords','video-lag','aimed-click','refresh-picture','end-viewing','session-remaining']){
  const el={id,textContent:'',hidden:false,disabled:false,style:{},className:'',controls:true,videoWidth:1280,videoHeight:720,
    getBoundingClientRect(){return{left:100,top:50,width:1280,height:720}},
    addEventListener(type,listener){events.set(id+':'+type,listener)},
    removeAttribute(name){removed.push(name)},
    play(){return Promise.resolve()}};
  if(id==='remote-pad'||id==='picture-pad')el.hidden=true;
  if(id==='step')el.value='900';
  els.set(id,el);
 }
 let armed=false,now=100000,stopRequests=0;
 class FakeXHR{
  constructor(){this.readyState=0;this.status=0;this.responseText='';this.headers={}}
  open(method,route){this.method=method;this.route=route}
  setRequestHeader(name,value){this.headers[name]=value}
  send(body){
   let output={};
   if(this.route==='/api/status')output={enabled:armed,canArm:true};
   else if(this.route==='/api/arm'){armed=true;output={enabled:true,canArm:true}}
   else if(this.route==='/api/disarm'){armed=false;output={enabled:false,canArm:true}}
   else if(this.route==='/api/end'){stopRequests++;output={accepted:true}}
   else if(this.route==='/api/mouse'){
    const input=JSON.parse(body);posts.push(input);
    output={ok:true,receipt:{action:input.cmd,windowsX:Math.round(input.x*1919/10000),windowsY:Math.round(input.y*1079/10000)}}
   }else throw Error('Unexpected test route '+this.route);
   this.readyState=4;this.status=200;this.responseText=JSON.stringify(output);
   if(this.onreadystatechange)this.onreadystatechange();
  }
 }
 const context={
  document:{body:{className:''},getElementById(id){if(!els.has(id))throw Error('Unexpected DOM id '+id);return els.get(id)}},
  location:{pathname:'/tv/'+'a'.repeat(64)},
  XMLHttpRequest:FakeXHR,
  Date:{now(){now+=1000;return now},parse(){return 1200000}},
  setInterval(){return 1},setTimeout(fn){return 1},
  URL,Number,Math,JSON,Promise,isFinite,
  console
 };
 vm.runInNewContext(script,context,{timeout:3000});
 assert.equal(els.get('remote-pad').hidden,false,'Physically verified click pad must be visible immediately');
 assert.equal(els.get('showpad').textContent,'Hide click pad');
 assert.equal(context.document.body.className,'nav-open');
 assert.equal(els.get('clickpc').disabled,true,'Click stays OFF until owner arms');
 assert.equal(els.get('display').controls,false);
 assert.equal(els.get('display').style.pointerEvents,'none');
 assert.ok(removed.includes('controls'));
 const event={clientX:740,clientY:410,defaultPrevented:false,propagationStopped:false,
   preventDefault(){this.defaultPrevented=true},
   stopPropagation(){this.propagationStopped=true}};
 events.get('clicklayer:click')(event);
 assert.equal(posts.length,0,'Disarmed clicks must not reach Windows');
 assert.equal(event.defaultPrevented,true,'TV browser video default click must be cancelled');
 events.get('arm:click')();
 assert.equal(armed,true);
 assert.equal(els.get('clicklast').disabled,true,'Fallback is disabled until a desktop coordinate is selected');
 events.get('clicklayer:mousemove')({clientX:740,clientY:410});
 assert.equal(els.get('clicklast').disabled,false);
 events.get('clicklayer:click')(event);
 assert.equal(posts.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(posts[0])),{cmd:'click',x:5000,y:5000});
 assert.equal(event.propagationStopped,true);
 events.get('clicklast:click')();
 assert.equal(posts.length,2);
 assert.deepEqual(JSON.parse(JSON.stringify(posts[1])),{cmd:'click',x:5000,y:5000});
 events.get('disarm:click')();
 events.get('clicklayer:click')(event);
 assert.equal(posts.length,2,'Disarmed clicks must never reach native mouse driver');
 events.get('showpad:click')();
 assert.equal(els.get('remote-pad').hidden,true,'Owner can hide pad');
 events.get('showpad:click')();
 assert.equal(els.get('remote-pad').hidden,false,'Owner can reopen pad without touching video');
 assert.equal(context.document.body.className,'nav-open');
 events.get('arm:click')();
 events.get('preset-chat:click')();
 assert.deepEqual(JSON.parse(JSON.stringify(posts[2])),{cmd:'move',x:2300,y:4500},'Chat-column preset moves Windows cursor');
 events.get('clickpc:click')();
 assert.deepEqual(JSON.parse(JSON.stringify(posts[3])),{cmd:'click',x:2300,y:4500},'Dedicated button clicks Windows at selected target');
 events.get('move-up:click')();
 assert.deepEqual(JSON.parse(JSON.stringify(posts[4])),{cmd:'move',x:2300,y:3600},'Direction button moves target upward');
 events.get('clickpc:click')();
 assert.deepEqual(JSON.parse(JSON.stringify(posts[5])),{cmd:'click',x:2300,y:3600},'Click uses adjusted target');
 events.get('disarm:click')();
 events.get('clickpc:click')();
 assert.equal(posts.length,6,'Disarmed remote pad cannot click Windows');
 events.get('arm:click')();
 events.get('showpicture:click')();
 assert.equal(els.get('picture-pad').hidden,false,'Clickable picture must open');
 assert.match(els.get('snapshot').src,/^\/frame\/[a-f0-9]{64}\/\d+\.jpg$/);
 events.get('snapshot:load')();
 assert.equal(els.get('snapshot-target').disabled,false,'Clickable picture enables after load');
 const imageClick={clientX:420,clientY:338,preventDefault(){},stopPropagation(){}};
 events.get('snapshot-target:click')(imageClick);
 assert.deepEqual(JSON.parse(JSON.stringify(posts[6])),{cmd:'click',x:2500,y:4000},'Separate image button forwards exact desktop coordinates');
 events.get('aimed-click:click')();
 assert.deepEqual(JSON.parse(JSON.stringify(posts[7])),{cmd:'click',x:2500,y:4000},'Selected point fallback preserves intended click');
 events.get('disarm:click')();
 events.get('snapshot-target:click')(imageClick);
 assert.equal(posts.length,8,'After disarming, clickable picture cannot inject Windows input');
 events.get('end-viewing:click')();
 assert.equal(stopRequests,0,'First stop press must not terminate stream');
 events.get('end-viewing:click')();
 assert.equal(stopRequests,1,'Second stop press must terminate exactly one session');
});
