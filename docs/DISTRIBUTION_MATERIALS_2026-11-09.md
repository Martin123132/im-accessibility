# Distribution materials correction — 9 November 2026

The repository is private. This work does not authorise publication, replace the accepted installation, change the project's licence, or establish complete third-party compliance. Dependency due diligence and packaging are implementation work; an unspecified request for the owner to approve copyright ownership is not a substitute for that work.

## Verified findings

| Component | Evidence | Result |
| --- | --- | --- |
| Node 24.15.0 | The bundled executable SHA-256 `3331e1ffe19874215472217c5e94f5a0c6d8e18c4ac7111d3937aa0ad5e9b4a5` matches the official [SHASUMS256.txt](https://nodejs.org/dist/v24.15.0/SHASUMS256.txt) entry for `win-x64/node.exe`. The bundled complete licence SHA-256 `4573185d56580da2b890ba34a85a409257640f1c5632eade4300137266194d18` matches the [upstream versioned licence](https://raw.githubusercontent.com/nodejs/node/v24.15.0/LICENSE). | No missing Node notice or executable-origin mismatch found. |
| lgtv2 2.0.2 and ws 8.22.0 | The private payload includes each package's MIT licence; versions are pinned and checked by the payload builder. | Notices present. This is separate from the project's PolyForm terms. |
| OpenH264 | The [pinned vendor recipe](https://github.com/BtbN/FFmpeg-Builds/blob/c63bb308a1de656b425c132a8102f8fd5389afc5/scripts.d/50-openh264.sh) statically builds revision `1bca62311e447fd9c39fc93de2c4b96cd5ce971c`. Its [BSD licence](https://raw.githubusercontent.com/cisco/openh264/1bca62311e447fd9c39fc93de2c4b96cd5ce971c/LICENSE) permits redistribution subject to its notice conditions. That notice was missing from the accepted private payload. | Corrected in the builder; the auditor now detects its absence or alteration. |
| LGPLv3 accompanying text | The bundled LGPLv3 text incorporates GPLv3, but the standalone GPLv3 text was absent from `THIRD_PARTY`. The text is taken from the [exact FFmpeg core revision](https://raw.githubusercontent.com/FFmpeg/FFmpeg/d4070a14cecc7e29eb278f9b6036c2284255f70d/COPYING.GPLv3). | Both texts are now included in new packages. This does not change the FFmpeg binary or its LGPL configuration. |
| Project/native helpers | The payload includes the three C# sources and the original project LICENSE/NOTICE. All three binaries again matched those sources except recorded compiler metadata. | Source correspondence verified. This is not an independent authorship or infringement investigation. No new third-party permission requirement has been established from this comparison. |

The release auditor now separates the owner's decision not to publish from concrete missing redistribution materials. Its previous unconditional requests for owner approval of project/native rights were not evidence of an identified infringement. Existing project terms are retained unchanged; third-party terms remain separate.

## Initial notice correction

- `third-party-notices/pins.json` records exact upstream URLs and SHA-256 values for the two added texts. The builder verifies and packages them only for the matching LGPL FFmpeg binary.
- The auditor reports missing or altered known notices. It deliberately does not describe this small list as a complete FFmpeg dependency inventory.
- Full source suite: **266 passed, 2 expected live snapshot skips, 0 failed**. Source packaging and diff checks passed.
- A separate packaging QA build verified **99/99 payload hashes**, zero private-data flags, both new notices and the same Node/FFmpeg/native binary pins. The actual standalone EXE's `--verify` also returned `SUCCESS VALID` for all 99 embedded files and exited normally. No app was installed or TV/audio session started. This QA artifact is not an owner replacement or public release.
- QA installer SHA-256: `b8bf7fc1bd65d9b30e4f40e12104ae44dc9834b04744cd27403732b74bdff761`. The accepted installed Recovery 2.2 remains unchanged.

## Exact source-cache recovery

Local receipts under `D:\ImAccessibility-Distribution-Evidence-20261109` retain these upstream archives:

| Archive | SHA-256 |
| --- | --- |
| FFmpeg core `d4070a14cecc7e29eb278f9b6036c2284255f70d` | `1c472b0d819c2c5a94948bd4fabda6d126b1f2126122667e35030d2914a4c7c1` |
| Vendor builder `c63bb308a1de656b425c132a8102f8fd5389afc5`, including recipes and patches | `44fe4f6ff1de441e002e68442fd1d4187a3de66d280b523eb720733ec48e4789` |
| OpenH264 `1bca62311e447fd9c39fc93de2c4b96cd5ce971c` | `b1da7c75c1e6c69637cc27297473e4abe881eead289fec658c1951dce84e6a2d` |

The exact vendor [Actions run 42371123454](https://github.com/FFmpeg-Builds/FFmpeg-Builds/actions/runs/42371123454) retained a source cache. Artifact `13573434797` was downloaded and matched its upstream SHA-256 `2f29e897be7c7a60bf62ef7c81573c760c2829b39362836682d9028aed6c5949` (2,243,238,800 bytes). The actual Windows LGPL 9.0 image log identifies **88 recipe stages, including 85 source archives**. These were retained rather than substituting current upstream branches. The builder archive supplies its recipes and patches, including AOM and aribb24 patches and the librsvg/Rust build edits.

The collection also includes **601 checksum-verified Cargo registry source archives**, a conservative superset of the root rav1e, librsvg and Rust library lockfiles. They include optional, test and build dependencies; these are not 601 linked runtime libraries. All **352 librsvg vendored packages and 18,527 vendored files** matched their recorded checksums. Twelve crate versions embedded in the binary and the Rust source revision were recorded separately.

The binary contains Rust revision `58cf8f9c35b355199727627d07ae34a4e2846d67`. Its exact source and Rust 1.99.1 official distribution were retained; the distribution matched the official channel manifest. The package now carries the official `COPYRIGHT-library.html`, GCC runtime exception texts, MinGW notices, FreeType's FTL and NVIDIA header notices. The MinGW runtime source at `7213d719fe344553aa24fef7cc7dedee4940d594` is already among the 85 vendor archives; the separate v14.0.0 archive documents the base toolchain version.

The pinned [source manifest](../packaging/windows-oneclick/third-party-notices/FFmpeg-Source-Materials.json) records **707 retained files, 2,302,174,387 bytes**. All 707 passed a fresh size/SHA-256 verification. The read-only [verifier](../packaging/windows-oneclick/verify-source-materials.cjs) detects changed, truncated, missing, duplicate and unsafe paths and refuses another runtime's inventory. It does not execute downloaded sources or approve publication.

## Private bundles and package validation

Two deterministic ZIP parts are retained under `D:\ImAccessibility-Distribution-Evidence-20261109\Source-Bundle`. Their actual contents were read back and hash-verified. The ZIPs contain the 707 retained files plus the notices, manifest and verifier; all 714 ZIP members passed.

| Source ZIP | Bytes | SHA-256 |
| --- | ---: | --- |
| `ImAccessibility-FFmpeg-Sources-20261107-part1.zip` | 1,448,207,811 | `d36bfd53a36858df581f2aa1a6ad4f6b8190cbda675379784979b7cbd1a5bf56` |
| `ImAccessibility-FFmpeg-Sources-20261107-part2.zip` | 861,284,099 | `ec66e152a4c66b5fa73bd2edb51048fba931de954a898f61213d0f8a096e9caf` |

The notice ZIP preserves **682 distinct upstream documents with 2,364 component/path references**; the companion text is a readable rendering. This deliberately includes optional/test/build source notices, not just linked runtime notices. It does not apply those licences to the original application. Some upstream crates declare MIT in Cargo.toml without a standalone notice; their original manifests were retained without inventing copyright ownership.

The builder now verifies and includes the notice collection, official Rust library attribution, source manifest and source README. The auditor distinguishes a packaged manifest from verification of the external source archives; it no longer misleadingly reports zero archived LGPL sources or borrows the unrelated Gyan GPL inventory's counts.

- Final full source suite: **269 passed, 2 expected live snapshot skips, 0 failed**. Source packaging and diff checks passed.
- Separate private QA installer: **104/104 payload files verified**, zero private-data flags; all known additional material pins present. The standalone EXE's `--verify` returned `SUCCESS VALID`, 104 files, and exited normally.
- QA EXE SHA-256: `ee6fdafa2cb571fe2edb2dabbdedea26e4356a20139b7e7c5d7a36ed33c4ea08` (94,780,928 bytes), under `D:\ImAccessibility-Distribution-Evidence-20261109\Materials-QA-Candidate\out`. This is packaging QA, **not an installed or physically accepted replacement**.
- Node, FFmpeg and the three native helper pins are unchanged. No application, pairing, discovery, Start/Stop or audio implementation was changed in this materials pass.
- Read-only comparison confirmed the installed GUI, Node and FFmpeg still match the accepted Recovery 2.2 artifact. Both legacy tasks and the per-install AudioGuard remain Ready with zero automatic triggers. No installation, uninstallation or TV stream was started; only the EXE's non-installing verification mode was used.
- No public binary, new merge, hosted CI run, signing purchase or visibility change was performed. GitHub remains private. The source bundles stay local; only the notice/manifest/verifier changes are pushed to the private source branch.

## Precise remaining limits

1. The vendor rav1e recipe runs `cargo update cc` before compiling. Its cached image log does not preserve the resulting Cargo.lock. The original lockfile and exact archived packages do not prove the final versions of that build tool or dependencies updated by the command. This is a build-provenance gap, not evidence that the application stole code. No byte-identical FFmpeg rebuild was attempted or claimed.
2. The collected notices are a conservative source superset. Complete runtime-linkage and notice-obligation review is still open; collecting 682 texts is not itself proof of compliance. The manifests identify the scope and original source locations rather than declaring blanket approval.
3. Required source/build materials must be available to recipients if a binary is eventually published. The two verified bundles currently exist privately. No public source offer or public binary publication is authorised.
4. Trusted signing/SmartScreen acceptance, Windows 11, human Narrator/NVDA acceptance, genuine separate-user/VM installation and physical DHCP renewal remain unverified. Recovery 2.2 picture/audio and normal Stop were accepted by the owner earlier; this packaging-only QA does not expand that physical acceptance.

The accepted installation was preserved throughout. The specific remaining engineering and acceptance work above stays recorded; it is not replaced by a request for the owner to approve unspecified copyright ownership.
