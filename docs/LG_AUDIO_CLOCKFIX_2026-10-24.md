# LG audio-clock fix — v0.3.16 isolated acceptance candidate
Recorded: 24 October 2026. Experimental test preview only; not an approved release.

## Reproduced Windows timing defect

The original speaker-output WASAPI helper declared 48,000 Hz, 2-channel float32 PCM but on a silent speaker endpoint emitted 30,491 PCM sample frames per second over a ~14-second benchmark (63.5% of declared sample rate). The independent TV Web Audio test experienced audio underruns. This is proven audio starvation, but not yet proven to be the only cause of the LG MSE video decoder freezes.

Root cause: original silence fill was limited to 480 frames (10ms at 48kHz) per Thread.Sleep(8) wakeup, while Windows scheduling on this computer could pause closer to 15.6ms. The corrected helper fills the monotonic Stopwatch-versus-emitted-frames deficit with bounded PCM chunks up to 125ms, retaining 12.5ms headroom. Source still calls default Windows render/speaker endpoint, never the microphone.

## Checked native source and compiled binary

Modified source: tv-reliability-v0.5/cast/native/LoopbackCapture.cs.txt
Source SHA-256: 606D1F2C8B853C24805C5F9C38C05DDD09725EBC4081864DC82310A2B7FA52C0

The same source bytes were verified against original experimental compiler input in D:\ImAccessibility-WebOS-Input-Lab-20261023\LoopbackCapture-clockfix-t11.cs.

Compiled with Windows .NET Framework CSC 4.x /nologo /target:exe /optimize+ /platform:anycpu on owner's Windows computer.
Tested compiled helper SHA-256: E0BE8C56EDDADEF0F604906FAA8CFE7CD7A120782D9CC24D55CEAAB83F7A5995.
Recompiling under a different output assembly filename yields a different binary checksum despite the same probe; byte-for-byte reproducibility is not claimed. The original tested and verified helper is the binary chosen for the v0.3.16 isolated candidate.

## Independent measured improvement

Old native binary: 30,491 frames/sec.
Corrected binary: 47,941 frames/sec, 99.9% of 48kHz target.
Audio format and endpoint identity stayed 48000 Hz, 2 channels, f32le default speaker output. No microphone, audio disk recording or production install.

Old executable backup in lab: D:\ImAccessibility-WebOS-Input-Lab-20261023\LoopbackCapture-old-binary-before-v0316-t13.exe
Benchmark files: loopback-pcm-clock-benchmark-t11.cjs and loopback-clockfix-benchmark-t11.cjs in the same lab folder.

## Scope and acceptance

This test candidate should preserve H.264 1280x720, 15 fps, CRF28, AAC128k, native HLS fallback, LG Magic Remote click overlay, screen layout, and laptop/TV sound routing. It must never modify the owner's original installed beta, v0.3.15 test installation, Codex processes or other projects.

A complete package integrity check, independent source tests, and on-TV 5–10-minute combined MSE H.264/AAC physical test with decoded-frame telemetry are required. Confirm picture latency and actual sound with owner. If the full AV stream still stalls, evaluate separated H.264-only MSE video and Web Audio sound as a further experiment. Do not declare the LG freezes fixed solely because the PCM rate is now correct. Keep GitHub PR #20 a draft.
