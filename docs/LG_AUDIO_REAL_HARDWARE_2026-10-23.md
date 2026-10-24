# LG desktop-audio hardware investigation — 23 October 2026

**Status: playback transport physically tested; continuous application audio and audibility not yet accepted.** This is research for draft v0.3.4 only. The original installed beta was not modified.

## PC speaker-output source

The existing FFmpeg capture used `-an` (video only). FFmpeg's available DirectShow capture endpoints were the webcam and Realtek microphone, **not** a Windows speaker loopback. Recording the microphone would be the wrong feature.

A separate local lab installed the BSD-3-Clause `SoundCard==0.4.6` WASAPI library, pinned by the published PyPI wheel SHA-256:
`ab44b8c1033ac6ec49c5d618ce096dab9b60c7d7a427c92bef15856e5ebb3e09`.
It opened **Speakers (Realtek High Definition Audio)** as a verified WASAPI **loopback**, not an input microphone.

A three-second live measurement returned 288,000 interleaved stereo samples at 48 kHz (144,000 frames); peak 0.985275 and RMS 0.284187. No raw microphone audio or PCM recording was saved.

## Isolated HLS mux proof

In the separate `D:\ImAccessibility-WebOS-Input-Lab-20261023` test folder, a Node pilot combined the unchanged existing live 1280×720 H.264 HLS video source with 48-kHz stereo float PCM from WASAPI, transcoding **audio only** to AAC and copying the original video. FFmpeg exited 0 without timing out; seven MPEG-TS HLS segments were verified by FFprobe to contain both H.264 video and 48-kHz two-channel AAC audio.

The pilot did **not** modify the running Windows capture/viewer, enable microphone access, issue any Windows mouse input or overwrite installed application files.

## Physical LG OLED55CX6LA trial

A temporary token-scoped LAN diagnostic served that short combined clip through native LG browser HLS. The actual paired television returned:

| Receipt | Count |
| --- | ---: |
| HTML page loads | 1 |
| Playlist fetches | 1 |
| HLS media segment requests | 7 |
| Browser video-playing events | 2 |
| Remote-OK sound-enable HTML clicks | 1 |
| Unmuted `video.play()` confirmations | 1 |
| Browser video errors / play failures | 0 / 0 |
| Original viewer restored | Yes |

The safe test offered **no Windows input API**. The TV's volume/mute settings were not changed. A browser confirmation and the presence of AAC do **not** by themselves establish that audio was physically heard through the speaker.

Sanitised receipts and the isolated test source remain in the owner's local audio lab. Private pairing keys and session tokens are not in this repository.

## Follow-on integration gates

- Convert the 13-second independent capture into a supervised, session-bound continuous audio source, with a bounded no-audio/video-only fallback.
- Package or explicitly install a provenance-reviewed WASAPI audio capture dependency; the current Python SoundCard lab environment is not bundled into the v0.3.4 ZIP.
- Present the combined source through the authenticated **same-origin** full-screen viewer. The separate Sound OFF / Sound ON button is present in the draft source, but the current installed HLS stream remains video-only.
- Confirm **audible playback** on the actual TV, sustained A/V synchronisation, Pause and End semantics, screensaver continuity, and recovery after device changes.
- Complete the still-outstanding harmless **real Windows click** and server-side Pause acceptance test. The browser→Windows move-only evidence does not substitute for this.

This does not constitute general-release validation.
