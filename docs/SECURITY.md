# Security

- This repository must remain PRIVATE until separately reviewed. Never commit LG client keys, bearer tokens, app keys, browser profiles, session logs or personal conversations.
- Only a private LAN with a locally paired LG television should access the TV viewer. No router port forwarding or public web hosting.
- The TV viewer grants bounded mouse movement, click and scrolling, not arbitrary keyboard, shell or file access. Mouse control should default OFF and expire after ten minutes.
- The Codex Desk serves only localhost (127.0.0.1), and its browser routes cannot send a Codex instruction.
- A Codex App Server turn/start launches execution immediately and must never be confused with composing a draft.
- Verify the exact persistent conversation target before submission. A foreground title does not establish a persistent thread ID.
- A submission with an unknown outcome must be marked for manual review, not automatically retried.
- Store evidence, screenshots and credentials on the owner laptop separately from Git history.
- Review third-party licences and dependency advisories before public or commercial redistribution.