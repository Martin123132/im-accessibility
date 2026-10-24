# LG v0.3.16 integration status — 24 October 2026

This branch integrates the **source and native helper used by the isolated v0.3.16 LG acceptance-preview installation** with the current `main` history. It is a source-preview synchronization, **not a production release or hardware sign-off**.

## Scope of the observed hardware tests

- A 1280×720, 15 fps H.264 Main + AAC fast MSE/WebSocket viewer was observed on a physical LG OLED55CX6LA.
- The measured silent-speaker loopback PCM production improved from 30,491 frames/s to approximately 47,941–47,992 frames/s against the required 48,000 Hz. The corrected native helper is `tv-reliability-v0.5/cast/native/LoopbackCapture.exe`, SHA-256 `e0be8c56eddadef0f604906faa8cfe7cd7a120782d9cc24d55ceaab83f7a5995`, matching the isolated tested installation.
- During a six-minute read-only playback measurement, decoder frames increased from 8,416 to 13,794 (+5,378); no frame regressions, WebSocket disconnections or encoder recoveries were reported.
- The same combined stream was still connected after approximately 17 minutes and had reached 15,362 decoded frames, with a reported ~1.3-second *buffer lead* (not a measured end-to-end latency).

## Known, reproducible acceptance blocker

**The LG webOS browser subsequently displayed “Not enough memory to open this webpage.”**

- After longer combined playback, the TV disconnected from the fast WebSocket.
- Reopening the same fast viewer without rebooting the browser disconnected again shortly afterward and showed the memory error.
- A TV power cycle and a fresh viewer launch recovered a new live fast stream, but does not establish that cumulative browser memory pressure has been solved.
- MSE SourceBuffer pruning and page/decoder cleanup need device-level investigation. LG's embedded browser may consume memory outside JavaScript-visible buffers.
- Neither sound audibility/sync under real Windows audio nor 30–60-minute post-restart stability has been accepted by the owner.

## Git integration boundaries

- All TV changes are additive to the current `main` branch, including its stale-status-polling improvements. Those improvements alter two pre-existing controller JavaScript files relative to the running v0.3.16 package. The streaming video/audio helper, fast viewer and other tracked application sources match the tested revision.
- No owner profile, per-user settings, pairing secrets, runtime credentials, actual desktop recordings or captured media are included.
- Original stable installations and independent Codex/PC Bridge projects are separate and unchanged.
- Native Windows helper build provenance and third-party redistribution requirements must be reviewed before packaging a public distributable.
- **Keep this integration as a draft/acceptance preview.** Do not represent a passed unit test suite as physical LG memory-stability acceptance.
