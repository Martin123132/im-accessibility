'use strict';
// Owner-run "Resume PC Bridge" and "Stop PC Bridge". Does not launch arbitrary code.
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const ROOT=__dirname,NAME='PCBridge TV Resume 0.5';
const NODE='C:\\Program Files\\nodejs\\node.exe',HOST=path.join(ROOT,'resume-host.cjs');
const STATE=path.join(ROOT,'runtime','state.json'),STOP=path.join(ROOT,'runtime','stop-request.json');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function read(file){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}}
async function service(port){
 try{
  const r=await fetch('http://192.168.4.36:'+port+'/health',{signal:AbortSignal.timeout(1300)});
  const j=await r.json();
  return r.ok&&j.build==='tv-resume-v0.5'?j:null;
 }catch{return null}
}
async function status(){
 const [video,viewer]=await Promise.all([service(43196),service(43198)]);
 const state=read(STATE);
 return {running:!!video&&!!viewer&&!!viewer.sourceReady&&video.stream==='running',video:video?.stream||'stopped',
  viewer:viewer?.ready?'ready':'stopped',session:state?.state||'not-started',
  expiresAt:state?.viewerExpiresAtUtc||null,lg:state?.lg||null,runId:state?.runId||null};
}
function exactTaskStart(){
 const script=[
  '$ErrorActionPreference="Stop";',
  '$n="PCBridge TV Resume 0.5";',
  '$t=Get-ScheduledTask -TaskName $n -ErrorAction Stop;',
  '$exe="C:\\Program Files\\nodejs\\node.exe";',
  "$arg='"+'"'+HOST.replace(/'/g,"''")+'"'+"';",
  'if(@($t.Actions).Count -ne 1 -or $t.Actions[0].Execute -ne $exe -or $t.Actions[0].Arguments -ne $arg){throw "Task identity mismatch"};',
  'if(@($t.Triggers|Where-Object{$null -ne $_}).Count -ne 0){throw "Task unexpectedly has autostart triggers"};',
  'Start-ScheduledTask -TaskName $n;',
  'Write-Output "ON_DEMAND_TASK_STARTED";'
 ].join(' ');
 const r=cp.spawnSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true,timeout:9000});
 if(r.status!==0||!r.stdout.includes('ON_DEMAND_TASK_STARTED'))throw Error('Cannot run exact PC Bridge on-demand task. '+String(r.stderr||r.error?.message).slice(-350));
}
async function resume(){
 const x=await status();
 if(x.running){
  console.log('PC Bridge TV is already running. Reopening the owner-approved LG receiver...');
  try{
   const {open}=require('./lg-pair.cjs'),y=await open();
   console.log(y.opened?'LG browser reopened successfully.':'TV not reachable yet; the PC video remains active. You can try Resume again.');
   return;
  }catch(e){console.log('The stream is running but TV reopening needs attention: '+String(e.message).slice(0,200));return}
 }
 if(x.video!=='stopped'||x.viewer!=='stopped'){
  throw Error('A partial TV session is still bound to a port. Refusing to overwrite it. Inspect the session status.');
 }
 console.log('Starting independent four-hour Windows desktop video and short-lease LG control...');
 exactTaskStart();
 for(let i=0;i<80;i++){
  await sleep(450);
  const result=await status();
  if(result.running){
   console.log('PC Bridge TV ready. Viewer expires '+result.expiresAt+'.');
   console.log('If the TV remains on its previous page, open Resume again or use the TV browser to refresh.');
   return;
  }
  if(result.session==='stopped'&&i>14&&result.runId!==x.runId)throw Error('Session exited early. See runtime host log; no unrelated process was stopped.');
 }
 throw Error('Resume was requested, but both receivers were not ready within 36 seconds. Review local session log.');
}
async function stop(){
 const x=await status();
 if(!x.running){console.log('PC Bridge TV is not running; nothing to stop.');return;}
 if(fs.existsSync(STOP)){console.log('Stop already requested.');return}
 fs.writeFileSync(STOP,JSON.stringify({reason:'owner-desktop-stop',requestedAtUtc:new Date().toISOString()})+'\n',{flag:'wx'});
 console.log('Stop requested. The owner session will close both video and pointer services.');
}
async function run(){
 const cmd=process.argv[2]||'resume';
 if(cmd==='status'){console.log(JSON.stringify(await status(),null,2));return}
 if(cmd==='resume'){await resume();return}
 if(cmd==='stop'){await stop();return}
 throw Error('Use only resume, status or stop');
}
if(require.main===module)run().catch(e=>{console.error('PC_BRIDGE_RESUME_ERROR '+String(e.message||e));process.exitCode=1});
module.exports={status,resume,stop};
