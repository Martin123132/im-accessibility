'use strict';
// Selection tests run in a disposable copy: NEVER touch a real selected thread or app.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'codex-selection-isolated-'));
fs.copyFileSync(path.join(__dirname,'..','selected-thread.cjs'),path.join(temp,'selected-thread.cjs'));
fs.copyFileSync(path.join(__dirname,'..','draft-ledger.cjs'),path.join(temp,'draft-ledger.cjs'));
const sel=require(path.join(temp,'selected-thread.cjs'));
const ledger=require(path.join(temp,'draft-ledger.cjs'));
const id='019f1234-1234-7abc-9876-123456789abc';
const base={id,title:'ISOLATED selection fixture, not a real Codex chat',cwd:'D:\\test',source:'vscode',status:{type:'idle'}};
test.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
test('selection must be explicitly made first',()=>assert.throws(()=>sel.selected(),/No conversation/));
test('explicit exact-thread selection is persisted and verified',()=>{
 const record=sel.select(base);
 assert.equal(record.chosenBy,'owner_in_local_desk');
 assert.equal(sel.selected().threadId,id);
 assert.equal(sel.verifyLive(record,{...base}),true);
 assert.ok(fs.existsSync(sel.FILE));
});
test('cannot select fabricated, missing, or malformed thread id',()=>{
 for(const invalid of [{...base,id:'latest'},{...base,id:null},{...base,title:17}])
  assert.throws(()=>sel.select(invalid),/metadata/);
});
test('selected target must have exact live fingerprint and ID',()=>{
 const record=sel.selected();
 assert.throws(()=>sel.verifyLive(record,{...base,id:'019f1234-1234-7abc-9876-123456789abc1'}),/ID mismatch/);
 assert.throws(()=>sel.verifyLive(record,{...base,cwd:'D:\\changed'}),/metadata changed/);
 assert.throws(()=>sel.verifyLive(record,{...base,title:'Other chat'}),/metadata changed/);
});
test('stale selection fails closed',()=>{
 sel.clear();
 const then=Date.now()-31*60*1000;
 sel.select(base,{now:then});
 assert.throws(()=>sel.selected(),/expired/);
});
test('manual tampering with selection fingerprint fails closed',()=>{
 sel.select(base);
 const d=JSON.parse(fs.readFileSync(sel.FILE,'utf8'));
 d.threadId='019f1234-1234-7abc-9876-123456789abd';
 fs.writeFileSync(sel.FILE,JSON.stringify(d));
 assert.throws(()=>sel.selected(),/tampered|corrupted/);
});
test('clearing selection removes target state',()=>{
 sel.clear();
 assert.throws(()=>sel.selected(),/No conversation/);
});
