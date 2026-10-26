# LG MSE browser-memory management candidate — 24 October 2026

This is an isolated, **untested-on-hardware** candidate based on the v0.3.16 GitHub source-preview integration. It does **not** replace the version currently streaming on the owner's LG.

## Observed fault

After a longer fast H.264/AAC WebSocket/MSE session, the physical LG webOS browser displayed: **“Not enough memory to open this webpage.”** Refreshing/reopening the browser without freeing the application memory led to another rapid disconnect. A TV socket power cycle allowed a new low-latency fast stream.

The PC stream remained ready throughout and the server reported zero encoder recoveries. Browser-memory exhaustion is real; which browser or decoder allocation caused it remains unmeasured.

## Narrow code change

In `tv-reliability-v0.5/viewer/web/fast-video.js`:

1. When an owned fast MSE session ends or fails, close its WebSocket, clear the JS fragment queue, explicitly release its `SourceBuffer` when safely possible, pause/detach the video, call `video.load()` to request decoder resource release, revoke its MSE object URL, and drop references. Leave any unrelated pre-existing HLS video element untouched.
2. During periodic SourceBuffer trimming, identify the **earliest** buffered range instead of only the most recent range. This prevents stale disjoint media ranges from indefinitely evading old-frame pruning after live-edge seeks. Existing limits retain at least eight seconds behind the playing position, twelve seconds at the end, and avoid repeated trims closer than ten seconds.

## Automated tests

- New tests assert that stale disjoint buffered ranges are pruned and that controlled MSE shutdown requests SourceBuffer/decoder release.
- Targeted MSE tests: 15 passed, 0 failed.
- Full regression suite: 125 passed, 0 failed, two expected skips.
- Source check passed.

These tests use browser mocks. No memory use was measurable on the physical LG in this candidate and it has **not** demonstrated prevention of browser OOM.

## Required next acceptance work

- Build into a **new isolated test profile** with native binary checksum preservation and no edits to currently installed v0.3.16.
- Trial after the owner stops their existing session; check video quality, actual latency, sound, mouse permissions and any browser-MSE-related error.
- Physically run **30–60 minutes** on the LG before considering a fix accepted.
- If OOM recurs, investigate alternate LG-native transports or a browser lifecycle boundary rather than simply increasing buffering.

Do not promote this memory candidate to a public release, install it into the working app, alter original beta, or disturb Codex.
