# zt-syno-net — ZeroTier per Synology DSM 7

[English](../en/zt-syno-net.md) | Italiano

zt-syno-net è ZeroTier One, compilato senza modifiche dai sorgenti upstream, impacchettato per ogni
NAS Synology con DSM 7: Intel e AMD (x86_64), ARM a 64 bit (armv8), ARM a 32 bit (armv7) e Intel
Atom a 32 bit (i686).

Gira **senza root**, **non dipende da nessun altro pacchetto** e **si rimette in piedi da solo**:
niente SimplePermissionManager, niente intermediari di privilegi, niente che possa smettere di
funzionare a una data.

## Quale file

| File | Per |
|---|---|
| `zt-syno-net_universal_<versione>.spk` | qualunque modello con DSM 7; sceglie la build giusta all'avvio. Nel dubbio, questo. |
| `zt-syno-net_x86_64_<versione>.spk` | modelli Intel e AMD |
| `zt-syno-net_armv8_<versione>.spk` | modelli ARM a 64 bit (Realtek RTD1296/RTD1619B, Marvell Armada 37xx) |
| `zt-syno-net_armv7_<versione>.spk` | modelli ARM a 32 bit (Armada 38x, Alpine, Monaco) |
| `zt-syno-net_i686_<versione>.spk` | modelli Intel Atom a 32 bit (evansport) |

## Installazione

1. Arrivi dal vecchio pacchetto `zerotier` (spk7.imnks.com)? **Disinstallalo prima.** Identità e
   reti restano su disco e vengono spostate da sole, così il node ID non cambia.
2. Centro pacchetti > Installazione manuale > il file `.spk`.
3. La procedura chiede un ID di rete (facoltativo) e, al passo **Avvio automatico e guardia**, la
   tua password di DSM. Serve a DSM per creare l'unica attività che gira come root, "zt-syno-net",
   nell'Utilità di pianificazione. È tutto qui: l'attività viene creata e avviata subito.
4. Autorizza il nodo nel tuo controller ZeroTier.

## Perché un'attività di root, e cosa fa

DSM 7 non concede a un pacchetto di terze parti né l'esecuzione come root né le capability di
rete: lo abbiamo verificato, DSM rifiuta il pacchetto ("ctrl-script ... should not exist", "tool
capabilities should not exist"). ZeroTier però ha bisogno di `/dev/net/tun` e di `CAP_NET_ADMIN`.
L'attività "zt-syno-net" avvia un piccolo guardiano che:

- ogni 5 secondi carica il modulo `tun` e dà `CAP_NET_ADMIN` all'eseguibile di ZeroTier, anche
  **dopo ogni aggiornamento** (così un aggiornamento ferma ZeroTier solo per pochi secondi);
- sposta una volta sola l'identità e le reti di un vecchio pacchetto ZeroTier, appena quel
  ZeroTier non è più in esecuzione. Fino ad allora il pacchetto non parte: uno ZeroTier senza la
  vecchia identità ne creerebbe una nuova, e il nodo comparirebbe con un indirizzo sconosciuto
  alle sue reti. Se il vecchio ZeroTier è ancora acceso, l'avvio del pacchetto fallisce con un
  messaggio che lo spiega;
- ogni 30 secondi avvia il pacchetto se DSM lo vuole acceso ed è fermo.

Il testo del guardiano sta **dentro l'attività**, conservata da DSM come root: root non esegue mai
file che il pacchetto può modificare. Dentro il pacchetto, un supervisore senza privilegi riavvia
ZeroTier se si ferma o smette di rispondere (controlla sia lo stato del nodo sia l'elenco delle
reti).

### Uscire da una rete

L'app esce da una rete fermando ZeroTier, dimenticando quella rete e riavviandolo: le altre reti si
interrompono per qualche secondo. La via diretta (`zerotier-cli leave` o l'API locale) è evitata di
proposito: con ZeroTier 1.16 sul kernel 4.4 di DSM blocca il daemon fino al riavvio, quindi non va
usata nemmeno da SSH.

La disinstallazione rimuove l'attività. Identità e reti restano in
`/var/packages/zt-syno-net/var`, così una reinstallazione mantiene lo stesso node ID.

## Uso

Da SSH, come amministratore (`sudo`):

```
sudo zerotier-cli info
sudo zerotier-cli join <id-rete>
sudo zerotier-cli listnetworks
```

## Quando non parte

- `/var/packages/zt-syno-net/var/zt-syno-net.log`: avvio, supervisore, riavvii.
- `/var/log/zt-syno-net-guard.log`: il guardiano di root.
- Se nell'Utilità di pianificazione non c'è l'attività "zt-syno-net" (per esempio hai tolto la
  spunta durante l'installazione), creala a mano: Attività attivata > Script definito dall'utente,
  utente `root`, evento `Avvio`, poi Esegui. Usa il comando mostrato dalla procedura di
  installazione: copia il launcher in `/run`, ne verifica lo SHA-256 rispetto a questa build e solo
  allora lo esegue, così root non esegue mai un file che il pacchetto può modificare. Il comando
  cambia a ogni build: dopo un aggiornamento va aggiornata l'attività. La creazione automatica fa
  tutto questo da sola.
