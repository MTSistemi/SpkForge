# zt-syno-net — ZeroTier for Synology DSM 7

English | [Italiano](../it/zt-syno-net.md)

zt-syno-net is ZeroTier One, built unmodified from the upstream source, packaged for every
Synology NAS that runs DSM 7: Intel and AMD (x86_64), ARM 64-bit (armv8), ARM 32-bit (armv7) and
Intel Atom 32-bit (i686).

It runs **without root** and depends on **no other package**: no SimplePermissionManager, no
privilege broker, nothing that can stop working on a date.

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
   and networks stay on disk; step 3 moves them, so the node ID does not change.
2. Package Center > Manual Install > the `.spk`. The wizard asks for an optional network ID.
3. **One-time setup, as root.** Control Panel > Task Scheduler > Create > Triggered Task >
   User-defined script. User: `root`. Event: `Boot-up`. Command:

   ```
   /bin/sh /var/packages/zt-syno-net/target/bin/zt-syno-net-setup
   ```

   Save, select the task, **Run**. It loads `tun`, grants `CAP_NET_ADMIN` to the ZeroTier binary,
   migrates an older identity if there is one, and starts the package.
4. Authorise the node in your ZeroTier controller.

After **every upgrade** of zt-syno-net, run the task once more: an upgrade replaces the binary and
its capabilities.

## Use

Over SSH, as any administrator:

```
/var/packages/zt-syno-net/target/bin/zerotier-cli info
/var/packages/zt-syno-net/target/bin/zerotier-cli join <network-id>
/var/packages/zt-syno-net/target/bin/zerotier-cli listnetworks
```

Data (identity, networks) lives in `/var/packages/zt-syno-net/var` and survives uninstall.

## When it does not start

`/var/packages/zt-syno-net/var/zt-syno-net.log` says why. Almost always: the boot-up task has not
run since the last install or upgrade. `setup.log` in the same folder logs the task itself.

The task refuses to migrate an identity while another `zerotier-one` is running, because two
daemons with the same identity knock each other off the network. Stop the old one first.
