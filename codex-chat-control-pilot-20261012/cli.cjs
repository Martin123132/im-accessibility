'use strict';
// PC Bridge Codex Completion Desk: list, inspect, stage, review, approve, send.
// No implicit selection of "most recent" or "currently open" thread.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const choice=require('./selected-thread.cjs');
const {CodexAppServer}=require('./codex-rpc.cjs');
const ledger=require('./draft-ledger.cjs');
const {dispatch}=require('./codex-dispatch.cjs');
const command=process.argv[2]||'help';
async function withClient(callback){
 const client=new CodexAppServer({cwd:process.cwd()});
 try{await client.connect();return await callback(client)}finally{client.close()}
}
function fail(msg){throw Error(msg)}
async function main(){
 if(command==='help'){
  console.log(JSON.stringify({commands:['list [title filter]','inspect THREAD_ID','stage THREAD_ID (text from stdin)','selected','stage-selected-file INPUT_NAME.txt','review DRAFT_ID','approve DRAFT_ID THREAD_ID SHA256 SEND_THIS_EXACT_DRAFT','status DRAFT_ID','send DRAFT_ID THREAD_ID SHA256'],note:'Stage never sends. Approve is separate. Send requires the exact prior approval and an explicit owner instruction. Each failed/uncertain dispatch is not automatically retried.'}));
  return;
 }
 if(command==='list'){
  const filter=process.argv.slice(3).join(' ').trim();
  const result=await withClient(c=>c.list({limit:20,...(filter?{searchTerm:filter}:{})}));
  console.log(JSON.stringify(result,null,2));return;
 }
 if(command==='inspect'){
  const id=process.argv[3];if(!id)fail('Thread ID required');
  console.log(JSON.stringify(await withClient(c=>c.inspect(id)),null,2));return;
 }
 if(command==='selected'){
  const record=choice.selected();
  console.log(JSON.stringify({selected:true,threadId:record.threadId,title:record.title,
   cwd:record.cwd,expiresUtc:record.expiresUtc,method:record.chosenBy},null,2));return;
 }
 if(command==='stage-selected-file'){
  const name=process.argv[3];
  if(typeof name!=='string'||!/^[A-Za-z0-9_-]{1,72}\.txt$/.test(name))
   fail('An exact .txt filename under runtime/incoming is required');
  const inputFile=path.join(__dirname,'runtime','incoming',name);
  const text=fs.readFileSync(inputFile,'utf8');
  if(Buffer.byteLength(text,'utf8')>12000)fail('Input exceeds 12KB');
  const record=choice.selected();
  const live=await withClient(c=>c.inspect(record.threadId));
  choice.verifyLive(record,live);
  const result=ledger.stage({thread:live,text});
  const pointer={draftId:result.id,threadId:record.threadId,stageUtc:new Date().toISOString()};
  const f=path.join(__dirname,'runtime','latest-draft.json'),tmp=f+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(pointer,null,2)+'\n',{flag:'wx',mode:0o600});
  fs.renameSync(tmp,f);
  console.log(JSON.stringify({...result,note:'EXACT SELECTED THREAD; LOCAL REVIEW DRAFT ONLY, NOT SENT'},null,2));return;
 }
 if(command==='stage'){
  const threadId=process.argv[3];if(!threadId)fail('Exact thread ID required');
  const text=fs.readFileSync(0,'utf8');if(Buffer.byteLength(text,'utf8')>12000)fail('Input exceeds 12KB');
  const thread=await withClient(c=>c.inspect(threadId));
  const result=ledger.stage({thread,text});
  console.log(JSON.stringify({...result,note:'LOCAL DRAFT ONLY. Not sent to Codex.'},null,2));return;
 }
 if(command==='review'){
  console.log(JSON.stringify(ledger.review(process.argv[3]),null,2));return;
 }
 if(command==='status'){
  console.log(JSON.stringify(ledger.summarize(ledger.read(process.argv[3])),null,2));return;
 }
 if(command==='approve'){
  const [id,threadId,digest,confirm]=process.argv.slice(3);
  if(!id||!threadId||!digest)fail('Draft ID, exact thread ID and text fingerprint required');
  const receipt=ledger.approve(id,{threadId,digest,confirm});
  console.log(JSON.stringify({...receipt,note:'Owner approval registered locally. No Codex turn started yet.'},null,2));return;
 }
 if(command==='send'){
  if(process.env.PC_BRIDGE_CODEX_SEND!=='OWNER_CONFIRMED_EXACT_MESSAGE')fail('Live submission requires a separate explicit owner-confirmation gate');
  const [id,threadId,digest]=process.argv.slice(3);
  if(!id||!threadId||!digest)fail('Draft ID, thread ID and SHA256 required');
  const result=await dispatch({id,threadId,digest});
  console.log(JSON.stringify({...result,note:'Codex accepted and completed the single approved turn.'},null,2));return;
 }
 fail('Unsupported Codex control command: '+command);
}
main().catch(e=>{console.error('PC_BRIDGE_CODEX_DESK_ERROR '+String(e.message||e).slice(0,240));process.exitCode=1});
