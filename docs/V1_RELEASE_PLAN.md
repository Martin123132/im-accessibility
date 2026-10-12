# V1 release plan

The destination is a usable **I’m-accessibility v1 product**: something a new person can install, understand, use, stop and recover without needing the original engineer's laptop.

## Existing foundation

- [x] Windows desktop displayed on a compatible LG television.
- [x] Owner-operated Magic Remote navigation, click and scrolling.
- [x] Renewable mouse lease and bounded TV Stop/Resume.
- [x] Local Codex conversation selection and draft review.
- [x] ChatGPT enters a real instruction; owner submits using TV remote.
- [x] Reproducible local test checkpoint and a versioned Git baseline.

## Release gates

### Installation and supported hardware
- [ ] Guided Windows installation with clear permissions and uninstall.
- [ ] No owner-specific Windows, LAN or executable paths.
- [ ] TV discovery, pairing and error recovery on a second environment.
- [ ] Dependency licensing, binary provenance and update checks.

### User experience and accessibility
- [ ] One coherent entry point showing session state, controls and Stop.
- [ ] Size/contrast options, visible focus and clear permission expiry.
- [ ] Accessibility testing with varied input and access preferences.
- [ ] Usable error messages and alternative navigation paths.

### Assisted actions
- [ ] Reliable exact-target identification or a safe manual confirmation path.
- [ ] Visible drafts, separate approval, one-shot submission and authoritative receipts.
- [ ] No interference with unrelated Codex or research conversations.
- [ ] Clear ambiguity handling for spoken or incomplete instructions.

### Recovery and release assurance
- [ ] Tested cancellation, session expiry, reconnect and stale-target behaviour.
- [ ] Wrong-command drills with measured recovery time and residual changes.
- [ ] Automated clean-clone Windows test suite and real-device acceptance tests.
- [ ] Privacy/security review, distribution decision and selected software licence.

## Edge testing

Music, YouTube, Sky, checkers, Worms, other games and voice are experimental tasks to discover control limits. They should not become advertised v1 features before their actual operation is verified.

Each benchmark records: task success, elapsed time, human interventions, target accuracy, recovery time, residual damage and repeatability.

**Definition of done:** an independent user can set it up, safely operate a real PC, understand what the assistant is doing, stop it promptly and recover from a wrong action. Until then this remains a private preview.
