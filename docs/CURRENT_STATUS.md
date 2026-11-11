# Current version and acceptance — 11 November 2026

The current source is **Recovery 2.4.5**, including the in-place updater. The owner reports the installed **2.4.4** app working. No GitHub source update replaces that installation automatically.

| Item | Latest evidence |
| --- | --- |
| Update without uninstalling | 2.4.4 to 2.4.5 passed through the normal Windows 11 VM installer UI; settings, pairing, shortcuts, uninstall registration and the idle audio task were preserved. |
| Source regression | 278 passed, 2 expected live-HLS skips, 0 failures. |
| Update guards | 18 checks, including active-session refusal, preserved settings, concurrent update refusal and rollback after both replacement stages. |
| Packaged install/uninstall | 23 guarded checks; separate real Windows 11 account also passed the ordinary update, reopen and uninstall paths. |
| LG picture and sound | Owner confirmed 2.4.4 Windows VM picture and LG-speaker sound, and subsequently reported the laptop installation working. 2.4.5 TV/audio/discovery code and runtime executables are unchanged. |
| FFmpeg provenance | The specific libzvbi/LittleCMS findings were addressed in the rebuilt runtime; pinned build evidence, notices, source archives and reconstruction instructions are retained. |
| Accessibility | Real NVDA focus/control/dialog checks were recorded. Discovery completion was not automatically announced; that acceptance item remains open. Human usability, high contrast and 200% scaling acceptance remain open. |
| Public installer | Not published. Existing GitHub package releases remain drafts. Source availability is not a claim that a general installer release has passed acceptance. |

## Using the current private installer

Existing private-preview testers open the newer installer and choose **Update I'm-accessibility**. If a TV stream is running, use **Stop TV stream** first and wait for laptop sound to return. The updater closes an idle app normally. There is no need to uninstall the previous version. Opening the same installer again offers **Open installed app**.

New users should not be directed through developer commands as an accessible product-installation flow. The source [setup guide](SETUP.md) is for developers until an accepted public installer is available.

## Remaining public-installer checks

1. Correct and retest the observed asynchronous discovery announcement; complete human assistive-technology and display-scaling review.
2. Establish publisher signing and verify the actual Internet-download/SmartScreen experience, without bypassing security prompts.
3. Host the exact matching FFmpeg source parts and rebuild appendix alongside any authorised binary; verify recipient downloads and checksums.
4. Record remaining physical acceptance, including post-Stop audible restoration for the rebuilt-runtime package, reconnect and DHCP-renewal behaviour. Automated tests and file hashes do not replace those observations.

The original project licence and third-party notices are unchanged. No new binary publication is authorised by restoring public source access.

## Evidence

- [2.4.5 update, package hashes and preservation](PRIVATE_UPDATE_2_4_5_2026-11-11.md)
- [2.4.4 Windows VM lifecycle checks](WINDOWS_VM_UNATTENDED_2_4_4_2026-11-10.md)
- [Source delivery materials and actual NVDA observations](PRIVATE_RELEASE_KIT_AND_NVDA_2026-11-11.md)
- [FFmpeg reconstruction and licence exclusions](FFMPEG_PRIVATE_REBUILD_2026-11-10.md)
- [Earlier 2.1/2.2 physical results](TV_SELECTION_RECOVERY_2026-11-09.md)

Dated reports preserve what was known at the time. This page supersedes their historical statements about which version is current or which checks had not yet run.
