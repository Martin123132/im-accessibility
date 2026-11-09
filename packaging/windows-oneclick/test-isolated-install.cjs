'use strict';
// Windows-only disposable LOCALAPPDATA install/upgrade-preservation/uninstall QA.
// Does not register tasks, create shortcuts/registry entries, discover or contact TVs,
// launch a host, capture a desktop, or change a real speaker. All GUI runs self-exit.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
function main(setup,output){
 if(process.platform!=='win32'||!setup||!output)throw Error('Usage on Windows: node test-isolated-install.cjs SETUP_EXE NEW_REPORT_DIRECTORY');
 const reportDir=path.resolve(output);fs.mkdirSync(reportDir,{recursive:false});
 const qa=path.join(os.tmpdir(),'ImAccessibility-QA',crypto.randomUUID().replaceAll('-',''));
 const local=path.join(qa,'LocalAppData');fs.mkdirSync(local,{recursive:true});fs.writeFileSync(path.join(qa,'.disposable-profile'),'disposable QA only\n');
 const env={...process.env,LOCALAPPDATA:local,IM_ACCESSIBILITY_QA_ROOT:qa,IM_ACCESSIBILITY_CONFIG_PATH:path.join(local,'ImAccessibility','settings.json')};
 const app=path.join(local,'Programs','ImAccessibility'),receipts=[],checks=[];
 function run(exe,args){
  const r=cp.spawnSync(exe,args,{env,encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:500000});
  receipts.push({program:path.basename(exe),arguments:args.map(x=>path.basename(x)),pid:r.pid,exited:r.status!==null,exitCode:r.status,signal:r.signal||null});
  if(r.error||r.status!==0)throw Error(path.basename(exe)+' failed: '+String(r.error||r.stderr));
  return r.stdout;
 }
 function gui(exe,op,label,expected){
  const file=path.join(reportDir,label+'.txt');run(exe,[op,file]);
  const text=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');assert.match(text,expected);checks.push(label);return text;
 }
 function node(code){return run(path.join(app,'Runtime','node.exe'),['-e',code]);}
 let external;
 try{
  gui(setup,'--verify','archive',/^SUCCESS VALID/);
  gui(setup,'--test-install','fresh-install',/^SUCCESS /);
  assert.equal(fs.existsSync(env.IM_ACCESSIBILITY_CONFIG_PATH),false);checks.push('fresh-no-settings');
  const self=JSON.parse(gui(path.join(app,'ImAccessibility.exe'),'--selftest','runtime-selftest',/"node":true/));
  assert.equal(self.ffmpeg,true);assert.equal(self.settingsPresent,false);
  const a11y=JSON.parse(gui(path.join(app,'ImAccessibility.exe'),'--accessibility-selftest','accessibility',/"allNamed":true/));
  assert.equal(a11y.tabOrderValid,true);assert.equal(a11y.allTabStops,true);
  const guardianStatus=node(`const cp=require('node:child_process'),path=require('node:path');const r=cp.spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',${JSON.stringify(path.join(app,'audio-guard-task.ps1'))},'-Action','Status'],{encoding:'utf8',windowsHide:true,timeout:12000});if(r.status!==0)throw Error(r.stderr);console.log(r.stdout);`);
  assert.equal(JSON.parse(guardianStatus).installed,false);checks.push('packaged-audio-guardian-status');
  const first=path.join(app,'first-run.cjs');
  const setupCode=`const f=require(${JSON.stringify(first)});const path=require('node:path');const root=${JSON.stringify(app)};const interfaces={WiFi:[{family:'IPv4',internal:false,address:'192.168.50.36',netmask:'255.255.255.0',mac:'12:34:56:78:90:ab'}]};f.saveSettings({adapterName:'WiFi',localIp:'192.168.50.36',tvIp:'192.168.50.27',nodeExe:path.join(root,'Runtime','node.exe'),ffmpegExe:path.join(root,'Runtime','ffmpeg.exe')},{networkInterfaces:interfaces});interfaces.WiFi[0].address='192.168.50.152';if(f.validateInstalled({networkInterfaces:interfaces}).summary.localIp!=='192.168.50.152')throw Error('DHCP failed');console.log('PASS');`;
  assert.match(node(setupCode),/PASS/);checks.push('packaged-dhcp-validation');
  const saved=fs.readFileSync(env.IM_ACCESSIBILITY_CONFIG_PATH);
  external=path.join(qa,'Uninstall-QA.exe');fs.copyFileSync(path.join(app,'ImAccessibility-Uninstall.exe'),external);
  const runtime=path.join(app,'tv-reliability-v0.5','runtime');fs.mkdirSync(runtime,{recursive:true});
  const state=path.join(runtime,'state.json');fs.writeFileSync(state,JSON.stringify({runId:'a'.repeat(16),state:'ready'}));
  gui(external,'--verify','active-session-refused',/^INVALID: .*still running/);fs.unlinkSync(state);
  const journalDir=path.join(app,'tv-reliability-v0.5','viewer','runtime');fs.mkdirSync(journalDir,{recursive:true});
  const journal=path.join(journalDir,'speaker-route.json');fs.writeFileSync(journal,'{}');
  gui(external,'--verify','audio-pending-refused',/^INVALID: .*audio restoration is pending/);fs.unlinkSync(journal);
  const unknown=path.join(app,'unknown.txt');fs.writeFileSync(unknown,'preserve me');
  gui(external,'--verify','unknown-file-refused',/^INVALID: .*unrecognised file/);assert.equal(fs.readFileSync(unknown,'utf8'),'preserve me');fs.unlinkSync(unknown);
  const changed=path.join(app,'status-session.cjs'),original=fs.readFileSync(changed);fs.appendFileSync(changed,'\n// changed');
  gui(external,'--verify','modified-file-refused',/^INVALID: .*changed size/);fs.writeFileSync(changed,original);
  const target=path.join(qa,'Untouched');fs.mkdirSync(target);fs.writeFileSync(path.join(target,'keep.txt'),'keep');
  const link=path.join(runtime,'linked');fs.symlinkSync(target,link,'junction');
  gui(external,'--verify','junction-refused',/^INVALID: .*Linked/);fs.unlinkSync(link);assert.equal(fs.readFileSync(path.join(target,'keep.txt'),'utf8'),'keep');
  gui(external,'--test-uninstall','uninstall',/^SUCCESS /);assert.equal(fs.existsSync(app),false);assert.deepEqual(fs.readFileSync(env.IM_ACCESSIBILITY_CONFIG_PATH),saved);
  gui(setup,'--test-install','reinstall-preserving-settings',/^SUCCESS /);assert.deepEqual(fs.readFileSync(env.IM_ACCESSIBILITY_CONFIG_PATH),saved);
  const reconfirm=`const fs=require('node:fs'),crypto=require('node:crypto'),f=require(${JSON.stringify(first)});const file=process.env.IM_ACCESSIBILITY_CONFIG_PATH,before=fs.readFileSync(file),v=JSON.parse(before);const interfaces={WiFi:[{family:'IPv4',internal:false,address:'192.168.50.152',netmask:'255.255.255.0',mac:'12:34:56:78:90:ab'}]};const result=f.saveSettings({adapterName:'WiFi',localIp:'192.168.50.152',tvIp:v.television.ip,...v.executables},{networkInterfaces:interfaces,expectedHash:crypto.createHash('sha256').update(before).digest('hex')});if(!result.unchanged||!before.equals(fs.readFileSync(file)))throw Error('Reinstall TV selection failed');console.log('PASS');`;
  assert.match(node(reconfirm),/PASS/);checks.push('reinstalled-tv-reselection-preserves-settings');
  gui(setup,'--test-install','overwrite-refused',/^FAILED .*already installed/s);
  gui(setup,'--test-existing','existing-app-verified-without-overwrite',/^SUCCESS .*ImAccessibility.exe/);
  const appExe=path.join(app,'ImAccessibility.exe'),appBytes=fs.readFileSync(appExe);
  fs.appendFileSync(appExe,'changed');
  gui(setup,'--test-existing','modified-existing-app-not-opened',/^FAILED .*could not be verified/s);
  fs.writeFileSync(appExe,appBytes);assert.deepEqual(fs.readFileSync(env.IM_ACCESSIBILITY_CONFIG_PATH),saved);
  gui(external,'--test-uninstall','final-uninstall',/^SUCCESS /);assert.equal(fs.existsSync(app),false);
  assert.deepEqual(fs.readFileSync(env.IM_ACCESSIBILITY_CONFIG_PATH),saved);checks.push('settings-preserved-byte-for-byte');
  const report={passed:checks.length,checks,processes:receipts,allExited:receipts.every(r=>r.exited),applicationRemoved:!fs.existsSync(app),realWindowsUserProfile:false,registryShortcutsAndTasksExercised:false,physicalTvTested:false};
  fs.writeFileSync(path.join(reportDir,'summary.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }finally{
  // Only remove this exact random, marked scratch tree after successful uninstall.
  // Retain a failed install for diagnosis instead of bypassing its safety guard.
  if(!fs.existsSync(app)&&path.dirname(qa)===path.join(os.tmpdir(),'ImAccessibility-QA')&&fs.existsSync(path.join(qa,'.disposable-profile')))
   fs.rmSync(qa,{recursive:true,force:true});
 }
}
if(require.main===module)try{main(...process.argv.slice(2))}catch(e){console.error(e.stack);process.exitCode=1}
module.exports={main};
