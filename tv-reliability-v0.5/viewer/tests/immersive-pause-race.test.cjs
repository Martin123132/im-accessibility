'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','web','immersive.js'),'utf8');
test('Pause cancels local clicks immediately, survives stale Arm and in-flight Click replies',()=>{
 const events=new Map(),elements=new Map(),requests=[];
 const ids=['desktop','surface','status','hint','control-toggle','control-panel','enable','pause','play','catchup','fast','sound','laptop','classic','stop','marker'];
 for(const id of ids)elements.set(id,{
  id,style:{},disabled:false,hidden:true,textContent:'',controls:true,
  videoWidth:1280,videoHeight:720,removeAttribute(){},setAttribute(k,v){this[k]=v},
  getBoundingClientRect(){return{left:0,top:0,width:1920,height:1080}},
  addEventListener(name,fn){events.set(id+':'+name,fn)},
  play(){return Promise.resolve()}
 });
 let now=100000;
 class XHR{
  constructor(){this.readyState=0;this.status=0;this.responseText=''}
  open(method,route){this.method=method;this.route=route}
  setRequestHeader(){}
  send(body){requests.push({xhr:this,route:this.route,data:body&&JSON.parse(body),completed:false})}
 }
 function complete(route,body){
  const req=requests.find(r=>r.route==='/api/'+route&&!r.completed);
  assert.ok(req,'Expected request '+route);
  req.completed=true;req.xhr.readyState=4;req.xhr.status=200;
  req.xhr.responseText=JSON.stringify(body);req.xhr.onreadystatechange();
  return req;
 }
 const env={location:{pathname:'/full/'+'a'.repeat(64)},document:{getElementById:id=>{
  assert.ok(elements.has(id),'Unexpected element '+id);return elements.get(id);
 }},XMLHttpRequest:XHR,
 Date:{now:()=>now,parse:x=>new Date(x).getTime()},
 setTimeout(){},setInterval(){},Number,Math,Promise,isFinite,JSON,console};
 vm.runInNewContext(code,env,{timeout:3000});
 const fire=(id,type,event)=>events.get(id+':'+type)(event);
 const click=()=>fire('surface','click',{clientX:960,clientY:540,preventDefault(){},stopPropagation(){}});
 const mouseRequests=()=>requests.filter(r=>r.route==='/api/mouse');
 complete('status',{canArm:true,enabled:false,expiresAt:'2030-01-01T00:00:00Z'});
 click();assert.equal(mouseRequests().length,0,'unarmed click blocked');
 fire('enable','click');
 assert.equal(elements.get('pause').disabled,false,'Pause is available during an unconfirmed Arm');
 fire('pause','click');
 assert.equal(elements.get('enable').disabled,true,'Pause immediately revokes client-side permission');
 click();assert.equal(mouseRequests().length,0,'click is blocked while Pause is pending');
 complete('disarm',{enabled:false});
 complete('arm',{enabled:true});
 assert.equal(requests.filter(r=>r.route==='/api/disarm').length,2,'stale Arm forces a second server disarm');
 complete('disarm',{enabled:false});
 assert.equal(elements.get('pause').disabled,true);
 assert.equal(elements.get('enable').disabled,false);
 click();assert.equal(mouseRequests().length,0,'stale Arm cannot revive the click surface');
 fire('enable','click');
 complete('arm',{enabled:true});
 now+=1000;
 click();assert.equal(mouseRequests().length,1,'one normal armed click forwarded');
 fire('pause','click');
 click();assert.equal(mouseRequests().length,1,'a second click is locally rejected even during prior input');
 complete('disarm',{enabled:false});
 complete('mouse',{ok:true,receipt:{action:'click',windowsX:960,windowsY:540}});
 assert.equal(mouseRequests().length,1);
 assert.equal(elements.get('pause').disabled,true);
 assert.equal(elements.get('enable').disabled,false);
});
