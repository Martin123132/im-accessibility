# LG fast-video decoder stall recovery — 24 October 2026

**Status:** draft v0.3.14, separate Windows test installation. The main installed beta remains untouched.

## The owner's result and the incident

The user directly observed around **0.7–0.8 s** of laptop-to-LG screen delay with the dedicated full-screen MSE/WebSocket fast-video viewer, down from approximately **6 s** with HLS.

During that successful session, the LG desktop picture later stopped changing. This was not an intentional stop action. At inspection, the physical LG browser and Windows media service were still connected; the optional fast FFmpeg process remained running, as did the project-owned Windows speaker-loopback capture. The original HLS encoder, four-hour supervisor and status services also remained healthy; Windows mouse input was disabled. A reload of **only** the private dedicated LG fast viewer returned the picture to live playback.

The physical LG browser then produced a **5.888 s playback advance over 6.001 s of elapsed time** at about 1.024 s behind its buffered edge, with zero reported playback errors, and its HTML/JavaScript byte content was restored exactly after the hardware measurement. A second six-second test showed **5.955 s** of playback advance and an LG `webkitDecodedFrameCount` increase **16 → 104**. Browser `getVideoPlaybackQuality()` did not return a numeric counter in that probe; the older webOS Chrome 79 `webkitDecodedFrameCount` *did* advance accurately. Decoder progress is therefore measurable on this actual LG and is a stronger freeze signal than mere WebSocket connectivity.

The precise root cause of the intermittent LG decode stall remains unproven. We must not claim that the encoder stopped: during the incident both active media encoder and WebSocket connection were still present. No source files or other projects were altered on the owner's PC during recovery.

## Bounded self-healing behavior

The separate MSE decoder client now checks for playback progress every ~1.1 s. It prefers actual decoded-frame advancement (including counter resets) on this LG, falling back to HTML video currentTime only when the frame counter is unavailable. It does not interpret a hidden tab or an intentionally paused/unready video element as a freeze.

If decoded frames have been static for over **7.5 s** while playback appears active, it first attempts a small seek toward the live buffer edge, without downgrading picture quality. If progress is still absent after another **3.5 s**, it requests a fresh document for the **same private fast-viewer URL**. The recovery counter is bounded to two reconnect attempts within a 120-second window using same-origin sessionStorage, and persistent failures return to the original known-working HLS page instead of refreshing indefinitely. If sessionStorage is blocked, fail safely to HLS.

The client attempts to POST the authenticated mouse-disarm request before navigating. Independently, server-side WebSocket disconnect cleanup automatically revokes the Windows mouse permission (including its ten-minute lease), so a stale picture cannot retain native click privileges merely because the browser lost connectivity.

The authenticated /api/status response now reports a bounded `fastVideoStatus` with active/connected state, fragments sent, last media age and WebSocket buffering; it exposes no secret URL or Windows input capability. These details help distinguish desktop capture stalls from LG decoder stalls on subsequent incidents.

## Validation and rollback

New deterministic VM tests simulate an LG decoder whose frame count stops advancing while MSE packets keep arriving; verify live-edge nudge, bounded document reload, authenticated disarm, repeated-failure HLS fallback, healthy decoded-frame progress, and server-side native-click revocation. The v0.3.13 deployed source and GitHub draft PR #20 remain preserved as a known low-latency checkpoint.

Owner's **0.7–0.8 s** is a human-observed real end-to-end estimate, not a laboratory-certified measurement. Future tests must check sustained fast playback, repeated recovery, audio return, Magic Remote clicking after reconnect and independent Windows 11 install.

No change to 1280×720 H.264/AAC bitrate or CRF, no new TV application, no native LG fullscreen API, and no keyboard/microphone access.


## 24 October 2026 continuation — preserved fast session

The owner supplied a 15.17-second phone video showing the laptop and LG displaying the same Windows browser workspace; this illustrates the mirroring arrangement but does not independently establish an exact sub-second delay because both screens are not consistently visible simultaneously. The owner's direct side-by-side estimate remains **0.7–0.8 s**.

A non-interrupting PC check verified that the separate original HLS cast remained fresh with audio active and no recent new recoveries; the actual *fast fMP4 encoder* and an established 192.168.4.23-to-192.168.4.36:43198 connection remained active. The seven core installed fast-viewer, cast and control files matched the isolated source by SHA-256. The 4-hour owner session was not stopped or modified.

One additional freeze guard prevents an LG player stuck with \`readyState < 2\` or \`currentTime=0\` from resetting the watchdog timer forever: absence of decoded-frame progress is now recoverable even before the first frame. New deterministic tests simulate that startup hang. The Windows source suite now has **115 discovered, 113 passed, zero failures and two expected live-snapshot skips**, with the source check passing. **No full live-webOS acceptance of the new automatic recovery behaviour yet:** preserving the current sub-second video stream remains higher priority than forcing an artificial TV stall.
