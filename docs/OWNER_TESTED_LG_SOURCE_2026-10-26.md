# Owner-tested LG source and Windows controls — 26 October 2026

This checkpoint records the **source** associated with the owner's working Windows-to-LG accessibility prototype. It is not a signed installer, public binary release or broad TV compatibility claim.

## Version and actual scope

The private LG source-preview candidate is **v0.3.21** (the public source package metadata is `0.3.21-preview`). It includes the Cinema viewing mode, compact top-left LG menu, optional fast viewer, 10-minute owner-granted mouse permissions, on-demand owner viewing, laptop speaker restoration, and the later **live-edge/HLS stutter corrections** in commit `e322f22`. The separate Windows controls and multibrand finder added in this source sync live under [`packaging/windows-control-panel/`](../packaging/windows-control-panel/).

On the owner's Windows 10 / LG OLED CX acceptance machine, the latest owner-started session displayed a full-screen episode with the original media application. The owner reported substantially improved TV picture quality after the playback fix. The measured network backend reported a ready Cinema H.264/AAC stream with both cast and viewer endpoints healthy. **Subjective long-duration smoothness, lip sync and every device type have not been independently certified.**

### Owner-side local Windows controls

- A small WinForms tray/taskbar panel indicates **TV ON / OFF / status unavailable**, with Start, Stop and Refresh.
- **Find TVs** uses read-only SSDP and mDNS queries, displays saved LG first, and also detects other TV/casting services when advertised. The owner's test detected **two separate TVs/devices on the home Wi-Fi**; brand attribution can remain generic when the discovery protocol exposes only DIAL.
- The **saved LG webOS TV is currently the only supported streaming/control target**. Samsung, Sony/Android TV, Roku, Chromecast/Google Cast, AirPlay/Apple TV, Fire TV and DLNA/DIAL discovery are **discovery-only**.
- Source examples of two optional, limited-permission, **on-demand** Windows Task Scheduler tasks are included: one owner viewing session and a separate audio-recovery guard. Installing this source or building the panel **does not create, replace or automatically start any task**.
- The current private installed TV test has a machine-specific, owner-approved task registration; that registration, pairing credentials, private test profile, IP addresses and TV selection are **not part of the public Git repository**.
- The separate WinForms source compiles on Windows with the .NET Framework C# compiler; packaging into the public one-click installer, Windows 11 user testing and signed binary distribution remain pending.

## Tests and release position

Source regression tests cover viewer playback, guarded speaker restoration, Cinema switching, task lifecycle and safe device discovery. Run:

```powershell
npm.cmd test
npm.cmd run check:source
node --test packaging/windows-control-panel/TVFinder.test.cjs
```

For a standalone, non-installing control-panel compilation, follow [its README](../packaging/windows-control-panel/README.md). The main repository does not include the installed PC Bridge program.

**Known release gates:** third-party FFmpeg/x264 GPL redistribution evidence (including corresponding source and build recipes), code signing, Windows 11/Narrator/NVDA acceptance, independently usable setup and Windows task upgrade/uninstall behaviour. Private unsigned setup executables are not published here.

The project retains its existing PolyForm Noncommercial licence and required notices; this source sync does not alter customer rights or grant commercial redistribution of third-party components.

## Important distinction

Updating GitHub source does **not** modify or restart the owner's currently working LG TV session. GitHub source, an installed private Windows preview, and a tested production-ready Windows installer are **three different milestones**.
