'use strict';
// Narrow, local-only bridge between the Windows GUI and the existing validated
// first-run/session controllers. No credential output or arbitrary commands.
const fs=require('node:fs');
const path=require('node:path');
const first=require('./first-run.cjs');
const launch=require('./launch-host.cjs');
const stop=require('./stop-session.cjs');
const status=require('./status-session.cjs');
const command=process.argv[2]||'';
const ffmpeg=path.join(__dirname,'Runtime','ffmpeg.exe');
function output(obj){process.stdout.write(JSON.stringify(obj)+'\n')}
async function main(){
  if(command==='doctor'){
    return output(first.doctor({nodeExe:process.execPath,ffmpegExe:ffmpeg}));
  }
  if(command==='discover'){
    // Read-only discovery, also after reinstall; never pairs or launches a television.
    let data='';
    for await(const part of process.stdin){data+=String(part);if(data.length>1024)throw Error('Discovery input too large')}
    const v=JSON.parse(data);
    if(!v||typeof v!=='object'||Array.isArray(v)||
       Object.keys(v).sort().join(',')!=='adapterName,localIp')
      throw Error('Select one current PC network before discovery');
    const finder=require('./discover-setup.cjs');
    return output(await finder.scan(v,{durationMs:4200}));
  }
  if(command==='save'){
    let data='';
    for await(const part of process.stdin){
      data+=String(part);
      if(data.length>4096)throw Error('Setup input too large');
    }
    const v=JSON.parse(data);
    if(!v||typeof v!=='object'||Array.isArray(v)||
       !['adapterName,ffmpegExe,localIp,nodeExe,tvIp',
         'adapterName,ffmpegExe,localIp,nodeExe,previousHash,tvIp'].includes(Object.keys(v).sort().join(',')))
      throw Error('Invalid setup fields');
    if(v.nodeExe!==process.execPath||v.ffmpegExe!==ffmpeg)
      throw Error('Only the installed verified runtimes are permitted');
    if(Object.hasOwn(v,'previousHash')&&(typeof v.previousHash!=='string'||!/^[a-f0-9]{64}$/.test(v.previousHash)))throw Error('Invalid prior settings confirmation');
    const current=await status.status();
    if(!['not-started','stopped'].includes(current.state)||current.audioPending!==false)
      throw Error('Stop the TV stream and finish laptop audio restoration before saving a TV selection.');
    // Also protects another installation using the same local streaming ports.
    require('./tv-reliability-v0.5/session-guard.cjs').assertPortsAvailable();
    const result=first.saveSettings(v,{expectedHash:v.previousHash??null});
    return output({saved:result.written,unchanged:result.unchanged===true,backup:result.backup||null,summary:result.summary});
  }
  if(command==='validate'){
    const v=first.validateInstalled();return output(v.summary);
  }
  if(command==='status'){
    return output(await status.status());
  }
  if(command==='start'){
    const audio=process.env.IM_ACCESSIBILITY_TV_AUDIO;
    if(audio!=='0'&&audio!=='1')throw Error('Explicit audio setting required');
    return output(await launch.main(['--start']));
  }
  if(command==='prepare-audio'){
    // Only reached after the GUI explicitly explains and confirms registration.
    const cp=require('node:child_process');
    const script=path.join(__dirname,'audio-guard-task.ps1');
    const powershell=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
    const r=cp.spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Action','Enable','-OwnerConsent','YES'],
      {encoding:'utf8',windowsHide:true,timeout:12000,maxBuffer:8192});
    if(r.error||r.status!==0)throw Error('Audio safety setup failed; no stream started. '+String(r.stderr||r.error?.message||'Unknown failure').slice(0,180));
    return output({ready:true,note:'Audio restoration enabled on demand; no automatic triggers.'});
  }
  if(command==='stop'){return output(stop.stop())}
  throw Error('Unsupported local GUI command');
}
main().catch(e=>{process.stderr.write('APP_ERROR '+String(e.message||e).slice(0,270)+'\n');process.exitCode=1});
