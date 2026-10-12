'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createServer}=require('../server.cjs');

test('TV HTML and JS allow only same-origin JPEG previews; do not allow external images', {timeout:10000},async t=>{
 const server=createServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
 const port=server.address().port;
 function req(path){
  return new Promise((resolve,reject)=>{
   const r=http.get({hostname:'127.0.0.1',port,path,headers:{Host:'192.168.4.36:43198'}},res=>{
    let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:text}));
   });
   r.on('error',reject);
  });
 }
 const script=await req('/viewer.js');
 assert.equal(script.status,200);
 const csp=script.headers['content-security-policy'];
 assert.match(csp,/img-src 'self'/);
 assert.doesNotMatch(csp,/img-src 'none'/);
 assert.match(csp,/script-src 'self'/);
 assert.match(csp,/default-src 'none'/);
 assert.doesNotMatch(csp,/img-src \*/);
 assert.doesNotMatch(csp,/img-src https?:/);
 assert.match(script.body,/\/frame\//,'Clickable JPEG URL remains part of receiver script');
});
