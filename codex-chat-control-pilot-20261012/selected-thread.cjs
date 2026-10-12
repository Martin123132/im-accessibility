'use strict';
// Exact-thread selection recorded only after the owner chooses it in the local Desk.
// Selection does NOT represent or alter the foreground Codex app window.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ledger=require('./draft-ledger.cjs');
const runtime=path.join(__dirname,'runtime');
const FILE=path.join(runtime,'selected-thread.json');
const HISTORY=path.join(runtime,'selection-history.jsonl');
const MAX_AGE_MS=30*60*1000;
const isId=s=>typeof s==='string'&&/^[a-f0-9-]{20,80}$/i.test(s);
function atomicWrite(file,obj){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const tmp=file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify(obj,null,2)+'\n',{flag:'wx',mode:0o600});
 try{fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{}throw e}
}
function select(thread,{now=Date.now()}={}){
 if(!thread||!isId(thread.id)||typeof thread.title!=='string'||thread.title.length>160)
  throw Error('Exact thread metadata required for user selection');
 if(!Number.isFinite(now)||now<0)throw Error('Invalid selection time');
 const record={schema:1,chosenBy:'owner_in_local_desk',threadId:thread.id,
  title:thread.title,cwd:thread.cwd||null,source:thread.source||null,
  targetFingerprint:ledger.fingerprint(thread),
  selectedUtc:new Date(now).toISOString(),expiresUtc:new Date(now+MAX_AGE_MS).toISOString()};
 atomicWrite(FILE,record);
 fs.appendFileSync(HISTORY,JSON.stringify({event:'selected',atUtc:record.selectedUtc,idSha256:ledger.sha(record.threadId),fingerprint:record.targetFingerprint})+'\n');
 return record;
}
function selected({now=Date.now()}={}){
 if(!fs.existsSync(FILE))throw Error('No conversation has been selected in the Desk');
 const o=JSON.parse(fs.readFileSync(FILE,'utf8'));
 if(o.schema!==1||o.chosenBy!=='owner_in_local_desk'||!isId(o.threadId)||
    typeof o.title!=='string'||o.title.length>160||
    typeof o.targetFingerprint!=='string')throw Error('Selected-thread record is invalid');
 if(now>=Date.parse(o.expiresUtc)||!Number.isFinite(Date.parse(o.expiresUtc)))
  throw Error('Conversation selection expired: choose it again');
 const proof=ledger.fingerprint({id:o.threadId,title:o.title,cwd:o.cwd,source:o.source});
 if(proof!==o.targetFingerprint)throw Error('Selected-thread file tampered or corrupted');
 return o;
}
function verifyLive(record,live){
 if(!live||live.id!==record.threadId)throw Error('Selected conversation ID mismatch');
 if(ledger.fingerprint(live)!==record.targetFingerprint)
  throw Error('Selected conversation metadata changed: choose it again');
 return true;
}
function clear(){
 try{fs.unlinkSync(FILE)}catch(e){if(e.code!=='ENOENT')throw e}
 fs.appendFileSync(HISTORY,JSON.stringify({event:'cleared',atUtc:new Date().toISOString()})+'\n');
}
module.exports={select,selected,verifyLive,clear,FILE,MAX_AGE_MS};
