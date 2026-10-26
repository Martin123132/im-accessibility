<div align="center">

# I’m-accessibility

### Your computer. Your pace. Your control.

**Use your Windows PC from your television, share control with an AI assistant, and decide what happens next.**

**Public source preview · Windows + LG webOS · Human-led AI assistance**

[Current working version](docs/WHAT_IS_WORKING_2026-10-25.md) · [Get started](docs/SETUP.md) · [Features](docs/FEATURES.md) · [V1 release plan](docs/V1_RELEASE_PLAN.md) · [Safety](docs/SECURITY.md)

</div>

---

## Which version is current?

**October 26 source-preview candidate: LG v0.3.21.** This checkout advances the previously merged v0.3.16 H.264/AAC baseline with Cinema/Interactive/Fast viewing modes, the compact LG menu, owner-controlled session/audio recovery, and the playback live-edge fixes recorded in commit e322f22. The separate Windows tray control panel and **multi-brand, read-only Find TVs** source are under [Windows control panel](packaging/windows-control-panel/). See the [owner-tested source checkpoint](docs/OWNER_TESTED_LG_SOURCE_2026-10-26.md) for what was physically demonstrated and what remains untested. **This is source, not a signed installer or general release.**

**Earlier [draft PR #24](https://github.com/Martin123132/im-accessibility/pull/24)** contains the v0.3.17 browser-memory/one-click source candidate. It remains a historical development review alongside the later v0.3.21 source until the repo maintainer resolves its status. GitHub updates do **not** replace the owner's installed Windows/LG setup.

**[Read the exact working-version and PR status →](docs/WHAT_IS_WORKING_2026-10-25.md)**

## What if the computer worked around you?

I’m-accessibility is being built for people who want **more than one way to use their computer**. Instead of staying at a desk, you can put your Windows desktop on the television, navigate it with a familiar remote, and ask an assistant to prepare more involved actions.

**You remain in control.** AI support is optional, permissions are explicit, and pressing Send yourself is a perfectly valid workflow.

The current project joins two independently tested components: a local-network LG television desktop controller and an AI-assisted Codex Conversation Desk.

## What we’ve demonstrated

| Feature | Evidence | Status |
| --- | --- | --- |
| Windows desktop on an LG television | H.264/HLS session, owner-tested remote navigation | **Working prototype** |
| Magic Remote pointer, click and scroll | Clickable desktop preview, fallback controls | **Demonstrated** |
| Time-limited PC control | Mouse starts OFF; renewable 10-minute permission lease | **Verified prototype** |
| TV session recovery | Four-hour viewing session, Stop and Resume, rotated credentials | **Verified prototype** |
| Codex Conversation Desk | Exact-thread selector, durable drafts and review interface | **Prototype** |
| ChatGPT prepares text in Codex | Owner reviewed and sent the instruction with the TV remote | **Demonstrated live** |
| Automatic submission into the selected Codex window | Foreground UI ↔ persistent API thread matching unresolved | **Not yet verified** |
| Voice, music, video apps and games | Defined for the edge-testing programme | **Planned** |

**One real example:** ChatGPT inserted an instruction into the *stokes* Codex conversation on the laptop. The owner pressed Send using the LG Magic Remote. Codex received it and began working. The assistant did not claim to submit the message itself.

## How shared control works

~~~text
               I’M-ACCESSIBILITY
                       |
           +-----------+-----------+
           |                       |
     CONTROL IT YOURSELF       ASK FOR HELP
           |                       |
      LG Magic Remote            ChatGPT
           |                       |
      TV desktop view           PC Bridge
           |                       |
      Bounded mouse            Windows actions
           |                       |
           +-------- Windows PC ---+
                                  |
                             Codex Desk
                          (draft and review)
~~~

The television can keep showing the desktop while mouse-control permission expires. The owner can pause input or end the session. AI-prepared actions are separate from direct remote navigation.

## Start exploring

| | |
| --- | --- |
| [Setup](docs/SETUP.md) | Prerequisites, source checkout and local test commands |
| [Features](docs/FEATURES.md) | What works now, what is only a prototype, what is planned |
| [Architecture](docs/ARCHITECTURE.md) | TV, Windows, ChatGPT, PC Bridge and Codex boundaries |
| [Accessibility](docs/ACCESSIBILITY.md) | Design principles, control alternatives and testing goals |
| [Testing](docs/TESTING.md) | Reproducible tests and real hardware evidence |
| [V1 release plan](docs/V1_RELEASE_PLAN.md) | The acceptance gates for a product people can actually install |
| [Security & privacy](docs/SECURITY.md) | Owner permissions, private-network assumptions and recoverability |
| [Changelog](CHANGELOG.md) | Product repository milestones |

## Test the source preview

**This repository has no approved one-click installer download.** The Windows graphical installer and owner task/control-panel implementations are provided as **source previews**; local unsigned binaries remain private. The separately installed PC Bridge application, the owner's LG pairing, Windows task and local device settings are not included in the repository.

On Windows with Node.js 24 installed:

~~~powershell
git clone https://github.com/Martin123132/im-accessibility.git
cd im-accessibility
npm.cmd ci --prefix tv-reliability-v0.5/cast
npm.cmd run doctor
npm.cmd test
~~~

The read-only doctor reports local prerequisites; the test runner executes only the known safe suites. It will not submit a Codex message, pair a TV or start desktop control. See [Testing](docs/TESTING.md) for the baseline results. Tests do not start research work or submit Codex messages. The Codex Desk can be started separately once an installed Codex CLI is configured.

## Licence and commercial use

**Use I’m-accessibility for personal and other qualifying non-commercial purposes** under the [PolyForm Noncommercial License 1.0.0](LICENSE) and its [Required Notice](NOTICE.md).

Repackaging or selling the original project, offering it as part of a paid service, or other commercial exploitation requires a **separate written licence** from **TWO HANDS NETWORK LTD**. Commercial enquiries: **glyn@twohandsnetwork.co.uk**.

Third-party software retains its own licence terms; the PolyForm licence does not replace them.

---

## Where we’re going

**V1 should be a product, not a folder of scripts.** We’re working toward an understandable installer, clear device setup, a single control/status experience, accessible navigation, verifiable instructions and tested recovery when something goes wrong.

Apple Music, YouTube, supported streaming services, checkers, Worms and more demanding games are useful **edge tests**, not features we're pretending already work.

[See exactly what must pass before v1 ships →](docs/V1_RELEASE_PLAN.md)

---

**Release status:** Public source preview in v1 development. The original verified source snapshot is preserved at **v0.1.0-private-preview**. This repository does not include the full installed PC Bridge application, does not grant remote access by itself, and is not a general-release installer.
