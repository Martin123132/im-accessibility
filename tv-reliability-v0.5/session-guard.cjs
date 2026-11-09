'use strict';
const os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),crypto=require('node:crypto');
function assertPortsAvailable({runNativeFn=cp.spawnSync}={}){
 const r=runNativeFn('netstat.exe',['-ano'],{encoding:'utf8',windowsHide:true,timeout:4500,maxBuffer:3*1024*1024});
 if(r.error||r.status!==0||typeof r.stdout!=='string')throw Error('Cannot verify TV ports; refusing startup');
 for(const line of r.stdout.split(/\r?\n/)){
  const fields=line.trim().split(/\s+/);
  if(fields[0]!=='TCP')continue;
  if(fields.length!==5)throw Error('Cannot verify TV port ownership');
  if(fields[3]==='LISTENING'&&/:(43196|43198)$/.test(fields[1]))throw Error('A TV video service still owns a private port; no recovery or duplicate session');
 }
}
function acquireLock(runtime){
 // A kernel-owned local pipe releases on process death. No stale disk lock can
 // strand an ordinary user after a crash. This socket accepts no commands.
 const id=crypto.createHash('sha256').update(path.resolve(runtime).toLowerCase()).digest('hex').slice(0,24);
 const address=process.platform==='win32'?'\\\\.\\pipe\\ImAccessibility-TV-'+id:path.join(os.tmpdir(),'imaccess-'+id+'.sock');
 return new Promise((resolve,reject)=>{
  const server=net.createServer(socket=>socket.destroy());
  server.once('error',()=>reject(Error('Another TV start is active or the local session lock is unavailable. No session files changed.')));
  server.listen(address,()=>resolve(()=>new Promise(done=>server.close(done))));
 });
}
module.exports={assertPortsAvailable,acquireLock};
