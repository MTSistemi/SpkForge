# SpkForge

[English](README.md) | Italiano

Una sorgente di pacchetti per Synology DSM 7, con interfaccia web, scritta da zero da MTSistemi.
Il primo pacchetto è ZeroTier, costruito dall'ultima release upstream.

> Stato: sviluppo iniziale, non ancora utilizzabile.

## Perché

La sorgente comunitaria *我不是矿神* (spk7.imnks.com) ha chiuso il 1° novembre 2026, e con lei
l'unico pacchetto ZeroTier nativo per DSM 7. In più, i pacchetti firmati con la sua chiave non
partono più quando quella chiave scade. Il ragionamento completo è nel [documento di
progetto](docs/it/design.md), compreso cosa può e non può voler dire "firmato" su DSM 7.

## Struttura

| Percorso | Cosa contiene |
|---|---|
| `packages/spk` | Lettura e scrittura degli archivi SPK: INFO, icone, elenco file, checksum |
| `packages/server` | Endpoint per il Centro pacchetti DSM, API pubblica e di amministrazione |
| `packages/web` | Interfaccia web, inglese e italiano |
| `recipes/zt-syno-net` | zt-syno-net: ZeroTier per ogni CPU con DSM 7 ([documentazione](docs/it/zt-syno-net.md)) |
| `docs/en`, `docs/it` | Documentazione |

## Sviluppo

Serve Node.js 24 o successivo.

```bash
npm install
npm run check
```

## Licenza

Copyright (C) 2026 MTSistemi.

SpkForge è software libero, rilasciato con la [GNU Affero General Public License v3.0 o successiva](LICENSE).
