# LG webOS MSE recurring freeze investigation — 24 October 2026

**Scope:** user-approved isolated I'm-accessibility TV experiment; separate `v0.3.15` draft. No change to original beta.

## Actual symptom and evidence

Owner directly observes the LG desktop at approximately **0.7–0.8 s behind the laptop** during smooth dedicated MSE/WebSocket playback, versus approximately 6 s on conventional HLS. However, every few minutes it can freeze, recover and freeze again.

In the real physical OLED55CX6LA setup, the authenticated PC sender remained connected and kept producing fresh fMP4 while the owner reported a stopped TV image: 1,800→1,809 fragments in four seconds, with low WebSocket buffered byte count. HLS remained fresh. The evidence does not prove the precise failure inside LG's native video plane; stalled or unstable MediaSource playback is the working diagnosis.

A read-only **120-second observation immediately after reloading the fast page with its v0.3.14 decoded-frame watchdog** observed two TV socket disconnections: one restart at about 22 seconds, then another at about 46 seconds; no new fast socket connection for the rest of the observation. Normal HLS remained healthy and Windows mouse input was disabled. This is consistent with the decoder watchdog first reloading and then invoking its bounded HLS fallback after repeated failures. It also proves the old decoder problem remains: a working watchdog is *not* the same as stable MSE playback.

## Candidate stability improvements (v0.3.15)

Old MSE buffering called `SourceBuffer.remove` whenever buffered history exceeded **6 seconds**, keeping only the last ~3 seconds. It also sought to the buffered live edge whenever lag exceeded **1.7 seconds**, potentially multiple times per second when fragments arrived. Frequent range removal and seek requests can interfere with older video decoders; **causation on this LG is not proven**.

The new candidate:

- Keeps a buffer of up to **24 seconds** before pruning.
- Rate-limits SourceBuffer pruning to once every **10 seconds** and never removes media within **8 seconds behind the active playhead** or **12 seconds of the buffered live edge**.
- Only seeks after more than **2.0 seconds** of lag, requiring at least 1.2 seconds of buffered history, and throttles seeks to at most once per **3.6 seconds**.
- Keeps the same 1280×720 H.264 Main profile, 15 fps, CRF 28, 128-kbps AAC, and roughly half-second direct fMP4 transport. It does not alter the working Windows mouse hit target, dropdown, TV sound destination controls or device pairing.
- Retains the bounded decoded-frame watchdog; one live-edge recovery attempt, then a dedicated-page reconnect, and after repeated failures return to 1-second native HLS. Windows mouse permission is revoked on fast-stream disconnect.

## Instrumentation to distinguish sender vs receiver

The same authenticated, owner-approved fast-video WebSocket now sends a tiny bounded client decoder-health record about every 2.2 seconds: position in milliseconds, actual decoded-frame counter (on this LG `webkitDecodedFrameCount`), video `readyState`, whether paused/visible, video buffer gap, and source fragment queue count. It does **not** contain screenshots, window titles, audio samples or user input. The backend strictly validates this fixed eight-field read-only schema (message type plus seven measurements), rate-limits messages, and rejects binary, oversized or command-like payloads. Its existing authenticated status endpoint reports the last decoder sample and its age, so the next freeze can be diagnosed without restarting the TV.

## Acceptance remaining

A real v0.3.15 physical-LG session must prove sustained decoded-frame progression across multiple minutes, no repeated fast disconnects, measured owner-observed delay still near 0.7–0.8 seconds, and sound availability. If the LG still stalls, retain v0.3.14 rollback and/or the original HLS. Do not declare this stability hypothesis proven on source tests alone. Preserve original installed beta and unrelated research projects.

## Physical v0.3.15 live test result

The v0.3.15 preview was installed in a fresh, isolated Windows profile with the owner's approved LG configuration; v0.3.14 was stopped gracefully, and the original installed beta was not modified. The real OLED55CX6LA browser opened the new dedicated fast-video page and returned decoder telemetry to the authenticated viewer service. Initial observation showed fresh 1280×720 MSE playback, `readyState=4`, decoded frames advancing and the separate HLS + default-speaker AAC source healthy.

A passive, read-only 138-second monitor spanning approximately **70–209 seconds after the fast session started** captured **24 out of 24 samples connected**, **zero fast stream closures**, and decoded frame count **984→2495**. Playback position increased **67.555→205.088 s** (near-real-time advancement). The buffer gap went **1.395→1.667 s**, and maximum observed client decoder no-progress age was **3.238 s**, below the 7.5-s corrective seek threshold. Mouse permission remained disabled; the HLS video/audio backup was independently observed live with no encoder restarts.

Evidence saved on owner's PC: `D:\ImAccessibility-WebOS-Input-Lab-20261023\LG_V0315_DECODER_STABILITY_20261024.json` (24 read-only samples; does not contain screen content). Windows source suite **119 discovered / 117 passed / 0 failed / 2 expected skips**, source-check passed. v0.3.15 ZIP `D:\ImAccessibility-Minimal-Preview-v0315-LGBufferStability-20261024.zip`, SHA-256 `783EB2F4E9B2B551C996A8686084D4DC86CF33920617A9AFFD09B2F24859DADA`, 76 files; ZIP extraction and payload manifest checked.

**Interpretation:** this test has materially better continuity than the earlier v0.3.14 120-second watch that saw two restarts and a switch to HLS. It does not prove days-long stability, audio audibility, mouse operation during live MSE, nor that the owner's 0.7–0.8-s perceived screen delay is maintained under this revised buffer policy; further hands-on acceptance is required.
