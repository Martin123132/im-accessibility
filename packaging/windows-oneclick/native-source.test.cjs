'use strict';
// Source/pin contracts; does not execute native helper processes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const pins=require('./native-source-pins.json');
test('three source and shipped native helper hashes are independently pinned',()=>{
 assert.equal(pins.entries.length,3);
 assert.deepEqual(pins.entries.map(x=>x.name),['LoopbackCapture','SpeakerEndpoint','TvPointer']);
 for(const e of pins.entries){
  assert.match(e.sourceSHA256,/^[0-9a-f]{64}$/);
  assert.match(e.binarySHA256,/^[0-9a-f]{64}$/);
  assert.ok(e.compiledAssembly.endsWith('.exe'));
  assert.ok(e.moduleGuidOffset>4000);
 }
 assert.equal(pins.entries[0].compiledAssembly,'LoopbackCapture-clockfix-t11.exe');
});
test('source verifier compiles into isolated dir and rejects non-compiler-metadata byte mismatches',()=>{
 const code=fs.readFileSync(path.join(root,'verify-native-source.ps1'),'utf8');
 assert.match(code,/Refusing to overwrite existing output/);
 assert.match(code,/sourceHash -ne \[string\]\$entry.sourceSHA256/);
 assert.match(code,/binaryHash -ne \[string\]\$entry.binarySHA256/);
 assert.match(code,/compilerArgs\+=\('/);
 assert.match(code,/unexpectedByteDifferences=0/);
 assert.match(code,/Source compilation failed|Native source compilation failed/);
 assert.match(code,/16-byte module GUID/);
 assert.doesNotMatch(code,/Start-Process|Invoke-WebRequest|SendInput|SetMute|git push|gh release/);
});
test('private setup builder requires native provenance before accepting package payload',()=>{
 const build=fs.readFileSync(path.join(root,'build-oneclick.ps1'),'utf8');
 const copy=build.indexOf("Copy-Item -Path (Join-Path $from '*')");
 const verify=build.indexOf("verify-native-source.ps1");
 const bundle=build.indexOf("ImAccessibilityEmbeddedPayload.zip");
 assert.ok(copy>=0&&verify>copy&&bundle>verify);
 assert.match(build,/native-helper-provenance/);
});
test('release auditor rejects unreviewed native executable substitutions',()=>{
 const code=fs.readFileSync(path.join(root,'audit-release.cjs'),'utf8');
 assert.match(code,/nativePinsVerified/);
 assert.match(code,/Native helper manifest does not match verified C# source/);
 assert.match(code,/nativeSourceAndBinaryPinsVerified/);
});
