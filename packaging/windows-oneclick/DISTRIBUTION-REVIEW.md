# Third-party binary redistribution / signing review (not a release approval)

This file accompanies the **source-only draft** for the I'm-accessibility Windows one-click installer. The tested Windows executable is held privately on the owner's PC and is not uploaded to this repository.

## Verified local facts (24 October 2026)

- The installed Windows test ran **Node.js v24.15.0** and **FFmpeg v9.0.1** from the bundled `Runtime` folder. The installer embeds ~115.45 MiB of compressed application/runtime files.
- Node's local `LICENSE` notice was preserved in `THIRD_PARTY/Node-LICENSE.txt` in the generated bundle.
- The FFmpeg build identifies itself as Gyan's `9.0.1-full_build`. Its `-buildconf` reports **`--enable-gpl`**, **`--enable-version3`**, **`--enable-libx264`** and **`--enable-libx265`**. The inspected output does not report `--enable-nonfree`.
- Its included `LICENSE` starts with **GNU General Public License version 3**, and the generated bundle includes `THIRD_PARTY/FFmpeg-LICENSE.txt` and the FFmpeg build README.
- The compiled Windows loopback helper in this TV preview matches the owner's physically tested v0.3.16 helper binary hash `e0be8c56eddadef0f604906faa8cfe7cd7a120782d9cc24d55ceaab83f7a5995`.

## Work needed before distributing a customer executable

1. Establish reproducible source/build provenance for the exact Node and FFmpeg binaries, including licensing notices for transitive components.
2. For this GPL-enabled FFmpeg distribution, meet all applicable GNU GPLv3 corresponding-source and additional notice requirements, including those applying to enabled codec dependencies (not merely providing the text of GPL).
3. Establish build provenance and redistribution scope for the project's own compiled Windows native helpers and pointer helper.
4. Reconcile any desired commercial licence with the repository's current PolyForm Noncommercial 1.0.0 notices and confirm the owner is authorised to relicense all relevant project code.
5. Choose a code-signing/publisher-identity strategy, and verify current Windows Defender/SmartScreen behaviour.
6. Validate the UI and setup flow with actual Windows user interaction, plus later Windows 11 compatibility testing. A Windows Server cloud CI run would not by itself be independent Windows 11 hardware or LG acceptance.

**No release approval is implied.** A build script must not download or distribute binaries without a deliberate owner-approved release decision. Do not package saved LG pairing credentials, user settings, source recordings, login data or Codex integration into customer distributions.
