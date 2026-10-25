'use strict';
// Owner-confirmed, configured TV sessions keep video running until explicit
// Stop, a critical child failure or PC shutdown. Private credentials are
// recreated for each Start; Windows mouse input still needs a fresh 10-minute
// approval and is revoked on disconnect or loss of live video.
// Historical/unconfigured source fixtures retain their four-hour policy.
const LEGACY_MAX_MS=4*60*60*1000;
const MOUSE_LEASE_MS=10*60*1000;
const MODE=process.env.IM_ACCESSIBILITY_CONFIG_PATH!==undefined
 ?'until-stopped':'four-hour';
function maxMs(){return MODE==='until-stopped'?null:LEGACY_MAX_MS}
function deadline(start){return MODE==='until-stopped'?null:start+LEGACY_MAX_MS}
function iso(deadlineMs){return deadlineMs===null?null:new Date(deadlineMs).toISOString()}
function active(deadlineMs,now=Date.now()){
 return deadlineMs===null||(Number.isFinite(deadlineMs)&&now<deadlineMs);
}
function recordValid(record,now=Date.now()){
 if(!record||typeof record!=='object'||Array.isArray(record))return false;
 if(MODE==='until-stopped')
  return record.viewingMode==='until-stopped'&&record.expiresAt===null;
 if(record.viewingMode!==undefined&&record.viewingMode!=='four-hour')return false;
 const end=Date.parse(record.expiresAt);
 return Number.isFinite(end)&&now<end&&end-now<=LEGACY_MAX_MS;
}
module.exports={MODE,LEGACY_MAX_MS,MOUSE_LEASE_MS,maxMs,deadline,iso,active,recordValid};
