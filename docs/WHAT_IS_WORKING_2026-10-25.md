# Which version is working? — 25 October 2026

**This page is the repository's current source-of-truth for tested source, development experiments and download status.** It distinguishes code merged into `main` from the owner's separately installed hardware-test versions.

| Where | Meaning | What to expect |
| --- | --- | --- |
| [`main`](../README.md) | **LG v0.3.16 source-preview baseline** (merged [PR #21](https://github.com/Martin123132/im-accessibility/pull/21)) | H.264 full-viewport desktop viewing, audio-loopback clock correction, HLS fallback, bounded Magic Remote controls, per-user portable source/setup. This is the canonical GitHub source, **not a signed consumer release**. |
| [Draft PR #24](https://github.com/Martin123132/im-accessibility/pull/24) | **Next v0.3.17 development candidate** | MSE/browser-memory cleanup from former #22 plus the newer graphical, single-file Windows installer **source**, accessibility improvements and reproducible release audits. Private installer EXEs have been tested offline on Windows 10, but **no public EXE has been released**. |
| Owner's isolated Windows/LG installations | **Hardware test setups** | Not automatically updated by a GitHub merge. Use the installed application's version and local saved checkpoints to identify the exact running binary; never assume `main` changed the installed TV viewer. |
| [v0.1.0-private-preview](https://github.com/Martin123132/im-accessibility/releases/tag/v0.1.0-private-preview) | Historical snapshot | Retained only for historical reference, not the current tested viewer. |

## What has been verified

**v0.3.16 baseline:** source checks reported 123 passing, 2 expected skips; actual owner LG hardware displayed combined H.264/AAC and guarded pointer controls. The corrected native WASAPI speaker-loopback executable matched the hardware-tested binary. However the LG subsequently reported **“Not enough memory to open this webpage.”** This baseline is a **working prototype with a known long-playback blocker**, not proven stable indefinitely.

**v0.3.17 draft (#24):** a memory-cleanup candidate was exercised on LG for roughly 58 minutes without a reported disconnect at the last read-only check. That does **not** prove cumulative browser memory is fixed. A separate timer-controlled TV session can stop after about **four hours**; distinguish a deliberate expiry from browser out-of-memory. The one-click Windows GUI installer was independently built, checked, installed and uninstalled in isolated Windows 10 profiles, including source correlation for three native helpers. Source tests reported **143 passing, 2 expected skips** at the latest source revision.

## Can someone download and double-click an approved customer installer?

**Not yet.** The graphical `.exe` exists as a **private, unsigned preview** on the development laptop. There is no approved public GitHub release asset for the newer installer. Rebuilding it from source needs the documented, pinned third-party tools and licence inputs; downloading source alone does not supply a signed customer installer.

Outstanding approval gates include the correct FFmpeg GPL-enabled binary's corresponding source and build-script obligations, the project's commercial/distribution rights under its existing [licence](../LICENSE), publisher identity/signing, Windows 11 compatibility, actual Narrator/NVDA accessibility acceptance, and a controlled installed-app physical LG Start/Stop test.

Do **not** silently swap the tested encoder, LG stream or native pointer control while solving these release tasks.

## Pull-request cleanup

On 25 October 2026, the repository's 12 open PRs were reduced to **one open development PR**:

- [#21](https://github.com/Martin123132/im-accessibility/pull/21) **merged into `main`**; GitHub also recognised the earlier [#12](https://github.com/Martin123132/im-accessibility/pull/12) as merged through its ancestry. [#14](https://github.com/Martin123132/im-accessibility/pull/14) was already merged.
- Historical stacked drafts **#13, #15, #17 and #19** were closed as redundant because their commits were already carried by #21.
- Historical branches **#11, #16 and #20** were closed as obsolete/superseded rather than merged into the newer tested code. Some old documentation/experiments remain exclusively in those preserved branches; closing an unmerged PR does not mean every historical file reached `main`.
- Browser-memory draft **#22** was folded into retargeted [#24](https://github.com/Martin123132/im-accessibility/pull/24); old installer preview **#23** was superseded by #24.
- **#24** is based directly on `main` and remains **draft**. Its unapproved memory changes and installer source are deliberately **not** in the default branch.

None of the closed branches or original historical tags was force-pushed or deleted as part of this tidy-up.

## What to work on next

Use `main` for the current stable **source-preview baseline**. Use draft **#24** when deliberately developing the next unapproved v0.3.17/installer changes. Merge #24 only after the outstanding release and physical-acceptance questions are addressed or the owner explicitly chooses to merge a clearly labelled experimental source revision. **Merging source does not install it on the owner's laptop or publish a customer executable.**
