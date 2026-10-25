# I’m-accessibility — verified click-pad recovery package (23 October 2026)

The first installation candidate that preserves the **physically verified LG Magic Remote workflow** is `v0.3.2-verified-clickpad-preview`. It is created from the existing v0.5 TV-control application and includes only the small verified click-pad visibility repair, guided setup and reversible packaging work from the reviewed sprint branches. The original installed beta remains intact.

## The input path that actually worked

On 11 October the owner observed the **separate HTML remote click pad** successfully switch a Windows conversation on the LG television. The preserved record is `D:\PC-Bridge-Public-Demo\tv-pointer-pilot-20261011\PHYSICAL_TV_NAV_ACCEPTANCE_20261011.md`. Clicks directly into the HLS video were not physically proven. The v0.5 viewer retained the working pad but hid it behind “Arrow fallback.”

Recovery commit `11c609874a071f1c6f8d52e76e87ccccfc59f389` changed only the viewer HTML, JS and one webOS regression test so the **click pad is visible immediately**. Input remains OFF until the owner selects **Enable PC controls**. The orange **CLICK WINDOWS** control uses the original bounded Windows pointer broker; **Pause PC controls** disarms input.

The existing running v0.5 receiver logged one native click during the 23 October owner attempt, but a successful mouse-input receipt **did not establish an observable Windows response**. No claim that the direct video click worked is made.

## Recovered version and reproducible test evidence

| Item | Verified result |
| --- | --- |
| Isolated source | `D:\ImAccessibility-Release-Recovery-20261023`, branch `recovery/portable-clickpad-20261023` |
| Original freeze | GitHub tag `v0.1.0-private-preview`, source commit `17c49b2`; preserved |
| Windows source check | Passed |
| Automated Windows tests | **78 total, 76 passed, 0 failed, 2 live-HLS skips** |
| Full ZIP extraction | Extracted and verified every source file against its manifest SHA-256 |
| Installed preview | 62 payload files, installed from extracted ZIP into a disposable Windows user profile |
| Click-pad packaging | Installed HTML has visible remote pad and orange CLICK WINDOWS button, disabled until arming |
| Launch gate | Without valid settings, Start preflight refused the session |
| Reversible uninstall | Removed only installed program files; private settings and unrelated user data unchanged |
| Zip artifact | `D:\ImAccessibility-Release-Recovery-20261023\_recovery_tests\ImAccessibility-v0.3.2-verified-clickpad-preview.zip` |
| ZIP SHA-256 | `a540b09e3c0582c3f77fb5884de4a9ee78a368665ddc4c58786891e3322056c9` |
| Payload manifest SHA-256 | `b4f45c294dfe88fc8486eb81f95df74fd2ba5335236ea368ee6951e43fbba737` |

Local logs: `_recovery_tests/packaged-clickpad-full-windows-suite.txt` and `_recovery_tests/V032_ZIP_EXTRACT_INSTALL_UNINSTALL_VERIFICATION.json`.

## Native pointer helper rebuilding (read-only)

The Windows .NET Framework 4 C# compiler successfully rebuilt the existing `TvPointer.cs` to a **separate** recovery-folder executable. Both the existing original binary and new binary returned matching 1920×1080 primary-display status with **zero generated mouse events**. Compiler SHA-256: `aae1db57f898ca8bda18590c56f86ced6d0ead80c22033b76fdfe9119706f116`. Original binary SHA-256: `c9d058fd4b98683466245a836dd040afda9df254c6f703be4632f94c6181c064`; recovered rebuild SHA-256: `6886b7405f0186ef75fb76ca37aed8c67fe96dbb7449a13d5aca0595b70d7199`. The hashes differ; recompilation does **not** establish byte-identical build provenance or code-signing status. The packaged binary was **not replaced**. Full read-only comparison is in the local `_recovery_tests/NATIVE_HELPER_RECOMPILE_COMPARISON.json`.

## Physical test pending — no false certification

The office LG television is **not receiving mains power at its socket**; the physical device's previously recorded webOS control addresses did not answer on ports 3000/3001 and discovery found no device. Software cannot energise a physical wall socket that is switched off. The actual LG Magic Remote button pathway and current preview package still require physical testing once mains power is restored.

When hardware is powered, verify the **actual installed preview**, not an HTML mock:

1. Confirm it automatically opens the LG browser to the temporary receiver and displays the Windows desktop.
2. Confirm the **verified remote click pad** is visible below the picture without opening “Arrow fallback.”
3. Confirm the orange **CLICK WINDOWS** starts disabled, then enables only after an explicit ten-minute owner permission.
4. Using a harmless, recognisable Windows test target and ordinary LG remote navigation, send a single click and confirm that the **Windows application visibly reacts**, not merely that the pointer helper reports a successful click.
5. Select **Pause PC controls**, confirm further mouse requests are rejected, then Stop and re-run through the same expected four-hour bounds.
6. Save local logs without tokens or screenshots of unrelated personal/research files.

Approval remains blocked on that physical test, a supported Windows 11 clean-machine test and native-helper provenance. Keep the new release branch and original installation separate; do not force-merge a preview or silently replace a working beta.
