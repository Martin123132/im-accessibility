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

## Changes and validation

- `third-party-notices/pins.json` records exact upstream URLs and SHA-256 values for the two added texts. The builder verifies and packages them only for the matching LGPL FFmpeg binary.
- The auditor reports missing or altered known notices. It deliberately does not describe this small list as a complete FFmpeg dependency inventory.
- Full source suite: **266 passed, 2 expected live snapshot skips, 0 failed**. Source packaging and diff checks passed.
- A separate packaging QA build verified **99/99 payload hashes**, zero private-data flags, both new notices and the same Node/FFmpeg/native binary pins. The actual standalone EXE's `--verify` also returned `SUCCESS VALID` for all 99 embedded files and exited normally. No app was installed or TV/audio session started. This QA artifact is not an owner replacement or public release.
- QA installer SHA-256: `b8bf7fc1bd65d9b30e4f40e12104ae44dc9834b04744cd27403732b74bdff761`. The accepted installed Recovery 2.2 remains unchanged.

## Source materials retained and remaining work

Local receipts under `D:\ImAccessibility-Distribution-Evidence-20261109` retain these upstream archives:

| Archive | SHA-256 |
| --- | --- |
| FFmpeg core `d4070a14cecc7e29eb278f9b6036c2284255f70d` | `1c472b0d819c2c5a94948bd4fabda6d126b1f2126122667e35030d2914a4c7c1` |
| Vendor builder `c63bb308a1de656b425c132a8102f8fd5389afc5`, including recipes and patches | `44fe4f6ff1de441e002e68442fd1d4187a3de66d280b523eb720733ec48e4789` |
| OpenH264 `1bca62311e447fd9c39fc93de2c4b96cd5ce971c` | `b1da7c75c1e6c69637cc27297473e4abe881eead289fec658c1951dce84e6a2d` |

The FFmpeg build enables many other libraries, including FreeType, HarfBuzz, libass, libjxl, libplacebo, libssh, libvpx, libwebp, libsoxr and libzimg, with additional dependencies. The pinned vendor tree contains 134 recipes across platforms and licence variants; that is **not** the count of libraries in this Windows LGPL binary. A recipe inventory is retained locally. Complete source/patch/build and notice coverage for the actually bundled dependency graph remains unfinished engineering work. These three archives alone do not close it. The runtime was not replaced or rebuilt to avoid that work.

This report establishes the concrete package defects above and their corrections; it does not establish complete dependency compliance or independently certify authorship. Public distribution remains unauthorised.
