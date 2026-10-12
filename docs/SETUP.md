# Source restoration and local prerequisites

This snapshot reproduces the source files and tests, NOT automatic setup of the original owner's PC Bridge installation.

Windows machine:
- Node.js 24 or a compatible version.
- The existing, separately installed PC Bridge app where authorised.
- LG webOS television on the same LAN for hardware tests.
- FFmpeg or other configured local H.264 source used by the TV build.
- Run npm ci inside the television cast subfolder to install lgtv2.
- Check the viewer/native/TvPointer.cs and included helper binary before running a native controller.
- Do not create persistent startup services or firewall rules as part of source verification.

For the Codex Desk, use an installed Codex CLI and either place it on PATH or set PC_BRIDGE_CODEX_EXE locally to the absolute executable path. Run node desk.cjs inside the Codex pilot folder, then visit http://127.0.0.1:43191 on that same PC.

Source tests: use node --test against the test files; do not run an App Server dispatch just to test connectivity.

The original TV resume build was configured with an on-demand Windows task and owner-specific launcher path. Before migrating to another PC or clone location, the task path, LAN configuration, dependencies, pairing, encoder and native helper must be explicitly revalidated. Never overwrite the original owner working setup simply because the repository was cloned.