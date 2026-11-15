---
name: ios-simulators
description: Use whenever you test or QA an iOS app on a simulator. Run slim simulators (SimSlim) so several fit on one Mac, one per agent or test shard, preflight them, and clean up after.
---

# iOS simulators

A stock iOS simulator runs about 200 processes with a memory footprint of about 1.6 GB. SimSlim (`simslim`, a third-party CLI from the `mobai-app` Homebrew tap) turns off the daemons tests do not need, which brings one down to about 85 processes and 600 MB, so several run in parallel on one Mac. It writes per-simulator launchd overrides and needs no sudo.

## Set up

1. Check for the tool: `command -v simslim`. Install it with the person's go-ahead (`brew tap mobai-app/tap && brew install mobai-app/tap/simslim`; Homebrew refuses a formula from a tap it has not added); without one, use the Fallback.
2. For each agent or test shard, create, slim and check its own simulator. Run these blocks in parallel; `simslim on` boots a new simulator, reconfigures it and boots it slim, which takes about a minute.
   ```sh
   # device types: xcrun simctl list devicetypes; iOS runtime ids: xcrun simctl list runtimes
   U=$(xcrun simctl create "qa-slim-<task>-1" "iPhone 17" <runtime id>)
   simslim on "$U" --except store,web
   simslim doctor "$U" --requires push,storekit,universal-links   # non-zero exit: not usable
   ```
   Put your task or agent name in the simulator name and keep each `$U`, so you only ever touch simulators you created.
3. Always pass `--except store,web`. `store` holds push and StoreKit, and `web` holds universal links. Without it the app gets no APNs device token, yet `simctl push` still delivers, so a push test can pass while registration is broken. `doctor` catches this.
4. Size the fleet to free memory: about 1 GB per slim simulator with a small app running.

## Run in parallel

- Each agent or test shard drives only its own UDID: `xcrun simctl ... "$U"`, `xcodebuild -destination "id=$U"`, or XcodeBuildMCP's `session_set_defaults{simulatorId: "$U"}`.
- Pass `xcodebuild -parallel-testing-enabled NO` and shard tests across your slim UDIDs yourself. Xcode's parallel clones get new UDIDs that SimSlim never configured.
- XCUITest app launches can take about 10 seconds longer on a slim simulator; allow for it in timeouts.

## Clean up

When you are done, run `xcrun simctl delete "$U"` for each simulator you created, including one that failed `doctor`. To keep a simulator, `simslim off "$U"` returns it to stock; to wipe a slim one and keep it, use `simslim erase "$U"`: the overrides survive `simctl erase`.

## Fallback

When `simslim` is missing or `doctor` fails, use a stock simulator and say so in your report, with the failing doctor line.

When `doctor` passes but the app gets no APNs token, check a stock simulator before blaming SimSlim: the token comes from Apple's sandbox push servers, and they can stop issuing tokens to new simulators on a host for a while.

## Limits

`doctor` shows the services are running, not that a feature works end to end. Use a real device for APNs delivery, camera and QR scanning, other hardware, real StoreKit purchases and performance. Check universal links against a real AASA domain, and notification service extensions, on a stock simulator or a device.
