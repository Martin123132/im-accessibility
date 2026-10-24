# Full-screen Windows input and Windows speaker audio — LG physical acceptance (23 October 2026)

**Status:** laboratory hardware acceptance on the owner's actual LG OLED55CX6LA; source/ZIP still a draft preview, not a validated clean-install release.

## 1. Full-screen real Windows click and Pause

The new v0.3.4 minimal full-screen HLS HTML/CSS/JavaScript assets were temporarily substituted for the existing `/tv/` viewer assets in an **isolated, installed test profile** only. Original bytes and SHA-256 hashes were archived before substitution, and restored in a `finally` recovery step. The production beta and other Windows projects were untouched.

A harmless, topmost WinForms button was displayed across the Windows desktop. Before sending LG input, Windows `WindowFromPoint` and `GetAncestor(GA_ROOT)` checks on multiple representative desktop coordinates confirmed that the click target was the harmless test program, not Media Player or any research application. Media Player continued to hold keyboard focus; mouse hit-testing identified the harmless button.

The physical LG model and foreground browser were verified. An existing owner-authorised short mouse lease was armed by the local authenticated mouse API, then the LG's **paired network pointer/OK socket** clicked the full-screen HTML surface. The original authenticated native Windows mouse service recorded exactly one click.

| Receipt | Result |
| --- | --- |
| Physical LG model | OLED55CX6LA |
| Browser HTML overlay used | Yes, while the existing HLS source was available |
| Window hit-testing safe at four positions | Yes |
| Windows mouse-action counter | 5 → 6 |
| Native Windows action | `click` |
| Native clicked coordinates | (958, 534) |
| Windows test button created its success receipt | Yes |
| Authenticated mouse Pause/disarm | Succeeded |
| Subsequent LG OK click after Pause | Rejected; counter remained 6 |
| Final native mouse service permission | Off |
| Original test-profile files | Restored, SHA-256 checked |
| LG original viewer | Reopened |

**Input-method distinction:** the physical television was used, but LG inputs were sent through its paired network remote interface. A human hand-held Magic Remote OK press and an on-screen Pause-button press remain separate final usability checks. The successful Pause rejection here was verified through the authenticated service's `/api/disarm`, followed by a second actual LG browser click.

Sanitised local receipts and recovery files are in `D:\ImAccessibility-WebOS-Input-Lab-20261023`; no pairing keys or live URLs are published.

## 2. New native audio helper

A small .NET Framework/Windows WASAPI helper was built entirely from project-owned C# source. It enumerates the Windows **default playback/renderer** endpoint in eMultimedia mode. It does not open a microphone.

- Helper source: `tv-reliability-v0.5/cast/native/LoopbackCapture.cs.txt`
- Helper binary: `tv-reliability-v0.5/cast/native/LoopbackCapture.exe`
- Binary SHA-256 on this Windows build: `85BD4172915CBB724BCE0ED72AFA41DDE2A22893389D2AC7CA561DAC748D3E36`
- Hardware probe: `f32le`, 48000 samples/s, two channels (Realtek playback endpoint)
- Native helper/FFmpeg experiment: nine HLS segments with copied desktop H.264 1280×720 and AAC 48000-Hz stereo

A further physical LG browser test of the *native-helper-derived* HLS clip recorded six media segments, two video-playing events, one sound-enable HTML click, one resolved unmuted `video.play()` response, zero browser play failures and restoration of the original viewer.

No claimed microphone capture, no permanent sound recording, and no changes to system speaker volume or OLED protections. Temporary audio-encoded HLS media was deleted after testing.

The `cast/server.cjs` branch now has an opt-in speaker HLS capture; the normal `Start.cmd` remains video-only, while `StartSound.cmd` opts into Windows speaker-loopback capture. The full-screen Sound button is disabled unless the authenticated cast source reports audio available, and HLS autoplay remains muted until owner interaction. Audio-helper failure requests video-only fallback.

**Remaining audio acceptance:** confirm actual audible sound from the TV speakers and sustained audio/video synchronisation; test continuous source interruption and default-device changes in the integrated live service. The physical LG test validates browser transport and sound enablement, not perceived audibility.

## 3. Automated tests and distribution

Windows source tests: **95 discovered, 93 passed, 0 failed, 2 expected live-HLS skips**. Source check passed. The v0.3.5 portable preview is an isolated build; general Windows 11 clean installation, binary build provenance, independent hardware acceptance and licensing review remain release gates.

Do not conflate passing source tests, browser audio events, or network-remote input with full consumer-release acceptance.
