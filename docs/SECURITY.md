# Security and privacy

I’m-accessibility can interact with a real Windows desktop. The user’s permission, understanding and ability to stop an action are part of the product design.

## Current boundaries

- The LG viewer is intended for a trusted **private LAN**, not public internet access.
- TV mouse control starts OFF, must be enabled by the owner and expires after ten minutes unless renewed.
- Video viewing has a separate bounded four-hour session with explicit Stop and Resume.
- The browser-based Codex Conversation Desk serves **127.0.0.1** and exposes **no Send endpoint**.
- A Codex App Server turn/start request immediately begins work, unlike writing an unsent draft.
- Exact thread identity, message hash, staged approval and persistent receipts are needed before attempting a live Codex submission.
- An uncertain result must trigger **manual review**, not an automatic retry.

The ChatGPT-to-PC Bridge path has its own network and authorisation boundary. This is not a claim that the whole product is offline or end-to-end encrypted.

## Excluded data

Git intentionally excludes runtime sessions, bearer tokens, LG pairing keys, browser profiles, screenshots of research, private conversation text, credentials and logs. Source-only tests must not access live research sessions.

## Reporting vulnerabilities

For the private preview, report sensitive vulnerabilities to the repository owner through a private contact or GitHub's private reporting facilities rather than publishing attack details or credentials in an issue.

## Before v1 release

A security review must cover the installed Bridge application, native helper and dependencies, permission revocation, network boundary checks, stale or replayed actions, recovery, installer behaviour and data retention. Broader distribution is gated on this review.
