FFmpeg for ImAccessibility Recovery 2.3 - PRIVATE PREVIEW
======================================================

This package contains the locally rebuilt Windows executable, not the original
vendor executable identified by the historical source records below.

FFmpeg.exe SHA-256:
b35f4924476dad990b0414e3031ab20d7e90604201b39621fd937b265062ea69
FFmpeg core: d4070a14cecc7e29eb278f9b6036c2284255f70d
Vendor build recipes: c63bb308a1de656b425c132a8102f8fd5389afc5
Build: n9.0.2-48-gd4070a14ce-imaccessibility-private-20261110
Licence: GNU Lesser General Public License version 3 or later, with the
separate applicable terms and notices of its included dependencies.

The private reconstruction disables libzvbi and the LittleCMS fast-float and
threaded plugins. Their libraries are absent from both executable link maps.
LittleCMS was rebuilt; its core library matches the original bytes. The other
2,749 unchanged dependency files come from the hash-verified original image.
This is not a claim that every unchanged dependency was rebuilt from source.

FFmpeg-Rebuild-Record.json identifies this executable and its build/test
evidence. FFmpeg-Rebuild-Patch.patch and FFmpeg-Rebuild-Instructions.md explain
the changes and build procedure. FFmpeg-Rebuild-Source-Appendix.json pins the
additional source/evidence archive. That appendix and both original source
ZIP parts are required together; their names and hashes are in the record.

FFmpeg-Source-Materials.json, FFmpeg-Build-Record.json, FFmpeg-Licence-Review.json
and FFmpeg-Source-README.txt retain the historical evidence for the original
71ac0a64... executable. Its libzvbi finding remains valid for that old hash;
it is resolved by exclusion for the new executable above. The notice archive
is a source superset: unused source components keep their original licences
and are not thereby claimed to be linked into this executable.

The original application's licence does not replace these third-party terms.
FFmpeg is a separate executable. LGPLv3, its incorporated GPLv3 text, upstream
dependency notices, OpenH264's BSD notice, FreeType acknowledgement and Rust
runtime attributions accompany this package.

The retained sources and scripts are for developers/reviewers. No terminal or
developer runtime is required to operate the installed Windows application.

The new runtime passed synthetic Windows tests. Physical LG acceptance and a
genuine separate Windows-user/VM installer test remain outstanding for this
candidate. The installer is unsigned and private. No public distribution or
replacement of the owner's working installation is authorised by this notice.
