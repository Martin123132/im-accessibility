# FFmpeg 9.0.1 exact vendor provenance & Windows publisher-signing plan

Status: **PRIVATE BUILD EVIDENCE ONLY — not approval to distribute the binary**.

## Exact bundled FFmpeg: vendor identity established

The `ImAccessibility-Setup-v0.3.17` private preview includes `Runtime/ffmpeg.exe` from Gyan Doshi's Windows FFmpeg **9.0.1 full static build**. Evidence was collected against the original, exact upstream vendor release dated **12 August 2026** rather than a floating "latest" URL.

- Vendor release: <https://github.com/GyanD/codexffmpeg/releases/tag/9.0.1>
- Vendor asset: `ffmpeg-9.0.1-full_build.zip` (GitHub release asset ID **511432320**).
- Vendor asset SHA-256: `2e8e28af97c2ae338ccef92e36da9b2a4cd21d0cad9dde093545606cb07f5b00`; verified against GitHub's release asset digest **and** a fresh private download.
- The inner `bin/ffmpeg.exe` in that release ZIP hashes to `57c56e369d5b4873b4d93fc1a1d833cb7cd8bc9325c14b05c34ce60b22842d8a`.
- Our bundled `Runtime/ffmpeg.exe` has exactly the **same SHA-256**. This establishes byte-for-byte identity with the original vendor EXE; no private recompilation or binary modification was observed.
- The vendor package includes `LICENSE` and `README.txt` with licence/configuration details and external-library versions.

The verified upstream **FFmpeg core** source for this exact vendor version is FFmpeg Git commit
[`bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa`](https://github.com/FFmpeg/FFmpeg/commit/bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa). The source ZIP was independently downloaded and checked for `configure`, `LICENSE.md`, `README.md` and `libavcodec/avcodec.h`, with 10,548 archive entries. Archive SHA-256 `8a3473cde0b7ac3a795ef1d3ea09a086fccf48ccd8c1849a67e2b040de65636e`.

**Limits:** The FFmpeg core ZIP is **not** complete GPL corresponding source for the statically linked full vendor build. Gyan's README identifies **82 external libraries**. The version list is recorded in `ffmpeg-9.0.1-source-inventory.json`; all 82 are marked not-yet-archived/not-yet-build-reproduced. Key GPL components: `x264 v0.165.3223` and `x265 4.3-6-g9ddc216`. Do not mark this binary cleared for public redistribution simply because FFmpeg's upstream core code was obtained.

The binary was compiled with `--enable-gpl`, `--enable-version3`, `--enable-libx264`, `--enable-libx265`; `--enable-nonfree` was **not** enabled. Gyan labels these Windows static builds GPLv3. FFmpeg's own [legal guidance](https://www.ffmpeg.org/legal.html) and the [GNU licence FAQ](https://www.gnu.org/licenses/gpl-faq.en.html) address exact corresponding-source obligations. Before shipping any customer EXE: obtain and document the relevant corresponding source for *all* included components, patches and actual build/install scripts and fulfil applicable GPLv3 conveyance/notice requirements. Legal review may be warranted for how the standalone command-line FFmpeg executable and any other project code are licensed together. Do not assert that all parts of the project are forced under GPL just because FFmpeg is called as a separate process; evaluate the actual distribution architecture.

## Automated private build safeguards

`audit-release.cjs` now reads the pinned source inventory and **fails package integrity if the bundled FFmpeg executable hash differs** from the independently verified vendor executable. New vendor binaries must undergo a fresh provenance review before the pin can be updated. The audit reports that sources/build recipes are incomplete and never sets `readyForPublicDistribution: true`.

Public source repository contains the small machine-readable provenance inventory and code. The **vendor ZIP and full FFmpeg core source ZIP remain private evidence in the owner's test workspace**; neither is embedded in Git, and no vendor binary was uploaded to a GitHub release.

## Windows code signing: verified position and options

On the test Windows laptop, a modern Windows SDK x64 SignTool is installed, but `Cert:\CurrentUser\My` contains **zero currently usable code-signing certificates**. Authenticode status for the current private installer is `NotSigned`; Windows SignTool verification agrees. `verify-publisher-signature.ps1` audits the status and SHA-256 without modifying or signing any file, creating a self-signed certificate or exporting a private key.

The owner can later choose a **verified public-trust publisher identity**, subject to availability and costs. Windows [SignTool instructions](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool) recommend SHA-256 file digest and RFC 3161 SHA-256 timestamps, followed by certificate-chain verification. An untrusted self-signed development certificate is not an acceptable substitute for a public publisher signature.

For Microsoft [Azure Artifact Signing](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart), Public Trust **organisations** in the United Kingdom are currently eligible for identity validation, but Public Trust **individuals** are currently restricted to the US and Canada. Therefore, a UK publisher acting solely as an individual cannot assume they can obtain Microsoft Public Trust individual validation; eligibility as an organisation must be independently established. Other possible routes include a CA-issued organisation-validated (OV) code-signing certificate. Microsoft documents the [SignTool integration](https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations); such setup requires an owner-controlled account, paid subscription where applicable, and verification. **No accounts, certificate purchases, sign-in sessions or private keys are created in this project.**

Even trusted signatures **do not guarantee instant SmartScreen reputation**. The project should publish an exact checksum and publisher once approval is obtained.

## Release status

Remaining before a customer-facing GitHub download:
- FFmpeg full external-library corresponding source/build chain and redistribution obligations.
- Source/rights provenance of the project's own compiled native helpers.
- The owner-approved distribution licence, reconciled with current PolyForm Noncommercial repository terms.
- An approved real publisher signing route/identity.
- Human Narrator/NVDA spoken-accessibility and Windows 11 acceptance when an eligible environment is available.
- Owner sign-off on the specific final release checksum.

No live TV stream, Windows sound, Magic Remote, Codex session, original beta or public GitHub release is altered by this provenance work.
