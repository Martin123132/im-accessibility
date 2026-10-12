'use strict';
// Loopback-only conversation picker and draft reviewer. NO send, resume, approval or turn/start routes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {URL,URLSearchParams}=require('node:url');
const {CodexAppServer}=require('./codex-rpc.cjs');
const choice=require('./selected-thread.cjs'),ledger=require('./draft-ledger.cjs');
const PORT=Number(process.env.PC_BRIDGE_CODEX_DESK_PORT||43191),HOST='127.0.0.1',ORIGIN='http://'+HOST+':'+PORT;
const csrf=crypto.randomBytes(28).toString('hex'),latestFile=path.join(__dirname,'runtime','latest-draft.json');
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const styles='*{box-sizing:border-box}body{margin:0;background:#101824;color:#f0f4fc;font-family:Segoe UI,Arial,sans-serif;font-size:17px}main{max-width:1200px;margin:auto;padding:22px}h1{font-size:30px;margin:0 0 8px}h2{font-size:23px;margin:8px 0 14px}p{line-height:1.5}.muted{color:#a9b5c9}.panel{background:#182436;border:1px solid #35475f;border-radius:15px;padding:20px;margin:18px 0}.ok{color:#7beba8}.warn{color:#ffd48c}.item{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:18px;padding:15px;border-top:1px solid #344660;align-items:center}.item:first-child{border-top:none}.thread-title{font-size:19px;font-weight:650;overflow-wrap:anywhere}.meta{font-size:13px;color:#a9b5c9;overflow-wrap:anywhere;margin-top:8px}.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center}button,.linkbtn{background:#3169ae;border:1px solid #83a9db;color:white;border-radius:11px;min-height:54px;padding:12px 18px;font-size:17px;font-weight:600;cursor:pointer}button:hover,.linkbtn:hover{background:#4a86ce}.linkbtn{display:inline-flex;align-items:center;text-decoration:none;background:#304158}button.secondary{background:#3c4756}.input{background:#0f1723;border:1px solid #6a819f;color:white;border-radius:10px;font-size:18px;padding:13px;min-width:220px;max-width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#0d1521;border:1px solid #456078;border-radius:11px;padding:18px;font-size:17px;line-height:1.55}code{overflow-wrap:anywhere}@media(max-width:700px){main{padding:12px}.item{grid-template-columns:1fr}.item button{width:100%}h1{font-size:25px}}';
function html(res,status,s){res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(s)}
function page(title,body){return '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+h(title)+'</title><style>'+styles+'</style></head><body><main>'+body+'</main></body></html>'}
function selectionPanel(){
 let s;try{s=choice.selected()}catch(e){return '<section class="panel"><h2>No conversation selected</h2><p class="warn">'+h(e.message)+'</p><p>Select a conversation below. This selection is independent of the open Codex window.</p></section>'}
 let b='<section class="panel"><h2>Selected conversation <span class="ok">●</span></h2><p class="thread-title">'+h(s.title)+'</p><p class="meta">Thread ID: <code>'+h(s.threadId)+'</code><br>Workspace: '+h(s.cwd||'unspecified')+'<br>Selection expires: '+h(s.expiresUtc)+'</p><p class="muted">Selected in this Desk, not inferred from the foreground window.</p><form method="post" action="/clear"><input type="hidden" name="csrf" value="'+csrf+'"><button class="secondary" type="submit">Clear selection</button></form>';
 try{
  const pointer=JSON.parse(fs.readFileSync(latestFile,'utf8'));
  if(pointer.threadId===s.threadId){
   const d=ledger.review(pointer.draftId);
   if(d.threadId===s.threadId&&d.state==='staged'){
    b+='<h2>Prepared draft — NOT SENT</h2><pre>'+h(d.text)+'</pre><p class="meta">Draft ID: '+h(d.id)+'<br>Text SHA-256: '+h(d.sha256)+'<br>Expires: '+h(d.expiresUtc)+'</p><p class="warn">Review only. This web page cannot send a message. Send requires a separate explicit instruction to ChatGPT.</p>';
   }
  }
 }catch{}
 return b+'</section>';
}
async function conversationList(client,params){
 const cursor=params.get('cursor')||undefined,searchTerm=(params.get('search')||'').trim().slice(0,80);
 if(cursor&&cursor.length>1024)throw Error('Invalid pagination cursor');
 const q={limit:24,sortKey:'updated_at',sortDirection:'desc'};
 if(searchTerm)q.searchTerm=searchTerm;if(cursor)q.cursor=cursor;
 const result=await client.request('thread/list',q,18000);
 const list=(Array.isArray(result.data)?result.data:[]).filter(r=>/^[a-f0-9-]{20,80}$/i.test(r.id));
 const items=list.map(r=>{
  const title=String(r.name||r.title||r.preview||'Untitled').slice(0,160);
  return '<div class="item"><div><div class="thread-title">'+h(title)+'</div><div class="meta">ID: '+h(r.id)+'<br>Workspace: '+h(r.cwd||'unspecified')+'<br>Status: '+h(r.status?.type||'unknown')+'</div></div><form method="post" action="/select"><input type="hidden" name="csrf" value="'+csrf+'"><input type="hidden" name="id" value="'+h(r.id)+'"><button type="submit">Select this</button></form></div>';
 }).join('');
 const search='<form method="get" action="/" class="controls"><input class="input" name="search" maxlength="80" placeholder="Search conversation" value="'+h(searchTerm)+'"><button type="submit">Find conversations</button></form>';
 let nav='';
 if(result.nextCursor){
  const qp=new URLSearchParams({cursor:result.nextCursor,...(searchTerm?{search:searchTerm}:{})});
  nav='<a class="linkbtn" href="/?'+h(qp.toString())+'">Next conversations →</a>';
 }
 return '<section class="panel"><h2>Choose an exact Codex conversation</h2>'+search+'<div class="controls"><a class="linkbtn" href="/">Refresh list</a>'+nav+'</div>'+(items||'<p>No conversations found.</p>')+'</section>';
}
async function handle(req,res,client){
 if(req.headers.host!==HOST+':'+PORT){res.writeHead(403);res.end('Wrong host');return}
 const u=new URL(req.url,ORIGIN);
 if(req.method==='GET'&&u.pathname==='/health'){
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({ok:true,readOnlyWebUI:true,noSendRoute:true,port:PORT}));return;
 }
 if(req.method==='GET'&&u.pathname==='/'){
  try{html(res,200,page('Codex Conversation Desk','<h1>Codex Conversation Desk</h1><p class="muted">Choose target → ChatGPT prepares draft → review → separate explicit Send</p>'+selectionPanel()+await conversationList(client,u.searchParams)))}
  catch(e){html(res,503,page('List unavailable','<h1>List unavailable</h1><p>'+h(e.message)+'</p><a class="linkbtn" href="/">Retry</a>'))}
  return;
 }
 if(req.method==='POST'&&['/select','/clear'].includes(u.pathname)){
  if(req.headers.origin&&req.headers.origin!==ORIGIN){res.writeHead(403);res.end('Origin denied');return}
  let raw='';try{for await(const b of req){raw+=b.toString('utf8');if(raw.length>1500)throw Error('Too large')}}catch{res.writeHead(413);res.end('Too large');return}
  const params=new URLSearchParams(raw);
  if(params.get('csrf')!==csrf){res.writeHead(403);res.end('Invalid token');return}
  try{
   if(u.pathname==='/clear')choice.clear();
   else{const id=params.get('id');if(!id||!/^[a-f0-9-]{20,80}$/i.test(id))throw Error('Invalid conversation ID');const t=await client.inspect(id);choice.select(t)}
   res.writeHead(303,{Location:'/', 'Cache-Control':'no-store'});res.end();
  }catch(e){html(res,400,page('Selection rejected','<h1>Selection rejected</h1><p>'+h(e.message)+'</p><a class="linkbtn" href="/">Back</a>'))}
  return;
 }
 res.writeHead(404);res.end('Not found');
}
(async()=>{
 if(!Number.isInteger(PORT)||PORT<1025||PORT>65535)throw Error('Invalid port');
 const client=new CodexAppServer({cwd:__dirname});await client.connect();
 const server=http.createServer((req,res)=>{handle(req,res,client).catch(()=>{res.writeHead(500);res.end('Internal error')})});
 const stop=()=>{server.close();client.close()};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 server.listen(PORT,HOST,()=>console.log(JSON.stringify({status:'running',url:ORIGIN,readOnlyWebUI:true,sendAvailable:false,pid:process.pid})));
})().catch(e=>{console.error('DESK_START_FAILED '+String(e.message||e).slice(0,250));process.exitCode=1});
