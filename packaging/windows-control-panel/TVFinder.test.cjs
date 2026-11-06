'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./TVFinder.cjs');
const fake={network:{ip:'192.168.50.36',mask:'255.255.255.0'},
 television:{ip:'192.168.50.23',model:'OLED55CX6LA'}};
function dnsName(s){const chunks=[];for(const part of s.split('.')){const b=Buffer.from(part);chunks.push(Buffer.from([b.length]),b)}chunks.push(Buffer.from([0]));return Buffer.concat(chunks)}
function ptrAnswer(svc,inst){
 const head=Buffer.alloc(12);head.writeUInt16BE(1,6);
 const type=Buffer.alloc(10);type.writeUInt16BE(12,0);type.writeUInt16BE(1,2);type.writeUInt32BE(120,4);
 const data=dnsName(inst);type.writeUInt16BE(data.length,8);
 return Buffer.concat([head,dnsName(svc),type,data]);
}
test('SSDP recognizes LG, Samsung, Sony, Roku, Google Cast, Fire TV, DLNA',()=>{
 const cases=[
  ['WebOS/6.0 UPnP/1.1','LG'],
  ['Samsung Tizen DLNA','Samsung'],
  ['Sony Bravia/5.0','Sony'],
  ['Roku UPnP/1.0','Roku'],
  ['Google Chromecast/1.0','Google Cast'],
  ['Amazon FireTV/1.0','Amazon Fire TV'],
  ['UPnP MediaRenderer/1.0','DLNA']
 ];
 for(const [device,brand] of cases){
  const res=f.recognizeSsdp('HTTP/1.1 200 OK\r\nSERVER: '+device+'\r\nST: ssdp:all\r\n\r\n');
  assert.equal(res?.brand,brand,'Classification '+device);
 }
 assert.equal(f.recognizeSsdp('HTTP/1.1 200 OK\r\nSERVER: random printer\r\n\r\n'),null);
 assert.equal(f.recognizeSsdp('BAD\r\nSERVER: Roku\r\n\r\n'),null);
});
test('DNS-SD recognizes Chromecast instance and Apple AirPlay',()=>{
 for(const [service,instance,brand] of [
  ['_googlecast._tcp.local','Living Room Display._googlecast._tcp.local','Google Cast'],
  ['_airplay._tcp.local','Bedroom Apple TV._airplay._tcp.local','Apple AirPlay'],
  ['_androidtvremote2._tcp.local','Sony._androidtvremote2._tcp.local','Android TV']
 ]){
  const packet=ptrAnswer(service,instance);
  const r=f.recognizeMdns(packet);
  assert.equal(r?.brand,brand);
  assert.equal(r?.name,instance.split('._')[0]);
 }
 assert.deepEqual(f.mdnsRecords(Buffer.from('AAAA','utf8')),[]);
});
test('same device advertising both AirPlay and LG remains the supported saved LG',()=>{
 const r=f.mergeRows([
  {ip:'192.168.50.23',brand:'LG',name:'LG webOS TV',kind:'Smart TV',method:'SSDP'},
  {ip:'192.168.50.23',brand:'Apple AirPlay',name:'[LG] webOS TV OLED55CX6LA',kind:'AirPlay',method:'mDNS'},
  {ip:'192.168.50.149',brand:'DIAL',name:'DIAL device',kind:'Cast receiver',method:'SSDP'}
 ],fake);
 assert.equal(r.length,2);
 assert.equal(r[0].ip,'192.168.50.23');assert.equal(r[0].brand,'LG');
 assert.equal(r[0].current,true);assert.equal(r[0].connection,'Current supported LG TV');
 assert.deepEqual(r[0].methods,['SSDP','mDNS']);
 assert.equal(r[1].connection,'Discovered - connection not yet supported');
});
test('rejects cloud, another LAN, self, router network ID, and duplicate IPs',()=>{
 const rows=f.mergeRows([
  {ip:'8.8.8.8',brand:'Roku',name:'not local',method:'SSDP'},
  {ip:'192.168.9.4',brand:'LG',name:'other network',method:'SSDP'},
  {ip:'192.168.50.36',brand:'LG',name:'own laptop',method:'SSDP'},
  {ip:'192.168.50.0',brand:'LG',name:'subnet ID',method:'SSDP'},
  {ip:'192.168.50.88',brand:'Roku',name:'Roku TV',method:'SSDP'},
  {ip:'192.168.50.88',brand:'Roku',name:'Roku TV',method:'SSDP'}
 ],fake);
 assert.equal(rows.length,2);assert.equal(rows[0].ip,'192.168.50.23');assert.equal(rows[0].found,false);
 assert.equal(rows[1].ip,'192.168.50.88');
});
test('DNS compression loop rejected without crashing',()=>{
 const b=Buffer.alloc(30);b.writeUInt16BE(1,6);b[12]=0xc0;b[13]=12;
 assert.deepEqual(f.mdnsRecords(b),[]);
});

test('LG advertising AirPlay remains an LG before setup exists',()=>{
 const p=ptrAnswer('_airplay._tcp.local','[LG] webOS TV OLED55CX6LA._airplay._tcp.local');
 const hit=f.recognizeMdns(p);
 assert.equal(hit.brand,'LG');
 const before={network:fake.network,television:{ip:null,model:'OLED55CX6LA'}};
 const rows=f.mergeRows([{ip:'192.168.50.23',...hit}],before);
 assert.equal(rows.length,1);
 assert.equal(rows[0].brand,'LG');
 assert.equal(rows[0].found,true);
 assert.equal(rows[0].current,false);
 assert.match(rows[0].connection,/LG webOS found/);
});
test('LG and AirPlay on the same IP are deduplicated without saved config',()=>{
 const before={network:fake.network,television:{ip:null,model:'OLED55CX6LA'}};
 const rows=f.mergeRows([
  {ip:'192.168.50.23',brand:'LG',name:'LG webOS TV',kind:'Smart TV',method:'SSDP'},
  {ip:'192.168.50.23',brand:'Apple AirPlay',name:'[LG] webOS TV OLED55CX6LA',kind:'AirPlay',method:'mDNS'},
  {ip:'192.168.50.88',brand:'Samsung',name:'Samsung TV',kind:'Smart TV',method:'SSDP'}
 ],before);
 assert.equal(rows.length,2);
 assert.equal(rows.find(x=>x.ip==='192.168.50.23').brand,'LG');
 assert.equal(rows.find(x=>x.ip==='192.168.50.88').brand,'Samsung');
});
