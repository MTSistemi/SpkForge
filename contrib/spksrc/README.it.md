# zt-syno-net per SynoCommunity (spksrc)

[English](README.md) | Italiano

Questa cartella è la ricetta che contribuiamo a [SynoCommunity/spksrc](https://github.com/SynoCommunity/spksrc),
così ZeroTier arriva a tutti i possessori di un Synology dalla sorgente di pacchetti della
community, non solo da SpkForge. Ricalca la struttura di spksrc:

| Percorso | Cosa contiene |
|---|---|
| `cross/zerotier/` | compila ZeroTierOne (solo client, MPL-2.0) con i toolchain di Synology |
| `spk/zt-syno-net/` | il pacchetto: definizione del servizio, attività root di preparazione, wrapper della CLI, regola firewall, procedure guidate, icona |
| `generate.ts` | rigenera icona e procedure guidate EN/IT dai sorgenti di SpkForge |

Una volta accolta in spksrc, la ricetta ne segue la licenza (BSD-3-Clause).

## Perché adesso può essere accettata

SynoCommunity ha una richiesta aperta per ZeroTier dal 2016 (issue 2490). Un tentativo del 2018
(PR 3458) si è fermato perché ZeroTier "deve girare come root". Questa ricetta non fa girare niente
come root durante il funzionamento:

- il servizio gira come `sc-zt-syno-net` (`SERVICE_USER = auto`) con `zerotier-one -U`;
- gli unici privilegi che servono, `CAP_NET_ADMIN`/`CAP_NET_RAW` sul suo eseguibile e
  `/dev/net/tun`, li concede `bin/zt-syno-net-setup`, che l'utente esegue come root da
  un'attività all'avvio di DSM (lo stesso schema che documenta il pacchetto DSM di Tailscale);
- nessuna dipendenza da altri pacchetti, nessun intermediario di privilegi, nessuna firma che
  possa scadere.

## Costruirla come fa SynoCommunity

Il workflow `spksrc recipe` di questo repository copia la ricetta in un checkout pulito di spksrc
e la costruisce nell'immagine ufficiale `ghcr.io/synocommunity/spksrc` per x64, aarch64, armv7 ed
evansport (DSM 7.1) e x64 (DSM 7.2). A mano, in un checkout di spksrc:

```
cp -r contrib/spksrc/cross/zerotier spksrc/cross/
cp -r contrib/spksrc/spk/zt-syno-net spksrc/spk/
cd spksrc && make setup
make -C cross/zerotier digests
make -C spk/zt-syno-net arch-x64-7.2
```

## Invio

Non ancora inviata: aprire la pull request è una decisione di MTSistemi. La bozza (in inglese, come
richiede spksrc) è nel [README inglese](README.md#submitting).
