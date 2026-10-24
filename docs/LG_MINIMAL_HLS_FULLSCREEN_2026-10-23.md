# LG full-screen desktop — minimal HLS viewer (23 October 2026)

**Status:** source-backed hardware trial; not a production release or validated Windows click.

## Design

This experimental v0.3.4 preview introduces `/full/<private-viewer-token>` as a separate, optional page beside the unchanged `/tv/<token>` legacy controls. It reuses exactly the existing HLS `/media/<token>/index.m3u8`, token-restricted `/api/status`, `/api/arm`, `/api/disarm`, `/api/mouse` and `/api/end` endpoints. It does not launch another desktop capture or change FFmpeg/encoding parameters.

The layout comes from a **hardware-tested one-button-over-HLS** page: a fixed full-viewport `<video>`, `pointer-events:none`, and an ordinary transparent `<button>` above it. It does **not** invoke `requestFullscreen()` or `webkitEnterFullscreen()`, both implicated in previous black-screen regressions on this LG. Separate always-visible Enable, Pause, Play, Return to original controls and double-confirmed End buttons remain available. Mouse controls start OFF and the original ten-minute lease/rate-limit rules still apply.

## Real LG tests

On the actual paired LG OLED55CX6LA, testing the exact HTML/CSS from the new minimal viewer through a no-Windows-input same-origin diagnostic server recorded:

- **13 HLS media segments**, 10 playlist requests
- **2 video-playing events**
- **1 real LG HTML button click**
- No Windows input from this isolated diagnostic page
- Original LG browser viewer reopened

A more direct test temporarily placed the same minimal full-screen page into a **separate installed test profile**, with `cmd:'click'` deliberately replaced by `cmd:'move'` in that temporary JavaScript. With a ten-minute mouse lease intentionally armed, a paired-LG remote-socket OK press reached the existing Windows native pointer service. Its action counter rose from 4 to 5, recording a safe `move` to desktop coordinates **(1017, 534)**, not a click. The lease was disarmed afterward.

A dedicated harmless Windows test-button window was started, but Windows retained **Media Player** as the foreground application. The native `SetForegroundWindow` attempt failed. Consequently **no actual Windows click was sent**, because it could have reached an unrelated application. The temporary form was closed.

All temporary viewer changes were rolled back byte-for-byte; the physical LG browser was reopened, HLS reported running, the viewer reported ready/sourceReady and mouse permission was OFF. The installed original stable beta and research were untouched.

Private local receipts:
- `D:\ImAccessibility-WebOS-Input-Lab-20261023\LG_REAL_BROWSER_MINIMAL_SOURCE_HLS_TEST.json`
- `D:\ImAccessibility-WebOS-Input-Lab-20261023\LG_REAL_MINIMAL_VIEWER_INPUT_RECEIPT.json`
- Pretrial rollback files: `D:\ImAccessibility-WebOS-Input-Lab-20261023\minimal-viewer-test-backups`

## Remaining acceptance

Verify the newly integrated `/full/` route from the actual packaged v0.3.4 build, then use a clearly foreground, harmless Windows test target to prove that a real LG pointer click changes Windows and that Pause rejects subsequent clicks. The existing remote click pad and JPEG preview stay available in the legacy viewer. Do not publish or merge this as a finished product before that physical result, Windows 11 clean install and native-helper provenance review.
