# zerotier-one for SynoCommunity (spksrc)

English | [Italiano](README.it.md)

This folder is the recipe we contribute to [SynoCommunity/spksrc](https://github.com/SynoCommunity/spksrc),
so ZeroTier reaches every Synology owner through the community package source, not only through
SpkForge. It mirrors the spksrc tree:

| Path | What |
|---|---|
| `cross/zerotier/` | builds ZeroTierOne (client only, MPL-2.0) with Synology's toolchains |
| `spk/zerotier-one/` | the package: service definition, supervisor, CLI wrapper, firewall rule, wizards, DSM app, icon |
| `generate.ts` | regenerates the icon, the EN/IT wizards, the guard launcher and the DSM app from the SpkForge sources |

The recipe is licensed like spksrc (BSD-3-Clause) once merged there.

## Package name

In SynoCommunity the package is **`zerotier-one`**, the name of the upstream program. It is
deliberately different from the two other ZeroTier packages found on Synology NASes:

- `zerotier`: the old community package (spk7.imnks.com, closed in November 2026), whose
  `/var/packages/zerotier` many NASes still have;
- `zt-syno-net`: the SpkForge build of this same code.

With the same name Package Center would offer one as an upgrade of the other, with different
package users. Each of the three hands its node identity over: the guard takes over the identity
and networks of the other two, so a NAS keeps its node ID when it moves between them.

## Why it can be accepted now

SynoCommunity has an open request for ZeroTier since 2016 (issue 2490). A 2018 attempt (PR 3458)
stalled because ZeroTier "must run as root". This package runs nothing as root from the package:

- the service runs as `sc-zerotier-one` (`SERVICE_USER = auto`) with `zerotier-one -U`, under a
  supervisor that restarts it when it exits or stops answering;
- it needs `/dev/net/tun` and `CAP_NET_ADMIN`/`CAP_NET_RAW` on its own binary. DSM 7 gives
  third-party packages no way to get them, so the install wizard creates, with the admin's
  password, one boot-up task owned by root. The task holds the text of a small guard, so root never
  runs a file the package can modify. The guard loads `tun`, grants the capability again after
  every install or upgrade, takes over the identity of a previous ZeroTier package and starts the
  package when DSM wants it running. The uninstall wizard removes the task. A manual setup is
  described in the wizard for whoever prefers to create the task by hand;
- no dependency on any other package, no privilege broker, no signature that can expire.

## Build it like SynoCommunity does

The `spksrc recipe` workflow of this repository copies the recipe into a fresh spksrc checkout and
builds it in the official `ghcr.io/synocommunity/spksrc` image for x64, aarch64, armv7 and
evansport (DSM 7.1) and x64 (DSM 7.2). By hand, in an spksrc checkout:

```
cp -r contrib/spksrc/cross/zerotier spksrc/cross/
cp -r contrib/spksrc/spk/zerotier-one spksrc/spk/
cd spksrc && make setup
make -C cross/zerotier digests
make -C spk/zerotier-one arch-x64-7.2
```

## Tested

- On 16/11/2026 the spksrc x64-7.2 build (then still named `zt-syno-net`, revision 3) was
  installed on DSM 7.2.2-72806 (virtual DS723+) over an existing ZeroTier: the guard took over the
  old identity on its own, the network came up with the same address, and the DSM app worked.
- The install and upgrade wizards (same code) were tested through Package Center with the SpkForge
  build on DSM 7.2.2-72806 x86_64 and DSM build 90075 ARMv8.
- Not yet installed: the build under the final name `zerotier-one`.

## Submitting

Not submitted yet: opening the pull request is MTSistemi's decision. Draft:

- **Branch**: `zerotier-one-1.16.2`
- **Title**: `zerotier-one: Add ZeroTier One 1.16.2`
- **Body**:

  > Adds ZeroTier One 1.16.2 (client only, MPL-2.0) as `zerotier-one`, for DSM 7.
  > Closes #2490.
  >
  > The daemon never runs as root: it runs as `sc-zerotier-one` with `zerotier-one -U`. The
  > network capability comes from a boot-up task owned by root that the install wizard creates
  > with the admin's password (EN/IT); the task holds the guard's text, so root never runs a
  > file the package can modify. This addresses the reason #3458 did not land.
  > No dependency on other packages. The guard takes over the identity of a previous ZeroTier
  > package (`zerotier`, or the SpkForge build `zt-syno-net`), so node IDs survive the switch.
  >
  > Checklist: DSM 7.1 builds for x64/aarch64/armv7/evansport and the DSM 7.2 x64 build pass;
  > new installation tested on DSM 7.2.2.
