'use strict';
// Fresh installs contain verified files but do not precreate empty runtime directories.
// This test does not start a stream, pair a TV, or modify Windows settings.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','server.cjs'),'utf8');
test('clean-install TV viewer creates runtime directory before writing its private session',()=>{
 const mkdir="fs.mkdirSync(path.join(ROOT,'runtime'),{recursive:true});";
 const write="fs.writeFileSync(path.join(ROOT,'runtime','session.json'),JSON.stringify({";
 const a=source.indexOf(mkdir),b=source.indexOf(write);
 assert.ok(a>=0,'Viewer must create its own previously absent runtime directory');
 assert.ok(b>a,'Viewer must create runtime before writing session.json');
 assert.equal(source.indexOf(mkdir,a+mkdir.length),-1,'Do not introduce repeated runtime creation sites');
});
