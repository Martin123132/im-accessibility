'use strict';
// Pair only with the owner's explicitly identified LG CX. Never discover/launch other apps.
const fs=require('node:fs'),path=require('node:path');
const LGTV=require('./cast/node_modules/lgtv2');
const {discover}=require('./cast/tv-discovery.cjs');
const ROOT=__dirname,MODEL='OLED55CX6LA',LAN='192.168.4.36',PORT=43198;
const keyFile=path.join(ROOT,'viewer','runtime','lg-client-key');
const savedIP=path.join(ROOT,'runtime','last-verified-lg.json');
const SESSION=path.join(ROOT,'viewer','runtime','session.json');

function privateReceiver(){
 const s=JSON.parse(fs.readFileSync(SESSION,'utf8')),u=new URL(s.url);
 if(u.origin!=='http://'+LAN+':'+PORT||!/^\/tv\/[a-f0-9]{64}$/.test(u.pathname)||u.search||u.hash||
    Date.now()>=Date.parse(s.expiresAt))throw Error('Local TV viewing session unavailable/expired');
 return{url:s.url,expiresAt:s.expiresAt};
}
function localCandidate(ip){return /^192\.168\.(?:4|5|6|7)\.\d{1,3}$/.test(ip)&&ip!=='192.168.4.36';}
async function candidates(){
 const ips=[];
 const add=ip=>{if(localCandidate(ip)&&!ips.includes(ip))ips.push(ip)};
 try{if(fs.existsSync(savedIP)){const s=JSON.parse(fs.readFileSync(savedIP,'utf8'));if(s.model===MODEL)add(s.ip)}}catch{}
 add('192.168.4.27');add('192.168.4.39');
 try{const found=await discover({durationMs:2000});for(const x of found)if(x.type==='lg')add(x.address)}catch{}
 return ips.slice(0,6);
}
function connectOne(host,target,timeoutMs=20000){
 return new Promise((resolve,reject)=>{
  let tv,finished=false;const timer=setTimeout(()=>finish(Error('LG response timed out')),timeoutMs);
  function finish(err,value){
   if(finished)return;finished=true;clearTimeout(timer);
   try{if(tv)tv.disconnect()}catch{}
   if(err)reject(err);else resolve(value);
  }
  try{
   tv=new LGTV({host,reconnect:0,timeout:6500,handshakeTimeout:6000,
    keyFile,rejectUnauthorized:false});
   tv.on('prompt',()=>{ /* First-time TV pairing requires owner approval using the actual TV remote. */ });
   tv.on('error',e=>finish(e));
   tv.on('connect',async()=>{
    try{
     const info=await tv.request('ssap://system/getSystemInfo',{});
     if(info?.modelName!==MODEL)throw Error('Device is not approved LG model');
     const response=await tv.request('ssap://system.launcher/open',{target});
     if(response?.returnValue===false)throw Error('LG rejected the receiver open action');
     finish(null,{host,model:MODEL,opened:true});
    }catch(e){finish(e)}
   });
  }catch(e){finish(e)}
 });
}
async function open({onEvent=()=>{},hosts}={}){
 const session=privateReceiver();
 // First standalone session can pair directly with the LG after the owner approves its TV prompt.
 const ids=hosts||await candidates(),errors=[];
 for(const host of ids){
  if(!localCandidate(host))continue;
  try{
   onEvent({stage:'connecting',ip:host});
   const result=await connectOne(host,session.url);
   const receipt={model:MODEL,ip:host,verifiedAtUtc:new Date().toISOString()};
   fs.writeFileSync(savedIP,JSON.stringify(receipt,null,2)+'\n');
   onEvent({stage:'opened',ip:host});
   return{...result,expiresAt:session.expiresAt};
  }catch(e){
   errors.push({host,reason:String(e.message||e).slice(0,100)});
  }
 }
 return{opened:false,model:MODEL,attempted:ids.length,errors};
}
if(require.main===module){
 open().then(r=>{console.log(JSON.stringify(r));if(!r.opened)process.exitCode=2})
 .catch(e=>{console.error('LG_OPEN_FAILED '+String(e.message||e));process.exitCode=1});
}
module.exports={open,privateReceiver,candidates,connectOne,MODEL};
