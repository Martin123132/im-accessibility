'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {status}=require('../status-session.cjs'),{stop}=require('../stop-session.cjs');
const config=require('../../tv-reliability-v0.5/release-config.cjs');
const guard=require('../../tv-reliability-v0.5/session-guard.cjs');
const launcher=require('../launch-host.cjs');
const runId='0123456789abcdef';
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-status-'));
 const stateFile=path.join(dir,'state.json'),journalFile=path.join(dir,'speaker-route.json');
 const selected={network:{name:'Wi-Fi',ip:'192.168.4.152',mask:'255.255.255.0'},television:{ip:'192.168.4.27'}};
 const record={runId,supervisorPid:1234,state:'ready',stream:'ready',viewer:'ready',lg:'opened',localIp:selected.network.ip,adapterName:'Wi-Fi',tvIp:selected.television.ip};
 const cast={runId,ok:true,mode:'LAN TV receiver',stream:'running',streamReady:true};
 const viewer={runId,service:'interactive-tv',ready:true,sourceReady:true,playback:'playing'};
 const writes=patch=>fs.writeFileSync(stateFile,JSON.stringify({...record,...patch}));writes({});
 const options={stateFile,journalFile,readConfig:()=>selected,pidAliveFn:()=>true,probeFn:async(ip,port)=>{
  assert.equal(ip,'192.168.4.152');assert.ok([43196,43198].includes(port));return port===43196?cast:viewer;
 }};
 return {dir,stateFile,journalFile,selected,record,cast,viewer,writes,options,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('GUI status resolves DHCP .36 to .152 and verifies BOTH services from the current run',async()=>{
 const f=fixture();try{
  const raw={schema:1,network:{adapterName:'Wi-Fi',localIp:'192.168.4.36'},television:{ip:'192.168.4.27',model:config.SUPPORTED_MODEL},executables:{nodeExe:'C:\\Test\\node.exe',ffmpegExe:'C:\\Test\\ffmpeg.exe'}};
  f.options.readConfig=()=>config.validateCurrentLease(raw,{networkInterfaces:{'Wi-Fi':[{family:'IPv4',internal:false,address:'192.168.4.152',netmask:'255.255.255.0'}]},existsFile:()=>true});
  const before=fs.readFileSync(f.stateFile,'utf8');
  const s=await status(f.options);assert.equal(s.videoReady,true);assert.equal(s.receiverConfirmed,true);
  assert.equal(raw.network.localIp,'192.168.4.36');assert.equal(fs.readFileSync(f.stateFile,'utf8'),before);
 }finally{f.close()}
});
for(const [label,mutate] of [
 ['stalled capture',f=>{f.cast.streamReady=false}],['viewer without source',f=>{f.viewer.sourceReady=false}],
 ['wrong session on port',f=>{f.cast.runId='f'.repeat(16)}],['unrelated web server',f=>{delete f.viewer.service}],
 ['no response',f=>{f.options.probeFn=async()=>{throw Error('connection refused')}}],
 ['stale supervisor PID',f=>{f.options.pidAliveFn=()=>false}],
 ['different NIC',f=>{f.selected.network.name='Ethernet'}],['different TV',f=>{f.selected.television.ip='192.168.4.28'}],
 ['in-session DHCP loss',f=>{f.writes({localIp:'192.168.4.36'})}],
 ['wrong subnet config',f=>{f.options.readConfig=()=>{throw Error('No matching physical private-LAN adapter')}}]
])test('GUI never claims healthy video for '+label,async()=>{const f=fixture();try{mutate(f);const s=await status(f.options);assert.equal(s.videoReady,false);assert.equal(s.receiverConfirmed,false);assert.ok(s.message)}finally{f.close()}});
test('ready services do not claim rendered TV playback or successful pairing',async()=>{
 const f=fixture();try{
  for(const playback of ['unconfirmed','buffering','paused','hidden','error']){
   f.viewer.playback=playback;const s=await status(f.options);assert.equal(s.videoReady,true);assert.equal(s.receiverConfirmed,false);
  }
  f.viewer.playback='playing';f.writes({lg:'pairing'});assert.match((await status(f.options)).message,/Approve/);
  f.writes({lg:'needs-tv'});assert.equal((await status(f.options)).receiverConfirmed,false);
 }finally{f.close()}
});
test('stopped status surfaces startup errors and pending audio without probing network',async()=>{
 const f=fixture();try{
  f.writes({state:'stopped',stopReason:'Start failure: encoder did not become ready'});
  f.options.probeFn=()=>{throw Error('must not probe')};
  assert.match((await status(f.options)).message,/encoder/);
  fs.writeFileSync(f.journalFile,'{}');assert.match((await status(f.options)).message,/restoration is pending/);
 }finally{f.close()}
});
test('Stop is network-independent, run-scoped and idempotent; audio failure is never hidden',()=>{
 const f=fixture();try{
  const signalPath=path.join(f.dir,'stop-request.json');let restored=0;
  const opts={statePath:f.stateFile,signalPath,journalPath:f.journalFile,recoverFn:()=>{restored++}};
  assert.equal(stop(opts).requested,true);assert.equal(JSON.parse(fs.readFileSync(signalPath)).runId,runId);
  assert.equal(stop(opts).requested,true);
  fs.writeFileSync(signalPath,JSON.stringify({runId:'f'.repeat(16)}));assert.throws(()=>stop(opts),/different session/);
  fs.unlinkSync(signalPath);f.writes({state:'stopped'});fs.writeFileSync(f.journalFile,'{}');
  assert.throws(()=>stop({...opts,recoverFn:()=>{throw Error('Device changed')}}),/Device changed/);
  assert.equal(stop(opts).requested,false);assert.equal(restored,1);
 }finally{f.close()}
});
test('all local TV listeners block startup, including wrong-address HTTP and IPv6',()=>{
 for(const local of ['0.0.0.0:43196','[::]:43198','192.168.4.36:43196','127.0.0.1:43198'])
  assert.throws(()=>guard.assertPortsAvailable({runNativeFn:()=>({status:0,stdout:'TCP '+local+' 0.0.0.0:0 LISTENING 777'})}),/still owns/);
 assert.throws(()=>guard.assertPortsAvailable({runNativeFn:()=>({status:1,stdout:''})}),/Cannot verify/);
 assert.doesNotThrow(()=>guard.assertPortsAvailable({runNativeFn:()=>({status:0,stdout:'TCP 127.0.0.1:8099 0.0.0.0:0 LISTENING 888'})}));
});
test('port conflicts and unresolved audio never spawn a new host',()=>{
 let starts=0;const opts={preflightFn:()=>({stale:false}),spawnFn:()=>{starts++;},portsFn:()=>{},fsApi:{existsSync:()=>true}};
 assert.throws(()=>launcher.launch(opts),/audio restoration is pending/);
 assert.throws(()=>launcher.launch({...opts,portsFn:()=>{throw Error('occupied')}}),/occupied/);assert.equal(starts,0);
});
test('simultaneous starts cannot acquire the same local session lock; release permits reconnect',async()=>{
 const f=fixture();try{
  const release=await guard.acquireLock(f.dir);
  try{await assert.rejects(guard.acquireLock(f.dir),/Another TV start/)}finally{await release()}
  const again=await guard.acquireLock(f.dir);await again();
 }finally{f.close()}
});

test('startup acknowledgement rejects silent host failure and stale records',async()=>{
 let now=0;const opts={now:()=>now,delay:async()=>{now+=1000},fsApi:{readFileSync:()=>JSON.stringify({supervisorPid:9,state:'ready'})}};
 await assert.rejects(launcher.awaitStartup(10,opts),/did not confirm/);
 now=0;opts.fsApi.readFileSync=()=>JSON.stringify({supervisorPid:10,state:'stopped',stopReason:'encoder failed'});
 await assert.rejects(launcher.awaitStartup(10,opts),/encoder failed/);
 opts.fsApi.readFileSync=()=>JSON.stringify({supervisorPid:10,state:'starting-video'});
 await launcher.awaitStartup(10,opts);
});
