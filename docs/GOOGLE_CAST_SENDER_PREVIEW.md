# Experimental Google Cast sender adapter — source-only (6 November 2026)

**Status: adapter contract and transport simulated; NOT a supported or published
connection method.** The current owner-tested LG webOS path, its viewer and
audio guard are unchanged.

## Scope

The source preview adds two separate modules:

- `tv-reliability-v0.5/adapters/google-cast.cjs`: validates a *fresh, explicitly
  approved, mDNS-discovered Google Cast receiver* on the owner's selected
  private LAN. Validates the current time-limited/private viewer session and
  live Cinema source, then reuses that session's HLS MPEG-TS playlist from
  `/media/<private-session-capability>/index.m3u8`. Only bounded relative
  `segmentNNNNNN.ts` playlist paths are accepted.
- `tv-reliability-v0.5/adapters/castv2-transport.cjs`: small opt-in
  Default Media Receiver CASTV2 sender implementation with bounded connect,
  load, error and owned-session stop. It accepts an explicitly supplied
  `castv2-client` interface. The third-party package is **not yet included
  in the customer installer**, and this transport is not called by the existing
  LG auto-start path.

There is **no extra desktop capture**, no PowerShell, no Windows mouse
permission, no application window manipulation, no FFmpeg change and no
automatic control of an unselected device.

A CastV2 `LOAD` acknowledgment is reported as `load-acknowledged` and
`playbackVerified:false`; actual picture/sound requires human verification.

## Reason for separate adapter

LG webOS uses SSAP browser-opening and a native HTML/HLS viewer; Google Cast
devices use the CastV2 receiver-app/media-load protocol. The prototype's
owner-tested HLS stream is an appropriate *candidate* for Google Cast because
Cast supports HLS with MPEG-TS video and AAC, but that alone does not
establish receiver playback.

Official Google references:
- [Supported media and HLS](https://developers.google.com/cast/docs/media)
- [Streaming format and segment support](https://developers.google.com/cast/docs/media/streaming_protocols)
- [Web receiver and CORS](https://developers.google.com/cast/docs/web_receiver/basic)
- [Cast protocol flow](https://chromium.googlesource.com/openscreen/+/HEAD/cast/docs/protocol_flow.md)

Experimental transport library reference:
- [node-castv2-client](https://github.com/thibauts/node-castv2-client),
  version 1.2.0; third-party dependency, *not yet integrated or audited for
  distribution*. Its receiver authentication/protocol provenance must be
  reviewed independently before release.

## Source tests

`node scripts/run-tests.cjs tv`

The mock Cast sender tests cover:

1. Selected physical private LAN, mDNS protocol, owner confirmation,
   receiver port 8009 and no model substitution.
2. Rejection of untrusted session origins, invalid/missing tokens and expiry.
3. Existing authenticated 1080p Cinema-ready source and bounded HLS playlist.
4. Correct live HLS Cast media metadata; transport acknowledgment distinguished
   from visible picture.
5. Mock CASTV2 connect, Default Media Receiver launch, media LOAD, owned
   media STOP, error and cleanup. Production LG startup does not import or use
   either module.

## Hardware evidence and blockers

A bounded read-only local scan on 6 November 2026 found AirPlay and DIAL
advertisers but **no Google Cast receiver**. No device was paired or
contacted via CastV2. No physical playback result exists.

Before enabling Google Cast in the Windows UI or public installer:

- Obtain a consenting Google Cast/Chromecast receiver and separately verify
  its identity and support for the Default Media Receiver.
- Audit/integrate the exact CastV2 sender library plus transitive dependency
  licenses and receiver-authentication behaviour. Verify the receiver is on
  the owner's explicitly selected LAN. No silent network probing/pairing.
- Determine the Cast receiver's real **CORS Origin**. Google Cast HLS fetches
  require suitable CORS, MIME types and range handling. Our current HLS
  proxy is intentionally unchanged; **do not weaken the original viewer's
  token-guarded media access with a blanket wildcard origin**.
- Test receiver LOAD, MPEG-TS/H.264/AAC decoding, moving video, audio,
  latency, bitrate and failures using the physical screen.
- Implement receiver-specific stop and source failure propagation while
  preserving independent laptop speaker recovery and existing LG semantics.
- Add it to the device selector **only after** positive hardware acceptance.
  Until then the UI must continue to say **discovered; direct casting not yet
  supported** for Google Cast.
- Revisit the public FFmpeg codec and third-party redistribution gates
  separately; this source preview does not clear those legal/build gates.

**No private LG keys, saved LAN IPs, owner settings, credentials, TV session
tokens, packaged runtime executables or user recordings belong in GitHub.**
