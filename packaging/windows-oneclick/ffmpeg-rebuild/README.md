# Narrow runtime reconstruction patch

This patch applies to vendor builder `c63bb308a1de656b425c132a8102f8fd5389afc5`, for the private `win64 lgpl 9.0` reconstruction only. It disables libzvbi and the unused LittleCMS GPL plugins. It does not modify the installed app, its runtimes, or its scheduled tasks.

The pinned libzvbi source includes GPL-2.0-only packet/PDC implementation on the enabled decoder source path. This is a concrete reason the current vendor-labelled LGPL executable cannot receive redistribution clearance. The LittleCMS plugins are also GPL-licensed; they are built and listed as static libraries but no plugin entry-point references were found outside their own source/test trees or in FFmpeg. Disabling those unused plugins removes the ambiguity for a future build.

Apply the patch in a **separate copy** of the pinned vendor builder. Restore its retained source cache. For rav1e, use `rav1e-post-update-reconstructed.Cargo.lock` from the private source bundle and replace the moving `cargo update cc` step with that recorded resolution. It selects `cc 1.10.0`, `find-msvc-tools 0.1.15`, `shlex 2.0.1`; the recovered original build log records precisely these three changes. The reconstruction is not claimed to be the original generated lockfile's exact bytes.

Build the same FFmpeg core `d4070a14cecc7e29eb278f9b6036c2284255f70d` in a disposable Linux/Docker environment. Retain the new build log, resolved locks, source modifications, toolchain identity and corresponding source. Do not use current moving branch tips. Confirm `--disable-libzvbi`, no GPL/nonfree flags, no LittleCMS plugin linkage, the Media Foundation H.264 encoder and existing application-required inputs/outputs. A new binary must receive new pins and its own source/notice review; the current package builder intentionally refuses unknown runtime hashes.

Only patch applicability has been checked. **No replacement runtime was built or installed.** Docker's Linux engine was not running during this review; it was not started. Physical picture/audio, Stop and no-console acceptance cannot be inherited from the old runtime. No deployment or owner acceptance is authorised by this patch.
