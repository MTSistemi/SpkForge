// Install and upgrade wizard pages for zt-syno-net, in English and Italian.
// DSM picks WIZARD_UIFILES/<name>_<lang> when it exists, else <name>.

const SETUP_COMMAND = '/bin/sh /var/packages/zt-syno-net/target/bin/zt-syno-net-setup';

interface Texts {
  networkTitle: string;
  networkDesc: string;
  networkLabel: string;
  networkError: string;
  taskTitle: string;
  taskSteps: string[];
  upgradeTitle: string;
  upgradeDesc: string;
}

const TEXTS: Record<'enu' | 'ita', Texts> = {
  enu: {
    networkTitle: 'ZeroTier network',
    networkDesc: 'Optional: the 16-character ID of the network to join. You can also join later with zerotier-cli.',
    networkLabel: 'Network ID',
    networkError: 'A network ID is 16 hexadecimal characters',
    taskTitle: 'One-time setup: boot-up task',
    taskSteps: [
      'DSM 7 does not let third-party packages run as root. zt-syno-net needs no extra package for this: a boot-up task prepares the system and the daemon runs without root.',
      'Control Panel > Task Scheduler > Create > Triggered Task > User-defined script. User: root. Event: Boot-up.',
      `Run command: ${SETUP_COMMAND}`,
      'Save, select the task and click Run once now. Repeat "Run" after every upgrade of this package.',
      'Coming from the old "zerotier" package? Uninstall it first: the task moves its identity and networks here, so the node ID stays the same.',
    ],
    upgradeTitle: 'After the upgrade',
    upgradeDesc: `The upgrade replaces the ZeroTier binary and its permissions. Open Task Scheduler and run the zt-syno-net boot-up task once (${SETUP_COMMAND}).`,
  },
  ita: {
    networkTitle: 'Rete ZeroTier',
    networkDesc: 'Facoltativo: l\'ID di 16 caratteri della rete a cui collegarsi. Puoi collegarti anche dopo con zerotier-cli.',
    networkLabel: 'ID della rete',
    networkError: 'Un ID di rete è composto da 16 caratteri esadecimali',
    taskTitle: 'Configurazione una tantum: attività all\'avvio',
    taskSteps: [
      'DSM 7 non permette ai pacchetti di terze parti di girare come root. zt-syno-net non ha bisogno di altri pacchetti per questo: un\'attività all\'avvio prepara il sistema e il servizio gira senza root.',
      'Pannello di controllo > Utilità di pianificazione > Crea > Attività attivata > Script definito dall\'utente. Utente: root. Evento: Avvio.',
      `Comando da eseguire: ${SETUP_COMMAND}`,
      'Salva, seleziona l\'attività e premi Esegui una volta subito. Ripeti "Esegui" dopo ogni aggiornamento del pacchetto.',
      'Arrivi dal vecchio pacchetto "zerotier"? Disinstallalo prima: l\'attività sposta qui la sua identità e le sue reti, così il node ID resta lo stesso.',
    ],
    upgradeTitle: 'Dopo l\'aggiornamento',
    upgradeDesc: `L'aggiornamento sostituisce l'eseguibile di ZeroTier e i suoi permessi. Apri l'Utilità di pianificazione ed esegui una volta l'attività all'avvio di zt-syno-net (${SETUP_COMMAND}).`,
  },
};

export function installWizard(lang: keyof typeof TEXTS): string {
  const t = TEXTS[lang];
  return JSON.stringify([
    {
      step_title: t.networkTitle,
      items: [{
        type: 'textfield',
        desc: t.networkDesc,
        subitems: [{
          key: 'wizard_network_id',
          desc: t.networkLabel,
          defaultValue: '',
          validator: { allowBlank: true, regex: { expr: '/^[0-9a-fA-F]{16}$/', errorText: t.networkError } },
        }],
      }],
    },
    { step_title: t.taskTitle, items: t.taskSteps.map((desc) => ({ desc })) },
  ], null, 2);
}

export function upgradeWizard(lang: keyof typeof TEXTS): string {
  const t = TEXTS[lang];
  return JSON.stringify([{ step_title: t.upgradeTitle, items: [{ desc: t.upgradeDesc }] }], null, 2);
}

/** Every wizard file of the package, keyed by its path inside the SPK. */
export function wizardFiles(): Record<string, string> {
  return {
    'WIZARD_UIFILES/install_uifile': installWizard('enu'),
    'WIZARD_UIFILES/install_uifile_enu': installWizard('enu'),
    'WIZARD_UIFILES/install_uifile_ita': installWizard('ita'),
    'WIZARD_UIFILES/upgrade_uifile': upgradeWizard('enu'),
    'WIZARD_UIFILES/upgrade_uifile_enu': upgradeWizard('enu'),
    'WIZARD_UIFILES/upgrade_uifile_ita': upgradeWizard('ita'),
  };
}
