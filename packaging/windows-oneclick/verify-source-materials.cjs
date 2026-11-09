'use strict';
// Read-only verification of retained dependency data. Never executes source or installs tools.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const RUNTIME='71ac0a64a4e3e0caaf7a8c25c7e73d161ac1b269cca930d207e89e1b23959dfb';
function validateInventory(inventory){
 if(inventory.schema!==1||inventory.ffmpegSHA256!==RUNTIME||!Array.isArray(inventory.files)||!inventory.files.length)
  throw Error('Unrecognised FFmpeg source inventory');
 const seen=new Set();
 for(const file of inventory.files){
  const name=file.path;
  if(typeof name!=='string'||!/^[A-Za-z0-9._+/-]+$/.test(name)||name.startsWith('/')||name.split('/').some(x=>!x||x==='.'||x==='..')||seen.has(name.toLowerCase()))
   throw Error('Unsafe or duplicate source path');
  if(!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<=0)
   throw Error('Invalid source file pin');
  seen.add(name.toLowerCase());
 }
}
async function verify(root,inventory){
 validateInventory(inventory);
 root=fs.realpathSync(root);
 const failures=[];
 let passed=0,bytes=0;
 for(const file of inventory.files){
  try{
   const target=path.join(root,...file.path.split('/'));
   const relative=path.relative(root,fs.realpathSync(target));
   if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Path leaves source directory');
   const stat=fs.lstatSync(target);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==file.bytes)throw Error('File type/size mismatch');
   const hash=crypto.createHash('sha256');
   for await(const chunk of fs.createReadStream(target))hash.update(chunk);
   if(hash.digest('hex')!==file.sha256)throw Error('SHA-256 mismatch');
   passed++;bytes+=file.bytes;
  }catch(e){failures.push({path:file.path,reason:e.code==='ENOENT'?'Missing file':e.message})}
 }
 return {passed,expected:inventory.files.length,bytes,failures,
  correspondingSourceComplete:inventory.correspondingSourceComplete===true,
  publicDistributionApproved:false};
}
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length!==1){console.error('Usage: node verify-source-materials.cjs RETAINED_MATERIALS_DIRECTORY');process.exitCode=1}
 else verify(args[0],require('./third-party-notices/FFmpeg-Source-Materials.json'))
  .then(report=>{console.log(JSON.stringify(report));if(report.failures.length)process.exitCode=1})
  .catch(e=>{console.error(e.message);process.exitCode=1});
}
module.exports={validateInventory,verify,RUNTIME};
