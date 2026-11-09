'use strict';
// Read-only first-run discovery BEFORE any TV configuration is saved.
// Detect device families independently of their casting/connection support.
const fs = require('node:fs');
const path = require('node:path');
const dgram = require('node:dgram');
const localFirstRun = path.join(__dirname,'first-run.cjs');
const root = fs.existsSync(localFirstRun) ? __dirname : path.resolve(__dirname,'..','..');
const first = require(fs.existsSync(localFirstRun) ? localFirstRun :
  path.resolve(__dirname,'..','first-run.cjs'));
const config = require(path.join(root,'tv-reliability-v0.5','release-config.cjs'));

const SERVICES = [
  ['_googlecast._tcp.local','Google Cast','google-cast'],
  ['_airplay._tcp.local','Apple AirPlay','airplay'],
  ['_companion-link._tcp.local','Apple TV','apple-tv'],
  ['_androidtvremote2._tcp.local','Android TV','android-tv'],
  ['_roku-ecp._tcp.local','Roku','roku']
];
// Only the original LG webOS path has an implemented, owner-tested connector.
// All other detected device families are presented as discovery only.
function capability(brand) {
  return brand === 'LG' ?
    {adapter:'lg-webos',status:'LG webOS preview; check model compatibility'} :
    {adapter:null,status:'Detected; direct casting not yet supported'};
}
function adapter(selection,{adaptersFn=()=>first.fixture().adapters}={}) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection) ||
      Object.keys(selection).sort().join(',') !== 'adapterName,localIp' ||
      typeof selection.adapterName !== 'string' || typeof selection.localIp !== 'string')
    throw Error('Select a computer network connection first');
  const found=adaptersFn().filter(x=>x.name===selection.adapterName&&
                                      x.ip===selection.localIp);
  if(found.length!==1||!config.isPrivate(found[0].ip))
    throw Error('Network selection is not a verified physical private connection');
  return found[0];
}
function clean(value,max=65) {
  return String(value||'').replace(/[\x00-\x1f\x7f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
}
function ssdpReply(value) {
  const text=String(value);
  if(text.length>8192||!(/^HTTP\/1\.[01] 200\b/i.test(text)))return null;
  const h={};
  for(const line of text.split(/\r?\n/).slice(1,45)){
    const i=line.indexOf(':');
    if(i>0)h[line.slice(0,i).toLowerCase().trim()]=line.slice(i+1).trim().slice(0,350);
  }
  const details=[h.server,h.st,h.nt,h.usn,h.location,h['x-device-name']].join(' ');
  const patterns=[
    [/roku|roku:ecp/i,'Roku','roku'],
    [/samsung|tizen|sec_product/i,'Samsung','samsung-tizen'],
    [/\blg\b|webos|lge\.com|netcast|lgsmart|lg.?electron/i,'LG','lg-webos'],
    [/sony|bravia/i,'Sony','sony-bravia'],
    [/googlecast|chromecast/i,'Google Cast','google-cast'],
    [/android.?tv|googletv/i,'Android TV','android-tv'],
    [/fire.?tv|amazon.*dial|afts|aftmm/i,'Amazon Fire TV','fire-tv'],
    [/panasonic|viera/i,'Panasonic','panasonic'],
    [/hisense|vidaa/i,'Hisense','hisense'],
    [/\btcl\b/i,'TCL','tcl'],
    [/philips.*tv|tpvision/i,'Philips','philips'],
    [/dial-multiscreen/i,'DIAL','dial'],
    [/mediarenderer/i,'DLNA','dlna']
  ];
  const match=patterns.find(([re])=>re.test(details));
  if(!match)return null;
  const [,brand,protocol]=match;
  return {brand,protocol,name:clean(h['x-device-name'])||brand+' device',method:'SSDP'};
}
function dnsName(buf,start) {
  let pos=start,end=-1,jumps=0;
  const parts=[],seen=new Set();
  for(;;){
    if(pos>=buf.length||jumps>18||seen.has(pos))throw Error('Invalid DNS compression');
    seen.add(pos);
    const length=buf[pos];
    if(length===0){pos++;if(end<0)end=pos;break;}
    if((length&0xc0)===0xc0){
      if(pos+1>=buf.length)throw Error('Truncated DNS pointer');
      const next=((length&63)<<8)|buf[pos+1];
      if(end<0)end=pos+2;
      pos=next;jumps++;continue;
    }
    if((length&0xc0)!==0||length>63||pos+1+length>buf.length)
      throw Error('Invalid DNS label');
    parts.push(buf.toString('utf8',pos+1,pos+1+length));
    pos+=length+1;
    if(parts.join('.').length>240)throw Error('DNS name too long');
  }
  return {name:parts.join('.'),next:end};
}
function mdnsReply(packet) {
  if(!Buffer.isBuffer(packet)||packet.length<12||packet.length>8192)return null;
  try{
    const counts=[4,6,8,10].map(i=>packet.readUInt16BE(i));
    if(counts.reduce((a,b)=>a+b,0)>120)return null;
    let pos=12;
    for(let i=0;i<counts[0];i++){
      const q=dnsName(packet,pos);pos=q.next+4;
      if(pos>packet.length)throw Error('Truncated question');
    }
    let result=null;
    for(let i=0;i<counts[1]+counts[2]+counts[3];i++){
      const rr=dnsName(packet,pos);pos=rr.next;
      if(pos+10>packet.length)throw Error('Truncated DNS answer');
      const type=packet.readUInt16BE(pos),len=packet.readUInt16BE(pos+8);pos+=10;
      if(pos+len>packet.length)throw Error('Bad DNS answer');
      if(type===12){
        const instance=dnsName(packet,pos).name;
        const full=(rr.name+' '+instance).toLowerCase();
        for(const [service,brand,protocol] of SERVICES){
          if(full.includes(service)){
            const suffix='.'+service;
            const name=clean(instance.toLowerCase().endsWith(suffix)?
              instance.slice(0,-suffix.length):instance);
            const lg=/\[LG\]|\bwebos\b/i.test(name);
            result={brand:lg?'LG':brand,protocol:lg?'lg-webos':protocol,name:name||brand+' device',method:'mDNS'};
            break;
          }
        }
      }
      pos+=len;
    }
    return result;
  }catch{return null;}
}
function question(service) {
  const parts=[Buffer.alloc(12)];parts[0].writeUInt16BE(1,4);
  for(const label of service.split('.')){
    const b=Buffer.from(label,'ascii');
    if(!b.length||b.length>63)throw Error('Bad DNS question');
    parts.push(Buffer.from([b.length]),b);
  }
  parts.push(Buffer.from([0,0,12,0x80,1]));
  return Buffer.concat(parts);
}
function validIp(ip,network) {
  return typeof ip==='string'&&config.isPrivate(ip)&&
    config.subnet(ip,network.ip,network.mask)&&
    config.usableHost(ip,network.mask)&&ip!==network.ip;
}
function merge(found,network) {
  const unique=new Map();
  for(const device of found) {
    if(!device||!validIp(device.ip,network))continue;
    const earlier=unique.get(device.ip);
    const better=device.brand==='LG'?device:earlier&&earlier.brand!=='DIAL'&&earlier.brand!=='DLNA'?earlier:device;
    const methods=[...new Set([...(earlier?.methods||[]),device.method])];
    unique.set(device.ip,{ip:device.ip,brand:better.brand,protocol:better.protocol,
      name:clean(better.name)||better.brand+' device',methods,...capability(better.brand)});
  }
  return [...unique.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(0,28);
}
function listen(mode,network,onHit,{durationMs=4200,socketFactory=()=>dgram.createSocket('udp4')}={}) {
  return new Promise(resolve=>{
    const sock=socketFactory();
    let done=false;
    const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);try{sock.close()}catch{}resolve(error?mode+": discovery unavailable on the selected network":null);};
    const timer=setTimeout(finish,durationMs);
    sock.on('error',finish);
    sock.on('message',(raw,remote)=>{
      if(!remote||!validIp(remote.address,network))return;
      const parsed=mode==='SSDP'?ssdpReply(raw.toString('utf8')):mdnsReply(raw);
      if(parsed)onHit({ip:remote.address,...parsed});
    });
    try{
      sock.bind(0,network.ip,()=>{
        if(done)return;
        try{sock.setMulticastInterface(network.ip);}catch(e){finish(e);return;}
        if(mode==='SSDP'){
          for(const st of ['ssdp:all','urn:schemas-upnp-org:device:MediaRenderer:1',
                           'urn:dial-multiscreen-org:service:dial:1']){
            const msg=['M-SEARCH * HTTP/1.1','HOST: 239.255.255.250:1900',
                       'MAN: "ssdp:discover"','MX: 2','ST: '+st,'',''].join('\r\n');
            try{sock.send(Buffer.from(msg),1900,'239.255.255.250',error=>{if(error)finish(error)});}catch(e){finish(e);}
          }
        }else{
          for(const [service] of SERVICES){
            try{sock.send(question(service),5353,'224.0.0.251',error=>{if(error)finish(error)});}catch(e){finish(e);}
          }
        }
      });
    }catch(e){finish(e);}
  });
}
async function scan(selection,{adaptersFn, durationMs=4200,socketFactory}={}) {
  if(!Number.isInteger(durationMs)||durationMs<10||durationMs>6500)
    throw Error('Invalid discovery duration');
  const network=adapter(selection,{adaptersFn});
  const found=[];
  const warnings=(await Promise.all(['SSDP','mDNS'].map(mode=>
    listen(mode,network,row=>found.push(row),{durationMs,socketFactory})))).filter(Boolean);
  if(warnings.length===2)throw Error("Discovery could not use the selected network. Check its connection and firewall permissions, then retry.");
  const devices=merge(found,network);
  return {ok:true,readOnly:true,network:network.name,count:devices.length,devices,warnings};
}
module.exports={adapter,capability,ssdpReply,mdnsReply,question,validIp,merge,scan};
