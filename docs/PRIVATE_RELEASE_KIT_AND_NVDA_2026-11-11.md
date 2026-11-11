# Private release kit and NVDA check: Recovery 2.4.4

The unchanged, owner-tested installer now has a local delivery kit containing its exact app source, both retained FFmpeg source ZIPs, the required rebuild appendix and checksums. A real NVDA run in the Windows 11 VM verified keyboard access and spoken control/dialog text, and exposed a specific gap: discovery completion was not automatically announced. This is evidence-only work; no application, runtime or installer was rebuilt.

## Pinned delivery materials

Local kit: `D:\ImAccessibility-Release-Kit-20261111`. Its `README.md` explains the archive layout, historical versus rebuilt FFmpeg records, licence notices and the remaining delivery steps. `assemble-kit.py` reads pinned inputs and a fixed Git commit; it does not execute an installer or publish anything.

| Asset | SHA-256 |
| --- | --- |
| Recovery 2.4.4 installer | `30fba87af2100fe7c42ea7a9a7774b3cf7a7c1c539514883a6d0e65ebd107859` |
| Exact app source, commit `939cae5855a1319161348cb9fa6b7e322c29a9ca` | `a885be000c828b6132b735a1f32b9dbbca690b903f93e961223fb0a28dd2e27e` |
| FFmpeg sources part 1 | `215a284f1fafaec6f42a91bef946cc914b6e45ae6a0f35aaec3b9e9c4ca80dc4` |
| FFmpeg sources part 2 | `caf73f180a7f19a3648fe5e4e1bdbb508605d9e0a9d183aae3cb4525878eb705` |
| Required FFmpeg rebuild appendix | `530763d054f8ba75aaf0c78fd9c7ea76486ee675f45e561f4387853bb3a167e6` |

All copied asset hashes matched. The two source ZIPs contain 746 members; all were read, and all **736 source-inventory files** matched their pinned sizes and hashes. The appendix's **129 files** matched its manifest. The exact app-source archive contains **228 files** and passed CRC/path checks. Every asset is below GitHub's 2 GiB per-asset limit. The [kit manifest](../packaging/windows-oneclick/release-kit-244-20261111.json) records sizes and individual pins.

This closes local assembly and verification, **not recipient delivery**. No release assets were uploaded. Future authorised binary delivery must include conspicuous, working links to both FFmpeg source parts and the appendix on the same download service. GitHub's automatically generated repository-source ZIP does not include those third-party source archives. The reconstruction still reuses unchanged original dependency binaries; a fresh rebuild of every dependency and a second byte-identical complete build are not claimed. See the [runtime reconstruction report](FFMPEG_PRIVATE_REBUILD_2026-11-10.md). Guidance checked: [FFmpeg](https://ffmpeg.org/legal.html), [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).

## Actual NVDA / Windows VM check

