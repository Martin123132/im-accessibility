'use strict';
// Emergency Stop is independent of network/device configuration and never kills other processes.
const fs=require('node:fs'),path=require('node:path');
const ROOT=__dirname;
const runtime=path.join(ROOT,'tv-reliability-v0.5','runtime');
const state=path.join(runtime,'state.json');
const signal=path.join(runtime,'stop-request.json');
function stop(){
 if(!fs.existsSync(state))return {requested:false,reason:'No owned TV session state'};
 let current;try{current=JSON.parse(fs.readFileSync(state,'utf8'))}catch{throw Error('Invalid session metadata; inspect manually')}
 if(!/^[a-f0-9]{16}$/.test(current?.runId||''))throw Error('Invalid owner TV session ID');
 if(current.state==='stopped')return {requested:false,reason:'Session already stopped'};
 if(fs.existsSync(signal))return {requested:true,reason:'Stop already requested'};
 fs.writeFileSync(signal,JSON.stringify({reason:'owner-emergency-stop',requestedAtUtc:new Date().toISOString()})+'\n',
   {flag:'wx',mode:0o600});
 return {requested:true,reason:'Stop signal written; owner session supervisor will shut down its children'};
}
if(require.main===module){
 try{const r=stop();console.log(JSON.stringify(r));}
 catch(e){console.error('STOP_REQUIRES_ATTENTION '+String(e.message).slice(0,180));process.exitCode=1}
}
module.exports={stop};
