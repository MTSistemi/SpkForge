ZeroTier One @ZEROTIER@ for Synology DSM 7, packaged by SpkForge. Italiano più sotto.

## Which file

| Your NAS | File |
|---|---|
| Intel or AMD CPU (most "+" models, e.g. DS920+, DS1522+) | `zt-syno-net_x86_64_@VERSION@.spk` |
| 64-bit ARM (e.g. DS223, DS223j, DS220j, DS218) | `zt-syno-net_armv8_@VERSION@.spk` |
| 32-bit ARM (older "j" and value models) | `zt-syno-net_armv7_@VERSION@.spk` |
| Intel Atom 32-bit (old models) | `zt-syno-net_i686_@VERSION@.spk` |
| Not sure | `zt-syno-net_universal_@VERSION@.spk` (all four, picks the right one) |

## Install

1. Package Center > Manual Install > choose the file > Next.
2. Optionally enter the ID of the network to join.
3. **Automatic start and guard**: leave the box ticked and type your DSM password. The package
   creates one boot-up task that runs as root: DSM 7 gives third-party packages no other way to
   get the network permission ZeroTier needs. No other package is needed.
4. Open **ZeroTier** from the main menu to see the node ID and join or leave networks, then
   authorise the node in your network controller.

Coming from the old `zerotier` package (e.g. from spk7.imnks.com) or from SynoCommunity's
`zerotier-one`? **Uninstall it first.** Its identity and networks stay on disk and are moved over
automatically, so the node ID does not change. Running ZeroTier's Docker image
(`zerotier/zerotier-synology`) instead? **Stop the container first**: its identity is taken over from
`/volume1/docker/zerotier-one`, `/volume1/docker/zerotier` or `/var/lib/zerotier-one`; remove the
container once ZeroTier is back.

Notes: leaving a network restarts ZeroTier, so other networks pause for a few seconds. After an
upgrade, reload the DSM page if the ZeroTier window does not open.

## Verify

```sh
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify zt-syno-net_x86_64_@VERSION@.spk --repo @REPO@
```

The attestation proves the file was built by this repository's GitHub Actions from the tagged
source. ZeroTier One is © ZeroTier, Inc., MPL-2.0, built unmodified from upstream tag @ZEROTIER@;
this package is not made or endorsed by ZeroTier, Inc. Packaging: AGPL-3.0-or-later.

---

ZeroTier One @ZEROTIER@ per Synology DSM 7, impacchettato da SpkForge.

## Quale file

| NAS | File |
|---|---|
| CPU Intel o AMD (gran parte dei modelli "+", es. DS920+, DS1522+) | `zt-syno-net_x86_64_@VERSION@.spk` |
| ARM a 64 bit (es. DS223, DS223j, DS220j, DS218) | `zt-syno-net_armv8_@VERSION@.spk` |
| ARM a 32 bit (modelli "j" e value più vecchi) | `zt-syno-net_armv7_@VERSION@.spk` |
| Intel Atom a 32 bit (modelli vecchi) | `zt-syno-net_i686_@VERSION@.spk` |
| CPU non nota | `zt-syno-net_universal_@VERSION@.spk` (tutti e quattro, sceglie da solo) |

## Installazione

1. Centro pacchetti > Installazione manuale > file `.spk` > Avanti.
2. Facoltativo: l'ID della rete a cui collegare il NAS.
3. **Avvio automatico e guardiano**: con la spunta lasciata, va inserita la password DSM
   dell'amministratore. Il pacchetto
   crea un'attività all'avvio eseguita da root: DSM 7 non offre ai pacchetti di terze parti altri
   modi per avere il permesso di rete che serve a ZeroTier. Non servono altri pacchetti.
4. L'app **ZeroTier** nel menu principale mostra l'ID del nodo e collega o scollega le reti; il nodo
   va poi autorizzato nel controller della rete.

Se è installato il vecchio pacchetto `zerotier` (per esempio da spk7.imnks.com) o `zerotier-one` di
SynoCommunity, va **disinstallato prima**. Identità e reti restano sul disco e vengono trasferite in
automatico, così l'ID del nodo non cambia. Se ZeroTier gira invece nel container Docker
(`zerotier/zerotier-synology`), va **fermato prima il container**: l'identità viene presa da
`/volume1/docker/zerotier-one`, `/volume1/docker/zerotier` o `/var/lib/zerotier-one`; il container si
rimuove quando ZeroTier è tornato su.

Note: scollegare una rete riavvia ZeroTier, quindi le altre reti si fermano per qualche secondo.
Dopo un aggiornamento, se la finestra di ZeroTier non si apre, va ricaricata la pagina del DSM.

## Verifica

```sh
sha256sum -c SHA256SUMS --ignore-missing
gh attestation verify zt-syno-net_x86_64_@VERSION@.spk --repo @REPO@
```

L'attestazione dimostra che il file è stato costruito dalle GitHub Actions di questo repository a
partire dai sorgenti del tag. ZeroTier One è © ZeroTier, Inc., MPL-2.0, compilato senza modifiche
dal tag upstream @ZEROTIER@; questo pacchetto non è realizzato né approvato da ZeroTier, Inc.
Impacchettamento: AGPL-3.0-or-later.
