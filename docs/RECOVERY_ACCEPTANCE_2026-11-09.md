# Private recovery candidate — 9 November 2026

Base: merged source `192b38b2c60566bd3bad5dca6f99978a2c2c7749`. Recovery work stays in the owner's existing visible Codex chat. No hidden agent/CLI session, merge, public release, baseline replacement or live TV launch was used.

## Evidence and narrow fixes

- The failed installed candidate's first cast log contains an unhandled `write EPIPE` at the time its supervisor opened the LG and promoted the stream to Cinema. Audio capture was still piping PCM into the terminated encoder during the quality restart. A regression executing the real cast module with fake processes reproduced the uncaught error before the fix. The encoder-input stream now handles pipe errors, preserves opted-in audio on planned quality restarts and uses the existing bounded fallback on unexpected failure. The same missing listener is fixed in the optional fast-video path.
- The next recorded session opened the LG browser and later stopped normally, but its saved logs do **not** establish physical playback or explain absent receiver reports. No claim that this second failure is solved is made. Viewer diagnostics now distinguish selected-TV page requests, media requests and accepted playback reports; a page/media request alone never counts as playing. Diagnostics log no private session URLs or keys. The GUI surfaces the corresponding next step and audio fallback.
- The app previously opened Uninstall and immediately closed its controls even with an active stream. Stop, Close and Uninstall now wait for stopped/no-pending-audio status. Failed/uncertain cleanup leaves controls available. The uninstaller waits for the exact handing-over app process to exit, never kills it, then performs its existing integrity/ownership checks.
- A repeated installer launch offers to verify and open the installed app instead of only presenting overwrite refusal. It verifies the existing receipt and payload hashes; modified or unrecognised files are not executed by that route. The install core still refuses overwrite.
- The old owner and standalone preview shared `ImAccessibility-AudioGuard-v1`. Installed previews now derive an installation-specific guardian name identically in Node and PowerShell. The old task is neither selected nor changed. Registration remains user-confirmed, on-demand and without triggers. Existing desktop/Start Menu links are preserved; a separate Private Preview link is used if a product link already exists. Another installation's uninstall registration is preserved.

## Verification

- Full source suite: **258 passed, 2 expected opt-in live snapshot skips, 0 failures**. Source check passed. Four real C# GUIs compile. A compiled C# harness exercises the actual asynchronous Stop/Close/Uninstall gate with delayed shutdown, pending audio and uncertain state.
- Private payload: **97/97 hashes correct, 0 privacy flags**. Three native helper bodies match their pinned sources except compiler metadata; they were not executed for this comparison. Existing Node 24.15.0 and pinned LGPL FFmpeg were reused, not downloaded or replaced.
- Disposable LOCALAPPDATA QA: **18/18**, including fresh install, packaged runtime/a11y checks, DHCP validation, guarded uninstall refusal cases, settings preservation, reinstall, repeat-install verification and refusal to open modified installed files. All 16 recorded child processes exited; the disposable installed app and marked scratch tree were removed.
- This is **not a genuine separate Windows account**. No available Windows VM/Sandbox or suitable disposable user was found on this Windows 10 Home machine. Codex sandbox accounts were not repurposed. Real desktop/Start Menu/registry/task behaviour, Windows 11, screen readers and physical LG picture/audio remain owner acceptance stages.

## One private owner candidate

File: `ImAccessibility-Setup-v0.3.21-RECOVERY1-PRIVATE-PREVIEW.exe`

SHA-256: `c35555e39689823c0fbcb8f00feabe7e205ce3a37f3488b3201bdb8dd024dc33`

Bytes: `89603072`. Authenticode: **NotSigned**. No SmartScreen/security bypass was performed.

The private local handoff and all build/QA receipts are under `D:\ImAccessibility-Recovery-20261109`. `reproduce-build.ps1` records the exact existing runtime/notice inputs and build steps; input hashes, source revision and payload manifests accompany it. The build procedure is reproducible; compiler metadata and ZIP timestamps mean byte-for-byte installer determinism is not claimed.

## Baseline and owner-operated acceptance

The old program, settings, pairing, shortcuts, tasks and full rollback remain preserved. The supplied 135-file rollback comparison now has 110 matches and 25 differences **only in runtime session files**, consistent with a later session ending at 03:14 UTC. No non-runtime file differs. Those runtime files were not reset. The old tasks were Ready with no automatic triggers and the streaming ports were free during preparation. Before/after receipts record the exact state checked.

The candidate installs in the normal per-user `Programs\ImAccessibility` location, which is separate from the protected legacy tree. Its guardian for the current owner installation path is `ImAccessibility-AudioGuard-77070c2f1283ad05`; neither legacy task name needs replacement or disabling. It must not stream at the same time as the old app; the existing port-conflict guard remains enforced. No prior settings or pairing keys are seeded into the new candidate. Installation/first Start/pairing/audio/Stop/reconnect/uninstall are the owner's actions in this chat. If any step fails, retain the candidate's evidence and diagnose here before changing or removing the baseline.

All previously documented public-distribution, corresponding-source/notices, rights, signing/SmartScreen and physical/accessibility gates remain open. This candidate is for private acceptance only.
