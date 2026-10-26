# Windows one-click installer: accessibility and native uninstall acceptance
25 October 2026 — private owner acceptance preview, source-only GitHub documentation.

## Why this change

The user wants a genuinely downloadable, double-click-installable accessibility application, not a collection of scripts. This change improves Windows keyboard / assistive-technology metadata and closes the previous normal graphical uninstaller test gap. It **does not** touch the working LG TV stream, Codex, the original beta, or user settings.

## Source improvements

- `ImAccessibilityApp.cs`: all ten interactive controls now have explicit `AccessibleName`, `AccessibleDescription`, and a sequential `TabIndex` of 0–9 (network selector, TV IP, confirm, save, TV audio, Start, Stop, Refresh, Uninstall, read-only status log). F5 refreshes status without starting or stopping anything. An isolated `--accessibility-selftest` introspects WinForms accessibility properties without connecting to the TV.
- `ImAccessibilitySetup.cs`: clear screen-reader metadata and tab positions for the opening checkbox, Install and Close controls, install-folder display and read-only progress log. It has its own non-installing `--accessibility-selftest`.
- `ImAccessibilityUninstall.cs`: the confirmation now explicitly defaults to **No**, and the temporary child process is created directly without shell-associated launching (`UseShellExecute=false`). The same native confirmation is exercised by a non-destructive, test-directory-restricted `--dialog-selftest`. The original receipt-hash validation, active-session refusal and per-user settings preservation remain.
- `installer-source.test.cjs`: two additional source-contract checks for named controls / tab sequence and the fail-safe uninstaller confirmation.

## Verified locally on the owner's only Windows 10 laptop

- Compiled all three revised C# GUI utilities successfully with the installed .NET Framework compiler.
- **Installed application WinForms accessibility selftest**: 10/10 interactive controls named, in explicit tab order 0–9, and focusable; accessible roles correctly distinguished ComboBox, Text, CheckButton and PushButton.
- **Installer accessibility selftest**: labelled open checkbox, Install button, progress log, and expected tab positions passed.
- **Uninstaller confirmation test**: actual native Windows Yes/No dialog observed; clicked **No** and got `No` in a safe report with no files touched.
- **Source full regression suite**: 133 total, **131 passed**, zero failed, two expected skipped. Source checker passed.
- **Source-backed installer build R18**: one private ~115.46 MiB Windows EXE; SHA-256 `cc902f3fa8f48cd696cadb5b8daafc030cb229f9bfa01535726c68c4b2161f19`. Rebuilt using the GitHub branch's own `build-oneclick.ps1`.
- **Embedded archive**: 87 of 87 payload file SHA-256 checks passed; installed correctly in disposable `D:\ImAccessibility-ClickInstaller-20261024\tests\A11Y_Setup_R18`. Neither installation nor accessibility tests started the TV stream. Installed GUI/uninstaller checks passed, then a separate test uninstalled the disposable app and preserved a settings sentinel.
- **Actual normal uninstaller handoff** tested in disposable `D:\ImAccessibility-ClickInstaller-20261024\tests\A11Y_GuiUninstall_R19`: verified the installed uninstaller against its exact receipt; launched the actual uninstaller with no special test argument, identified only its own temporary child, clicked **No** and confirmed the installation remained. Launched it again, clicked **Yes**, observed the native `Uninstall completed` dialog, clicked **OK**, confirmed the disposable installation was deleted, and its disposable settings preserved. No real shortcuts or HKCU app entry were touched in these restricted tests.
- The original working isolated v0.3.17 LG application and current live supervisor were not changed.

## Still outstanding before a public customer release

- Direct human Narrator or NVDA acceptance of the installed application, including actual spoken labels, focus tracking, keyboard-only first-run, minimum font scaling and window resize. The above checks introspect WinForms accessible objects, not spoken screen-reader output. Prior external UI Automation clients sometimes exposed zero descendants; **do not mark screen-reader compatibility fully accepted** yet.
- Targeted Windows 11 compatibility and signed publisher experience. The owner has no second PC; development and same-PC Windows 10 tests can continue without one. A Windows 11 VM (if owner approves and hardware supports it) or an independent tester can complete a later compatibility gate.
- The bundled FFmpeg build uses GPLv3-enabled codecs (`--enable-gpl`, `--enable-version3`, `--enable-libx264`, `--enable-libx265`). Applicable corresponding-source/redistribution notices, native binary provenance, code signing and repository licensing must be resolved before distributing the executable publicly.
- Actual packaged-app Start/Stop on the physical LG must be tested in a controlled handover **only when the owner allows interrupting the existing working TV session**. Do not start two copies on ports 43196/43198.

## GitHub/source scope

These are source-only changes stacked on draft PR #24 (itself stacked on PR #22). **No EXE binary, Node/FFmpeg redistribution, user pairing secret, real TV settings, source captures or personal profile data are committed.** The original validated private installer is retained unchanged on the owner's laptop while the new R18 preview is evaluated.
