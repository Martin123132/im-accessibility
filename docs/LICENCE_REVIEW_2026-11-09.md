# Completed dependency review: one distribution blocker

The missing rav1e dependency resolution has been recovered. The copyright/licence review is complete **with a failing redistribution result for the current FFmpeg binary**: libzvbi introduces GPL-2.0-only source on an enabled decoder path. This is a concrete finding, not a request for the owner to approve unspecified ownership. The repository remains private, and the accepted installed Recovery 2.2 has not been altered.

## Recovered build record

The [original October 31 compilation log](https://github.com/FFmpeg-Builds/FFmpeg-Builds/actions/runs/41222097386/job/124652954476) records exactly three resolution changes:

| Package | Resolved version | Registry/source SHA-256 |
| --- | --- | --- |
| cc | 1.10.0, replacing 1.2.26 | `86e055fa6e3e40ad6187ba25b6855eeb635d5271f8e0f0e1e9a5826b8d75bea0` |
| find-msvc-tools | 0.1.15, added | `1c66915cc5391097de7a2b0b972e8505aa33c0df401fd3a6811dbdb32881ba48` |
| shlex | 2.0.1, added alongside 1.3.0 | `f8fadd59c855ef2080decdef8ff161eb6661b86933c9d82e5ba29dc602a55aba` |

The recipe SHA-256 is unchanged between the original compilation and the release builder. Nine build records trace compilation/cache reuse through November 7 with the same base-image digest `4ef6a4084baaa415f71f1b21dda870790e8751a0ccd68201f546faf01e6f8744` and pinned rav1e source-cache identity. These three archives already existed in the retained 601-archive source superset; their checksums were independently matched against the crate registry.

The original generated post-update lockfile was not recovered byte-for-byte. A **documented reconstruction** applies the three logged changes to the exact original lockfile, disambiguates the two shlex versions and verifies that every dependency reference resolves across all **277 packages**. Its SHA-256 is `d031d0ff0d17c3fe603473dcb4d56eec4a41f38ef0120b6633cc90ed227d7168`. The [build record](../packaging/windows-oneclick/third-party-notices/FFmpeg-Build-Record.json) retains log identities, hashes, source pins and that distinction. The former unknown dependency-version blocker is closed; a byte-identical FFmpeg rebuild is not claimed.

## Licence result and corrections

The [review matrix](../packaging/windows-oneclick/third-party-notices/FFmpeg-Licence-Review.json) covers all **85 vendor source stages** and **601 Cargo licence declarations**. A further scan inspected **63,181 source files**, preserving copyright/permission blocks alongside the standalone notices. The collection now contains **14,274 distinct documents or attribution blocks**, with **45,597 component/path references**. It is deliberately a source superset, including optional platforms, tests and build tools; these numbers are not counts of linked libraries.

Corrections include explicit FreeType acknowledgement, libxml2 and other per-file attributions, original declaration-only Cargo manifests, and the recovered build record. The original project licence is unchanged; third-party terms remain separate. MIT/BSD/ISC/Zlib/Apache/Unicode/MPL/LGPL notices, applicable alternatives and exceptions are mapped to retained sources. Source/build delivery to recipients remains a requirement of any future authorised distribution, rather than a reason to make the owner's repository public now. See the [FFmpeg guidance](https://www.ffmpeg.org/legal.html) and [Mozilla MPL guidance](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) for their respective source/notice requirements.

GPL-related hits were checked against their actual scope: GLib's Valgrind header has its own BSD permission; MinGW stdarg has an inclusion exception; SDL HIDAPI allows a BSD alternative; glslang's generated parser includes the Bison exception; GME selects the LGPL Nuked emulator rather than GPL MAME. Command-line utilities, demos, tests and disabled submodules were distinguished from the selected libraries.

The LittleCMS recipe builds GPL plugins and puts their static archives on the final link line. No plugin-entry references were found outside the plugin source/tests or in FFmpeg, and the link does not use whole-archive. Presence of an unused archive on that line alone is not evidence of incorporated GPL code. The prepared future-build patch disables these unused plugins explicitly.

### Blocking finding: libzvbi

The pinned upstream revision is `34bb6f660c5c1bacd4a66cc7b22311e4ca3c1ab5`. Its [packet-830.c](https://github.com/zapping-vbi/zvbi/blob/34bb6f660c5c1bacd4a66cc7b22311e4ca3c1ab5/src/packet-830.c), pdc.c and [COPYING.md](https://github.com/zapping-vbi/zvbi/blob/34bb6f660c5c1bacd4a66cc7b22311e4ca3c1ab5/COPYING.md) identify GPL version 2 only for that code.

The source files appear in `libzvbi_la_SOURCES`. The enabled `src/packet.c` calls the packet-830 decoder functions without a compile-time exclusion. FFmpeg's enabled teletext decoder calls the libzvbi decoder, and the recorded final executable link includes `-lzvbi`. This is a source/build/link-command assessment, **not a recovered object-level link map**. The stripped executable's lack of those symbol names cannot establish their exclusion.

That evidence prevents clearing this executable as an LGPLv3-only dependency chain. The auditor now reports `ZVBI_GPL2_ONLY` even when vendor flags say LGPL and all source/notice hashes pass. Adding licence texts cannot resolve incompatible terms on an enabled code path. No upstream notices were rewritten and no unsupported infringement or theft conclusion is asserted.

The [narrow reconstruction patch](../packaging/windows-oneclick/ffmpeg-rebuild/exclude-unused-copyleft.patch) disables libzvbi and the unused LittleCMS GPL plugins in a separate future build. It passed `git apply --check` against the exact vendor builder. No replacement runtime has been built or installed. The existing Docker Linux engine was not running; no engine, service or build container was started. A new runtime would require fresh source/binary pins and owner physical acceptance; those cannot be inherited from Recovery 2.2.

## Validation and retained evidence

- Full source suite: **270 passed, 2 expected skips, 0 failed**.
- **736/736 source/provenance files** passed size and SHA-256 checks. Source completeness and copyright clearance are separate fields; the latter remains false for this runtime.
- Regression tests ensure that complete source, absent GPL configure flags or a missing review file cannot erase the known licence finding.
- Readable and exact-byte notice packages are pinned by the builder; the private QA package is verification-only, not an owner replacement.
- The standalone private QA EXE verified **107/107 embedded files**, zero payload/private-path failures, and exited normally. Its SHA-256 is `fbe20ea85eca62c44763b3fb2b8faf87c2b7796511bc16d75b086ac02647771e` (107,506,688 bytes). The audit correctly reports the libzvbi blocker; a packaging pass is not licence clearance.
- No hosted CI run, public release, merge, signing purchase or visibility change is part of this work. No installation, TV stream, pairing, shortcut or scheduled-task mutation was performed.

Working files and receipts remain under `D:\ImAccessibility-Distribution-Evidence-20261109`, including `Build-Record-Recovery`, `Licence-Review-Evidence` and `Reviewed-Source-Bundle`. Earlier bundles are preserved. The original acceptance and signing/Windows/accessibility limitations remain as previously recorded; this completed source/licence review does not claim those physical stages passed.

The two updated source ZIPs were verified by reading all **746 members** back from the archives (736 retained files plus distribution materials). Part 1: 1,444,201,250 bytes, SHA-256 `215a284f1fafaec6f42a91bef946cc914b6e45ae6a0f35aaec3b9e9c4ca80dc4`. Part 2: 924,879,727 bytes, SHA-256 `caf73f180a7f19a3648fe5e4e1bdbb508605d9e0a9d183aae3cb4525878eb705`. Neither source ZIP nor the QA EXE was uploaded or published.

**10 November follow-up:** the owner subsequently authorised an isolated patched FFmpeg rebuild. It is completed and documented in the [new runtime evidence report](FFMPEG_PRIVATE_REBUILD_2026-11-10.md). The old runtime assessment above remains historical and unchanged; the working installation was preserved.
