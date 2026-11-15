# zt-syno-net for SynoCommunity (spksrc)

English | [Italiano](README.it.md)

This folder is the recipe we contribute to [SynoCommunity/spksrc](https://github.com/SynoCommunity/spksrc),
so ZeroTier reaches every Synology owner through the community package source, not only through
SpkForge. It mirrors the spksrc tree:

| Path | What |
|---|---|
| `cross/zerotier/` | builds ZeroTierOne (client only, MPL-2.0) with Synology's toolchains |
| `spk/zt-syno-net/` | the package: service definition, root setup task, CLI wrapper, firewall rule, wizards, icon |
| `generate.ts` | regenerates the icon and the EN/IT wizards from the SpkForge sources |

The recipe is licensed like spksrc (BSD-3-Clause) once merged there.

## Why it can be accepted now

SynoCommunity has an open request for ZeroTier since 2016 (issue 2490). A 2018 attempt (PR 3458)
stalled because ZeroTier "must run as root". This recipe does not run anything as root at runtime:

- the service runs as `sc-zt-syno-net` (`SERVICE_USER = auto`) with `zerotier-one -U`;
- the only privileges it needs, `CAP_NET_ADMIN`/`CAP_NET_RAW` on its own binary and `/dev/net/tun`,
  are granted by `bin/zt-syno-net-setup`, which the user runs as root from a DSM boot-up task
  (the same pattern Tailscale's DSM package documents);
- no dependency on any other package, no privilege broker, no signature that can expire.

## Build it like SynoCommunity does

The `spksrc recipe` workflow of this repository copies the recipe into a fresh spksrc checkout and
builds it in the official `ghcr.io/synocommunity/spksrc` image for x64, aarch64, armv7 and
evansport (DSM 7.1) and x64 (DSM 7.2). By hand, in an spksrc checkout:

```
cp -r contrib/spksrc/cross/zerotier spksrc/cross/
cp -r contrib/spksrc/spk/zt-syno-net spksrc/spk/
cd spksrc && make setup
make -C cross/zerotier digests
make -C spk/zt-syno-net arch-x64-7.2
```

## Submitting

Not submitted yet: opening the pull request is MTSistemi's decision. Draft:

- **Branch**: `zt-syno-net-1.16.2`
- **Title**: `ZeroTier: Add package (zt-syno-net) 1.16.2`
- **Body**:

  > Adds ZeroTier One 1.16.2 (client only, MPL-2.0) as `zt-syno-net`, for DSM 7.
  > Closes #2490.
  >
  > The daemon never runs as root: it runs as `sc-zt-syno-net` with `zerotier-one -U`, and the
  > network capability is granted by a boot-up task the user creates once (`bin/zt-syno-net-setup`,
  > explained in the install wizard, EN/IT). This addresses the reason #3458 did not land.
  > No dependency on other packages. The setup task also migrates the identity of a previous
  > ZeroTier package, so node IDs survive the switch.
  >
  > Checklist: build rule `arch-x64-7.2` and DSM 7.1 builds for x64/aarch64/armv7/evansport pass;
  > new installation and upgrade tested on DSM 7.2.
