# SpkForge — design

English | [Italiano](../it/design.md)

Status: draft, 2026-11-15.

## 1. Why this exists

The best-known community package source for Synology DSM 7, *我不是矿神* (spk7.imnks.com),
shut down on 2026-11-01. Its server software, `tbc0309/sspks-imnks`, stays on GitHub under
GPL-3.0. Two consequences hit us directly:

1. **No native ZeroTier for DSM 7 any more.** ZeroTier itself only publishes a Docker recipe for
   DSM 7 (`pkg/synology/dsm7-docker`), and SynoCommunity does not ship ZeroTier at all.
2. **Its packages die when a signing key expires.** On 2026-11-15 a DSM 7.2.2 NAS rebooted and
   could not start its ZeroTier 1.14.2 package: `verify signature failed: openpgp: key expired`,
   then `real-start-stop-status signature is not match`. Every NAS running ZeroTier from that
   source (1.14.2 or 1.16.2) loses it the next time the package or the NAS restarts. See 2.1 for
   where that signature actually lives.

We build our own package source, written from scratch and owned by MTSistemi. It is published
publicly on GitHub, has a first-class web interface, and its first package is ZeroTier at the
latest upstream release (1.16.2 at the time of writing).

The original domain is held until 2029-11-16 and then released. Any NAS that still lists
spk7.imnks.com as a source should drop it before then, because whoever registers the domain
next could serve packages to it.

## 2. What "signed by MTSistemi" means on DSM 7

Synology's DSM 7 Developer Guide lists "Remove keyring" and "Remove trust level" among the Package
Center changes: the SPK codesign mechanism is deprecated. A third-party package is installed after
a "not verified by Synology" warning whether it carries a signature or not.

### 2.1 The 2026-11-15 failure was not DSM's signature

Inspecting two affected NAS (read-only, 2026-11-15) showed that the expired signature belongs to
**SimplePermissionManager** (SPM, maintainer "Jim Ma"), a helper package the imnks ZeroTier relied
on to run as root:

- the package's `conf/privilege` says `"run-as": "package"`, as DSM 7 requires;
- its `scripts/start-stop-status` hands over to `/usr/local/bin/spm-exec`, a setuid-root binary
  installed by SPM, which checks `real-start-stop-status.sig` (a JSON file with the script's
  SHA-256 and an OpenPGP signature) and then runs `real-start-stop-status` as root;
- the signature was made on 2026-09-07 with RSA key
  `E38C0638527CF10A5FFB62D9677D7DC366037538`, which spm-exec trusts and which has since expired,
  so spm-exec refuses every start.

So the failure mode is "a third-party privilege broker with a time-limited key", not DSM codesign.

Decision:

- **No dependency on SPM or any other privilege broker.** How our ZeroTier gets the rights it
  needs (`/dev/net/tun`, network configuration) is an open design point, settled on a real NAS
  before release; whatever we choose must not stop working on a date.
- **Packages reach DSM without `syno_signature.asc`.** DSM 7 gives it no trust, and the indexer
  rejects any SPK that carries one, so a re-signed upstream package cannot slip in.
- **The MTSistemi signature lives in the supply chain**, where it can be verified by anyone:
  - every SPK we build gets a GitHub **build provenance attestation** (Sigstore, keyless,
    bound to the MTSistemi repository and workflow);
  - every release carries a `SHA256SUMS` manifest with a detached signature made by the
    MTSistemi release key;
  - the server verifies both before a package is published, and the web interface shows the
    result on every package page, with the commands to check it by hand.
- Integrity on the NAS side comes from what DSM does check: the `md5` and `size` in the catalog
  must match the downloaded file.

## 3. Components

```
spkforge/
├─ packages/spk/      SPK library: read INFO, icons and file list from an .spk (tar), checksums
├─ packages/server/   HTTP server: DSM catalog endpoint, public API, admin API, indexer
├─ packages/web/      Web interface (React, bilingual en/it)
├─ recipes/zerotier/  How the ZeroTier SPK is built: cross-compile, layout, scripts
├─ docs/en, docs/it   Documentation, English and Italian
└─ .github/workflows  CI, package builds, releases, attestations
```

