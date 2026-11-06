'use strict';
// Experimental Google Cast DEFAULT MEDIA RECEIVER adapter, never enabled on Start TV.
// No desktop capture, Windows mouse/keyboard access, LG pairing or service registration.
// A selected device must be discovered on the owner's chosen LAN and explicitly approved.
// A Cast LOAD acknowledgment is NOT proof of visible playback.
// Physical Cast HLS/CORS compatibility and Cast receiver authentication remain unverified.
const conf=require('../release-config.cjs');

const VIEWER_PORT=43198;
const MAX_HLS_BYTES=32768;

function checkedSelection({device,network,viewerSession,approved,now=Date.now()}){
  if(approved!==true)throw Error('Explicit owner approval for this Cast device required');
  if(!network||typeof network!=='object'||!conf.isPrivate(network.ip)||
     !conf.isPrivate(device?.ip)||
     conf.maskBits(network.mask)===null ||
     !conf.subnet(device.ip,network.ip,network.mask)||
     !conf.usableHost(device.ip,network.mask)||device.ip===network.ip)
    throw Error('Cast receiver is not on the owner-selected private LAN');
  if(!device||device.protocol!=='google-cast'||device.brand!=='Google Cast'||
     !Array.isArray(device.methods)||!device.methods.includes('mDNS')||
     (device.port!==undefined&&device.port!==8009))
    throw Error('Device has not been identified as a Google Cast receiver');
  if(!viewerSession||typeof viewerSession!=='object'||Array.isArray(viewerSession)||
     typeof viewerSession.url!=='string')throw Error('Current private viewer session required');
  const created=Date.parse(viewerSession.createdAt);
  if(!Number.isFinite(created)||created>now+5000)throw Error('Invalid viewer creation time');
  const activeOwner=viewerSession.viewingMode==='until-stopped'&&viewerSession.expiresAt===null;
  const expires=Date.parse(viewerSession.expiresAt);
  const activeLegacy=viewerSession.viewingMode==='four-hour'&&Number.isFinite(expires)&&
    now<expires&&expires-now<=4*60*60*1000;
  if(!activeOwner&&!activeLegacy)throw Error('Viewer session is not active');
  let u;
  try{u=new URL(viewerSession.url)}catch{throw Error('Malformed owner viewer session')}
  const origin='http://'+network.ip+':'+VIEWER_PORT;
  if(u.origin!==origin||u.search||u.hash||
     !/^\/tv\/[a-f0-9]{64}$/.test(u.pathname))
    throw Error('Viewer capability origin or token mismatch');
  const token=u.pathname.slice(4);
  const mediaUrl=origin+'/media/'+token+'/index.m3u8';
  const media=Object.freeze({
    contentId:mediaUrl,
    contentType:'application/x-mpegurl',
    streamType:'LIVE',
    duration:-1,
    hlsSegmentFormat:'TS',
    hlsVideoSegmentFormat:'MPEG2-TS',
    metadata:Object.freeze({metadataType:0,title:"I'm Accessibility — Windows desktop"})
  });
  return Object.freeze({host:device.ip,port:8009,media,
    // Never expose the temporary capability through ordinary status or logs.
    capabilityRedacted:'[private viewer capability]'});
}

async function checkPlaylist(mediaUrl,{request=fetch,timeoutMs=2500}={}){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<250||timeoutMs>8000)
    throw Error('Invalid local stream verification budget');
  const response=await request(mediaUrl,{
    method:'GET',cache:'no-store',redirect:'error',
    signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response||!response.ok)throw Error('Current HLS source is not ready');
  const type=response.headers?.get?.('content-type')||'';
  if(!/^(?:application\/(?:vnd\.apple\.mpegurl|x-mpegurl)|audio\/mpegurl)(?:;|$)/i.test(type))
    throw Error('Desktop media source is not HLS');
  const playlist=await response.text();
  if(typeof playlist!=='string'||playlist.length>MAX_HLS_BYTES||
     !playlist.startsWith('#EXTM3U')||!playlist.includes('#EXTINF:'))
    throw Error('Invalid or empty desktop HLS playlist');
  let found=0;
  for(const line of playlist.split(/\r?\n/)){
    const item=line.trim();
    if(!item||item.startsWith('#'))continue;
    if(!/^segment\d{6}\.ts$/.test(item))
      throw Error('Unexpected external or unsupported playlist segment');
    found++;
  }
  if(!found||found>64||playlist.includes('#EXT-X-KEY:'))
    throw Error('Unsupported stream encryption or playlist contents');
  return Object.freeze({playlistReady:true,segments:found});
}

async function requestPlayback({device,network,viewerSession,approved,sourceStatus,
                                 transport,request=fetch,now=Date.now()}={}){
  const target=checkedSelection({device,network,viewerSession,approved,now});
  if(!sourceStatus||sourceStatus.sourceReady!==true||
     sourceStatus.qualityMode!=='cinema'||
     !Number.isFinite(sourceStatus.streamAgeMs)||
     sourceStatus.streamAgeMs<0||sourceStatus.streamAgeMs>5000)
    throw Error('Live Cinema source not ready; receiver not contacted');
  if(!transport||typeof transport.load!=='function')
    throw Error('Explicit Google Cast transport required');
  await checkPlaylist(target.media.contentId,{request});
  // A transport must implement a bounded CastV2 launch/LOAD, not generic URL open.
  // Third-party transport errors can contain full media URLs. Never surface them.
  let result;
  try{
    result=await transport.load({host:target.host,port:target.port,media:target.media});
  }catch{
    throw Error('Google Cast receiver did not accept the private stream');
  }
  if(!result||result.acknowledged!==true)
    throw Error('Google Cast LOAD not acknowledged');
  return Object.freeze({
    adapter:'google-cast',stage:'load-acknowledged',
    deviceName:device.name||'Google Cast device',
    playbackVerified:false, // Requires the actual receiver screen and device status.
    playerState:typeof result.playerState==='string'?
      result.playerState.slice(0,24):'unconfirmed'
  });
}

module.exports={VIEWER_PORT,checkedSelection,checkPlaylist,requestPlayback};
