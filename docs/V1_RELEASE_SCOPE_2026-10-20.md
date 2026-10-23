# I’m-accessibility — v1 release scope and evidence boundary

**Decision record:** 20 October 2026 · **Sprint:** [20–26 October](V1_7_DAY_SPRINT_2026-10-20.md) · **Parent gate:** [#3](https://github.com/Martin123132/im-accessibility/issues/3) · **Day 1:** [#4](https://github.com/Martin123132/im-accessibility/issues/4)

## Proposed first release: TV-control-first

The first installable release candidate will focus on **owner-controlled Windows desktop viewing and bounded mouse input from an LG webOS television**. The ChatGPT/PC Bridge/Codex work stays a clearly labelled **optional, separately installed companion** until its software redistribution rights, supply chain and exact-target submission can be verified.

This is the recommended engineering scope used to plan Days 2–7, **not yet final owner approval for binary redistribution or a public v1 release**.

### Included in the release candidate

- A guided, reversible per-user Windows setup or portable install bundle with prerequisite checks, status and uninstall/rollback.
- Desktop display over a trusted private LAN; no internet-accessible viewing endpoint.
- TV-side bounded pointer movement, click and scroll; mouse control starts **OFF** with a renewable **10-minute lease**.
- Owner-visible Start, Stop, Resume, active device and permission status.
- Tested four-hour session expiry/restart boundaries, stale-session and wrong-device fail-closed handling.
- Explicit source, binary, dependency and runtime hash manifests, clean-install evidence and reproducible automated and physical tests.

### Kept separate or deferred

- The installed **PC Bridge** application itself (version 0.5.16 observed locally). Its executable/source and distribution authorisation are not established by this repository; **never copy the installed app into a release bundle by assumption**.
- **Codex CLI** / desktop, the Codex App Server, ChatGPT account access and optional AI assistance. No research conversation may be a test fixture. Manual review and submission by the owner remain a supported workflow.
- FFmpeg and Node.js executables until their exact chosen distribution/build terms, packaging and prerequisites are reviewed.
- Voice controls, Apple Music, YouTube, Sky, games, cross-device support and unattended Codex submission. They remain later compatibility experiments.

## Evidence-based compatibility matrix

| Target | Evidence as of 20 October | Release position |
| --- | --- | --- |
| **Original laptop: Windows 10 Home, 22H2, 64-bit** | Live PC Bridge 0.5.16 observed; original LG TV control and stokes handoff previously owner-verified | **Development/physical demonstration environment**, not an endorsement of Windows 10 for new unsupported deployments |
| **Windows 11 x64** | GitHub Windows hosted CI runs Node 24 tests; no independently verified clean installer+LG physical session | **Intended initial release target; physical and clean-install certification pending** |
| **LG OLED55CX6LA / existing paired webOS TV** | Owner physical Magic Remote + video demonstration | **Initial target device**, must retest the packaged build before release |
| **Other LG webOS models / Smart TVs / iOS / Android** | No equivalent physical acceptance evidence in this release | **Untested; do not advertise as supported** |

The physically demonstrated laptop runs **Windows 10 Home build 19045**. In October 2026 Windows 10's ordinary support lifecycle is past; the product should prioritise supported Windows 11 for general distribution and use the existing Windows 10 owner environment only as a regression reference. The release is not product-grade until a Windows 11 target passes independent install and device acceptance.

## Distribution / ownership boundary

The repository contains original project source under **[PolyForm Noncommercial 1.0.0](../LICENSE)** with the [Required Notice](../NOTICE.md) identifying TWO HANDS NETWORK LTD. Source availability alone is not permission to repackage third-party binaries or install a separate proprietary bridge.

| Component | Status | Release handling |
| --- | --- | --- |
| Original project source | PolyForm NC 1.0.0 + Required Notice in repository | Include licence and Required Notice with distributed original code, subject to confirmed ownership/rights |
| `lgtv2` 2.0.2 and `ws` 8.22.0 | MIT in pinned npm dependency tree (previously audited locally) | Keep notices and licence texts; re-audit lockfile and install tree |
| `TvPointer.cs` and compiled `TvPointer.exe` | Source and test binary in repo; build/signing provenance not independently established | Compile from pinned source, hash and audit native input functionality before bundling binary |
| FFmpeg executable and Node.js | External prerequisites used by TV source; distribution/build terms not audited | Prefer prerequisite detection rather than bundling until audited |
| Installed PC Bridge app / Codex / ChatGPT | Separately installed and authorised; not in repository | **Exclude** from product bundle; optionally integrate via user's existing installation |
| Pairing keys, browser profiles, session URLs, research files | Owner-private runtime state | Never commit or package |

**Owner confirmation still required:** whether a TV-first candidate with optional separately installed AI assistance is acceptable, ownership and commercial-distribution rights to any proposed bundled code/binaries, and access to Windows 11 for clean physical validation.

## Stop, recover, and release approval

The user's **Stop** must mean no new TV mouse input is accepted; it does not claim to cancel unrelated Codex work or undo already edited files. Installer rollback must affect only the installed I’m-accessibility files, shortcuts and tasks it created.

**Go:** a new user can install without hardcoded owner paths, connect the supported TV, see permissions, enable and revoke control, Stop/Resume, uninstall/rollback and verify the result; CI and physical acceptance pass; licensing and source/binary provenance are reviewed.

**No-Go:** any unknown redistribution right, unsupported hardware claim, missing Stop revocation, uncleared credential leak, non-reproducible installer, untested clean installation or serious recovery failure. In that case publish a labelled **technical preview** and keep release gate [#3](https://github.com/Martin123132/im-accessibility/issues/3) open.

**Branch discipline:** use short-lived feature branches for each issue, protect frozen `v0.1.0-private-preview`, only merge reviewed green CI, retain exact commit/manifest and local backups, and don't modify the stable installed TV/PC Bridge or unrelated research apps.
