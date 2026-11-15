# SpkForge — progetto

[English](../en/design.md) | Italiano

Stato: bozza, 15/11/2026.

## 1. Perché esiste

La sorgente di pacchetti comunitaria più nota per Synology DSM 7, *我不是矿神* (spk7.imnks.com),
ha chiuso il 1° novembre 2026. Il suo software server, `tbc0309/sspks-imnks`, resta su GitHub
sotto GPL-3.0. Le conseguenze che ci toccano direttamente sono due:

1. **Non esiste più uno ZeroTier nativo per DSM 7.** ZeroTier pubblica per DSM 7 solo una ricetta
   Docker (`pkg/synology/dsm7-docker`) e SynoCommunity ZeroTier non lo distribuisce affatto.
2. **I suoi pacchetti muoiono quando scade una chiave di firma.** Il 15/11/2026 un NAS con DSM
   7.2.2 si è riavviato e non è riuscito ad avviare il pacchetto ZeroTier 1.14.2: `verify signature
   failed: openpgp: key expired`, poi `real-start-stop-status signature is not match`. Ogni NAS con
   lo ZeroTier di quella sorgente (1.14.2 o 1.16.2) lo perde al primo riavvio del pacchetto o del
   NAS. Dove sta davvero quella firma è spiegato al punto 2.1.

Costruiamo una sorgente di pacchetti nostra, scritta da zero e di proprietà di MTSistemi. È
pubblicata in forma pubblica su GitHub, ha un'interfaccia web di primo livello e il suo primo
pacchetto è ZeroTier all'ultima release upstream (1.16.2 nel momento in cui scriviamo).

Il dominio originale resta registrato fino al 16/11/2029, poi viene rilasciato. Ogni NAS che ha
ancora spk7.imnks.com fra le sorgenti va ripulito prima di allora: chi registrerà il dominio dopo
potrebbe distribuirgli pacchetti.

## 2. Cosa vuol dire "firmato MTSistemi" su DSM 7

La DSM 7 Developer Guide di Synology elenca fra le modifiche del Centro pacchetti "Remove keyring"
e "Remove trust level": il meccanismo di firma degli SPK è deprecato. Un pacchetto di terze parti
si installa dopo l'avviso "non verificato da Synology", firmato o no.

### 2.1 Il guasto del 15/11/2026 non era la firma di DSM

L'ispezione di due NAS colpiti (in sola lettura, 15/11/2026) ha mostrato che la firma scaduta è di
**SimplePermissionManager** (SPM, maintainer "Jim Ma"), un pacchetto di supporto su cui lo ZeroTier
di imnks si appoggiava per girare da root:

- il `conf/privilege` del pacchetto dice `"run-as": "package"`, come DSM 7 richiede;
- il suo `scripts/start-stop-status` passa la mano a `/usr/local/bin/spm-exec`, un eseguibile
  setuid root installato da SPM, che controlla `real-start-stop-status.sig` (un JSON con lo SHA-256
  dello script e una firma OpenPGP) e poi esegue `real-start-stop-status` da root;
- la firma è stata fatta il 07/09/2026 con la chiave RSA
  `E38C0638527CF10A5FFB62D9677D7DC366037538`, di cui spm-exec si fida e che nel frattempo è
  scaduta, quindi spm-exec rifiuta ogni avvio.

Il modo di guasto è quindi "un intermediario di privilegi di terze parti con una chiave a
scadenza", non la firma di DSM.

Decisione:

- **Nessuna dipendenza da altri pacchetti** (Mattia, 15/11/2026): né SPM, né altri intermediari
  di privilegi, nessun `install_dep_packages`. Solo ciò che DSM fornisce più i nostri eseguibili.
- **Nessuna dipendenza da SPM o da altri intermediari di privilegi.** Come il nostro ZeroTier
  ottiene i diritti che gli servono (`/dev/net/tun`, configurazione di rete) è un punto aperto, da
  chiudere su un NAS vero prima del rilascio; qualunque scelta non deve smettere di funzionare a
  una data.
- **I pacchetti arrivano a DSM senza `syno_signature.asc`.** DSM 7 non le dà alcuna fiducia, e
  l'indicizzatore rifiuta qualunque SPK che ne contenga una, così un pacchetto upstream rifirmato
  non può passare.
- **La firma MTSistemi sta nella filiera**, dove chiunque la può verificare:
  - ogni SPK che costruiamo riceve un'**attestazione di provenienza** GitHub (Sigstore, senza
    chiave, legata al repository e al workflow MTSistemi);
  - ogni release porta un manifest `SHA256SUMS` con una firma separata fatta con la chiave di
    rilascio MTSistemi;
  - il server le verifica entrambe prima di pubblicare un pacchetto, e l'interfaccia web mostra
    l'esito in ogni pagina di pacchetto, con i comandi per controllarlo a mano.
- L'integrità lato NAS viene da ciò che DSM controlla davvero: `md5` e `size` del catalogo devono
  corrispondere al file scaricato.

## 3. Componenti

```
spkforge/
├─ packages/spk/      Libreria SPK: legge INFO, icone ed elenco file da un .spk (tar), checksum
├─ packages/server/   Server HTTP: endpoint catalogo DSM, API pubblica, API admin, indicizzatore
├─ packages/web/      Interfaccia web (React, bilingue en/it)
├─ recipes/zt-syno-net/  Il pacchetto ZeroTier (zt-syno-net): build, struttura, script
├─ docs/en, docs/it   Documentazione, inglese e italiano
└─ .github/workflows  CI, build dei pacchetti, release, attestazioni
```

Linguaggio e runtime: TypeScript su Node.js 24 per server e interfaccia, una sola toolchain.
SQLite tramite il `node:sqlite` integrato, quindi nessun modulo nativo da compilare. Il server si
distribuisce come immagine container e come normale applicazione Node.

