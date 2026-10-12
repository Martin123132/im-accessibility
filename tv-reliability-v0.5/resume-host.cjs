'use strict';
// Four-hour on-demand session supervisor for the owner's PC and LG television.
// This owns ONLY its own cast/viewer children. It does not stop other PC Bridge services.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=__dirname,RUNTIME=path.join(ROOT,'runtime'),CAST=path.join(ROOT,'cast'),VIEWER=path.join(ROOT,'viewer');
const NODE='C:/Program Files/nodejs/node.exe',LAN='192.168.4.36',MAX_MS=4*60*60*1000;
const STATE=path.join(RUNTIME,'state.json'),STOP=path.join(RUNTIME,'stop-request.json');
const RUN=crypto.randomBytes(8).toString('hex'),START=Date.now();
const logPath=path.join(RUNTIME,'host-'+RUN+'.log');
const childProcs=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
let status={runId:RUN,state:'starting',createdUtc:new Date(START).toISOString(),expectedEndUtc:new Date(START+MAX_MS).toISOString(),
 stream:'starting',viewer:'waiting',lg:'not-attempted',mouseLeaseMinutes:10,videoSessionHours:4},stopping=false,reason='';
fs.mkdirSync(RUNTIME,{recursive:true});
function log(msg){
 const row=new Date().toISOString()+' '+String(msg).slice(0,800);
 fs.appendFileSync(logPath,row+'\n');
}
function atomic(file,obj){
 const next=file+'.'+process.pid+'.tmp';fs.writeFileSync(next,JSON.stringify(obj,null,2)+'\n');
 fs.renameSync(next,file);
}
function update(patch){
 status={...status,...patch,updatedUtc:new Date().toISOString()};
 atomic(STATE,status);
}
function archiveIfExists(file){
 if(!fs.existsSync(file))return;
 const d=path.join(path.dirname(file),'archive');fs.mkdirSync(d,{recursive:true});
 const out=path.join(d,path.basename(file)+'.retired-'+RUN);
 fs.renameSync(file,out);
 log('Archived stale private session metadata: '+path.relative(ROOT,out));
}
async function reachable(port){
 try{
  const r=await fetch('http://'+LAN+':'+port+'/health',{signal:AbortSignal.timeout(1000)});
  return r.status===200;
 }catch{return false;}
}
function spawnService(dir,name){
 const file=path.join(dir,'server.cjs'),stream=path.join(RUNTIME,name+'-'+RUN+'.log'),fd=fs.openSync(stream,'a');
 let child;
 try{child=cp.spawn(NODE,[file],{cwd:dir,windowsHide:true,stdio:['ignore',fd,fd],env:process.env})}
 finally{fs.closeSync(fd)}
 if(!child.pid)throw Error('Could not launch '+name);
 childProcs.push({child,name});
 child.on('error',e=>log(name+' child error: '+String(e.message).slice(0,170)));
 child.on('exit',(code,signal)=>log(name+' child exited '+String(code)+'/'+String(signal)));
 log('Spawned '+name+' PID '+child.pid);
 return child;
}
async function waitFile(file,child,limitMs=11000){
 const deadline=Date.now()+limitMs;
 while(Date.now()<deadline){
  if(fs.existsSync(file)){
   const obj=JSON.parse(fs.readFileSync(file,'utf8'));
   if(obj.expiresAt&&Date.parse(obj.expiresAt)>Date.now()+60*60*1000)return obj;
  }
  if(child.exitCode!==null)throw Error('Child exited before generating '+path.basename(file));
  await delay(220);
 }
 throw Error('Timed out waiting for '+path.basename(file));
}
async function awaitActiveState(u,headers,limitMs=14000){
 const deadline=Date.now()+limitMs;
 while(Date.now()<deadline){
  try{
   const r=await fetch(u,{headers,signal:AbortSignal.timeout(2000)});
   if(r.ok){
    const j=await r.json();
    if(j.streamReady)return j;
   }
  }catch{}
  await delay(400);
 }
 throw Error('Video stream did not become ready within '+limitMs+'ms');
}
async function launch(){
 if(!fs.existsSync(NODE))throw Error('Pinned Node runtime unavailable');
 if(await reachable(43196)||await reachable(43198))throw Error('An older or unrelated TV service already occupies ports 43196 or 43198. Do not terminate it automatically.');
 if(fs.existsSync(STOP))archiveIfExists(STOP);
 archiveIfExists(path.join(CAST,'runtime','private-access.json'));
 archiveIfExists(path.join(VIEWER,'runtime','session.json'));
 update({state:'starting-video'});
 const cast=spawnService(CAST,'cast');
 const info=await waitFile(path.join(CAST,'runtime','private-access.json'),cast);
 const url=new URL(info.controllerUrl),token=url.hash.slice(5);
 if(url.origin!=='http://'+LAN+':43196'||!/^[a-f0-9]{48}$/.test(token))throw Error('Video controller credentials malformed');
 const headers={Authorization:'Bearer '+token,Origin:url.origin,'Content-Type':'application/json'};
 const start=await fetch(url.origin+'/api/start',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(3500)});
 if(!start.ok)throw Error('Starting Windows capture failed HTTP '+start.status);
 await awaitActiveState(url.origin+'/api/status',{Authorization:'Bearer '+token});
 update({state:'starting-viewer',stream:'ready',sourceExpiresAtUtc:info.expiresAt});
 const viewer=spawnService(VIEWER,'viewer');
 const s=await waitFile(path.join(VIEWER,'runtime','session.json'),viewer);
 const viewUrl=new URL(s.url),secret=viewUrl.pathname.split('/')[2];
 if(viewUrl.origin!=='http://'+LAN+':43198'||!/^\/tv\/[a-f0-9]{64}$/.test(viewUrl.pathname))throw Error('Viewer credentials malformed');
 let viewerReady=false;
 for(let i=0;i<24;i++){
  try{
   const response=await fetch(viewUrl.origin+'/api/status',{headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(2500)});
   if(response.ok&&(await response.json()).sourceReady){viewerReady=true;break}
  }catch{}
  await delay(200);
 }
 if(!viewerReady)throw Error('Viewer did not connect to desktop video');
 update({state:'ready',viewer:'ready',viewerExpiresAtUtc:s.expiresAt});
 log('Four-hour private video and mouse receiver ready');
 try{
  const {open}=require('./lg-pair.cjs');
  const pair=await open({onEvent:e=>log('LG '+e.stage+' '+(e.ip||''))});
  update({lg:pair.opened?'opened':'needs-tv',lgIp:pair.opened?pair.host:null});
  log(pair.opened?'LG browser requested to open':'LG not available; session remains live for manual connection');
 }catch(e){update({lg:'unavailable'});log('LG launch unavailable: '+String(e.message||e).slice(0,200))}
}
async function killChild({child,name}){
 if(!child||!child.pid)return;
 if(child.exitCode!==null)return;
 try{child.kill('SIGTERM')}catch{}
 const until=Date.now()+2500;
 while(Date.now()<until&&child.exitCode===null)await delay(150);
 if(child.exitCode!==null)return;
 if(child.pid===process.pid)return;
 try{
  const r=cp.spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,encoding:'utf8',timeout:3500});
  log(name+' forced task-tree exit code '+r.status);
 }catch(e){log(name+' task-tree cleanup error '+String(e.message).slice(0,100))}
}
async function cleanup(why){
 if(stopping)return;stopping=true;
 log('Closing only owner session: '+why);
 update({state:'stopping',stopReason:why,lg:'closed'});
 for(const child of childProcs.slice().reverse())await killChild(child);
 try{fs.unlinkSync(path.join(VIEWER,'runtime','session.json'))}catch{}
 try{fs.unlinkSync(path.join(CAST,'runtime','private-access.json'))}catch{}
 try{fs.unlinkSync(STOP)}catch{}
 update({state:'stopped',closedAtUtc:new Date().toISOString(),stopReason:why,viewer:'stopped',stream:'stopped'});
}
process.once('SIGTERM',()=>{reason='Windows task stop';});
process.once('SIGINT',()=>{reason='Owner interrupted launcher';});
async function main(){
 log('Starting owner four-hour session '+RUN);
 try{
  await launch();
  while(!reason&&Date.now()<START+MAX_MS){
   if(fs.existsSync(STOP)){reason='Owner selected End TV session';break;}
   const exited=childProcs.find(x=>x.child.exitCode!==null);
   if(exited){reason=exited.name+' exited unexpectedly';break;}
   await delay(800);
  }
  if(!reason)reason='Four-hour session expired normally';
 }catch(e){reason='Start failure: '+String(e.message||e).slice(0,200);log(reason)}
 finally{await cleanup(reason)}
}
if(require.main===module)main().catch(e=>{log('Fatal host error '+e.message);process.exitCode=1});
module.exports={MAX_MS,archiveIfExists,reachable};
