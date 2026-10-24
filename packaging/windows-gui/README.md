# Windows click-to-install GUI source — PRIVATE preview

This directory is an additive installer/UI packaging layer for the LG v0.3.17 memory-candidate source. It does **not** overwrite the original owner beta, replace the existing TV installation, pair with a television automatically, or publish executable release assets.

## What it contains

- `ImAccessibilitySetup.cs` — native Windows WinForms single-EXE setup bootstrapper embedding a checksum-listed ZIP. Installs per-user to `%LOCALAPPDATA%\Programs\ImAccessibility`, refuses existing installations, and attempts Start Menu and Desktop shortcuts without overwriting shortcuts that already exist.
- `ImAccessibilityApp.cs` — graphical on-PC LG connection wizard (physical NIC selector, explicit TV IP confirmation), opt-in sound control, Start, Stop, session status and Uninstall controls. TV does not automatically start on app open.
- `gui-config-bridge.cjs` — narrow local bridge to existing `first-run.cjs`, `launch-host.cjs`, `stop-session.cjs` and `status-session.cjs`. No pairing credentials embedded.
- `ImAccessibilityUninstall.cs` — graphical per-user uninstall flow that checks installed inventory, refuses an active/uncertain TV session, preserves personal TV settings outside the app folder, and removes shortcuts only if their targets match the installed app.

## Verified private build (not attached to this repository)

`D:\ImAccessibility-ClickInstaller-20261024\out\ImAccessibility-Setup-v0.3.17-PRIVATE-PREVIEW-v4.exe`

SHA-256: `2bf2557505dbd05c4ab8ee26c431882dc58d8aba08b66331a94ef624b50cd86d`.

- 87 internal installed files, including separately shipped Node.js v24.15.0 and FFmpeg 9.0.1 full build, distributed only in this **private local preview**.
- Windows 10 command-line integrity check: embedded file hashes verified and manifest valid; *all 87 items* passed.
- Offline install in disposable fake per-user profile succeeded without starting any LG video or generating TV settings unprompted.
- GUI headless selftest, bundled Node + FFmpeg discovery, uninstaller inventory verification and backend first-run configuration validation passed.
- A second attempt against the same disposable installation was correctly refused, leaving binary files and settings unchanged.
- Direct GUI mouse-click, full Windows 11 install/TV acceptance, uninstall deletion journey, and digital signature/SmartScreen reputation have **not** been tested. This is still a **release candidate for further work**, not a certified public product.

## Rebuild conditions / licensing restrictions

The published source intentionally excludes the binaries and the packaged ZIP/installer. To assemble a **private** Windows installer use Microsoft .NET Framework C# compiler (or an equivalent modern SDK), and supply the currently approved TV payload, exact Windows Node.js runtime binary + official licence, and the exact FFmpeg binary + corresponding licence/readme. Compile the GUI and uninstaller into payload, create an SHA-256 file manifest, ZIP the payload and compile the setup bootstrapper embedding that ZIP under resource name `ImAccessibilityInstallerPayload`.

The physical reference uses `libx264` via FFmpeg. The locally bundled Gyan FFmpeg 9.0.1 full build reports `--enable-gpl`, `--enable-version3` and `--enable-libx264`, and GPLv3-or-later terms. A redistributed product needs its relevant GPL licence/source/provenance obligations and compatibility with the project's PolyForm Noncommercial terms reviewed. Node runtime licence and other third-party notices must also be carried. Public distribution is **not authorised by this source draft**.

The installer currently starts the existing project's default TV receiver page; the owner-approved fast full-screen view is available through TV controls. A direct fast-mode selection in the GUI is a remaining usability improvement, and no change to the working v0.3.17 installation is made here.

## Safe use

Leave all currently running LG, Codex and PC Bridge processes alone during installer source work. Tests are directed at isolated Windows `LOCALAPPDATA` fixtures. No GitHub release asset, merge into `main` or public signed installer has been generated from this source commit.
