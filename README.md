# SpkForge

English | [Italiano](README.it.md)

A package source for Synology DSM 7, with a web interface, written from scratch by MTSistemi.
Its first package is ZeroTier, built from the latest upstream release.

> Status: early development — not ready for use.

## Why

The community source *我不是矿神* (spk7.imnks.com) closed on 2026-11-01, and with it the only
native ZeroTier package for DSM 7. Packages signed with its key also stop starting once that key
expires. See [the design](docs/en/design.md) for the full reasoning, including what "signed" can
and cannot mean on DSM 7.

## Layout

| Path | What |
|---|---|
| `packages/spk` | Read and write SPK archives: INFO, icons, file list, checksums |
| `packages/server` | DSM Package Center endpoint, public and admin API |
| `packages/web` | Web interface, English and Italian |
| `recipes/zerotier` | Build recipe for the ZeroTier SPK |
| `docs/en`, `docs/it` | Documentation |

## Development

Requires Node.js 24 or later.

```bash
npm install
npm run check
```

## License

Copyright (C) 2026 MTSistemi.

SpkForge is free software, released under the [GNU Affero General Public License v3.0 or later](LICENSE).
