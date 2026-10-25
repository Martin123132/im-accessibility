'use strict';
// Pure source policy tests: no TV, Windows registry, signing or network actions.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {safe,privateFile,flags,TEMPLATE_SHA}=require('./audit-release.cjs');
test('distribution manifest rejects path escapes and duplicates cannot be represented safely',()=>{
 for(const p of ['../owner/settings.json','/absolute.exe','C:\\Windows\\secret','foo//bar','a/./b','a/../b','private?.exe','foo\\bar'])assert.equal(safe(p),false,p);
 for(const p of ['Runtime/ffmpeg.exe','tv-reliability-v0.5/cast/node_modules/ws/LICENSE','ImAccessibility.exe'])assert.equal(safe(p),true,p);
});
test('private runtime credentials and session files never qualify for customer package',()=>{
 for(const p of ['tv-reliability-v0.5/viewer/runtime/session.json','tv-reliability-v0.5/cast/runtime/private-access.json',
  'tv-reliability-v0.5/viewer/runtime/client-key','settings.json','someone.pfx','.env']){
  assert.equal(privateFile({path:p,sha256:'x'}),true,p);
 }
});
test('LG pairing payload must equal the independently verified published npm template',()=>{
 const p='tv-reliability-v0.5/cast/node_modules/lgtv2/pairing.json';
 assert.equal(privateFile({path:p,sha256:TEMPLATE_SHA}),false);
 assert.equal(privateFile({path:p,sha256:'different'}),true); // tampered pairing templates could contain a live LG key
});
test('GPL and nonfree FFmpeg configure switches are parsed explicitly',()=>{
 const enabled=flags('configuration: --enable-gpl --enable-version3 --enable-libx264 --enable-libx265');
 assert.equal(enabled.has('--enable-gpl'),true);
 assert.equal(enabled.has('--enable-version3'),true);
 assert.equal(enabled.has('--enable-nonfree'),false);
 const incompatible=flags('configuration: --enable-nonfree');
 assert.equal(incompatible.has('--enable-nonfree'),true);
});
test('release auditor hard-codes manual gates rather than silently approving a binary',()=>{
 const source=fs.readFileSync(path.join(__dirname,'audit-release.cjs'),'utf8');
 for(const x of ['readyForPublicDistribution:false','corresponding sources','Native helper build provenance','owner approval','Human Narrator/NVDA']){
  assert.ok(source.includes(x),'Missing release gate '+x);
 }
 assert.doesNotMatch(source,/git push|gh release create|New-LocalUser|Start TV stream/);
});
