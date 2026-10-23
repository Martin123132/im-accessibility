'use strict';
// All tests use disposable Windows TEMP / synthetic LOCALAPPDATA. No live TV, Codex or PC Bridge.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const core=require('../package-core.cjs');
const build=require('../build-preview.cjs').build;
function run(exe,args,env){return cp.spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:12000,env:{...process.env,...env}})}
const onlyWindows=process.platform!=='win32';
test('portable preview: content hashes, bounded install, stop and reversible uninstall', {skip:onlyWindows,timeout:55000},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-preview-test-'));
 const bundle=path.join(dir,'bundle'),local=path.join(dir,'LOCALAPPDATA');
 fs.mkdirSync(local);
 try{
  const result=build(bundle);
  assert.ok(result.files>=40);
  assert.ok(result.totalBytes>100000);
  const man=JSON.parse(fs.readFileSync(path.join(bundle,'package-manifest.json'),'utf8'));
  assert.equal(core.verify(path.join(bundle,'payload'),man).files,man.files.length);
  assert.equal(man.product,'ImAccessibility');
  assert.ok(man.files.some(x=>x.path==='Setup.cmd'));
  assert.ok(man.files.some(x=>x.path==='first-run.cjs'));
  assert.ok(man.files.some(x=>x.path==='launch-host.cjs'));
  assert.ok(man.files.some(x=>x.path.endsWith('cast/node_modules/lgtv2/LICENSE')));
  assert.ok(man.files.some(x=>x.path.endsWith('cast/node_modules/ws/LICENSE')));
  assert.ok(man.files.some(x=>x.path.endsWith('viewer/native/TvPointer.exe')));
  assert.ok(man.files.every(x=>!/(^|\/)(runtime|evidence|profiles|\.git)(\/|$)/i.test(x.path)));
  assert.ok(man.files.every(x=>!x.path.toLowerCase().includes('codex')));
  assert.ok(man.files.every(x=>!x.path.toLowerCase().includes('pc-bridge-public-demo')));
  assert.ok(man.files.every(x=>!/(node_modules\/\.bin\/|\/(?:node|ffmpeg)\.exe$)/i.test(x.path)));

  const env={LOCALAPPDATA:local};
  const installed=core.destFor(env);
  const ownSettings=path.join(local,'ImAccessibility');
  fs.mkdirSync(ownSettings);
  const settings=path.join(ownSettings,'settings.json');
  fs.writeFileSync(settings,'owner preserved private data\n');
  const unrelated=path.join(local,'other-owner-file.txt');
  fs.writeFileSync(unrelated,'keep this file');

  const install=run(process.execPath,[path.join(bundle,'install.cjs')],env);
  assert.equal(install.status,0,install.stdout+' '+install.stderr);
  assert.ok(fs.existsSync(path.join(installed,'Setup.cmd')));
  assert.ok(fs.existsSync(path.join(installed,'first-run.cjs')));
  assert.ok(fs.existsSync(path.join(installed,'launch-host.cjs')));
  const startCmd=fs.readFileSync(path.join(installed,'Start.cmd'),'utf8');
  assert.match(startCmd,/launch-host\.cjs/);
  assert.doesNotMatch(startCmd,/start.*resume-host\.cjs/i);
  assert.ok(fs.existsSync(path.join(installed,'Start.cmd')));
  assert.ok(fs.existsSync(path.join(installed,'Stop.cmd')));
  assert.ok(fs.existsSync(path.join(installed,'Uninstall.cmd')));
  assert.ok(!fs.existsSync(path.join(installed,'tv-reliability-v0.5','runtime','state.json')));
  assert.equal(fs.readFileSync(settings,'utf8'),'owner preserved private data\n');

  const duplicate=run(process.execPath,[path.join(bundle,'install.cjs')],env);
  assert.notEqual(duplicate.status,0,'Double install must never overwrite');
  const marker=path.join(installed,core.RECEIPT);
  assert.ok(fs.existsSync(marker));
  const receiptBefore=core.sha(fs.readFileSync(marker));

  const file=path.join(installed,'tv-reliability-v0.5','viewer','web','viewer.js');
  const original=fs.readFileSync(file);
  fs.appendFileSync(file,'\nowner modified file\n');
  const changed=run(process.execPath,[path.join(installed,'Uninstall.cjs')],env);
  assert.notEqual(changed.status,0);
  assert.ok(fs.existsSync(marker),'Modified install must remain intact');
  fs.writeFileSync(file,original);

  const extra=path.join(installed,'new-user-file.txt');
  fs.writeFileSync(extra,'do not delete');
  const unfamiliar=run(process.execPath,[path.join(installed,'Uninstall.cjs')],env);
  assert.notEqual(unfamiliar.status,0);
  assert.ok(fs.existsSync(extra));
  fs.unlinkSync(extra);
  assert.equal(core.sha(fs.readFileSync(marker)),receiptBefore);

  const s=path.join(installed,'tv-reliability-v0.5','runtime');
  fs.mkdirSync(s);
  fs.writeFileSync(path.join(s,'state.json'),JSON.stringify({runId:'0123456789abcdef',state:'ready'}));
  const stop=run(process.execPath,[path.join(installed,'stop-session.cjs')],env);
  assert.equal(stop.status,0,stop.stderr);
  const signal=JSON.parse(fs.readFileSync(path.join(s,'stop-request.json'),'utf8'));
  assert.equal(signal.reason,'owner-emergency-stop');
  const twice=run(process.execPath,[path.join(installed,'stop-session.cjs')],env);
  assert.equal(twice.status,0,'Stop is idempotent');
  const busy=run(process.execPath,[path.join(installed,'Uninstall.cjs')],env);
  assert.notEqual(busy.status,0,'Active session metadata should block uninstall');
  fs.rmSync(s,{recursive:true,force:true});

  const uninstall=run(process.execPath,[path.join(installed,'Uninstall.cjs')],env);
  assert.equal(uninstall.status,0,uninstall.stdout+' '+uninstall.stderr);
  assert.equal(fs.existsSync(installed),false);
  assert.equal(fs.readFileSync(settings,'utf8'),'owner preserved private data\n');
  assert.equal(fs.readFileSync(unrelated,'utf8'),'keep this file');

  const missingReceipt=run(process.execPath,[path.join(bundle,'payload','Uninstall.cjs')],env);
  assert.notEqual(missingReceipt.status,0,'Uninstaller must be run from exact installed directory');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('tampered payload fails before touching the user installation directory',{skip:onlyWindows,timeout:25000},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-tamper-'));
 const bundle=path.join(dir,'bundle'),local=path.join(dir,'USERROOT');
 fs.mkdirSync(local);
 try{
  build(bundle);
  const file=path.join(bundle,'payload','tv-reliability-v0.5','cast','server.cjs');
  fs.appendFileSync(file,'\n// accidental modification\n');
  const bad=run(process.execPath,[path.join(bundle,'install.cjs')],{LOCALAPPDATA:local});
  assert.notEqual(bad.status,0);
  assert.match(bad.stderr,/checksum/i);
  assert.ok(!fs.existsSync(core.destFor({LOCALAPPDATA:local})));
  assert.ok(!fs.existsSync(path.join(local,'Programs')),'No target directories on payload integrity failure');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('package manifest rejects escaping paths, duplicates and unlisted files',{skip:onlyWindows,timeout:25000},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'imaccess-manifest-'));
 const bundle=path.join(dir,'bundle');
 try{
  build(bundle);
  const payload=path.join(bundle,'payload');
  const original=JSON.parse(fs.readFileSync(path.join(bundle,'package-manifest.json'),'utf8'));
  assert.throws(()=>core.verify(payload,{...original,files:[...original.files,original.files[0]]}),/Duplicate/);
  assert.throws(()=>core.verify(payload,{...original,files:[{...original.files[0],path:'../escape'},...original.files.slice(1)]}),/Unsafe/);
  fs.writeFileSync(path.join(payload,'unexpected.txt'),'unlisted file');
  assert.throws(()=>core.verify(payload,original),/Unlisted/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
