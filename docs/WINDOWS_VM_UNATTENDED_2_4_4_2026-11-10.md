# Recovery 2.4.4: unattended Windows VM acceptance

The same private installer that the owner confirmed for LG picture and TV-speaker sound passed ordinary uninstall/reinstall, both real Windows shortcuts, the existing-installation path, and keyboard navigation at 150% display scaling. No application code, runtime or installer was changed or rebuilt for these checks. This follows the [physical LG and audio-safety record](WINDOWS_VM_RECOVERY_2_4_3_2026-11-10.md).

## Exact candidate and isolation

- Source: `939cae5855a1319161348cb9fa6b7e322c29a9ca`.
- Installer: `ImAccessibility-Setup-v0.3.21-RECOVERY2.4.4-PRIVATE-PREVIEW.exe`.
- SHA-256: `30fba87af2100fe7c42ea7a9a7774b3cf7a7c1c539514883a6d0e65ebd107859`.
- Windows 11 Enterprise Evaluation, actual OS build 26300; non-elevated `qaowner` in the existing disposable VirtualBox VM.
- Real per-user folders, HKCU registration and Windows Task Scheduler were exercised. Installation/removal used the ordinary GUI, without redirected `LOCALAPPDATA` or the guarded test-install/test-uninstall switches.
- The guest's virtual audio output was temporarily disabled to keep all checks silent. No TV stream, pairing, capture or test sound was started. Host application/settings/shortcuts and host TV/audio tasks were outside the test scope.

## Verified behaviour

| Check | Evidence |
| --- | --- |
| Boot with the previously tested installation | No app/capture processes or streaming listeners; existing audio task Ready, zero triggers, last run unchanged. |
| Ordinary GUI uninstall | Removed the application, both shortcuts, HKCU uninstall entry and guest audio task. No installed child process remained. Saved LG settings were byte-identical. |
| Ordinary GUI reinstall | Installer and all 113 installed payload hashes matched. Desktop/Start Menu shortcuts and HKCU registration were recreated. Settings remained byte-identical. |
| Open app after installation | One control window, `not-started`, no streaming listener, no audio journal and no newly registered task. |
| Desktop and Start Menu shortcuts | Each launched its verified installed target with no arguments. Normal close/reopen retained the saved TV and stayed idle. |
| Run installer while already installed | Displayed **Open installed app**, verified the existing installation and opened it without overwriting files or starting streaming. |
| Packaged accessibility reports | App's 12 controls had names, descriptions, roles, ordered tab indices and tab stops. Installer names/order and focusable progress report passed. Both reporting processes exited. |
| Live 150% scale / keyboard | At the guest's actual 1280×960 resolution, installer text/actions fit; the app stayed inside the work area and scrolled its lower controls into view through keyboard focus. Uninstall was keyboard-reachable; its full confirmation text was visible and defaulted to No. Enter cancelled, leaving one idle app and unchanged settings. |
| Runtime / startup metadata | No separate Node or FFmpeg on PATH; no application Run/RunOnce registration. |
| Reboot after reinstall | Confirmed a new Windows boot at 23:18 UTC. No app, capture process, listener, audio journal or task started automatically. Settings remained byte-identical. |
| Reopen after reboot | The actual desktop shortcut reopened one idle 2.4.4 control window with the same saved LG and network. |
| Normal close and cleanup | The final app close left zero app processes, streaming listeners, audio journals or tasks. The VM then shut down normally. |

These are functional keyboard/layout checks, not human Narrator/NVDA acceptance or a claim of comprehensive accessibility. Windows offered 100%, 125% and 150% presets in this VM; 200%, custom text scaling and high-contrast use were not exercised. The original 100% scale was restored.

The requested 1920×1080 display hint was not the mode Windows actually used: the scaling test ran at the observed 1280×960. The guest was returned to 1280×720 and 100% before the last reboot. The report does not claim a full-HD display test.

Final host preservation at 23:23 UTC verified **129/129 working-app files**, saved settings, three reference shortcuts, and all three TV/audio task definitions and last-run times unchanged. Tasks remained Ready with zero triggers and no extra host task appeared. The guest is powered off; its original virtual audio-output setting is restored, microphone input remains off, and all recorded VM processes exited. The reinstalled candidate and saved LG setup remain inside the powered-off guest. No unrelated process was terminated.

## Limits and distribution gates

The candidate remains unsigned (`NotSigned`). Its guest copy has no Internet zone marker: a transferred-file install does not prove the real GitHub download/SmartScreen experience. No signing purchase, security-policy change or warning bypass occurred. The repository remains private; nothing was merged or publicly released.

The earlier owner-confirmed picture/audio pass still applies to the same installer hash. Physical TV reconnect and an audible post-Stop check remain separate from the silent app reopening/cleanup checks. Human assistive-technology acceptance and recipient delivery of the already retained corresponding-source/build/notice bundles also remain open. The [patched FFmpeg rebuild report](FFMPEG_PRIVATE_REBUILD_2026-11-10.md) records the resolved excluded-library findings and the limits of that review.

The existing source result remains **277 passed, 2 expected skips, 0 failed**, with **23 guarded installer checks passed**. Production source did not change, so those suites were not unnecessarily repeated; no new hosted CI pass is claimed.

Detailed scripts, screenshots and receipts are retained at `D:\ImAccessibility-VM-QA-20261110\Unattended-244-20261110`. Raw retained settings and guest credentials are private and excluded from the repository receipt. The Windows capture helper twice returned `window capture timed out: timed out waiting on channel`; the VM's own console screenshots and keyboard input were used for the observed GUI checks.

The [machine-readable receipt](../packaging/windows-oneclick/vm-unattended-244-acceptance-20261110.json) contains 15 passing acceptance/preservation checks, the unchanged installer hash, evidence hashes and explicit unverified stages.
