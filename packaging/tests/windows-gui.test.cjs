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
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
