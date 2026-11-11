# Narrow runtime reconstruction patch

This patch applies to vendor builder `c63bb308a1de656b425c132a8102f8fd5389afc5`, for the private `win64 lgpl 9.0` reconstruction only. It disables libzvbi and the unused LittleCMS GPL plugins. It does not modify the installed app, its runtimes, or its scheduled tasks.

**10 November result:** the private rebuild and 11 isolated runtime checks passed. See the [evidence report](../../../docs/FFMPEG_PRIVATE_REBUILD_2026-11-10.md) and [candidate hashes](private-candidate-20261110.json). Nothing was installed or publicly released.

The pinned libzvbi source includes GPL-2.0-only packet/PDC implementation on the enabled decoder source path. This is a concrete reason the current vendor-labelled LGPL executable cannot receive redistribution clearance. The LittleCMS plugins are also GPL-licensed; they are built and listed as static libraries but no plugin entry-point references were found outside their own source/test trees or in FFmpeg. Disabling those unused plugins removes the ambiguity for a future build.

The isolated reconstruction reuses the **exact original dependency image**, applies the patch in a separate builder copy, rebuilds LittleCMS, removes the disabled libzvbi stage's files, and rebuilds the pinned FFmpeg core. Unchanged dependencies, including rav1e, retain their original compiled bytes. This avoids an unrelated toolchain/dependency upgrade.

For a separate full rebuild of every dependency from source, use `rav1e-post-update-reconstructed.Cargo.lock` from the private source bundle and replace the moving `cargo update cc` step with that recorded resolution. It selects `cc 1.10.0`, `find-msvc-tools 0.1.15`, `shlex 2.0.1`; the recovered original build log records precisely these three changes. The reconstruction is not claimed to be the original generated lockfile's exact bytes. The scripts here do not claim to have rebuilt every unchanged dependency.

Build the same FFmpeg core `d4070a14cecc7e29eb278f9b6036c2284255f70d` in a disposable Linux/Docker environment. Retain the new build log, resolved locks, source modifications, toolchain identity and corresponding source. Do not use current moving branch tips. Confirm `--disable-libzvbi`, no GPL/nonfree flags, no LittleCMS plugin linkage, the Media Foundation H.264 encoder and existing application-required inputs/outputs. A new binary must receive new pins and its own source/notice review; the current package builder intentionally refuses unknown runtime hashes.

## Repeating the private build

Use a new disposable directory, Python 3.11+, Docker with Linux containers, and the three retained input archives listed in `run-isolated-build.ps1`. No installer is invoked. No application, settings, task, audio-device or TV path is mounted in the container.

1. Run `python recover-build-image.py NEW_IMAGE_DIRECTORY`. The adjacent OCI manifest and config are pinned to the original November 7 image. Its registry manifest endpoint returned 404, but the original config and all 17 compressed layers survived. The recovered manifest exactly matches `6fd1c328904af919ead9feedc3c5183eddb0986fd8e478ee9b11087fccdabc4c`. Every compressed and uncompressed layer is checked. The script never substitutes a moving image tag.
2. Start Docker separately if needed, checking for unrelated containers that may automatically restart. Load the generated archive with `docker load --input NEW_IMAGE_DIRECTORY/original-build-image.docker.tar`.
3. Run `run-isolated-build.ps1 -InputDirectory RETAINED_INPUT_DIRECTORY -NewBuildDirectory NEW_BUILD_DIRECTORY`. The script verifies the loaded image filesystem/environment and input hashes, mounts copied inputs read-only, and uses no network, two CPU cores, 6 GiB RAM, no added capabilities and no host service ports. It removes its own container after completion or failure and preserves output evidence.
4. Run `python audit-build.py NEW_BUILD_DIRECTORY/output`. This checks the exact dependency delta, enabled app capabilities, exclusions in both executable link maps, executable hashes and external DLL names.
5. On Windows, run `node test-isolated.cjs PATH_TO_NEW_FFMPEG PATH_TO_NEW_FFPROBE NEW_TEST_DIRECTORY`. Only synthetic video and PCM are supplied to encoder/scaler/AAC/HLS arguments taken from the actual app. It tests both encoders, both quality modes, with/without audio, media sequence restart and controlled encoder exit/restart. Each child uses `windowsHide` and is tracked until exit. This is a runtime test in a disposable directory, **not a separate Windows user/VM or physical TV test**.

The build keeps source pins, compiler versions, the complete log, before/after dependency hashes, configure results, PE imports and both linker maps. A fixed source date and version label are used. These are replayable build instructions; byte-for-byte reproducibility of the complete new executables requires an independent second build and is not presumed.

The original vendor build scripts' MIT notice is retained in `BtbN-Build-Scripts-LICENSE.txt` and the complete pinned builder archive. The reviewed corresponding-source and notice bundles remain necessary alongside this build appendix for any future authorised distribution.

Physical picture/audio, app Stop/audio restoration and no-console acceptance cannot be inherited from the old runtime. The installed app and package builder's accepted runtime pin remain unchanged. No deployment, public distribution or owner acceptance is authorised by these scripts.
