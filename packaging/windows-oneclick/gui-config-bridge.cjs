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
    // Read-only discovery before settings exist; never pairs or launches a television.
    let data='';
    for await(const part of process.stdin){data+=String(part);if(data.length>1024)throw Error('Discovery input too large')}
    const v=JSON.parse(data);
    if(!v||typeof v!=='object'||Array.isArray(v)||
       Object.keys(v).sort().join(',')!=='adapterName,localIp')
      throw Error('Select one current PC network before discovery');
    const finder=require('./TVFinder.cjs');
    return output(await finder.scan({durationMs:4200,adapter:v}));
  }
  if(command==='save'){
    let data='';
    for await(const part of process.stdin){
      data+=String(part);
      if(data.length>4096)throw Error('Setup input too large');
    }
    const v=JSON.parse(data);
    if(!v||typeof v!=='object'||Array.isArray(v)||
       Object.keys(v).sort().join(',')!=='adapterName,ffmpegExe,localIp,nodeExe,tvIp')
      throw Error('Invalid setup fields');
    if(v.nodeExe!==process.execPath||v.ffmpegExe!==ffmpeg)
      throw Error('Only the installed verified runtimes are permitted');
    const result=first.saveSettings(v);
    return output({saved:result.written,summary:result.summary});
  }
  if(command==='validate'){
    const v=first.validateInstalled();return output(v.summary);
  }
  if(command==='status'){
    return output(status.status());
  }
  if(command==='start'){
    const audio=process.env.IM_ACCESSIBILITY_TV_AUDIO;
    if(audio!=='0'&&audio!=='1')throw Error('Explicit audio setting required');
    return output(launch.main(['--start']));
  }
  if(command==='stop'){return output(stop.stop())}
  throw Error('Unsupported local GUI command');
}
main().catch(e=>{process.stderr.write('APP_ERROR '+String(e.message||e).slice(0,270)+'\n');process.exitCode=1});
