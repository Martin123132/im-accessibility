'use strict';
// Pure simulated server/browser states only; absolutely no real LG commands.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const guard=require('../lg-active-view.cjs');

const fixedNow=Date.parse('2026-10-23T20:00:00Z');
const settings={
 network:{ip:'192.168.4.36',mask:'255.255.252.0'},
 television:{model:'OLED55CX6LA',ip:'192.168.4.23'}
};
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-activity-'));
 fs.mkdirSync(path.join(root,'runtime'));
 fs.mkdirSync(path.join(root,'viewer','runtime'),{recursive:true});
 const s={runId:'0123456789abcdef',state:'ready',lg:'opened',
  lgIp:settings.television.ip,viewer:'ready',stream:'ready',
  expectedEndUtc:new Date(fixedNow+3*60*60*1000).toISOString()};
 const v={url:'http://192.168.4.36:43198/tv/'+'a'.repeat(64),
  expiresAt:new Date(fixedNow+3*60*60*1000).toISOString()};
 const state=path.join(root,'runtime','state.json');
 const viewer=path.join(root,'viewer','runtime','session.json');
 function write(){fs.writeFileSync(state,JSON.stringify(s));fs.writeFileSync(viewer,JSON.stringify(v))}
 write();
 return {root,s,v,state,viewer,write,close(){fs.rmSync(root,{recursive:true,force:true})}};
}
function readyFetch(url){
 if(url.endsWith(':43196/health'))return Promise.resolve({ok:true,json:async()=>({build:'tv-resume-v0.5',stream:'running'})});
 if(url.endsWith(':43198/health'))return Promise.resolve({ok:true,json:async()=>({build:'tv-resume-v0.5',ready:true,sourceReady:true})});
 throw Error('unexpected network address '+url);
}
function mockTv(initial='Active',foreground='com.webos.app.browser'){
 const tv={requests:[],power:initial,request:async u=>{
  tv.requests.push(u);
  if(u.includes('getForegroundAppInfo'))return {appId:foreground};
  if(u.includes('getPowerState'))return {state:tv.power};
  throw Error('unexpected TV request');
 }};
 const moves=[];
 const socket={send:(cmd,p)=>{assert.equal(cmd,'move');assert.deepEqual(Object.keys(p).sort(),['dx','dy']);moves.push({...p});if(initial==='Screen Saver')tv.power='Active'}};
 return {tv,socket,moves};
}
test('valid session is bounded to approved physical TV, user stream and expiry',()=>{
 const f=fixture();
 try{
  const s=guard.boundSession({root:f.root,settings,now:fixedNow});
  assert.equal(s.runId,f.s.runId);
  assert.equal(s.expiresAtMs,fixedNow+3*60*60*1000);
  f.s.lgIp='192.168.4.39';f.write();
  assert.equal(guard.boundSession({root:f.root,settings,now:fixedNow}),null);
  f.s.lgIp=settings.television.ip;f.write();
  assert.equal(guard.boundSession({root:f.root,settings,now:fixedNow+3*60*60*1000}),null);
  f.s.expectedEndUtc=new Date(fixedNow+5*60*60*1000).toISOString();f.write();
  assert.equal(guard.boundSession({root:f.root,settings,now:fixedNow}),null);
 }finally{f.close()}
});
test('STOP signal, ended stream and unexpected viewer URL fail closed',()=>{
 const f=fixture();
 try{
  f.v.url='https://example.com/tv/'+'a'.repeat(64);f.write();
  assert.equal(guard.boundSession({root:f.root,settings,now:fixedNow}),null);
  f.v.url='http://192.168.4.36:43198/tv/'+'a'.repeat(64);f.s.state='stopped';f.write();
  assert.equal(guard.boundSession({root:f.root,settings,now:fixedNow}),null);
  f.s.state='ready';f.write();
  fs.writeFileSync(path.join(f.root,'runtime','stop-request.json'),'stop');
  assert.equal(guard.boundSession({root:f.root,settings,now:fixedNow}),null);
 }finally{f.close()}
});
test('only one-pixel LG moves when a browser is viewing healthy video',async()=>{
 const f=fixture(),m=mockTv();
 try{
  const res=await guard.activityTick({root:f.root,settings,now:fixedNow,...m,
   fetchFn:readyFetch,delta:1});
  assert.equal(res.active,true);
  assert.equal(res.moved,true);
  assert.equal(res.previousPower,'Active');
  assert.deepEqual(m.moves,[{dx:1,dy:0}]);
  assert.equal(m.tv.requests.length,2);
 }finally{f.close()}
});
test('TV screensaver can recover without a click or touching protection settings',async()=>{
 const f=fixture(),m=mockTv('Screen Saver');
 try{
  let sleeps=0;
  const res=await guard.activityTick({root:f.root,settings,now:fixedNow,...m,
   fetchFn:readyFetch,delta:-1,delayFn:async ms=>{assert.equal(ms,1600);sleeps++}});
  assert.equal(res.newPower,'Active');assert.equal(sleeps,1);
  assert.deepEqual(m.moves,[{dx:-1,dy:0}]);
  assert.equal(m.tv.requests.length,3);
 }finally{f.close()}
});
test('never signal TV while a different application is foreground',async()=>{
 const f=fixture(),m=mockTv('Active','com.webos.app.youtube');
 try{
  const res=await guard.activityTick({root:f.root,settings,now:fixedNow,...m,
   fetchFn:readyFetch});
  assert.equal(res.moved,false);assert.equal(res.why,'browser-not-foreground');
  assert.equal(m.moves.length,0);
 }finally{f.close()}
});
test('never fake TV activity during standby, suspend or failed stream',async()=>{
 const f=fixture();
 try{
  for(const state of ['Suspend','Active Standby','Screen Off']){
   const m=mockTv(state);
   const r=await guard.activityTick({root:f.root,settings,now:fixedNow,...m,fetchFn:readyFetch});
   assert.equal(r.moved,false);assert.equal(m.moves.length,0);
  }
  const m=mockTv('Active');
  const failedFetch=async url=>({ok:true,json:async()=>
   url.includes('43196')?{build:'tv-resume-v0.5',stream:'stopped'}:{build:'tv-resume-v0.5',ready:true,sourceReady:true}});
  const r=await guard.activityTick({root:f.root,settings,now:fixedNow,...m,fetchFn:failedFetch});
  assert.equal(r.moved,false);assert.equal(r.why,'video-not-ready');assert.equal(m.moves.length,0);
 }finally{f.close()}
});
test('no movement permitted after owner session stops or viewer expires',async()=>{
 const f=fixture(),m=mockTv('Active');
 try{
  const r=await guard.activityTick({root:f.root,settings,now:fixedNow+4*60*60*1000,...m,fetchFn:readyFetch});
  assert.equal(r.active,false);assert.equal(r.why,'session-ended');
  assert.equal(m.moves.length,0);assert.equal(m.tv.requests.length,0);
 }finally{f.close()}
});
test('health queries are pinned to exact local source and viewer ports',async()=>{
 const observed=[];
 const yes=await guard.servicesReady(settings,{fetchFn:async (u)=>{observed.push(u);return readyFetch(u)}});
 assert.equal(yes,true);assert.deepEqual(observed.sort(),[
 'http://192.168.4.36:43196/health','http://192.168.4.36:43198/health'
 ]);
});
