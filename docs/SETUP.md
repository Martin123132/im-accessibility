# Getting started with I’m-accessibility

**Current status:** a private Windows source preview, not a one-click installer. This guide lets you reproduce the safe tests before configuring any real input or video.

## Requirements

- Windows 10/11 with an interactive desktop session.
- Node.js 24 (tested on 24.15.0), Git and a terminal.
- For the TV module: FFmpeg, an owner-paired compatible LG webOS TV on the same trusted LAN, and the pinned npm package in the TV cast directory.
- For Codex: a local Codex CLI and browser.
- For ChatGPT-operated Windows actions: the **separately installed PC Bridge**, with access explicitly enabled by the owner.

Cloning this repository does **not** install or authorise the PC Bridge application.

## Get the source and dependencies

~~~powershell
git clone https://github.com/Martin123132/im-accessibility.git
cd im-accessibility
npm.cmd ci --prefix tv-reliability-v0.5/cast
~~~

Use npm.cmd on Windows if PowerShell blocks npm.ps1. There is no need to change the machine’s PowerShell execution policy globally.

## Run the safe checks

~~~powershell
node --test .\codex-chat-control-pilot-20261012\tests\pilot-safety.test.cjs .\codex-chat-control-pilot-20261012\tests\selection-safety.test.cjs
node --test .\tv-reliability-v0.5\tests\session-policy.test.cjs
~~~

The TV viewer has additional tests in **tv-reliability-v0.5/viewer/tests/**. Two snapshot tests require a running, fresh HLS desktop stream and are skipped in the release copy if no stream exists. No safe test invokes Codex turn/start or opens an actual research conversation.

## TV source

The TV module lives in **tv-reliability-v0.5/**. It was validated with a specific LG OLED55CX6LA and owner LAN configuration. Its historical Windows on-demand task, IP addresses, desktop shortcuts, LG pairing state and native helper belong to the owner’s installed PC setup and must not be blindly reused on another machine.

The important sources are **cast/server.cjs** (LAN H.264/HLS), **viewer/server.cjs** (separately authorised mouse controls), **resume-host.cjs** (bounded session) and **viewer/native/TvPointer.cs** (native pointer helper). FFmpeg is configurable with the **PC_BRIDGE_FFMPEG_EXE** environment variable, or available on PATH.

## Codex Desk

In **codex-chat-control-pilot-20261012/**, provide the installed Codex CLI path if needed and start the local Desk:

~~~powershell
$env:PC_BRIDGE_CODEX_EXE = "C:\path\to\codex.exe"
node desk.cjs
~~~

Open **http://127.0.0.1:43191** on the same PC. The Desk has no browser Send route. Selecting a conversation and staging a draft must not be mistaken for starting a Codex turn.

## Troubleshooting

| Problem | Check |
| --- | --- |
| PowerShell refuses npm | Use **npm.cmd** |
| lgtv2 cannot be found | Run the pinned npm ci in the cast folder |
| TV stream will not start | FFmpeg, LAN IP, trusted-device pairing and configured Windows task |
| Codex executable missing | Set **PC_BRIDGE_CODEX_EXE** or ensure codex is on PATH |
| Thread lookup times out | Retry read-only discovery; never pick a guessed research thread |
| Snapshot tests skipped | No fresh live HLS stream was available; this is expected in source-only CI |

Do not copy credentials, browser profiles or private research screenshots into Git to solve setup problems.
