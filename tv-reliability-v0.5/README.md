# PC Bridge TV Resume v0.5 — 12 October 2026

This is a separate, reproducible owner-controlled reliability build. Four-hour television viewing is independent of Safari, Voice and this ChatGPT conversation. Windows mouse input is permitted only when explicitly enabled on the LG for ten minutes at a time.

## Desktop shortcuts

Resume PC Bridge TV — starts the bounded viewer from an on-demand task, or reopens the receiver on the TV if already running.

Stop PC Bridge TV — stops only the temporary PC Bridge television session.

The working directory is D:\PC-Bridge-Public-Demo\tv-reliability-v0.5. Both desktop shortcuts have been created and their targets verified. No autostart and no new elevated service.

PC Bridge TV Status.cmd in the project shows the current session without exposing private credentials.

## Television procedure

On the LG OLED55CX6LA, look for LIVE DESKTOP RESUME v0.5.

1. Watch the Windows desktop on the TV. The video can continue for up to four hours regardless of whether the phone changes apps or a call interrupts ChatGPT.
2. Select Enable PC controls to start one ten-minute Windows mouse lease. The control permission starts OFF for every session.
3. After ten minutes it switches OFF automatically, while the TV keeps showing video. Select Enable PC controls again whenever needed.
4. Click desktop picture opens the separate clickable JPEG desktop preview; Arrow fallback retains the verified earlier click-pad controls.
5. Pause PC controls turns off mouse input immediately.
6. End TV session is a two-press confirmation that closes only the owner TV viewing session. The desktop Stop shortcut is an alternative.

This prototype accepts only bounded mouse movement, left-click and wheel inputs; no keyboard, shell, Codex submission or general remote commands were added.

## How Resume works

The on-demand Windows task PCBridge TV Resume 0.5 launches resume-host.cjs in the logged-in normal Windows desktop session, with no startup trigger and a four-hour-fifteen-minute task cap.

The session host refuses to occupy ports if an older TV pilot is running. It starts the H.264 source on local port 43196, waits for live HLS output, starts the interactive receiver on 43198 and verifies its authorized video access. It then contacts only the owner-verified LG OLED55CX6LA and requests opening the new receiver browser page. LG pairing is owned by the TV and first-time permission must be approved on the remote.

Resume while the session is active reopens the LG viewer without restarting the video. Resume after expiry rotates the source/viewer credentials and starts a fresh, separately bounded four-hour session.

Explicit Stop, or the four-hour expiry, tears down only the two child services spawned by this session and removes active credentials. Permanent PCBridge Stability 0.6 Health remains untouched.

## Measured verification

- The exact Windows task is Interactive user, non-elevated, no autostart, on demand, maximum runtime 255 minutes.
- The real Resume launcher started H.264 streaming, live JPEG preview, and a four-hour authorized session.
- LG webOS authenticated and returned browser-open success for OLED55CX6LA at [owner television LAN address].
- The 19/19 mouse, JPEG, UI, expiry and owner-stop regression suite passed: evidence/regression-v05-20261012-recheck.txt.
- Full Stop followed by verification of closed video and pointer ports, credential revocation, then Resume with fresh tokens and another LG browser-open request: passed.
- Second run has both v0.5 services live, fresh JPEG, source ready, and mouse control OFF by default.
- Physical TV click on v0.5 has not yet been separately tested by the owner. The previous v0.3 remote-pad navigation remains the prior physically verified result.

## Files and recovery

PARENT_LOCK.json is the verified original-source manifest. CHECKPOINT.json contains source and test SHA-256 hashes, proof of the stop/resume test and current session details without private tokens.

New source modules are resume-host.cjs, resume.cjs, lg-pair.cjs, cast/server.cjs, viewer/server.cjs, viewer/snapshot.cjs and the TV web UI. Runtime private credentials are stored only in local runtime folders and should not be published.

The previous projects tv-cast-pilot-20261011, tv-pointer-pilot-20261011 and tv-touchpad-pilot-20261011 are retained unchanged. No broad firewall or login settings were modified.

If the TV does not reopen, double-click Resume PC Bridge TV again while the source is active. If an older pilot occupies the same ports, this build refuses to terminate it automatically; close the older on-demand pilot intentionally before retrying.

Security: LAN-only HTTP, random access capabilities, exact Host/Origin checks, two-step owner Stop, no keyboard API and no public video relay. Use only on a trusted private home network.
