'use strict';
// Select the existing Cinema profile and reopen the same owner's LG browser AFTER
// the HLS source is healthy. No window focus, media-app launch, user IP defaults,
// pairing-secret exports, or permission changes.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function promote({sessionUrl, lan, verifiedIp, lg, request = fetch,
                        wait = delay, now = Date.now, timeoutMs = 18000}) {
  if (typeof lan !== 'string' || typeof verifiedIp !== 'string' ||
      !lg || typeof lg.connectOne !== 'function' ||
      typeof lg.privateReceiver !== 'function') throw Error('Cinema owner context missing');
  const original = new URL(sessionUrl);
  const origin = 'http://' + lan + ':43198';
  if (original.origin !== origin || original.search || original.hash ||
      !/^\/tv\/[a-f0-9]{64}$/.test(original.pathname)) throw Error('Invalid owner viewer session');
  const token = original.pathname.slice('/tv/'.length);
  const headers = {Authorization:'Bearer ' + token};
  const qualityHeaders = {...headers, Origin:origin,
                          'Sec-Fetch-Site':'same-origin', 'Content-Type':'application/json'};
  async function status() {
    const response = await request(origin + '/api/status', {
      headers, redirect:'error', signal:AbortSignal.timeout(1800)
    });
    if (!response.ok) throw Error('Viewer health failed');
    return response.json();
  }
  let changed = false;
  let ready = false;
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const state = await status();
    if (state.sourceReady === true && state.qualityMode === 'cinema') {
      ready = true;
      break;
    }
    if (!changed && state.sourceReady === true && state.qualityMode === 'interactive') {
      const response = await request(origin + '/api/quality', {
        method:'POST', headers:qualityHeaders, body:JSON.stringify({mode:'cinema'}),
        redirect:'error', signal:AbortSignal.timeout(2500)
      });
      if (!response.ok || (await response.json()).qualityMode !== 'cinema')
        throw Error('Cinema change not acknowledged');
      changed = true;
    }
    await wait(350);
  }
  if (!ready) throw Error('Cinema source did not become ready');
  // Allow the newly encoded Cinema segment to settle on the LG before reopening.
  await wait(1100);
  const after = await status();
  if (after.sourceReady !== true || after.qualityMode !== 'cinema')
    throw Error('Cinema stream changed during startup');
  const target = new URL(lg.privateReceiver().url);
  if (target.origin !== origin || target.search || target.hash ||
      target.pathname !== original.pathname.replace(/^\/tv\//, '/full/'))
    throw Error('Immersive target differs from private viewer session');
  const result = await lg.connectOne(verifiedIp, target.href, 6500);
  if (!result || result.opened !== true || result.host !== verifiedIp)
    throw Error('LG immersive reopen not acknowledged');
  return {cinema:true,viewer:'immersive',requested:true};
}

module.exports = {promote};
