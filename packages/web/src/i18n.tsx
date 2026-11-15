// Interface strings, English and Italian, and the language context.
// Every visible string lives here. Italian uses the informal "tu", as DSM itself does.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Family, Localized } from './api.ts';

export type Lang = 'en' | 'it';

const en = {
  skip: 'Skip to content',
  nav: { packages: 'Packages', add: 'Add to your NAS', verify: 'Verify', github: 'Source code on GitHub', admin: 'Admin' },
  langLabel: 'Language',
  theme: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },

  hero: {
    eyebrow: 'Package source for Synology DSM 7',
    title: 'Packages for your Synology that keep on starting.',
    lead: 'No expiring signatures, no privilege brokers, no other packages to install. Built in the open, verifiable file by file.',
    plateLabel: 'Package source',
    plateHint: 'Paste this address into Package Center',
    plateMin: 'DSM 7.0 and later',
    plateFallback: 'Address taken from this page: the API did not answer.',
  },
  copy: { copy: 'Copy', copied: 'Copied', failed: 'Select and copy', copyFull: 'Copy full value', copiedFull: 'Copied to the clipboard' },
  steps: {
    title: 'Three steps in DSM 7',
    path: ['Package Center', 'Settings', 'Package Sources', 'Add'],
    s1t: 'Open Package Center',
    s1d: 'Click Settings, top right.',
    s2t: 'Add the source',
    s2d: 'In the Package Sources tab, click Add.',
    s3t: 'Name it and paste',
    s3name: 'Name',
    s3loc: 'Location',
    s3d: 'Confirm with OK.',
    note: 'Our packages then show up under Community. DSM warns that they are not verified by Synology: it does that for every third-party source, and DSM 7 no longer lets anyone sign packages.',
  },
  trust: {
    label: 'What we promise',
    items: ['No expiring signatures', 'No privilege broker', 'No dependencies', 'Build provenance on every file'],
  },

  fit: {
    kicker: 'Before you add it',
    title: 'What fits my NAS',
    lead: 'Pick your platform and channel: you get exactly what Package Center will offer that NAS, down to the file.',
    platform: 'Platform',
    platformPlaceholder: 'Search a platform, e.g. geminilake',
    noMatch: 'No platform matches',
    clear: 'Clear platform',
    channel: 'Channel',
    build: 'DSM build',
    buildOptional: 'optional',
    buildHint: 'Control Panel → Info Center → DSM version, e.g. 72806',
    howTitle: 'How do I find my platform?',
    how: 'Control Panel → Info Center shows your model. Synology’s knowledge base article “What kind of CPU does my Synology NAS have?” maps each model to its platform:',
    examples: 'DS920+ → geminilake · DS220j → rtd1296 · DS1621+ → v1000',
    resultTitle: 'Package Center would offer',
    pickFirst: 'Pick a platform to see what this source offers it.',
    none: 'No packages for this platform yet.',
    noneBeta: 'Nothing on the beta channel either.',
    noneHint: 'Try the beta channel, or check that the platform is right.',
    file: 'File',
    size: 'Size',
    md5: 'MD5',
    download: 'Download',
    details: 'Details',
    beta: 'Beta',
    count: (n: number) => (n === 1 ? '1 package' : `${n} packages`),
  },

  pkgs: {
    kicker: 'Catalog',
    title: 'Packages',
    lead: 'Every package runs without root helpers and installs on its own.',
    latest: 'Latest',
    downloads: 'downloads',
    open: 'Details and downloads',
    empty: 'No packages are published yet.',
    beta: 'Beta available',
  },

  verify: {
    kicker: 'Trust, but check',
    title: 'Verify any file yourself',
    lead: 'Every SPK is built by GitHub Actions in our public repository and gets a build provenance attestation, signed keylessly with Sigstore. It proves the file came from MTSistemi/SpkForge and our workflow, untouched.',
    hashTitle: 'Compare the checksum',
    hashNote: 'The expected SHA-256 is on each package page. macOS: shasum -a 256 · Windows: Get-FileHash',
    attTitle: 'Check the build provenance',
    attNote: 'Needs the GitHub CLI. No key to import, nothing that expires.',
    file: 'Verify this file',
    expected: 'Expected SHA-256',
  },

  why: {
    kicker: 'Why SpkForge',
    title: 'Built to keep working',
    context: 'The community source 我不是矿神 (spk7.imnks.com) closed on 2026-11-01. Its ZeroTier package relied on a third-party privilege helper whose signing key has expired, so it no longer starts after a reboot. SpkForge is a fresh start that avoids that whole class of failure.',
    points: [
      { t: 'Nothing that expires', d: 'DSM 7 deprecated package code signing. We do not depend on a signature or key with a date on it, anywhere in the chain.' },
      { t: 'No privilege broker', d: 'Packages run under DSM’s own privilege model, without setuid helpers or third-party permission managers.' },
      { t: 'Self-contained', d: 'Each package installs on its own: no dependency packages, nothing else to keep in step.' },
      { t: 'Open and verifiable', d: 'AGPL-3.0, built in public CI, with build provenance and checksums for every file.' },
    ],
    domain: 'If a NAS still lists spk7.imnks.com as a source, remove it: one day the domain will be released, and whoever registers it next could serve packages to that NAS.',
  },

  footer: {
    notAffiliated: 'Not affiliated with Synology Inc. or ZeroTier, Inc.; Synology, DSM and ZeroTier are trademarks of their owners.',
  },

  page: {
    back: 'All packages',
    maintainer: 'Maintainer',
    guide: 'Setup guide',
    support: 'Support',
    latest: 'Latest version',
    dsmMin: 'DSM min',
    downloads: 'Downloads',
    cpus: 'CPU families',
    guideCalloutTitle: 'Read the setup guide before installing',
    guideCalloutBody: 'It walks you through the one-time steps DSM needs for this package.',
    guideCta: 'Read the setup guide',
    versions: 'Versions',
    versionsLead: 'One row per file. Package Center picks the right one for your NAS by itself; download by hand only for manual installs.',
    colFamily: 'CPU family',
    colChannel: 'Channel',
    colDsm: 'DSM min',
    colSize: 'Size',
    colSha: 'SHA-256',
    colDownloads: 'Downloads',
    colGet: 'File',
    download: 'Download',
    platforms: (n: number) => (n === 1 ? '1 platform' : `${n} platforms`),
    changelog: 'Changelog',
    noChangelog: 'No notes for this version.',
    notFoundTitle: 'Package not found',
    notFoundBody: 'There is no package with this name on this source. It may have been withdrawn.',
    files: (n: number) => (n === 1 ? '1 file' : `${n} files`),
  },

  channel: { stable: 'Stable', beta: 'Beta' },
  families: {
    x86_64: 'Intel/AMD 64-bit',
    armv8: 'ARM 64-bit',
    armv7: 'ARM 32-bit',
    i686: 'Intel Atom 32-bit',
    noarch: 'Any CPU',
  } satisfies Record<Family, string>,

  state: {
    loading: 'Loading…',
    errorTitle: 'The SpkForge API is not answering',
    errorBody: 'The server may be restarting. Your NAS is not affected: Package Center talks to the same server on its own schedule.',
    retry: 'Try again',
  },

  admin: {
    title: 'Control room',
    signInTitle: 'Admin sign-in',
    signInLead: 'Enter the admin token configured on this server (SPKFORGE_ADMIN_TOKEN). It stays in this browser tab only and is forgotten when you close it.',
    token: 'Admin token',
    signIn: 'Sign in',
    signingIn: 'Checking…',
    signOut: 'Sign out',
    wrongToken: 'That token is not right. Check SPKFORGE_ADMIN_TOKEN on the server.',
    disabled: 'The admin API is turned off on this server: start it with SPKFORGE_ADMIN_TOKEN set to enable it.',
    expired: 'The server no longer accepts your token. Sign in again.',
    networkError: 'Cannot reach the server.',
    connected: 'Signed in',
    backToSite: 'Public site',
    sections: { upload: 'Upload', files: 'Published files', rejected: 'Rejected', stats: 'Statistics', maintenance: 'Maintenance' },

    uploadTitle: 'Upload packages',
    uploadLead: 'Drop .spk files here. Each one is checked and, if it passes, published at once.',
    drop: 'Drop .spk files here',
    dropActive: 'Release to upload',
    or: 'or',
    browse: 'choose files',
    nameRule: 'File names like name_arch_1.0-1.spk',
    queued: 'Waiting',
    uploading: (p: number) => `Uploading ${p}%`,
    checking: 'Checking…',
    published: 'Published',
    rejected: 'Rejected',
    failed: 'Failed',
    badName: 'The file name is not accepted: use letters, digits, dot, dash, plus or underscore, ending in .spk.',
    tooLarge: 'The file is larger than the server accepts.',
    clear: 'Clear finished',

    filesTitle: 'Published files',
    filesLead: 'Everything Package Center can currently offer.',
    filesEmpty: 'No files are published.',
    colPackage: 'Package',
    colVersion: 'Version',
    withdraw: 'Withdraw',
    withdrawTitle: (f: string) => `Withdraw ${f}?`,
    withdrawBody: 'It disappears from the catalog immediately. The file is not deleted: it is moved to the server’s withdrawn/ folder, and you can restore it from there.',
    withdrawConfirm: 'Withdraw file',
    cancel: 'Cancel',
    withdrawn: (f: string) => `${f} withdrawn.`,
    channelSet: (f: string, c: string) => `${f} is now on ${c}.`,
    channelOf: (f: string) => `Channel of ${f}`,

    rejectedTitle: 'Rejected files',
    rejectedLead: 'Files in the packages folder that were kept out of the catalog.',
    rejectedEmpty: 'Nothing rejected.',
    checkedAt: 'Checked',

    statsTitle: 'Downloads',
    statsTotal: 'Total downloads',
    byPackage: 'By package',
    byPlatform: 'By platform',
    statsEmpty: 'No downloads yet.',
    webPlatform: 'web (manual)',

    maintTitle: 'Maintenance',
    maintLead: 'Re-read every file in the packages folder, including ones copied in by hand.',
    reindex: 'Re-index now',
    reindexing: 'Re-indexing…',
    reindexDone: 'Re-index complete.',
    rIndexed: 'Indexed',
    rRejected: 'Rejected',
    rRemoved: 'Removed',
    rUnchanged: 'Unchanged',

    actionFailed: (m: string) => `That did not work: ${m}`,
    dismiss: 'Dismiss',
    problems: {
      'dsm-signature': 'Carries syno_signature.asc: SpkForge ships packages without DSM signatures, which DSM 7 no longer trusts anyway. Rebuild it without the signature.',
      'missing-payload': 'There is no package.tgz inside: this is not a complete SPK.',
      'missing-field': 'The INFO file lacks a required field.',
      'missing-info': 'There is no INFO file inside: this is not a valid SPK.',
      'bad-id': 'The package id contains characters DSM does not accept.',
      unreadable: 'The file could not be read as an SPK archive.',
    } as Record<string, string>,
    rawMessage: 'Server message',
  },
};

