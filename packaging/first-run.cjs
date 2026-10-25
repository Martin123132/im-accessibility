'use strict';
// First-run setup. Configuration is local, explicit and owner-confirmed.
// Importing this module never connects to the TV, starts Windows services or writes files.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const readline=require('node:readline/promises');
const releaseRoot=fs.existsSync(path.join(__dirname,'tv-reliability-v0.5','release-config.cjs'))
 ?__dirname:path.resolve(__dirname,'..');
const config=require(path.join(releaseRoot,'tv-reliability-v0.5','release-config.cjs'));
const core=require('./package-core.cjs');

const LOCAL_FOLDER='ImAccessibility';
function fail(message){throw Error('IMACCESS_SETUP: '+message);}
function fixture({networkInterfaces=os.networkInterfaces(),nodeExe=process.execPath,ffmpegExe=process.env.PC_BRIDGE_FFMPEG_EXE||''}={}){
 const found=config.adapters(networkInterfaces).sort((a,b)=>
   a.name.localeCompare(b.name)||a.ip.localeCompare(b.ip));
 return {adapters:found,nodeExe,ffmpegExe};
}
function buildCandidate({adapterName,localIp,tvIp,nodeExe,ffmpegExe},options={}){
 const values={schema:1,network:{adapterName,localIp},
  television:{model:config.SUPPORTED_MODEL,ip:tvIp||null},
  executables:{nodeExe,ffmpegExe}};
 const selected=config.validate(values,options);
 return {values,selected};
}
function settingsFile(env=process.env){
 // Only a user-profile settings path, not an attacker-selected environment override.
 const local=core.userRoot({LOCALAPPDATA:env.LOCALAPPDATA});
 const folder=path.join(local,LOCAL_FOLDER);
 const file=path.join(folder,'settings.json');
 const authorized=config.configPath({
  env:{LOCALAPPDATA:env.LOCALAPPDATA},platform:process.platform,repoRoot:releaseRoot
 });
 if(path.win32.normalize(file).toLowerCase()!==path.win32.normalize(authorized).toLowerCase())
  fail('Settings path is outside the expected per-user folder');
 return {local,folder,file};
}
function safeFolder(folder){
 if(fs.existsSync(folder)){
  const stat=fs.lstatSync(folder);
  if(stat.isSymbolicLink()||!stat.isDirectory())fail('Refusing a linked or non-directory settings folder');
  return false;
 }
 fs.mkdirSync(folder,{recursive:false});
 return true;
}
function saveSettings(candidate,{env=process.env,networkInterfaces=os.networkInterfaces(),
 existsFile=f=>{try{return fs.statSync(f).isFile()}catch{return false}}}={}){
 // Validating BEFORE writing prevents malformed settings and accidental extra keys.
 const {values,selected}=buildCandidate(candidate,{networkInterfaces,existsFile});
 const {folder,file}=settingsFile(env);
 if(fs.existsSync(file))fail('Settings already exist. No overwrite; back up and remove them manually before reconfiguring.');
 safeFolder(folder);
 const bytes=Buffer.from(JSON.stringify(values,null,2)+'\n');
 if(bytes.length>config.MAX_BYTES)fail('Settings too large');
 const temp=path.join(folder,'.settings-'+process.pid+'-'+crypto.randomBytes(6).toString('hex')+'.tmp');
 try{
  fs.writeFileSync(temp,bytes,{flag:'wx',mode:0o600});
  // Exclusive copy prevents a race from overwriting another owner process.
  fs.copyFileSync(temp,file,fs.constants.COPYFILE_EXCL);
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}
 return {written:true,file,summary:config.safeSummary(selected)};
}
function validateInstalled({env=process.env,networkInterfaces=os.networkInterfaces(),
 existsFile=f=>{try{return fs.statSync(f).isFile()}catch{return false}}}={}){
 const {file}=settingsFile(env);
 if(!fs.existsSync(file))fail('Settings not configured; run Setup.cmd first');
 const content=fs.readFileSync(file);
 if(content.length<2||content.length>config.MAX_BYTES)fail('Invalid settings size');
 let parsed;
 try{parsed=JSON.parse(content.toString('utf8'))}catch{fail('Settings JSON is invalid')}
 return {file,summary:config.safeSummary(config.validate(parsed,{networkInterfaces,existsFile}))};
}
function doctor({networkInterfaces=os.networkInterfaces(),nodeExe=process.execPath,
 ffmpegExe=process.env.PC_BRIDGE_FFMPEG_EXE||''}={}){
 const state=fixture({networkInterfaces,nodeExe,ffmpegExe});
 const exists=p=>{try{return fs.statSync(p).isFile()}catch{return false}};
 return {mode:'read-only',product:'ImAccessibility',adapters:state.adapters,
  nodeExeIsFile:typeof nodeExe==='string'&&exists(nodeExe),
  ffmpegExeIsFile:typeof ffmpegExe==='string'&&!!ffmpegExe&&exists(ffmpegExe),
  modelSupported:config.SUPPORTED_MODEL,
  note:'No pairing, TV/network connection, service/task or command launched. No files written.'};
}
function numberChoice(raw,total){
 if(typeof raw!=='string'||!/^[1-9]\d*$/.test(raw)||Number(raw)>total)return null;
 return Number(raw)-1;
}
async function wizard({input=process.stdin,output=process.stdout,
 networkInterfaces=os.networkInterfaces(),nodeExe=process.execPath,
 ffmpegExe=process.env.PC_BRIDGE_FFMPEG_EXE||'',env=process.env}={}){
 if(process.platform!=='win32')fail('First-run setup requires Windows');
 const candidates=fixture({networkInterfaces,nodeExe,ffmpegExe}).adapters;
 if(!candidates.length)fail('No valid physical private-LAN adapter found. Check your network settings.');
 const {file}=settingsFile(env);
 if(fs.existsSync(file))fail('Existing owner settings detected; setup will not overwrite them.');
 const rl=readline.createInterface({input,output});
 try{
  output.write('\nI’m-accessibility — guided first-run setup\n');
  output.write('This does not connect to your TV, start streaming or change Windows tasks.\n');
  output.write('Select the PC network connection you want to use:\n');
  for(const [i,a] of candidates.entries())
   output.write('  '+(i+1)+'. '+a.name+' ('+a.ip+', mask '+a.mask+')\n');
  const answer=(await rl.question('Adapter number: ')).trim();
  const idx=numberChoice(answer,candidates.length);
  if(idx===null)fail('Invalid adapter selection; no settings saved');
  const adapter=candidates[idx];
  output.write('\nInitially tested TV model: '+config.SUPPORTED_MODEL+'\n');
  const ip=(await rl.question('TV IP from LG Network Settings (blank to configure later): ')).trim();
  const chosenNode=(await rl.question('Node.js executable ['+nodeExe+']: ')).trim()||nodeExe;
  const chosenFFmpeg=(await rl.question('FFmpeg executable'+(ffmpegExe?' ['+ffmpegExe+']':' (required full path)')+': ')).trim()||ffmpegExe;
  const candidate={adapterName:adapter.name,localIp:adapter.ip,tvIp:ip||null,
   nodeExe:chosenNode,ffmpegExe:chosenFFmpeg};
  const {selected}=buildCandidate(candidate,{networkInterfaces});
  output.write('\nReview: '+JSON.stringify(config.safeSummary(selected),null,2)+'\n');
  output.write('No LG pairing or service action will be performed.\n');
  const confirm=(await rl.question('Save these settings to your Windows profile? Type YES: ')).trim();
  if(confirm!=='YES')return {written:false,reason:'Owner did not confirm'};
  return saveSettings(candidate,{networkInterfaces,env});
 }finally{rl.close()}
}
async function main(args=process.argv.slice(2)){
 const arg=args[0]||'--help';
 if(args.length>1)fail('Only one setup command is accepted');
 if(arg==='--help'){
  console.log('Usage: node FirstRun.cjs --doctor | --wizard | --validate');
  console.log('--doctor is read-only, --wizard writes owner-confirmed settings once, --validate reads them.');
  return;
 }
 if(arg==='--doctor'){console.log(JSON.stringify(doctor(),null,2));return}
 if(arg==='--validate'){console.log(JSON.stringify(validateInstalled(),null,2));return}
 if(arg==='--wizard'){
  if(!process.stdin.isTTY)fail('Interactive Windows terminal required for setup');
  const result=await wizard();
  console.log(JSON.stringify(result,null,2));
  if(result.written)console.log('Settings saved. Configure your TV and use Start.cmd when ready.');
  return;
 }
 fail('Unsupported setup operation');
}
if(require.main===module)main().catch(e=>{
 console.error('SETUP_ERROR '+String(e.message||e).slice(0,330));
 process.exitCode=1;
});
module.exports={LOCAL_FOLDER,fixture,buildCandidate,settingsFile,saveSettings,validateInstalled,
 doctor,numberChoice,wizard};
