# Recovery 2.4.2 Windows VM acceptance — 10 November 2026

Subsequent owner LG testing passed picture but failed audio. The [Recovery 2.4.3 timing repair report](WINDOWS_VM_RECOVERY_2_4_3_2026-11-10.md) records that failure, the narrowly scoped fix, and the newer candidate's evidence. The statements below describe the earlier NAT-only test stage.

Private follow-up to [Recovery 2.3](PRIVATE_INSTALLER_RECOVERY_2_3_2026-11-10.md). This uses a real Windows 11 guest and its normal user profile. The owner's accepted Recovery 2.2 installation remains protected. Nothing in this report authorises a public release or replacement of that installation.

## Candidate and scope

- Installer: `D:\ImAccessibility-Private-Installer-20261110\Candidate-2.4.2\out\ImAccessibility-Setup-v0.3.21-RECOVERY2.4.2-PRIVATE-PREVIEW.exe`
- SHA-256: `5a8a4e5a654964c723537c07e43e280daa96838ec52ab83d220611ca7adf8a07`.
- 107,409,408 bytes; 112 payload files; build identity `recovery2.4.2-vm-20261110`.
- Rebuilt FFmpeg remains `b35f4924476dad990b0414e3031ab20d7e90604201b39621fd937b265062ea69`; Node remains v24.15.0.
- Unsigned private preview. No publication, merge, SmartScreen bypass or host app installation.

The build uses the same explicit inputs and recipe as Recovery 2.3, with the current source and a new output directory. The build/audit reports and earlier failed candidates are retained. This is a repeatable recipe with pinned inputs, not a claim of byte-for-byte deterministic C# compilation.

## Failures reproduced and narrow fixes

1. The original 830-pixel window extended below the usable 720-pixel guest display. The initial frame now fits the monitor's working area; keyboard focus scrolls lower controls into view. Tests also cover a negative-origin monitor and a smaller working area.
2. The setup-status label overlapped the television confirmation checkbox. Its bounds now leave both controls visible.
3. Normal uninstall failed because a healthy Windows PowerShell task operation exceeded its 12-second limit. Audio preparation had the same inner limit and a 15-second outer limit. These operations now allow 60 seconds, with 75 seconds for the outer preparation call; other operation limits are unchanged. Preparation and normal uninstall display progress. Existing ownership, manifest, session and audio-restoration checks remain in place.
4. Invalid retained network settings left Start enabled with a misleading primary status. The app now disables Start and retains a message requiring explicit network/TV selection. The backend already refused the wrong-network start. Its generic idle message still appears in the chronological log; that is not a connection confirmation.

Streaming, discovery protocols, audio routing, FFmpeg, Node and native helper binaries were not changed for these fixes. Private preview identities distinguish superseded packages.

The guardian test also exposed a fixture race: the reader could see an empty readiness file before its writer finished. The fixture now publishes that JSON atomically. This is a test-harness change, not application behaviour.

## Isolation

Oracle VirtualBox 7.2.22 was installed after the owner's administrator approval. Only its base application was installed: no bridged/host-only network, USB, Python or extension-pack components. The existing host hypervisor and security settings were retained.

The disposable VM has 6 GiB RAM, three CPUs, a dynamic 96 GiB disk, Secure Boot and TPM 2.0. Its verified Microsoft Windows 11 Enterprise evaluation runs build 26300. Tests run as the non-elevated `qaowner` token, using the actual `C:\Users\qaowner\AppData\Local`, real desktop/Start Menu shortcuts, HKCU registration and Task Scheduler. No Node/npm/FFmpeg tools are separately available on the guest PATH. FFprobe is a separately copied QA tool only.

NAT networking has no forwarded ports or host-localhost access. Host disks, shared folders, clipboard, audio and USB are unavailable to the guest. The VM cannot discover the owner's LG through this network configuration. Synthetic retained settings belong solely to the guest, not the owner.

The initial two-CPU firmware hang was resolved by allocating three CPUs; no Windows hardware checks were bypassed. An early guest-control command omitted its process-local script policy and was refused without running the script; corrected QA calls use process-local RemoteSigned, with no persistent policy change.

