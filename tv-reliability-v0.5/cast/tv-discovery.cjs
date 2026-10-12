'use strict';
// LAN-only, read-only SSDP discovery. No port sweep, Wake-on-LAN or TV actions.
const dgram=require('node:dgram');
const {isLocalIp,LAN_IP}=require('./lan.cjs');
async function discover({durationMs=3000}={}){
 if(!Number.isInteger(durationMs)||durationMs<500||durationMs>6500)throw Error('Invalid discovery window');
 return await new Promise(resolve=>{
  const results=new Map(),sock=dgram.createSocket('udp4');let finished=false;
  const finish=()=>{if(finished)return;finished=true;try{sock.close()}catch{}
   resolve([...results.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(0,24));};
  sock.on('error',()=>finish());
  sock.on('message',(data,remote)=>{
   const msg=String(data);
   if(!isLocalIp(remote.address))return;
   const field=k=>msg.match(new RegExp('^'+k+':\\s*(.+)$','im'))?.[1]?.trim()||'';
   const info=(field('SERVER')+' '+field('ST')+' '+field('USN')+' '+field('LOCATION'));
   let type=null,name=null;
   if(/webos|lg.?electron|lge|lgsmart|LG.*NetCast|LG.*DLNA|LGTV/i.test(info)){type='lg';name='LG webOS device';}
   else if(/dial-multiscreen/i.test(info)&&/amazon|quick_ssdp/i.test(info)){type='manual';name='Casting device (browser setup)';}
   if(!type)return;
   const previous=results.get(remote.address);
   results.set(remote.address,{id:remote.address,address:remote.address,name:previous?.name||name,type,discoveredBy:'SSDP'});
  });
  sock.bind(0,()=>{
   try{sock.setMulticastInterface(LAN_IP)}catch{}
   const query=['M-SEARCH * HTTP/1.1','HOST:239.255.255.250:1900','MAN:"ssdp:discover"','MX:2','ST:ssdp:all','',''].join('\r\n');
   sock.send(Buffer.from(query),1900,'239.255.255.250');
  });
  setTimeout(finish,durationMs);
 });
}
module.exports={discover};
