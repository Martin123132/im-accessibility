FFmpeg source materials for the private Recovery 2.2 runtime
==========================================================

Runtime SHA-256:
71ac0a64a4e3e0caaf7a8c25c7e73d161ac1b269cca930d207e89e1b23959dfb

The original application's licence does not replace the licences of FFmpeg,
Node or other dependencies. The dependency sources and notices retain their
upstream terms. FFmpeg is supplied as a separate executable.

The source inventory records 85 source-cache archives from the actual
win64-lgpl-9.0 vendor build, plus the exact FFmpeg core, vendor recipes and
patches, Rust source, and a conservative superset of 601 Cargo archives.
Cargo archives are checked against their root Cargo.lock checksums. The
librsvg vendor tree additionally passed all 18,527 file checksum checks.
Optional, build, test and other-platform sources are included; these counts
are not a claim that all components are linked into the Windows executable.

FFmpeg-Dependency-Notices.zip contains unchanged upstream notice bytes and
an index mapping each text to its source component and path. The text file
is a readable rendering. Rust-COPYRIGHT-library.html is the official Rust
1.99.1 standard-library copyright document. GCC runtime exception notices,
MinGW notices, FreeType's FTL and NVIDIA header notices are included.

Source bundle verification
--------------------------
Extract both private source ZIP parts into the same empty directory.
Use Node 24 to run the repository's packaging/windows-oneclick/
verify-source-materials.cjs against that directory. It verifies each pinned
file's size and SHA-256 without executing downloaded code. This is developer
documentation, not an action required from someone installing the app.

Build context
-------------
The retained vendor builder revision is
c63bb308a1de656b425c132a8102f8fd5389afc5. Its README, Dockerfiles, target
configuration, patches and shell recipes are included in the builder ZIP.
Use a separate disposable Linux build environment with Bash and Docker.
Place the 85 retained vendor archives in the builder's .cache/downloads
directory under their existing filenames. The upstream image/build targets
are makeimage.sh win64 lgpl 9.0 and build.sh win64 lgpl 9.0.

The upstream build script follows release/9.0. A reconstruction must select
the archived FFmpeg core revision d4070a14cecc7e29eb278f9b6036c2284255f70d
before configuring, instead of following the current branch tip. Its exact
core source archive is supplied. Retain the vendor patches and build recipes,
including the AOM/aribb24 patches, librsvg edits and Rust-symbol deduplication.

The manifest records the original container image digests, Rust revision,
GCC version and MinGW runtime revision. A byte-identical FFmpeg rebuild has
not been run. In particular, the rav1e recipe updates the cc build tool and
the cached log does not retain the resulting Cargo.lock; its final build-tool
resolution is still unverified. The collected original lockfile is not
misrepresented as that missing post-update lockfile.

Publication status
------------------
These are private retained materials, not a public source download offer.
The collection does not certify complete legal compliance. Before any
authorised binary publication, close the recorded source/notice review and
provide required source/build materials to binary recipients. Signing and
physical Windows/accessibility acceptance are separate release questions.
Nothing in these materials authorises publishing the app or changing the
working installation.
