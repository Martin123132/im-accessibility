'use strict';
// I’m-accessibility v1: read-only per-user release configuration validator.
// Does not mutate networking, pair TVs, write credentials, start services or launch programs.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const SETTINGS_ENV='IM_ACCESSIBILITY_CONFIG_PATH';
const TASK_NAME='ImAccessibility-TV-v1';
const MAX_BYTES=8192;
const SUPPORTED_MODEL='OLED55CX6LA';
const REJECT_DEVICE_NAME=/(?:^|[\s_-])(?:wsl|virtual|vethernet|docker|tailscale|vpn|tun|tap|loopback|hyper-v|vmware|vbox|pseudo|miniport)(?:$|[\s_-])/i;

function object(value,label){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+' must be a JSON object');
 const proto=Object.getPrototypeOf(value);
 if(proto!==Object.prototype&&proto!==null)throw Error(label+' must be a plain object');
 return value;
}
function keys(value,allowed,label){
 object(value,label);
 for(const key of Object.keys(value))if(!allowed.includes(key))throw Error(label+' contains unsupported field: '+key);
}
function uintIp(value){
 if(typeof value!=='string'||!/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(value))return null;
 const parts=value.split('.');
 if(parts.some(x=>(x.length>1&&x[0]==='0')||Number(x)>255))return null;
 return parts.reduce((n,x)=>(((n<<8)|Number(x))>>>0),0);
}
function maskBits(mask){
 const n=uintIp(mask);
 if(n===null)return null;
 const str=n.toString(2).padStart(32,'0');
 const prefix=str.indexOf('0');
 return prefix>=16&&prefix<=30&&/^1+0+$/.test(str)?prefix:null;
}
function isPrivate(ip){
 const v=uintIp(ip);if(v===null)return false;
 const a=v>>>24,b=(v>>>16)&255;
 return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
function subnet(ip,source,netmask){
 const x=uintIp(ip),y=uintIp(source),m=uintIp(netmask);
 if(x===null||y===null||m===null||maskBits(netmask)===null)return false;
 return ((x&m)>>>0)===((y&m)>>>0);
}
function usableHost(ip,netmask){
 const i=uintIp(ip),m=uintIp(netmask);
 if(i===null||m===null||maskBits(netmask)===null)return false;
 const wildcard=(~m)>>>0;
 const host=(i & wildcard)>>>0;
 return host!==0&&host!==wildcard;
}
function adapters(interfaces){
 object(interfaces,'network interfaces');
 const result=[];
 for(const [name,entries] of Object.entries(interfaces)){
  if(typeof name!=='string'||name.length>120||REJECT_DEVICE_NAME.test(name))continue;
  if(!Array.isArray(entries))continue;
  for(const entry of entries){
   if(!entry||!(entry.family==='IPv4'||entry.family===4)||entry.internal===true)continue;
   if(!isPrivate(entry.address)||maskBits(entry.netmask)===null||!usableHost(entry.address,entry.netmask))continue;
   result.push({name,ip:entry.address,mask:entry.netmask});
  }
 }
 return result;
}
function chooseAdapter(selection,interfaces){
 keys(selection,['adapterName','localIp'],'network');
 if(selection.adapterName!==undefined&&(typeof selection.adapterName!=='string'||!selection.adapterName.trim()||selection.adapterName.length>120))
  throw Error('network.adapterName must name an actual local adapter');
 if(selection.localIp!==undefined&&!isPrivate(selection.localIp))
  throw Error('network.localIp must be a valid private IPv4 address');
 if(!selection.adapterName&&!selection.localIp)throw Error('Select network.adapterName or network.localIp explicitly');
 const matches=adapters(interfaces).filter(a=>
   (selection.adapterName===undefined||a.name===selection.adapterName)&&
   (selection.localIp===undefined||a.ip===selection.localIp));
 if(matches.length===0)throw Error('No matching physical private-LAN adapter; check Windows Network Settings');
 if(matches.length>1)throw Error('Multiple matching network interfaces; specify both adapterName and localIp');
 return Object.freeze(matches[0]);
}
function localExe(value,name,exists){
 if(typeof value!=='string'||value.length>650||!/^[A-Za-z]:\\/.test(value)||
    value.includes('/')||/[\x00-\x1f"'|<>*?]/.test(value)||value.slice(2).includes(':')||
    value.split('\\').some(x=>x==='.'||x==='..')||path.win32.normalize(value).toLowerCase()!==value.toLowerCase()||
    path.win32.basename(value).toLowerCase()!==name)
  throw Error('executables.'+name+' must be an absolute local Windows .exe path');
 if(!exists(value))throw Error('Required executable not found: '+name);
 return value;
}
function validate(config,{networkInterfaces=os.networkInterfaces(),existsFile=(f)=>{try{return fs.statSync(f).isFile()}catch{return false}}}={}){
 keys(config,['schema','network','television','executables'],'settings');
 if(config.schema!==1)throw Error('Unsupported settings schema; expected version 1');
 const adapter=chooseAdapter(config.network,networkInterfaces);
 keys(config.television,['model','ip'],'television');
 if(config.television.model!==SUPPORTED_MODEL)throw Error('TV model not on initial supported-device list: '+String(config.television.model));
 const tvIp=config.television.ip;
 if(tvIp!==null&&tvIp!==undefined){
  if(!isPrivate(tvIp)||!subnet(tvIp,adapter.ip,adapter.mask)||!usableHost(tvIp,adapter.mask)||tvIp===adapter.ip)
   throw Error('television.ip must be another usable device in the selected private LAN');
 }
 keys(config.executables,['nodeExe','ffmpegExe'],'executables');
 if(typeof existsFile!=='function')throw Error('Invalid executable-check function');
 const nodeExe=localExe(config.executables.nodeExe,'node.exe',existsFile);
 const ffmpegExe=localExe(config.executables.ffmpegExe,'ffmpeg.exe',existsFile);
 return Object.freeze({
  schema:1,network:adapter,television:Object.freeze({model:SUPPORTED_MODEL,ip:tvIp||null}),
  executables:Object.freeze({nodeExe,ffmpegExe}),taskName:TASK_NAME
 });
}
function configPath({env=process.env,platform=process.platform,repoRoot=path.resolve(__dirname,'..')}={}){
 if(platform!=='win32')throw Error('Windows is required for this release configuration');
 const dest=env[SETTINGS_ENV]||(
  typeof env.LOCALAPPDATA==='string'&&env.LOCALAPPDATA
   ?path.win32.join(env.LOCALAPPDATA,'ImAccessibility','settings.json'):null);
 if(typeof dest!=='string'||!/^[A-Za-z]:\\/.test(dest)||dest.length>700||
   /[\x00-\x1f"'|<>*?]/.test(dest)||dest.slice(2).includes(':')||
   dest.split('\\').some(x=>x==='.'||x==='..')||
   path.win32.normalize(dest).toLowerCase()!==dest.toLowerCase()||
   path.win32.basename(dest).toLowerCase()!=='settings.json')
  throw Error('Settings must be a local absolute Windows settings.json path under the user profile');
 const relative=path.win32.relative(repoRoot,dest);
 if(relative===''||(!relative.startsWith('..'+path.win32.sep)&&relative!=='..'&&!path.win32.isAbsolute(relative)))
  throw Error('Settings cannot live inside the source/repository directory');
 return dest;
}
function readUserSettings({env=process.env,platform=process.platform,repoRoot=path.resolve(__dirname,'..'),fsApi=fs,networkInterfaces=os.networkInterfaces()}={}){
 const file=configPath({env,platform,repoRoot});
 let stat;try{stat=fsApi.statSync(file)}catch{throw Error('Per-user settings.json is missing; run guided setup before TV control')}
 if(!stat.isFile()||stat.size<2||stat.size>MAX_BYTES)throw Error('Invalid or oversized settings.json (maximum 8 KiB)');
 let json;
 try{json=JSON.parse(fsApi.readFileSync(file,'utf8'))}catch{throw Error('settings.json is not valid JSON')}
 return validate(json,{networkInterfaces,existsFile:(f)=>{try{return fsApi.statSync(f).isFile()}catch{return false}}});
}
function safeSummary(config){
 return {valid:true,schema:config.schema,adapter:config.network.name,
  localIp:config.network.ip,networkMask:config.network.mask,
  model:config.television.model,tvSelected:!!config.television.ip,
  nodeAvailable:true,ffmpegAvailable:true,taskName:config.taskName};
}
if(require.main===module){
 try{
  const valid=readUserSettings();
  process.stdout.write(JSON.stringify(safeSummary(valid),null,2)+'\n');
 }catch(e){
  process.stderr.write('IM_ACCESSIBILITY_CONFIG_ERROR '+String(e.message||e).slice(0,260)+'\n');
  process.exitCode=1;
 }
}
module.exports={SETTINGS_ENV,TASK_NAME,MAX_BYTES,SUPPORTED_MODEL,uintIp,maskBits,isPrivate,subnet,usableHost,
 adapters,chooseAdapter,validate,configPath,readUserSettings,safeSummary};
