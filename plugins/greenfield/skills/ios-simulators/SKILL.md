---
name: ios-simulators
description: Use whenever you test or QA an iOS app on a simulator. Run slim simulators (SimSlim) so several fit on one Mac, one per agent or test shard, preflight them, and clean up after.
---

# iOS simulators

A stock iOS simulator runs about 200 processes and uses about 2 GB. SimSlim (`simslim`, a third-party CLI from the `mobai-app` Homebrew tap) turns off the daemons tests do not need, which brings one down to about 90 processes and 750 MB, so several run in parallel on one Mac. It writes per-simulator launchd overrides and needs no sudo.

## Set up

1. Check for the tool: `command -v simslim`. Install it with the person's go-ahead (`brew install mobai-app/tap/simslim`); without one, use the Fallback.
2. For each agent or test shard, create, slim and check its own simulator. Run these blocks in parallel; `simslim on` reboots the simulator slim in about 10 seconds.
   ```sh
   # device types: xcrun simctl list devicetypes; iOS runtime ids: xcrun simctl list runtimes
   U=$(xcrun simctl create "qa-slim-<task>-1" "iPhone 17" <runtime id>)
   simslim on "$U" --except store,web
   simslim doctor "$U" --requires push,storekit,universal-links   # non-zero exit: not usable
   ```
   Put your task or agent name in the simulator name and keep each `$U`, so you only ever touch simulators you created.
3. Always pass `--except store,web`. `store` holds push and StoreKit, and `web` holds universal links. Without it the app gets no APNs device token, yet `simctl push` still delivers, so a push test can pass while registration is broken. `doctor` catches this.
4. Size the fleet to free memory: about 750 MB per simulator, plus the app.

## Run in parallel

- Each agent or test shard drives only its own UDID: `xcrun simctl ... "$U"`, `xcodebuild -destination "id=$U"`, or XcodeBuildMCP's `session_set_defaults{simulatorId: "$U"}`.
- Pass `xcodebuild -parallel-testing-enabled NO` and shard tests across your slim UDIDs yourself. Xcode's parallel clones get new UDIDs that SimSlim never configured.
- XCUITest app launches can take about 10 seconds longer on a slim simulator; allow for it in timeouts.

## Clean up

When you are done, run `simslim off "$U"` and then `xcrun simctl delete "$U"` for each simulator you created, including one that failed `doctor`. To wipe a slim simulator and keep it, use `simslim erase "$U"`: the overrides survive `simctl erase`.

## Fallback

When `simslim` is missing or `doctor` fails, use a stock simulator and say so in your report, with the failing doctor line.

## Limits

`doctor` shows the services are running, not that a feature works end to end. Use a real device for APNs delivery, camera and QR scanning, other hardware, real StoreKit purchases and performance. Check universal links against a real AASA domain, and notification service extensions, on a stock simulator or a device.
