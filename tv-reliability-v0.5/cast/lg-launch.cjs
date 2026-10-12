'use strict';
const fs=require('node:fs'),path=require('node:path'),LGTV=require('lgtv2');
const {isRemoteLan,LAN_IP,PORT}=require('./lan.cjs');
const KEY_DIR=path.join(__dirname,'runtime','pairing');fs.mkdirSync(KEY_DIR,{recursive:true});
const KEY_PREFIX=path.join(KEY_DIR,'webos-client-key-');
const SAFE_TARGET='http://'+LAN_IP+':'+PORT+'/tv/';
function isAllowedTarget(url){
 try{
  const u=new URL(url);
  return u.protocol==='http:'&&u.origin==='http://'+LAN_IP+':'+PORT&&
     u.pathname.startsWith('/tv/')&&/^\/tv\/[a-f0-9]{48}$/.test(u.pathname)&&!u.search&&!u.hash;
 }catch{return false}
}
async function launchTv(host,url,onEvent=()=>{}){
 if(!isRemoteLan(host))throw Error('TV IP must be a different device on this same private LAN');
 if(!isAllowedTarget(url))throw Error('Only this PC Bridge receiver URL is allowed');
 return await new Promise((resolve,reject)=>{
  let done=false,tv;
  const timeout=setTimeout(()=>finish(Error('No LG connection within 25 seconds; check TV power, LG Connect Apps and pairing prompt')),25000);
  function finish(err,data){
   if(done)return;done=true;clearTimeout(timeout);
   try{const p=tv?.disconnect();if(p?.catch)p.catch(()=>{});}catch{}
   if(err)reject(err);else resolve(data);
  }
  try{
   tv=new LGTV({host,timeout:12000,reconnect:0,handshakeTimeout:5000,keyFile:KEY_PREFIX,rejectUnauthorized:false});
   tv.on('prompt',()=>onEvent({state:'tv-approval-required',message:'Accept the LG Connect Apps request using the TV remote'}));
   tv.on('error',err=>finish(Error('LG connection failed: '+String(err?.message||err).slice(0,120))));
   tv.on('connect',async()=>{
    try{
     onEvent({state:'launching',message:'LG pairing accepted. Opening PC Bridge on the TV browser.'});
     const response=await tv.request('ssap://system.launcher/open',{target:url});
     if(response?.returnValue===false)throw Error('LG launcher rejected the URL');
     finish(null,{ok:true,address:host,message:'Requested the LG web browser to open the PC Bridge receiver',appId:response?.id||null});
    }catch(e){finish(Error('LG browser launch failed: '+String(e.message||e).slice(0,150)))}
   });
  }catch(e){finish(Error('LG connector unavailable: '+String(e.message||e).slice(0,140)))}
 });
}
module.exports={launchTv,isAllowedTarget,KEY_PREFIX};
