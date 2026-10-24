# LG optional fast desktop video — MSE/WebSocket experiment (24 October 2026)

## Why a second transport

Owner reports **~6 seconds of actual Windows-to-LG delay**. Shortening ordinary HLS to half-second segments was *worse* on the physical OLED55CX6LA: a 6.001-second wall-clock sample advanced the LG video 3.499 seconds with a 2.9-second gap to its buffered live edge. The earlier 1-second HLS sample advanced 5.706 seconds with a 1.294-second live-edge gap. Neither is an exact end-to-end human-perceived delay.

The LG browser's actual JavaScript capability probe reported `MediaSource`, `WebSocket` and H.264 + AAC fragmented MP4 all supported. A separate 15-second *synthetic* transport test delivered 37 media messages (1 init and 36 fragments), played 1280×720 H.264/AAC on the LG, achieved ~1.00-second final buffered gap and reported no decode errors.

A further **real Windows desktop + Realtek default-speaker WASAPI** test independently delivered 44 media messages (1 init, 43 fMP4 fragments; 5,437,647 total bytes). The LG played 1280×720 H.264/AAC, its final buffered gap was ~1.67 seconds and the browser reported no errors. It restored the original LG full-screen desktop viewer afterward. **These are playback-gap measurements, NOT confirmed end-to-end latency improvements.**

## Draft v0.3.11 integration

This test adds **Try faster video (experimental)** to the *existing bottom-right Controls dropdown*. The ordinary HLS video is unchanged and remains the default. The user explicitly selects fast video to open one additional authenticated WebSocket on the existing local viewer port 43198. The same full-viewport HTML Windows-click surface, separate audio controls and mouse Pause logic are preserved.

The optional module:

- Authorises the exact private 64-character viewing token, same-origin HTTP/WS, selected Windows LAN/subnet, 4-hour maximum session and **one** active receiver.
- Captures the same desktop at 1280×720, 15 fps, H.264 CRF 28, libx264 veryfast, AAC 128k stereo, using the verified default **speaker-output** endpoint, never a microphone.
- FFmpeg produces fragmented MP4 with approximately half-second keyframe fragments, which are size-bounded and streamed through the pinned `ws` dependency (already redistributed as MIT in the preview).
- Uses LG browser MediaSource/SourceBuffer to append fragments and follow the buffered live edge. It bounds queue size, media stall interval, and server memory.
- On unsupported codecs, WebSocket disconnect, encoder failure, decoder error or queue overrun, it restores the original native HLS source. Return to HLS is also a visible menu action.
- Does **not** change the existing LG browser/webOS configuration, force native fullscreen, install a TV app, alter Windows mouse-control APIs or modify the original beta.

**Limitations:** Fast mode uses an additional Windows capture while active and may consume additional CPU/GPU resources. The fallback HLS stream stays running for recovery. A 15–20-second physical real-desktop test validates decodability and bounded buffering, but sustained 4-hour run stability, picture-clicking while MSE is active, real end-to-end display latency, audible A/V sync and Windows 11 installation must still be accepted. Do not claim 1-second real input-to-display latency from the 1–2-second MSE buffer observation alone.

Official technical context: LG webOS 5 supports MSE (https://webostv.developer.lge.com/develop/specifications/streaming-protocol-drm). The physical LG browser identified itself as Chrome/79. An LG developer forum response in January 2026 said WebRTC access was limited to contracted partner apps; no WebRTC deployment is presumed or used here.

Source validation: **110 discovered, 108 passed, 0 failures, 2 expected skips** and standard source check passed prior to packaging.
