# Capabilities and limitations

I’m-accessibility combines direct control and optional AI assistance. This page distinguishes real demonstrations from prototype code and future plans.

## Today: Windows through the TV

**Demonstrated with a specific LG OLED55CX6LA**

- Stream the live Windows desktop to the LG browser over a trusted private network.
- Point, click and scroll using the Magic Remote, with a clickable desktop preview and arrow-control fallback.
- Grant mouse-control permission for renewable ten-minute intervals. It begins disarmed.
- Keep the video session alive for up to four hours, independently from a ChatGPT chat.
- Stop or Resume using the owner's Windows shortcuts; rotate access credentials for a new session.

This does not mean every smart television or controller is supported.

## Today: AI-assisted work

**Demonstrated:** ChatGPT prepared text in a visibly confirmed Windows Codex conversation. The owner reviewed it and pressed Send using the LG remote. Codex began working.

**Prototype with safety tests:** The independent Codex Conversation Desk lists persistent threads, supports manual selection, and stores draft text with hashes, expiration, approval and outcome tracking. The isolated safety/selection suite passed 20 tests at the original checkpoint.

**Still open:** Fully automatic submission to *the thread currently selected in the desktop window*. A separate App Server connection does not reliably reveal foreground selection. Do not infer the target from title or recency.

## Not yet implemented or benchmarked

| Area | Planned investigation |
| --- | --- |
| Voice | Spoken instructions, ambiguity detection and confirmations |
| Music | Apple Music playback, playlist management and recommendations |
| Video | YouTube search, navigation and playback |
| Streaming | Supported Sky TV paths and DRM restrictions |
| Games | Checkers, chess, Worms and increasingly time-sensitive play |
| Application switching | Foreground identity, safe focus and return to a session |
| Failure recovery | Wrong instructions, cancel latency, change inspection and rollback |

The point of those tests is to discover what the existing PC Bridge can do, not to promise integrations before they are verified.

## What's outside this repository?

The full installed Windows PC Bridge application, an end-user installer, an automatic LG pairing process, general internet remote access and private credentials.

[How it works](ARCHITECTURE.md) · [Getting started](SETUP.md) · [What v1 requires](V1_RELEASE_PLAN.md)
