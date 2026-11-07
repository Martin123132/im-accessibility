'use strict';
// Pure, bounded encoder fallback policy. No TV/Windows process/filesystem effects.
// Media Foundation may either exit before creating the initial HLS playlist or
// stay alive without producing a first segment. Both cases can select OpenH264.
// Never switch codecs for a user stop, a quality change or an audio failure.
const MF='h264_mf',OPEN='libopenh264';
const STARTUP_GRACE_MS=14000;
function base(v){
  return !!v&&v.encoder===MF&&v.alreadyUsed===false&&
    v.ownerStopped===false&&v.pendingRestart===false&&
    v.recoveryTried!==true&&v.hadManifest===false&&
    Number.isFinite(v.sinceStartMs)&&v.sinceStartMs>=0;
}
function afterEarlyExit(v){
  return base(v)&&v.spawnError!==true&&v.sinceStartMs<=STARTUP_GRACE_MS&&
    Number.isInteger(v.exitCode)&&v.exitCode!==0&&
    (v.signal===null||v.signal===undefined);
}
function afterMissingPlaylist(v){
  return base(v)&&v.captureAlive===true&&
    v.sinceStartMs>STARTUP_GRACE_MS;
}
function next(v,reason){
  if(!['early-exit','missing-playlist'].includes(reason))throw Error('Unrecognised encoder failure');
  const switchIt=reason==='early-exit'?afterEarlyExit(v):afterMissingPlaylist(v);
  return Object.freeze({
    switchIt,
    encoder:switchIt?OPEN:v?.encoder,
    reason:switchIt?(reason==='early-exit'?
      'Media Foundation did not start HLS; retrying with OpenH264':
      'Media Foundation produced no HLS playlist; retrying with OpenH264'):null
  });
}
module.exports={MF,OPEN,STARTUP_GRACE_MS,afterEarlyExit,afterMissingPlaylist,next};
