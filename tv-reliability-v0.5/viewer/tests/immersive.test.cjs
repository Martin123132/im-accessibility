'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web','immersive.html'),'utf8');
const css=fs.readFileSync(path.join(root,'web','immersive.css'),'utf8');
const code=fs.readFileSync(path.join(root,'web','immersive.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
test('real-LG-proven HLS document is a single full viewport native click button without video fullscreen',()=>{
 assert.match(html,/<video id="desktop" muted autoplay playsinline preload="auto"/);
 assert.doesNotMatch(html,/<video[^>]*\scontrols(?:\s|>|=)/);
 assert.match(html,/<button id="surface" type="button"/);
 assert.match(css,/#desktop\{[^}]*position:fixed;inset:0[^}]*object-fit:contain;pointer-events:none/);
 assert.match(css,/#surface\{[^}]*position:fixed;inset:0[^}]*z-index:10/);
 assert.match(html,/id="enable"/);assert.match(html,/id="pause"/);assert.match(html,/id="classic"/);
 assert.doesNotMatch(code,/\.(?:requestFullscreen|webkitEnterFullscreen)\(/);
 assert.match(html,/id="control-toggle"[^>]*aria-expanded="false"/);
 assert.match(html,/id="control-panel" hidden/);
 assert.ok(html.indexOf('id="status"')>html.indexOf('id="control-panel"'),'Status moved into controls menu');
 assert.match(css,/#controls\{[^}]*bottom:14px;top:auto/,'No permanent top toolbar');
 assert.match(css,/#control-panel\[hidden\]\{display:none!important\}/);
 
 assert.match(code,/video\.muted&&audioRoute!=='laptop-only'/,'Muted LG reload must not prolong laptop suppression');
 assert.match(server,/route==='\/full\/'\+token/);
 assert.match(server,/route==='\/tv\/'\+token/);
 assert.match(server,/asset\(res,'immersive.html','text\/html/);
});
test('full-screen click maps letterboxed HLS to Windows only within an active owner mouse lease',()=>{
 const token='a'.repeat(64),events=new Map(),els=new Map(),requests=[];
 for(const id of ['desktop','surface','controls','control-toggle','control-panel','enable','pause','play','sound','laptop','classic','stop','status','hint','marker']){
  els.set(id,{id,disabled:false,hidden:false,textContent:'',style:{},
   videoWidth:1280,videoHeight:720,controls:true,
   removeAttribute(){},setAttribute(k,v){this[k]=v},
   getBoundingClientRect(){return{left:0,top:0,width:1920,height:1080}},
   addEventListener(t,fn){events.set(id+':'+t,fn)},
   play(){return Promise.resolve()}
  });
 }
 let armed=false,now=1000;
 class XHR{
  constructor(){this.readyState=0;this.status=0;this.responseText=''}
  open(method,route){this.method=method;this.route=route}
  setRequestHeader(){}
  send(body){
   const data=body===null?null:JSON.parse(body);
   requests.push({route:this.route,method:this.method,data});
   let result={};
   if(this.route==='/api/status')result={canArm:true,enabled:armed,audioAvailable:true,audioRoute:'laptop-only',expiresAt:new Date(now+3600000).toISOString()};
   if(this.route==='/api/arm'){armed=true;result={enabled:true}}
   if(this.route==='/api/disarm'){armed=false;result={enabled:false}}
   if(this.route==='/api/mouse'){result={receipt:{action:'click',windowsX:960,windowsY:540}}}
   this.readyState=4;this.status=200;this.responseText=JSON.stringify(result);
   this.onreadystatechange?.();
  }
 }
 const env={
  location:{pathname:'/full/'+token,href:''},
  document:{getElementById:id=>{if(!els.has(id))throw Error('missing '+id);return els.get(id)}},
  XMLHttpRequest:XHR,
  Date:{now:()=>now,parse:x=>new Date(x).getTime()},
  setInterval(){},setTimeout(){},isFinite,Math,Number,Promise,JSON,console
 };
 vm.runInNewContext(code,env,{timeout:3000});
 assert.equal(els.get('desktop').controls,false);
 assert.equal(els.get('control-panel').hidden,true,'Menu starts hidden');
 const countBeforeMenu=requests.filter(x=>x.route==='/api/mouse').length;
 events.get('control-toggle:click')({preventDefault(){},stopPropagation(){}});
 assert.equal(els.get('control-panel').hidden,false,'Menu opens on the LG button');
 assert.equal(els.get('control-toggle')['aria-expanded'],'true');
 events.get('control-toggle:click')({preventDefault(){},stopPropagation(){}});
 assert.equal(els.get('control-panel').hidden,true,'Menu can be closed');
 assert.equal(requests.filter(x=>x.route==='/api/mouse').length,countBeforeMenu,'Menu interaction cannot click Windows');
 
 assert.equal(els.get('desktop').muted,true,'Initial HLS autoplay must be muted');
 assert.equal(els.get('sound').disabled,false,'Sound is enabled only when the service exposes audio');
 events.get('sound:click')();
 assert.equal(els.get('desktop').muted,false,'Owner can explicitly enable TV sound');
 assert.equal(els.get('sound').textContent,'TV sound ON');
 assert.equal(els.get('laptop').disabled,false);
 events.get('laptop:click')();
 assert.equal(els.get('laptop').textContent,'Laptop sound ON');
 events.get('laptop:click')();
 assert.equal(els.get('laptop').textContent,'Laptop sound OFF');
 events.get('sound:click')();
 assert.equal(els.get('desktop').muted,true,'TV sound can be turned OFF again');
 assert.equal(els.get('desktop').style.pointerEvents,'none');
 assert.equal(els.get('enable').disabled,false);
 assert.equal(els.get('pause').disabled,true);
 const mouse=()=>requests.filter(x=>x.route==='/api/mouse');
 const click={clientX:960,clientY:540,preventDefault(){},stopPropagation(){}};
 events.get('surface:click')(click);
 assert.equal(mouse().length,0,'Unarmed clicks never reach Windows');
 events.get('enable:click')();
 assert.equal(els.get('pause').disabled,false);
 now+=1000;
 events.get('surface:click')(click);
 assert.equal(mouse().length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(mouse()[0].data)),{cmd:'click',x:5000,y:5000});
 now+=1000;
 events.get('pause:click')();
 events.get('surface:click')(click);
 assert.equal(mouse().length,1,'Pause revokes all Windows input');
 events.get('classic:click')();
 assert.equal(env.location.href,'/tv/'+token,'Known-good original controls remain available');
});
test('letterboxing rejects clicks on black borders without forwarding to Windows',()=>{
 const pathMatch=code.match(/function fitPosition\(e\)\{[\s\S]*?\n \}/);
 assert.ok(pathMatch,'Exact video fit geometry exists');
 assert.match(code,/Math\.min\(box.width\/width,box.height\/height\)/);
 assert.match(code,/px<0\|\|px>1\|\|py<0\|\|py>1/);
 assert.match(code,/if\(!armed\)/);
 assert.match(code,/lastClickAt<350/);
});
test('viewer maintains original time-limited authorisation and non-Codex backend',()=>{
 assert.match(server,/tokenMatches\(auth\)\|\|!active\(\)/);
 assert.match(server,/enabledUntil=Math\.min\(expiresAt,Date\.now\(\)\+10\*60\*1000\)/);
 assert.match(server,/const media=route\.match/);
 assert.doesNotMatch(code,/execSync|cmd\.exe|Codex|keyboard/i);
});
