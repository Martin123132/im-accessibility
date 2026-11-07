# Windows one-click installer: pinned LGPL FFmpeg candidate

**Status: source-only release candidate. Not approved for a public binary release.**

This branch tests replacing the previous GPL-enabled FFmpeg package with a separate, explicitly pinned **LGPLv3-or-later Windows FFmpeg build** while preserving the owner-verified original x264 implementation as the default for existing installations.

## Reproducible upstream binary identity

- Upstream publisher: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)
- Release: [autobuild-2026-11-07-12-47](https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-11-07-12-47)
- Asset: `ffmpeg-n9.0.2-48-gd4070a14ce-win64-lgpl-9.0.zip`
- Upstream FFmpeg source revision: `d4070a14ce`
- ZIP SHA-256: `7a347fb3220968b63fc7e025ed78370588726e0d0bf2bd0445d3f8f2387c36db`
- `ffmpeg.exe` SHA-256: `71ac0a64a4e3e0caaf7a8c25c7e73d161ac1b269cca930d207e89e1b23959dfb`
- The upstream archive contains LGPLv3 notice; FFmpeg `-L` says LGPLv3-or-later, and its configuration reports `--disable-libx264` and `--disable-libx265`, with neither `--enable-gpl` nor `--enable-nonfree`.
- Supported codecs verified on the Windows development host: `h264_mf` (Windows Media Foundation), `libopenh264` and native AAC. GDIGRAB desktop capture is present. These facts alone **do not** prove all dependency redistribution obligations are met.

## Runtime behaviour

- The checked-in HLS codec selector permits `libx264` (legacy), `h264_mf` and `libopenh264`, rejecting unexpected values.
- Normal existing installations without an encoder profile retain their original x264 arguments. Nothing changes the owner-installed program.
- The private candidate installer embeds `encoder-profile.txt` with `h264_mf` **only if the FFmpeg binary SHA-256 matches the upstream LGPL pin**. The GUI passes this validated profile to the Node video service; it is not a free-text command entry.
- Existing interactive and Cinema HLS streams keep the same resolutions, frame rates, keyframe targets, stream ownership and audio opt-in. The experimental fast MSE path is disabled for LGPL codecs pending decoder acceptance; normal HLS remains available.
- `libopenh264` is a separately tested software fallback. It is not currently an automatic runtime fallback.

## Isolated tests on 7 November 2026

- Existing source suite: **208 passed, 2 expected skips, 0 failed**.
- Synthetic 1920×1080 / 30 fps HLS with AAC successfully encoded and decoded using both LGPL H.264 encoders.
- Private Windows installer candidate: **92/92 payload files checked**, no private-data flags, no FFmpeg GPL build flag; vendor SHA pin matched and all three project-native helper binaries passed source-correspondence checks.
- An **isolated fresh-profile installer verification** returned `SUCCESS VALID` for 92 files. `--test-install` returned success with no pre-existing TV settings.
- The installed app contained exactly the pinned LGPL FFmpeg and `encoder-profile.txt` set to `h264_mf`; the UI reported **12 named, keyboard-reachable controls**, and the first-run doctor found bundled Node/FFmpeg without requiring separate installations.
- Generated HLS from the **installed app's actual video arguments**, replacing only real desktop/speaker input with synthetic sources: interactive Media Foundation video-only, Cinema Media Foundation with AAC, and Cinema OpenH264 with AAC. All generated segments decoded successfully.
- The separate copy of the installed uninstaller completed `--test-uninstall` successfully; the disposable installed application directory was absent afterward.
- No physical TV playback or real desktop/speaker capture has yet been accepted for this LGPL candidate. The installed owner LG application and its scheduled tasks were not changed.

## Remaining release gates

1. Review/retain corresponding sources, actual build scripts, transitive component licences and required attributions for the *specific* pinned upstream LGPL distribution. An LGPL executable being present is **not** sufficient proof of full conveyance compliance.
2. Confirm distribution rights for project code and the currently PolyForm Noncommercial-licensed repository, native helper copyrights and any commercial intentions.
3. Windows publisher signing/SmartScreen and independently performed Windows 11, Narrator/NVDA, first-user TV pairing and physical moving-video/audio acceptance.
4. Review hardware compatibility, particularly fallback selection when Media Foundation encoding is unavailable, and confirm proper stop/speaker restoration on genuine receiver disconnect.
5. Final owner release approval.

The release auditor deliberately reports `readyForPublicDistribution:false` until those checks are actually complete. **Do not publish any of the private QA .exe files, bundled node/ffmpeg binaries or private pairing state as GitHub Release assets.** This branch is a source-level candidate for review, not a downloadable customer release.
