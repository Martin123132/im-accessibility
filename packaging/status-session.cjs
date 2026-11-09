'use strict';
// Shared by both Windows GUIs. Saved state is context, never proof of live video.
// No writes, TV requests, recovery, process termination or network selection.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=fs.existsSync(path.join(__dirname,'tv-reliability-v0.5','release-config.cjs'))
 ?__dirname:path.resolve(__dirname,'..');
const config=require(path.join(root,'tv-reliability-v0.5','release-config.cjs'));
const runtime=path.join(root,'tv-reliability-v0.5','runtime');
function probe(ip,port){
 return new Promise((resolve,reject)=>{
  // Numeric validated LOCAL address only, no proxy, redirects or remote TV probe.
  const request=http.get({hostname:ip,localAddress:ip,port,path:'/health',agent:false},res=>{
   if(res.statusCode!==200){res.resume();request.destroy();reject(Error('Health HTTP '+res.statusCode));return}
   let data='';res.setEncoding('utf8');
   res.on('data',chunk=>{data+=chunk;if(data.length>8192)request.destroy(Error('Health response too large'))});
   res.on('error',reject);
   res.on('end',()=>{try{resolve(JSON.parse(data))}catch{reject(Error('Invalid health response'))}});
  });
  const timer=setTimeout(()=>request.destroy(Error('Health request timed out')),1500);
  request.on('close',()=>clearTimeout(timer));request.on('error',reject);
 });
}
async function status({fsApi=fs,stateFile=path.join(runtime,'state.json'),
 journalFile=path.join(root,'tv-reliability-v0.5','viewer','runtime','speaker-route.json'),
 readConfig=()=>config.readUserSettings(),probeFn=probe,
 pidAliveFn=pid=>{try{process.kill(pid,0);return true}catch(e){return e.code==='ESRCH'?false:null}}}={}){
 const audioPending=fsApi.existsSync(journalFile);
 const summary={state:'not-started',videoReady:false,receiverConfirmed:false,mouseEnabled:false,
  audioPending,message:'Choose Start TV to connect.'};
 if(!fsApi.existsSync(stateFile))return {...summary,...(audioPending?{state:'attention',message:'Laptop audio restoration is pending. Start and uninstall are blocked.'}:{})};
 let record;
 try{
  if(fsApi.statSync(stateFile).size>16384)throw Error('oversized');
  record=JSON.parse(fsApi.readFileSync(stateFile,'utf8'));
  if(!record||!/^[a-f0-9]{16}$/.test(record.runId)||typeof record.state!=='string')throw Error('identity');
 }catch{return {...summary,state:'attention',message:'Session record cannot be verified. No connection is claimed.'}}
 for(const key of ['runId','state','createdUtc','updatedUtc','stream','viewer','lg'])
  if(typeof record[key]==='string')summary[key]=record[key].slice(0,80);
 if(record.state==='stopped')return {...summary,message:audioPending?'Laptop audio restoration is pending.':
  /^Start failure:|unexpectedly/.test(record.stopReason||'')?'TV stopped after an error: '+String(record.stopReason).slice(0,230):'TV stopped. Laptop audio restoration completed.'};
 const alive=Number.isSafeInteger(record.supervisorPid)&&record.supervisorPid>0?pidAliveFn(record.supervisorPid):null;
 if(alive===false)return {...summary,state:'stale',message:'The previous TV host exited. Start can recover only after verifying the video ports and laptop audio.'};
 if(alive!==true)
  return {...summary,state:'attention',message:'TV supervisor is unavailable. The saved session is not live.'};
 if(record.state==='stopping')return {...summary,message:'Stopping TV and restoring laptop audio…'};
 let selected;
 try{selected=readConfig()}
 catch(e){return {...summary,state:'attention',message:'Check the saved network: '+String(e.message).slice(0,220)}}
 // A session bound to a superseded address needs an explicit Stop/Start.
 if(record.localIp!==selected.network.ip||record.adapterName!==selected.network.name||record.tvIp!==selected.television.ip)
  return {...summary,state:'attention',message:'The network or TV selection changed. Stop this session, then Start again on your selected network.'};
 const results=await Promise.allSettled([probeFn(selected.network.ip,43196),probeFn(selected.network.ip,43198)]);
 const cast=results[0].status==='fulfilled'?results[0].value:null;
 const viewer=results[1].status==='fulfilled'?results[1].value:null;
 if(!cast||!viewer)return {...summary,message:'Video or viewer service is not responding. If startup does not finish, Stop and retry.'};
 if(cast.runId!==record.runId||viewer.runId!==record.runId||cast.mode!=='LAN TV receiver'||viewer.service!=='interactive-tv')
  return {...summary,state:'attention',message:'The video ports belong to a different or unverified session. No connection is claimed.'};
 summary.videoReady=cast.ok===true&&cast.stream==='running'&&cast.streamReady===true&&viewer.ready===true&&viewer.sourceReady===true;
 summary.receiverConfirmed=summary.videoReady&&viewer.playback==='playing'&&record.lg==='opened';
 summary.playback=typeof viewer.playback==='string'?viewer.playback:'unconfirmed';
 summary.message=summary.receiverConfirmed?'Selected TV reports advancing video. Video and viewer services are healthy.':
  summary.videoReady?'Video services ready; selected TV playback '+summary.playback+'.':
  'Desktop video is not ready. Stop and retry if it does not recover.';
 if(record.lg==='pairing')summary.message='Approve the connection request on your selected LG TV using its remote.';
 if(record.lg==='needs-tv'||record.lg==='unavailable')summary.message='LG connection failed. Check that your selected TV is on and approve its pairing prompt, then Stop and retry.';
 if(cast.audioState==='failed')summary.message+=' TV audio is unavailable.';
 return summary;
}
if(require.main===module)status().then(r=>console.log(JSON.stringify(r))).catch(e=>{
 console.error('STATUS_ERROR '+String(e.message).slice(0,200));process.exitCode=1;
});
module.exports={status,probe};
