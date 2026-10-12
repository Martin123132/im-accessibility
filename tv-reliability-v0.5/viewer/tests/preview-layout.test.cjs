'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'web/style.css'),'utf8');
const html=fs.readFileSync(path.join(root,'web/viewer.html'),'utf8');
const script=fs.readFileSync(path.join(root,'web/viewer.js'),'utf8');

test('LG touchpad v0.4.2 renders the actual JPEG as an in-flow 16:9 image',()=>{
 assert.match(html,/LIVE DESKTOP RESUME v0\.5/);
 assert.match(html,/<div id="snapshot-frame" class="snapshot-frame">/);
 assert.match(html,/<img id="snapshot" width="960" height="540"/);
 const frame=css.match(/\.snapshot-frame\{([^}]*)\}/)?.[1]||'';
 const img=css.match(/\.snapshot-frame > img\{([^}]*)\}/)?.[1]||'';
 assert.match(frame,/position:relative/);
 assert.match(frame,/width:100%/);
 assert.match(img,/display:block/);
 assert.match(img,/position:static/);
 assert.match(img,/width:100%/);
 assert.match(img,/height:auto/);
 assert.doesNotMatch(img,/position:absolute/);
 assert.doesNotMatch(img,/height:100%/);
 assert.equal(960/540,16/9);
});

test('LG click surface overlays but never constrains screenshot image height',()=>{
 const button=css.match(/\.snapshot-target\{([^}]*)\}/)?.[1]||'';
 assert.match(button,/position:absolute/);
 assert.match(button,/top:0/);
 assert.match(button,/bottom:0/);
 assert.match(button,/width:100%/);
 assert.match(button,/height:100%/);
 assert.match(button,/background:rgba\(0,0,0,0\.001\)!important/);
 assert.doesNotMatch(css,/\.snapshot-target::before/);
 assert.match(html,/<img id="snapshot"[^>]+>\s*<button id="snapshot-target" type="button"/);
 assert.match(html,/id="aim-point"/);
 assert.match(html,/id="picture-size"/);
 assert.match(script,/\$\('snapshot-frame'\)\.getBoundingClientRect\(\)/);
});

test('separate image click layer preserves LG input and video separation',()=>{
 assert.match(html,/<button id="snapshot-target" type="button" class="snapshot-target"/);
 assert.match(html,/id="aimed-click"/);
 assert.match(html,/<video id="display"/);
 assert.doesNotMatch(html.match(/<video[^>]*>/)?.[0]||'',/\scontrols(?:\s|>|=)/);
 assert.match(css,/\.stage video\{pointer-events:none!important/);
 assert.match(css,/\.snapshot-frame > img\{[^}]*pointer-events:none/);
 assert.match(script,/sendPointer\('click',point,0\)/);
});
