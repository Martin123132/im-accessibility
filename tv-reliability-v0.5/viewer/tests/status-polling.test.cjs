'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function dom(){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:true,disabled:false,value:'',style:{},events:{},
  addEventListener(type,fn){this.events[type]=fn},removeAttribute(){},play(){return Promise.resolve()},
  getBoundingClientRect(){return {left:0,top:0,width:1280,height:720}}});return elements.get(id);};
 return {get,document:{body:{className:''},getElementById:get}};
}
function viewer(){
 const d=dom(),requests=[],timers=[];
 class XHR{
  open(method,route){this.method=method;this.route=route;}
  setRequestHeader(){}
  send(){requests.push(this);}
  respond(value,status=200){this.status=status;this.readyState=4;this.responseText=JSON.stringify(value);this.onreadystatechange();}
 }
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/viewer.js'),'utf8'),{
  document:d.document,location:{pathname:'/tv/'+'a'.repeat(64)},XMLHttpRequest:XHR,
  setInterval(fn,delay){timers.push({fn,delay});return timers.length},setTimeout(){},URL,Date,Math,JSON,Number,isFinite
 });
 return {...d,requests,poll:()=>timers.find(t=>t.delay===2600).fn()};
}
test('TV status requests never overlap and resume after errors',()=>{
 const f=viewer();assert.equal(f.requests.length,1);
 for(let i=0;i<10;i++)f.poll();assert.equal(f.requests.length,1);
 f.requests[0].respond({enabled:false,canArm:true,expiresAt:'2099-01-01'});f.poll();assert.equal(f.requests.length,2);
 // Browsers can report readyState=4 and then onerror for the same failed XHR.
 f.requests[1].respond({},0);f.poll();assert.equal(f.requests.length,3);
 f.requests[1].onerror();f.poll();assert.equal(f.requests.length,3,'old error must not release the current request');
 f.requests[2].ontimeout();f.poll();assert.equal(f.requests.length,4);
});
test('a delayed status cannot undo newer owner mouse controls',()=>{
 const f=viewer(),oldStatus=f.requests[0];
 f.get('arm').events.click();assert.equal(f.requests[1].route,'/api/arm');
 f.requests[1].respond({enabled:true});assert.equal(f.get('arm').disabled,true);
 oldStatus.respond({enabled:false,canArm:true,expiresAt:'2099-01-01'});
 assert.equal(f.get('arm').disabled,true,'stale pre-arm status is ignored');
 f.poll();f.requests[2].respond({enabled:false,canArm:false,expiresAt:'2000-01-01'});
 assert.equal(f.get('disarm').disabled,true,'fresh expiry still disables controls');
 assert.match(f.get('result').textContent,/Session expired/);
});
function controller(){
 const d=dom(),requests=[],timers=[];
 const fetch=(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,reject,respond(data){resolve({ok:true,json:async()=>data})}}));
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../cast/web/controller.js'),'utf8'),{
  document:d.document,location:{pathname:'/',hash:''},sessionStorage:{getItem:()=> 'a'.repeat(48)},history:{replaceState(){}},
  fetch,URLSearchParams,AbortSignal,Intl,Date,setInterval(fn){timers.push(fn)},navigator:{}
 });
 return {...d,requests,poll:()=>timers[0]()};
}
test('controller coalesces slow status polls and still refreshes after stream actions',async()=>{
 const f=controller();assert.equal(f.requests.length,1);
 for(let i=0;i<10;i++)f.poll();assert.equal(f.requests.length,1);
 const stop=f.get('stop').onclick();assert.equal(f.requests[1].url,'/api/stop');
 f.requests[1].respond({});await stop;
 f.requests[0].respond({state:'running',streamReady:true});await tick();
 assert.equal(f.requests.length,3);assert.equal(f.requests[2].url,'/api/status');
 assert.equal(f.get('stream-status').textContent,'','stale pre-stop reply was not rendered');
 f.requests[2].respond({state:'stopped',streamReady:false,resolution:'1280x720',targetFps:30});await tick();
 assert.match(f.get('stream-status').textContent,/stopped/);assert.equal(f.get('start').disabled,false);
});
test('controller polling recovers after a failed status request',async()=>{
 const f=controller();f.requests[0].reject(Error('Offline'));await tick();
 assert.equal(f.get('app-error').textContent,'Offline');f.poll();assert.equal(f.requests.length,2);
 f.requests[1].respond({state:'running',streamReady:true,resolution:'1280x720',targetFps:30});await tick();
 assert.match(f.get('stream-status').textContent,/ready/);
});