## Evidence and remaining gates

Detailed receipts, screenshots and scripts are retained under `D:\ImAccessibility-VM-QA-20261110`; generated guest credentials and unattended setup files must not be committed or published. The [machine-readable receipt](../packaging/windows-oneclick/vm-acceptance-20261110.json) records exact evidence hashes, source files and remaining gates.

Final source verification passed: **271 passed, 2 expected skips, 0 failed**, plus the source packaging and whitespace checks. An earlier run under VM load hit one unrelated mock-dispatch test's 80 ms deadline. Its immediate isolated recheck passed 13/13, and the final full suite passed without changing that code. These tests use a local mock; no hidden Codex chat or agent was started. There is no open PR for this branch, so the existing GitHub Actions triggers did not run; no remote-CI pass is claimed.

The final candidate passed **23 guarded installer checks** separately from the VM. Those checks use a redirected disposable profile and exercise refusal of active sessions, pending audio restoration, modified/unknown files, junctions, existing-install overwrite and older-preview launch; they also cover fixture DHCP renewal and settings-preserving reselection. All 19 direct children exited.

Inside the actual Windows 11 profile, the ordinary installer created both real shortcuts and its HKCU uninstall entry. All **112 installed file hashes** matched. It reopened through the desktop shortcut, preserved the synthetic settings, and created no stream or scheduled task on installation. Temporarily moving only the known fixture settings allowed first-run discovery to be observed: the isolated network produced an accurate empty result without starting anything.

All **11 installed-runtime synthetic checks passed**, including Media Foundation/OpenH264, both quality modes, generated audio/video, HLS decoding/keyframes, reconnect numbering and controlled encoder stop/restart. These use the installed argument generator and runtimes; they do not capture a desktop or access speakers.

The scheduled guardian fixture passed with **zero visible windows**, graceful exit, removal of its uniquely named task and removal of its temporary directory. It uses the final installed launcher and Node with a harmless watcher. The VM-only fixture copy allows longer PowerShell/startup deadlines and a four-minute watcher safety limit; these test accommodations are recorded separately and are not shipped. Earlier fixture timeout and readiness-race failures remain in the evidence. Actual packaged audio preparation completed in **19,758 ms**, creating a Limited task with zero automatic triggers, without running a TV session or touching audio devices.

The final app's **Uninstall button** successfully handed off to its ordinary packaged uninstaller, which showed progress and completed. Independent inspection then found no installation files, shortcuts, uninstall registration, app processes or app tasks. The retained fixture settings had the same SHA-256 before and after. Recovery 2.4.1's prior normal install/uninstall and the final 2.4.2 installation also demonstrated preservation across package changes. Windows Settings' Apps-page invocation was not separately exercised.

All **82 runtime child processes** exited. The VM shut down gracefully; its three VM processes, VBoxSVC and VBoxSDS exited, and the service is stopped. Its disk and evidence remain for follow-up. The host's **129 installed files**, saved settings, three reference shortcuts and all three TV/audio task definitions and last-run times are unchanged. No host network adapter was added. No unrelated process was stopped.

Automatic approval review rejected removal of duplicate ISO download chunks with `blocked by policy`; those files remain. The deletion was not retried through another route. An initial evidence export combined two historical folders because VirtualBox copies directory contents; separate verified exports supersede that mixed folder, and the original guest evidence is unchanged.

Physical LG picture/audio, desktop capture, speaker restoration and reconnect with this rebuilt FFmpeg still require owner acceptance. Recovery 2.2's earlier physical pass does not transfer to this binary. Real LAN discovery/pairing/firewall behaviour, hardware encoders, human Narrator/NVDA and high-DPI use, trusted signing/download SmartScreen, and recipient access to corresponding source remain separate gates. The [FFmpeg rebuild record](FFMPEG_PRIVATE_REBUILD_2026-11-10.md) and [licence review](LICENCE_REVIEW_2026-11-09.md) retain their limitations; this VM test does not confer legal clearance.

The repository remains private. No host installation or shared TV/audio task change is authorised by the VM evidence.
