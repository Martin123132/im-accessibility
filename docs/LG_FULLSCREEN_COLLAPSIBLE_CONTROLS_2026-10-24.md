# LG full-screen controls menu — 24 October 2026

**Scope:** UI-only change to the existing same-origin full-screen HLS viewer. This does not replace the video player, change its quality, change any Windows mouse or audio APIs, or alter the working installed beta.

The original row of **Enable mouse, Pause mouse, Play video, TV sound, Laptop sound, Original controls and End TV session** buttons blocked the top edge of Windows on the television. The `LIVE DESKTOP` status also obscured the opposite top corner.

The v0.3.8 draft puts those seven buttons, the status and the hint inside one collapsible **Controls** panel. It starts closed. The only persistent control is a small bottom-right button. When opened, the menu grows upward from that corner. Selecting Enable mouse or successfully pausing mouse input closes the panel automatically, revealing the full desktop. Sound buttons still allow TV only, laptop only and both outputs.

The original HLS `<video>` remains `object-fit:contain`, the single full-viewport HTML click surface remains above it, and the control panel is a separate higher-level HTML hit target. No native-video fullscreen request or JPEG snapshot fallback replaces the HLS video.

## Windows and physical-LG evidence

- Full Windows suite: 102 discovered, 100 passed, zero failed, two expected skips (as tested before this release's packaging step).
- New assertions verify the collapsed menu has no Windows click side effect, opens and closes, and does not introduce a permanent top-aligned toolbar.
- On the actual LG OLED55CX6LA, the diagnostic browser measured a **1536 × 856 CSS viewport** (DPR 1.25). The collapsed tab measured x=1362–1522, y=797–842; the open panel measured x=1182–1522, y=375–797. The upper part of the screen has no status or toolbar boxes.
- The original live HLS viewer was reopened after the physical measurement. The temporary instrumentation was restored byte-for-byte.
- The paired-network-remote pointer experiment sent no Windows actions and disarmed mouse control after testing. Its attempted menu/Enable click did not produce a confirmed Windows mouse lease, so actual hand-held Magic Remote UI acceptance remains outstanding. This is not evidence of a Windows click failure; the menu source-level interactions are independently tested.

## Recovery and release

The live isolated v0.3.7 test profile has its original HTML/CSS/JS saved at `D:\ImAccessibility-WebOS-Input-Lab-20261023\v038-dropdown-backup-20261024` before the draft assets were staged. The original general installed beta is unchanged.

This remains draft pending owner verification of the dropdown with the handheld Magic Remote, final audio and Windows 11 acceptance.