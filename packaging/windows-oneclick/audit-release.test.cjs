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
 for(const x of ['readyForPublicDistribution:false','corresponding sources','Native helper code provenance verified','owner approval','Human Narrator/NVDA']){
  assert.ok(source.includes(x),'Missing release gate '+x);
 }
 assert.doesNotMatch(source,/git push|gh release create|New-LocalUser|Start TV stream/);
});


test('Gyan FFmpeg 9.0.1 vendor hash and exact upstream source pin remain explicit',()=>{
 const v=require('./ffmpeg-9.0.1-source-inventory.json');
 assert.equal(v.vendorFFmpegExeSha256,'57c56e369d5b4873b4d93fc1a1d833cb7cd8bc9325c14b05c34ce60b22842d8a');
 assert.equal(v.vendorZIPsha256,'2e8e28af97c2ae338ccef92e36da9b2a4cd21d0cad9dde093545606cb07f5b00');
 assert.equal(v.coreSourceCommit,'bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa');
 assert.equal(v.externalLibraryCount,82);
 assert.equal(v.externalLibraries.length,82);
 assert.equal(v.correspondingSourceComplete,false);
 assert.equal(v.externalLibraries.find(x=>x.name==='x264')?.upstreamVersion,'v0.165.3223');
 assert.equal(v.externalLibraries.find(x=>x.name==='x265')?.upstreamVersion,'4.3-6-g9ddc216');
 const audit=fs.readFileSync(path.join(__dirname,'audit-release.cjs'),'utf8');
 assert.match(audit,/exactVendorMatch/);
 assert.match(audit,/ffmpegSha256:ffmpegSHA256/);
 assert.match(audit,/Runtime\/ffmpeg\.exe differs from pinned Gyan vendor binary/);
 assert.match(audit,/correspondingSourceComplete/);
});
test('signing-readiness script is read-only and cannot produce trusted signatures',()=>{
 const script=fs.readFileSync(path.join(__dirname,'verify-publisher-signature.ps1'),'utf8');
 assert.match(script,/Get-AuthenticodeSignature/);
 assert.match(script,/verify \/pa \/v/);
 assert.match(script,/signedOrModifiedByThisScript=\$false/);
 assert.match(script,/publicReleaseApprovedByThisScript=\$false/);
 assert.doesNotMatch(script,/signtool(?:\.exe)? sign|New-SelfSignedCertificate|Import-PfxCertificate|gh release create/);
});


test('GPL x264 and x265 pinned source snapshots remain unapproved without build recipes',()=>{
 const inventory=require('./ffmpeg-9.0.1-source-inventory.json');
 const archived=inventory.externalLibraries.filter(x=>x.correspondingSourceArchived);
 assert.equal(inventory.externalLibraries.length,82);
 assert.equal(archived.length,2);
 const x264=archived.find(x=>x.name==='x264');
 const x265=archived.find(x=>x.name==='x265');
 assert.equal(x264.sourceRevision,'0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee');
 assert.equal(x265.sourceRevision,'9ddc216defd1fa85535cb91456a9f6c09a2c3abc');
 assert.equal(x264.privateArchiveSHA256,'7f091b0e530cee2800d25843307938bcda71b069838240a94d0409acc5296f0f');
 assert.equal(x265.privateArchiveSHA256,'ef5033bc87969f5cd39196303e45c29a91c8a05fb51445168ac1869ee3823c78');
 assert.equal(archived.some(x=>x.buildRecipeVerified),false);
 assert.equal(inventory.correspondingSourceComplete,false);
 const checker=fs.readFileSync(path.join(__dirname,'audit-release.cjs'),'utf8');
 assert.match(checker,/archivedExternalSourceCount/);
 assert.match(checker,/verifiedExternalBuildRecipeCount/);
});
