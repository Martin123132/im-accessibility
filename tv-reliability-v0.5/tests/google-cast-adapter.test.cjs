'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const adapter=require('../adapters/google-cast.cjs');
const {createTransport}=require('../adapters/castv2-transport.cjs');

const now=Date.parse('2026-11-06T12:00:00.000Z');
const key='a'.repeat(64);
const origin='http://10.44.2.36:43198';
const device=Object.freeze({
  ip:'10.44.2.23',port:8009,brand:'Google Cast',
  protocol:'google-cast',methods:['mDNS'],name:'Test Chromecast'
});
const network=Object.freeze({name:'Home Ethernet',ip:'10.44.2.36',mask:'255.255.255.0'});
const viewerSession=Object.freeze({
  url:origin+'/tv/'+key,viewingMode:'until-stopped',
  createdAt:'2026-11-06T11:59:25.000Z',expiresAt:null
});
const sourceStatus=Object.freeze({sourceReady:true,qualityMode:'cinema',streamAgeMs:1800});
const playlist='#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA-SEQUENCE:5\n#EXTINF:2.0,\nsegment000005.ts\n#EXTINF:2.0,\nsegment000006.ts\n';
function requestHls(url){
  assert.equal(url,origin+'/media/'+key+'/index.m3u8');
  return Promise.resolve({
    ok:true,headers:{get:k=>k==='content-type'?'application/vnd.apple.mpegurl':null},
    text:async()=>playlist
  });
}
function args(override={}) {
  return {device,network,viewerSession,approved:true,sourceStatus,now,
    request:requestHls,transport:{load:async()=>({acknowledged:true,playerState:'BUFFERING'})},
    ...override};
}

test('requires owner approval and verified Google Cast mDNS discovery before a connection',()=>{
  assert.throws(()=>adapter.checkedSelection(args({approved:false})),/owner approval/);
  assert.throws(()=>adapter.checkedSelection(args({device:{...device,methods:['SSDP']}})),/Google Cast receiver/);
  assert.throws(()=>adapter.checkedSelection(args({device:{...device,brand:'Samsung'}})),/Google Cast receiver/);
  assert.throws(()=>adapter.checkedSelection(args({device:{...device,port:9000}})),/Google Cast receiver/);
});
test('rejects foreign subnet, public addresses, PC address and tampered viewer session',()=>{
  for(const ip of ['10.0.0.2','8.8.8.8',network.ip,'10.44.2.255'])
    assert.throws(()=>adapter.checkedSelection(args({device:{...device,ip}})),/private LAN/);
  for(const url of [
    'https://10.44.2.36:43198/tv/'+key,
    'http://10.44.2.37:43198/tv/'+key,
    origin+'/tv/'+'b'.repeat(63),
    origin+'/tv/'+key+'?user=x',
    origin+'/full/'+key
  ]) assert.throws(()=>adapter.checkedSelection(args({viewerSession:{...viewerSession,url}})),/viewer|capability/i);
});
test('rejects expired or unsigned-until-stopped sessions',()=>{
  assert.throws(()=>adapter.checkedSelection(args({
    viewerSession:{...viewerSession,viewingMode:'four-hour',expiresAt:null}
  })),/not active/);
  assert.throws(()=>adapter.checkedSelection(args({
    viewerSession:{...viewerSession,viewingMode:'four-hour',expiresAt:'2026-11-06T11:59:59Z'}
  })),/not active/);
  assert.throws(()=>adapter.checkedSelection(args({
    viewerSession:{...viewerSession,createdAt:'2026-11-07T00:00:00Z'}
  })),/creation time/);
});
test('plans existing guarded HLS stream with no new capture and no mouse control',()=>{
  const selected=adapter.checkedSelection(args());
  assert.equal(selected.host,device.ip);
  assert.equal(selected.port,8009);
  assert.equal(selected.media.contentId,origin+'/media/'+key+'/index.m3u8');
  assert.equal(selected.media.streamType,'LIVE');
  assert.equal(selected.media.contentType,'application/x-mpegurl');
  assert.equal(selected.media.hlsSegmentFormat,'TS');
  assert.equal(selected.media.hlsVideoSegmentFormat,'MPEG2-TS');
  assert.doesNotMatch(JSON.stringify(selected.media),/keyboard|mouse|controller/);
});
test('validates only relative bounded MPEGTS segments and HLS MIME',async()=>{
  assert.deepEqual(await adapter.checkPlaylist(origin+'/media/'+key+'/index.m3u8',
    {request:requestHls}),{playlistReady:true,segments:2});
  for(const malformed of [
    '#EXTM3U\n#EXTINF:2.0,\nhttp://evil.example/movie.ts\n',
    '#EXTM3U\n#EXTINF:2.0,\n../segment000005.ts\n',
    '#EXTM3U\n#EXTINF:2.0,\nsegment000005.mp4\n',
    '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128\n#EXTINF:2.0,\nsegment000005.ts\n'
  ]) await assert.rejects(adapter.checkPlaylist(origin,{
    request:async()=>({ok:true,headers:{get:()=> 'application/vnd.apple.mpegurl'},
                         text:async()=>malformed})
  }),/Unexpected|Unsupported/);
});
test('requests one CastV2 LOAD only after source and HLS are ready',async()=>{
  let touched=0;
  const r=await adapter.requestPlayback(args({
    transport:{load:async target=>{
      touched++;
      assert.equal(target.host,device.ip);
      assert.equal(target.media.contentId,origin+'/media/'+key+'/index.m3u8');
      return {acknowledged:true,playerState:'BUFFERING'};
    }}
  }));
  assert.equal(touched,1);
  assert.deepEqual(r,{adapter:'google-cast',stage:'load-acknowledged',
    deviceName:'Test Chromecast',playbackVerified:false,playerState:'BUFFERING'});
  assert.doesNotMatch(JSON.stringify(r),new RegExp(key));
});
test('refuses stale video, disapproved device, invalid media and unacknowledged receiver',async()=>{
  let loads=0,reads=0;
  const common=args({
    request:async u=>{reads++;return requestHls(u)},
    transport:{load:async()=>{loads++;return {acknowledged:false}}}
  });
  await assert.rejects(adapter.requestPlayback({...common,sourceStatus:{...sourceStatus,streamAgeMs:7000}}),/not ready/);
  await assert.rejects(adapter.requestPlayback({...common,approved:false}),/approval/);
  assert.equal(loads,0);
  assert.equal(reads,0);
  await assert.rejects(adapter.requestPlayback(common),/not acknowledged/);
  assert.equal(loads,1);
});

