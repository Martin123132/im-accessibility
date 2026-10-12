'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const cast=require('../cast/server.cjs'),viewer=require('../viewer/server.cjs'),host=require('../resume-host.cjs');
test('private TV video, viewer and host have explicit four-hour maximum',()=>{
 const fourHours=4*60*60*1000,now=Date.now();
 assert.equal(host.MAX_MS,fourHours);
 for(const state of [cast.status(),viewer.state()]){
  const left=Date.parse(state.expiresAt)-now;
  assert.ok(left>fourHours-10000&&left<=fourHours,'Expected four-hour bounded session');
 }
 assert.match(read('cast/server.cjs'),/MAX_MS=4\*60\*60\*1000/);
 assert.match(read('viewer/server.cjs'),/EXPIRES_MS=4\*60\*60\*1000/);
});
test('mouse remains disarmed by default and requires separate renewable ten-minute consent',()=>{
 assert.equal(viewer.state().enabled,false);
 const code=read('viewer/server.cjs');
 assert.match(code,/enabledUntil=Math\.min\(expiresAt,Date\.now\(\)\+10\*60\*1000\)/);
 assert.match(code,/if\(!available\(\)\)throw Error\('Controls disabled or expired'\)/);
 assert.match(code,/input\?\.confirm!==true/);
 assert.match(read('viewer/web/viewer.js'),/Mouse ON \(10-minute lease\)/);
});
test('TV can explicitly request a bounded session end without keyboard or shell access',()=>{
 const code=read('viewer/server.cjs');
 assert.match(code,/route==='\/api\/end'/);
 assert.match(code,/input\.confirm!==true/);
 assert.match(code,/STOP_SIGNAL/);
 assert.match(code,/if\(!tokenMatches\(auth\)\|\|!active\(\)\)/);
 assert.doesNotMatch(code,/execSync\(|keybd_event|SendKeys|cmd\.exe/i);
 const ui=read('viewer/web/viewer.js');
 assert.match(ui,/CONFIRM END TV/);
 assert.match(ui,/request\('end','POST',\{confirm:true\}/);
});
test('owner-run resume path is restricted to the exact Windows task and existing LG',()=>{
 const cli=read('resume.cjs'),pair=read('lg-pair.cjs'),supervisor=read('resume-host.cjs');
 assert.match(cli,/PCBridge TV Resume 0\.5/);
 assert.match(cli,/Task identity mismatch/);
 assert.match(cli,/Task unexpectedly has autostart triggers/);
 assert.match(pair,/OLED55CX6LA/);
 assert.match(pair,/ssap:\/\/system\/getSystemInfo/);
 assert.match(pair,/ssap:\/\/system\.launcher\/open/);
 assert.match(supervisor,/Stop requested|Owner selected End TV session/);
 assert.match(supervisor,/An older or unrelated TV service already occupies ports/);
});
test('original source is still a separately pinned, recoverable input',()=>{
 const lock=JSON.parse(read('PARENT_LOCK.json'));
 assert.equal(lock.originalFilesVerified,23);
 assert.equal(lock.parent.length,23);
 assert.equal(lock.liveSourceUnchanged,true);
 assert.match(read('viewer/web/viewer.html'),/LIVE DESKTOP RESUME v0\.5/);
 assert.match(read('viewer/web/viewer.html'),/End TV session/);
});
