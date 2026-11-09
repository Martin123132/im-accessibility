'use strict';
// Offline-only user-profile settings and launcher tests; no TV, network calls or real child processes.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto');
const setup=require('../first-run.cjs'),launcher=require('../launch-host.cjs');
const onlyWindows=process.platform!=='win32';
const lan={
 'Ethernet':[{family:'IPv4',internal:false,address:'10.36.2.14',netmask:'255.255.255.0'}],
 'vEthernet (Internal)':[{family:'IPv4',internal:false,address:'192.168.4.40',netmask:'255.255.255.0'}]
};
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-first-run-'));
function create(base,{tv='10.36.2.40'}={}){
 const local=path.join(base,'USERROOT');fs.mkdirSync(local);
 const bin=path.join(base,'ffmpeg.exe');fs.writeFileSync(bin,'synthetic prerequisite, never executed');
 return {local,ffmpegExe:bin,settings:{
  adapterName:'Ethernet',localIp:'10.36.2.14',tvIp:tv,
  nodeExe:process.execPath,ffmpegExe:bin
 },env:{LOCALAPPDATA:local},networkInterfaces:lan};
}
test('read-only doctor lists available adapters without selecting a TV or writing files',{skip:onlyWindows},()=>{
 const base=temp();
 try{
  const p=create(base),before=fs.readdirSync(p.local);
  const report=setup.doctor({networkInterfaces:p.networkInterfaces,nodeExe:p.settings.nodeExe,
   ffmpegExe:p.ffmpegExe});
  assert.equal(report.mode,'read-only');
  assert.equal(report.adapters.length,1);
  assert.equal(report.adapters[0].ip,'10.36.2.14');
  assert.equal(report.ffmpegExeIsFile,true);
  assert.deepEqual(fs.readdirSync(p.local),before);
  assert.match(report.note,/No pairing/);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test('valid owner choice writes once to Windows user profile, not to Git or runtime',{skip:onlyWindows},()=>{
 const base=temp();
 try{
  const p=create(base),first=setup.saveSettings(p.settings,p);
  assert.equal(first.written,true);
  const expected=path.join(p.local,'ImAccessibility','settings.json');
  assert.equal(first.file,expected);
  const value=JSON.parse(fs.readFileSync(expected,'utf8'));
  assert.equal(value.schema,1);
  assert.equal(value.television.ip,'10.36.2.40');
  assert.equal(value.network.adapterName,'Ethernet');
  assert.deepEqual(Object.keys(value).sort(),['executables','network','schema','television'].sort());
  assert.equal(setup.validateInstalled(p).summary.tvSelected,true);
  assert.throws(()=>setup.saveSettings(p.settings,p),/already exist/);
  assert.deepEqual(JSON.parse(fs.readFileSync(expected,'utf8')),value);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test('invalid adapter or wrong-subnet TV fails closed before creating settings',{skip:onlyWindows},()=>{
 const base=temp();
 try{
  const p=create(base);p.settings.tvIp='8.8.8.8';
  assert.throws(()=>setup.saveSettings(p.settings,p),/television.ip/);
  assert.equal(fs.existsSync(path.join(p.local,'ImAccessibility')),false);
  p.settings.tvIp='10.36.2.40';p.settings.adapterName='wrong';
  assert.throws(()=>setup.saveSettings(p.settings,p),/No matching physical/);
  assert.equal(fs.existsSync(path.join(p.local,'ImAccessibility')),false);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});

test('reinstall can reconfirm the saved TV without rewriting settings, including DHCP renewal',{skip:onlyWindows},()=>{
 const base=temp();try{
  const p=create(base),saved=setup.saveSettings(p.settings,p),before=fs.readFileSync(saved.file);
  const expectedHash=crypto.createHash('sha256').update(before).digest('hex');
  const same=setup.saveSettings(p.settings,{...p,expectedHash});
  assert.equal(same.unchanged,true);assert.equal(same.written,false);
  const networkInterfaces={Ethernet:[{family:'IPv4',internal:false,address:'10.36.2.152',netmask:'255.255.255.0'}]};
  const renewed=setup.saveSettings({...p.settings,localIp:'10.36.2.152'},{...p,networkInterfaces,expectedHash});
  assert.equal(renewed.unchanged,true);assert.deepEqual(fs.readFileSync(saved.file),before);
  assert.deepEqual(fs.readdirSync(path.dirname(saved.file)),['settings.json']);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});

test('explicit TV reselection keeps a byte-exact backup and rejects stale confirmation or a wrong LAN',{skip:onlyWindows},()=>{
 const base=temp();try{
  const p=create(base),saved=setup.saveSettings(p.settings,p),before=fs.readFileSync(saved.file);
  const expectedHash=crypto.createHash('sha256').update(before).digest('hex');
  for(const invalid of [{tvIp:'10.36.3.40'},{adapterName:'Wrong NIC'},{tvIp:'10.36.2.14'}]){
   assert.throws(()=>setup.saveSettings({...p.settings,...invalid},{...p,expectedHash}));
   assert.deepEqual(fs.readFileSync(saved.file),before);
  }
  const changed=setup.saveSettings({...p.settings,tvIp:'10.36.2.41'},{...p,expectedHash});
  assert.equal(changed.written,true);assert.deepEqual(fs.readFileSync(changed.backup),before);
  const after=fs.readFileSync(saved.file);assert.equal(JSON.parse(after).television.ip,'10.36.2.41');
  assert.throws(()=>setup.saveSettings(p.settings,{...p,expectedHash}),/changed in another window/);
  assert.deepEqual(fs.readFileSync(saved.file),after);
  assert.equal(fs.existsSync(path.join(path.dirname(saved.file),'.settings-save.lock')),false);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});

test('a pending settings save is never overridden and a missing confirmed file is not recreated',{skip:onlyWindows},()=>{
 const base=temp();try{
  const p=create(base),saved=setup.saveSettings(p.settings,p),before=fs.readFileSync(saved.file);
  const expectedHash=crypto.createHash('sha256').update(before).digest('hex');
  const lock=path.join(path.dirname(saved.file),'.settings-save.lock');fs.writeFileSync(lock,'other owner');
  assert.throws(()=>setup.saveSettings(p.settings,{...p,expectedHash}),/EEXIST/);
  assert.equal(fs.readFileSync(lock,'utf8'),'other owner');assert.deepEqual(fs.readFileSync(saved.file),before);
  fs.unlinkSync(lock);fs.unlinkSync(saved.file);
  assert.throws(()=>setup.saveSettings(p.settings,{...p,expectedHash}),/removed/);
  assert.equal(fs.existsSync(saved.file),false);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test('a supplied user profile path inside the source checkout is refused', {skip:onlyWindows},()=>{
 const repoRoot=path.resolve(__dirname,'../..');
 assert.throws(()=>setup.settingsFile({LOCALAPPDATA:repoRoot}),/source\/repository directory/);
});
test('missing FFmpeg fails closed and settings are not written',{skip:onlyWindows},()=>{
 const base=temp();
 try{
  const p=create(base);fs.unlinkSync(p.ffmpegExe);
  assert.throws(()=>setup.saveSettings(p.settings,p),/ffmpeg.exe/);
  assert.equal(fs.existsSync(path.join(p.local,'ImAccessibility')),false);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test('a linked user settings directory is refused without modifying its target',{skip:onlyWindows},()=>{
 const base=temp();
 try{
  const p=create(base),target=path.join(base,'Target');
  fs.mkdirSync(target);
  const link=path.join(p.local,'ImAccessibility');
  try{fs.symlinkSync(target,link,'junction')}catch(e){
   if(['EPERM','EACCES','ENOTSUP'].includes(e.code))return;
   throw e;
  }
  assert.throws(()=>setup.saveSettings(p.settings,p),/linked/);
  assert.deepEqual(fs.readdirSync(target),[]);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test('a TV may remain unselected during setup; Start refuses to launch until selected',{skip:onlyWindows},()=>{
 const base=temp();
 try{
  const p=create(base,{tv:null});
  setup.saveSettings(p.settings,p);
  const host=path.join(base,'resume-host.cjs');fs.writeFileSync(host,'test fixture');
  assert.equal(setup.validateInstalled(p).summary.tvSelected,false);
  assert.throws(()=>launcher.preflight({env:p.env,networkInterfaces:p.networkInterfaces,
   hostPath:host,statePath:path.join(base,'state.json'),
   stopPath:path.join(base,'stop.json')}),/No owner-selected LG TV/);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test('launch preflight checks exact owner selection, refuses active or uncertain sessions',{skip:onlyWindows},()=>{
 const base=temp();
 try{
  const p=create(base);setup.saveSettings(p.settings,p);
  const host=path.join(base,'resume-host.cjs'),state=path.join(base,'state.json'),stop=path.join(base,'stop-request.json');
  fs.writeFileSync(host,'test fixture');
  const opts={env:p.env,networkInterfaces:p.networkInterfaces,hostPath:host,statePath:state,stopPath:stop};
  const validated=launcher.preflight(opts);
  assert.equal(validated.config.television.ip,'10.36.2.40');
  assert.equal(validated.config.network.ip,'10.36.2.14');
  fs.writeFileSync(state,JSON.stringify({runId:'0123456789abcdef',state:'ready'}));
  assert.throws(()=>launcher.preflight(opts),/existing or uncertain/);
  fs.writeFileSync(state,'broken');
  assert.throws(()=>launcher.preflight(opts),/Cannot read old session/);
  fs.writeFileSync(state,JSON.stringify({runId:'0123456789abcdef',state:'stopped'}));
  assert.equal(launcher.preflight(opts).config.network.ip,'10.36.2.14');
  fs.writeFileSync(stop,'pending stop');
  assert.throws(()=>launcher.preflight(opts),/previous Stop/);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
test('isolated launch injects exact verified Node path and never invokes an unrelated command',()=>{
 let called=0,unref=0,seen=null;
 const selected={config:{executables:{nodeExe:'C:\\Verified\\node.exe'}},
  hostFile:'C:\\ImAccessibility\\tv-reliability-v0.5\\resume-host.cjs',
  settingsFile:'C:\\Profile\\ImAccessibility\\settings.json'};
 const result=launcher.launch({portsFn:()=>{},fsApi:{existsSync:()=>false},
  preflightFn:()=>selected,
  spawnFn:(exe,args,options)=>{
   called++;seen={exe,args,options};
   return {pid:14321,unref(){unref++}};
  }
 });
 assert.equal(result.requested,true);
 assert.equal(called,1);assert.equal(unref,1);
 assert.equal(seen.exe,selected.config.executables.nodeExe);
 assert.deepEqual(seen.args,[selected.hostFile]);
 assert.equal(seen.options.env.IM_ACCESSIBILITY_CONFIG_PATH,selected.settingsFile);
 assert.equal(seen.options.stdio,'ignore');
 assert.equal(seen.options.windowsHide,true);
});
test('setup choices are explicit, and no silent first-adapter selection',()=>{
 assert.equal(setup.numberChoice('1',1),0);
 assert.equal(setup.numberChoice('2',1),null);
 assert.equal(setup.numberChoice('0',2),null);
 assert.equal(setup.numberChoice('1.0',2),null);
 assert.equal(setup.numberChoice(' 1 ',2),null);
 const adapters=setup.fixture({networkInterfaces:lan}).adapters;
 assert.equal(adapters.length,1);assert.equal(adapters[0].name,'Ethernet');
});
test('importing setup / launcher and read-only help never contacts TV, starts a service or stores files',{skip:onlyWindows},()=>{
 const base=temp(),p=create(base);
 try{
  const env={...process.env,LOCALAPPDATA:p.local,IM_ACCESSIBILITY_CONFIG_PATH:''};
  const cmd=cp.spawnSync(process.execPath,[path.resolve(__dirname,'../first-run.cjs'),'--doctor'],
   {encoding:'utf8',timeout:4000,windowsHide:true,env});
  assert.equal(cmd.status,0,cmd.stderr);
  const parsed=JSON.parse(cmd.stdout);
  assert.equal(parsed.mode,'read-only');
  assert.equal(fs.existsSync(path.join(p.local,'ImAccessibility')),false);
  const help=cp.spawnSync(process.execPath,[path.resolve(__dirname,'../first-run.cjs'),'--help'],
   {encoding:'utf8',timeout:4000,windowsHide:true,env});
  assert.equal(help.status,0);
  assert.equal(fs.existsSync(path.join(p.local,'ImAccessibility')),false);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});

test('validate installed settings and launcher both survive same-LAN DHCP without rewriting saved settings',{skip:onlyWindows},()=>{
 const base=temp();try{
  const p=create(base);setup.saveSettings(p.settings,p);
  const file=setup.settingsFile(p.env).file,before=fs.readFileSync(file,'utf8');
  const networkInterfaces={Ethernet:[{family:'IPv4',internal:false,address:'10.36.2.152',netmask:'255.255.255.0'}]};
  assert.equal(setup.validateInstalled({...p,networkInterfaces}).summary.localIp,'10.36.2.152');
  const host=path.join(base,'resume-host.cjs');fs.writeFileSync(host,'fixture');
  const result=launcher.preflight({env:p.env,networkInterfaces,hostPath:host,statePath:path.join(base,'state.json'),stopPath:path.join(base,'stop.json')});
  assert.equal(result.config.network.ip,'10.36.2.152');assert.equal(result.config.television.ip,'10.36.2.40');
  assert.equal(fs.readFileSync(file,'utf8'),before);
  const wrong={Ethernet:[{family:'IPv4',internal:false,address:'10.36.3.152',netmask:'255.255.255.0'}]};
  assert.throws(()=>setup.validateInstalled({...p,networkInterfaces:wrong}),/No matching/);
 }finally{fs.rmSync(base,{recursive:true,force:true})}
});