Language and runtime: TypeScript on Node.js 24 for both server and interface, one toolchain.
SQLite through the built-in `node:sqlite`, so there are no native modules to compile. The server
ships as one container image and as a plain Node application.

### 3.1 DSM catalog endpoint

Package Center calls the source URL with GET or POST and these fields (observed on DSM 7.2):

| Field | Example | Use |
|---|---|---|
| `arch` | `geminilake` | platform; mapped to its family (x86_64, armv8, armv7) |
| `unique` | `synology_geminilake_723p` | model hint, also used for statistics |
| `major`, `minor`, `micro` | `7`, `2`, `2` | DSM version |
| `build`, `nano` | `72806`, `10` | DSM build and update |
| `language` | `ita`, `enu` | localised `dname`, `desc`, `changelog` |
| `package_update_channel` | `stable`, `beta` | beta packages only on `beta` |
| `timezone` | `Rome` | ignored |

The answer is `{"packages": [...]}`, one entry per package: the newest version that fits the
platform and DSM build. Entry fields: `package`, `version`, `dname`, `desc`, `changelog`, `link`,
`md5`, `size`, `thumbnail`, `thumbnail_retina`, `snapshot`, `qinst`, `qstart`, `qupgrade`,
`deppkgs`, `conflictpkgs`, `startable`, `maintainer`, `maintainer_url`, `distributor`,
`distributor_url`, `download_count`, `recent_download_count`, `beta`.

Selection rules:

1. the package's INFO `arch` contains the platform, its family, or `noarch`;
2. `os_min_ver` ≤ the NAS DSM version, and `os_max_ver`, when set, ≥ it;
3. beta versions only when the channel is `beta`;
4. among what is left, the highest version wins (Synology version ordering: `1.16.2-3` > `1.16.2-2`).

### 3.2 Web interface

Bilingual (English and Italian), following the browser, with a switch. Light and dark themes.
Public side:

- catalog with search, filter by model or architecture, DSM version and channel;
- package page: description, changelog, versions per architecture, downloads, checksums,
  provenance and signature status, and the copy-and-paste commands to verify them;
- "Add this source to your NAS": the URL plus the steps in Package Center, per DSM version;
- a "which package fits my NAS" helper: pick the model, see what installs.

Admin side (behind login):

- upload an SPK, or import one from a GitHub release;
- index status, verification results, rejected packages and why;
- promote a version from beta to stable, withdraw a version;
- download statistics per package, version, architecture and DSM build.

### 3.3 ZeroTier recipe

- Source: the upstream ZeroTierOne tag, client only (MPL-2.0 code; `nonfree/` is not built).
- Static binaries for the DSM 7 families: x86_64, armv8 (aarch64), armv7.
- One SPK per family, version `<upstream>-<build>`, e.g. `1.16.2-1`.
- Built in GitHub Actions on every new upstream tag, attested, signed, released.

Open technical points, to settle on a real NAS before the first release:

- how the package gets root and `/dev/net/tun` under DSM 7 privilege rules without a privilege
  broker (the imnks package used SPM, see 2.1);
- upgrade path from the old `zerotier` package: same package name, keep `/volume1/@appdata/zerotier`
  (identity and networks) so the node ID does not change.

## 4. Repository rules

- Code, identifiers, file names, comments, commit messages: English.
- User-facing text (interface, documentation): English and Italian, kept in step.
- Public repository under the `MTSistemi` GitHub account; commits authored as
  `info@mtsistemi.it`.

### 3.4 Community publication

The ZeroTier package must also reach everyone through the community sources, not only through
SpkForge: the recipe is contributed to SynoCommunity (`SynoCommunity/spksrc`, a `cross/` and an
`spk/` recipe), which builds and hosts it. That contribution follows spksrc's own licence
(BSD-3-Clause), as spksrc requires.

## 5. Decisions taken

- Name: **SpkForge**. Licence: **AGPL-3.0-or-later**, copyright MTSistemi. Contributions are
  accepted under a contributor licence agreement, so MTSistemi can also offer other licences.
- Repository: public, `github.com/MTSistemi/SpkForge` only.

## 6. Open decisions

- Where the public instance runs, and on which domain.
- MTSistemi release key: creating it is a deliberate step, done with Mattia.
