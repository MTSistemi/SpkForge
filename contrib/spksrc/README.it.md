# zerotier-one per SynoCommunity (spksrc)

[English](README.md) | Italiano

Questa cartella è la ricetta che contribuiamo a [SynoCommunity/spksrc](https://github.com/SynoCommunity/spksrc),
così ZeroTier arriva a tutti i possessori di un Synology dalla sorgente di pacchetti della
community, non solo da SpkForge. Ricalca la struttura di spksrc:

| Percorso | Cosa contiene |
|---|---|
| `cross/zerotier/` | compila ZeroTierOne (solo client, MPL-2.0) con i toolchain di Synology |
| `spk/zerotier-one/` | il pacchetto: definizione del servizio, supervisore, wrapper della CLI, regola firewall, procedure guidate, app DSM, icona |
| `generate.ts` | rigenera icona, procedure guidate EN/IT, launcher del guardiano e app DSM dai sorgenti di SpkForge |

Una volta accolta in spksrc, la ricetta ne segue la licenza (BSD-3-Clause).

## Nome del pacchetto

In SynoCommunity il pacchetto si chiama **`zerotier-one`**, come il programma a monte. Il nome è
volutamente diverso da quello degli altri due pacchetti ZeroTier che si trovano sui NAS Synology:

- `zerotier`: il vecchio pacchetto della community (spk7.imnks.com, chiusa a novembre 2026), di cui
  molti NAS hanno ancora `/var/packages/zerotier`;
- `zt-syno-net`: la build SpkForge dello stesso codice.

Con lo stesso nome il Centro pacchetti proporrebbe l'uno come aggiornamento dell'altro, con utenti
del pacchetto diversi. Ciascuno dei tre cede la propria identità agli altri: il guardiano prende
identità e reti degli altri due, così il NAS mantiene l'ID del nodo passando dall'uno all'altro.

## Perché adesso può essere accettata

SynoCommunity ha una richiesta aperta per ZeroTier dal 2016 (issue 2490). Un tentativo del 2018
(PR 3458) si è fermato perché ZeroTier "deve girare come root". Questo pacchetto non fa girare
niente come root:

- il servizio gira come `sc-zerotier-one` (`SERVICE_USER = auto`) con `zerotier-one -U`, sotto un
  supervisore che lo riavvia se termina o smette di rispondere;
- servono `/dev/net/tun` e `CAP_NET_ADMIN`/`CAP_NET_RAW` sul proprio eseguibile. DSM 7 non dà ai
  pacchetti di terze parti alcun modo di ottenerli, quindi la procedura di installazione crea, con
  la password dell'amministratore, una sola attività all'avvio eseguita da root. L'attività contiene
  il testo di un piccolo guardiano, così root non esegue mai file che il pacchetto può modificare.
  Il guardiano carica `tun`, ridà la capability dopo ogni installazione o aggiornamento, prende
  l'identità di un pacchetto ZeroTier precedente e avvia il pacchetto quando DSM lo vuole acceso.
  La procedura di disinstallazione rimuove l'attività. Per chi preferisce creare l'attività a mano,
  la procedura descrive anche la configurazione manuale;
- nessuna dipendenza da altri pacchetti, nessun intermediario di privilegi, nessuna firma che possa
  scadere.

## Compilarla come fa SynoCommunity

Il workflow `spksrc recipe` di questo repository copia la ricetta in un checkout pulito di spksrc
e la compila nell'immagine ufficiale `ghcr.io/synocommunity/spksrc` per x64, aarch64, armv7 ed
evansport (DSM 7.1) e x64 (DSM 7.2). A mano, in un checkout di spksrc:

```
cp -r contrib/spksrc/cross/zerotier spksrc/cross/
cp -r contrib/spksrc/spk/zerotier-one spksrc/spk/
cd spksrc && make setup
make -C cross/zerotier digests
make -C spk/zerotier-one arch-x64-7.2
```

## Prove fatte

- Il 16/11/2026 la build spksrc x64-7.2 (allora ancora `zt-syno-net`, revisione 3) è stata
  installata su DSM 7.2.2-72806 (DS723+ virtuale) al posto di uno ZeroTier esistente: il guardiano
  ha preso da solo la vecchia identità, la rete è tornata con lo stesso indirizzo e l'app DSM
  funzionava.
- Le procedure di installazione e aggiornamento (stesso codice) sono state provate dal Centro
  pacchetti con la build SpkForge su DSM 7.2.2-72806 x86_64 e DSM build 90075 ARMv8.
- Non ancora installata: la build con il nome definitivo `zerotier-one`.

## Invio

Non ancora inviata: aprire la pull request è una decisione di MTSistemi. Il testo proposto è in
inglese, nel [README](README.md#submitting).
