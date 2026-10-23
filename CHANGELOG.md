# Changelog

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
