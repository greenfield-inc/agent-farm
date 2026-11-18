---
name: machine-resources
description: Use whenever you create a VM, container, simulator or emulator, or launch Chrome for automation. Reuse what fits, size the work to the machine you are on, and delete what the run created when it ends.
---

# Machine resources

## VMs and containers

Create a VM, Colima or Lima profile, container, volume or image whenever the work needs one. Look for one that fits first (`colima list`, `limactl list`, `docker ps -a`) and reuse it.

Count as created only what was absent before the run: list what exists (for example `docker image ls`) before you pull or install, and record what the run adds (profile names, container, volume and image ids, SDK packages). When the run that needed them ends, delete what it created: the VM or profile with its data disk, and the containers, volumes, images and SDK packages it added. Leave alone anything the run did not create, including a VM or profile it reused.

## Size the work to the machine

While simulators, emulators or VMs run, watch the machine's free memory, disk and load as shares of what it has, and decide from that how many to run. When the machine runs short, keep going: shut down idle ones, reuse or slim instead of creating, and delete what the run no longer needs.

## Chrome

When you launch installed Google Chrome for automation, pass `--disable-features=MacAppCodeSignClone`, or use Chrome for Testing or Playwright's bundled Chromium, so its code-sign clones do not pile up on macOS. Those clones share disk blocks, so measure disk use with `df`, not `du`.
