'use strict';
// Pure source/synthetic-fixture tests. No LG, TV commands, recording or Windows input.
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
 {spawnSync}=require('node:child_process'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const policy=require('../viewing-policy.cjs');

test('historical, unconfigured test policy remains limited to four hours',()=>{
 assert.equal(policy.MODE,'four-hour');
 assert.equal(policy.LEGACY_MAX_MS,14400000);
 assert.equal(policy.MOUSE_LEASE_MS,600000);
 const start=Date.now(),end=policy.deadline(start);
 assert.equal(end-start,14400000);
 assert.equal(policy.active(end,end-1),true);
 assert.equal(policy.active(end,end),false);
 assert.equal(policy.recordValid({expiresAt:new Date(end).toISOString()},start),true);
 assert.equal(policy.recordValid({expiresAt:new Date(end+14400000).toISOString()},start),false);
});
test('owner-confirmed mode carries no four-hour expiry, but rejects tampered metadata',()=>{
 const script=String.raw`
  const assert=require('node:assert/strict'),policy=require('./viewing-policy.cjs');
  assert.equal(policy.MODE,'until-stopped');
  assert.equal(policy.maxMs(),null);
  assert.equal(policy.deadline(Date.now()),null);
  assert.equal(policy.iso(null),null);
  assert.equal(policy.active(null,Date.now()+4*24*60*60*1000),true);
  assert.equal(policy.recordValid({viewingMode:'until-stopped',expiresAt:null},Date.now()+4*24*60*60*1000),true);
  for(const record of [
   {expiresAt:null},
   {viewingMode:'four-hour',expiresAt:null},
   {viewingMode:'until-stopped',expiresAt:new Date(Date.now()+14400000).toISOString()},
   {viewingMode:'until-stopped',expiresAt:0}
  ])assert.equal(policy.recordValid(record),false);
 `;
 const r=spawnSync(process.execPath,['-e',script],{cwd:root,encoding:'utf8',
  env:{...process.env,IM_ACCESSIBILITY_CONFIG_PATH:'C:/test-do-not-launch-anything.json'},
  timeout:5500,windowsHide:true});
 assert.equal(r.status,0,r.stderr||r.error?.message);
});
test('configured LG activity guard stays live after 4h, and still obeys Stop',()=>{
 const script=String.raw`
  const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const guard=require('./lg-active-view.cjs');
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'owner-tv-viewing-test-'));
  const start=Date.now(),settings={network:{ip:'10.50.2.10',mask:'255.255.255.0'},television:{ip:'10.50.2.25',model:'OLED55CX6LA'}};
  try{
   fs.mkdirSync(path.join(base,'runtime'));
   fs.mkdirSync(path.join(base,'viewer','runtime'),{recursive:true});
   const host={runId:'0123456789abcdef',state:'ready',lg:'opened',lgIp:settings.television.ip,
    stream:'ready',viewer:'ready',viewingMode:'until-stopped',expectedEndUtc:null};
   const viewer={url:'http://10.50.2.10:43198/tv/'+'a'.repeat(64),viewingMode:'until-stopped',expiresAt:null};
   const state=path.join(base,'runtime','state.json'),vfile=path.join(base,'viewer','runtime','session.json');
   const write=()=>{fs.writeFileSync(state,JSON.stringify(host));fs.writeFileSync(vfile,JSON.stringify(viewer));};
   write();
   const later=start+5*60*60*1000;
   let approved=guard.boundSession({root:base,now:later,settings});
   assert.equal(approved?.runId,host.runId);
   assert.equal(approved?.expiresAtMs,null);
   fs.writeFileSync(path.join(base,'runtime','stop-request.json'),'stop');
   assert.equal(guard.boundSession({root:base,now:later,settings}),null);
   fs.unlinkSync(path.join(base,'runtime','stop-request.json'));
   host.viewer='stopped';write();
   assert.equal(guard.boundSession({root:base,now:later,settings}),null);
   host.viewer='ready';viewer.expiresAt=new Date(later+14400000).toISOString();write();
   assert.equal(guard.boundSession({root:base,now:later,settings}),null);
  }finally{fs.rmSync(base,{recursive:true,force:true})}
 `;
 const r=spawnSync(process.execPath,['-e',script],{cwd:root,encoding:'utf8',
  env:{...process.env,IM_ACCESSIBILITY_CONFIG_PATH:'C:/test-do-not-connect-lg.json'},
  timeout:7000,windowsHide:true});
 assert.equal(r.status,0,r.stderr||r.error?.message);
});
test('host, video, viewer and fast mode all use the same configured lifetime policy',()=>{
 const host=read('resume-host.cjs'),cast=read('cast/server.cjs'),
  viewer=read('viewer/server.cjs'),fast=read('viewer/fast-video.cjs');
 for(const text of [host,cast,viewer])assert.match(text,/VIEWING\.deadline\(/);
 assert.match(host,/while\(!reason&&VIEWING\.active\(END\)\)/);
 assert.match(host,/Owner selected End TV session/);
 assert.match(host,/childProcs\.find\(x=>!x\.optional&&x\.child\.exitCode!==null\)/);
 assert.match(cast,/if\(MAX_MS!==null\)/);
 assert.match(viewer,/if\(EXPIRES_MS!==null\)/);
 assert.match(fast,/expiresAt!==null&&Date\.now\(\)>=expiresAt/);
 assert.match(fast,/Date\.now\(\)-item\.lastMediaAt>9500/);
});
test('mouse permission remains off by default and expires after ten minutes',()=>{
 const viewer=require('../viewer/server.cjs');
 assert.equal(viewer.state().enabled,false);
 const source=read('viewer/server.cjs');
 assert.match(source,/enabledUntil=expiresAt===null\?Date\.now\(\)\+VIEWING\.MOUSE_LEASE_MS/);
 assert.match(source,/Math\.min\(expiresAt,Date\.now\(\)\+VIEWING\.MOUSE_LEASE_MS\)/);
 assert.match(source,/function available\(\)\{return active\(\)&&enabled&&Date\.now\(\)<enabledUntil;/);
 assert.match(source,/if\(!\(await sourceAudioInfo\(\)\)\.streamReady\)/);
 assert.match(source,/input\?\.confirm!==true/);
 assert.match(source,/if\(!available\(\)\)throw Error\('Controls disabled or expired'\)/);
 assert.match(source,/enabled=false;speakerRouter\.restore\(\)/);
});
test('packaged app includes the viewing policy, and both TV pages show until Stop',()=>{
 assert.match(read('../packaging/build-preview.cjs'),/'viewing-policy\.cjs'/);
 assert.match(read('viewer/web/viewer.js'),/d\.expiresAt===null\?null:/);
 assert.match(read('viewer/web/immersive.js'),/s\.expiresAt===null\?null:/);
 assert.match(read('viewer/web/viewer.html'),/TV video continues until you select Stop/);
 assert.doesNotMatch(read('viewer/web/viewer.html'),/Four-hour TV video/);
 for(const f of ['viewer/web/immersive.js','viewer/web/viewer.js'])
  new vm.Script(read(f),{filename:f});
});
