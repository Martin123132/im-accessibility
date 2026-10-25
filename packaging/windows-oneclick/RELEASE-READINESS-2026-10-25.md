# Release-readiness audit — 25 October 2026 (private, not a distribution approval)

## Actual keyboard traversal on the existing laptop

The app's Windows Forms `AccessibleName` and `TabIndex` declarations were already unit-tested. This checkpoint goes further: it uses **`Control.SelectNextControl(..., tabStopOnly: true)` on a real, visible WinForms window on a separate, unswitched Windows desktop**. The second STA thread was attached using Win32 `CreateDesktop` / `SetThreadDesktop`. The user's interactive desktop, LG viewer and Codex were never activated, clicked or interrupted.

A disposable profile and a sandbox beside the R18 compiled app, with junctions to its *read-only* local runtime, allowed the GUI's normal `doctor` preflight to succeed. It reported `State not-started`; no TV pairing, stream startup, network action or real settings write occurred.

After the initial default selection of the network adapter, ten forward navigation steps visited:

1. LG address (index 1)
2. Owner LG confirmation (2)
3. Save setup (3)
4. TV speaker sound (4)
5. Start TV desktop (5)
6. Stop TV stream (6)
7. Refresh status (7)
8. Uninstall (8)
9. Activity/status log (9)
10. Back to PC network selector (0)

Backward traversal likewise cycled through all ten controls in reverse order. All were visible, enabled and tab-stop-capable in the correctly configured isolated test. **This tests WinForms focus selection; it is not the same as pressing physical Tab keys or listening to Narrator/NVDA speech.** Those remain human accessibility acceptance items.

Private test evidence:
`D:\ImAccessibility-ClickInstaller-20261024\tests\KeyboardTraversalSandboxR23-output.json`
No test executable, hidden desktop, fake user settings or native test assets are part of this public source PR.

## Current exact Windows package audit

New source-only `audit-release.cjs` verifies each file's relative path, byte length and SHA-256 against the private 87-entry manifest. It inspects Node and FFmpeg version/configuration, shipped MIT dependency licences, native helper source presence, known private credential paths and the Windows Setup EXE signature. Its output always sets `readyForPublicDistribution: false` until required manual evidence and owner approval.

- Private R18 v0.3.17 installer: **87/87 file integrity PASS**, **0 private/session paths** flagged, licence/README text present in the payload, and a matching static public `lgtv2@2.0.2` pairing template. The pairing template was compared byte-for-byte by SHA-256 against the published npm tarball (`2159d4e54dc38e3626a95f496a2e6c2f071b541bd07e2e0657c8acbbcdd9d9e8`); it is **not** a copied user LG pairing secret.
- Runtime Node: **v24.15.0**; bundled standalone EXE SHA `3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5`.
- Runtime FFmpeg: **9.0.1 Gyan full build**, SHA `57c56e369d5b4873b4d93fc1a1d833cb7cd8bc9325c14b05c34ce60b22842d8a`; configured with `--enable-gpl`, `--enable-version3`, `--enable-libx264`, `--enable-libx265`, **not** `--enable-nonfree`.
- Bundled `lgtv2@2.0.2` and `ws@8.22.0` declare MIT and contain their licence files; both are in the package manifest.
- Native sources for `LoopbackCapture.exe`, `SpeakerEndpoint.exe` and `TvPointer.exe` are present in the manifest, **but matching binary build provenance and redistribution rights have not been independently re-established**.
- Private `ImAccessibility-Setup-v0.3.17-A11Y-PRIVATE-PREVIEW.exe` signature: **NotSigned**. Windows SDK SignTool is installed, but the current user's code-signing certificate store had **zero usable certificates**. No signing certificate was generated and no trusted publisher status was claimed.

The audit result is recorded privately in:
`D:\ImAccessibility-ClickInstaller-20261024\tests\R25-release-audit.json`.

## Legal and delivery gates

Official FFmpeg references:

- <https://www.ffmpeg.org/legal.html> — FFmpeg's licence information and compliance checklist.
- <https://ffmpeg.org/doxygen/trunk/md_LICENSE.html> — GPL options and external libraries.
- <https://www.gyan.dev/ffmpeg/builds/> — third-party Windows binary provider and build information.

Because the **exact bundled FFmpeg binary is GPL-enabled**, the owner must obtain/review corresponding source, codec dependencies, build recipes and applicable distribution notices for that build. Providing the GPL licence text **alone** is not a completed compliance review. External FFmpeg CLI subprocess use does not, by itself, determine the licensing of the entire app; the complete distribution needs appropriate professional review where material.

Additional blockers: owner confirmation of intended PolyForm Noncommercial product/release rights, native helper build/provenance audit, code-signing/publisher identity if trusted download is desired, spoken Narrator/NVDA acceptance and Windows 11 compatibility testing when available. Do not silently substitute an untested LGPL or Media Foundation encoder for the physically tested H.264 stream.

**No public EXE release, source/licence change, TV restart, Codex interruption or repository-main merge has occurred.**

## Builder integration and tests

`build-oneclick.ps1` now runs the read-only release audit after producing each **private** installer. The audit writes an independent `release-audit.json` alongside the newly built EXE and fails on corrupt payloads or private-path leaks; other human/legal blockers are explicitly listed and require owner approval, not an automatic bypass.

The full source suite is **138 tests: 136 passed, 0 failed, 2 expected skips**, including five new release-policy tests. No live TV or Codex integration was used. PR #24 remains draft/source-only.
