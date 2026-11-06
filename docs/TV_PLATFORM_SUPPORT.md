# TV platforms, discovery and connection support

I'm Accessibility is intended to work with different televisions and streaming receivers. **It is not an LG-only product.** This source preview has one owner-tested *connection implementation*; discovery and future connection adapters are separate components.

## Current implementation (4 November 2026)

| Device family | Discover on local network | Start desktop stream directly |
| --- | --- | --- |
| LG webOS | SSDP | Owner-tested on **LG OLED55CX6LA** only; other LG models require validation |
| Samsung / Tizen | SSDP | Not yet implemented |
| Sony BRAVIA | SSDP (when advertised) | Not yet implemented; capabilities vary by model |
| Google Cast / Chromecast | SSDP and mDNS | Experimental sender source with mock tests; **no physical playback acceptance or installer support** |
| Android / Google TV | SSDP and mDNS | Not yet implemented |
| Amazon Fire TV | SSDP | Not yet implemented |
| Roku | SSDP and mDNS | Not yet implemented |
| Apple AirPlay receivers | mDNS | Not yet implemented |
| Panasonic / Hisense / TCL / Philips | SSDP (when advertised) | Not yet implemented |
| Generic DLNA/DIAL renderer | SSDP | Discovery only; DLNA/DIAL is not desktop mirroring |

**Discovery is not a connection claim.** Results identify device, brand, address, discovery method and supported/unsupported connection status. The app must never treat a detected device as paired, compatible or able to show the Windows desktop automatically.

## New user's setup path

1. Install the Windows app, which supplies the tested application/runtime dependencies once binary redistribution is approved.
2. Open the app, select the relevant physical Wi-Fi/Ethernet adapter, and click **Find TVs**. This scan runs before any settings exist. Manually entering the TV IP remains an option.
3. Review discovered devices and explicit connection availability. Current owner-tested LG connections can be selected after ownership confirmation. Other devices remain visible but cannot be falsely started through the LG protocol.
4. When the selected platform's adapter is implemented, confirm any pairing request on that device, then press Start TV. The app should hide only its own controls—not launch or focus a particular media player.
5. If discovery fails, explain that network multicast may be restricted and retain manual address/setup diagnostics. Never change router, firewall or Windows security settings without owner approval.

## Google Cast experimental adapter (6 November 2026)

A separate opt-in CastV2 Default Media Receiver sender prototype now validates the selected private LAN, an explicit owner-approved mDNS device, the current private Cinema HLS playlist and bounded media loading. It has mock sender/receiver tests but **has not connected to real Google Cast hardware**. The production LG app and customer installer do not enable it.

See [Google Cast sender preview and remaining acceptance gates](GOOGLE_CAST_SENDER_PREVIEW.md). A receiver LOAD acknowledgment is not proof of visible playback.

## Cross-brand connection architecture to implement

Give every supported receiver a separate adapter with the same narrow interface:

- **Discover**: identify a device and available transport(s) on the owner's selected private LAN.
- **Validate**: check actual device/protocol/model compatibility before allowing Start.
- **Pair**: only on explicit owner confirmation; store any resulting secrets in the user's profile, never Git.
- **Open/stream**: launch the authorised viewer only through the matching protocol, with audio controls and playback readiness verified separately.
- **Stop/recover**: close only the app's stream, restore original laptop speaker state and release device-specific connections.

Candidate adapters need separate tests and acceptance: Google Cast receiver, Samsung Tizen control/receiver, AirPlay-capable receiving devices, Roku, and a secure manual-TV-browser path where that browser supports the required video format. Miracast is a separate native Windows wireless display path, not equivalent to HLS browser playback. None are declared implemented just because they are discoverable.

## Release and privacy limits

The public repository offers source and a **private QA builder**, not a cleared executable download. The exact GPL-enabled FFmpeg binary still needs corresponding-source/build-recipe and redistribution review. Native helper rights, publisher signing and further device and accessibility acceptance also remain open.

First-run discovery sends bounded SSDP/mDNS queries on a user-selected trusted LAN and stores no data. Never upload a private same-PC reinstall kit, LG pairing material, laptop addresses, owner account settings, session tokens or recordings.

The existing LG viewer and UI must remain intact until each additional adapter passes separate tests.
