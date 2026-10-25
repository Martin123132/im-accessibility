'use strict';
// An offline-only regression suite: no Windows speaker changes, PC session,
// TV browser, task registration, or real child process launching.
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const launcher=require('../launch-host.cjs');
const runId='0123456789abcdef';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'owner-stale-start-'));
test('new owner supervisor records can be recovered only when the specific PID is gone',()=>{
 const dir=temp(),state=path.join(dir,'state.json'),stop=path.join(dir,'stop.json');
 try{
  fs.writeFileSync(state,JSON.stringify({runId,state:'ready',supervisorPid:4321}));
  const params={statePath:state,stopPath:stop,pidAliveFn:pid=>{assert.equal(pid,4321);return false}};
  assert.equal(launcher.checkState(params).stale,true);
  assert.throws(()=>launcher.checkState({...params,pidAliveFn:()=>true}),/existing or uncertain/);
  assert.throws(()=>launcher.checkState({...params,pidAliveFn:()=>null}),/existing or uncertain/);
  fs.writeFileSync(state,JSON.stringify({runId,state:'ready'}));
  assert.throws(()=>launcher.checkState(params),/existing or uncertain/,'Historical state without PID needs owner inspection');
  fs.writeFileSync(state,JSON.stringify({runId,state:'stopped'}));
  assert.equal(launcher.checkState(params).stale,false);
  fs.writeFileSync(state,JSON.stringify({runId,state:'ready',supervisorPid:4321}));
  fs.writeFileSync(stop,'owner stop pending');
  assert.throws(()=>launcher.checkState(params),/previous Stop/,'Stop always takes precedence over restart');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('startup never ignores unresolved laptop audio and never starts two streams',()=>{
 let recoveries=0,launches=0,unrefs=0;
 const source={
  stale:true,
  config:{executables:{nodeExe:'C:\\Verified\\node.exe'}},
  hostFile:'C:\\PrivateApp\\tv-reliability-v0.5\\resume-host.cjs',
  settingsFile:'C:\\PrivateApp\\settings.json'
 };
 const mockSpawn=()=>{launches++;return {pid:23456,unref(){unrefs++}}};
 assert.throws(()=>launcher.launch({
  preflightFn:()=>source,
  recoverFn:()=>{throw Error('Speaker recovery refused')},
  spawnFn:mockSpawn
 }),/Speaker recovery refused/);
 assert.equal(launches,0,'No TV stream started after failed restoration');
 const result=launcher.launch({
  preflightFn:()=>source,
  recoverFn:()=>{recoveries++},
  spawnFn:mockSpawn
 });
 assert.equal(result.requested,true);
 assert.equal(launches,1);assert.equal(unrefs,1);assert.equal(recoveries,1);
});
test('no private-port availability proof means no attempt to restore Windows audio',()=>{
 assert.throws(()=>launcher.recoverStaleAudio({
  runNativeFn:()=>({status:0,stdout:'TCP 0.0.0.0:43196 0.0.0.0:0 LISTENING 12345'})
 }),/TV video service still owns a private port/);
 assert.throws(()=>launcher.recoverStaleAudio({
  runNativeFn:()=>({status:1,stdout:''})
 }),/Cannot verify TV ports/);
 assert.throws(()=>launcher.recoverStaleAudio({
  runNativeFn:()=>({error:new Error('netstat unavailable'),status:null})
 }),/Cannot verify TV ports/);
});
