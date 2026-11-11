"""Recover the exact original dependency image; never starts Docker or installs it.

Python 3.11+. Usage: python recover-build-image.py NEW_OUTPUT_DIRECTORY
The two adjacent upstream JSON files are byte-pinned original OCI metadata.
Downloads are public, anonymous and digest-checked. No moving tags are used.
"""
import concurrent.futures
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import urllib.request

MANIFEST_SHA = '6fd1c328904af919ead9feedc3c5183eddb0986fd8e478ee9b11087fccdabc4c'
CONFIG_SHA = 'a0e9a345fc979644741b79f7cff4cb806302bb4c4fe906038a451a2258d58497'
REGISTRY_REPO = 'btbn/ffmpeg-builds/win64-lgpl-9.0'


def file_hash(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    if len(sys.argv) != 2:
        raise ValueError('Provide a new output directory')
    output = Path(sys.argv[1]).resolve()
    output.mkdir(parents=True, exist_ok=False)
    here = Path(__file__).resolve().parent
    manifest_bytes = (here / 'upstream-image-manifest.json').read_bytes()
    config_bytes = (here / 'upstream-image-config.json').read_bytes()
    if hashlib.sha256(manifest_bytes).hexdigest() != MANIFEST_SHA or hashlib.sha256(config_bytes).hexdigest() != CONFIG_SHA:
        raise ValueError('Pinned image metadata differs')
    manifest, config = json.loads(manifest_bytes), json.loads(config_bytes)
    if len(manifest['layers']) != len(config['rootfs']['diff_ids']):
        raise ValueError('Layer count differs')
    token_url = 'https://ghcr.io/token?scope=repository:' + REGISTRY_REPO + ':pull'
    token = json.load(urllib.request.urlopen(token_url, timeout=30))['token']

    def fetch(layer_and_diff):
        layer, diff_id = layer_and_diff
        digest = layer['digest'].removeprefix('sha256:')
        target = output / (digest + '.tar.gz')
        url = 'https://ghcr.io/v2/' + REGISTRY_REPO + '/blobs/sha256:' + digest
        request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(request, timeout=60) as response, target.open('xb') as stream:
            while chunk := response.read(1024 * 1024):
                stream.write(chunk)
        if target.stat().st_size != layer['size'] or file_hash(target) != digest:
            raise ValueError('Downloaded layer differs: ' + digest)
        with gzip.open(target, 'rb') as stream:
            actual = 'sha256:' + hashlib.file_digest(stream, 'sha256').hexdigest()
        if actual != diff_id:
            raise ValueError('Filesystem layer differs: ' + digest)
        print('Verified', digest, flush=True)
        return target

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        layers = list(pool.map(fetch, zip(manifest['layers'], config['rootfs']['diff_ids'])))
    archive = output / 'original-build-image.docker.tar'
    with tarfile.open(archive, 'w') as tar:
        def add_bytes(name, data):
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
        add_bytes(CONFIG_SHA + '.json', config_bytes)
        add_bytes('manifest.json', json.dumps([{
            'Config': CONFIG_SHA + '.json',
            'RepoTags': ['imaccessibility-ffmpeg-original:20261107'],
            'Layers': [layer.name for layer in layers],
        }]).encode())
        for layer in layers:
            # Fixed metadata makes this wrapper independent of download time.
            info = tarfile.TarInfo(layer.name)
            info.size = layer.stat().st_size
            with layer.open('rb') as stream:
                tar.addfile(info, stream)
    receipt = {'manifestSha256': MANIFEST_SHA, 'configSha256': CONFIG_SHA,
               'verifiedLayers': len(layers), 'archiveSha256': file_hash(archive)}
    (output / 'recovery.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(archive)


if __name__ == '__main__':
    main()
