'use strict';
// Execute the real server module using fake FFmpeg processes and an in-memory
// filesystem. No network listener, TV connection, Windows audio/desktop
// capture, real filesystem writes, permissions or installed binaries touched.
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),
 {EventEmitter}=require('node:events');
const serverSource=fs.readFileSync(path.join(__dirname,'..','server.cjs'),'utf8');
const policy=require('../encoder-fallback.cjs');
function sandbox(audio=false){
 const timers=[],spawns=[],modes=[];
 const fakeFs={
  mkdirSync(){},readdirSync(){return []},
  statSync(){throw Error('No HLS playlist yet')},
  existsSync(p){return String(p).includes('qa-fake-ffmpeg.exe')},
  unlinkSync(){},readFileSync(){throw Error('No file reads in simulation')}
 };
 const fakeCP={
  spawn(binary,args){
   assert.match(String(binary),/qa-fake-(ffmpeg|loopback)/);
   const child=new EventEmitter();
   child.stderr=new EventEmitter();
   child.stdout=new (require('node:stream').PassThrough)();
   child.pid=spawns.length+300;
   child.exitCode=null;child.killed=false;
   child.kill=signal=>{child.killed=true;child.signalSent=signal;return true;};
   child.stdio=[null,child.stdout,child.stderr,new (require('node:stream').PassThrough)()];
   spawns.push(child);
   return child;
  }
 };
 const fakeSound={
  isAudioOptIn:()=>audio,encoderKind:()=> 'h264_mf',
  BINARY:'qa-fake-loopback.exe',probe:()=>({deviceIdHash:'a'.repeat(64)}),
  argsFor(dir,format,index,mode,codec){
   modes.push({codec,format,mode});
   return ['-c:v',codec];
  },
  qualityProfile:()=>({})
 };
 const libs={
  'node:http':require('node:http'),
  'node:fs':fakeFs,'node:path':path,
  'node:child_process':fakeCP,'node:crypto':require('node:crypto'),
  './lan.cjs':{LAN_IP:'10.44.2.10',PORT:43196,isLocalIp:()=>true},
  './tv-discovery.cjs':{discover:async()=>[]},
  './lg-launch.cjs':{launchTv:async()=>{throw Error('No TV available')}},
  './sound.cjs':fakeSound,
  './encoder-fallback.cjs':policy,
  '../viewing-policy.cjs':{maxMs:()=>null,deadline:()=>null,active:()=>true,
    iso:()=>null,MODE:'until-stopped'}
 };
 const module={exports:{}};
 const context={
  require:id=>{if(!Object.hasOwn(libs,id))throw Error('Unexpected require '+id);return libs[id]},
  module,__dirname:'C:\\unused\\testcast',
  process:{env:{PC_BRIDGE_FFMPEG_EXE:'C:\\qa-fake-ffmpeg.exe',
    IM_ACCESSIBILITY_TV_AUDIO:'0'},pid:12345},
  Buffer,URL,Date,console:{warn(){},log(){}},
  setTimeout:(cb,ms)=>{assert.ok(ms>=0&&ms<=2000);timers.push(cb);return timers.length},
  setInterval:()=>{throw Error('No network server or live monitor allowed')},
  clearInterval:()=>{}
 };
 vm.runInNewContext(serverSource,context,{filename:'fake-cast-server.cjs',timeout:1500});
 const server=module.exports;
 return {server,spawns,modes,runTimers(){
   while(timers.length){const cb=timers.shift();cb();}
 }};
}
test('live server reacts to early MF exit by restarting once with software codec',()=>{
 const x=sandbox();
 x.server.startCapture();
 assert.equal(x.modes.length,1);
 assert.equal(x.modes[0].codec,'h264_mf');
 const ff=x.spawns[0];ff.exitCode=1;ff.emit('exit',1,null);
 let status=x.server.status();
 assert.equal(status.state,'recovering');
 assert.equal(status.videoEncoder,'libopenh264');
 assert.equal(status.encoderFallbackUsed,true);
 assert.equal(status.recoveryCount,1);
 x.runTimers();
 assert.equal(x.modes.length,2);
 assert.equal(x.modes[1].codec,'libopenh264');
 assert.equal(x.server.status().state,'running');
 x.server.stopCapture();
});
test('live server uses single OpenH264 recovery for a running MF process with no playlist',()=>{
 const x=sandbox();
 x.server.startCapture();
 const first=x.spawns[0];
 const future=Date.now()+policy.STARTUP_GRACE_MS+900;
 assert.equal(x.server.watchdogTick(future),true);
 assert.equal(first.signalSent,'SIGTERM');
 assert.equal(x.server.status().videoEncoder,'libopenh264');
 assert.equal(x.server.status().encoderFallbackUsed,true);
 first.exitCode=null;first.emit('exit',null,'SIGTERM');
 x.runTimers();
 assert.equal(x.modes.length,2);
 assert.equal(x.modes[1].codec,'libopenh264');
 // A second stall must fail closed, not loop forever or return to MF.
 const result=x.server.watchdogTick(Date.now()+2*policy.STARTUP_GRACE_MS+4000);
 assert.equal(result,true);
 assert.match(x.server.status().error,/No HLS playlist after OpenH264 fallback/);
 assert.equal(x.spawns[1].signalSent,'SIGTERM');
 x.spawns[1].emit('exit',null,'SIGTERM');
 x.runTimers();
 assert.equal(x.spawns.length,2);
});
test('owner Stop while FFmpeg is active never starts a second capture',()=>{
 const x=sandbox();x.server.startCapture();
 const first=x.spawns[0];x.server.stopCapture();
 first.exitCode=null;first.emit('exit',null,'SIGTERM');
 x.runTimers();
 assert.equal(x.spawns.length,1);
 assert.equal(x.server.status().encoderFallbackUsed,false);
});

