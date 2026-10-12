'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
const broker=require('../server.cjs');
const exe=path.resolve(__dirname,'../native/TvPointer.exe');
test('coordinate and local network allowlist is bounded',()=>{
 assert.equal(broker.isValidCoord(0),true);assert.equal(broker.isValidCoord(10000),true);
 for(const invalid of [-1,10001,0.2,'10000',null,NaN])assert.equal(broker.isValidCoord(invalid),false);
 assert.equal(broker.sameSubnet('192.168.4.39'),true);
 assert.equal(broker.sameSubnet('8.8.8.8'),false);
 assert.equal(broker.sameSubnet('192.168.8.39'),false);
});
test('native helper is pinned to primary 1920 by 1080, no keyboard',()=>{
 assert.ok(fs.existsSync(exe));
 const r=cp.spawnSync(exe,['status'],{encoding:'utf8',timeout:2500,windowsHide:true});
 assert.equal(r.status,0,r.stderr);
 const x=JSON.parse(r.stdout);assert.equal(x.width,1920);assert.equal(x.height,1080);
 assert.equal(x.action,'status');
});
test('invalid native wheel and unsupported action fail closed',()=>{
 for(const args of [['wheel','0','5000','5000'],['wheel','4','5000','5000'],['keyboard','HELLO'],['click','-1','100']]){
  const r=cp.spawnSync(exe,args,{encoding:'utf8',timeout:2500,windowsHide:true});assert.notEqual(r.status,0);
 }
});
test('mouse broker starts disarmed and cannot operate without opt-in',()=>{
 assert.equal(broker.state().enabled,false);
 assert.throws(()=>broker.consume({cmd:'click',x:5000,y:5000}),/disabled or expired/i);
});
