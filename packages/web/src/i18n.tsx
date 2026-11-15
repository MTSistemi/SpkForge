// Interface strings, English and Italian, and the language context.
// Every visible string lives here. The register is professional and neutral:
// technical English, and impersonal Italian (no "tu", no "Lei"), as in a manual.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Family, Localized } from './api.ts';

export type Lang = 'en' | 'it';

const en = {
  skip: 'Skip to content',
  nav: { packages: 'Packages', add: 'Add the source', verify: 'Verification', github: 'Source code on GitHub', admin: 'Administration' },
  langLabel: 'Language',
  theme: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' },

  hero: {
    eyebrow: 'Package source for Synology DSM 7',
    title: 'SpkForge',
    lead: 'Packages are built by GitHub Actions from public source code. Every file is published with its SHA-256 checksum and a build provenance attestation. No package requires other packages or third-party privilege helpers.',
    plateLabel: 'Package source',
    plateHint: 'Address to enter in Package Center',
    plateMin: 'DSM 7.0 or later',
    plateFallback: 'Address derived from this page: the API did not respond.',
  },
  copy: { copy: 'Copy', copied: 'Copied', failed: 'Select and copy', copyFull: 'Copy full value', copiedFull: 'Copied to the clipboard' },
  steps: {
    title: 'Adding the source in DSM 7',
    path: ['Package Center', 'Settings', 'Package Sources', 'Add'],
    s1t: 'Open Package Center',
    s1d: 'Select Settings, at the top right.',
    s2t: 'Add a source',
    s2d: 'In the Package Sources tab, select Add.',
    s3t: 'Enter name and location',
    s3name: 'Name',
    s3loc: 'Location',
    s3d: 'Confirm with OK.',
    note: 'The packages are then listed under Community. DSM shows a notice that they are not verified by Synology: the notice applies to every third-party source, since DSM 7 no longer supports package signing.',
  },
  trust: {
    label: 'Every package',
    items: ['No expiring signatures', 'No privilege helpers', 'No dependencies', 'Build provenance for every file'],
  },

  fit: {
    kicker: 'Compatibility',
    title: 'Packages available for a NAS',
    lead: 'Select the platform and the channel to see the files Package Center offers to that NAS.',
    platform: 'Platform',
    platformPlaceholder: 'Search a platform, e.g. geminilake',
    noMatch: 'No matching platform',
    clear: 'Clear platform',
    channel: 'Channel',
    build: 'DSM build',
    buildOptional: 'optional',
    buildHint: 'Control Panel → Info Center → DSM version, e.g. 72806',
    howTitle: 'Finding the platform',
    how: 'Control Panel → Info Center shows the model. The Synology knowledge base article “What kind of CPU does my Synology NAS have?” lists the platform of each model:',
    examples: 'DS920+ → geminilake · DS220j → rtd1296 · DS1621+ → v1000',
    resultTitle: 'Offered by Package Center',
    pickFirst: 'Select a platform to see the packages offered for it.',
    none: 'No packages are available for this platform.',
    noneBeta: 'No packages on the beta channel either.',
    noneHint: 'Check the platform, or select the beta channel.',
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
    lead: 'Every package installs on its own and runs without third-party privilege helpers.',
    latest: 'Latest',
    downloads: 'downloads',
    open: 'Details and downloads',
    empty: 'No packages have been published yet.',
    beta: 'Beta available',
  },

  verify: {
    kicker: 'Verification',
    title: 'Verifying the files',
    lead: 'Every SPK is built by GitHub Actions in the public MTSistemi/SpkForge repository and receives a build provenance attestation, signed with Sigstore. The attestation shows that the file was produced by that repository and workflow and has not been modified since.',
    hashTitle: 'Checksum',
    hashNote: 'The expected SHA-256 is shown on each package page. macOS: shasum -a 256 · Windows: Get-FileHash',
    attTitle: 'Build provenance',
    attNote: 'Requires the GitHub CLI. No key needs to be imported and nothing expires.',
    file: 'Verify this file',
    expected: 'Expected SHA-256',
  },

  why: {
    kicker: 'Background',
    title: 'Why SpkForge',
    context: 'The community source 我不是矿神 (spk7.imnks.com) closed on 1 November 2026. Its ZeroTier package depended on a third-party privilege helper whose signing key has expired, so the package no longer starts after a restart. SpkForge was written from scratch to avoid this kind of failure.',
    points: [
      { t: 'No expiring signatures', d: 'DSM 7 has deprecated package signing. No part of the build or installation depends on a signature or key with an expiry date.' },
      { t: 'No privilege helpers', d: 'Packages use the DSM privilege model, without setuid helpers or third-party permission managers.' },
      { t: 'No dependencies', d: 'Each package installs on its own, without dependency packages to keep aligned.' },
      { t: 'Open source and verifiable', d: 'AGPL-3.0, built in public CI, with build provenance and checksums for every file.' },
    ],
    domain: 'A NAS that still lists spk7.imnks.com as a package source should have it removed: when the domain is released, a new owner could distribute packages to that NAS.',
  },

  footer: {
    notAffiliated: 'Not affiliated with Synology Inc. or ZeroTier, Inc. Synology, DSM and ZeroTier are trademarks of their respective owners.',
  },

  page: {
    back: 'All packages',
    maintainer: 'Maintainer',
    guide: 'Installation guide',
    support: 'Support',
    latest: 'Latest version',
    dsmMin: 'Minimum DSM',
    downloads: 'Downloads',
    cpus: 'CPU families',
    guideCalloutTitle: 'Installation guide',
    guideCalloutBody: 'The guide describes the one-time steps DSM requires for this package. Read it before installing.',
    guideCta: 'Open the installation guide',
    versions: 'Versions',
    versionsLead: 'One row per file. Package Center selects the right file for each NAS; manual downloads are only needed for manual installation.',
    colFamily: 'CPU family',
    colChannel: 'Channel',
    colDsm: 'Minimum DSM',
    colSize: 'Size',
    colSha: 'SHA-256',
    colDownloads: 'Downloads',
    colGet: 'File',
    download: 'Download',
    platforms: (n: number) => (n === 1 ? '1 platform' : `${n} platforms`),
    changelog: 'Release notes',
    noChangelog: 'No release notes for this version.',
    notFoundTitle: 'Package not found',
    notFoundBody: 'This source has no package with this name. It may have been withdrawn.',
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
    errorTitle: 'The SpkForge API is not responding',
    errorBody: 'The server may be restarting. Installed packages are not affected: Package Center contacts the server on its own schedule.',
    retry: 'Retry',
  },

  admin: {
    title: 'Administration',
    signInTitle: 'Administrator sign-in',
    signInLead: 'Enter the administration token configured on this server (SPKFORGE_ADMIN_TOKEN). The token is kept only in this browser tab and is discarded when the tab is closed.',
    token: 'Administration token',
    signIn: 'Sign in',
    signingIn: 'Verifying…',
    signOut: 'Sign out',
    wrongToken: 'The token is not valid. Check SPKFORGE_ADMIN_TOKEN on the server.',
    disabled: 'The administration API is disabled on this server. Set SPKFORGE_ADMIN_TOKEN and restart the server to enable it.',
    expired: 'The token is no longer accepted. Sign in again.',
    networkError: 'The server cannot be reached.',
    connected: 'Signed in',
    backToSite: 'Public site',
    sections: { upload: 'Upload', files: 'Published files', rejected: 'Rejected files', stats: 'Statistics', maintenance: 'Maintenance' },

    uploadTitle: 'Upload packages',
    uploadLead: 'Drop .spk files here. Each file is validated and, if valid, published immediately.',
    drop: 'Drop .spk files here',
    dropActive: 'Release to upload',
    or: 'or',
    browse: 'select files',
    nameRule: 'File names in the form name_arch_1.0-1.spk',
    queued: 'Queued',
    uploading: (p: number) => `Uploading ${p}%`,
    checking: 'Validating…',
    published: 'Published',
    rejected: 'Rejected',
    failed: 'Failed',
    badName: 'File name not accepted: use letters, digits, dot, hyphen, plus or underscore, ending in .spk.',
    tooLarge: 'The file exceeds the maximum size accepted by the server.',
    clear: 'Clear completed',

    filesTitle: 'Published files',
    filesLead: 'Files currently offered by Package Center.',
    filesEmpty: 'No files are published.',
    colPackage: 'Package',
    colVersion: 'Version',
    withdraw: 'Withdraw',
    withdrawTitle: (f: string) => `Withdraw ${f}?`,
    withdrawBody: 'The file is removed from the catalog immediately. It is not deleted: it is moved to the withdrawn/ folder on the server, from which it can be restored.',
    withdrawConfirm: 'Withdraw file',
    cancel: 'Cancel',
    withdrawn: (f: string) => `${f} withdrawn.`,
    channelSet: (f: string, c: string) => `${f} moved to the ${c} channel.`,
    channelOf: (f: string) => `Channel of ${f}`,

    rejectedTitle: 'Rejected files',
    rejectedLead: 'Files in the packages folder that were not admitted to the catalog.',
    rejectedEmpty: 'No rejected files.',
    checkedAt: 'Checked',

    statsTitle: 'Downloads',
    statsTotal: 'Total downloads',
    byPackage: 'By package',
    byPlatform: 'By platform',
    statsEmpty: 'No downloads recorded.',
    webPlatform: 'web (manual)',

    maintTitle: 'Maintenance',
    maintLead: 'Re-read every file in the packages folder, including files copied in manually.',
    reindex: 'Re-index',
    reindexing: 'Re-indexing…',
    reindexDone: 'Re-indexing completed.',
    rIndexed: 'Indexed',
    rRejected: 'Rejected',
    rRemoved: 'Removed',
    rUnchanged: 'Unchanged',

    actionFailed: (m: string) => `The operation failed: ${m}`,
    dismiss: 'Dismiss',
    problems: {
      'dsm-signature': 'The file contains syno_signature.asc. SpkForge publishes packages without DSM signatures, which DSM 7 no longer uses. Rebuild the package without the signature.',
      'missing-payload': 'The file contains no package.tgz: it is not a complete SPK.',
      'missing-field': 'The INFO file lacks a required field.',
      'missing-info': 'The file contains no INFO file: it is not a valid SPK.',
      'bad-id': 'The package id contains characters that DSM does not accept.',
      unreadable: 'The file cannot be read as an SPK archive.',
    } as Record<string, string>,
    rawMessage: 'Server message',
  },
};