test('audio pipe EPIPE during Cinema restart cannot crash cast or discard sound',()=>{
 const x=sandbox(true);x.server.startCapture();
 const ff=x.spawns[0];
 x.server.switchQuality('cinema');
 assert.doesNotThrow(()=>ff.stdio[3].emit('error',Object.assign(Error('write EPIPE'),{code:'EPIPE'})));
 ff.exitCode=0;ff.emit('exit',0,null);x.runTimers();
 assert.equal(x.modes.length,2);assert.equal(x.modes[1].mode,'cinema');
 assert.ok(x.modes[1].format,'planned quality restart retains opted-in audio');
 assert.equal(x.server.status().audioState,'active');
 x.server.stopCapture();
});

test('unexpected audio pipe failure falls back once without an unhandled error; Stop never restarts',()=>{
 const x=sandbox(true);x.server.startCapture();const ff=x.spawns[0];
 assert.doesNotThrow(()=>ff.stdio[3].emit('error',Error('write EPIPE')));
 ff.exitCode=1;ff.emit('exit',1,null);x.runTimers();
 assert.equal(x.modes.length,2);assert.equal(x.modes[1].format,null);
 assert.equal(x.server.status().audioState,'fallback');
 x.server.stopCapture();
 assert.doesNotThrow(()=>ff.stdio[3].emit('error',Error('late write EPIPE')));
 x.runTimers();assert.equal(x.modes.length,2);
});

test('OpenH264 startup failure is reported without retrying the blank stream',()=>{
 const x=sandbox();
 x.server.startCapture();
 const first=x.spawns[0];first.exitCode=1;first.emit('exit',1,null);
 x.runTimers();
 assert.equal(x.modes[1].codec,'libopenh264');
 const second=x.spawns[1];second.exitCode=1;second.emit('exit',1,null);
 x.runTimers();
 const status=x.server.status();
 assert.equal(status.state,'failed');
 assert.match(status.error,/OpenH264 fallback exited before first HLS playlist/);
 assert.equal(status.encoderFallbackUsed,true);
 assert.equal(x.spawns.length,2);
});
