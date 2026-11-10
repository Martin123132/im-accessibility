"""Check the private rebuild evidence, without running either executable."""
import hashlib
import json
from pathlib import Path
import re
import sys


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def sums(path):
    return {line.split('  ', 1)[1]: line.split('  ', 1)[0]
            for line in path.read_text().splitlines()}


def main():
    if len(sys.argv) != 2:
        raise ValueError('Provide the completed isolated build output directory')
    root = Path(sys.argv[1]).resolve()
    if (root / 'BUILD_COMPLETE').read_text().strip() != 'BUILD_COMPLETE':
        raise ValueError('Build has no completion record')
    before, after = sums(root / 'dependencies-before.sha256'), sums(root / 'dependencies-after.sha256')
    removed = sorted(before.keys() - after.keys())
    added = sorted(after.keys() - before.keys())
    changed = sorted(k for k in before.keys() & after.keys() if before[k] != after[k])
    expected_removed = sorted('/opt/ffbuild/' + name for name in [
        'include/lcms2_fast_float.h', 'include/lcms2_threaded.h', 'include/libzvbi.h',
        'lib/liblcms2_fast_float.a', 'lib/liblcms2_threaded.a', 'lib/libzvbi.a',
        'lib/pkgconfig/zvbi-0.2.pc',
    ])
    if removed != expected_removed or added or changed != ['/opt/ffbuild/lib/pkgconfig/lcms2.pc']:
        raise ValueError('Dependency changes exceed the reviewed patch')
    defines = (root / 'config.h').read_text() + (root / 'config_components.h').read_text()
    for name in ['GPL', 'NONFREE', 'LIBZVBI', 'LIBX264', 'LIBX265']:
        if re.search(r'^#define CONFIG_' + name + r' 1$', defines, re.M):
            raise ValueError('Excluded component enabled: ' + name)
    for name in ['H264_MF_ENCODER', 'LIBOPENH264_ENCODER', 'AAC_ENCODER', 'HLS_MUXER', 'GDIGRAB_INDEV']:
        if not re.search(r'^#define CONFIG_' + name + r' 1$', defines, re.M):
            raise ValueError('Application capability missing: ' + name)
    binaries = []
    for name in ['ffmpeg', 'ffprobe']:
        link_map = root / (name + '-link.map')
        text = link_map.read_text(errors='strict')
        if re.search(r'libzvbi|lcms2_fast_float|lcms2_threaded', text, re.I):
            raise ValueError('Excluded archive appears in ' + name + ' link map')
        if not re.search(r'liblcms2\.a', text):
            raise ValueError('Expected LittleCMS core absent from link map')
        dlls = sorted(set(re.findall(r'DLL Name:\s*(\S+)', (root / (name + '-pe.txt')).read_text())))
        if any(re.search(r'^(libgcc|libstdc|libwinpthread|avcodec|avformat|avutil|swscale|swresample)', dll, re.I) for dll in dlls):
            raise ValueError('Unexpected external runtime DLL: ' + name)
        binary = root / 'bin' / (name + '.exe')
        binaries.append({'file': name + '.exe', 'bytes': binary.stat().st_size,
                         'sha256': sha(binary), 'linkMapSha256': sha(link_map), 'importedDlls': dlls})
    evidence = {'schemaVersion': 1, 'privateCandidateOnly': True,
                'originalImageManifestSha256': '6fd1c328904af919ead9feedc3c5183eddb0986fd8e478ee9b11087fccdabc4c',
                'ffmpegCommit': 'd4070a14cecc7e29eb278f9b6036c2284255f70d',
                'builderCommit': 'c63bb308a1de656b425c132a8102f8fd5389afc5',
                'removedDependencyFiles': removed, 'changedDependencyFiles': changed,
                'unchangedDependencyFiles': sum(before[k] == after[k] for k in before.keys() & after.keys()),
                'excludedLibrariesAbsentFromLinkMaps': True, 'binaries': binaries,
                'physicalTvAcceptance': 'not performed for this runtime',
                'publicDistributionApproval': False}
    (root / 'build-audit.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(evidence, indent=2))


if __name__ == '__main__':
    main()
