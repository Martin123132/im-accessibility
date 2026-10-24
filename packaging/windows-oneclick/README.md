# I’m-accessibility — Windows one-click installer (private source preview)

This directory contains source code for a graphical, per-user Windows installer for the existing TV-control-first application. It does **not** contain bundled third-party binaries, personal LG credentials, screen recordings, or public release assets.

**Owner goal:** download one Windows `.exe`, double-click, install the app, select a supported LG television and start/stop desktop streaming from a normal graphical interface. No command-prompt setup and no separately installed Node or FFmpeg should be necessary.

## What has already been demonstrated

On the owner's existing Windows 10 laptop (not a second PC), the separate private v0.3.17 installer was:
- Built as a single ~115.45 MiB EXE with Node 24.15.0 and FFmpeg 9.0.1 bundled.
- Verified against the complete embedded package manifest: **87 files, 87 SHA-256 matches**.
- Installed successfully into a separate disposable `LOCALAPPDATA` profile, with no TV startup.
- GUI self-tested for bundled runtime presence; the app's local setup handler selected the actual physical Wi-Fi adapter and validated TV settings in the disposable profile, without touching the active owner's settings.
- Tested with active-session, unexpected-file and modified-file uninstall refusal cases.
- Fully uninstalled from the disposable profile; the disposable user settings remained intact.

The **physical LG session was never switched to this installer**. Hardware playback is tested separately in the v0.3.17 isolated test profile.

This does **not** establish full Windows 11 compatibility, signed-download trust, approval for third-party binary redistribution, or human-led wizard/shortcuts/Programs-and-Features usability.

## Source components

- `ImAccessibilitySetup.cs`: the one-file GUI installer that embeds an authenticated file inventory and checks every unpacked SHA-256 before completing a per-user installation. It creates desktop and Start Menu shortcuts and an uninstall entry after installation.
- `ImAccessibilityApp.cs`: Windows Forms app for selecting a LAN adapter, entering the owner's LG address, saving first-run settings and requesting an explicitly confirmed TV Start or Stop.
- `ImAccessibilityUninstall.cs`: per-user uninstaller, with owner-settings preservation and refusal if a TV session is active, if unknown files are present, or if installed payload hashes differ from the receipt.
- `gui-config-bridge.cjs`: a narrow allowlisted local interface that delegates to the existing validated Node setup, launch, status and stop modules. No arbitrary command/shell bridge.
- `build-oneclick.ps1`: source-backed, locally reproducible builder that takes an existing checksum-verified TV preview bundle and explicitly supplied, separately licensed runtimes. **It never fetches tools or publishes a release automatically.**

## Build prerequisites and example

Windows x64 with .NET Framework 4.x Windows Forms compiler (the built-in `csc.exe`), PowerShell 5.1+, a checked TV preview bundle, a Node.js 24 x64 executable and its licence file, and a tested FFmpeg executable with its licence and README. The build script creates a new output directory and refuses overwrite.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\packaging\windows-oneclick\build-oneclick.ps1 `
  -PreviewBundle "D:\YourPrivateTvPreview\Bundle" `
  -NodeExe "C:\Program Files\nodejs\node.exe" `
  -NodeLicense "D:\PrivateLicences\node-LICENSE.txt" `
  -FFmpegExe "D:\YourFFmpeg\bin\ffmpeg.exe" `
  -FFmpegLicense "D:\YourFFmpeg\LICENSE" `
  -FFmpegReadme "D:\YourFFmpeg\README.txt" `
  -OutputDirectory "D:\PrivateBuilds\ImAccessibility-New"
```

The result is `out\ImAccessibility-Setup-v0.3.17-PRIVATE-PREVIEW.exe`. Keep this private until provenance and distribution obligations are reviewed and the installer is accepted by the owner.

## Release gates

1. **Same-computer first-run usability acceptance:** verify visually that setup opens, the text/control sizes are accessible, keyboard and screen-reader navigation are usable, selecting the LG TV works, saved settings persist, and the app is available from the desktop/Start Menu and Windows installed-apps list. This can be carried out on an isolated Windows user profile; a second physical computer is **not** required.
2. **Application integration:** the installed copy must start the actual TV only on confirmation, preserve working full-screen picture quality, audio routing and guarded clicks, and stop only its own stream. Never test two versions against streaming ports 43196/43198 simultaneously.
3. **Windows 11 compatibility:** use a licensed Windows 11 virtual machine *on this computer* if its hardware supports it, or Windows CI for installation checks plus later real hardware acceptance. Windows CI using Windows Server is **not** equivalent to a Windows 11 user GUI or LG physical acceptance.
4. **Third-party redistribution review:** Node.js and FFmpeg must ship with appropriate licences/notices and any required corresponding source or source offers; FFmpeg's x264/GPL configuration and compiled native binary provenance require special attention. This source PR must not silently become a downloadable binary release.
5. **Signing and delivery:** choose a genuine code-signing approach, give Windows users a readable version and publisher, and publish a verified, checksum-backed release asset only after owner approval. Test installation, stopping and uninstallation in the intended target environment.

All examples and source files are generic. Do not store personal `settings.json`, pairing keys, runtime tokens or connected-account data in Git.
