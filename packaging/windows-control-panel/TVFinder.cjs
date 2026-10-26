'use strict';
// Multibrand TV discovery: read-only local SSDP and DNS-SD/mDNS.
// Finding a device never pairs, connects, modifies configuration or starts streaming.
const dgram=require('node:dgram'),path=require('node:path');
const fs=require('node:fs');
function findReleaseConfig(){
  const possibilities=[
    path.resolve(__dirname,'..','tv-reliability-v0.5','release-config.cjs'),
    path.resolve(__dirname,'..','..','tv-reliability-v0.5','release-config.cjs')
  ];
  const selected=possibilities.find(f=>fs.existsSync(f));
  if(!selected)throw Error('Installed TV release configuration not found');
  return selected;
}
// Installed builds use the standard per-user settings in LOCALAPPDATA.
// Source tests can supply IM_ACCESSIBILITY_CONFIG_PATH explicitly.
const {readUserSettings,isPrivate,subnet,usableHost}=require(findReleaseConfig());
const SERVICES=[
 ['_googlecast._tcp.local','Google Cast','Cast receiver'],
 ['_airplay._tcp.local','Apple AirPlay','AirPlay receiver'],
 ['_companion-link._tcp.local','Apple TV','Apple TV'],
 ['_androidtvremote2._tcp.local','Android TV','Smart TV'],
 ['_roku-ecp._tcp.local','Roku','Roku TV / streamer']
];
function validLan(ip,net){
 return typeof ip==='string'&&isPrivate(ip)&&subnet(ip,net.ip,net.mask)&&
   usableHost(ip,net.mask)&&ip!==net.ip;
}
function clean(s,max=70){return String(s||'').replace(/[\x00-\x1f\x7f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max)}
function recognizeSsdp(input){
 const raw=String(input);
 if(raw.length>8192||!(/^(HTTP\/1\.[01] 200\b|NOTIFY \*)/i.test(raw)))return null;
 const h={};
 for(const line of raw.split(/\r?\n/).slice(1,50)){
  const n=line.indexOf(':');if(n>0){const k=line.slice(0,n).toLowerCase().trim();h[k]=line.slice(n+1).trim().slice(0,500)}
 }
 const s=[h.server,h.st,h.nt,h.usn,h.location,h['x-device-name']].join(' ');
 const table=[
  [/roku|roku:ecp/i,'Roku','Roku TV / streamer','Roku TV or streamer'],
  [/samsung|tizen|sec_product/i,'Samsung','Samsung smart TV','Smart TV'],
  [/\blg\b|webos|lge\.com|netcast|lgsmart|lg.?electron/i,'LG','LG webOS TV','Smart TV'],
  [/sony|bravia/i,'Sony','Sony BRAVIA TV','Smart TV'],
  [/googlecast|chromecast/i,'Google Cast','Google Cast device','Cast receiver'],
  [/android.?tv|googletv/i,'Android TV','Android / Google TV','Smart TV'],
  [/fire.?tv|amazon.*dial|afts|aftmm/i,'Amazon Fire TV','Amazon Fire TV','Cast receiver'],
  [/panasonic|viera/i,'Panasonic','Panasonic smart TV','Smart TV'],
  [/hisense|vidaa/i,'Hisense','Hisense smart TV','Smart TV'],
  [/\btcl\b/i,'TCL','TCL smart TV','Smart TV'],
  [/philips.*tv|tpvision/i,'Philips','Philips smart TV','Smart TV'],
  [/dial-multiscreen/i,'DIAL','DIAL streaming device','Cast receiver'],
  [/mediarenderer/i,'DLNA','DLNA media renderer','Media renderer']
 ];
 for(const [re,brand,name,kind] of table)if(re.test(s))return {brand,name,kind,method:'SSDP'};
 return null;
}
function dnsName(buf,start){
 let pos=start,end=-1,jumps=0,seen=new Set(),parts=[];
 if(pos>=buf.length)throw Error('Invalid DNS name');
 for(;;){
  if(pos>=buf.length||jumps>18||seen.has(pos))throw Error('Invalid DNS compression');
  seen.add(pos);
  const size=buf[pos];
  if(size===0){pos++;if(end<0)end=pos;break}
  if((size&0xc0)===0xc0){
   if(pos+1>=buf.length)throw Error('Truncated DNS pointer');
   const next=((size&63)<<8)|buf[pos+1];
   if(end<0)end=pos+2;pos=next;jumps++;continue;
  }
  if((size&0xc0)!==0||size>63||pos+1+size>buf.length)throw Error('Invalid DNS label');
  parts.push(buf.toString('utf8',pos+1,pos+1+size));pos+=size+1;
  if(parts.join('.').length>240)throw Error('DNS name too long');
 }
 return {name:parts.join('.'),next:end};
}
function mdnsRecords(packet){
 if(!Buffer.isBuffer(packet)||packet.length<12||packet.length>8192)return [];
 const records=[];
 try{
  const counts=[packet.readUInt16BE(4),packet.readUInt16BE(6),packet.readUInt16BE(8),packet.readUInt16BE(10)];
  if(counts.reduce((a,b)=>a+b,0)>120)return [];
  let pos=12;
  for(let i=0;i<counts[0];i++){const q=dnsName(packet,pos);pos=q.next+4;if(pos>packet.length)throw Error('DNS question truncated')}
  for(let i=0;i<counts[1]+counts[2]+counts[3];i++){
   const n=dnsName(packet,pos);pos=n.next;
   if(pos+10>packet.length)throw Error('DNS answer truncated');
   const type=packet.readUInt16BE(pos),len=packet.readUInt16BE(pos+8);pos+=10;
   if(pos+len>packet.length)throw Error('DNS answer invalid');
   if(type===12)records.push({service:n.name,instance:dnsName(packet,pos).name,type:'PTR'});
   if(type===16){
    let off=pos;const data=[];
    while(off<pos+len){const size=packet[off++];if(off+size>pos+len)break;data.push(packet.toString('utf8',off,off+size));off+=size}
    records.push({service:n.name,txt:data.slice(0,16),type:'TXT'});
   }
   pos+=len;
  }
 }catch{return []}
 return records;
}
function recognizeMdns(packet){
 let best=null;
 for(const r of mdnsRecords(packet)){
  const full=(r.service+' '+(r.instance||'')).toLowerCase();
  for(const [service,brand,kind] of SERVICES){
   if(!full.includes(service))continue;
   let name=brand;
   if(r.type==='PTR'&&r.instance){
    const suffix='.'+service;
    const original=r.instance;
    name=clean(original.toLowerCase().endsWith(suffix)?
       original.slice(0,-suffix.length):original);
   }
   if(!best||r.type==='PTR')best={brand,name:name||brand,kind,method:'mDNS'};
  }
 }
 return best;
}
function question(service){
 const chunks=[Buffer.alloc(12)];chunks[0].writeUInt16BE(1,4);
 for(const label of service.split('.')){
  const b=Buffer.from(label,'ascii');if(!b.length||b.length>63)throw Error('DNS question name invalid');
  chunks.push(Buffer.from([b.length]),b);
 }
 chunks.push(Buffer.from([0,0,12,0x80,1]));return Buffer.concat(chunks);
}
function mergeRows(found,verified){
 const rows=new Map();
 for(const h of found){
  if(!h||!validLan(h.ip,verified.network))continue;
  const old=rows.get(h.ip);
  const isCurrent=h.ip===verified.television.ip;
  const item={ip:h.ip,brand:isCurrent?'LG':clean(h.brand,40),
   name:isCurrent?'LG webOS TV ('+verified.television.model+')':clean(h.name),
   kind:isCurrent?'Smart TV':clean(h.kind,60),
   methods:old?[...new Set([...old.methods,h.method])]:[h.method],found:true,
   current:isCurrent,
   connection:isCurrent?'Current supported LG TV':'Discovered - connection not yet supported'};
  if(old&&old.methods.includes('mDNS')&&h.method==='SSDP'){
   old.methods=item.methods;rows.set(h.ip,old);continue;
  }
  rows.set(h.ip,item);
 }
 if(verified.television.ip&&!rows.has(verified.television.ip)){
  rows.set(verified.television.ip,{ip:verified.television.ip,brand:'LG',
   name:'Saved LG TV',kind:'Smart TV',methods:[],found:false,current:true,
   connection:'Saved - not detected this scan'});
 }
 return [...rows.values()].sort((a,b)=>Number(b.current)-Number(a.current)||
  Number(b.found)-Number(a.found)||a.name.localeCompare(b.name)).slice(0,28);
}
function scanUdp(mode,network,onHit,durationMs){
 return new Promise(resolve=>{
  const sock=dgram.createSocket('udp4',{reuseAddr:true});let ended=false;
  const finish=()=>{if(ended)return;ended=true;try{sock.close()}catch{}resolve()};
  sock.on('error',finish);
  sock.on('message',(buf,remote)=>{
   if(!validLan(remote.address,network))return;
   const hit=mode==='ssdp'?recognizeSsdp(buf.toString('utf8')):recognizeMdns(buf);
   if(hit)onHit({ip:remote.address,...hit});
  });
  sock.bind(0,network.ip,()=>{
   try{sock.setMulticastInterface(network.ip)}catch{}
   if(mode==='ssdp'){
    for(const st of ['ssdp:all','roku:ecp','urn:dial-multiscreen-org:service:dial:1',
      'urn:schemas-upnp-org:device:MediaRenderer:1']){
     const msg=['M-SEARCH * HTTP/1.1','HOST: 239.255.255.250:1900','MAN: "ssdp:discover"',
      'MX: 2','ST: '+st,'',''].join('\r\n');
     try{sock.send(Buffer.from(msg),1900,'239.255.255.250',()=>{})}catch{}
    }
   }else{
    for(const [service] of SERVICES)try{sock.send(question(service),5353,'224.0.0.251',()=>{})}catch{}
   }
  });
  setTimeout(finish,durationMs);
 });
}
async function scan({durationMs=4200}={}){
 const verified=readUserSettings();const found=[];
 await Promise.all(['ssdp','mdns'].map(mode=>scanUdp(mode,verified.network,x=>found.push(x),durationMs)));
 const devices=mergeRows(found,verified);
 return {ok:true,readOnly:true,network:'Local Wi-Fi',currentIp:verified.television.ip,count:devices.length,devices};
}
if(require.main===module){
 if(process.argv.length!==3||process.argv[2]!=='--scan'){
  process.stderr.write('Usage: TVFinder.cjs --scan (read-only)\n');process.exitCode=2;
 }else scan().then(result=>process.stdout.write(JSON.stringify(result)+'\n')).catch(e=>{
  process.stderr.write('TV_DISCOVERY_UNAVAILABLE '+String(e.message||e).slice(0,180)+'\n');process.exitCode=1;
 });
}
module.exports={validLan,recognizeSsdp,mdnsRecords,recognizeMdns,question,mergeRows,scan};