### 3.1 Endpoint catalogo DSM

Il Centro pacchetti chiama l'URL della sorgente in GET o POST con questi campi (osservati su DSM
7.2):

| Campo | Esempio | Uso |
|---|---|---|
| `arch` | `geminilake` | piattaforma; ricondotta alla famiglia (x86_64, armv8, armv7) |
| `unique` | `synology_geminilake_723p` | indizio sul modello, usato anche per le statistiche |
| `major`, `minor`, `micro` | `7`, `2`, `2` | versione DSM |
| `build`, `nano` | `72806`, `10` | build e update DSM |
| `language` | `ita`, `enu` | `dname`, `desc`, `changelog` localizzati |
| `package_update_channel` | `stable`, `beta` | i pacchetti beta solo su `beta` |
| `timezone` | `Rome` | ignorato |

La risposta è `{"packages": [...]}`, una voce per pacchetto: la versione più recente adatta alla
piattaforma e alla build DSM. Campi della voce: `package`, `version`, `dname`, `desc`,
`changelog`, `link`, `md5`, `size`, `thumbnail`, `thumbnail_retina`, `snapshot`, `qinst`,
`qstart`, `qupgrade`, `deppkgs`, `conflictpkgs`, `startable`, `maintainer`, `maintainer_url`,
`distributor`, `distributor_url`, `download_count`, `recent_download_count`, `beta`.

Regole di scelta:

1. l'`arch` nell'INFO del pacchetto contiene la piattaforma, la sua famiglia oppure `noarch`;
2. `os_min_ver` ≤ versione DSM del NAS e, se presente, `os_max_ver` ≥ quella versione;
3. versioni beta solo quando il canale è `beta`;
4. fra quelle rimaste vince la versione più alta (ordinamento Synology: `1.16.2-3` > `1.16.2-2`).

### 3.2 Interfaccia web

Bilingue (inglese e italiano), segue il browser e ha un selettore. Tema chiaro e scuro.
Lato pubblico:

- catalogo con ricerca, filtro per modello o architettura, versione DSM e canale;
- pagina del pacchetto: descrizione, changelog, versioni per architettura, download, checksum,
  stato di provenienza e firma, e i comandi da copiare per verificarli;
- "Aggiungi questa sorgente al tuo NAS": l'URL più i passi nel Centro pacchetti, per versione DSM;
- un aiuto "quale pacchetto va sul mio NAS": si sceglie il modello e si vede cosa si installa.

Lato amministrazione (dietro login):

- caricare uno SPK, o importarlo da una release GitHub;
- stato dell'indice, esiti delle verifiche, pacchetti rifiutati e perché;
- promuovere una versione da beta a stabile, ritirare una versione;
- statistiche di download per pacchetto, versione, architettura e build DSM.

### 3.3 Pacchetto ZeroTier: zt-syno-net

- Sorgente: il tag upstream di ZeroTierOne, solo client (codice MPL-2.0; `nonfree/` non si
  compila).
- Nome del pacchetto `zt-syno-net` (guida: [zt-syno-net.md](zt-syno-net.md)).
- Binari statici per ogni famiglia di CPU con DSM 7: x86_64 (Intel e AMD), armv8, armv7, i686;
  più un pacchetto universale noarch con tutti e quattro, che sceglie quello giusto all'avvio e
  si installa su qualunque modello, anche su piattaforme che mancano dal nostro elenco.
- Uno SPK per famiglia più quello universale, versione `<upstream>-<build>`, per esempio
  `1.16.2-1`.
- Gira come utente del pacchetto con `CAP_NET_ADMIN`, concessa da un'attività all'avvio come
  root che l'utente crea una volta nell'Utilità di pianificazione (`bin/zt-syno-net-setup`);
  la stessa attività migra l'identità del vecchio pacchetto `zerotier`, così il node ID non
  cambia.
- Costruiti in GitHub Actions a ogni nuovo tag upstream, attestati, firmati, rilasciati.

Punti tecnici aperti, da chiudere su un NAS vero prima della prima release:

- come il pacchetto ottiene root e `/dev/net/tun` con le regole sui privilegi di DSM 7 senza un
  intermediario di privilegi (il pacchetto di imnks usava SPM, vedi 2.1);
- percorso di aggiornamento dal vecchio pacchetto `zerotier`: stesso nome di pacchetto, conservare
  `/volume1/@appdata/zerotier` (identità e reti) così il node ID non cambia.

## 4. Regole del repository

- Codice, identificatori, nomi dei file, commenti, messaggi di commit: inglese.
- Testi per l'utente (interfaccia, documentazione): inglese e italiano, allineati.
- Repository pubblico sull'account GitHub `MTSistemi`; commit con autore `info@mtsistemi.it`.

### 3.4 Pubblicazione nella community

Il pacchetto ZeroTier deve arrivare a tutti anche dalle sorgenti della community, non solo da
SpkForge: la ricetta si contribuisce a SynoCommunity (`SynoCommunity/spksrc`, una ricetta `cross/`
e una `spk/`), che la costruisce e la distribuisce. Quel contributo segue la licenza di spksrc
(BSD-3-Clause), come spksrc richiede.

## 5. Decisioni prese

- Nome: **SpkForge**. Licenza: **AGPL-3.0-or-later**, copyright MTSistemi. I contributi si
  accettano con un accordo di licenza (CLA), così MTSistemi può offrire anche altre licenze.
- Repository: pubblico, solo `github.com/MTSistemi/SpkForge`.

## 6. Decisioni aperte

- Dove gira l'istanza pubblica, e su quale dominio.
- Chiave di rilascio MTSistemi: crearla è un passo deliberato, da fare con Mattia.
