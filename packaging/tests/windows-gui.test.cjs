'use strict';
// Compile real Windows GUI code and inspect controls without showing or starting a session.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
test('Windows GUIs compile; installed app exposes named keyboard-accessible controls',{skip:process.platform!=='win32'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-gui-')),repo=path.resolve(__dirname,'../..');
 const csc=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 try{
  for(const [name,files,refs] of [
   ['App',['windows-oneclick/ImAccessibilityApp.cs'],['System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll']],
   ['Setup',['windows-oneclick/ImAccessibilitySetup.cs','windows-oneclick/InstallSafety.cs'],['System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll','System.IO.Compression.dll','System.IO.Compression.FileSystem.dll','Microsoft.CSharp.dll']],
   ['Uninstall',['windows-oneclick/ImAccessibilityUninstall.cs','windows-oneclick/InstallSafety.cs'],['System.Windows.Forms.dll','System.Web.Extensions.dll']],
   ['Panel',['windows-control-panel/TVControls.cs','windows-control-panel/TVFinderDialog.cs'],['System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll','Microsoft.CSharp.dll']]
  ]){
   const out=path.join(dir,name+'.exe');
   const r=cp.spawnSync(csc,['/nologo','/target:winexe','/out:'+out,...refs.map(x=>'/reference:'+x),...files.map(x=>path.join(repo,'packaging',x))],{encoding:'utf8',windowsHide:true,timeout:25000});
   assert.equal(r.status,0,r.stdout+r.stderr);
  }
  const report=path.join(dir,'a11y.json');
  const r=cp.spawnSync(path.join(dir,'App.exe'),['--accessibility-selftest',report],{encoding:'utf8',windowsHide:true,timeout:12000});
  assert.equal(r.status,0,r.stderr);
  const a=JSON.parse(fs.readFileSync(report,'utf8').replace(/^\uFEFF/,''));
  assert.equal(a.allNamed,true);assert.equal(a.tabOrderValid,true);assert.equal(a.allTabStops,true);assert.equal(a.controlCount,12);
  // Exercise the same asynchronous close/uninstall gate used by the GUI.
  // A successful Stop request alone must not be mistaken for completed cleanup.
  const harness=path.join(dir,'StopGate.cs'),gate=path.join(dir,'StopGate.exe');
  fs.writeFileSync(harness,`using System; using System.Collections.Generic; using System.Threading.Tasks;
using ImAccessibilityDesktop;
class StopGate {
 static Dictionary<string,object> State(string state,bool audio){return new Dictionary<string,object>{{"state",state},{"audioPending",audio}};}
 static void Main(){
  foreach(string state in new[]{"ready","stopping","starting-viewer","stale","attention"})
   if(Engine.ReadyToClose(State(state,false)))throw new Exception("Premature close: "+state);
  if(Engine.ReadyToClose(State("stopped",true)))throw new Exception("Audio restoration bypassed");
  if(Engine.ReadyToClose(new Dictionary<string,object>{{"state","stopped"}}))throw new Exception("Unknown audio bypassed");
  int reads=0,delays=0;
  Engine.WaitUntilStopped(()=>Task.FromResult(++reads==3?State("stopped",false):State("stopping",true)),
   ()=>{delays++;return Task.FromResult(0);},4).GetAwaiter().GetResult();
  if(reads!=3||delays!=2)throw new Exception("Did not wait for cleanup");
  bool refused=false;
  try{Engine.WaitUntilStopped(()=>Task.FromResult(State("stopped",true)),()=>Task.FromResult(0),2).GetAwaiter().GetResult();}
  catch(Exception e){refused=e.Message.Contains("Controls remain open");}
  if(!refused)throw new Exception("Uninstall permitted pending audio");
  Console.WriteLine("PASS stop/close/uninstall waits for confirmed cleanup and refuses uncertainty");
 }
}`);
  const compiled=cp.spawnSync(csc,['/nologo','/target:exe','/main:StopGate','/out:'+gate,
   ...['System.Windows.Forms.dll','System.Drawing.dll','System.Web.Extensions.dll'].map(x=>'/reference:'+x),
   path.join(repo,'packaging/windows-oneclick/ImAccessibilityApp.cs'),harness],{encoding:'utf8',windowsHide:true,timeout:25000});
  assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
  const gated=cp.spawnSync(gate,[],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(gated.status,0,gated.stdout+gated.stderr);assert.match(gated.stdout,/PASS stop\/close\/uninstall/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
