'use strict';
// Run the actual bridge parser/command with isolated controller stubs. No network,
// installed settings, streaming process, registry or scheduled task is touched.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
test('GUI save refuses live/uncertain sessions, pending audio, occupied ports and unconfirmed overwrite',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-save-guard-'));
 try{
  fs.copyFileSync(path.resolve(__dirname,'../windows-oneclick/gui-config-bridge.cjs'),path.join(dir,'gui-config-bridge.cjs'));
  fs.writeFileSync(path.join(dir,'first-run.cjs'),`exports.saveSettings=(v,o)=>{require('node:fs').writeFileSync(require('node:path').join(__dirname,'saved.json'),JSON.stringify(o));return {written:true,summary:{}}}`);
  for(const name of ['launch-host','stop-session'])fs.writeFileSync(path.join(dir,name+'.cjs'),'module.exports={}');
  fs.writeFileSync(path.join(dir,'status-session.cjs'),'exports.status=async()=>JSON.parse(process.env.TEST_STATUS)');
  fs.mkdirSync(path.join(dir,'tv-reliability-v0.5'));
  fs.writeFileSync(path.join(dir,'tv-reliability-v0.5/session-guard.cjs'),`exports.assertPortsAvailable=()=>{if(process.env.TEST_PORTS==='busy')throw Error('Video ports occupied')}`);
  const candidate={adapterName:'Test WiFi',localIp:'10.1.1.2',tvIp:'10.1.1.3',nodeExe:process.execPath,ffmpegExe:path.join(dir,'Runtime','ffmpeg.exe'),previousHash:'a'.repeat(64)};
  const run=(state,audioPending,extra={},data=candidate)=>cp.spawnSync(process.execPath,[path.join(dir,'gui-config-bridge.cjs'),'save'],{
   input:JSON.stringify(data),encoding:'utf8',windowsHide:true,timeout:5000,
   env:{...process.env,TEST_STATUS:JSON.stringify({state,audioPending}),...extra}
  });
  for(const state of ['ready','starting-video','stopping','stale','attention']){
   const r=run(state,false);assert.equal(r.status,1,r.stdout+r.stderr);assert.match(r.stderr,/Stop the TV stream/);
  }
  for(const audio of [true,undefined])assert.equal(run('stopped',audio).status,1);
  assert.match(run('stopped',false,{TEST_PORTS:'busy'}).stderr,/Video ports occupied/);
  assert.match(run('stopped',false,{}, {...candidate,previousHash:['a'.repeat(64)]}).stderr,/Invalid prior/);
  assert.match(run('stopped',false,{}, {...candidate,force:true}).stderr,/Invalid setup/);
  assert.equal(fs.existsSync(path.join(dir,'saved.json')),false);
  const success=run('stopped',false);assert.equal(success.status,0,success.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'saved.json'))).expectedHash,candidate.previousHash);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
