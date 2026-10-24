'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const fast=require('../fast-video.cjs');
const root=path.resolve(__dirname,'..');
function atom(type,body=Buffer.alloc(0)){
 const p=Buffer.alloc(8+body.length);
 p.writeUInt32BE(p.length,0);p.write(type,4,4,'ascii');body.copy(p,8);return p;
}
test('optional MSE fast transport retains video quality and captures speaker OUTPUT only',()=>{
 const a=fast.encoderArgs({sampleFormat:'f32le',sampleRate:48000,channels:2});
 assert.equal(a[a.indexOf('-framerate')+1],'15');
 assert.ok(a.includes('gdigrab'));
 assert.deepEqual(a.slice(a.indexOf('-vf'),a.indexOf('-vf')+2),['-vf','scale=1280:-2']);
 assert.equal(a[a.indexOf('-crf')+1],'28');
 assert.equal(a[a.indexOf('-b:a')+1],'128k');
 assert.ok(a.includes('pipe:3'));
 assert.ok(a.includes('pipe:1'));
 assert.ok(a.includes('+empty_moov+default_base_moof+frag_keyframe'));
 assert.equal(a[a.indexOf('-frag_duration')+1],'500000');
 assert.ok(!a.includes('dshow'),'Microphone must not be opened');
 assert.ok(!a.includes('x11grab'),'Windows source only');
 assert.throws(()=>fast.encoderArgs({sampleFormat:'bad',sampleRate:48000,channels:2}),/Unverified/);
});
test('fragment parser buffers incomplete MP4 boxes and emits init and paired media',()=>{
 const sent=[],p=fast.createFragmentParser((buffer,initial)=>sent.push({initial,buffer}));
 const all=Buffer.concat([atom('ftyp',Buffer.from('isom')),atom('moov',Buffer.from([1,2])),
  atom('moof',Buffer.from([3])),atom('mdat',Buffer.from([4,5,6]))]);
 p.push(all.subarray(0,7));
 assert.equal(sent.length,0);
 p.push(all.subarray(7,19));
 assert.equal(sent.length,0);
 p.push(all.subarray(19));
 assert.deepEqual(sent.map(x=>x.initial),[true,false]);
 assert.equal(p.snapshot().initSent,1);
 assert.equal(p.snapshot().fragments,1);
 assert.equal(p.snapshot().pendingBytes,0);
});
test('fragment parser rejects malformed MP4 instead of unbounded buffering',()=>{
 const bad=Buffer.alloc(8);bad.writeUInt32BE(5,0);bad.write('moov',4,'ascii');
 assert.throws(()=>fast.createFragmentParser(()=>{}).push(bad),/Invalid MP4 atom/);
});
test('fast mode preserves normal authenticated HLS and click controls',()=>{
 const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
 const html=fs.readFileSync(path.join(root,'web','immersive.html'),'utf8');
 const client=fs.readFileSync(path.join(root,'web','fast-video.js'),'utf8');
 assert.match(server,/FastVideo\.attach\(srv/);
 assert.match(server,/req\.method==='GET'&&route==='\/fast-video\.js'/);
 assert.match(server,/route==='\/fastfull\/'\+token/);
 assert.match(server,/const media=route\.match/);
 assert.match(server,/if\(!\(await sourceAudioInfo\(\)\)\.streamReady\)/);
 assert.match(html,/id="fast"/);
 assert.match(html,/src="\/fast-video\.js"/);
 assert.match(client,/ImAccessibilityFastVideo=/);
 assert.match(client,/stop\(video,false\)/,'Decoder failure closes MSE; full page navigates back to original HLS');
 assert.match(client,/video\.buffered/,'Live follow-up does not require a new full-screen player');
 assert.doesNotMatch(client,/requestFullscreen|webkitEnterFullscreen|execSync|keybd_event/);
 new vm.Script(client,{filename:'fast-video.js'});
});
