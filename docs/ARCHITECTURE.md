# Architecture

I’m-accessibility deliberately separates what the person controls directly from what an assistant can prepare or execute with explicit permission.

## Direct television control

~~~text
Windows desktop ── H.264/HLS, trusted LAN ── LG television
       ^                                       |
       |                                  Magic Remote
       +──────── limited mouse events ─────────+
~~~

The TV viewer has separate permissions for showing the desktop and for mouse input. Mouse access must be enabled by the owner, expires after ten minutes and can be paused without turning off the video.

## Optional ChatGPT assistance

~~~text
Owner request → ChatGPT → authorised PC Bridge → Windows PC
                                      |
                              results / checkpoints
~~~

The installed PC Bridge application is external to this repository and applies its own access rules. A GitHub checkout alone does not grant PC control.

## Codex Conversation Desk

~~~text
Select exact conversation → prepare draft → review text
                                             |
                                      explicit approval
                                             |
                                      one-shot submission
                                             |
                                     receipt and outcome
~~~

The official Codex App Server works with persistent thread IDs. Its **turn/start** request begins a turn immediately. It does not insert unsent text in the separate visible Windows editor.

In the owner-supervised real demonstration, ChatGPT inserted text in the visible composer and the owner pressed Send with the TV remote. This is a tested combined workflow, **not** an independently proven App Server submission route.

## Trust boundaries

| Boundary | Mechanism | Limitation |
| --- | --- | --- |
| TV stream | Private LAN receiver and expiring access | Not designed for public internet |
| TV input | Explicit renewable lease | Mouse-only controls in the viewer |
| PC Bridge | Owner-authorised local application | The installed app is not in this repo |
| Codex Desk browser | 127.0.0.1 localhost server | No browser Send route |
| Codex draft | Exact ID, text hash, expiration and approval | Foreground desktop identity remains separate |
| Codex send | Claimed once, uncertain outcomes require review | Live autonomous completion not yet certified |

## Source folders

- **tv-reliability-v0.5/**: cast, authenticated viewer, pointer helper, Stop/Resume and tests.
- **codex-chat-control-pilot-20261012/**: restricted App Server client, draft ledger, selected-thread record and Desk.
- **docs/**: user guidance, technical boundaries and v1 release requirements.

The v1 architecture goal is one coherent user experience that preserves these security boundaries.
