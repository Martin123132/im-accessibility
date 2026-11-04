'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const finder=require('./discover-setup.cjs');
const adapter={name:'Home Wi-Fi',ip:'10.44.2.10',mask:'255.255.255.0'};
const selection={adapterName:adapter.name,localIp:adapter.ip};
const adaptersFn=()=>[adapter];

function response(signature){
  return 'HTTP/1.1 200 OK\r\nSERVER: '+signature+'\r\nST: ssdp:all\r\n\r\n';
}
for(const [brand,signature] of [
  ['LG','LG webOS TV'],['Samsung','Samsung Tizen'],['Sony','Sony BRAVIA'],
  ['Roku','Roku ECP'],['Google Cast','Chromecast'],['Android TV','Android TV'],
  ['Amazon Fire TV','Amazon Fire TV'],['DLNA','MediaRenderer']
]){
  test('Discovers '+brand+' without claiming unimplemented casting',()=>{
    const r=finder.ssdpReply(response(signature));
    assert.equal(r?.brand,brand);
    if(brand!=='LG'){
      assert.equal(finder.capability(brand).adapter,null);
      assert.match(finder.capability(brand).status,/not yet supported/);
    }
  });
}

function dnsName(name){
  return Buffer.concat(name.split('.').map(label=>Buffer.concat([
    Buffer.from([Buffer.byteLength(label)]),Buffer.from(label)]))
    .concat([Buffer.from([0])]));
}
function mdnsPacket(service,instance){
  const host=dnsName(service),target=dnsName(instance+'.'+service);
  const packet=Buffer.alloc(12);
  packet.writeUInt16BE(1,6);
  const meta=Buffer.alloc(10);
  meta.writeUInt16BE(12,0);meta.writeUInt16BE(1,2);
  meta.writeUInt32BE(120,4);meta.writeUInt16BE(target.length,8);
  return Buffer.concat([packet,host,meta,target]);
}
test('Recognises Google Cast and AirPlay through mDNS without LG settings',()=>{
  for(const [service,brand] of [
    ['_googlecast._tcp.local','Google Cast'],
    ['_airplay._tcp.local','Apple AirPlay']
  ]){
    const r=finder.mdnsReply(mdnsPacket(service,'Living Room'));
    assert.equal(r?.brand,brand);
    assert.equal(r?.name,'Living Room');
    assert.equal(r?.method,'mDNS');
  }
});
test('Refuses malformed packets and an unverified PC adapter',()=>{
  assert.equal(finder.mdnsReply(Buffer.from([1,2])),null);
  assert.equal(finder.ssdpReply('NOTIFY * HTTP/1.1\r\nSERVER: Samsung'),null);
  assert.throws(()=>finder.adapter({adapterName:'Other',localIp:adapter.ip},{adaptersFn}));
  assert.equal(finder.validIp('8.8.8.8',adapter),false);
  assert.equal(finder.validIp(adapter.ip,adapter),false);
  assert.equal(finder.validIp('10.44.3.40',adapter),false);
  assert.equal(finder.validIp('10.44.2.40',adapter),true);
});
test('Merges duplicate device announcements; retains brand and honest capability',()=>{
  const list=finder.merge([
    {ip:'10.44.2.45',brand:'DIAL',protocol:'dial',name:'DIAL',method:'SSDP'},
    {ip:'10.44.2.45',brand:'Samsung',protocol:'samsung-tizen',name:'Samsung TV',method:'mDNS'},
    {ip:'10.44.2.46',brand:'LG',protocol:'lg-webos',name:'Bedroom LG',method:'SSDP'}
  ],adapter);
  assert.equal(list.length,2);
  assert.equal(list[1].brand,'Samsung');
  assert.deepEqual(list[1].methods,['SSDP','mDNS']);
  assert.equal(list[1].adapter,null);
  assert.equal(list[0].adapter,'lg-webos');
});

test('First run discovers without saved settings, connections or TV actions',async()=>{
  let sockets=0,closes=0;
  const socketFactory=()=>{
    sockets++;
    const socket=new EventEmitter();
    socket.bind=(port,ip,fn)=>{
      assert.equal(ip,adapter.ip);
      process.nextTick(()=>{
        fn();
        socket.emit('message',Buffer.from(response('Samsung Tizen')),
          {address:'10.44.2.60'});
        socket.emit('message',Buffer.from(response('Roku ECP')),
          {address:'192.168.12.8'});
      });
    };
    socket.send=()=>{};
    socket.setMulticastInterface=()=>{};
    socket.close=()=>{closes++;};
    return socket;
  };
  const result=await finder.scan(selection,{adaptersFn,durationMs:20,socketFactory});
  assert.equal(result.ok,true);
  assert.equal(result.readOnly,true);
  assert.equal(result.count,1);
  assert.equal(result.devices[0].brand,'Samsung');
  assert.equal(result.devices[0].adapter,null);
  assert.equal(sockets,2);
  assert.equal(closes,2);
});
