'use strict';
// Isolated safety tests: never install a task, contact LG, change a Windows
// sound endpoint, start a real guard or control another user's processes.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SpeakerRouter,guardianReady,startIndependentGuard,TASK_NAME,taskNameFor}=require('../speaker-routing.cjs');
const {serviceTick}=require('../speaker-route-watch.cjs');
const TAG='a'.repeat(32),DEVICE='b'.repeat(64);
function temp(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imacc-independent-audio-'));
 return {dir,journal:path.join(dir,'speaker-route.json'),
  marker:path.join(dir,'audio-guard-ready.json'),clean(){fs.rmSync(dir,{recursive:true,force:true})}};
}

test('installed guardian names cannot select the legacy owner task or another installation',()=>{
 const one=path.resolve('private-candidate-one'),two=path.resolve('private-candidate-two');
 const name=taskNameFor(one,true);
 assert.match(name,/^ImAccessibility-AudioGuard-[a-f0-9]{16}$/);
 assert.notEqual(name,'ImAccessibility-AudioGuard-v1');
 assert.notEqual(name,taskNameFor(two,true));
 assert.equal(name,taskNameFor(one.toUpperCase()+path.sep,true));
 assert.equal(taskNameFor(one,false),'ImAccessibility-AudioGuard-v1');
});

test('PowerShell registration and Node audio recovery derive the same installed task name',{skip:process.platform!=='win32'},()=>{
 const x=temp();try{
  const source=fs.readFileSync(path.resolve(__dirname,'../../../packaging/windows-oneclick/audio-guard-task.ps1'),'utf8');
  // Execute only the actual pure identity block, never the task-management code.
  const block=source.slice(source.indexOf('$root='),source.indexOf('$node='));
  assert.ok(block.includes('$TaskName='));assert.doesNotMatch(block,/ScheduledTask|schtasks|Start-Process/);
  const file=path.join(x.dir,'identity.ps1');fs.writeFileSync(file,block+'\nWrite-Output $TaskName\n');
  const r=require('node:child_process').spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{encoding:'utf8',windowsHide:true,timeout:8000});
  assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),taskNameFor(x.dir,true));
 }finally{x.clean()}
});

