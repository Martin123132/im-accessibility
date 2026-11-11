#!/bin/bash
# Run only in the disposable, pinned original vendor image. /inputs is read-only;
# /output is an empty build evidence directory. No host app paths are mounted.
set -euo pipefail
test "$TARGET" = win64
test "$VARIANT" = lgpl
test "$FFVER" = 900
test -z "$(ls -A /output)"
mkdir -p /work /output/bin
exec > >(tee /output/build.log) 2>&1
set -x
export SOURCE_DATE_EPOCH=1794009600 TZ=UTC LC_ALL=C.UTF-8
# Source-archive owners are upstream CI user IDs, irrelevant to compilation.
# Avoid requiring CHOWN capability merely to extract those archives.
export TAR_OPTIONS=--no-same-owner
nproc() { echo 2; }
export -f nproc
cd /work
(cd /inputs && sha256sum --check <<'HASHES'
1c472b0d819c2c5a94948bd4fabda6d126b1f2126122667e35030d2914a4c7c1  FFmpeg-d4070a14ce.zip
44fe4f6ff1de441e002e68442fd1d4187a3de66d280b523eb720733ec48e4789  FFmpeg-Builds-c63bb308.zip
49708e34c6c02651042f552e17a41a8005c3d1d99c86cf90e50a5be79d9f31c4  45-lcms2_27eacdf84d36c11c81718d5dd6d380178c11eaff50511b1b8526eb3aa4924635.tar.xz
4a468788bb1afe1e590cee56c80f2f9830166f2633ef6c019332b9ceea957d71  exclude-unused-copyleft.patch
HASHES
)
unzip -q /inputs/FFmpeg-Builds-c63bb308.zip
builder=/work/FFmpeg-Builds-c63bb308a1de656b425c132a8102f8fd5389afc5
cd "$builder"
git -c core.autocrlf=false apply --check /inputs/exclude-unused-copyleft.patch
git -c core.autocrlf=false apply /inputs/exclude-unused-copyleft.patch
cp /inputs/exclude-unused-copyleft.patch /output/
cp scripts.d/45-lcms2.sh scripts.d/50-zvbi.sh /output/
sha256sum /inputs/* > /output/input-sha256.txt
env | sort > /output/build-environment.txt
"$CC" -v 2> /output/compiler.txt
"$LD" --version > /output/linker.txt
rustc --version --verbose > /output/rust.txt
find /opt/ffbuild -type f -print0 | sort -z | xargs -0 sha256sum > /output/dependencies-before.sha256

# Apply the disabled stage's effect to the reused original dependency prefix.
# Remove only its libraries, metadata and headers inside this container.
find /opt/ffbuild -type f \( -iname '*zvbi*' -o -iname '*lcms*' \) -print > /output/affected-files-before.txt
find /opt/ffbuild -type f \( -iname '*zvbi*' -o -iname '*lcms2_fast_float*' -o -iname '*lcms2_threaded*' \) -print -delete > /output/excluded-files.txt
source scripts.d/50-zvbi.sh
if ffbuild_enabled; then echo 'libzvbi was not disabled'; exit 1; fi
zvbi_flag="$(ffbuild_unconfigure)"
test "$zvbi_flag" = --disable-libzvbi
export FF_CONFIGURE="${FF_CONFIGURE/--enable-libzvbi/$zvbi_flag}"

# Rebuild LittleCMS from its retained exact source with both plugins disabled.
ln -s /inputs/45-lcms2_27eacdf84d36c11c81718d5dd6d380178c11eaff50511b1b8526eb3aa4924635.tar.xz /cache.tar.xz
SELF=scripts.d/45-lcms2.sh STAGENAME=45-lcms2 bash /usr/bin/run_stage "$builder/scripts.d/45-lcms2.sh"
cp -a /opt/ffdest/opt/ffbuild/. /opt/ffbuild/
pkg-config --static --libs lcms2 > /output/lcms2-link-flags.txt
if grep -E 'fast_float|threaded' /output/lcms2-link-flags.txt; then exit 1; fi
if find /opt/ffbuild -type f \( -iname '*zvbi*' -o -iname '*lcms2_fast_float*' -o -iname '*lcms2_threaded*' \) | grep .; then exit 1; fi
find /opt/ffbuild -type f -print0 | sort -z | xargs -0 sha256sum > /output/dependencies-after.sha256

cd /work
unzip -q /inputs/FFmpeg-d4070a14ce.zip
cd FFmpeg-d4070a14ce
# The commit is pinned by the verified source archive, not a moving Git branch.
printf '%s\n' 'n9.0.2-48-gd4070a14ce' > VERSION
./configure --prefix=/output/prefix --pkg-config-flags=--static $FFBUILD_TARGET_FLAGS $FF_CONFIGURE \
    --extra-cflags="$FF_CFLAGS" --extra-cxxflags="$FF_CXXFLAGS" --extra-libs="$FF_LIBS" \
    --extra-ldflags="$FF_LDFLAGS" --extra-ldexeflags="$FF_LDEXEFLAGS -Wl,-Map=/output/current-link.map" \
    --cc="$CC" --cxx="$CXX" --ar="$AR" --ranlib="$RANLIB" --nm="$NM" \
    --extra-version=imaccessibility-private-20261110
cp ffbuild/config.log ffbuild/config.mak config.h config_components.h /output/
if grep -E '^#define CONFIG_(GPL|NONFREE|LIBZVBI|LIBX264|LIBX265) 1$' config.h config_components.h; then exit 1; fi
grep -q '^#define CONFIG_H264_MF_ENCODER 1$' config_components.h
grep -q '^#define CONFIG_LIBOPENH264_ENCODER 1$' config_components.h
make -j2 V=1 ffmpeg.exe
cp /output/current-link.map /output/ffmpeg-link.map
make -j2 V=1 ffprobe.exe
cp /output/current-link.map /output/ffprobe-link.map
if grep -Ei 'libzvbi|lcms2_fast_float|lcms2_threaded' /output/ffmpeg-link.map /output/ffprobe-link.map; then exit 1; fi
cp ffmpeg.exe ffprobe.exe /output/bin/
"${FFBUILD_CROSS_PREFIX}objdump" -p ffmpeg.exe > /output/ffmpeg-pe.txt
"${FFBUILD_CROSS_PREFIX}objdump" -p ffprobe.exe > /output/ffprobe-pe.txt
sha256sum /output/bin/* > /output/binary-sha256.txt
printf '%s\n' BUILD_COMPLETE > /output/BUILD_COMPLETE