function mockClientModule({idle=false,failConnect=false,failLoad=false}={}){
  const calls=[];
  class FakeClient extends EventEmitter {
    constructor(){super();this.closed=false;calls.push('constructed')}
    connect(host,callback){calls.push(['connect',host]);setImmediate(()=>{
      if(failConnect){this.emit('error',Error('offline'));return;}
      callback();
    });}
    launch(Receiver,callback){calls.push('launch');setImmediate(()=>callback(null,{
      load(media,opt,finish){calls.push(['load',media.contentType,opt.autoplay]);
        setImmediate(()=>finish(failLoad?Error('media failed'):null,
          {playerState:idle?'IDLE':'BUFFERING'}));},
      stop(finish){calls.push('stop');setImmediate(()=>finish(null));}
    }));}
    close(){this.closed=true;calls.push('close')}
  }
  return {library:{Client:FakeClient,DefaultMediaReceiver:function Receiver(){}},calls};
}
test('CastV2 transport connects, launches Default Media Receiver and stops owned playback',async()=>{
  const {library,calls}=mockClientModule();
  const transport=createTransport({library,timeoutMs:2500,stopTimeoutMs:1000});
  const target=adapter.checkedSelection(args());
  const r=await transport.load(target);
  assert.equal(r.acknowledged,true);
  assert.equal(transport.state().connected,true);
  await assert.rejects(transport.load(target),/already owned/);
  const ended=await transport.stop();
  assert.deepEqual(ended,{stopped:true,reason:'owner-session-ended'});
  assert.equal(transport.state().connected,false);
  assert.deepEqual(calls.slice(0,4),['constructed',['connect',device.ip],'launch',
    ['load','application/x-mpegurl',true]]);
  assert.deepEqual(calls.slice(-2),['stop','close']);
});
test('CastV2 errors and IDLE status clean up the connection without claiming playback',async()=>{
  for(const flags of [{failConnect:true},{failLoad:true},{idle:true}]){
    const {library,calls}=mockClientModule(flags);
    const t=createTransport({library,timeoutMs:2500});
    await assert.rejects(t.load(adapter.checkedSelection(args())),/failed|declined/);
    assert.equal(t.state().connected,false);
    assert.ok(calls.includes('close'));
  }
});
test('transport failures cannot expose the temporary private media capability',async()=>{
  const sensitive='failed to load '+origin+'/media/'+key+'/index.m3u8';
  try{
    await adapter.requestPlayback(args({
      transport:{load:async()=>{throw Error(sensitive);}}
    }));
    assert.fail('Expected a sanitized Cast receiver failure');
  }catch(e){
    assert.match(e.message,/receiver did not accept/);
    assert.doesNotMatch(e.message,new RegExp(key));
    assert.doesNotMatch(e.message,/http:/);
  }
});

test('no Cast transport is loaded or used by normal LG modules',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const host=fs.readFileSync(path.join(__dirname,'..','resume-host.cjs'),'utf8');
  const lg=fs.readFileSync(path.join(__dirname,'..','lg-pair.cjs'),'utf8');
  const src=fs.readFileSync(path.join(__dirname,'..','adapters','google-cast.cjs'),'utf8');
  assert.doesNotMatch(host+lg,/require\(['"]\.\/adapters\/castv2/);
  assert.doesNotMatch(src,/\bexec\(|\bspawn\(|PowerShell|FlyStream/);
  assert.doesNotMatch(src,/SetForegroundWindow|SendInput|mouseClick|keyPress/);
});