test('installed audio guardian Status works in the inherited GUI PowerShell environment',{skip:process.platform!=='win32'},()=>{
 const x=temp();try{
  const crypto=require('node:crypto'),cp=require('node:child_process');
  const script=path.join(x.dir,'audio-guard-task.ps1');
  fs.copyFileSync(path.resolve(__dirname,'../../../packaging/windows-oneclick/audio-guard-task.ps1'),script);
  const node='Runtime/node.exe',watch='tv-reliability-v0.5/viewer/speaker-route-watch.cjs';
  for(const file of [node,watch]){fs.mkdirSync(path.dirname(path.join(x.dir,file)),{recursive:true});fs.writeFileSync(path.join(x.dir,file),'synthetic fixture; never executed');}
  const files=[node,watch].map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(x.dir,file))).digest('hex')}));
  for(let i=0;i<78;i++)files.push({path:'fixture-'+i,sha256:'0'.repeat(64)});
  fs.writeFileSync(path.join(x.dir,'installer-manifest.json'),JSON.stringify({product:'ImAccessibility',version:'v0.3.21-independent-audio-guard-private-preview',files}));
  const windowsPs=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const run=()=>cp.spawnSync(windowsPs,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Action','Status'],{
   env:{...process.env},encoding:'utf8',windowsHide:true,timeout:12000
  });
  const status=run();assert.equal(status.status,0,status.stdout+status.stderr);
  const result=JSON.parse(status.stdout);assert.equal(result.installed,false);assert.equal(result.startsTv,false);
  assert.equal(result.task,taskNameFor(x.dir,true));
  fs.appendFileSync(path.join(x.dir,watch),'modified');
  const modified=run();assert.equal(modified.status,1);assert.match(modified.stderr,/watcher differs from installed manifest/);
 }finally{x.clean()}
});
test('Task-guard start is narrow, checks exact session heartbeat and does not register a task',()=>{
 const x=temp(),now=250000,invocations=[];
 try{
  fs.writeFileSync(x.marker,JSON.stringify({sessionTag:TAG,pid:12345,beatAt:now})+'\n');
  const ok=startIndependentGuard({sessionTag:TAG,readyFile:x.marker,nowFn:()=>now,
   execFn:(exe,args)=>{invocations.push({exe,args});return {status:0}},
   pauseFn:()=>{throw Error('Already ready; no artificial wait necessary')}
  });
  assert.equal(ok,true);
  assert.deepEqual(invocations,[{exe:'schtasks.exe',args:['/Run','/TN',TASK_NAME]}]);
  assert.equal(guardianReady(TAG,{file:x.marker,now}),true);
  assert.equal(guardianReady('c'.repeat(32),{file:x.marker,now}),false);
  assert.equal(guardianReady(TAG,{file:x.marker,now:now+8000}),false);
  assert.throws(()=>startIndependentGuard({sessionTag:'not-a-valid-session',
   execFn:()=>{throw Error('exec should never run')}}),/No verified audio guard session identity/);
  assert.throws(()=>startIndependentGuard({sessionTag:TAG,readyFile:x.marker,nowFn:()=>now,
   execFn:()=>({status:1}),pauseFn:()=>{}
  }),/guardian is not enabled/);
 }finally{x.clean()}
});
test('Independent guardian survives video-session-loss logically and restores only matching audio',()=>{
 const x=temp(),now=5*60*60*1000+1000;
 let muted=true,calls=0;
 try{
  const record={sessionTag:TAG,deviceIdHash:DEVICE,originalMuted:false,
    appliedMuted:true,startedAt:1000,lastPulse:now,viewingMode:'until-stopped'};
  fs.writeFileSync(x.journal,JSON.stringify(record)+'\n');
  const native=(_exe,args)=>{
   if(args[0]==='--status')return {deviceIdHash:DEVICE,muted,endpoint:'default-speaker-output'};
   assert.deepEqual(args,['--cas',DEVICE,'1','0']);
   calls++;muted=false;return {deviceIdHash:DEVICE,muted};
  };
  assert.equal(serviceTick(now,native,x.journal,x.marker).action,'watch');
  assert.equal(guardianReady(TAG,{file:x.marker,now}),true);
  const restored=serviceTick(now+22001,native,x.journal,x.marker);
  assert.equal(restored.action,'stop');
  assert.equal(muted,false);assert.equal(calls,1);
  assert.equal(fs.existsSync(x.journal),false);
  assert.equal(fs.existsSync(x.marker),false);
 }finally{x.clean()}
});
test('Independent heartbeat loss while viewer is alive restores original mute instead of refreshing lease',()=>{
 const x=temp();let muted=false,ready=true;
 try{
  const r=new SpeakerRouter({
   journal:x.journal,sessionTag:TAG,clock:()=>10100,
   watchFn:()=>{},enforceIndependentGuard:true,guardianReadyFn:()=>ready,
   statusFn:()=>({deviceIdHash:DEVICE,muted,endpoint:'default-speaker-output'}),
   casFn:(_hash,old,next)=>{assert.equal(_hash,DEVICE);assert.equal(old,muted);muted=next}
  });
  r.setMode('tv-only',DEVICE);
  assert.equal(muted,true);
  ready=false;
  assert.throws(()=>r.pulse(),/original Windows sound restored/);
  assert.equal(muted,false);
  assert.equal(fs.existsSync(x.journal),false);
 }finally{x.clean()}
});
test('Task manager registration requires an exact owner approval; task code contains no TV launch',()=>{
 const ps=fs.readFileSync(path.resolve(__dirname,'../../../packaging/windows-oneclick/audio-guard-task.ps1'),'utf8');
 assert.ok(ps.includes("if($OwnerConsent -ne 'YES')"));
 assert.match(ps,/New-ScheduledTaskPrincipal/);
 assert.match(ps,/-RunLevel Limited/);
 assert.match(ps,/Get-FileHash/);
 assert.match(ps,/SecurityIdentifier/);
 assert.match(ps,/Audio guardian must have no automatic task triggers/);
 assert.ok(ps.includes("if(Test-Path -LiteralPath $journal)"));
 assert.doesNotMatch(ps,/system\\.launcher|powershell -enc|Invoke-WebRequest|Start-Process.+resume-host/);
});
