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
   sdkmanager --list_installed                                       # note what is already there
   sdkmanager "system-images;android-<api>;google_apis;arm64-v8a"   # or google_atd
   echo no | avdmanager create avd -n "qa-<task>-1" -k "system-images;android-<api>;google_apis;arm64-v8a"
   ```
   Reuse an AVD that already fits before creating one. Put your task or agent name in an AVD you create. Record it, and any system image that `sdkmanager --list_installed` did not show before you installed it, so cleanup touches only those.
3. Start it headless on a console port of your own, an even number from 5554 to 5682 that `adb devices` does not list, and keep its serial, so you only ever touch emulators you started. Extra instances of one AVD add `-read-only`.
   ```sh
   PORT=<free even port>; S=emulator-$PORT
   emulator -avd <name> -port $PORT -no-window -no-audio -no-boot-anim -no-snapshot-save &
   EPID=$!
   until adb devices | grep -q "^$S[[:space:]]" || ! kill -0 $EPID 2>/dev/null; do sleep 1; done
   kill -0 $EPID 2>/dev/null && adb -s $S wait-for-device shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 2; done'
   kill -0 $EPID 2>/dev/null && adb devices | grep -q "^$S[[:space:]]" || echo "port $PORT is taken: start again on another"
   ```
   Use the emulator only when, after boot, its own process (`$EPID`) is alive and `adb devices` lists `$S`. When the process has exited, another agent holds that port, so start again on another one.
4. Turn animations off once it has booted:
   ```sh
   adb -s $S shell settings put global window_animation_scale 0
   adb -s $S shell settings put global transition_animation_scale 0
   adb -s $S shell settings put global animator_duration_scale 0
   ```

## Run in parallel

- Size the fleet as `machine-resources` says. Stop an emulator as soon as its journey is idle: `adb -s $S emu kill`.

## Clean up

When you are done, stop each emulator you started, delete each AVD you created (`avdmanager delete avd -n <name>`), and uninstall each system image you recorded as new that no other AVD uses (`sdkmanager --uninstall "<package>"`).
