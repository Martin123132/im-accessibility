'use strict';
// Owner-only portable package integrity, install and uninstall. No TV or process control.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PRODUCT='ImAccessibility',RECEIPT='.imaccess-install-receipt.json';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fail(m){throw Error('IMACCESS_PACKAGE: '+m)}
function rel(n){
 if(typeof n!=='string'||n.length<1||n.length>240||n.includes('\\')||
 !/^[A-Za-z0-9._/-]+$/.test(n)||n.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.')))
  fail('Unsafe relative file path');
 return n;
}
function locate(root,n){
 const p=path.resolve(root,...rel(n).split('/'));
 if(!p.startsWith(path.resolve(root)+path.sep))fail('Escaping package root');
 return p;
}
function files(root){
 const all=[];
 function scan(dir,prefix=''){
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
   if(item.isSymbolicLink())fail('Linked package entry not allowed');
   const name=prefix?prefix+'/'+item.name:item.name;
   if(name!==RECEIPT)rel(name);
   if(item.isDirectory())scan(path.join(dir,item.name),name);
   else if(item.isFile())all.push(name);
   else fail('Special package entry not allowed');
  }
 }
 scan(root);
 return all.sort();
}
function withoutLinks(root,relpath){
 let p=path.resolve(root);
 for(const segment of rel(relpath).split('/')){
  p=path.join(p,segment);
  const st=fs.lstatSync(p);
  if(st.isSymbolicLink())fail('Linked file or directory');
 }
}
function verify(payload,manifest){
 if(!manifest||manifest.format!==1||manifest.product!==PRODUCT||!Array.isArray(manifest.files)||
 manifest.files.length<15||manifest.files.length>800)fail('Invalid package manifest');
 let total=0;const seen=new Set();
 for(const e of manifest.files){
  const n=rel(e?.path);
  if(seen.has(n))fail('Duplicate file in manifest');seen.add(n);
  if(!/^[a-f0-9]{64}$/.test(e.sha256)||!Number.isSafeInteger(e.bytes)||e.bytes<0)fail('Invalid hash/size');
  total+=e.bytes;if(total>30*1024*1024)fail('Bundle too large');
  const p=locate(payload,n);
  withoutLinks(payload,n);
  const data=fs.readFileSync(p);
  if(data.length!==e.bytes||sha(data)!==e.sha256)fail('Manifest checksum mismatch: '+n);
 }
 const actual=files(payload);
 if(actual.length!==seen.size||actual.some(n=>!seen.has(n)))fail('Unlisted package files');
 for(const n of ['LICENSE','NOTICE.md','Start.cmd','Stop.cmd','Status.cmd','Uninstall.cmd',
   'Uninstall.cjs','stop-session.cjs','package-core.cjs'])
  if(!seen.has(n))fail('Missing required component: '+n);
 return {files:seen.size,totalBytes:total,manifestSha256:sha(Buffer.from(JSON.stringify(manifest)))};
}
function userRoot(env=process.env){
 if(process.platform!=='win32')fail('Requires Windows');
 const root=env?.LOCALAPPDATA;
 if(typeof root!=='string'||root.length<8||root.length>490||!/^[A-Za-z]:\\/.test(root)||
 root.includes('/')||/[\x00-\x1f"'<>|*?]/.test(root)||root.slice(2).includes(':')||
 root.split('\\').some(x=>x==='.'||x==='..')||path.win32.normalize(root).toLowerCase()!==root.toLowerCase())
 fail('LOCALAPPDATA must be an absolute local Windows profile folder');
 const real=path.resolve(root);
 if(!fs.existsSync(real)||!fs.statSync(real).isDirectory()||fs.lstatSync(real).isSymbolicLink())
 fail('Invalid local user data folder');
 return real;
}
function destFor(env){return path.join(userRoot(env),'Programs',PRODUCT)}
function checkAncestors(local,dir){
 let p=path.resolve(dir);const end=path.resolve(local);
 while(p.toLowerCase()!==end.toLowerCase()){
  if(!p.toLowerCase().startsWith(end.toLowerCase()+path.sep.toLowerCase()))fail('Install path escapes user profile');
  if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())fail('Linked installation path');
  const next=path.dirname(p);if(next===p)fail('Invalid install ancestor');p=next;
 }
}
function readBundle(bundle){
 const root=path.resolve(bundle),payload=path.join(root,'payload');
 const manFile=path.join(root,'package-manifest.json');
 if(!fs.existsSync(payload)||!fs.statSync(payload).isDirectory())fail('Missing package payload');
 if(fs.statSync(manFile).size>250000)fail('Invalid manifest size');
 let manifest;
 try{manifest=JSON.parse(fs.readFileSync(manFile,'utf8'))}catch{fail('Invalid manifest JSON')}
 const details=verify(payload,manifest);
 return {payload,manifest,details};
}
function install(bundle,env=process.env){
 const {payload,manifest,details}=readBundle(bundle);
 const local=userRoot(env),programs=path.join(local,'Programs'),dest=path.join(programs,PRODUCT);
 checkAncestors(local,programs);
 if(!fs.existsSync(programs))fs.mkdirSync(programs);
 if(!fs.statSync(programs).isDirectory()||fs.lstatSync(programs).isSymbolicLink())fail('Programs folder invalid');
 if(fs.existsSync(dest))fail('Install already exists; refusing overwrite');
 const stage=path.join(programs,'.ImAccessibility-stage-'+process.pid+'-'+crypto.randomBytes(4).toString('hex'));
 fs.mkdirSync(stage);
 let committed=false;
 try{
  for(const entry of manifest.files){
   const to=locate(stage,entry.path);
   fs.mkdirSync(path.dirname(to),{recursive:true});
   fs.copyFileSync(locate(payload,entry.path),to,fs.constants.COPYFILE_EXCL);
   if(sha(fs.readFileSync(to))!==entry.sha256)fail('Copied file hash differs');
  }
  const receipt={format:1,product:PRODUCT,version:manifest.version,installedAtUtc:new Date().toISOString(),
   manifestHash:details.manifestSha256,files:manifest.files};
  fs.writeFileSync(path.join(stage,RECEIPT),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  if(fs.existsSync(dest))fail('Install target appeared during staging');
  fs.renameSync(stage,dest);committed=true;
  return {installed:true,folder:dest,fileCount:details.files,version:manifest.version};
 }finally{
  if(!committed&&fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});
 }
}
function uninstall(env=process.env){
 const local=userRoot(env),dest=path.join(local,'Programs',PRODUCT);
 checkAncestors(local,dest);
 const rec=path.join(dest,RECEIPT);
 if(!fs.existsSync(rec))fail('No verified installed receipt; refusing deletion');
 if(fs.lstatSync(dest).isSymbolicLink())fail('Install target is linked');
 let receipt;
 try{receipt=JSON.parse(fs.readFileSync(rec,'utf8'))}catch{fail('Corrupt install receipt')}
 if(receipt?.format!==1||receipt.product!==PRODUCT||!Array.isArray(receipt.files)||
 receipt.files.length<15||receipt.files.length>800)fail('Invalid receipt');
 const expected=new Set();
 for(const e of receipt.files){
  const n=rel(e.path);
  if(expected.has(n))fail('Duplicate receipt path');expected.add(n);
  const p=locate(dest,n);withoutLinks(dest,n);
  if(sha(fs.readFileSync(p))!==e.sha256)fail('Installed file changed: '+n+'; no files removed');
 }
 const actual=files(dest).filter(n=>n!==RECEIPT);
 if(actual.length!==expected.size||actual.some(n=>!expected.has(n)))
  fail('Unexpected installed files (possibly active runtime state); no files removed');
 for(const n of [...expected].sort((a,b)=>b.length-a.length))fs.unlinkSync(locate(dest,n));
 fs.unlinkSync(rec);
 function prune(folder){
  for(const e of fs.readdirSync(folder,{withFileTypes:true})){
   if(!e.isDirectory()||e.isSymbolicLink())fail('Unexpected content during cleanup');
   prune(path.join(folder,e.name));
  }
  if(fs.readdirSync(folder).length!==0)fail('Unexpected nonempty folder');
  fs.rmdirSync(folder);
 }
 prune(dest);
 return {uninstalled:true,removedFiles:expected.size,settingsPreserved:path.join(local,PRODUCT)};
}
module.exports={PRODUCT,RECEIPT,sha,rel,locate,files,verify,userRoot,destFor,readBundle,install,uninstall};
