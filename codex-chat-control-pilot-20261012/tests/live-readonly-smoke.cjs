'use strict';
// Live read-only integration smoke: initialize, thread/list, thread/read.
// No thread/resume, no turn/start, no UI input.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {CodexAppServer}=require('../codex-rpc.cjs');
const out=path.resolve(__dirname,'../evidence/live-readonly-smoke-20261012.json');
(async()=>{
 const client=new CodexAppServer({cwd:path.resolve(__dirname,'..')});
 let evidence={ranUtc:new Date().toISOString(),readOnly:true,methods:['initialize','thread/list','thread/read'],turnStarted:false};
 try{
  await client.connect();
  const r=await client.list({limit:20});
  evidence.listed=r.threads.length;evidence.more=!!r.more;
  if(r.threads.length){
   const t=r.threads[0], detail=await client.inspect(t.id);
   if(t.id!==detail.id)throw Error('Thread detail ID differs from list ID');
   const fingerprint=s=>crypto.createHash('sha256').update(s).digest('hex');
   evidence.inspect={idSha256:fingerprint(t.id),titleLength:detail.title.length,
    cwdPresent:!!detail.cwd,statusType:detail.status?.type||'unknown',
    sourcePresent:!!detail.source,sameAsList:detail.id===t.id};
  }
  evidence.ok=true;
 }catch(e){
  evidence.ok=false;evidence.error=String(e.message||e).slice(0,240);
  process.exitCode=1;
 }finally{
  client.close();
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
 }
})();
