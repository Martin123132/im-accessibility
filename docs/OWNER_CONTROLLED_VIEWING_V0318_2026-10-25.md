# Owner-controlled TV viewing — v0.3.18 source preview (25 October 2026)

## Why this change exists

The owner reported that the LG television suddenly stopped showing Windows desktop after a long viewing session. The archived **physical v0.3.17 trial** state was read without changing any active process:

- `createdUtc: 2026-10-24T21:09:42.848Z`
- `expectedEndUtc: 2026-10-25T01:09:42.848Z`
- `closedAtUtc: 2026-10-25T01:09:49.336Z`
- `stopReason: Four-hour session expired normally`
- `state: stopped`, `stream: stopped`, `viewer: stopped`

**The four-hour host expiry definitively caused that session shutdown.** It does not establish that all previous LG browser freezes were timer related; LG webOS memory limits and fast-video decoder stalls remain separate concerns.

## Actual behaviour of the new source

`viewing-policy.cjs` defines two explicit modes:

- **Owner-confirmed installed mode** — when the user has validated per-user `IM_ACCESSIBILITY_CONFIG_PATH` settings, the video has **no four-hour automatic timeout** (`viewingMode:'until-stopped'`, `expiresAt:null`). The cast HLS service, viewer, optional MSE fast transport, supervisor, LG opening/pairing and TV activity guard all understand the same policy. Browser status reads **Until Stop**, instead of a fabricated countdown.
- **Historical unconfigured source/testing mode** — retains the original four-hour maximum for existing standalone fixtures and backwards-compatibility regression checks. This is not an automatic production timeout.

Configured viewing ends on **explicit owner Stop**, critical video/viewer failure, Windows session shutdown or process interruption. Host Stop acts only on its own cast/viewer child processes and releases their private session files; it does not stop Codex, PC Bridge or unrelated tasks. Launch refuses ports 43196/43198 if already owned by another service.

**Windows mouse control remains independent and conservative:**

- OFF by default, and never armed merely because a video stream starts or recovers.
- The LG viewer must request `/api/arm` with explicit `confirm:true`; permission is limited to **10 minutes**, even if video continues indefinitely.
- Mouse input remains restricted to bounded move/click/wheel actions, same-LAN and origin checks, 45 events/minute and 250ms action spacing. No keyboard, shell or Codex command endpoint is added.
- Any stale/unhealthy desktop image or fast-video disconnect disarms Windows mouse input. Owner Stop revokes input, restores speaker routing and closes the session.
- An owner-started video session uses new random LAN-private bearer URLs per Start and is only available until its owner-controlled Stop. Anyone trusted onto the same local network who obtains a private URL might watch that current session; use Stop when finished.

The optional LG activity guard still operates only for the verified foreground LG browser, recognized physical TV, live video and active session. It uses bounded one-pixel pointer movements when conditions permit, never clicks or disables OLED burn-in protections. Switching the TV to another application, ending the session or letting the service fail stops its actions.

## Verification (existing Windows laptop only)

The complete source regression suite passed **151 tests: 149 passed, 0 failed, 2 expected skipped**. Six new synthetic tests verify a five-hour owner-mode clock simulation, stop-request rejection, legacy four-hour rules, 10-minute mouse consent, host/video/viewer/MSE consistency, and UI presentation. No TV input, audio-capture process or Codex command was launched during these tests.

A new isolated portable bundle, `v0.3.18-owner-controlled-private-preview`, includes the policy module. The separate, standalone ~115.46 MiB offline Windows installer was rebuilt from this exact source and includes bundled Node 24 and the previously verified Gyan FFmpeg 9.0.1 executable and three native helpers.

Private installer:
`D:\ImAccessibility-ClickInstaller-20261024\rebuild-owner-controlled-v0318-R46\out\ImAccessibility-Setup-v0.3.18-PRIVATE-PREVIEW.exe`

SHA-256:
`f030aa9b0a71482b55e253a5e32d9a3919b0dbd21a2740bca6f88469ae729973`

The builder verified all 3 native source/binary mappings, the original FFmpeg vendor hash and **87/87** stage entries with zero private file paths. The **actual same R46 EXE** then passed internal `--verify` (87/87), isolated `--test-install` (87 files, correct v0.3.18 version and viewing policy present, **no TV started**) and checksum-guarded `--test-uninstall` in a disposable Windows profile, preserving its fake settings.

**Important acceptance boundary:** This build is **not currently installed or running on the physical LG**. The code and packaging/tests pass, but an owner-supervised actual LG session exceeding four hours, full-screen video/audio/mouse clicking, browser-memory behaviour and screen saver handling must be accepted in a future controlled swap. Never replace or stop an existing live TV session to test without explicit owner approval.

## Customer release boundary

This is a **private unsigned source/dev preview** and is not yet approved for public distribution. The GPL-enabled FFmpeg static build still lacks complete corresponding source/build scripts for external libraries (2/82 source snapshots archived at last check, 0/82 build recipes fully verified). Also pending: repository PolyForm Noncommercial/customer licence rights, signing/publisher verification, spoken screen-reader compatibility, Windows 11 acceptance and owner sign-off on the exact downloadable binary.

Keep the source in **draft PR #24** until acceptance; no auto-merge and no GitHub public binary release. The owner has another planned application mode to discuss *after* this timer-fix stage; no feature has yet been specified or implemented for it.
