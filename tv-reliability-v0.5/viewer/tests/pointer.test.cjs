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
test('native helper reads bounded primary display dimensions; no keyboard API',()=>{
 assert.ok(fs.existsSync(exe));
 const r=cp.spawnSync(exe,['status'],{encoding:'utf8',timeout:2500,windowsHide:true});
 assert.equal(r.status,0,r.stderr);
 const x=JSON.parse(r.stdout);
 assert.equal(x.ok,true);
 assert.equal(x.action,'status');
 assert.equal(x.events,0);
 assert.ok(Number.isInteger(x.width)&&x.width>=640&&x.width<=8192,'Primary display width must be bounded');
 assert.ok(Number.isInteger(x.height)&&x.height>=480&&x.height<=4320,'Primary display height must be bounded');
 const source=fs.readFileSync(path.resolve(__dirname,'../native/TvPointer.cs'),'utf8');
 assert.match(source,/GetSystemMetrics\(0\)/);
 assert.match(source,/GetSystemMetrics\(1\)/);
 assert.doesNotMatch(source,/keybd_event|SendKeys|KEYEVENTF|KeyboardInput/i);
 // Optional device-specific acceptance, e.g. PC_BRIDGE_EXPECTED_SCREEN=1920x1080.
 const expected=process.env.PC_BRIDGE_EXPECTED_SCREEN;
 if(expected){
  const dims=/^(\d{3,4})x(\d{3,4})$/.exec(expected);
  assert.ok(dims,'Expected display must be formatted WIDTHxHEIGHT');
  assert.equal(x.width,Number(dims[1]));
  assert.equal(x.height,Number(dims[2]));
 }
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
