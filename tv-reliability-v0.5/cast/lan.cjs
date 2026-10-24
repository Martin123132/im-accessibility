'use strict';
const os=require('node:os');
const {readUserSettings}=require('../release-config.cjs');
const RELEASE_SETTINGS=process.env.IM_ACCESSIBILITY_CONFIG_PATH!==undefined?readUserSettings():null;
const PORT=43196;
function toInt(ip){
 if(typeof ip!=='string'||!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip))return null;
 const arr=ip.split('.').map(Number);if(arr.some(x=>x>255))return null;
 return arr.reduce((n,b)=>((n<<8)|b)>>>0,0);
}
function chosen(){
 const list=Object.entries(os.networkInterfaces()).flatMap(([name,addrs])=>(addrs||[])
  .filter(x=>x.family==='IPv4'&&!x.internal&&/^192\.168\./.test(x.address)&&!/wsl|virtual|vEthernet|docker|tailscale/i.test(name))
  .map(x=>({name,ip:x.address,mask:x.netmask})));
 if(list.length!==1)throw Error('Expected exactly one physical 192.168.x.x LAN interface, found '+list.length);
 return list[0];
}
const iface=RELEASE_SETTINGS?RELEASE_SETTINGS.network:chosen(),LAN_IP=iface.ip;
function isLocalIp(ip){
 if(typeof ip!=='string')return false;
 if(ip.startsWith('::ffff:'))ip=ip.slice(7);
 if(ip==='127.0.0.1'||ip==='::1')return true;
 const a=toInt(ip),b=toInt(LAN_IP),mask=toInt(iface.mask);
 return a!==null&&b!==null&&mask!==null&&(a&mask)===(b&mask);
}
function isRemoteLan(ip){
 if(typeof ip!=='string')return false;
 if(ip.startsWith('::ffff:'))ip=ip.slice(7);
 if(ip==='127.0.0.1'||ip==='::1')return false;
 const a=toInt(ip),b=toInt(LAN_IP),mask=toInt(iface.mask);
 const inSubnet=a!==null&&b!==null&&mask!==null&&(a&mask)===(b&mask);
 // V1 configuration permits only the specifically owner-selected TV.
 return inSubnet&&(!RELEASE_SETTINGS||ip===RELEASE_SETTINGS.television.ip);
}
module.exports={PORT,LAN_IP,iface,isLocalIp,isRemoteLan,toInt,
 CONFIGURED:!!RELEASE_SETTINGS,APPROVED_TV_IP:RELEASE_SETTINGS?.television.ip||null};
