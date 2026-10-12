'use strict';
// Durable staging / one-time approval ledger. Does not call Codex or spawn a model.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=__dirname,DIR=path.join(ROOT,'runtime','drafts');
fs.mkdirSync(DIR,{recursive:true});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const validId=x=>typeof x==='string'&&/^cx_[a-f0-9]{24}$/.test(x);
const validThread=x=>typeof x==='string'&&/^[a-f0-9-]{20,80}$/i.test(x);
function fileOf(id){if(!validId(id))throw Error('Invalid draft identifier');return path.join(DIR,id+'.json')}
function read(id){
 const file=fileOf(id);
 if(!fs.existsSync(file))throw Error('Draft not found');
 const obj=JSON.parse(fs.readFileSync(file,'utf8'));
 if(obj.id!==id||!validThread(obj.threadId))throw Error('Draft metadata corrupted');
 return obj;
}
function atomic(id,draft,{create=false}={}){
 const file=fileOf(id);
 if(create&&fs.existsSync(file))throw Error('Draft ID already exists');
 const next=file+'.'+crypto.randomBytes(5).toString('hex')+'.tmp';
 fs.writeFileSync(next,JSON.stringify(draft,null,2)+'\n',{mode:0o600,flag:'wx'});
 try{fs.renameSync(next,file)}catch(e){try{fs.unlinkSync(next)}catch{}throw e}
}
function locked(id,operation){
 const file=fileOf(id),lock=file+'.lock';
 const fd=fs.openSync(lock,'wx',0o600);
 try{return operation()}
 finally{try{fs.closeSync(fd)}catch{}try{fs.unlinkSync(lock)}catch{}}
}
function fingerprint(meta){
 return sha(JSON.stringify([meta.id,meta.title||'',meta.cwd||'',meta.source||null]));
}
function stage({thread,text,now=Date.now()}){
 if(!thread||!validThread(thread.id)||typeof text!=='string')throw Error('Exact thread ID and text required');
 if(text.length<1||Buffer.byteLength(text,'utf8')>12000||!text.trim())throw Error('Draft must contain 1–12000 bytes of nonblank text');
 if(typeof thread.title!=='string'||thread.title.length>160)throw Error('Thread title validation required');
 const id='cx_'+crypto.randomBytes(12).toString('hex');
 const d={schema:1,id,threadId:thread.id,threadTitle:thread.title,threadCwd:thread.cwd||null,threadSource:thread.source||null,
  targetFingerprint:fingerprint(thread),text,sha256:sha(text),bytes:Buffer.byteLength(text,'utf8'),
  state:'staged',createdUtc:new Date(now).toISOString(),expiresUtc:new Date(now+60*60*1000).toISOString(),
  approvedUtc:null,approvalExpiresUtc:null,dispatchStartedUtc:null,turnId:null,outcome:null};
 atomic(id,d,{create:true});
 return summarize(d);
}
function summarize(d){return{id:d.id,threadId:d.threadId,threadTitle:d.threadTitle,cwd:d.threadCwd,
 sha256:d.sha256,bytes:d.bytes,state:d.state,createdUtc:d.createdUtc,expiresUtc:d.expiresUtc,
 approvalExpiresUtc:d.approvalExpiresUtc,turnId:d.turnId,outcome:d.outcome};}
function review(id){const d=read(id);return{...summarize(d),text:d.text}}
function approve(id,{threadId,digest,confirm,now=Date.now()}){
 if(confirm!=='SEND_THIS_EXACT_DRAFT')throw Error('Exact explicit approval required');
 return locked(id,()=>{
  const d=read(id);
  if(d.state!=='staged')throw Error('Draft is not awaiting first approval');
  if(now>=Date.parse(d.expiresUtc))throw Error('Draft expired; stage again');
  if(threadId!==d.threadId||digest!==d.sha256)throw Error('Approval does not match exact thread and text');
  d.state='approved';d.approvedUtc=new Date(now).toISOString();
  d.approvalExpiresUtc=new Date(Math.min(Date.parse(d.expiresUtc),now+10*60*1000)).toISOString();
  atomic(id,d);return summarize(d);
 });
}
function claim(id,{threadId,digest,now=Date.now()}){
 return locked(id,()=>{
  const d=read(id);
  if(d.state!=='approved')throw Error('Dispatch not approved or already attempted; never resend automatically');
  if(now>=Date.parse(d.approvalExpiresUtc)||now>=Date.parse(d.expiresUtc))throw Error('Approval expired');
  if(d.threadId!==threadId||d.sha256!==digest||sha(d.text)!==digest)throw Error('Dispatch target/text hash mismatch');
  d.state='dispatching';d.dispatchStartedUtc=new Date(now).toISOString();
  atomic(id,d);return d;
 });
}
function settle(id,{state,turnId=null,reason=null,now=Date.now()}){
 if(!['accepted','completed','needs_review'].includes(state))throw Error('Invalid terminal or tracked status');
 return locked(id,()=>{
  const d=read(id);
  if(!['dispatching','accepted'].includes(d.state))throw Error('Draft was not dispatched');
  d.state=state;
  if(turnId!==null){if(typeof turnId!=='string'||turnId.length>150)throw Error('Invalid turn receipt');d.turnId=turnId}
  d.outcome={atUtc:new Date(now).toISOString(),reason:reason?String(reason).slice(0,250):null};
  atomic(id,d);return summarize(d);
 });
}
module.exports={stage,review,approve,claim,settle,read,summarize,fingerprint,sha,DIR};
