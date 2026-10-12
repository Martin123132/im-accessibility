'use strict';
// Read-only local prerequisite check. No network calls, pairing, screen capture or UI control.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const cast=path.join(root,'tv-reliability-v0.5','cast');
function executable(bin,args){
  try{
    const p=cp.spawnSync(bin,args,{windowsHide:true,encoding:'utf8',timeout:2500,stdio:['ignore','pipe','pipe']});
    return !p.error&&p.status===0;
  }catch{return false}
}
function dependency(){
  try{return !!require.resolve('lgtv2',{paths:[cast]})}catch{return false}
}
const version=Number(process.versions.node.split('.')[0]);
const checks=[
  {name:'Windows',ready:process.platform==='win32',requiredFor:'TV and input control'},
  {name:'Node.js 24 or later',ready:version>=24,requiredFor:'source tests and local tools'},
  {name:'Pinned TV npm dependencies',ready:dependency(),requiredFor:'TV controller'},
  {name:'FFmpeg',ready:executable(process.env.PC_BRIDGE_FFMPEG_EXE||'ffmpeg',['-version']),requiredFor:'TV video'},
  {name:'Codex CLI',ready:executable(process.env.PC_BRIDGE_CODEX_EXE||'codex',['--version']),requiredFor:'optional Codex Desk'}
];
const output={
 product:'I’m-accessibility',
 mode:'read-only prerequisite check',
 checks,
 manualChecks:[
  'Separately installed and authorised PC Bridge application',
  'Owner-paired compatible LG TV on a trusted LAN',
  'Windows scheduled task and machine-specific TV configuration'
 ],
 note:'No application, television or Codex conversation was contacted or modified.'
};
if(process.argv.includes('--json'))console.log(JSON.stringify(output,null,2));
else{
  console.log('\nI’m-accessibility — prerequisite check\n');
  for(const c of checks)console.log((c.ready?'[ready]   ':'[missing] ') + c.name +' ('+c.requiredFor+')');
  console.log('\nManual setup still required:');
  for(const s of output.manualChecks)console.log('  - '+s);
  console.log('\n'+output.note);
  if(checks.some(c=>!c.ready))console.log('See docs/SETUP.md for configuration and troubleshooting.');
}
// Informational by design; it never starts or stops any services.