export type Strings = typeof en;

const it: Strings = {
  skip: 'Vai al contenuto',
  nav: { packages: 'Pacchetti', add: 'Aggiunta della sorgente', verify: 'Verifica', github: 'Codice sorgente su GitHub', admin: 'Amministrazione' },
  langLabel: 'Lingua',
  theme: { label: 'Tema', light: 'Chiaro', dark: 'Scuro', system: 'Sistema' },

  hero: {
    eyebrow: 'Sorgente di pacchetti per Synology DSM 7',
    title: 'SpkForge',
    lead: 'I pacchetti sono compilati da GitHub Actions a partire da codice sorgente pubblico. Ogni file è pubblicato con il proprio checksum SHA-256 e un’attestazione di provenienza della build. Nessun pacchetto richiede altri pacchetti o gestori di privilegi di terze parti.',
    plateLabel: 'Sorgente pacchetti',
    plateHint: 'Indirizzo da inserire nel Centro pacchetti',
    plateMin: 'DSM 7.0 o successivo',
    plateFallback: 'Indirizzo ricavato da questa pagina: l’API non ha risposto.',
  },
  copy: { copy: 'Copia', copied: 'Copiato', failed: 'Selezionare e copiare', copyFull: 'Copia il valore completo', copiedFull: 'Copiato negli appunti' },
  steps: {
    title: 'Aggiunta della sorgente in DSM 7',
    path: ['Centro pacchetti', 'Impostazioni', 'Pacchetti sorgente', 'Aggiungi'],
    s1t: 'Aprire il Centro pacchetti',
    s1d: 'Selezionare Impostazioni, in alto a destra.',
    s2t: 'Aggiungere una sorgente',
    s2d: 'Nella scheda Pacchetti sorgente, selezionare Aggiungi.',
    s3t: 'Inserire nome e posizione',
    s3name: 'Nome',
    s3loc: 'Posizione',
    s3d: 'Confermare con OK.',
    note: 'I pacchetti compaiono poi nella sezione Community. DSM segnala che non sono verificati da Synology: l’avviso riguarda ogni sorgente di terze parti, perché DSM 7 non supporta più la firma dei pacchetti.',
  },
  trust: {
    label: 'Ogni pacchetto',
    items: ['Nessuna firma con scadenza', 'Nessun gestore di privilegi', 'Nessuna dipendenza', 'Provenienza della build per ogni file'],
  },

  fit: {
    kicker: 'Compatibilità',
    title: 'Pacchetti disponibili per un NAS',
    lead: 'Selezionando piattaforma e canale si ottengono i file che il Centro pacchetti offre a quel NAS.',
    platform: 'Piattaforma',
    platformPlaceholder: 'Cerca una piattaforma, es. geminilake',
    noMatch: 'Nessuna piattaforma corrispondente',
    clear: 'Cancella la piattaforma',
    channel: 'Canale',
    build: 'Build di DSM',
    buildOptional: 'facoltativa',
    buildHint: 'Pannello di controllo → Centro informazioni → versione DSM, es. 72806',
    howTitle: 'Come individuare la piattaforma',
    how: 'Pannello di controllo → Centro informazioni indica il modello. L’articolo della knowledge base Synology “What kind of CPU does my Synology NAS have?” riporta la piattaforma di ogni modello:',
    examples: 'DS920+ → geminilake · DS220j → rtd1296 · DS1621+ → v1000',
    resultTitle: 'Offerti dal Centro pacchetti',
    pickFirst: 'Selezionare una piattaforma per vedere i pacchetti disponibili.',
    none: 'Nessun pacchetto disponibile per questa piattaforma.',
    noneBeta: 'Nessun pacchetto nemmeno sul canale beta.',
    noneHint: 'Verificare la piattaforma, oppure selezionare il canale beta.',
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
    lead: 'Ogni pacchetto si installa autonomamente e funziona senza gestori di privilegi di terze parti.',
    latest: 'Ultima',
    downloads: 'download',
    open: 'Dettagli e download',
    empty: 'Non è ancora stato pubblicato alcun pacchetto.',
    beta: 'Beta disponibile',
  },

  verify: {
    kicker: 'Verifica',
    title: 'Verifica dei file',
    lead: 'Ogni SPK è compilato da GitHub Actions nel repository pubblico MTSistemi/SpkForge e riceve un’attestazione di provenienza della build, firmata con Sigstore. L’attestazione dimostra che il file è stato prodotto da quel repository e da quel workflow e non è stato modificato.',
    hashTitle: 'Checksum',
    hashNote: 'Lo SHA-256 atteso è riportato nella pagina di ogni pacchetto. macOS: shasum -a 256 · Windows: Get-FileHash',
    attTitle: 'Provenienza della build',
    attNote: 'Richiede la GitHub CLI. Non occorre importare chiavi e non ci sono scadenze.',
    file: 'Verifica di questo file',
    expected: 'SHA-256 atteso',
  },

  why: {
    kicker: 'Contesto',
    title: 'Perché SpkForge',
    context: 'La sorgente della community 我不是矿神 (spk7.imnks.com) ha chiuso il 1° novembre 2026. Il suo pacchetto ZeroTier dipendeva da un gestore di privilegi di terze parti la cui chiave di firma è scaduta, per cui il pacchetto non si avvia più dopo un riavvio. SpkForge è stato scritto da zero per evitare questo tipo di guasto.',
    points: [
      { t: 'Nessuna firma con scadenza', d: 'DSM 7 ha deprecato la firma dei pacchetti. Nessuna fase della build o dell’installazione dipende da firme o chiavi con una data di scadenza.' },
      { t: 'Nessun gestore di privilegi', d: 'I pacchetti utilizzano il modello di privilegi di DSM, senza binari setuid né gestori di permessi di terze parti.' },
      { t: 'Nessuna dipendenza', d: 'Ogni pacchetto si installa autonomamente, senza pacchetti dipendenti da mantenere allineati.' },
      { t: 'Open source e verificabili', d: 'AGPL-3.0, compilati in una CI pubblica, con provenienza della build e checksum per ogni file.' },
    ],
    domain: 'Se un NAS riporta ancora spk7.imnks.com tra le sorgenti, è opportuno rimuoverla: quando il dominio verrà rilasciato, un nuovo titolare potrebbe distribuire pacchetti a quel NAS.',
  },

  footer: {
    notAffiliated: 'Non affiliato a Synology Inc. né a ZeroTier, Inc. Synology, DSM e ZeroTier sono marchi dei rispettivi titolari.',
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
    guideCalloutTitle: 'Guida all’installazione',
    guideCalloutBody: 'La guida descrive i passaggi, da eseguire una sola volta, richiesti da DSM per questo pacchetto. Si consiglia di consultarla prima dell’installazione.',
    guideCta: 'Apri la guida all’installazione',
    versions: 'Versioni',
    versionsLead: 'Una riga per file. Il Centro pacchetti seleziona il file adatto a ogni NAS; il download manuale serve solo per l’installazione manuale.',
    colFamily: 'Famiglia CPU',
    colChannel: 'Canale',
    colDsm: 'DSM minimo',
    colSize: 'Dimensione',
    colSha: 'SHA-256',
    colDownloads: 'Download',
    colGet: 'File',
    download: 'Scarica',
    platforms: (n: number) => (n === 1 ? '1 piattaforma' : `${n} piattaforme`),
    changelog: 'Note di rilascio',
    noChangelog: 'Nessuna nota di rilascio per questa versione.',
    notFoundTitle: 'Pacchetto non trovato',
    notFoundBody: 'Questa sorgente non contiene un pacchetto con questo nome. Potrebbe essere stato ritirato.',
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
    errorBody: 'Il server potrebbe essere in fase di riavvio. I pacchetti installati non ne risentono: il Centro pacchetti contatta il server secondo i propri tempi.',
    retry: 'Riprova',
  },

  admin: {
    title: 'Amministrazione',
    signInTitle: 'Accesso amministratore',
    signInLead: 'Inserire il token di amministrazione configurato su questo server (SPKFORGE_ADMIN_TOKEN). Il token è conservato solo in questa scheda del browser e viene eliminato alla sua chiusura.',
    token: 'Token di amministrazione',
    signIn: 'Accedi',
    signingIn: 'Verifica in corso…',
    signOut: 'Esci',
    wrongToken: 'Il token non è valido. Verificare SPKFORGE_ADMIN_TOKEN sul server.',
    disabled: 'L’API di amministrazione è disattivata su questo server. Per attivarla, impostare SPKFORGE_ADMIN_TOKEN e riavviare il server.',
    expired: 'Il token non è più accettato. Eseguire di nuovo l’accesso.',
    networkError: 'Il server non è raggiungibile.',
    connected: 'Accesso eseguito',
    backToSite: 'Sito pubblico',
    sections: { upload: 'Caricamento', files: 'File pubblicati', rejected: 'File rifiutati', stats: 'Statistiche', maintenance: 'Manutenzione' },

    uploadTitle: 'Caricamento pacchetti',
    uploadLead: 'Trascinare qui i file .spk. Ogni file viene convalidato e, se valido, pubblicato immediatamente.',
    drop: 'Trascinare qui i file .spk',
    dropActive: 'Rilasciare per caricare',
    or: 'oppure',
    browse: 'selezionare i file',
    nameRule: 'Nomi file nel formato nome_arch_1.0-1.spk',
    queued: 'In coda',
    uploading: (p: number) => `Caricamento ${p}%`,
    checking: 'Convalida…',
    published: 'Pubblicato',
    rejected: 'Rifiutato',
    failed: 'Non riuscito',
    badName: 'Nome file non accettato: sono ammessi lettere, cifre, punto, trattino, più e trattino basso, con estensione .spk.',
    tooLarge: 'Il file supera la dimensione massima accettata dal server.',
    clear: 'Rimuovi i completati',

    filesTitle: 'File pubblicati',
    filesLead: 'File attualmente offerti dal Centro pacchetti.',
    filesEmpty: 'Nessun file pubblicato.',
    colPackage: 'Pacchetto',
    colVersion: 'Versione',
    withdraw: 'Ritira',
    withdrawTitle: (f: string) => `Ritirare ${f}?`,
    withdrawBody: 'Il file viene rimosso subito dal catalogo. Non viene eliminato: è spostato nella cartella withdrawn/ del server, da cui può essere ripristinato.',
    withdrawConfirm: 'Ritira il file',
    cancel: 'Annulla',
    withdrawn: (f: string) => `${f} ritirato.`,
    channelSet: (f: string, c: string) => `${f} spostato sul canale ${c}.`,
    channelOf: (f: string) => `Canale di ${f}`,

    rejectedTitle: 'File rifiutati',
    rejectedLead: 'File presenti nella cartella dei pacchetti e non ammessi nel catalogo.',
    rejectedEmpty: 'Nessun file rifiutato.',
    checkedAt: 'Controllato',

    statsTitle: 'Download',
    statsTotal: 'Download totali',
    byPackage: 'Per pacchetto',
    byPlatform: 'Per piattaforma',
    statsEmpty: 'Nessun download registrato.',
    webPlatform: 'web (manuale)',

    maintTitle: 'Manutenzione',
    maintLead: 'Rilegge tutti i file nella cartella dei pacchetti, compresi quelli copiati manualmente.',
    reindex: 'Reindicizza',
    reindexing: 'Reindicizzazione…',
    reindexDone: 'Reindicizzazione completata.',
    rIndexed: 'Indicizzati',
    rRejected: 'Rifiutati',
    rRemoved: 'Rimossi',
    rUnchanged: 'Invariati',

    actionFailed: (m: string) => `Operazione non riuscita: ${m}`,
    dismiss: 'Chiudi',
    problems: {
      'dsm-signature': 'Il file contiene syno_signature.asc. SpkForge pubblica pacchetti senza firma DSM, che DSM 7 non utilizza più. Ricompilare il pacchetto senza firma.',
      'missing-payload': 'Il file non contiene package.tgz: non è un SPK completo.',
      'missing-field': 'Nel file INFO manca un campo obbligatorio.',
      'missing-info': 'Il file non contiene il file INFO: non è un SPK valido.',
      'bad-id': 'L’id del pacchetto contiene caratteri non accettati da DSM.',
      unreadable: 'Il file non può essere letto come archivio SPK.',
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
