# Verified native helpers and priority GPL codec source snapshots — 25 October 2026

**Private preview only: source-to-binary correspondence is now reproducible, but public distribution has NOT been authorised.**

## Source-to-binary reproducibility on the owner's existing Windows laptop

The shipped v0.3.17 bundle contains three independent .NET Framework 4.x x86/x64-neutral native Windows helpers with their C# source files. A new **non-invasive** build checker (`verify-native-source.ps1`) compiles these from checked-in source in a disposable folder using:

`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:exe /optimize+ /platform:anycpu`

The original compiled helper names and exact source/shipped binary SHA-256 values are pinned in `native-source-pins.json`. For the audio-clock-corrected WASAPI helper, the original experimental assembly identity was `LoopbackCapture-clockfix-t11.exe`, *later copied to* `LoopbackCapture.exe`. Compiling it directly with the final filename changes the .NET metadata string table; using the authentic assembly name is essential to meaningful comparison.

**Repeated checks on 25 October:**

| Helper | Original bytes | Rebuilt vs shipped bytes differing | Unexpected differences |
|---|---:|---:|---:|
| LoopbackCapture | 10,240 | 19 | 0 |
| SpeakerEndpoint | 8,704 | 19 | 0 |
| TvPointer | 7,168 | 19 | 0 |

The only remaining differences are in the classic Windows PE timestamp (bytes 136–139) and the 16-byte CLR module MVID field at each helper's recorded, pinned location. The remaining **all bytes**, including compiled executable method bodies, correspond. The metadata fields vary per invocation of this non-deterministic CSC toolchain; therefore **rebuilt files are not asserted to have identical SHA-256**. No compiled test helper was run, installed, signed, or substituted for the physical LG-accepted binaries.

Source-verifier evidence:
`D:\ImAccessibility-ClickInstaller-20261024\NATIVE-REBUILD-EVIDENCE-20261025\source-verification-R33\native-verification.json`
and fresh end-to-end R35 proof:
`D:\ImAccessibility-ClickInstaller-20261024\rebuild-native-verified-R35\out\native-helper-provenance\native-verification.json`.

The one-click `build-oneclick.ps1` now runs native build verification **before packaging** and aborts on unexpected source hashes, original binary hashes, or compiled executable differences outside CSC metadata. The source-only release audit independently refuses any unexpected native source or helper binary substitution. This materially closes the prior *technical* compiled-helper provenance gap. The owner must still verify they hold and can convey the relevant project intellectual-property and licence rights.

## Archived GPL codec source candidates — private

Exact Gyan FFmpeg 9.0.1 full static build was previously verified against the original GyanD GitHub ZIP. FFmpeg's exact core source is archived at commit `bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa`. The README lists 82 external library versions.

Two highest-priority video encoder source trees were downloaded independently as private, SHA-256-verifiable snapshots:

- **x264 v0.165.3223 candidate** — VideoLAN upstream commit `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`, confirmed through the original VideoLAN GitLab API and a public GitHub mirror. Private ZIP SHA-256 `7f091b0e530cee2800d25843307938bcda71b069838240a94d0409acc5296f0f`; expected `x264.c` source present. This commit is associated with the upstream `0.165.3223` version used by Debian, but the *exact Gyan build checkout and patches are still unverified*.
- **x265 4.3-6-g9ddc216** — MulticoreWare upstream commit `9ddc216defd1fa85535cb91456a9f6c09a2c3abc`, verified by GitHub API. Private ZIP SHA-256 `ef5033bc87969f5cd39196303e45c29a91c8a05fb51445168ac1869ee3823c78`; expected `source/encoder/encoder.cpp` present. The commit prefix matches Gyan's reported x265 version. Exact Windows build patches, compiler settings and dependency chain remain unverified.

The two private ZIP files are in `D:\ImAccessibility-ClickInstaller-20261024\FFmpeg-9.0.1-SOURCE-EVIDENCE-20261025\` and are **not committed** to GitHub. `ffmpeg-9.0.1-source-inventory.json` now records each pinned candidate source SHA, repository URL, and honest provenance limits.

**Current status: 2/82 upstream external-library source snapshots archived, 80/82 still missing snapshots; 0/82 exact Gyan Windows build recipes verified.** This is not complete GPLv3 corresponding source, and FFmpeg binary redistribution remains blocked pending applicable source/patch/build/notice obligations.

## Tests, package status and publication boundaries

A new build of the same private v0.3.17 installer at `D:\ImAccessibility-ClickInstaller-20261024\rebuild-native-verified-R35\out\ImAccessibility-Setup-v0.3.17-PRIVATE-PREVIEW.exe` passed native build correspondence for all three helpers plus 87/87 bundled file SHA-256 verification and an exact Gyan FFmpeg vendor SHA-256 pin. Private executable SHA-256: `004c1e96bab87f1ae7435e86a5aa738b4205b16ef48bb131d8fcd1f7c51fd6d1`. No TV or owner-profile install was started by this private packaging run.

Tests before the final codec snapshot update: 144 total, 142 passed, zero failures, two expected skips. Source changes are staged only on the separate installer branch; keep GitHub PR #24 in **draft**, source-only, and never silently merge or upload uncleared executables.

Outstanding: 80+ codec/dependency source snapshots and corresponding build recipes/patches, commercial/noncommercial distribution rights, code signing, spoken Narrator/NVDA acceptance, Windows 11 compatibility, and explicit owner approval. The current LG v0.3.17 and Codex processes are to remain untouched.
