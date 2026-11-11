# Recovery 2.3 private installer — 10 November 2026

Historical build record. Subsequent real Windows 11 VM testing found defects and produced [Recovery 2.4.2](WINDOWS_VM_RECOVERY_2_4_2_2026-11-10.md); use that report for the latest private candidate and acceptance state. The isolation limitations below describe the earlier Recovery 2.3 build task.

Built one private Windows installer containing the rebuilt FFmpeg. It passed guarded installer and synthetic runtime tests. **It has not replaced the owner's accepted Recovery 2.2 installation and is not cleared for public distribution.** The repository remains private.

## Exact candidate

- File: `D:\ImAccessibility-Private-Installer-20261110\Candidate-2.3\out\ImAccessibility-Setup-v0.3.21-RECOVERY2.3-PRIVATE-PREVIEW.exe`
- Size: **107,406,848 bytes**, with **112 payload files**.
- SHA-256: `70f5efef6e314e22b04a387725aee055995f18f51273ed799e3405fe5f47939f`.
- Build identity: `recovery2.3-ffmpeg-20261110`; visible title: **Recovery 2.3 Private Preview**.
- Bundled FFmpeg SHA-256: `b35f4924476dad990b0414e3031ab20d7e90604201b39621fd937b265062ea69`.
- Node: v24.15.0, SHA-256 `3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5`.
- Signature: **NotSigned**. No signing, SmartScreen bypass, publication or merge was performed.

The [machine-readable receipt](../packaging/windows-oneclick/private-installer-20261110.json) records inputs, checks and evidence hashes. Detailed logs and the original package remain under `D:\ImAccessibility-Private-Installer-20261110`.

## Narrow source changes

The builder accepts the exact rebuilt runtime and pins its Node, licence notices, rebuild record, patch and source-appendix record. Unknown FFmpeg bytes are rejected before metadata execution or output creation. The Media Foundation encoder profile remains selected.

The app change is its private-preview title. The installer adds a distinct build identity and refuses to open a different installed preview. It already refuses to overwrite an existing installation. The internal manifest version remains unchanged because the independent audio guardian validates that format. Streaming, discovery and audio-routing logic were not changed for this package.

The audit distinguishes the new rebuilt hash from the historical vendor binary, preserves the historical licence finding, and rejects missing or altered rebuild evidence, wrong build identity and wrong encoder profile. Its read-only signature query now explicitly imports Windows PowerShell's own security module; no persistent environment or execution-policy changes were made. Its FFmpeg metadata query records the actual version instead of hiding the banner it needed to read.

Two byte-pinned JSON snapshots retain their original line endings so a fresh Git checkout preserves the evidence already embedded in this installer. Other pinned notice files have explicit LF checkout rules. The final audit/test scripts were refined after building; those scripts are not embedded in the EXE, which was not rebuilt or modified.

## Test evidence

| Check | Result |
| --- | --- |
| Full source regression | **271 passed, 2 expected skips, 0 failed** |
| Source packaging check | Passed |
| Final notice/provenance unit tests | **12 passed, 0 failed** |
| Final payload integrity/privacy audit | **112 passed, 0 integrity failures, 0 private paths flagged** |
| Guarded disposable install/uninstall | **24 passed**; all 20 direct child processes exited |
| Installed-package synthetic runtime | **11 passed, 0 failed**; all 82 child processes exited |
| Hidden guardian fixture | Passed; **0 visible windows**, graceful exit; no task registered or audio/TV started |
| Negative package-evidence checks | **4 passed**; staging restored; installer hash unchanged |
| Unknown runtime rejection | Passed before execution/output creation |
| Three native helpers | Rebuilt bodies match pinned shipped binaries apart from compiler timestamp/module GUID; helpers not executed |

The runtime tests use the **installed** `ffmpeg.exe`, bundled Node and installed `sound.cjs` argument generator. They cover Media Foundation/OpenH264, both quality modes, video with/without synthetic audio, HLS rolling playlists, segment keyframes, decoding, non-silent generated audio, reconnect numbering/discontinuity and controlled encoder exit/restart. FFprobe is an external matching test tool and is not bundled in the installer.

Installer tests cover first-run state, accessible control names/tab order, DHCP validation with fixture interfaces, existing-install refusal, uninstall refusal for active/pending/modified/unknown/junction state, normal guarded removal, reinstall with settings preservation, TV reselection, and refusal to open an older preview. These are test entry points, not physical operation of the TV controls.

