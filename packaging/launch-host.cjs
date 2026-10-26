'use strict';
// Starts ONLY the installed owner's TV supervisor, after explicit validated config.
// Import, --check, and --help never spawn anything or contact the TV.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const firstRun=require('./first-run.cjs');
const root=fs.existsSync(path.join(__dirname,'tv-reliability-v0.5','release-config.cjs'))
 ?__dirname:path.resolve(__dirname,'..');
const tvRoot=path.join(root,'tv-reliability-v0.5');
const hostFile=path.join(tvRoot,'resume-host.cjs');
const stateFile=path.join(tvRoot,'runtime','state.json');
const stopFile=path.join(tvRoot,'runtime','stop-request.json');
const config=require(path.join(tvRoot,'release-config.cjs'));

function fail(reason){throw Error('TV_START_REFUSED: '+reason);}
function pidAlive(pid){
 if(!Number.isSafeInteger(pid)||pid<=0)return null;
 try{process.kill(pid,0);return true}catch(e){return e.code==='ESRCH'?false:null}
}
function checkState({fsApi=fs,statePath=stateFile,stopPath=stopFile,pidAliveFn=pidAlive}={}){
 if(fsApi.existsSync(stopPath))fail('A previous Stop request remains pending. Inspect status before restarting.');
 if(!fsApi.existsSync(statePath))return {stale:false};
 let state;
 try{state=JSON.parse(fsApi.readFileSync(statePath,'utf8'))}
 catch{fail('Cannot read old session record')}
 if(typeof state!=='object'||state===null||!/^[a-f0-9]{16}$/.test(state.runId||''))
  fail('Invalid session identity; owner inspection required');
 if(state.state!=='stopped'){
  // Only a known exited, exact owner supervisor PID qualifies as stale.
  // Older or tampered records without a verified PID remain fail-closed.
  if(Number.isSafeInteger(state.supervisorPid)&&state.supervisorPid>0&&
     pidAliveFn(state.supervisorPid)===false)return {stale:true};
  fail('An existing or uncertain TV session has not been closed');
 }
 return {stale:false};
}
function preflight({env=process.env,networkInterfaces=os.networkInterfaces(),
 fsApi=fs,hostPath=hostFile,statePath=stateFile,stopPath=stopFile}={}){
 const {file}=firstRun.settingsFile(env);
 const selected=config.readUserSettings({
  env:{LOCALAPPDATA:env.LOCALAPPDATA,IM_ACCESSIBILITY_CONFIG_PATH:file},
  fsApi,networkInterfaces,repoRoot:root,platform:process.platform
 });
 if(!selected.television.ip)fail('No owner-selected LG TV IP. Run Setup.cmd and specify its address.');
 if(!fsApi.existsSync(hostPath)||!fsApi.statSync(hostPath).isFile())fail('Installed TV host is missing');
 const previous=checkState({fsApi,statePath,stopPath});
 return Object.freeze({config:selected,settingsFile:file,hostFile:hostPath,
  stale:previous.stale===true});
}
function recoverStaleAudio({runNativeFn=cp.spawnSync}={}){
 // A dead owner supervisor does not prove its video descendants stopped.
 // Verify BOTH private service ports are unoccupied before restoring a speaker.
 const ports=runNativeFn('netstat.exe',['-ano','-p','TCP'],{
  encoding:'utf8',windowsHide:true,timeout:4500,maxBuffer:3*1024*1024});
 if(ports.error||ports.status!==0||typeof ports.stdout!=='string')
  fail('Cannot verify TV ports; refusing recovery');
 for(const row of ports.stdout.split(/\r?\n/)){
  if(/\bLISTENING\b/i.test(row)&&/:(?:43196|43198)\s/.test(row))
   fail('A TV video service still owns a private port; no recovery or duplicate session');
 }
 const {SpeakerRouter}=require(path.join(tvRoot,'viewer','speaker-routing.cjs'));
 const restored=new SpeakerRouter().recover();
 if(!restored.recovered)fail('Original Windows audio requires inspection: '+restored.reason);
 return restored;
}
function launch({spawnFn=cp.spawn,preflightFn=preflight,recoverFn=recoverStaleAudio}={}){
 const valid=preflightFn();
 if(valid.stale===true)recoverFn();
 const child=spawnFn(valid.config.executables.nodeExe,[valid.hostFile],{
  cwd:path.dirname(valid.hostFile),
  windowsHide:true,
  detached:true,
  stdio:'ignore',
  env:{...process.env,IM_ACCESSIBILITY_CONFIG_PATH:valid.settingsFile}
 });
 if(!child||!Number.isInteger(child.pid)||child.pid<1)fail('Windows did not create the TV supervisor');
 if(typeof child.unref==='function')child.unref();
 return {requested:true,pid:child.pid,note:'Startup requested; check Status.cmd. Mouse remains off until owner enables it.'};
}
function main(args=process.argv.slice(2)){
 if(args.length!==1||!['--check','--start'].includes(args[0]))fail('Use --check or --start');
 if(args[0]==='--check'){
  const valid=preflight();
  return {ready:true,adapter:valid.config.network.name,
   tvModel:valid.config.television.model,selectedTv:true,
   note:'Read-only check. No TV was contacted and nothing started.'};
 }
 return launch();
}
if(require.main===module){
 try{console.log(JSON.stringify(main(),null,2));}
 catch(e){console.error(String(e.message||e).slice(0,300));process.exitCode=1}
}
module.exports={checkState,preflight,launch,main,pidAlive,recoverStaleAudio};
