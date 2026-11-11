# Changelog

## 11 November 2026 — Recovery 2.4.5 source preview

- Update an existing recognised preview in place without uninstalling, preserving settings, pairing, shortcuts and the on-demand audio-safety task.
- Verify both packages before replacement, refuse active or uncertain sessions, and restore the previous version after caught replacement failures.
- Retain the 2.4.4 TV/audio/discovery implementation and rebuilt FFmpeg runtime. Real Windows 11 VM update, reopening and normal uninstall passed; source suite: 278 pass, 2 expected skips, 0 fail.
- Refresh the current-version documentation and link the remaining public-installer acceptance work. No public installer is published.

## 10 November 2026 — Recovery 2.3–2.4.4 private acceptance

- Package the rebuilt FFmpeg with the identified libzvbi/LittleCMS components excluded and matching source/build records retained.
- Correct Windows VM setup/uninstall handling, shared audio clocks and recovery-journal contention.
- Record owner-confirmed LG picture and TV-speaker sound, independent Windows VM installation lifecycle checks, and the later NVDA discovery-announcement gap.

## 26 October 2026 - LG v0.3.21 source candidate

- Preserve the owner-tested Cinema H.264/AAC pipeline and live-edge playback-stutter fixes from commit e322f22.
- Bring forward compact LG controls, on-demand viewing and independent laptop-audio restoration as source previews.
- Add a limited-user, no-auto-trigger Windows TV task control source, taskbar/status GUI, and read-only multibrand TV discovery.
- Discovery only for LG/Samsung/Sony/Roku/Google Cast/Android TV/AirPlay/Fire TV/DIAL/DLNA; actual PC desktop streaming is LG-only in this preview.
- Keep pairing credentials, private settings, live task registrations and unsigned installers out of Git.


## In development — I’m-accessibility v1

- Serialize TV viewer and controller status polls so slow responses cannot accumulate. Ignore status replies superseded by newer owner actions, and settle each viewer request once on network errors.
- Reuse the controller's timestamp formatter. Poll intervals, video streaming, mouse permission leases and manual controls are unchanged.
- Add synthetic polling tests for overlapping requests, stale replies, duplicate failure callbacks and recovery. The separate PC Bridge repository carries the desktop receipt-history memory fixes; this repository does not bundle that app.
- Renamed the private repository and introduced the **I’m-accessibility** product identity.
- Replaced the engineering archive front page with a user-facing explanation of shared control.
- Added feature statuses, product architecture, accessibility design approach and measurable v1 release gates.
- Improved source setup, security, roadmap and testing documentation.
- Preserved the original private source checkpoint and tag.

## v0.1.0-private-preview — 12 October 2026

- Archived the TV reliability v0.5 source and Codex Conversation Desk pilot.
- Verified the live owner-supervised Codex handoff via LG remote.
- Packaged an isolated source checkout with 39 tests: 37 passed, none failed, two skipped without live HLS.
- Kept installed PC Bridge, pairing keys, research screenshots and other runtime data out of the repository.

This changelog concerns the product repository. It is not a record of unrelated mathematical research activity.
