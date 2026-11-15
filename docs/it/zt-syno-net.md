# zt-syno-net — ZeroTier per Synology DSM 7

[English](../en/zt-syno-net.md) | Italiano

zt-syno-net è ZeroTier One, compilato senza modifiche dai sorgenti upstream, impacchettato per ogni
NAS Synology con DSM 7: Intel e AMD (x86_64), ARM a 64 bit (armv8), ARM a 32 bit (armv7) e Intel
Atom a 32 bit (i686).

Gira **senza root** e **non dipende da nessun altro pacchetto**: niente SimplePermissionManager,
niente intermediari di privilegi, niente che possa smettere di funzionare a una data.

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
   reti restano su disco; il passo 3 le sposta, così il node ID non cambia.
2. Centro pacchetti > Installazione manuale > il file `.spk`. La procedura chiede un ID di rete,
   facoltativo.
3. **Configurazione una tantum, come root.** Pannello di controllo > Utilità di pianificazione >
   Crea > Attività attivata > Script definito dall'utente. Utente: `root`. Evento: `Avvio`.
   Comando:

   ```
   /bin/sh /var/packages/zt-syno-net/target/bin/zt-syno-net-setup
   ```

   Salva, seleziona l'attività, **Esegui**. Carica `tun`, dà `CAP_NET_ADMIN` all'eseguibile di
   ZeroTier, migra un'identità precedente se c'è, e avvia il pacchetto.
4. Autorizza il nodo nel tuo controller ZeroTier.

Dopo **ogni aggiornamento** di zt-syno-net esegui di nuovo l'attività: l'aggiornamento sostituisce
l'eseguibile e le sue capability.

## Uso

Da SSH, come qualunque amministratore:

```
/var/packages/zt-syno-net/target/bin/zerotier-cli info
/var/packages/zt-syno-net/target/bin/zerotier-cli join <id-rete>
/var/packages/zt-syno-net/target/bin/zerotier-cli listnetworks
```

I dati (identità, reti) stanno in `/var/packages/zt-syno-net/var` e sopravvivono alla
disinstallazione.

## Quando non parte

`/var/packages/zt-syno-net/var/zt-syno-net.log` dice perché. Quasi sempre: l'attività all'avvio non
è stata eseguita dopo l'ultima installazione o aggiornamento. `setup.log`, nella stessa cartella,
registra l'attività stessa.

L'attività rifiuta di migrare un'identità mentre un altro `zerotier-one` è in esecuzione, perché due
servizi con la stessa identità si buttano fuori dalla rete a vicenda. Ferma prima quello vecchio.