## Isolation and remaining acceptance

The host is Windows 10 Home 19045. No available Windows VM, Windows Sandbox, Hyper-V, VirtualBox, VMware or spare test user was found. Codex's own isolation accounts were not repurposed. No new account or machine feature was created.

**This was guarded redirected-LOCALAPPDATA testing, not a separate Windows user or VM.** Test mode deliberately skips real shortcut creation, uninstall-registry writes and scheduled-task registration. Those normal installation paths remain unverified for Recovery 2.3. The guardian window check used a harmless fixture and did not exercise a scheduled task.

Physical LG picture/audio, real desktop capture, Stop/audio restoration, reconnect, Windows 11 and human Narrator/NVDA acceptance remain outstanding for this candidate. The owner's successful Recovery 2.2 acceptance is not transferred to this new FFmpeg binary. No replacement test in the working account is authorised by this report.

The [FFmpeg rebuild record](FFMPEG_PRIVATE_REBUILD_2026-11-10.md) records source provenance and exclusion of libzvbi and the two LittleCMS GPL plugins from the new link maps. Both original source ZIP parts plus the rebuild source appendix remain required; their hashes are included in the packaged evidence. Sources and archives remain private. Final distribution approval, recipient source delivery, trusted signing/SmartScreen and physical/accessibility acceptance remain open. This report does not claim blanket legal clearance.

## Working installation and cleanup

- **129/129 installed file hashes unchanged**.
- Saved settings, three recorded shortcuts and HKCU uninstall entry unchanged.
- All three existing TV/audio tasks retain their definitions and last-run timestamps; all are Ready with zero triggers.
- Both GUID-named disposable installations removed after successful guarded uninstall; test settings were checked byte-for-byte before scratch removal.
- All recorded test children exited; guardian exited gracefully; no matching task-owned test processes remain.
- No user app, working TV/audio task or unrelated process was stopped. No Docker, preview server or temporary browser was started for this installer task.

Receipts: `preservation-after.json`, `cleanup-final.json`, `release-audit-final-verified.json`, `Packaged-Runtime-Install-QA\summary.json`, and `Packaged-Runtime-Install-QA\packaged-runtime\results.json` under the evidence directory. Earlier reports are retained. A task timestamp comparison initially compared parsed dates with strings; normalizing both sides to UTC confirmed the actual timestamps were identical. One final audit invocation used the wrong argument position and was safely refused because the destination already existed; the corrected read-only audit passed and the installer hash remained unchanged.

## Repeating the build and guarded checks

Use the existing `packaging/windows-oneclick/build-oneclick.ps1` with these explicit inputs and a **new** output directory:

| Parameter | Input used |
| --- | --- |
| `PreviewBundle` | `D:\ImAccessibility-Distribution-Evidence-20261109\Notice-QA-Bundle` |
| `NodeExe` | `D:\ImAccessibility-TV-Selection-Fix-20261109\Candidate-2.2\staging\Runtime\node.exe` |
| `NodeLicense` | same accepted staging tree, `THIRD_PARTY\Node-LICENSE.txt` |
| `FFmpegExe` | `D:\ImAccessibility-FFmpeg-Rebuild-20261110\output-attempt3\bin\ffmpeg.exe` |
| `FFmpegLicense` | accepted staging tree, `THIRD_PARTY\FFmpeg-LICENSE.txt` |
| `FFmpegReadme` | repository `packaging\windows-oneclick\third-party-notices\FFmpeg-Rebuilt-README.txt` |
| `OutputDirectory` | original build used `D:\ImAccessibility-Private-Installer-20261110\Candidate-2.3`; choose a new directory when repeating |

For guarded QA, run `test-isolated-install.cjs SETUP_EXE NEW_REPORT_DIRECTORY FFPROBE_EXE` with `FFPROBE_EXE` pointing to the matching rebuilt `ffprobe.exe`. This optional third argument runs the eleven runtime checks against the disposable installed package before uninstall. These developer commands do not establish normal user/VM installation acceptance.

The recipe and exact inputs are retained. A second byte-for-byte installer rebuild was not performed; classic C# compiler timestamps/module GUIDs and ZIP timestamps are not deterministic.
