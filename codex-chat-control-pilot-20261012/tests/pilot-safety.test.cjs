'use strict';
// All Codex transports in this suite are fakes. No real App Server turn is started.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const ledger=require('../draft-ledger.cjs');
const {dispatch}=require('../codex-dispatch.cjs');
const tid='019f1234-1234-7abc-9876-123456789abc';
const baseThread=()=>({id:tid,title:'PC Bridge disposable test thread',cwd:'D:\\PC-Bridge-Public-Demo\\codex-chat-control-pilot-20261012',source:{vscode:true},status:{type:'idle'}});
const generated=[];
function newDraft(text='harmless internal mock transport test'){
 const d=ledger.stage({thread:baseThread(),text});
 generated.push(d.id);return d;
}
function cleanup(){
 for(const id of generated.splice(0)) {
  for(const f of [id+'.json',id+'.json.lock']) {
   try{fs.unlinkSync(path.join(ledger.DIR,f))}catch(e){if(e.code!=='ENOENT')throw e}
  }
 }
}
test.afterEach(cleanup);
function approve(d){return ledger.approve(d.id,{threadId:d.threadId,digest:d.sha256,confirm:'SEND_THIS_EXACT_DRAFT'})}
function factory({thread=baseThread(),timeout=false,wrongEventThread=false,wrongEventTurn=false,status='completed',badResume=false,failAfterStart=false,missingReceipt=false}={}){
 const events={startCount:0,requests:[],closed:false};
 class FakeClient extends EventEmitter{
  async connect(){return this}
  async inspect(id){assert.equal(id,tid);return thread}
  async request(method,params){
   events.requests.push({method,params});
   if(method==='thread/resume')return {thread:{id:badResume?'019f1234-1234-7abc-9876-123456789999':tid}};
   if(method==='turn/start'){
    events.startCount++;
    if(failAfterStart)throw Error('simulated dropped connection after send');
    if(missingReceipt)return {turn:{}};
    if(!timeout)setImmediate(()=>this.emit('notification',{
     method:'turn/completed',
     params:{threadId:wrongEventThread?'019f1234-1234-7abc-9876-123456789998':tid,
      turn:{id:wrongEventTurn?'wrong-turn':'t_mock_001',status}}
    }));
    return{turn:{id:'t_mock_001',status:'inProgress'}};
   }
   throw Error('Unapproved method '+method);
  }
  close(){events.closed=true}
 }
 return {make:()=>new FakeClient(),events};
}
test('staging is durable, exact, and does not contact Codex',()=>{
 const d=newDraft('test 001');
 const r=ledger.review(d.id);
 assert.equal(r.text,'test 001');
 assert.equal(r.threadId,tid);
 assert.equal(r.sha256,ledger.sha('test 001'));
 assert.equal(r.state,'staged');
});
test('cannot dispatch an unapproved draft',async()=>{
 const d=newDraft();const m=factory();
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make}),/not approved/i);
 assert.equal(m.events.startCount,0);
});
test('wrong target, text hash or magic approval rejected',()=>{
 const d=newDraft();
 assert.throws(()=>ledger.approve(d.id,{threadId:tid,digest:d.sha256,confirm:'maybe'}),/approval/i);
 assert.throws(()=>ledger.approve(d.id,{threadId:'019f1234-1234-7abc-9876-123456789997',digest:d.sha256,confirm:'SEND_THIS_EXACT_DRAFT'}),/match/i);
 assert.throws(()=>ledger.approve(d.id,{threadId:tid,digest:'0'.repeat(64),confirm:'SEND_THIS_EXACT_DRAFT'}),/match/i);
 assert.equal(ledger.review(d.id).state,'staged');
});
test('expired stage or approval rejected before sending',()=>{
 const d=ledger.stage({thread:baseThread(),text:'clock test',now:Date.now()-3600000-2});
 generated.push(d.id);
 assert.throws(()=>ledger.approve(d.id,{threadId:tid,digest:d.sha256,confirm:'SEND_THIS_EXACT_DRAFT'}),/expired/i);
 const fresh=newDraft(); const t=Date.now();
 ledger.approve(fresh.id,{threadId:tid,digest:fresh.sha256,confirm:'SEND_THIS_EXACT_DRAFT',now:t-11*60*1000});
 assert.throws(()=>ledger.claim(fresh.id,{threadId:tid,digest:fresh.sha256,now:t}),/expired/i);
});
test('one approved message reaches only its immutable thread and completes once',async()=>{
 const d=newDraft('One simulated message, never sent externally');approve(d);const m=factory();
 const r=await dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make,timeoutMs:80});
 assert.equal(r.state,'completed');
 assert.equal(r.turnId,'t_mock_001');
 assert.equal(m.events.startCount,1);
 const start=m.events.requests.find(r=>r.method==='turn/start');
 assert.equal(start.params.threadId,tid);
 assert.deepEqual(start.params.input,[{type:'text',text:ledger.review(d.id).text}]);
 assert.equal(m.events.closed,true);
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make}),/not approved/i);
 assert.equal(m.events.startCount,1);
});
test('replacing target metadata after stage fails closed',async()=>{
 const d=newDraft();approve(d);const altered={...baseThread(),cwd:'D:\\DIFFERENT'};const m=factory({thread:altered});
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make}),/changed/i);
 assert.equal(ledger.read(d.id).state,'approved');assert.equal(m.events.startCount,0);
});
test('active or errored threads cannot start a new turn',async()=>{
 for(const type of ['active','systemError']){
  const d=newDraft();approve(d);const m=factory({thread:{...baseThread(),status:{type,activeFlags:[]}}});
  await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make}),/busy|status|active/i);
  assert.equal(m.events.startCount,0);
 }
});
test('wrong-thread completion event cannot close a draft',async()=>{
 const d=newDraft();approve(d);const m=factory({wrongEventThread:true});
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make,timeoutMs:25}),/unconfirmed|review/i);
 assert.equal(ledger.read(d.id).state,'needs_review');
 assert.equal(m.events.startCount,1);
});
test('wrong-turn completion event cannot close a draft',async()=>{
 const d=newDraft();approve(d);const m=factory({wrongEventTurn:true});
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make,timeoutMs:25}),/unconfirmed|review/i);
 assert.equal(ledger.read(d.id).state,'needs_review');
});
test('transport uncertainty is permanently marked needs_review, never resent',async()=>{
 const d=newDraft();approve(d);const m=factory({failAfterStart:true});
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make}),/dropped connection/i);
 assert.equal(m.events.startCount,1);
 assert.equal(ledger.read(d.id).state,'needs_review');
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make}),/not approved/i);
 assert.equal(m.events.startCount,1);
});
test('missing acceptance receipt cannot be mistaken for success',async()=>{
 const d=newDraft();approve(d);const m=factory({missingReceipt:true});
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make}),/receipt/i);
 assert.equal(ledger.read(d.id).state,'needs_review');
});
test('noncompleted Codex turn stays flagged for inspection',async()=>{
 const d=newDraft();approve(d);const m=factory({status:'failed'});
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make,timeoutMs:80}),/state failed/i);
 assert.equal(ledger.read(d.id).state,'needs_review');
});
test('different resumed ID stops before start',async()=>{
 const d=newDraft();approve(d);const m=factory({badResume:true});
 await assert.rejects(dispatch({id:d.id,threadId:tid,digest:d.sha256,clientFactory:m.make}),/different conversation/i);
 assert.equal(m.events.startCount,0);
 // No turn/start was issued, so approval was not consumed.
 assert.equal(ledger.read(d.id).state,'approved');
});
