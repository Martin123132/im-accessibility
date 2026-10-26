# Windows TV Controls and multi-brand discovery — source preview

This is the small Windows **I'm Accessibility** companion developed during the owner's October 2026 LG TV tests. It is a **source preview**, not a signed or customer-ready installer.

The panel provides a taskbar/notification-area **IA** icon, read-only **TV ON / OFF / starting / unavailable** status, owner-confirmed **Start TV** and **Stop TV**, and **Find TVs**.

## Supported discovery

**Find TVs** sends bounded, read-only SSDP and DNS-SD/mDNS discovery queries over the selected private LAN. It recognises advertised services associated with LG/webOS, Samsung, Sony/BRAVIA, Roku, Google Cast, Android/Google TV, Apple AirPlay/Apple TV, Amazon Fire TV, DIAL/DLNA, and some other manufacturers.

Discovery is not casting compatibility. **Only the owner-verified LG webOS connection is presently implemented.** Other devices are labelled *discovered — connection not yet supported*. The current saved LG TV is always kept as the supported/selected device. A device can appear more than once across discovery protocols; results are deduplicated by LAN IP. Multicast-disabled networks may return no devices.

The finder **never** pairs, opens a TV app, changes the saved TV, scans ports, changes audio, grants mouse access, or starts streaming.

## Source and building

- `TVControls.cs` — tiny WinForms status panel and owner-confirmed controls
- `TVFinderDialog.cs` — read-only device-list dialog
- `TVFinder.cjs` — bounded SSDP/mDNS LAN scanner
- `TVFinder.test.cjs` — synthetic parsing, aliasing and subnet tests
- `Run-Owner-TV.ps1` — manifest-checked owner session task runner
- `Owner-TV-Control.ps1` — limited-user, opt-in Windows task Start/Stop/status

Build the GUI on Windows with .NET Framework C# compiler, into a **new, empty directory**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File packaging/windows-control-panel/build-panel.ps1 -OutputDirectory C:\Temp\ImAccessibility-Control-Panel-Preview
```

This does **not** install the app, configure Windows, register tasks, or start a TV stream.

The intended installed layout is:

```text
%LOCALAPPDATA%\Programs\ImAccessibility\
  Runtime\node.exe
  tv-reliability-v0.5\release-config.cjs
  Control-Panel\ImAccessibility-TV-Controls.exe
  Control-Panel\TVFinder.cjs
  Control-Panel\Owner-TV-Control.ps1
  Control-Panel\Run-Owner-TV.ps1
```

Validated per-user settings are under `%LOCALAPPDATA%\ImAccessibility\settings.json`. Source developers may supply `IM_ACCESSIBILITY_CONFIG_PATH` explicitly for a read-only scanner test. The owner TV task script requires the matching installed v0.3.21 manifest and pinned helper files; this prevents launching an unrelated or incomplete installation.

### Safety and integration status

The Windows task controls support `Status`, `Start`, `Stop`, owner-approved `Enable` and `Disable`. Task installation requires explicit `-OwnerConsent YES`; there are **zero automatic triggers**, no elevated permissions and no Task Scheduler time limit. Stop only ends the owned TV session. The independent speaker-restoration task remains separate.

**These files are not yet integrated into the public one-click installer.** The owner-tested machine had a local task registration and app-profile paths that are intentionally not published here. Before public installer integration, verify task registration, path rebinding, uninstall, keyboard accessibility and Windows 11 tests. No private pairing keys, personal settings or private runtime files are in Git.

Run scanner tests with:

```powershell
node --test packaging/windows-control-panel/TVFinder.test.cjs
```

The main `npm test` also includes these tests. All source and bundled-code rights remain governed by the repository's existing licence. The unsigned Windows binaries and GPL-configured FFmpeg redistribution requirements remain **release blockers**.
