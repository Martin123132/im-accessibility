# Private FFmpeg rebuild — 10 November 2026

The narrow libzvbi/LittleCMS patch has been built and tested. **No app installation, installer replacement, TV session, audio-device change or scheduled-task change was performed.** The repository remains private. The accepted Recovery 2.2 runtime and the package builder's existing runtime pin are unchanged.

## Built executables

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| ffmpeg.exe | 132,056,064 | `b35f4924476dad990b0414e3031ab20d7e90604201b39621fd937b265062ea69` |
| ffprobe.exe | 131,855,360 | `bb61125e166c6c31bbb2272355fd13b71ac2ca0bc0e2f1396bf98537dd4f0b6d` |

Local binaries: `D:\ImAccessibility-FFmpeg-Rebuild-20261110\output-attempt3\bin`. Both are unsigned. They are private runtime candidates, not app installers or replacements accepted for physical TV use.

The [candidate record](../packaging/windows-oneclick/ffmpeg-rebuild/private-candidate-20261110.json) records source pins, binary hashes, compiler/link evidence, imported DLLs and test results. The [build instructions and scripts](../packaging/windows-oneclick/ffmpeg-rebuild/README.md) retain the reproduction procedure.

## Provenance and licence exclusions

The original November 7 dependency-image manifest endpoint returned 404. Its surviving config and layers were recovered, and the reconstructed manifest exactly matched the recorded SHA-256 `6fd1c328904af919ead9feedc3c5183eddb0986fd8e478ee9b11087fccdabc4c`. All **17 compressed and uncompressed layer hashes** were verified before loading the image. Its loaded filesystem and build environment also matched.

The build used FFmpeg commit `d4070a14cecc7e29eb278f9b6036c2284255f70d`, vendor builder `c63bb308a1de656b425c132a8102f8fd5389afc5`, and GCC 16.2.0. It ran without networking, with two CPU cores, 6 GiB memory and all container capabilities dropped. Only copied source inputs and a disposable output directory were mounted. The successful build ran from 00:24:07 to 00:44:31 UTC and exited zero.

LittleCMS was rebuilt with both GPL plugins disabled. Its core library matched the original bytes. **2,749 dependency files were unchanged**, seven plugin/libzvbi files were removed, and only `lcms2.pc` changed. Unchanged libraries, including rav1e, were reused from the hash-verified original image; this is not a claim that every dependency was recompiled.

Both executable link maps contain **no libzvbi, lcms2_fast_float or lcms2_threaded archives**. Configure results disable libzvbi, GPL and nonfree options while retaining Media Foundation H.264, OpenH264, AAC, desktop input and HLS. The new executable reports LGPL version 3 or later. This resolves the specific excluded-library findings **for these new hashes**; it does not change the finding attached to the old installed runtime.

The two previously verified corresponding-source/notice ZIPs remain required alongside this rebuild's source/evidence appendix. Their identities are recorded in the candidate record. Retaining exact source, modifications and build instructions follows the [FFmpeg project's guidance](https://www.ffmpeg.org/legal.html). The broader source bundle deliberately includes unused source components under their own notices; it is not a list of linked libraries or a blanket relicensing statement.

## Tests and limits

| Check | Result |
| --- | --- |
| Isolated Windows runtime tests | **11 passed, 0 failed**; 82 child processes, all exited |
| Source regression rerun | **270 passed, 2 expected skips, 0 failed** |
| Source packaging check | Passed |
| Dependency delta and both link maps | Passed |
| Installed application preservation | **129/129 file hashes unchanged** |
| Three TV/audio tasks | Definitions unchanged; Ready; zero triggers |

Runtime tests use generated video and raw synthetic PCM with encoder/scaler/AAC/HLS arguments imported from the actual app. They cover both encoders, both quality modes, with/without audio, bounded rolling playlists, every segment's starting keyframe, decoding and non-silent audio, reconnect numbering/discontinuity, and controlled encoder exit/restart. They do **not** capture the desktop, read speakers, change routing, pair a TV or operate the app's Stop command.

Windows tests ran in a separate directory on the existing Windows 10 host, **not a separate Windows user or VM**. Real LG picture/audio, app Stop/audio restoration, no-console acceptance, packaged install/uninstall, Windows 11 and assistive-technology acceptance remain unverified for this runtime. A second independent byte-for-byte rebuild was not performed. Signing/SmartScreen and final distribution packaging/source-delivery gates remain open. Nothing was merged or publicly released.

## Transparent build/test record

Two initial build attempts stopped before FFmpeg compilation: extraction tried to restore upstream archive ownership without CHOWN capability, then the script assumed the archive used a full-hash directory name. The final script uses `--no-same-owner`, verifies input hashes and uses the actual pinned archive directory. Logs for both attempts remain saved.

The first runtime fixtures incorrectly expected the beginning of a six-second stream to remain in a four-segment rolling playlist. The reconnect fixture also needed to inspect the initial discontinuity before it rolled out, and to use distinct decoded-audio filenames. Those test-script mistakes were corrected; **no executable or app code was changed between runtime runs**. Earlier failing receipts remain alongside the final passing run. The first source-suite run hit a temporary GUI-folder cleanup error; the GUI-only and complete reruns passed.

A patch was initially applied in the old extracted builder directory by mistake, immediately reversed, and the two original recipes restored byte-for-byte from the hash-verified archive. The final build applied the patch itself inside its disposable container. The installed application was not involved.

Docker was initially stopped. Starting it automatically restarted one unrelated pre-existing container; that side effect was recorded and the container returned to a stopped state. The build containers were removed and Docker Desktop and its Linux environment shut down. A cache-release receipt records measured Windows available memory, without adding process working-set figures. Automatic approval review blocked deletion of `D:\Temp\imaccess-selection-GQh6cA` without a more specific reason; the inactive test folder was retained. No broad process cleanup was used.

All detailed local evidence is retained under `D:\ImAccessibility-FFmpeg-Rebuild-20261110`, including `output-attempt3`, `runtime-tests-verified`, previous test attempts, preservation receipts and build-tool cleanup records.
