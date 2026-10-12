# Private preview â€” 12 October 2026

Version: v0.1.0-private-preview. Status: source snapshot, not an installed release.

- TV Reliability 0.5: prior 19/19 regression checks; Stop and Resume with rotated credentials; four-hour video session and ten-minute TV-side mouse-control lease.
- Owner physically confirmed remote pointer/click/navigation from LG television controlling the actual Windows desktop.
- Codex integration: separate Desk, per-thread selection, durable drafts, and 20/20 mock safety tests after correcting a non-idle-thread guard and a wrong-thread completion-notification acceptance bug.
- Real owner-supervised example: ChatGPT typed in a foreground Codex conversation; the owner pressed Send on the LG remote; a read-only screenshot confirmed the submitted message and a new Codex working turn.
- This did not prove unattended app-server submission; Codex selected-UI-thread correlation remains open.

Known limitations:
- Original installed PC Bridge app, Windows on-demand tasks and LG pairing are separate, not vendored.
- Source includes owner-era paths/port assumptions; clone into a suitable Windows environment and review configuration before starting.
- Codex executable path is now configurable via PC_BRIDGE_CODEX_EXE in the release copy.
- No browser-side Send route exists in the Codex Desk.
- Real-time desktop control is not designed for public Internet exposure.
- Windows/TV encoder and hardware regression is not reproducible in GitHub CI without the original environment.
- Per-session stokes UI automation and screenshots remain local and are intentionally not in Git.