'use strict';
// Windows launcher acceptance. The fixture only writes a PID receipt and waits
// for a stop file; it never loads audio, desktop capture or TV code.
// Scheduled-task mode is opt-in and uses a unique disposable installation/task.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function verify({scheduled=false,appExe=null,nodeExe=process.execPath,reportFile=null}={}){
 assert.equal(process.platform,'win32');
 // Match the long installation path used by Node's module loader and Windows
 // PowerShell even when the Windows runner exposes TEMP through a short alias.
 const tempRoot=fs.realpathSync.native(os.tmpdir());
 const dir=fs.mkdtempSync(path.join(tempRoot,'ImAccessibility-Guardian-QA-'));
 const app=path.join(dir,'ImAccessibility.exe'),watch='tv-reliability-v0.5/viewer/speaker-route-watch.cjs';
 const marker=path.join(dir,'tv-reliability-v0.5/viewer/fixture-ready.json');
 const stop=path.join(dir,'tv-reliability-v0.5/viewer/fixture-stop');
 const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const script=path.join(dir,'audio-guard-task.ps1');
 const task='ImAccessibility-AudioGuard-'+crypto.createHash('sha256').update(path.resolve(dir).replace(/[\\/]+$/,'').toLowerCase()).digest('hex').slice(0,16);
 let registered=false,child=null,exit=null,finished=false,receipt=null;
 function ps(args){const r=cp.spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',...args],{windowsHide:true,encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout.trim();}
 function taskAction(action){return ps(['-File',script,'-Action',action,'-OwnerConsent','YES']);}
 try{
  fs.mkdirSync(path.join(dir,'Runtime'));fs.copyFileSync(nodeExe,path.join(dir,'Runtime/node.exe'));
  fs.mkdirSync(path.dirname(marker),{recursive:true});
  fs.writeFileSync(path.join(dir,watch),`const fs=require('node:fs'),path=require('node:path');
if(process.argv.length!==3||process.argv[2]!=='--task-guardian')process.exit(2);
const ready=path.join(__dirname,'fixture-ready.json');
fs.writeFileSync(ready+'.tmp',JSON.stringify({pid:process.pid,parentPid:process.ppid,args:process.argv.slice(2)}));
fs.renameSync(ready+'.tmp',ready);
const timer=setInterval(()=>{if(fs.existsSync(path.join(__dirname,'fixture-stop'))){clearInterval(timer);process.exit(0)}},100);
setTimeout(()=>process.exit(3),60000).unref();`);
  if(appExe)fs.copyFileSync(appExe,app);
  else{
   const csc=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
   const compiled=cp.spawnSync(csc,['/nologo','/target:winexe','/platform:x64','/out:'+app,
    ...['System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll'].map(x=>'/reference:'+x),path.join(__dirname,'ImAccessibilityApp.cs'),path.join(__dirname,'InstallSafety.cs')],{encoding:'utf8',windowsHide:true,timeout:25000});
   assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
  }
  fs.copyFileSync(path.join(__dirname,'audio-guard-task.ps1'),script);
  const files=['ImAccessibility.exe','Runtime/node.exe',watch].map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex')}));
  for(let i=0;i<77;i++)files.push({path:'unused-fixture-'+i,sha256:'0'.repeat(64)});
  fs.writeFileSync(path.join(dir,'installer-manifest.json'),JSON.stringify({product:'ImAccessibility',version:'v0.3.21-independent-audio-guard-private-preview',files}));
  if(scheduled){
   assert.equal(JSON.parse(taskAction('Status')).installed,false);
   taskAction('Enable');registered=true;
   const run=cp.spawnSync(path.join(process.env.SystemRoot,'System32/schtasks.exe'),['/Run','/TN',task],{encoding:'utf8',windowsHide:true,timeout:6000});
   assert.equal(run.status,0,run.stdout+run.stderr);
  }else{
   // Do not hide the parent externally: the shipped Windows subsystem and
   // CreateNoWindow setting must provide the absence of a console themselves.
   child=cp.spawn(app,['--audio-guardian'],{windowsHide:false,stdio:'ignore'});
   exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
  }
  for(let i=0;i<120&&!fs.existsSync(marker);i++)await pause(100);
  assert.ok(fs.existsSync(marker),'Guardian did not start its fixed watcher');
  const ready=JSON.parse(fs.readFileSync(marker));
  assert.ok(Number.isSafeInteger(ready.pid)&&ready.pid>0&&Number.isSafeInteger(ready.parentPid)&&ready.parentPid>0);
  assert.deepEqual(ready.args,['--task-guardian']);if(child)assert.equal(ready.parentPid,child.pid);
  const inspection=JSON.parse(ps(['-Command',`$ids=@(${ready.pid},${ready.parentPid}); $p=@(Get-Process -Id $ids -ErrorAction Stop | ForEach-Object {[pscustomobject]@{pid=$_.Id;window=$_.MainWindowHandle.ToInt64();title=$_.MainWindowTitle}}); $console=@(Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'conhost.exe' -and $_.ParentProcessId -in $ids} | ForEach-Object {Get-Process -Id $_.ProcessId -ErrorAction Stop} | ForEach-Object {[pscustomobject]@{pid=$_.Id;window=$_.MainWindowHandle.ToInt64();title=$_.MainWindowTitle}}); [pscustomobject]@{processes=$p;consoleHosts=$console}|ConvertTo-Json -Depth 4 -Compress`]));
  assert.equal(inspection.processes.length,2);
  assert.ok(inspection.processes.every(p=>p.window===0&&p.title===''),'Audio helper opened a window');
  // Windows may retain a headless conhost for redirected console applications.
  // It must not expose a window, title or a taskbar entry to the owner.
  assert.ok(inspection.consoleHosts.every(p=>p.window===0&&p.title===''),'Audio helper exposed a console window: '+JSON.stringify(inspection));
  fs.writeFileSync(stop,'stop fixture only');
  if(scheduled){
   for(let i=0;i<30;i++){if(JSON.parse(taskAction('Status')).state!=='Running'){finished=true;break}await pause(200);}
   assert.ok(finished,'Scheduled fixture did not exit on its stop file');
  }else{
   const ended=await Promise.race([exit,pause(6000).then(()=>null)]);
   assert.ok(ended,'Hidden launcher did not exit with its child');assert.equal(ended.code,0);finished=true;
  }
  receipt={passed:true,scheduledTaskExercised:scheduled,task:scheduled?task:null,guardianPid:ready.pid,launcherPid:ready.parentPid,
   visibleWindows:0,headlessConsoleHosts:inspection.consoleHosts.length,gracefulExit:true,fixtureOnly:true,audioOrTvStarted:false,appSHA256:files[0].sha256};
 }finally{
  if(fs.existsSync(path.dirname(stop)))fs.writeFileSync(stop,'stop fixture only');
  if(registered){
   const status=JSON.parse(taskAction('Status'));assert.equal(status.task,task);assert.equal(status.installed,true);
   if(status.state==='Running'){
    // Failure cleanup is restricted to the verified unique fixture task.
    ps(['-Command',`Stop-ScheduledTask -TaskName '${task}' -ErrorAction Stop`]);await pause(600);
   }
   taskAction('Disable');assert.equal(JSON.parse(taskAction('Status')).installed,false);
  }else if(child&&!finished){await Promise.race([exit,pause(6000)]);}
  if(!child||child.exitCode!==null||finished){
   assert.equal(path.dirname(dir),tempRoot);assert.match(path.basename(dir),/^ImAccessibility-Guardian-QA-/);
   fs.rmSync(dir,{recursive:true,force:true});
  }
 }
 receipt.taskRemoved=scheduled;receipt.scratchRemoved=!fs.existsSync(dir);
 if(reportFile)fs.writeFileSync(reportFile,JSON.stringify(receipt,null,2)+'\n');
 return receipt;
}
module.exports={verify};
if(require.main===module){
 const [mode,appExe,nodeExe,reportFile]=process.argv.slice(2);
 if(mode!=='--scheduled-task'||!appExe||!nodeExe||!reportFile)throw Error('Usage: test-hidden-guardian.cjs --scheduled-task APP_EXE NODE_EXE REPORT_FILE');
 verify({scheduled:true,appExe,nodeExe,reportFile}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.stack);process.exitCode=1});
}
