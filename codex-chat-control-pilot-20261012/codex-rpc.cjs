'use strict';
// Narrow, local, version-pinned Codex App Server client.
// Does not create a Codex turn unless the caller explicitly invokes turn/start.
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const {EventEmitter}=require('node:events');
const CODEX_EXE=process.env.PC_BRIDGE_CODEX_EXE||'codex';
const ALLOWED=new Set(['initialize','thread/list','thread/loaded/list','thread/read','thread/resume','turn/start']);
const MAX_LINE=4*1024*1024;
class CodexAppServer extends EventEmitter{
 constructor({executable=CODEX_EXE,cwd=process.cwd(),spawnFn=spawn}={}){
  super();this.executable=executable;this.cwd=cwd;this.spawnFn=spawnFn;
  this.process=null;this.readline=null;this.pending=new Map();this.nextId=1;
  this.errors='';this.closed=false;this.ready=false;
 }
 send(obj){
  if(this.closed||!this.process?.stdin?.writable)throw Error('Codex transport is closed');
  this.process.stdin.write(JSON.stringify(obj)+'\n');
 }
 request(method,params={},timeoutMs=10000){
  if(!ALLOWED.has(method))throw Error('Method not allowed by the PC Bridge pilot: '+method);
  if(this.closed)throw Error('Codex session closed');
  const id=this.nextId++;
  return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{this.pending.delete(id);reject(Error('Codex '+method+' request timed out'))},timeoutMs);
   this.pending.set(id,{resolve,reject,timeout,method});
   try{this.send({id,method,params})}catch(e){clearTimeout(timeout);this.pending.delete(id);reject(e)}
  });
 }
 onLine(line){
  if(line.length>MAX_LINE){this.failAll(Error('Oversized Codex event'));return}
  let msg;try{msg=JSON.parse(line)}catch{return}
  if(typeof msg.id==='number'){
   const r=this.pending.get(msg.id);if(!r)return;
   this.pending.delete(msg.id);clearTimeout(r.timeout);
   if(msg.error)r.reject(Error('Codex '+r.method+': '+String(msg.error.message||msg.error).slice(0,350)));
   else r.resolve(msg.result??{});
  }else if(typeof msg.method==='string'){
   // Never print raw events, which can include user conversations or agent data.
   this.emit('notification',{method:msg.method,params:msg.params??{}});
  }
 }
 failAll(error){for(const p of this.pending.values()){clearTimeout(p.timeout);p.reject(error)}this.pending.clear()}
 async connect(){
  if(this.ready)return this;
  if(this.process)throw Error('Connection in progress');
  this.process=this.spawnFn(this.executable,['app-server','--stdio'],{
   cwd:this.cwd,stdio:['pipe','pipe','pipe'],windowsHide:true
  });
  this.readline=readline.createInterface({input:this.process.stdout});
  this.readline.on('line',line=>this.onLine(line));
  this.process.stderr.on('data',b=>{this.errors=(this.errors+String(b)).slice(-500)});
  this.process.once('error',e=>{this.failAll(e);this.emit('fatal',String(e.message).slice(0,150))});
  this.process.once('exit',(code)=>{if(!this.closed){this.failAll(Error('Codex app server exited '+code));this.closed=true;}});
  try{
   await this.request('initialize',{clientInfo:{name:'pc_bridge_codex_desk',title:'PC Bridge Codex Completion Desk',version:'0.1.0'}},12000);
   this.send({method:'initialized',params:{}});
   this.ready=true;return this;
  }catch(e){this.close();throw e}
 }
 async list({limit=20,searchTerm}={}){
  if(!this.ready)throw Error('Connect before listing threads');
  if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('Invalid thread list size');
  const params={limit,sortKey:'updated_at',sortDirection:'desc'};
  if(searchTerm!==undefined){
   if(typeof searchTerm!=='string'||searchTerm.length>120)throw Error('Invalid search');
   params.searchTerm=searchTerm;
  }
  const result=await this.request('thread/list',params,16000);
  const data=Array.isArray(result.data)?result.data:[];
  // Return only stable metadata for the *human to confirm*. Never choose newest automatically.
  return{threads:data.map(x=>({
   id:String(x.id||''),title:String(x.name||x.title||x.preview||'Untitled').slice(0,160),
   cwd:typeof x.cwd==='string'?x.cwd:null,source:x.source??null,
   updatedAt:x.updatedAt??null,status:x.status??null
  })).filter(x=>/^[a-f0-9-]{20,80}$/i.test(x.id)),
  more:!!result.nextCursor};
 }
 async inspect(threadId){
  if(!/^[a-f0-9-]{20,80}$/i.test(threadId))throw Error('Thread ID must be a real persistent identifier');
  const result=await this.request('thread/read',{threadId,includeTurns:false},12000);
  const thread=result.thread;
  if(!thread||thread.id!==threadId)throw Error('Codex did not confirm the selected thread');
  return{
   id:thread.id,title:String(thread.name||thread.title||thread.preview||'Untitled').slice(0,160),
   cwd:typeof thread.cwd==='string'?thread.cwd:null,source:thread.source??null,
   status:thread.status??null,updatedAt:thread.updatedAt??null
  };
 }
 async loadedThreadCount(){
  const r=await this.request('thread/loaded/list',{},8000);
  return Array.isArray(r.data)?r.data.length:0;
 }
 close(){
  if(this.closed)return;
  this.closed=true;this.ready=false;
  this.failAll(Error('Codex pilot client closed'));
  try{this.readline?.close()}catch{}
  try{this.process?.stdin?.end()}catch{}
  try{this.process?.kill('SIGTERM')}catch{}
 }
}
module.exports={CodexAppServer,CODEX_EXE};
