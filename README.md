# PC Bridge Control Suite â€” private preview

**Status: owner-operated source checkpoint, 12 October 2026.** A Windows/LG television desktop-control build plus a separate Codex conversation-control pilot. This repository is *not* a complete copy of the installed PC Bridge app, a public remote-desktop product, or an unattended Codex assistant.

## Contents

| Module | Included capabilities | Verified scope |
| --- | --- | --- |
| tv-reliability-v0.5 | H.264/HLS live Windows desktop to LG webOS; clickable JPEG preview; TV-side mouse enable, ten-minute leases, scrolling, owner Stop and Resume; bounded four-hour sessions | 19/19 frozen regression checks; physical remote control and four-hour session subsequently owner-confirmed |
| codex-chat-control-pilot-20261012 | Restricted Codex App Server client, SHA-256-bound durable draft ledger, exact-thread picker, local review page, approval and one-shot dispatch logic | 20/20 isolated mock tests, live read-only Codex connection, owner-supervised Windows UI staging |

## Real-world handoff demonstrated

On 12 October 2026, ChatGPT used PC Bridge to insert an instruction into the **visibly confirmed foreground Codex conversation**. The owner manually pressed Send with an LG Magic Remote. A separate screenshot confirmed the message in that conversation and Codex responding. This was a genuine full-loop user-assisted handoff, *not* an unattended turn/start call.

The direct Codex App Server connection has **not** been proven to track the foreground desktop chat. A later read-only thread search timed out. Never infer an exact API thread ID from a desktop window title. Real App Server submission still needs a separately approved, verified target and an authoritative receipt.

## Running this snapshot

This is source, not a one-click installer. The existing working PC Bridge installation, Windows on-demand TV task, shortcuts, LG pairing, local network and video encoder are configured **outside** this repository. Cloning does not reproduce machine permissions or those owner-specific settings.

TV source expects Windows, Node.js, FFmpeg/video tooling (set PC_BRIDGE_FFMPEG_EXE to the local ffmpeg.exe path or place ffmpeg on PATH), npm dependencies and an owner-paired LG webOS TV on a private LAN. Run npm ci in tv-reliability-v0.5/cast to restore the pinned lgtv2 package; node_modules is never committed. The native Windows pointer helper is included as original C# source plus its locally tested small binary.

Codex source expects Codex CLI, Node.js and a localhost browser. Set PC_BRIDGE_CODEX_EXE to the local path of codex.exe, or ensure codex is available on PATH, before running the Codex Desk. The Desk listens on 127.0.0.1:43191 and has no browser Send route. Its text and thread selection are local, and a separate explicit approval is needed before any real Codex turn.

## Tests

Tests designed not to send messages:
- node --test codex-chat-control-pilot-20261012/tests/pilot-safety.test.cjs codex-chat-control-pilot-20261012/tests/selection-safety.test.cjs
- node --test tv-reliability-v0.5/tests/session-policy.test.cjs
- node --test the files in tv-reliability-v0.5/viewer/tests/

The extra live-readonly-smoke.cjs is an explicit opt-in check of Codex App Server, not part of the default unit suite.

## Archive policy

Included files are a curated source allowlist from the working modules. Credentials, TV pairing keys, runtime state, research work, screenshots, browser profiles, evidence caches and one-off experiments involving real conversations are excluded. The compiled TvPointer helper is retained because the verified Windows build used it. See RELEASE_MANIFEST.json for source fingerprints.

Older TV prototypes, the experimental phone stage, the full installed PC Bridge app and the 107-folder development/research workspace remain outside this repository and were not modified.

See docs/RELEASE_NOTES.md, docs/SECURITY.md, docs/ROADMAP.md and docs/SETUP.md. Treat this repository as PRIVATE pending a separate public-release, dependency-licensing and security review.