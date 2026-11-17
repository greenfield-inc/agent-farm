---
name: ios-simulators
description: Use whenever you test or QA an iOS app on a simulator. Run slim simulators (SimSlim) so several fit on one Mac, one per agent or test shard, keep only the services the journeys need, preflight them, and clean up after.
---

# iOS simulators

SimSlim (`simslim`, a third-party CLI from the `mobai-app` Homebrew tap) turns off the simulator daemons tests do not need. In one measured run it brought a simulator from about 200 processes and 1.6 GB to about 85 processes and 600 MB, so several run in parallel on one Mac. It writes per-simulator launchd overrides and needs no sudo. Slim every QA simulator.

## Set up

1. Check for the tool: `command -v simslim`. Install it with the person's go-ahead (`brew tap mobai-app/tap && brew install mobai-app/tap/simslim`; Homebrew refuses a formula from a tap it has not added); without one, use the Fallback.
2. Use one iOS runtime and one device model for the run. Choose the model for layout coverage (screen size, notch or Dynamic Island); an older model does not save memory or CPU.
3. Pick the SimSlim categories the PR's journeys need. A slim simulator has these off unless you keep them:

   | The journey uses | Keep it with |
   |---|---|
   | push notifications, StoreKit or the App Store | `--except store` |
   | universal links | `--except web` |
   | Contacts, Calendar or Mail pickers | `--except pim` |
   | the photo picker or Photos library | `--except photos` |
   | one specific daemon | `--keep <launchd label>` |

   Combine categories in one list (`--except store,web`). `simslim profiles` lists every category and what stops working without it. Pass the matching features to `doctor --requires` (`simslim doctor --list` names them), so a broken one fails before the journey runs. Push needs this most: without `store` the app gets no APNs device token, yet `simctl push` still delivers, so a push test can pass while registration is broken.
4. For each agent or test shard, create, slim and check its own simulator. Run these blocks in parallel; `simslim on` boots a new simulator, reconfigures it and boots it slim, which takes about a minute.
   ```sh
   # device types: xcrun simctl list devicetypes; iOS runtime ids: xcrun simctl list runtimes
   U=$(xcrun simctl create "qa-slim-<task>-1" "iPhone 17" <runtime id>)
   simslim on "$U"                                    # plus the --except / --keep from step 3
   simslim doctor "$U" --requires <features>          # non-zero exit: not usable
   ```
   Put your task or agent name in the simulator name and keep each `$U`, so you only ever touch simulators you created.
5. Measure each one with `simslim measure "$U"`. When a slim simulator measures far above its slim siblings, the runtime's shared cache is missing: run `xcrun simctl runtime dyld_shared_cache update --all` once and measure again.

## Run in parallel

- `simslim top` shows the fleet's memory and CPU. Shut down a simulator as soon as its journey is idle: `xcrun simctl shutdown "$U"`.
- Each agent or test shard drives only its own UDID: `xcrun simctl ... "$U"`, `xcodebuild -destination "id=$U"`, or XcodeBuildMCP's `session_set_defaults{simulatorId: "$U"}`.
- Pass `xcodebuild -parallel-testing-enabled NO` and shard tests across your slim UDIDs yourself. Xcode's parallel clones get new UDIDs that SimSlim never configured.
- XCUITest app launches can take about 10 seconds longer on a slim simulator; allow for it in timeouts.
- Capture screenshots and video with `xcrun simctl io "$U" screenshot` and `recordVideo`. Leave XCUITest video capture off, since it can grow the simulator's render server without bound, and leave `FramebufferServerRendererPolicy` at its default, since changing it breaks `simctl io` screenshots.

## Clean up

When you are done, run `xcrun simctl delete "$U"` for each simulator you created, including one that failed `doctor`, then `xcrun simctl delete unavailable`. To keep a simulator, `simslim off "$U"` returns it to stock; to wipe a slim one and keep it, use `simslim erase "$U"`: the overrides survive `simctl erase`.

## Fallback

When `simslim` is missing or `doctor` fails, use a stock simulator and say so in your report, with the failing doctor line.

When `doctor` passes but the app gets no APNs token, check a stock simulator before blaming SimSlim: the token comes from Apple's sandbox push servers, and they can stop issuing tokens to new simulators on a host for a while.

## Limits

`doctor` shows the services are running, not that a feature works end to end. Use a real device for APNs delivery, camera and QR scanning, other hardware, real StoreKit purchases and performance. Check universal links against a real AASA domain, and notification service extensions, on a stock simulator or a device.
