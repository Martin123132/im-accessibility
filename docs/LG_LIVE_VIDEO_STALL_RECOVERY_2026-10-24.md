# LG HLS frozen desktop and latency: source-backed investigation (24 October 2026)

**Scope:** v0.3.9 draft test installation. Preserve the original installed beta and all independent Windows research projects. This report does not declare the application released.

## Real incident

On the LG OLED55CX6LA, network remote clicks and the Windows mouse action counter still worked, but the desktop image no longer reflected opened or closed windows.

A read-only examination of the isolated v0.3.8 test installation showed:

- FFmpeg process still alive (PID 27188); cast control reported `state:running`.
- Cast `streamReady:false`; `index.m3u8` last modification **168 s** old, advancing beyond 210 s during investigation.
- The TV continued requesting media (cast `watchHits` increased), although no new segments were published.
- Latest six HLS playlist entries (`segment001260.ts`–`segment001265.ts`) were stale.
- The separate mouse service returned `sourceReady:true` merely because the four-hour source *permission* had not expired; this **incorrectly implied live video was healthy**.
- Last decoded MPEG-TS segment contained aligned 1-second H.264 1280×720 video at 15fps and AAC 48kHz stereo audio. Presence of valid old segments was not evidence of live screen updates.

**Observed conclusion:** frozen *capture/encoder production* rather than loss of Windows input or failed LAN connectivity. The exact internal FFmpeg blocking cause has not been conclusively isolated.

## Immediate restoration

The owner-controlled authenticated cast API stopped only the stalled FFmpeg capture, waited for its process to exit, then started a new capture, leaving the LG, source authorisation and other Windows applications intact. The native HLS viewer was reopened on the real LG to refresh the live player. The subsequent capture had a different PID, `streamReady:true`, and its HLS manifest was observed advancing again with a latest segment age of approximately 0 s. Windows mouse permission was disarmed during recovery; laptop audio remained available.

## Permanent draft changes

1. **Producer watchdog:** the cast service checks HLS playlist modification time every 1.5 s. A running FFmpeg process with an HLS manifest older than **8.5 s**, beyond the initial 14 s startup grace, is treated as stalled. It is terminated as an owned child and restarted. Recovery attempts are bounded to four per two-minute window, preventing an uncontrolled crash loop.
2. **Audio-safe fallback:** the first stalled A/V process is restarted with its original HLS audio. If another stall occurs soon afterward, the service falls back to **video-only HLS** rather than permitting the desktop to remain frozen. Unexpected FFmpeg process exits are also boundedly restarted, with video continuity prioritised.
3. **Monotonic media numbering:** after stopping the capture, the next segment sequence starts above the old highest six-digit segment number, rather than silently reusing `segment000000.ts` and confusing client caches. FFmpeg's documented `-start_number` option is used within the session.
4. **Actual source health:** the viewer obtains `streamReady`, playlist age and recovery counter from the cast service—not merely source-lease expiry. A stalled source also immediately disarms Windows mouse permission and refuses arm/click requests, preventing invisible desktop actions while the TV picture is outdated.
5. **LG native video recovery:** the existing H.264 HLS `<video>` element stays the full-quality player. On reported encoder recovery or a locally frozen native playhead, the browser attempts a bounded `video.load()`/play. Where webOS exposes a seekable live window, playback seeks forward after significant drift, staying about 1.5 s behind the live edge. No JPEG snapshot replacement, fullscreen hardware-layer changes or animation.
6. **Smaller HLS live window:** the encoder retains four 1-second playlist entries (previously six); HLS GOP remains 15 frames / 1 s at 15 fps. This aims to reduce native-player backlog without changing 720p resolution or encoding quality. Actual end-to-end latency must still be measured on the physical LG.
7. **Manual recovery:** an extra `Catch up picture` button inside the existing bottom-right collapsed Controls menu lets the viewer request a bounded native-video refresh without granting Windows input permission.

## Tests and limits

Windows source tests after these changes: **106 discovered, 104 passed, 0 failed, 2 expected live-snapshot skips**; repository source check passed.

Supported LG webOS native HLS playback has its own buffering floor. FFmpeg's ordinary HLS segments are not equivalent to full Apple LL-HLS with partial segments, blocking reloads and preload hints. Do not claim sub-second end-to-end latency on the basis of a shorter playlist alone.

**Remaining acceptance:** physically observe a fresh desktop on the LG while manipulating an innocuous Windows window, measure picture lag against the laptop, exercise the automatic watchdog under a real stall, check that TV/Laptop audio routing and the screensaver guard survive recovery, and verify the owner's handheld Magic Remote controls. Keep draft status until those tests pass.

Technical context: LG webOS streaming limitations (official LG documentation), FFmpeg HLS muxer options and the owner's physical LG receipts.

## Measured LG latency and half-second experiment

The owner reports about **six seconds end-to-end** from Windows action to the LG picture, after the earlier stall was recovered. The separate browser measurement of a **1.29 s gap to `video.seekable.end()`** is *not* end-to-end latency. Do not substitute these measurements. Source-production diagnostics also showed: after about 199.35 s of encoder runtime, the newest video MPEG-TS PTS was about 199.4 s and its segment age about 0.08 s. There is no evidence of a four-to-five-second encoding queue from these clocks; extra lag may arise from LG HLS fetch/buffer policies or render timing, not yet isolated.

A disposable native speaker-loopback + desktop-capture experiment used the same 1280×720 resolution, CRF 28, 15 fps and AAC quality, but shortened keyframes to 8 frames and HLS target segments to **0.5 s**. FFmpeg produced segments with measured EXTINF durations **0.533333, 0.533333, 0.533333 and 0.466667 seconds**. The physical OLED55CX6LA LG browser accepted the resulting stream, fetching eight segments and reporting two video-playing events, a successful sound toggle/unmute, zero playback errors and original viewer restoration.

This supports a **separately packaged experimental v0.3.10** with half-second HLS and a narrower live-edge seek target. It does *not* prove the owner's six-second end-to-end delay is reduced yet: acceptance needs a new simultaneous Windows/TV comparison on the live installed preview. The v0.3.9 one-second capture remains a source-backed fallback; previous installed beta is unchanged.
