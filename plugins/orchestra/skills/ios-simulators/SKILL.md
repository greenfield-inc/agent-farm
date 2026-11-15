---
name: ios-simulators
description: Use whenever you test or QA an iOS app on a simulator. Run slim simulators (SimSlim) so several fit on one Mac, one per agent or test shard, preflight them, and clean up after.
---

# iOS simulators

A stock iOS simulator runs about 200 processes and uses about 2 GB. SimSlim turns off the daemons tests do not need, which brings one down to about 90 processes and 750 MB, so you can run several in parallel. It writes per-simulator launchd overrides, needs no sudo, and `simslim off` reverts it.

## Set up

1. Check for the tool: `command -v simslim`. Install it only with the person's go-ahead (`brew install mobai-app/tap/simslim`).
2. Create one simulator per agent or test shard, named so you can find and delete it later:
   ```sh
   U=$(xcrun simctl create "qa-slim-1" "iPhone 17" <runtime id>)   # runtimes: xcrun simctl list runtimes
   simslim on "$U" --except store,web
   simslim doctor "$U" --requires push,storekit,universal-links      # non-zero exit means it is not usable
   ```
   Always pass `--except store,web`. The default profile also stops the app getting an APNs device token while `simctl push` still delivers, so push tests pass for the wrong reason.
3. Run `simslim on` for each simulator in parallel; each takes about 10 seconds including its reboot.

## Run in parallel

- Give each agent or test shard its own UDID, and drive only that UDID (`xcrun simctl ... "$U"`, `xcodebuild -destination "id=$U"`, or the simulator MCP's session default).
- Shard tests across your slim UDIDs yourself. Xcode's `-parallel-testing-enabled` makes clones with new UDIDs, and SimSlim's overrides belong to the original UDID.
- XCUITest app launches can take about 10 seconds longer on a slim simulator; allow for it in timeouts.

## Clean up

Delete the simulators you created: `xcrun simctl delete "$U"`. To keep one, return it to stock with `simslim off "$U"`. Use `simslim erase`, not `simctl erase`, to wipe a slim simulator, because the overrides survive `simctl erase`.

## Fallback

When `simslim` is missing or `doctor` fails, use a stock simulator and say so in your report, with the failing doctor line.

## Needs a real device

Real APNs delivery, camera and QR scanning, other hardware, and real-device performance. Universal links end to end (a real AASA domain), notification service extensions, and real StoreKit purchases are unverified on slim simulators; check them on a stock simulator or a device before calling them proven.
