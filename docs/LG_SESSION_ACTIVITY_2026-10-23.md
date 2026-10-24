# LG OLED viewing session continuity and active-video screensaver guard

**Date:** 23 October 2026 · **TV:** verified LG OLED55CX6LA, webOS 5.x · **Status:** verified narrow hardware mechanism, candidate integration pending acceptance

## Problem 1 — desktop disappears after a short period

The isolated LG test was originally run as a *managed remote command* with `max_runtime_seconds=600` (ten minutes). The Bridge terminated that command and its child video/viewer processes on reaching the tool runtime limit. The app itself sets a separate four-hour session limit; the shorter test-runner ceiling was the immediate cause of the apparent repeated loss of video. This was not a user action or a scheduled TV screen-off.

**Fix for hardware sessions:** launch the video supervisor as a bounded managed process with a timeout longer than its four-hour session lifetime, or use the existing user-approved on-demand task with its 255-minute cap. The app stops itself at four hours and respects Stop. A remote command with a 10–20-minute lifetime is **not** valid evidence of four-hour continuity.

On the actual LG, a four-hour supervisor was launched from the separate test profile. Video and viewer each responded healthy; the physical LG established receiver connections and reported browser launch.

## Problem 2 — LG OLED screen saver while the viewer appears active

LG's published webOS guidance states the screensaver remains active unless video plays in full screen. The browser's HTML layout was not reliably treated as a true native full-screen video by this television. A read-only LG SSAP request `com.webos.service.tvpower/power/getPowerState` returned `state: "Screen Saver"` while `getForegroundAppInfo` showed the LG browser and the video receiver was healthy.

**Real LG acceptance of the mechanism:** with the authorised LG connection, a single one-pixel `getPointerInputSocket` `move` command changed the television's power state from `Screen Saver` to `Active`, without a click, keyboard input, TV settings changes or effect on Windows. This is a real hardware observation, not a simulated browser test.

## Guard implementation

The optional `lg-active-view.cjs` checks, before every tiny movement:

- The exact owner-selected television and model match the validated Windows settings
- The supervisor's current run ID, ready stream/viewer, exact LG address, time-limited session and Stop state
- The viewer's private URL has the expected loop and valid expiry
- Both original video and viewer services are healthy on the owner's chosen private LAN
- The LG browser is the foreground television application
- The LG is in Active or Screen Saver state, not standby/suspend/screen-off

When those checks pass, it sends only **one pixel of TV-pointer motion** every approximately 75 seconds, alternating direction to avoid drift. It sends no TV clicks or Windows mouse/keyboard events. It never changes LG screen-protection configuration, runs no automatic TV power-on, and stops on session end or owner Stop. Its failure is optional and cannot automatically terminate the running video/cast supervisor.

This remains a workaround for the limitations of the consumer LG browser. It does **not** disable OLED protections, prevent pixel-shift or prevent the TV from invoking its own protective behaviour outside a user-authorised video session. Avoid leaving a static desktop indefinitely on OLED. For a formally packaged webOS app, LG additionally offers OLED screensaver preferences via appinfo.json; those are not available to a regular hosted browser page.

## Verification and acceptance

- On-device initial probe: `Screen Saver → Active` from one LG remote pointer movement
- Live trial guard: confirmed a separate real LG `screen-saver-recovery` event with reported next state Active
- Pure unit tests: 8/8 safety and state checks pass; full Windows source/package suite: 87 total, **85 pass / 0 fail / 2 expected live HLS skips**
- LG actual long-duration validation still needed after integration into a new portable preview and explicit non-interference/Stop tests; no claim of a complete production v1

Related source: LG webOS official Screensaver guide at https://webostv.developer.lge.com/develop/guides/screensaver and current case at https://github.com/Martin123132/im-accessibility/pull/17 (recovery base). The earlier native-button full-screen overlay experiment is closed as failed after a black-screen event; keep the proven browser HLS and HTML controls intact.
