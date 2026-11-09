# TV selection and audio setup recovery — 9 November 2026

## Reproduced failures and corrections

The installed Windows form ignored selection whenever `settings.json` already existed. Uninstall intentionally preserves that file, so reinstall did not repair selection. A regression against the actual compiled form failed with `Preserved settings block LG selection` before the correction.

Selection is now usable with preserved settings. Confirmation is specific to the selected LG; unsupported devices cannot be saved. Unsaved choices disable Start, and status polling preserves setup instructions. Saving requires an idle session, completed audio cleanup and free streaming ports. Explicit reselection carries the reviewed settings hash. The same TV/network after reinstall or same-LAN DHCP leaves the original bytes unchanged. Changed settings are backed up before replacement; stale confirmations and concurrent saves are refused.

During owner-operated testing of Recovery 2, real discovery found the saved LG and the owner selected and saved it. Both the disposable settings and real profile settings remained byte-identical. Start with audio then failed before streaming: Windows PowerShell inherited PowerShell 7's module search path and loaded its incompatible utility module, making `Get-FileHash` unavailable. The exact failure was reproduced in a child process and regression test. The audio task script now imports Windows PowerShell's own Management, Utility and ScheduledTasks modules using `$PSHOME`. It changes no Windows profile, execution policy or system environment.

## Verification and private candidate

- Full suite: **264 passed, 2 expected live snapshot skips, 0 failed**. Source check passed. The Windows GUI regression covers preserved settings, confirmation, status polling, active-session gating and unsupported devices. The actual audio task script passes read-only Status in the inherited GUI environment and still rejects modified watcher files.
- Recovery 2.1 payload: **97/97 manifest hashes**, no privacy flags. Existing pinned Node and FFmpeg inputs were verified and reused.
- Disposable install/uninstall QA: **20/20 checks passed**, including packaged audio-guardian Status, reinstall/reselection, byte-exact settings preservation and guarded uninstall. All 18 recorded child processes exited and the disposable installation was removed.
- EXE: `ImAccessibility-Setup-v0.3.21-RECOVERY2.1-PRIVATE-PREVIEW.exe`.
- SHA-256: `6d4698633b1274cd6f76541a547f47a18c7376b8adbf06d335d14ddcddbd1c6f`.
- Size: `92280320` bytes.
- Local evidence: `D:\ImAccessibility-TV-Selection-Fix-20261109`, including source test output, build/input receipts, discovery results and the PowerShell module diagnosis.

## Owner-operated Recovery 2.1 acceptance and console regression

The owner subsequently installed Recovery 2.1 normally in the real Windows profile. All 97 files matched the private payload, its uninstall registration was correct, and the new Desktop/Start Menu shortcuts were created while the legacy control-panel shortcuts were preserved. The owner confirmed real LG desktop picture and sound, Stop with laptop sound returning, and picture/sound again after closing the app and reopening its desktop shortcut. The first Stop logged `LAPTOP_AUDIO_RESTORED`, cleared the audio journal, released both video ports and left all tasks idle.

Acceptance then exposed a visible black console: the installation-specific audio task launched Node directly. Process/window inspection identified the console as the scheduled `speaker-route-watch.cjs --task-guardian` process, not the video stream or control panel. Recovery 2.2 changes only that launch route: Task Scheduler starts the existing Windows GUI executable in a dedicated audio-guardian mode, which starts its fixed Node watcher with `CreateNoWindow` and waits for it to exit. The guardian remains a separate process independent of the visible control window. The task script pins the launcher's manifest hash as well as the Node/watcher hashes.

The Recovery 2.2 source suite has **265 passed, 2 expected skips, 0 failed**, including a compiled launcher test that verifies no visible launcher, watcher or console-host window and graceful child/launcher exit. Actual Task Scheduler acceptance passed using the packaged GUI executable and a harmless watcher in a uniquely named disposable fixture: **zero visible windows**, graceful exit, task removed, scratch removed, no remaining fixture processes. This exercised the real scheduler without running audio or TV code. Installer/uninstaller QA passed **20/20**, and the private payload verified **97/97**. The stopped, owner-tested 2.1 program was backed up and **133 file hashes verified** before any replacement. Both legacy task XML definitions remain identical and Ready.

Replacement EXE: `ImAccessibility-Setup-v0.3.21-RECOVERY2.2-PRIVATE-PREVIEW.exe`, **92280320 bytes**, SHA-256 `5c67a08813aef744cad9251b1f2b8fdda4a2d43c4fa341f4cf2b051a9a95c6db`. Detailed package, task and rollback receipts remain in the local evidence directory.

No genuine separate Windows account/VM was available. Normal owner-profile uninstall, Recovery 2.2 physical acceptance, and the prior rights, corresponding-source, signing/SmartScreen, Windows 11 and human accessibility distribution gates remain open. The legacy application and both legacy scheduled tasks remain protected. Nothing is published or merged by this work.
