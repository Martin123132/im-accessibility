'use strict';
// An isolated fixture verifies v1 configuration wiring. No TV connection, capture,
// native mouse input, pairing, live Codex call or Windows scheduled task is launched.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('opt-in release settings bind the TV modules to one exact owner-selected LAN and LG', {skip:process.platform!=='win32'},async()=>{
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-v1-wiring-'));
 const file=path.join(scratch,'settings.json');
 const nodeExe=path.join(scratch,'node.exe');
 const ffmpegExe=path.join(scratch,'ffmpeg.exe');
 const previous=process.env.IM_ACCESSIBILITY_CONFIG_PATH;
 const oldNetworkInterfaces=os.networkInterfaces;
 try{
  fs.writeFileSync(nodeExe,'dummy status-only fixture');
  fs.writeFileSync(ffmpegExe,'dummy status-only fixture');
  fs.writeFileSync(file,JSON.stringify({
   schema:1,network:{adapterName:'TestEthernet',localIp:'10.50.2.10'},
   television:{model:'OLED55CX6LA',ip:'10.50.2.25'},
   executables:{nodeExe,ffmpegExe}
  }));
  process.env.IM_ACCESSIBILITY_CONFIG_PATH=file;
  os.networkInterfaces=()=>({TestEthernet:[{
   family:'IPv4',internal:false,address:'10.50.2.10',netmask:'255.255.255.0'
  }]});
  const lan=require('../cast/lan.cjs');
  const cast=require('../cast/server.cjs');
  const viewer=require('../viewer/server.cjs');
  const pair=require('../lg-pair.cjs');
  const launch=require('../cast/lg-launch.cjs');
  const host=require('../resume-host.cjs');
  const control=require('../resume.cjs');
  const snapshot=require('../viewer/snapshot.cjs');
  os.networkInterfaces=oldNetworkInterfaces;

  assert.equal(lan.CONFIGURED,true);
  assert.equal(lan.LAN_IP,'10.50.2.10');
  assert.equal(lan.APPROVED_TV_IP,'10.50.2.25');
  assert.equal(lan.isRemoteLan('10.50.2.25'),true);
  assert.equal(lan.isRemoteLan('10.50.2.26'),false);
  assert.equal(lan.isRemoteLan('10.50.3.25'),false);
  assert.equal(lan.isRemoteLan('10.50.2.10'),false);
  assert.equal(lan.isLocalIp('10.50.2.80'),true);

  assert.equal(cast.LAN_IP,'10.50.2.10');
  assert.equal(viewer.sameSubnet('10.50.2.80'),true);
  assert.equal(viewer.sameSubnet('10.50.3.80'),false);
  assert.equal(viewer.state().enabled,false);
  assert.match(viewer.state().screen,/pending native verification/);
  assert.equal(pair.MODEL,'OLED55CX6LA');
  assert.deepEqual(await pair.candidates(),['10.50.2.25']);
  const key='a'.repeat(48);
  assert.equal(launch.isAllowedTarget('http://10.50.2.10:43196/tv/'+key),true);
  assert.equal(launch.isAllowedTarget('http://10.50.3.10:43196/tv/'+key),false);
  assert.equal(host.MAX_MS,null);
  assert.equal(host.VIEWING_MODE,'until-stopped');
  assert.equal(cast.status().expiresAt,null);
  assert.equal(viewer.state().expiresAt,null);
  assert.equal(viewer.state().enabled,false);
  assert.equal(typeof control.resume,'function');
  assert.equal(typeof snapshot.getFrame,'function');

  // No dummy executable may be launched by module imports.
  const stub=spawnSync(process.execPath,['--version'],{encoding:'utf8'});
  assert.equal(stub.status,0);
 }finally{
  if(previous===undefined)delete process.env.IM_ACCESSIBILITY_CONFIG_PATH;
  else process.env.IM_ACCESSIBILITY_CONFIG_PATH=previous;
  os.networkInterfaces=oldNetworkInterfaces;
  fs.rmSync(scratch,{recursive:true,force:true});
 }
});

test('source keeps release mode gated behind explicitly enabled per-user config',()=>{
 const src=fs.readFileSync(path.resolve(__dirname,'../cast/lan.cjs'),'utf8');
 assert.match(src,/IM_ACCESSIBILITY_CONFIG_PATH!==undefined/);
 assert.match(src,/RELEASE_SETTINGS\?RELEASE_SETTINGS\.network:chosen\(\)/);
 const pair=fs.readFileSync(path.resolve(__dirname,'../lg-pair.cjs'),'utf8');
 assert.match(pair,/SETTINGS\.television\.ip/);
 assert.match(pair,/owner/);
 const host=fs.readFileSync(path.resolve(__dirname,'../resume-host.cjs'),'utf8');
 assert.match(host,/SETTINGS\.executables\.nodeExe/);
 const viewer=fs.readFileSync(path.resolve(__dirname,'../viewer/server.cjs'),'utf8');
 assert.match(viewer,/primaryScreen/);
 assert.match(viewer,/enabledUntil=expiresAt===null\?Date\.now\(\)\+VIEWING\.MOUSE_LEASE_MS/);
 assert.match(viewer,/Math\.min\(expiresAt,Date\.now\(\)\+VIEWING\.MOUSE_LEASE_MS\)/);
});
