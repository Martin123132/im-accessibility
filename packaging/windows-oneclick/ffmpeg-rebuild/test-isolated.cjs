'use strict';
// Opt-in runtime acceptance using synthetic inputs only. Never installs a runtime,
// captures the desktop/speakers, opens a port, or touches settings/tasks.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const sound = require('../../../tv-reliability-v0.5/cast/sound.cjs');

async function main() {
  const [ffmpegArg, ffprobeArg, outputArg] = process.argv.slice(2);
  if (!ffmpegArg || !ffprobeArg || !outputArg) throw Error('Provide FFmpeg, FFprobe, and a NEW evidence directory');
  const ffmpeg = fs.realpathSync(ffmpegArg), ffprobe = fs.realpathSync(ffprobeArg);
  const output = path.resolve(outputArg);
  if (fs.existsSync(output)) throw Error('Evidence directory must not already exist');
  fs.mkdirSync(output, {recursive: true});
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const results = [], processes = [], active = new Map();
  let sequence = 0;
  const run = (exe, args, {audio, timeout = 60000, stopAfter = 0} = {}) => new Promise((resolve, reject) => {
    const log = path.join(output, `process-${++sequence}.log`);
    const child = cp.spawn(exe, args, {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe', ...(audio ? ['pipe'] : [])]});
    const record = {pid: child.pid, executable: exe, args, startedAt: new Date().toISOString(), log};
    processes.push(record); active.set(child, record);
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    // Broken pipes are expected if an encoder rejects its input before consuming it.
    if (audio) { child.stdio[3].on('error', e => { record.audioPipeError = e.code; }); child.stdio[3].end(audio); }
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    const stop = stopAfter ? setTimeout(() => { record.requestedStop = true; child.stdin.end('q\n'); }, stopAfter) : null;
    if (!stopAfter) child.stdin.end();
    child.on('error', error => { record.spawnError = error.message; });
    child.on('close', (code, signal) => {
      clearTimeout(timer); if (stop) clearTimeout(stop);
      active.delete(child); Object.assign(record, {exitedAt: new Date().toISOString(), code, signal, timedOut});
      fs.writeFileSync(log, stdout + '\n--- stderr ---\n' + stderr);
      if (timedOut || record.spawnError) reject(Error(`Child did not complete normally: ${log}`));
      else resolve({code, stdout, stderr, record});
    });
  });
  const test = async (name, fn) => {
    try { const evidence = await fn(); results.push({name, pass: true, ...evidence}); console.log('PASS', name); }
    catch (error) { results.push({name, pass: false, error: error.stack}); console.log('FAIL', name, error.message); }
  };
  const duration = 6, samples = 48000 * duration;
  const pcm = Buffer.alloc(samples * 2 * 4);
  for (let i = 0; i < samples; i++) for (let ch = 0; ch < 2; ch++) pcm.writeFloatLE(0.3 * Math.sin(2 * Math.PI * 440 * i / 48000), (i * 2 + ch) * 4);
  const format = {sampleFormat: 'f32le', sampleRate: 48000, channels: 2};
  const encodeArgs = (dir, codec, quality, audio, startNumber = 0) => {
    const args = sound.argsFor(dir, audio ? format : null, startNumber, quality, codec);
    const input = args.indexOf('desktop'); assert.ok(input > 0);
    // Replace only the desktop input with a generated pattern. All encoder,
    // scaler, AAC, HLS and raw-PCM pipe arguments come from the actual app.
    const firstFormat = args.indexOf('-f');
    args.splice(firstFormat, input - firstFormat + 1, '-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=${sound.qualityProfile(quality).fps}`);
    args.splice(args.length - 1, 0, '-t', String(duration));
    assert.ok(!args.includes('desktop') && !args.includes('gdigrab'));
    return args;
  };
  const verifyStream = async (dir, quality, audio, startNumber) => {
    const playlist = path.join(dir, 'index.m3u8');
    const text = fs.readFileSync(playlist, 'utf8');
    assert.match(text, /#EXT-X-INDEPENDENT-SEGMENTS/);
    assert.match(text, /#EXT-X-ENDLIST/);
    if (startNumber) assert.match(text, /#EXT-X-DISCONTINUITY(?:\r?\n|-SEQUENCE:[1-9])/);
    const profile = sound.qualityProfile(quality);
    const segmentCount = Math.ceil(duration / Number(profile.segment));
    const retainedCount = Math.min(segmentCount, Number(profile.list));
    const firstNumber = startNumber + segmentCount - retainedCount;
    assert.match(text, new RegExp(`#EXT-X-MEDIA-SEQUENCE:${firstNumber}(?:\\r?\\n)`));
    assert.ok(text.includes(`segment${String(firstNumber).padStart(6, '0')}.ts`));
    const probe = await run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', playlist]);
    assert.equal(probe.code, 0, probe.stderr);
    const meta = JSON.parse(probe.stdout), video = meta.streams.find(s => s.codec_type === 'video');
    assert.equal(video.codec_name, 'h264');
    assert.equal(video.width, quality === 'cinema' ? 1920 : 1280);
    assert.equal(video.height, quality === 'cinema' ? 1080 : 720);
    assert.equal(video.pix_fmt, 'yuv420p');
    assert.ok(Number(meta.format.duration) >= retainedCount * Number(profile.segment) - 0.15);
    const audioStream = meta.streams.find(s => s.codec_type === 'audio');
    if (audio) { assert.equal(audioStream.codec_name, 'aac'); assert.equal(audioStream.sample_rate, '48000'); assert.equal(audioStream.channels, 2); }
    else assert.equal(audioStream, undefined);
    const segments = text.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
    assert.equal(segments.length, retainedCount, 'Playlist must honour the app rolling-window limit');
    assert.ok(segments.length >= 2, 'Need multiple segments to test independent playback');
    for (const segment of segments) {
      assert.match(segment, /^segment\d{6}\.ts$/);
      const keyframe = await run(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-read_intervals', '%+#1', '-show_packets', '-show_entries', 'packet=flags', '-of', 'json', path.join(dir, segment)]);
      assert.equal(keyframe.code, 0, keyframe.stderr);
      assert.ok(JSON.parse(keyframe.stdout).packets[0].flags.includes('K'), 'Each HLS segment must start with a keyframe');
    }
    const decoded = await run(ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-i', playlist, '-f', 'null', '-']);
    assert.equal(decoded.code, 0, decoded.stderr);
    if (audio) {
      const raw = path.join(dir, `decoded-audio-${startNumber}.f32`);
      const r = await run(ffmpeg, ['-nostdin', '-v', 'error', '-i', playlist, '-map', '0:a:0', '-f', 'f32le', raw]);
      assert.equal(r.code, 0, r.stderr);
      const data = fs.readFileSync(raw); let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += data.readFloatLE(i) ** 2;
      assert.ok(Math.sqrt(sum / (data.length / 4)) > 0.05, 'Decoded synthetic audio must not be silent');
    }
    return {playlist, streamMetadata: meta.streams};
  };
  try {
    await test('required capabilities and excluded libraries', async () => {
      const version = await run(ffmpeg, ['-version']); assert.equal(version.code, 0);
      assert.match(version.stdout, /--disable-libzvbi/);
      assert.doesNotMatch(version.stdout, /--enable-(gpl|nonfree|libzvbi|libx264|libx265)(?:\s|$)/);
      const enc = await run(ffmpeg, ['-hide_banner', '-encoders']); assert.equal(enc.code, 0);
      for (const name of ['h264_mf', 'libopenh264', 'aac']) assert.match(enc.stdout, new RegExp(`\\b${name}\\b`));
      const dec = await run(ffmpeg, ['-hide_banner', '-decoders']); assert.doesNotMatch(dec.stdout, /libzvbi/);
      const license = await run(ffmpeg, ['-hide_banner', '-L']); assert.equal(license.code, 0);
      assert.match(license.stdout, /GNU Lesser General Public License/);
      assert.match(license.stdout, /version 3/i);
      return {version: version.stdout.split('\n')[0]};
    });
    for (const codec of ['h264_mf', 'libopenh264']) for (const quality of ['interactive', 'cinema']) for (const audio of [false, true]) {
      const name = `${codec}-${quality}-${audio ? 'audio' : 'video'}`;
      await test(name, async () => {
        const dir = path.join(output, name); fs.mkdirSync(dir);
        const result = await run(ffmpeg, encodeArgs(dir, codec, quality, audio), {audio: audio ? pcm : null});
        assert.equal(result.code, 0, result.stderr);
        return verifyStream(dir, quality, audio, 0);
      });
    }
    await test('reconnect uses new media sequence and discontinuity', async () => {
      const dir = path.join(output, 'reconnect'); fs.mkdirSync(dir);
      // Keep the initial discontinuity segment in the playlist for inspection.
      // The interactive rolling window deliberately drops its oldest segments.
      for (const startNumber of [0, 30]) {
        const r = await run(ffmpeg, encodeArgs(dir, 'h264_mf', 'cinema', true, startNumber), {audio: pcm});
        assert.equal(r.code, 0, r.stderr);
        await verifyStream(dir, 'cinema', true, startNumber);
      }
    });
    await test('controlled encoder stop and fresh restart', async () => {
      const dir = path.join(output, 'controlled-stop'); fs.mkdirSync(dir);
      const args = encodeArgs(dir, 'h264_mf', 'interactive', false);
      args.splice(args.indexOf('-nostdin'), 1); args.splice(args.indexOf('-t'), 2);
      args.splice(args.indexOf('-f'), 0, '-re');
      const stopped = await run(ffmpeg, args, {stopAfter: 3000});
      assert.equal(stopped.code, 0, stopped.stderr); assert.equal(stopped.record.requestedStop, true);
      const restart = path.join(output, 'after-stop'); fs.mkdirSync(restart);
      const next = await run(ffmpeg, encodeArgs(restart, 'h264_mf', 'interactive', false));
      assert.equal(next.code, 0, next.stderr);
      return verifyStream(restart, 'interactive', false, 0);
    });
  } finally {
    for (const child of active.keys()) child.kill();
    const receipt = {startedWith: {ffmpeg, ffprobe, ffmpegSha256: hash(ffmpeg), ffprobeSha256: hash(ffprobe)}, syntheticInputsOnly: true, tvSessionStarted: false, audioDevicesChanged: false, pass: results.filter(r => r.pass).length, fail: results.filter(r => !r.pass).length, results, processes, activeChildrenAtEnd: active.size};
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(receipt, null, 2) + '\n');
    process.exitCode = receipt.fail || active.size ? 1 : 0;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