The existing isolated Windows 11 VM booted under its real, non-elevated `qaowner` account. NVDA **2026.3.1.58288** was created as a portable copy in a new guest QA folder. Its installer matched [NV Access's published SHA-256](https://www.nvaccess.org/post/nvda-2026-3-1/), `6f80a5b0ca720a7d0d314b5be212f37388bbe81a1107ac3298c1821a1cd3f052`, and its Authenticode signature validated as **NV Access Limited**. NVDA was not installed on the host or configured for startup. The VM's virtual speaker output was disabled throughout, so no speech or test tone disturbed the owner. This checks NVDA's actual speech-event text, not a human listening/usability assessment.

NVDA's input/output log confirmed these results at 100% scale / 1280×720:

- **Ten app controls read correctly when focused:** network, Find TVs, discovered-TV list, read-only TV address, ownership confirmation, TV-sound checkbox, Start, Refresh, Uninstall and activity log. Names, roles, descriptions and relevant checkbox/read-only states were spoken.
- **Discovery and selection worked by keyboard:** three receivers were found; the two unsupported entries were spoken as viewing not yet supported. The LG entry stated that its model is checked on connection. No selection was saved and no TV was started.
- **Start confirmation read completely:** selected-TV action, audio-disabled setting and mouse-control condition were spoken. Alt+N cancelled it; no stream or task started. Its existing default is Yes, unlike the uninstall dialog's No; this was observed, not changed.
- **Uninstall confirmation read completely:** stop/audio restoration and retained-settings wording were spoken, followed by the default No button. Enter cancelled safely.
- **Existing-installation UI read correctly:** Open installed app, Close and the focusable progress text were available. The progress text explained that no files would be overwritten. The button's description still says “install the app” although its name correctly says to open the existing app; that description should be aligned in a future UI correction.
- **Normal close and preservation passed:** the packaged controller returned `not-started`, with zero app processes, streaming listeners, app tasks or audio journal. Saved LG settings remained byte-identical.

**Failed acceptance item: automatic discovery-completion announcement.** Pressing Find TVs disabled the button and moved focus to the read-only TV address, which NVDA read as “Searching...”. When discovery finished, the screen showed three results and a completion message, but no completion announcement appeared in NVDA's speech log before the next keyboard action. Shift+Tab reached the result list and allowed selection. The visual message and history log exist; the asynchronous notification is missing. Screen-reader first-run acceptance remains open until this is corrected and retested. A targeted notification/focus fix is the next source change; this report does not claim it has already been implemented.

Save and Stop were disabled in the observed states and were not activated. Their prior packaged accessibility metadata check is not a live NVDA pass. No physical TV reconnect, TV playback, audio restoration listening test, high-contrast test or 200% scaling test occurred in this run. Six NVDA COM/watchdog delays recovered after approximately 0.52–0.92 seconds; no persistent NVDA failure was observed. Human assistive-technology testing remains necessary. NVDA's supported [portable and logging options](https://api.nvaccess.org/documentation/userGuide.html) were used; no add-on was supplied.

The Windows capture helper twice returned `window capture timed out: timed out waiting on channel`. The VM's own screenshot and keyboard interfaces were used after those failures. No security-policy setting was changed.

## Signing, preservation and remaining release decision

The exact installer remains **NotSigned**. The current-user and local-machine personal certificate stores each contained zero code-signing certificates. No certificate, identity submission, purchase or signing account was created. Microsoft lists Artifact Signing as an option for UK organisations, with a Basic plan advertised at US$9.99/month, subject to the account's actual pricing and identity validation; this is a possible route requiring the owner's decision, not a purchased service or an eligibility determination. [Microsoft signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [plan details](https://azure.microsoft.com/en-us/products/artifact-signing). A signature alone does not prove the eventual downloaded file's SmartScreen experience. The real Internet-download test remains outstanding.

At 00:17 UTC, **129/129 host working-app files**, saved settings, three reference shortcuts and all three host TV/audio task definitions and last-run times matched the preservation baseline. Tasks stayed Ready with zero triggers. The guest shut down normally; virtual audio output was restored and microphone input stayed off. NVDA and its helper exited through normal quit, and all five recorded VM processes exited. No host or guest process was forcibly terminated. User-opened applications remain open.

The repository remains private. Nothing was merged or released. The original source result remains **277 passed, 2 expected skips, 0 failed**, plus **23 guarded installer checks passed**; evidence-only changes do not warrant repeating those suites. No new hosted CI pass is claimed. The same installer retains the earlier owner-confirmed LG picture and TV-speaker sound result and the [ordinary install/uninstall/reboot checks](WINDOWS_VM_UNATTENDED_2_4_4_2026-11-10.md).

Remaining work is specific: correct and retest the discovery announcement and existing-install description; human assistive-technology review; physical reconnect and audible post-Stop confirmation; publisher signing and real download acceptance; then owner-authorised hosting with verified recipient access to the matching source materials. Local raw evidence is retained at `D:\ImAccessibility-VM-QA-20261110\Screenreader-244-20261111`; credentials, saved settings and unredacted speech logs are excluded from the repository. The [screen-reader receipt](../packaging/windows-oneclick/nvda-244-acceptance-20261111.json) records passes, the failed notification item and evidence hashes.