export type Strings = typeof en;

const it: Strings = {
  skip: 'Vai al contenuto',
  nav: { packages: 'Pacchetti', add: 'Aggiungi al NAS', verify: 'Verifica', github: 'Codice sorgente su GitHub', admin: 'Admin' },
  langLabel: 'Lingua',
  theme: { label: 'Tema', light: 'Chiaro', dark: 'Scuro', system: 'Sistema' },

  hero: {
    eyebrow: 'Sorgente di pacchetti per Synology DSM 7',
    title: 'Pacchetti per il tuo Synology che continuano ad avviarsi.',
    lead: 'Nessuna firma che scade, nessun gestore di privilegi, nessun altro pacchetto da installare. Costruiti alla luce del sole, verificabili file per file.',
    plateLabel: 'Sorgente pacchetti',
    plateHint: 'Incolla questo indirizzo nel Centro pacchetti',
    plateMin: 'DSM 7.0 e successivi',
    plateFallback: 'Indirizzo ricavato da questa pagina: l’API non ha risposto.',
  },
  copy: { copy: 'Copia', copied: 'Copiato', failed: 'Seleziona e copia', copyFull: 'Copia il valore completo', copiedFull: 'Copiato negli appunti' },
  steps: {
    title: 'Tre passi in DSM 7',
    path: ['Centro pacchetti', 'Impostazioni', 'Origini pacchetti', 'Aggiungi'],
    s1t: 'Apri il Centro pacchetti',
    s1d: 'Clicca Impostazioni, in alto a destra.',
    s2t: 'Aggiungi la sorgente',
    s2d: 'Nella scheda Origini pacchetti, clicca Aggiungi.',
    s3t: 'Dagli un nome e incolla',
    s3name: 'Nome',
    s3loc: 'Posizione',
    s3d: 'Conferma con OK.',
    note: 'I nostri pacchetti compaiono poi sotto Community. DSM avvisa che non sono verificati da Synology: lo fa per ogni sorgente di terze parti, e DSM 7 non permette più a nessuno di firmare i pacchetti.',
  },
  trust: {
    label: 'Cosa promettiamo',
    items: ['Nessuna firma che scade', 'Nessun gestore di privilegi', 'Nessuna dipendenza', 'Provenienza di build su ogni file'],
  },

  fit: {
    kicker: 'Prima di aggiungerla',
    title: 'Cosa va sul mio NAS',
    lead: 'Scegli piattaforma e canale: vedi esattamente cosa offrirà il Centro pacchetti a quel NAS, fino al singolo file.',
    platform: 'Piattaforma',
    platformPlaceholder: 'Cerca una piattaforma, es. geminilake',
    noMatch: 'Nessuna piattaforma corrisponde',
    clear: 'Togli la piattaforma',
    channel: 'Canale',
    build: 'Build di DSM',
    buildOptional: 'facoltativa',
    buildHint: 'Pannello di controllo → Centro informazioni → versione DSM, es. 72806',
    howTitle: 'Come trovo la mia piattaforma?',
    how: 'Pannello di controllo → Centro informazioni mostra il modello. L’articolo della knowledge base Synology “What kind of CPU does my Synology NAS have?” associa ogni modello alla sua piattaforma:',
    examples: 'DS920+ → geminilake · DS220j → rtd1296 · DS1621+ → v1000',
    resultTitle: 'Il Centro pacchetti offrirebbe',
    pickFirst: 'Scegli una piattaforma per vedere cosa le offre questa sorgente.',
    none: 'Ancora nessun pacchetto per questa piattaforma.',
    noneBeta: 'Niente nemmeno sul canale beta.',
    noneHint: 'Prova il canale beta, oppure controlla che la piattaforma sia giusta.',
    file: 'File',
    size: 'Dimensione',
    md5: 'MD5',
    download: 'Scarica',
    details: 'Dettagli',
    beta: 'Beta',
    count: (n: number) => (n === 1 ? '1 pacchetto' : `${n} pacchetti`),
  },

  pkgs: {
    kicker: 'Catalogo',
    title: 'Pacchetti',
    lead: 'Ogni pacchetto funziona senza aiutanti root e si installa da solo.',
    latest: 'Ultima',
    downloads: 'download',
    open: 'Dettagli e download',
    empty: 'Non è ancora pubblicato nessun pacchetto.',
    beta: 'Beta disponibile',
  },

  verify: {
    kicker: 'Fidarsi è bene, controllare è meglio',
    title: 'Verifica tu stesso ogni file',
    lead: 'Ogni SPK è compilato da GitHub Actions nel nostro repository pubblico e riceve un’attestazione di provenienza della build, firmata con Sigstore senza chiavi da custodire. Dimostra che il file viene da MTSistemi/SpkForge e dal nostro workflow, senza modifiche.',
    hashTitle: 'Confronta il checksum',
    hashNote: 'Lo SHA-256 atteso è nella pagina di ogni pacchetto. macOS: shasum -a 256 · Windows: Get-FileHash',
    attTitle: 'Controlla la provenienza della build',
    attNote: 'Serve la GitHub CLI. Nessuna chiave da importare, niente che scada.',
    file: 'Verifica questo file',
    expected: 'SHA-256 atteso',
  },

  why: {
    kicker: 'Perché SpkForge',
    title: 'Fatto per continuare a funzionare',
    context: 'La sorgente della community 我不是矿神 (spk7.imnks.com) ha chiuso il 2026-11-01. Il suo pacchetto ZeroTier si appoggiava a un gestore di privilegi di terze parti la cui chiave di firma è scaduta, e così dopo un riavvio non parte più. SpkForge riparte da zero ed evita l’intera categoria di guasti.',
    points: [
      { t: 'Niente che scada', d: 'DSM 7 ha deprecato la firma dei pacchetti. Non dipendiamo da firme o chiavi con una data di scadenza, in nessun punto della catena.' },
      { t: 'Nessun gestore di privilegi', d: 'I pacchetti girano con il modello di privilegi di DSM, senza binari setuid né permission manager di terze parti.' },
      { t: 'Zero dipendenze', d: 'Ogni pacchetto si installa da solo: nessun pacchetto da cui dipendere, niente da tenere allineato.' },
      { t: 'Aperti e verificabili', d: 'AGPL-3.0, compilati in una CI pubblica, con provenienza di build e checksum per ogni file.' },
    ],
    domain: 'Se un NAS ha ancora spk7.imnks.com tra le sorgenti, toglila: prima o poi il dominio verrà rilasciato, e chi lo registrerà dopo potrebbe distribuire pacchetti a quel NAS.',
  },

  footer: {
    notAffiliated: 'Non affiliato a Synology Inc. né a ZeroTier, Inc.; Synology, DSM e ZeroTier sono marchi dei rispettivi titolari.',
  },

  page: {
    back: 'Tutti i pacchetti',
    maintainer: 'Manutentore',
    guide: 'Guida all’installazione',
    support: 'Supporto',
    latest: 'Ultima versione',
    dsmMin: 'DSM minimo',
    downloads: 'Download',
    cpus: 'Famiglie di CPU',
    guideCalloutTitle: 'Leggi la guida prima di installare',
    guideCalloutBody: 'Ti accompagna nei passaggi da fare una volta sola perché DSM gestisca questo pacchetto.',
    guideCta: 'Leggi la guida',
    versions: 'Versioni',
    versionsLead: 'Una riga per file. Il Centro pacchetti sceglie da solo quello giusto per il tuo NAS; scarica a mano solo per un’installazione manuale.',
    colFamily: 'Famiglia CPU',
    colChannel: 'Canale',
    colDsm: 'DSM min.',
    colSize: 'Dimensione',
    colSha: 'SHA-256',
    colDownloads: 'Download',
    colGet: 'File',
    download: 'Scarica',
    platforms: (n: number) => (n === 1 ? '1 piattaforma' : `${n} piattaforme`),
    changelog: 'Novità',
    noChangelog: 'Nessuna nota per questa versione.',
    notFoundTitle: 'Pacchetto non trovato',
    notFoundBody: 'Su questa sorgente non c’è un pacchetto con questo nome. Potrebbe essere stato ritirato.',
    files: (n: number) => (n === 1 ? '1 file' : `${n} file`),
  },

  channel: { stable: 'Stabile', beta: 'Beta' },
  families: {
    x86_64: 'Intel/AMD 64 bit',
    armv8: 'ARM 64 bit',
    armv7: 'ARM 32 bit',
    i686: 'Intel Atom 32 bit',
    noarch: 'Qualsiasi CPU',
  },

  state: {
    loading: 'Caricamento…',
    errorTitle: 'L’API di SpkForge non risponde',
    errorBody: 'Il server potrebbe essere in riavvio. Il tuo NAS non ne risente: il Centro pacchetti interroga lo stesso server con i suoi tempi.',
    retry: 'Riprova',
  },

  admin: {
    title: 'Sala controllo',
    signInTitle: 'Accesso amministratore',
    signInLead: 'Inserisci il token di amministrazione configurato su questo server (SPKFORGE_ADMIN_TOKEN). Resta solo in questa scheda del browser e viene dimenticato quando la chiudi.',
    token: 'Token di amministrazione',
    signIn: 'Accedi',
    signingIn: 'Verifica…',
    signOut: 'Esci',
    wrongToken: 'Il token non è corretto. Controlla SPKFORGE_ADMIN_TOKEN sul server.',
    disabled: 'L’API di amministrazione è disattivata su questo server: avvialo con SPKFORGE_ADMIN_TOKEN impostato per attivarla.',
    expired: 'Il server non accetta più il tuo token. Accedi di nuovo.',
    networkError: 'Il server non è raggiungibile.',
    connected: 'Accesso eseguito',
    backToSite: 'Sito pubblico',
    sections: { upload: 'Carica', files: 'File pubblicati', rejected: 'Rifiutati', stats: 'Statistiche', maintenance: 'Manutenzione' },

    uploadTitle: 'Carica pacchetti',
    uploadLead: 'Trascina qui i file .spk. Ognuno viene controllato e, se è a posto, pubblicato subito.',
    drop: 'Trascina qui i file .spk',
    dropActive: 'Rilascia per caricare',
    or: 'oppure',
    browse: 'scegli i file',
    nameRule: 'Nomi file come nome_arch_1.0-1.spk',
    queued: 'In attesa',
    uploading: (p: number) => `Caricamento ${p}%`,
    checking: 'Controllo…',
    published: 'Pubblicato',
    rejected: 'Rifiutato',
    failed: 'Non riuscito',
    badName: 'Nome file non accettato: usa lettere, cifre, punto, trattino, più o trattino basso, e termina con .spk.',
    tooLarge: 'Il file supera la dimensione accettata dal server.',
    clear: 'Togli i completati',

    filesTitle: 'File pubblicati',
    filesLead: 'Tutto ciò che il Centro pacchetti può offrire in questo momento.',
    filesEmpty: 'Nessun file pubblicato.',
    colPackage: 'Pacchetto',
    colVersion: 'Versione',
    withdraw: 'Ritira',
    withdrawTitle: (f: string) => `Ritirare ${f}?`,
    withdrawBody: 'Sparisce subito dal catalogo. Il file non viene cancellato: viene spostato nella cartella withdrawn/ del server, da cui puoi ripristinarlo.',
    withdrawConfirm: 'Ritira il file',
    cancel: 'Annulla',
    withdrawn: (f: string) => `${f} ritirato.`,
    channelSet: (f: string, c: string) => `${f} ora è sul canale ${c}.`,
    channelOf: (f: string) => `Canale di ${f}`,

    rejectedTitle: 'File rifiutati',
    rejectedLead: 'File nella cartella dei pacchetti tenuti fuori dal catalogo.',
    rejectedEmpty: 'Nessun file rifiutato.',
    checkedAt: 'Controllato',

    statsTitle: 'Download',
    statsTotal: 'Download totali',
    byPackage: 'Per pacchetto',
    byPlatform: 'Per piattaforma',
    statsEmpty: 'Ancora nessun download.',
    webPlatform: 'web (manuale)',

    maintTitle: 'Manutenzione',
    maintLead: 'Rilegge tutti i file nella cartella dei pacchetti, compresi quelli copiati a mano.',
    reindex: 'Reindicizza ora',
    reindexing: 'Reindicizzazione…',
    reindexDone: 'Reindicizzazione completata.',
    rIndexed: 'Indicizzati',
    rRejected: 'Rifiutati',
    rRemoved: 'Rimossi',
    rUnchanged: 'Invariati',

    actionFailed: (m: string) => `Non è andata: ${m}`,
    dismiss: 'Chiudi',
    problems: {
      'dsm-signature': 'Contiene syno_signature.asc: SpkForge distribuisce pacchetti senza firma DSM, a cui comunque DSM 7 non dà più fiducia. Ricompilalo senza firma.',
      'missing-payload': 'Dentro non c’è package.tgz: non è un SPK completo.',
      'missing-field': 'Nel file INFO manca un campo obbligatorio.',
      'missing-info': 'Dentro non c’è il file INFO: non è un SPK valido.',
      'bad-id': 'L’id del pacchetto contiene caratteri che DSM non accetta.',
      unreadable: 'Il file non si legge come archivio SPK.',
    },
    rawMessage: 'Messaggio del server',
  },
};

const STRINGS: Record<Lang, Strings> = { en, it };
const STORAGE_KEY = 'spkforge.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'it') return saved;
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en';
}

interface I18n {
  lang: Lang;
  t: Strings;
  setLang(lang: Lang): void;
  /** Pick the right side of an { enu, ita } text from the API, falling back to English. */
  pick(text: Localized | undefined): string;
  /** DSM language code for API calls. */
  dsmLang: 'enu' | 'ita';
  number(n: number): string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted; the choice still applies to this page.
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const format = new Intl.NumberFormat(lang === 'it' ? 'it-IT' : 'en-GB');
    return {
      lang,
      t: STRINGS[lang],
      setLang,
      pick: (text) => (lang === 'it' ? text?.ita || text?.enu : text?.enu || text?.ita) ?? '',
      dsmLang: lang === 'it' ? 'ita' : 'enu',
      number: (n) => format.format(n),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n outside I18nProvider');
  return value;
}
