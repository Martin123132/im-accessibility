'use strict';
// Compile and exercise the actual Windows installer transaction with a small
// embedded fixture. Never runs a TV, changes audio, registers tasks or writes
// real-user shortcuts/registry. All paths are under a marked random QA root.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process'),crypto=require('node:crypto');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('Windows update preserves settings, refuses unsafe states and rolls back both exchange failures',
 {skip:process.platform!=='win32',timeout:180000},async()=>{
 const qa=path.join(fs.realpathSync.native(os.tmpdir()),'ImAccessibility-QA',crypto.randomUUID().replaceAll('-',''));
 fs.mkdirSync(qa,{recursive:true});fs.writeFileSync(path.join(qa,'.disposable-profile'),'installer transaction QA');
 const local=path.join(qa,'LocalAppData'),root=path.join(local,'Programs','ImAccessibility');
 const input=path.join(qa,'input'),zip=path.join(qa,'payload.zip'),setup=path.join(qa,'Setup.exe');
 fs.mkdirSync(input);fs.mkdirSync(local);
 const env={...process.env,LOCALAPPDATA:local,IM_ACCESSIBILITY_QA_ROOT:qa};
 const csc=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 const refs=['System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','Microsoft.CSharp.dll'];
 const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
 const processes=[],checks=[];
 const run=(exe,args,options={})=>{const r=cp.spawnSync(exe,args,{env,encoding:'utf8',windowsHide:true,timeout:20000,...options});assert.equal(r.status,0,r.stdout+r.stderr+String(r.error||''));return r.stdout;};
 const compile=(output,sources,extra=[])=>run(csc,['/nologo','/target:winexe','/platform:x64','/out:'+output,...refs.map(x=>'/reference:'+x),...extra,...sources]);
 function command(op,label,expected){const report=path.join(qa,label+'.txt');run(setup,[op,report]);const text=fs.readFileSync(report,'utf8').replace(/^\uFEFF/,'');assert.match(text,expected);checks.push(label);return text;}
 let newManifest;
 const settings=path.join(local,'ImAccessibility','settings.json'),saved=Buffer.from('{"television":{"ip":"192.168.50.23","clientKey":"fixture-only-not-a-real-key"}}\n');
 function resetOld(){
  assert.equal(path.dirname(path.dirname(root)),local);assert.ok(fs.existsSync(path.join(qa,'.disposable-profile')));
  fs.rmSync(root,{recursive:true,force:true});fs.cpSync(input,root,{recursive:true});
  fs.writeFileSync(path.join(root,'content.txt'),'previous application content');
  const m=JSON.parse(JSON.stringify(newManifest));m.buildId='recovery2.4.4-clock-20261110';
  const e=m.files.find(x=>x.path==='content.txt'),data=fs.readFileSync(path.join(root,'content.txt'));e.bytes=data.length;e.sha256=sha(data);
  fs.writeFileSync(path.join(root,'installer-manifest.json'),JSON.stringify(m));
  return fs.readFileSync(path.join(root,'installer-manifest.json'));
 }
 function preserved(receipt){assert.deepEqual(fs.readFileSync(settings),saved);assert.deepEqual(fs.readFileSync(path.join(root,'installer-manifest.json')),receipt);assert.equal(fs.readFileSync(path.join(root,'content.txt'),'utf8'),'previous application content');}
 async function helper(exe,args){
  const ready=path.join(qa,'ready-'+crypto.randomUUID()),stop=path.join(qa,'stop-'+crypto.randomUUID());
  const p=cp.spawn(exe,[...args,ready,stop],{env,windowsHide:true,stdio:'ignore'});
  const exited=new Promise(resolve=>p.once('exit',(code,signal)=>resolve({code,signal})));
  const item={p,stop,exited};processes.push(item);
  for(let i=0;i<100&&!fs.existsSync(ready);i++)await pause(30);
  assert.ok(fs.existsSync(ready),'QA helper did not become ready');return item;
 }
 async function stopHelper(item){fs.writeFileSync(item.stop,'stop');const ended=await Promise.race([item.exited,pause(5000).then(()=>null)]);assert.ok(ended,'QA helper did not exit');assert.equal(ended.code,0);item.done=true;}
 try{
  const util=path.join(qa,'MakeZip.cs');fs.writeFileSync(util,'using System.IO.Compression; class MakeZip {static void Main(string[] a){ZipFile.CreateFromDirectory(a[0],a[1],CompressionLevel.Fastest,false);}}');
  const zipExe=path.join(qa,'MakeZip.exe');compile(zipExe,[util]);
  const worker=path.join(qa,'Worker.cs');fs.writeFileSync(worker,'using System; using System.IO; using System.Threading; class Worker {static void Main(string[] a){File.WriteAllText(a[0],"ready"); for(int i=0;i<600&&!File.Exists(a[1]);i++)Thread.Sleep(50);}}');
  const workerExe=path.join(qa,'Worker.exe');compile(workerExe,[worker]);
  const files=['ImAccessibility.exe','ImAccessibility-Uninstall.exe','Runtime/node.exe','Runtime/ffmpeg.exe','gui-config-bridge.cjs','TVFinder.cjs','tv-reliability-v0.5/viewer/web/fast-video.js','content.txt'];
  while(files.length<80)files.push('data/file-'+files.length+'.txt');
  for(const rel of files){const out=path.join(input,rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,rel==='Runtime/node.exe'?fs.readFileSync(workerExe):Buffer.from('new package '+rel));}
  newManifest={format:1,product:'ImAccessibility',version:'v0.3.21-independent-audio-guard-private-preview',buildId:require('./third-party-notices/rebuilt-pins.json').buildId,
   files:files.map(rel=>{const data=fs.readFileSync(path.join(input,rel));return {path:rel,bytes:data.length,sha256:sha(data)};})};
  fs.writeFileSync(path.join(input,'installer-manifest.json'),JSON.stringify(newManifest));run(zipExe,[input,zip]);
  compile(setup,['ImAccessibilitySetup.cs','InstallUpdate.cs','InstallSafety.cs'].map(x=>path.join(__dirname,x)),['/define:REBUILT_FFMPEG_PRIVATE','/resource:'+zip+',ImAccessibilityInstallerPayload']);
  fs.mkdirSync(path.dirname(settings));fs.writeFileSync(settings,saved);
  command('--test-install','fresh-install',/^SUCCESS /);assert.deepEqual(fs.readFileSync(settings),saved);
  for(const [op,label] of [['--test-update-fail-after-backup','rollback-after-original-moved'],['--test-update-fail-after-promotion','rollback-after-new-promoted']]){
   const before=resetOld();command(op,label,/^FAILED .*previous version.*restored/s);preserved(before);
   assert.deepEqual(fs.readdirSync(path.dirname(root)).filter(x=>x.startsWith('.ImAccessibility-')),[]);
  }
  for(const [relative,value,label,pattern] of [
   ['tv-reliability-v0.5/runtime/state.json','{"state":"ready"}','live-session-refused',/still running/],
   ['tv-reliability-v0.5/runtime/state.json','{"state":"stale"}','uncertain-session-refused',/still running/],
   ['tv-reliability-v0.5/viewer/runtime/speaker-route.json','{}','pending-audio-refused',/laptop sound/],
   ['tv-reliability-v0.5/runtime/host-lock.json','{}','host-lock-refused',/laptop sound/],
   ['tv-reliability-v0.5/runtime/stop-request.json','{}','shutdown-pending-refused',/laptop sound/],
   ['owner-notes.txt','keep this','unknown-file-preserved',/unrecognised file/]
  ]){
   const before=resetOld(),file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);
   command('--test-update',label,pattern);preserved(before);assert.equal(fs.readFileSync(file,'utf8'),value);
  }
  let before=resetOld();fs.appendFileSync(path.join(root,'TVFinder.cjs'),' changed');command('--test-update','modified-payload-refused',/could not be verified/);preserved(before);
  before=resetOld();const foreign=path.join(qa,'outside');fs.mkdirSync(foreign);fs.writeFileSync(path.join(foreign,'keep.txt'),'keep');
  const link=path.join(root,'linked');fs.symlinkSync(foreign,link,'junction');command('--test-update','junction-preserved',/Linked/);fs.unlinkSync(link);preserved(before);assert.equal(fs.readFileSync(path.join(foreign,'keep.txt'),'utf8'),'keep');
  before=resetOld();const future=JSON.parse(before);future.buildId='recovery2.4.6-future';fs.writeFileSync(path.join(root,'installer-manifest.json'),JSON.stringify(future));
  const futureReceipt=fs.readFileSync(path.join(root,'installer-manifest.json'));command('--test-update','downgrade-refused',/newer version/);preserved(futureReceipt);
  before=resetOld();const held=await helper(path.join(root,'Runtime/node.exe'),[]);command('--test-update','running-service-refused',/service is still closing/);preserved(before);await stopHelper(held);
  const lockSource=path.join(qa,'Lock.cs');fs.writeFileSync(lockSource,'using System.IO; using System.Threading; class Lock {static void Main(string[] a){using(ImAccessibilitySafety.InstallSafety.AcquireInstallLock(a[0])){File.WriteAllText(a[1],"ready");for(int i=0;i<600&&!File.Exists(a[2]);i++)Thread.Sleep(50);}}}');
  const lockExe=path.join(qa,'Lock.exe');compile(lockExe,[lockSource,path.join(__dirname,'InstallSafety.cs')]);
  before=resetOld();const lock=await helper(lockExe,[root]);command('--test-update','concurrent-update-refused',/already running/);preserved(before);await stopHelper(lock);
  before=resetOld();
  const stopped=path.join(root,'tv-reliability-v0.5/runtime/state.json');fs.mkdirSync(path.dirname(stopped),{recursive:true});fs.writeFileSync(stopped,'{"state":"stopped"}');
  const oldLog=path.join(root,'tv-reliability-v0.5/viewer/runtime/previous-session.log');fs.mkdirSync(path.dirname(oldLog),{recursive:true});fs.writeFileSync(oldLog,'completed session');
  command('--test-update','update-without-uninstall',/^SUCCESS /);assert.deepEqual(fs.readFileSync(settings),saved);
  assert.equal(fs.existsSync(stopped),false,'old session state must not resume after updating');
  assert.equal(fs.readFileSync(path.join(root,'content.txt'),'utf8'),'new package content.txt');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'installer-manifest.json'))).buildId,newManifest.buildId);
  assert.deepEqual(fs.readdirSync(path.dirname(root)).filter(x=>x.startsWith('.ImAccessibility-')),[]);
  command('--test-existing','same-version-opens-existing',/^SUCCESS /);
  command('--test-update','same-version-not-reapplied',/No newer version/);
  const wrongEnv={...env,IM_ACCESSIBILITY_QA_ROOT:undefined};delete wrongEnv.IM_ACCESSIBILITY_QA_ROOT;
  const refusal=path.join(qa,'no-test-authority.txt');run(setup,['--test-update',refusal],{env:wrongEnv});assert.match(fs.readFileSync(refusal,'utf8'),/disposable QA root is required/);checks.push('test-mode-cannot-use-unmarked-profile');
  console.log('Installer update guards: '+checks.length+' passed: '+checks.join(', '));
 }finally{
  for(const item of processes)if(!item.done){fs.writeFileSync(item.stop,'stop');await item.exited;}
  assert.ok(qa.startsWith(path.join(fs.realpathSync.native(os.tmpdir()),'ImAccessibility-QA')+path.sep));
  assert.ok(fs.existsSync(path.join(qa,'.disposable-profile')));fs.rmSync(qa,{recursive:true,force:true});
 }
});
