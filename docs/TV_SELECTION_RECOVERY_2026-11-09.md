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

The app tested interactively so far was a disposable LOCALAPPDATA copy, not a separate Windows account/VM or a normal owner-profile installation. Recovery 2.1 must still pass normal installer and physical LG picture/audio/Stop/reconnect/uninstall acceptance. No physical playback pass is claimed. The legacy application and both legacy scheduled tasks remain protected. All prior rights, corresponding-source, signing/SmartScreen, Windows 11 and human accessibility distribution gates remain open. Nothing is published or merged by this work.
