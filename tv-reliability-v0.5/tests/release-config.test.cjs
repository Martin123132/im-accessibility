'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const c=require('../release-config.cjs');
const nodeExe='C:\\Program Files\\nodejs\\node.exe';
const ffmpegExe='C:\\Tools\\ffmpeg\\ffmpeg.exe';
const files=new Set([nodeExe,ffmpegExe]);
const existsFile=f=>files.has(f);
const adapter=(address='192.168.4.36',netmask='255.255.255.0')=>({family:'IPv4',internal:false,address,netmask});
const one=()=>({Ethernet:[adapter()]});
const settings=()=>({
 schema:1,network:{adapterName:'Ethernet',localIp:'192.168.4.36'},
 television:{model:'OLED55CX6LA',ip:'192.168.4.27'},
 executables:{nodeExe,ffmpegExe}
});
const go=(val=settings(),networkInterfaces=one())=>c.validate(val,{networkInterfaces,existsFile});
function change(fun){const v=settings();fun(v);return v}

test('explicit physical private adapter, TV and executable paths validated',()=>{
 const result=go();
 assert.equal(result.network.name,'Ethernet');
 assert.equal(result.network.ip,'192.168.4.36');
 assert.equal(result.television.ip,'192.168.4.27');
 assert.equal(result.taskName,'ImAccessibility-TV-v1');
 assert.ok(Object.isFrozen(result));
 assert.deepEqual(c.safeSummary(result),{
  valid:true,schema:1,adapter:'Ethernet',localIp:'192.168.4.36',
  networkMask:'255.255.255.0',model:'OLED55CX6LA',tvSelected:true,
  nodeAvailable:true,ffmpegAvailable:true,taskName:'ImAccessibility-TV-v1'
 });
});
test('TV is unselected until owner validates a device; no default guessed address',()=>{
 const valid=go(change(v=>{v.television.ip=null}));
 assert.equal(valid.television.ip,null);assert.equal(c.safeSummary(valid).tvSelected,false);
});
test('no physical private-LAN adapter fails closed',()=>{
 assert.throws(()=>go(settings(),{}),/No matching physical/);
});
test('multiple NICs without unambiguous selection fail closed',()=>{
 const v=change(s=>{s.network={}});
 assert.throws(()=>go(v,{Ethernet:[adapter()],WiFi:[adapter('192.168.4.44')]}),/Select network/);
 const v2=change(s=>{s.network={adapterName:'Ethernet'}});
 assert.throws(()=>go(v2,{Ethernet:[adapter(),adapter('192.168.4.40')]}),/Multiple matching/);
});
test('exact adapter name and IP pick one out of multiple private NICs',()=>{
 const valid=go(settings(),{Ethernet:[adapter()],WiFi:[adapter('192.168.4.44')]});
 assert.equal(valid.network.ip,'192.168.4.36');
});
test('virtual and internal adapters are ignored, never selected',()=>{
 const v=change(s=>{s.network={localIp:'192.168.4.36'}});
 const networks={'vEthernet (Default Switch)':[adapter()],
  'Tailscale Tunnel':[adapter()],
  'Loopback':[({...adapter(),internal:true})]};
 assert.throws(()=>go(v,networks),/No matching physical/);
});
test('only IPv4 and valid RFC1918 interfaces accepted',()=>{
 assert.deepEqual(c.adapters({Ethernet:[{family:'IPv6',internal:false,address:'::1',netmask:'ffff:ffff::'},
  adapter('8.8.8.8'),adapter('192.168.4.36')]}).map(x=>x.ip),['192.168.4.36']);
 const v=change(x=>{x.network={adapterName:'Office',localIp:'10.10.3.8'};x.television.ip='10.10.3.10'});
 assert.equal(go(v,{Office:[{family:4,internal:false,address:'10.10.3.8',netmask:'255.255.255.0'}]}).network.ip,'10.10.3.8');
 const vv=change(x=>{x.network={adapterName:'Office',localIp:'172.20.3.8'};x.television.ip='172.20.3.10'});
 assert.equal(go(vv,{Office:[adapter('172.20.3.8')]}).network.ip,'172.20.3.8');
});
test('wrong local address cannot be silently replaced with first adapter',()=>{
 assert.throws(()=>go(change(v=>v.network.localIp='192.168.4.99')),/No matching physical/);
});
test('wrong TV subnet, public TV address, same PC, network and broadcast rejected',()=>{
 for(const ip of ['192.168.5.27','8.8.8.8','192.168.4.36','192.168.4.0','192.168.4.255']){
  assert.throws(()=>go(change(v=>{v.television.ip=ip})),/television.ip/,'IP '+ip);
 }
});
test('invalid/noncontiguous or excessively broad masks fail closed',()=>{
 for(const mask of ['255.255.0.255','255.0.0.0','255.255.255.255','bad']){
  assert.throws(()=>go(settings(),{Ethernet:[adapter('192.168.4.36',mask)]}),/No matching physical/,'mask '+mask);
 }
});
test('selected adapter requires explicit name/IP, rejects public IP',()=>{
 assert.throws(()=>go(change(v=>{v.network={}})),/Select network/);
 assert.throws(()=>go(change(v=>v.network.localIp='8.8.8.8')),/private IPv4/);
});
test('non-approved TV model is rejected',()=>{
 assert.throws(()=>go(change(v=>v.television.model='SomeOtherModel')),/model not on initial supported-device list/);
});
test('unknown key or embedded credential field rejected; no silent property acceptance',()=>{
 assert.throws(()=>go(change(v=>{v.token='secret'})),/unsupported field.*token/);
 assert.throws(()=>go(change(v=>{v.television.pairingKey='abc'})),/unsupported field.*pairingKey/);
 assert.throws(()=>go(change(v=>{v.executables.password='abc'})),/unsupported field.*password/);
 assert.throws(()=>go(change(v=>{v.network.hostname='wrong'})),/unsupported field.*hostname/);
});
test('unsafe executable paths including relative, UNC, traversal and shell syntax rejected',()=>{
 const examples=['ffmpeg.exe','\\\\server\\share\\ffmpeg.exe','C:\\Tools\\..\\ffmpeg.exe',
  'C:\\Tools\\ffmpeg.exe" /unsafe','C:\\Tools\\ffmpeg.exe:stream',
  'D:/Portable/ffmpeg.exe','C:\\Tools\\not-ffmpeg.exe'];
 for(const value of examples){
  assert.throws(()=>go(change(v=>{v.executables.ffmpegExe=value})),/executables.ffmpeg.exe|Required executable/,'exe '+value);
 }
});
test('missing exact Node and FFmpeg binary fail closed without process launch',()=>{
 const v=settings();
 assert.throws(()=>c.validate(v,{networkInterfaces:one(),existsFile:f=>f===ffmpegExe}),/node.exe/);
 assert.throws(()=>c.validate(v,{networkInterfaces:one(),existsFile:f=>f===nodeExe}),/ffmpeg.exe/);
});
test('IPv4 syntax and subnet predicate resist malformed IPv4',()=>{
 for(const ip of ['192.168.000.3','192.168.4.256','192.168.4.4\\n','192.168.4','-1.2.3.4']){
  assert.equal(c.uintIp(ip),null);
 }
 assert.equal(c.subnet('192.168.4.27','192.168.4.36','255.255.255.0'),true);
 assert.equal(c.subnet('192.168.5.27','192.168.4.36','255.255.255.0'),false);
});
test('config source defaults to per-user LocalAppData outside repository',()=>{
 const r=c.configPath({env:{LOCALAPPDATA:'C:\\Users\\Owner\\AppData\\Local'},platform:'win32',repoRoot:'D:\\release'});
 assert.equal(r,'C:\\Users\\Owner\\AppData\\Local\\ImAccessibility\\settings.json');
});
test('explicit per-user settings path override accepted only outside source tree',()=>{
 const good=c.configPath({env:{IM_ACCESSIBILITY_CONFIG_PATH:'D:\\OwnerSettings\\settings.json'},platform:'win32',repoRoot:'D:\\release'});
 assert.equal(good,'D:\\OwnerSettings\\settings.json');
 assert.throws(()=>c.configPath({env:{IM_ACCESSIBILITY_CONFIG_PATH:'D:\\release\\settings.json'},platform:'win32',repoRoot:'D:\\release'}),/inside/);
 assert.throws(()=>c.configPath({env:{IM_ACCESSIBILITY_CONFIG_PATH:'D:\\release\\sub\\settings.json'},platform:'win32',repoRoot:'D:\\release'}),/inside/);
});
test('relative/UNC, colon stream, repo storage, non-windows and escape rejected',()=>{
 const base={platform:'win32',repoRoot:'D:\\release'};
 for(const p of ['settings.json','\\\\server\\settings.json','D:\\release\\..\\Owner\\settings.json',
  'D:\\Owner\\file.json','D:\\Owner\\settings.json:stream']){
  assert.throws(()=>c.configPath({...base,env:{IM_ACCESSIBILITY_CONFIG_PATH:p}}));
 }
 assert.throws(()=>c.configPath({env:{LOCALAPPDATA:'C:\\Users\\Owner\\AppData\\Local'},platform:'linux',repoRoot:'D:\\release'}),/Windows is required/);
});
function pretendFs(file,contents){
 return {
  statSync(p){
   if(p===file)return {size:Buffer.byteLength(contents),isFile:()=>true};
   if(files.has(p))return {size:10000,isFile:()=>true};
   throw Error('ENOENT');
  },
  readFileSync(p){assert.equal(p,file);return contents;},
  writeFileSync(){throw Error('No write is allowed');}
 };
}
test('read-only per-user settings loader reads and validates without any writes',()=>{
 const file='C:\\Users\\Owner\\AppData\\Local\\ImAccessibility\\settings.json';
 const value=c.readUserSettings({env:{LOCALAPPDATA:'C:\\Users\\Owner\\AppData\\Local'},
  platform:'win32',repoRoot:'D:\\release',fsApi:pretendFs(file,JSON.stringify(settings())),networkInterfaces:one()});
 assert.equal(value.network.ip,'192.168.4.36');
});
test('missing config, oversized data and corrupt JSON fail closed',()=>{
 const file='C:\\Users\\Owner\\AppData\\Local\\ImAccessibility\\settings.json';
 const base={env:{IM_ACCESSIBILITY_CONFIG_PATH:file},platform:'win32',repoRoot:'D:\\release',networkInterfaces:one()};
 assert.throws(()=>c.readUserSettings({...base,fsApi:{statSync(){throw Error('ENOENT')}}}),/missing/);
 assert.throws(()=>c.readUserSettings({...base,fsApi:pretendFs(file,'x'.repeat(8200))}),/oversized/);
 assert.throws(()=>c.readUserSettings({...base,fsApi:pretendFs(file,'not json')}),/not valid JSON/);
});
test('pure module exposes no action for pairing, commands, or storing secrets',()=>{
 const code=fs.readFileSync(path.resolve(__dirname,'../release-config.cjs'),'utf8');
 assert.doesNotMatch(code,/\.writeFileSync\(|\.spawn\(|\.execSync\(|\.listen\(/);
 assert.ok(!('pair' in c) && !('send' in c) && !('launch' in c));
});
