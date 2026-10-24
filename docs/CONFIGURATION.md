# Portable Windows configuration — I’m-accessibility v1

**Current status:** opt-in, test-verified release configuration. This is not yet a guided installer or a complete second-machine acceptance test.

## Safety boundary

The release source has two different modes:

- **Original historical source:** frozen in the `v0.1.0-private-preview` tag and the original laptop installation, unchanged.
- **New release candidate:** the TV launcher/host services in this development branch require `IM_ACCESSIBILITY_CONFIG_PATH` before executing as direct programs. The configuration is validated before starting a network listener, pairing with an LG television or accepting mouse input.

The per-user settings are stored **outside the Git checkout**, under your Windows profile. The validator does not write settings, pair a device, discover the network, launch the stream, touch the registry, edit Windows tasks or store bearer credentials.

## Intended location

`%LOCALAPPDATA%\ImAccessibility\settings.json`

**The portable preview now includes guided first-run setup.** Once the bundle has been installed, double-click **Setup.cmd** in `%LOCALAPPDATA%\Programs\ImAccessibility` (or run `node first-run.cjs --wizard` from that folder). It lists eligible PC network adapters, asks you to choose one, accepts the LG TV IP or lets you defer selection, and asks for the local Node.js/FFmpeg paths. It shows a summary and saves the settings only after you type **YES**. Nothing connects to the TV during setup.

**Setup refuses to overwrite existing settings**. To inspect the machine without changing anything, run `node first-run.cjs --doctor`. Run `node first-run.cjs --validate` to check an existing configuration. **Start.cmd** requires an actual owner-selected LG IP; if you defer TV selection, the app cannot start a session until settings are deliberately configured.

An explicit path is supported through the session environment:

```powershell
$env:IM_ACCESSIBILITY_CONFIG_PATH = Join-Path $env:LOCALAPPDATA 'ImAccessibility\settings.json'
node .\tv-reliability-v0.5\release-config.cjs
```

If the settings are missing or invalid, the check exits with a non-zero code. The validation summary intentionally omits executable paths, private pairing keys, tokens and URLs.

## Settings schema 1

This example uses *illustrative* addresses and placeholder adapter/executable paths. **Do not copy as a working configuration without changing them to the actual devices you own.**

```json
{
  "schema": 1,
  "network": {
    "adapterName": "YOUR_WINDOWS_ADAPTER_NAME",
    "localIp": "192.168.1.10"
  },
  "television": {
    "model": "OLED55CX6LA",
    "ip": null
  },
  "executables": {
    "nodeExe": "C:\\Program Files\\nodejs\\node.exe",
    "ffmpegExe": "C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe"
  }
}
```

- **network.adapterName** must exactly match a physical Windows IPv4 interface. **network.localIp** must be a valid private IPv4 address on that interface. If multiple adapter/address combinations match, configuration fails rather than choosing arbitrarily. The accepted mask range is /16 through /30 with a contiguous netmask.
- **television.model** is limited to the owner's initially tested LG OLED55CX6LA. **television.ip** must be explicitly selected, different from the PC and within the same private subnet. A `null` value means **no LG is selected, so automatic LG launch is not authorised**.
- **executables.nodeExe** and **executables.ffmpegExe** must be full local Windows paths to existing files with the expected binary names. The validator checks path syntax and file existence; it does **not** establish binary provenance or authenticity. That remains a separate installer/release review.
- Unknown properties, arbitrary credential fields, relative or UNC executable paths, IPs outside the selected subnet and invalid/expired settings are rejected. The 8 KiB settings limit prevents oversized input.

## Behaviour in the release build

- The cast server, viewer, supervisor and native pointer guard share the configured local adapter IP.
- The LG connection path only attempts the owner-selected address and verifies the model before opening the TV browser; discovery does not automatically choose a different device.
- The release supervisor reads the configured Node executable, FFmpeg binary, and fixed new task identity `ImAccessibility-TV-v1`. It must not reuse the original task `PCBridge TV Resume 0.5`.
- Configured mouse controls accept the actual bounded primary display dimensions, rechecking the native helper's reported dimensions on subsequent input. Mouse control still starts OFF and is permission limited.
- The release's Resume/Stop/Status `.cmd` wrappers use `%~dp0` rather than the original laptop's absolute project directory and refuse to run without an explicit environment configuration.

**Installation preview:** the portable bundle installs per-user Start, Stop, Status, Setup and Uninstall commands but does **not** register an automatic Windows task, create a service, alter firewall rules or perform pairing. Start runs the supervisor only on explicit owner action, after revalidating the exact config and checking for an existing/uncertain session. The Start Menu experience and second-machine acceptance remain separate release gates.

## Test coverage and future steps

Synthetic, side-effect-free tests exercise zero/multiple/virtual adapters, wrong subnets, unsupported TV model, missing executables, unsafe paths, malformed/oversized files, credential fields and missing selections. A separate integration fixture imports all TV modules with synthetic settings and confirms there is **no TV connection, screen capture or mouse click** during module loading.

On the Windows development laptop, the release branch ran **64 tests: 62 passed, zero failed, two skipped** (live HLS video only). Hosted CI must pass before merging.

**Next:** guided owner selection, installer-owned per-user settings, task identity verification and a physical LG acceptance run. The television does not need to be switched on for current source tests.
