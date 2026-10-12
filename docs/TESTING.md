# Testing the source

Tests should not require a personal research conversation, a live Codex submission or an active screen-sharing session.

## Restore the declared dependency

~~~powershell
npm.cmd ci --prefix tv-reliability-v0.5/cast
~~~

## Run all safe tests

~~~powershell
npm.cmd run check:source
npm.cmd test
~~~

**npm test** runs only the known TV and Codex test files; it excludes live-readonly-smoke and any real Codex submission. Windows GitHub Actions uses the same commands after restoring the pinned TV dependency. The existing checkpoint recorded 37 passed, 0 failed and 2 live-HLS skips.

## Run the Codex safety suite

~~~powershell
node --test .\codex-chat-control-pilot-20261012\tests\pilot-safety.test.cjs .\codex-chat-control-pilot-20261012\tests\selection-safety.test.cjs
~~~

## Run the TV safety suite

~~~powershell
node --test .\tv-reliability-v0.5\tests\session-policy.test.cjs
~~~

Also run the explicit **\*.test.cjs** files in **tv-reliability-v0.5/viewer/tests/**. Avoid including the separate live-readonly-smoke script in a default test glob.

## Isolated checkpoint results

| Result | Number |
| --- | ---: |
| Tests discovered | 39 |
| Passed | 37 |
| Failed | 0 |
| Skipped | 2 |

The two skipped snapshot tests require actual fresh HLS video segments. They should run as hardware acceptance checks while streaming is active, not in a standalone CI checkout.

The original TV module separately recorded 19/19 regression checks; Codex recorded 20/20 isolated mock/safety checks. The two measurements are not the same as a complete production acceptance test.

## V1 verification still required

Repeat the tests in an independent Windows installation; verify a real LG session, keyboard/focus alternatives, wrong-target detection, emergency Stop and recovery. Record time-to-stop and any remaining file changes. Keep private screenshots, tokens and research data out of GitHub Actions artifacts.
