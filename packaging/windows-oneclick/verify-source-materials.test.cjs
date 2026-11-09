'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {validateInventory,verify,RUNTIME}=require('./verify-source-materials.cjs');
function fixture(){return {schema:1,ffmpegSHA256:RUNTIME,correspondingSourceComplete:false,files:[{path:'sources/one.txt',bytes:4,sha256:crypto.createHash('sha256').update('data').digest('hex')}]}}
test('source material verification detects changed, missing and truncated archives',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'imaccessibility-source-verification-'));
 try{
  fs.mkdirSync(path.join(root,'sources'));
  const file=path.join(root,'sources','one.txt');fs.writeFileSync(file,'data');
  const valid=await verify(root,fixture());assert.equal(valid.passed,1);assert.equal(valid.publicDistributionApproved,false);assert.equal(valid.correspondingSourceComplete,false);
  fs.writeFileSync(file,'evil');assert.match((await verify(root,fixture())).failures[0].reason,/SHA-256/);
  fs.writeFileSync(file,'bad');assert.match((await verify(root,fixture())).failures[0].reason,/size/);
  fs.unlinkSync(file);assert.equal((await verify(root,fixture())).failures[0].reason,'Missing file');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('source inventory rejects paths outside the collection, duplicates and a different runtime',()=>{
 for(const name of ['../escape','/absolute','C:/outside','sources\\outside','sources//one','sources/../one']){
  const inventory=fixture();inventory.files[0].path=name;assert.throws(()=>validateInventory(inventory),/Unsafe/);
 }
 const duplicate=fixture();duplicate.files.push({...duplicate.files[0],path:'SOURCES/ONE.TXT'});assert.throws(()=>validateInventory(duplicate),/duplicate/);
 const other=fixture();other.ffmpegSHA256='0'.repeat(64);assert.throws(()=>validateInventory(other),/Unrecognised/);
});
