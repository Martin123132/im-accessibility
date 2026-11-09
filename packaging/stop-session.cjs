'use strict';
// Emergency Stop is independent of network/device configuration and never kills other processes.
const fs=require('node:fs'),path=require('node:path');
const ROOT=fs.existsSync(path.join(__dirname,'tv-reliability-v0.5','release-config.cjs'))?__dirname:path.resolve(__dirname,'..');
const runtime=path.join(ROOT,'tv-reliability-v0.5','runtime');
const state=path.join(runtime,'state.json');
const signal=path.join(runtime,'stop-request.json');
function stop({fsApi=fs,statePath=state,signalPath=signal,
 journalPath=path.join(ROOT,'tv-reliability-v0.5','viewer','runtime','speaker-route.json'),
 recoverFn=()=>require('./launch-host.cjs').recoverStaleAudio()}={}){
 const fs=fsApi,state=statePath,signal=signalPath;
 if(!fs.existsSync(state))return {requested:false,reason:'No owned TV session state'};
 let current;try{current=JSON.parse(fs.readFileSync(state,'utf8'))}catch{throw Error('Invalid session metadata; inspect manually')}
 if(!/^[a-f0-9]{16}$/.test(current?.runId||''))throw Error('Invalid owner TV session ID');
 if(current.state==='stopped'){
  if(fs.existsSync(journalPath)){recoverFn();return {requested:false,reason:'Laptop audio restored after checking TV ports'};}
  return {requested:false,reason:'Session already stopped'};
 }
 if(fs.existsSync(signal)){
  const previous=JSON.parse(fs.readFileSync(signal,'utf8'));
  if(previous.runId!==current.runId)throw Error('A different session Stop request requires inspection');
  return {requested:true,reason:'Stop already requested'};
 }
 fs.writeFileSync(signal,JSON.stringify({runId:current.runId,reason:'owner-emergency-stop',requestedAtUtc:new Date().toISOString()})+'\n',
   {flag:'wx',mode:0o600});
 return {requested:true,reason:'Stop signal written; owner session supervisor will shut down its children'};
}
if(require.main===module){
 try{const r=stop();console.log(JSON.stringify(r));}
 catch(e){console.error('STOP_REQUIRES_ATTENTION '+String(e.message).slice(0,180));process.exitCode=1}
}
module.exports={stop};
