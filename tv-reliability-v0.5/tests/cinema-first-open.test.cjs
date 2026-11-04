'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {promote} = require('../cinema-start.cjs');

const token = 'a'.repeat(64);
const origin = 'http://10.34.25.7:43198';
const sessionUrl = origin + '/tv/' + token;
function mockLG(target = origin + '/full/' + token) {
  const calls = [];
  return {
    calls,
    privateReceiver() { return {url:target}; },
    async connectOne(host,url,timeout) {
      calls.push({host,url,timeout});
      return {host,opened:true};
    }
  };
}
function fakeResponse(value) {
  return {ok:true,async json(){return value;}};
}

test('Cinema switches existing source, preserves private session, and reopens exact saved TV once', async()=>{
  const lg = mockLG(), requests = [], waits = [];
  let quality = 'interactive';
  const request = async(url,opts={}) => {
    requests.push({url,opts});
    assert.equal(opts.headers.Authorization,'Bearer '+token);
    if(opts.method === 'POST') {
      assert.equal(url,origin+'/api/quality');
      assert.deepEqual(JSON.parse(opts.body),{mode:'cinema'});
      assert.equal(opts.headers.Origin,origin);
      quality='cinema';
      return fakeResponse({qualityMode:'cinema'});
    }
    assert.equal(url,origin+'/api/status');
    return fakeResponse({sourceReady:true,qualityMode:quality});
  };
  const result = await promote({
    sessionUrl,lan:'10.34.25.7',verifiedIp:'10.34.25.23',lg,
    request, wait:async ms=>{waits.push(ms);}
  });
  assert.deepEqual(result,{cinema:true,viewer:'immersive',requested:true});
  assert.equal(requests.filter(r=>r.opts.method==='POST').length,1);
  assert.deepEqual(lg.calls,[{host:'10.34.25.23',url:origin+'/full/'+token,timeout:6500}]);
  assert.ok(waits.includes(1100));
});

test('Already Cinema: reopens once without sending another quality change',async()=>{
  const lg=mockLG();const requests=[];
  await promote({
    sessionUrl,lan:'10.34.25.7',verifiedIp:'10.34.25.23',lg,
    request:async(u,o)=>{requests.push(o.method||'GET');return fakeResponse({sourceReady:true,qualityMode:'cinema'});},
    wait:async()=>{}
  });
  assert.deepEqual(requests,['GET','GET']);
  assert.equal(lg.calls.length,1);
});

test('Cross-origin/private token mismatches never contact TV',async()=>{
  const lg=mockLG(origin+'/full/'+'b'.repeat(64));
  await assert.rejects(promote({
    sessionUrl,lan:'10.34.25.7',verifiedIp:'10.34.25.23',lg,
    request:async()=>fakeResponse({sourceReady:true,qualityMode:'cinema'}),wait:async()=>{}
  }),/Immersive target/);
  assert.equal(lg.calls.length,0);
  await assert.rejects(promote({
    sessionUrl:'http://10.34.25.8:43198/tv/'+token,lan:'10.34.25.7',
    verifiedIp:'10.34.25.23',lg
  }),/Invalid owner viewer session/);
});

test('Never opens LG if Cinema is not ready before deadline',async()=>{
  const lg=mockLG();let clock=0;
  await assert.rejects(promote({
    sessionUrl,lan:'10.34.25.7',verifiedIp:'10.34.25.23',lg,
    request:async()=>fakeResponse({sourceReady:false,qualityMode:'interactive'}),
    wait:async()=>{}, now:()=>clock+=1000,timeoutMs:2000
  }),/did not become ready/);
  assert.equal(lg.calls.length,0);
});

test('Source flow contains no FlyStream or embedded owner settings',()=>{
  const runtime=fs.readFileSync(path.join(__dirname,'..','resume-host.cjs'),'utf8');
  const pair=fs.readFileSync(path.join(__dirname,'..','lg-pair.cjs'),'utf8');
  assert.match(runtime,/await promoteCinema/);
  assert.match(pair,/u\.pathname=u\.pathname\.replace/);
  assert.doesNotMatch(runtime+pair,/FlyStream|C:\\\\Users\\\\|lg-client-key\.mac\s*=/);
});
