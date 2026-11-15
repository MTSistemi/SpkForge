# zt-syno-net — ZeroTier for Synology DSM 7

English | [Italiano](../it/zt-syno-net.md)

zt-syno-net is ZeroTier One, built unmodified from the upstream source, packaged for every
Synology NAS that runs DSM 7: Intel and AMD (x86_64), ARM 64-bit (armv8), ARM 32-bit (armv7) and
Intel Atom 32-bit (i686).

It runs **without root**, depends on **no other package** and **keeps itself running**: no
SimplePermissionManager, no privilege broker, nothing that can stop working on a date.

## Which file

| File | For |
|---|---|
| `zt-syno-net_universal_<version>.spk` | any DSM 7 model; picks the right build at start. Use this if unsure. |
| `zt-syno-net_x86_64_<version>.spk` | Intel and AMD models |
| `zt-syno-net_armv8_<version>.spk` | ARM 64-bit models (Realtek RTD1296/RTD1619B, Marvell Armada 37xx) |
| `zt-syno-net_armv7_<version>.spk` | ARM 32-bit models (Armada 38x, Alpine, Monaco) |
| `zt-syno-net_i686_<version>.spk` | Intel Atom 32-bit models (evansport) |

## Install

1. Coming from the old `zerotier` package (spk7.imnks.com)? **Uninstall it first.** Its identity
   and networks stay on disk and are moved over automatically, so the node ID does not change.
2. Package Center > Manual Install > the `.spk`.
3. The wizard asks for a network ID (optional) and, on the **Automatic start and guard** step,
   for your DSM password. DSM needs it to create the one task that runs as root, "zt-syno-net",
   in Task Scheduler. That is all: the task is created and started at once.
4. Authorise the node in your ZeroTier controller.

## Why a root task, and what it does

DSM 7 gives a third-party package neither root execution nor network capabilities: we checked,
DSM rejects the package ("ctrl-script ... should not exist", "tool capabilities should not
exist"). ZeroTier needs `/dev/net/tun` and `CAP_NET_ADMIN`. The "zt-syno-net" task starts a small
guard that every 30 seconds:

- loads the `tun` module;
- grants `CAP_NET_ADMIN` to the ZeroTier binary, also **after every upgrade**;
- moves the identity of an older ZeroTier package, once;
- starts the package when DSM wants it running and it is not.

The guard's text lives **inside the task**, which DSM keeps root-owned: root never runs a file the
package can modify. Inside the package, an unprivileged supervisor restarts ZeroTier when it stops
or stops answering.

Uninstalling removes the task. Identity and networks stay in `/var/packages/zt-syno-net/var`, so a
reinstall keeps the same node ID.

## Use

Over SSH, as an administrator (`sudo`):

```
sudo zerotier-cli info
sudo zerotier-cli join <network-id>
sudo zerotier-cli listnetworks
```

## When it does not start

- `/var/packages/zt-syno-net/var/zt-syno-net.log`: start, supervisor, restarts.
- `/var/log/zt-syno-net-guard.log`: the root guard.
- If Task Scheduler has no "zt-syno-net" task (for example you unticked the box during the
  install), create it by hand: Triggered Task > User-defined script, user `root`, event `Boot-up`,
  command `/bin/sh /var/packages/zt-syno-net/target/bin/zt-syno-net-guard`, then Run. This variant
  runs a package file as root: the automatic creation is preferable.
