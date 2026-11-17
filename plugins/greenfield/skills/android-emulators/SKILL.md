---
name: android-emulators
description: Use whenever you test or QA an Android app on an emulator. Pick the system image by whether the run needs screenshots, run emulators headless, one per agent or test shard, and clean up after.
---

# Android emulators

## Set up

1. Use system images built for the host's CPU: `arm64-v8a` on Apple silicon, `x86_64` on Intel and most Linux hosts.
2. Pick the image by what the run captures:
   - Visual QA (screenshots, video, anything a person looks at) uses a `google_apis` image.
   - Logic and instrumentation runs with no screenshots use a `google_atd` image (API 30 and later). It strips the launcher, Settings, Play and other apps and renders no screen (the display is a solid color), so it never serves visual checks.

   ```sh
   sdkmanager "system-images;android-<api>;google_apis;arm64-v8a"   # or google_atd
   echo no | avdmanager create avd -n "qa-<task>-1" -k "system-images;android-<api>;google_apis;arm64-v8a"
   ```
   Reuse an AVD that already fits before creating one. Put your task or agent name in an AVD you create, and record it and any system image you installed, so cleanup touches only those.
3. Start it headless: `emulator -avd <name> -no-window -no-audio -no-boot-anim -no-snapshot-save`. Extra instances of one AVD add `-read-only`.
4. Turn animations off once it boots:
   ```sh
   adb -s <serial> shell settings put global window_animation_scale 0
   adb -s <serial> shell settings put global transition_animation_scale 0
   adb -s <serial> shell settings put global animator_duration_scale 0
   ```

## Run in parallel

- Stop an emulator as soon as its journey is idle: `adb -s <serial> emu kill`.
- Each agent or test shard drives only its own serial (`adb -s <serial>`).

## Clean up

When you are done, stop each emulator you started, delete each AVD you created (`avdmanager delete avd -n <name>`), and uninstall each system image the run installed that no other AVD uses (`sdkmanager --uninstall "<package>"`).
