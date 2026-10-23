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
function checkState({fsApi=fs,statePath=stateFile,stopPath=stopFile}={}){
 if(fsApi.existsSync(stopPath))fail('A previous Stop request remains pending. Inspect status before restarting.');
 if(!fsApi.existsSync(statePath))return;
 let state;
 try{state=JSON.parse(fsApi.readFileSync(statePath,'utf8'))}
 catch{fail('Cannot read old session record')}
 if(typeof state!=='object'||state===null||!/^[a-f0-9]{16}$/.test(state.runId||''))
  fail('Invalid session identity; owner inspection required');
 if(state.state!=='stopped')fail('An existing or uncertain TV session has not been closed');
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
 checkState({fsApi,statePath,stopPath});
 return Object.freeze({config:selected,settingsFile:file,hostFile:hostPath});
}
function launch({spawnFn=cp.spawn,preflightFn=preflight}={}){
 const valid=preflightFn();
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
module.exports={checkState,preflight,launch,main};
