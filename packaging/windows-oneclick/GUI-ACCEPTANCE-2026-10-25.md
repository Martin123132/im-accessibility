# Same-PC Windows GUI acceptance — 25 October 2026

## Test boundary

The owner authorised a same-laptop GUI walkthrough because there is no second physical PC. All application files were installed under disposable `LOCALAPPDATA`:

`D:\ImAccessibility-ClickInstaller-20261024\tests\GUI_Visual_R16`

The test machine runs Windows 10 Home, with a 1920×1080 interactive desktop. The tested private executable was **not installed over** the working v0.3.17 TV session. No live TV power/input, Codex process, firewall configuration or system-wide native executable was modified.

The tested private one-file installer was `ImAccessibility-Setup-v0.3.17-PREVIEW.exe` (SHA-256 `b732d29e87084f00131755402fb1adca0d40133884b4d762a60682228902786d`). It is unsigned and not yet approved for public redistribution.

## Observed normal Windows installation

- The GUI installer itself opened in the interactive Windows desktop with the window title `Install I'm-accessibility`. The installer process remained visible across eight one-second checks when its lifetime was kept inside a test command.
- The disposable profile subsequently contained a complete installation with the correct 87-file installer receipt. Four sampled installed files, including `ImAccessibility.exe`, the GUI bridge, Node and FFmpeg, all matched their manifest SHA-256s. There was **no started TV session**.
- The installer had created real desktop and Start Menu shortcuts. Both were independently inspected using the Windows shortcut COM interface, and both targets matched the *disposable* installed GUI executable.
- A real `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ImAccessibility` entry existed with product name and uninstall command pointing to the same disposable application.
- Although the normal GUI launch was exercised, the test harness did **not** capture a reliable machine-driven invocation receipt for the installer **Install** button before detecting that installation had already been completed. Do not describe that click as independently automated and observed.

## Installed GUI visually verified

The graphical Windows Forms app opened at 775×650 pixels. Its own cropped window screenshot was inspected (evidence kept privately in the test folder, not committed). The layout visibly presented:

- Windows LAN adapter selection (selected `WiFi 2` on the existing PC)
- LG IP address entry, confirmation checkbox and Save setup
- TV audio choice, Start desktop on TV, Stop TV stream, Refresh status and Uninstall
- A status log correctly reporting `State not-started`

Native Windows child-control enumeration found 20 controls with valid handles and labels. In the controlled first-run GUI test, an exact-window message set **192.168.4.253** as a test-only LG address, toggled the LG confirmation checkbox and invoked **Save setup**. The app wrote a valid isolated settings file for `WiFi 2`, displayed `TV setup saved.`, and did **not** start a stream. This IP was only a schema-validation test value; no network action was directed to it.

Important accessibility caveat: a separate `System.Windows.Automation` descendant enumeration returned **zero child controls** even while Win32 child-window enumeration and visual rendering showed them. That may be a test-provider limitation, but it must be investigated with real Windows accessibility APIs and a screen reader; **do not claim assistive-technology acceptance** based on visible controls or Win32 handles alone.

## Uninstall / cleanup outcome

- The installed uninstaller's native system confirmation window was observed with the title `Uninstall I'm-accessibility` while invoked as an isolated test runner. The remote harness did not reliably capture clicking Yes or the subsequent success dialog, so a complete **recorded** human-style two-dialog walkthrough is still needed.
- A final independent inspection confirmed that the disposable installed program directory, test Desktop shortcut, test Start Menu shortcut and its HKCU uninstall registry entry had all been removed. The disposable user's settings file persisted unchanged, including the test address. No installed application process remained.
- Prior disposable regression tests had separately verified that the uninstaller **refused** removal when unknown files, modified hashes or an active session marker were present, and that a clean verification path removed the app while preserving per-user settings.

## Acceptance and release status

This is substantial same-PC installer GUI evidence, but **not** a public customer release. Remaining verification includes keyboard-focus/tab order, Windows Narrator/NVDA semantics, the exact Yes/OK graphical uninstall interaction, Windows 11 compatibility when accessible, GPL-enabled FFmpeg corresponding-source and notices, proprietary code licence reconciliation, native helper provenance and publisher/code signing.

Do not stop the running LG TV app or interfere with Codex to do any of those tests. The source remains on draft PR #24 (stacked on draft PR #22); GitHub `main` is not being changed by this acceptance report.
