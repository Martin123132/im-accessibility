'use strict';
// One-shot, exact-thread Codex message dispatch.
// Must be called only after a separate, explicit owner approval.
// Important: app-server turn/start starts the agent immediately; it is NOT a UI draft.
const ledger=require('./draft-ledger.cjs');
const {CodexAppServer}=require('./codex-rpc.cjs');
const MAX_WAIT_MS=4*60*1000;
async function dispatch({id,threadId,digest,clientFactory=()=>new CodexAppServer(),timeoutMs=MAX_WAIT_MS}){
 const preview=ledger.read(id);
 if(preview.state!=='approved')throw Error('Owner has not approved this exact draft');
 if(preview.threadId!==threadId||preview.sha256!==digest)throw Error('Target or text digest does not match');
 const client=clientFactory();let claimed=false,turnId=null,complete=null;
 try{
  await client.connect();
  const current=await client.inspect(threadId);
  if(ledger.fingerprint(current)!==preview.targetFingerprint)throw Error('Conversation changed since drafting; select and review it again');
  // Only Codex's schema-defined idle and notLoaded statuses permit a new turn.
  // systemError, active, missing and unfamiliar statuses all fail closed.
  if(!['idle','notLoaded'].includes(current.status?.type))throw Error('Target conversation status prevents safe send');
  const resumed=await client.request('thread/resume',{threadId},18000);
  if(resumed?.thread?.id!==threadId)throw Error('Codex resumed a different conversation');
  // Recheck target after resume; this is a pre-send guard, not proof of app UI selection.
  const immediatelyBeforeSend=await client.inspect(threadId);
  if(ledger.fingerprint(immediatelyBeforeSend)!==preview.targetFingerprint)throw Error('Target changed during resume; review a new draft');
  if(immediatelyBeforeSend.status?.type!=='idle')throw Error('Target conversation status not idle after resume');
  // Commit BEFORE turn/start. If the connection drops in-flight, never retry.
  const d=ledger.claim(id,{threadId,digest});claimed=true;
  const completions=new Map();
  let callback=null;
  const listener=event=>{
   if(event.method!=='turn/completed')return;
   const p=event.params||{},idTurn=p.turn?.id||p.turnId||null;
   if(p.threadId!==threadId||typeof idTurn!=='string')return;
   completions.set(idTurn,p);
   if(callback&&idTurn===turnId)callback(p);
  };
  client.on('notification',listener);
  const response=await client.request('turn/start',{
   threadId,input:[{type:'text',text:d.text}]
  },30000);
  turnId=response?.turn?.id;
  if(typeof turnId!=='string'||!turnId)throw Error('Codex did not return a turn receipt');
  ledger.settle(id,{state:'accepted',turnId,reason:'Codex turn/start accepted'});
  complete=await new Promise((resolve,reject)=>{
   let finished=false;
   const timeout=setTimeout(()=>{if(!finished){finished=true;reject(Error('Codex turn completion unconfirmed; manual review required'))}},timeoutMs);
   const done=value=>{if(finished)return;finished=true;clearTimeout(timeout);resolve(value)};
   callback=done;
   if(completions.has(turnId))done(completions.get(turnId));
  });
  client.removeListener('notification',listener);
  const state=String(complete?.turn?.status||complete?.status||'unknown');
  if(state!=='completed')throw Error('Codex turn ended in state '+state+'; manual review required');
  return ledger.settle(id,{state:'completed',turnId,reason:'Codex completion receipt verified'});
 }catch(e){
  if(claimed){
   try{ledger.settle(id,{state:'needs_review',turnId,reason:String(e.message||e).slice(0,220)})}catch{}
  }
  throw e;
 }finally{try{client.close()}catch{}}
}
module.exports={dispatch,MAX_WAIT_MS};
