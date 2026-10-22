# TV-first portable Windows preview

This stage builds a **per-user Windows source-and-dependency bundle**. It is not yet a signed v1 installer or an independent device-acceptance result. No installed PC Bridge or Codex executable, Node runtime, FFmpeg executable, private pairing key or research data is bundled.

The included LG libraries (`lgtv2@2.0.2`, `ws@8.22.0`) are MIT-licensed and their LICENSE files are copied into the bundle. The small TvPointer.exe comes from the existing source checkpoint; its independent rebuild/signing provenance remains an explicit **release blocker**. Do not distribute the bundle as a final signed release.

The package contains `install.cjs`, a checksum manifest and a `payload/` tree. `node install.cjs` installs known files to `%LOCALAPPDATA%\Programs\ImAccessibility`, refusing to overwrite an existing install. It does not create tasks, services, shortcuts outside its own directory, networking changes or pairing. The installed folder contains Start.cmd, Stop.cmd, Status.cmd and Uninstall.cmd. User settings are separate, in `%LOCALAPPDATA%\ImAccessibility\settings.json`.

On installation, no TV or AI process is launched. The Start command will validate settings before asking Windows to start the owner's separate on-demand TV host. Stop will request shutdown of the owned TV session without needing an active network adapter. Uninstall refuses modified/unknown runtime files instead of deleting unrelated data.

Run `node packaging/build-preview.cjs <output-dir>` from the repository to construct the content-hashed preview. Then use Windows PowerShell `Compress-Archive` for a transport ZIP. The **manifest fingerprints the payload contents**; the ZIP hash is captured separately as an artifact checksum. Byte-identical ZIP rebuilds are not claimed.

Source/bundle tests run only against disposable directories and never activate a TV stream or Codex session. Follow [configuration guidance](../docs/CONFIGURATION.md) and the [v1 acceptance gates](../docs/V1_RELEASE_PLAN.md).

Before general release: clean Windows 11 install, binary provenance and signing review, actual LG acceptance, guided setup, Start Menu integration and installer recovery testing remain open.
