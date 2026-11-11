# Recovery 2.4.5: update without uninstalling

Owner scope: fix only the requirement to uninstall the previous version before trying a newer installer. The owner-installed Recovery 2.4.4 on the laptop is the protected baseline. This change does not alter TV discovery, streaming, audio routing or the native helpers.

## Result

The newer installer recognises Recovery 2.4.4 and offers **Update I'm-accessibility**. It verifies the old and incoming files, closes an idle app normally, replaces the application at the same per-user path, and preserves the separate settings/pairing file, both shortcuts, Windows uninstall registration and existing on-demand audio task. Streaming stays off. A running stream or unfinished audio recovery produces a request to Stop first; uninstalling is not required.

The same installer offers **Open installed app** after updating. Recognised newer builds cannot be downgraded. Modified or unknown files and linked folders are preserved with a refusal. A per-install mutex prevents concurrent installers; the new app checks this mutex before opening. Both caught directory-exchange failures restore the previous version. Abrupt process termination/power loss during the exchange is not an accepted automatic-recovery scenario.

## Private artifact and reproduction

- Build ID: `recovery2.4.5-update-20261111`.
- EXE: `ImAccessibility-Setup-v0.3.21-RECOVERY2.4.5-PRIVATE-PREVIEW.exe`.
- Size: 107,426,816 bytes; 113 payload files.
- SHA-256: `b765398bea48c12bb43918bcd25ecb9355ebc84420593d13b460984d6c3177da`.
- Local output: `D:\ImAccessibility-Private-Installer-20261111\Recovery-2.4.5-Update\out`.
- Input bundle: `D:\ImAccessibility-Private-Installer-20261110\Bundle-2.4.4`.
- Node, FFmpeg and their licence inputs were reused from the verified `Candidate-2.4.4\staging` directory. Invoke `packaging/windows-oneclick/build-oneclick.ps1` with those explicit inputs and a new output directory. No download is part of this build.
- Node SHA-256: `3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5`.
- FFmpeg SHA-256: `b35f4924476dad990b0414e3031ab20d7e90604201b39621fd937b265062ea69`.

109 of the 113 payload files are byte-identical to 2.4.4. The four differences are the compiled app, recompiled uninstaller (shared safety source), preview notice and bundled-runtime build ID. All TV/audio/discovery code, runtime executables and native helper binaries are unchanged. The app changes are its version title and the update-in-progress launch guard. Compiler timestamps/module IDs mean another build need not produce an identical EXE hash; this exact tested artifact is pinned above.

## Verification

- Full source suite: **278 pass, 2 expected skips, 0 fail**. This includes the real C# installer transaction fixture: **18 update checks**, including stopped-session state, active/uncertain sessions, pending audio, modified/unknown files, junctions, running services, concurrent update, downgrade refusal, both rollback points, same-version handling and settings preservation.
- Targeted Windows GUI/guardian checks: **12 pass, 0 fail**.
- Actual packaged installer disposable-profile suite: **23 pass**, all helper processes exited. These checks do not substitute for the separate real Windows VM test.
- Native helper source/body provenance: **3 pass**, zero unexpected byte differences; no helper execution during the provenance check.
- Package audit: **113 hashes match**, zero integrity failures or privacy flags. Private distribution/signing gates remain unchanged.

Real Windows 11 Enterprise Evaluation VM, OS-reported build **26300**, separate non-administrator user:

1. Installed the exact 2.4.4 package through its normal GUI, retaining existing guest TV settings.
2. Created only the guest installation's on-demand audio-safety task, with zero automatic triggers. No TV stream or sound was started.
3. Left 2.4.4 open and idle, then opened the hash-matched 2.4.5 installer. Its ordinary **Update** button succeeded without uninstalling. The previous app closed normally and the updated app opened.
4. All 113 installed files matched the new manifest. Settings/pairing were byte-identical; desktop/Start Menu shortcuts and uninstall registration were identical; the audio task's XML, Ready state and last-run time were unchanged. No update staging/backup folders remained, and no streaming listeners or audio-recovery journal appeared.
5. Reopening 2.4.5 setup offered **Open installed app**, which opened the updated app successfully.
6. The normal uninstaller retained its existing refusal while the app was open. After closing the app normally, uninstall completed: app files, both shortcuts, uninstall entry and the guest-only audio task were removed; settings remained byte-identical.

Local detailed receipts, screenshots, build-source hashes and logs: `D:\ImAccessibility-Update-QA-20261111`. The first fixture run caught a Windows directory-rename failure with open verification handles; those handles are now released immediately before the exchange while the installer mutex remains held. Final tests passed. One guest task-setup invocation timed out; the bounded retry succeeded and the task was subsequently verified, preserved by update and removed by normal guest uninstall.

## Scope and limitations

The protected laptop still has Recovery 2.4.4: **113/113 payload hashes**, manifest, settings and both shortcut hashes unchanged; all three TV/audio task definitions and last-run times unchanged. No host installation or TV/audio task was modified or launched. This task tests updating and installation lifecycle, not new physical LG picture/audio acceptance. The owner's reported 2.4.4 physical result remains the latest hardware result. No public release, repository visibility change or merge is part of this work.

Cleanup: the guest shut down normally, VM state was verified `poweroff`, its audio-output setting was restored to `on`, and all task-owned VirtualBox processes exited. No broad process termination was used. Saved local evidence and the new private installer remain available.
