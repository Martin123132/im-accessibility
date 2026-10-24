# I'm-accessibility — TV/laptop sound routing (23 October 2026)

**Status:** implemented in an isolated v0.3.6 draft source and tested on the owner's actual Windows laptop. Still awaiting a full physical LG browser acceptance of the **new two-control UI**, sustained audible output and Windows 11 clean-install tests. Existing installed beta is unchanged.

## Expected behaviour

| TV sound button | Laptop sound button | Result |
| --- | --- | --- |
| OFF | Laptop listening | The TV picture continues, laptop speakers remain available |
| ON | OFF | **TV only:** the laptop playback endpoint is muted, while the TV continues receiving HLS audio |
| ON | ON | **Both:** Windows laptop speakers are unmuted while the TV retains its own audio |
| OFF again | Laptop listening | TV video audio is muted locally in webOS and Windows speaker output is restored |

**TV only is the default when the user first enables TV sound.** The *Both* option is intentional for different rooms; both outputs may not sound synchronised when audible in the same room.

The app changes only the **same default Windows playback endpoint** that the HLS speaker-loopback service captured. It does not access microphones, control TV volume, change Windows output devices, or change the laptop's volume level. TV streaming starts muted until the LG viewer's explicit TV sound click. The original laptop mute setting is preserved.

## Real hardware checks

On the actual Windows Realtek speaker endpoint, a reversible low-volume test recorded loopback RMS 0.4192063 before muting, 0.4258214 while the speaker endpoint was muted, and 0.4435997 after restoration. The test restored the previous Windows mute state.

The project-owned native `SpeakerEndpoint.exe` accurately executed these physical Windows routes, then restored the original state:

- `tv-only` → muted
- `both` → unmuted
- `tv-only` → muted
- `laptop-only` → unmuted
- session end → original mute restored

The C# playback helper uses Core Audio's default eRender multimedia endpoint. It reports a SHA-256 identity of the selected endpoint and changes mute using compare-and-set, refusing to overwrite an unexpected user change or a different playback device. The WASAPI capture helper now includes that same device hash in its probe and refuses to start capture if its endpoint changes before startup.

**Independent crash recovery was physically tested:** a process enabled TV-only mute and exited, leaving an independent, bounded recovery watcher. Without a TV heartbeat, the watcher restored the laptop's original unmuted state and cleared its session recovery journal automatically.

## Application integration

- Full-screen browser has separate **TV sound** and **Laptop sound** controls.
- The authenticated viewer service exposes only `/api/audio-route` (three known routing choices) and `/api/audio-heartbeat` (no arbitrary Windows command API).
- The TV audio source must be live and its device identity must match the Windows playback endpoint before the app is allowed to mute the laptop.
- A private recovery journal preserves original mute state; regular active-browser heartbeats keep it valid. If the TV viewer disappears, the session ends, a new device appears, or the audio source fails, the routing controller restores the previous state when it safely can.
- The original video-only `Start.cmd` stays available. `StartSound.cmd` explicitly enables speaker-output capture.
- A user-initiated Windows sound/mute change is preserved rather than silently overwritten by the application.

## Remaining release acceptance

The separate video and native-audio HLS pathways have already passed short physical LG browser tests, and full-screen Windows clicking plus Pause rejection passed using the LG's paired network remote interface. However, the **new combined routing UI** must still be physically tested using the actual handheld Magic Remote. It must also be checked for sustained audible TV-speaker output, A/V synchronisation, startup/stop/restart, laptop audio restoration after a failed TV session, and independent Windows 11 clean-install behaviour.

Do not promote this draft as a fully accepted application until those checks pass.