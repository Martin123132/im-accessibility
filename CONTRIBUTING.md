# Contributing to I’m-accessibility

The repository is in private v1 development. Dependability, accessibility and recoverability are more important than adding a long list of unverified integrations.

Before changing code, read [Features](docs/FEATURES.md), [Architecture](docs/ARCHITECTURE.md) and [Security](docs/SECURITY.md). Use a feature branch and preserve the tagged source checkpoint.

Every proposed control change should describe its target, permission requirements, expected result and how to stop or undo it. Add synthetic or mock tests for wrong-target selection, stale permissions, duplicate requests, uncertain results and error recovery.

Run the available safe test suite locally. Real PC-control experiments must be owner-authorised, bounded and recorded outside the repository. Never commit pairing keys, browser profiles, tokens, personal screenshots or private research conversations.

A public redistribution licence and external contribution policy have not yet been chosen. Do not interpret the private source repository as granting those permissions.
