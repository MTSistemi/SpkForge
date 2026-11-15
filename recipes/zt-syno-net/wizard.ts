// Install, upgrade and uninstall wizards for zt-syno-net, in English and Italian.
// DSM picks WIZARD_UIFILES/<name>_<lang> when it exists, else <name>.
//
// The "automatic start and guard" step creates the root boot-up task itself,
// from the admin's DSM session: it confirms the admin password
// (SYNO.Core.User.PasswordConfirm), creates or updates the task
// (SYNO.Core.EventScheduler.Root), and runs it at once. Package Center runs the
// step's deactivate_v2 code when the admin presses Next. The password is wiped
// from the form right after use, so it never reaches the package scripts.

import { GUARD_VERSION, TASK_NAME, taskOperation, type GuardOptions } from './guard.ts';

export type Lang = 'enu' | 'ita';

export const SPKFORGE_GUARD: GuardOptions = { pkg: 'zt-syno-net', user: 'zt-syno-net', daemon: 'per-family' };

interface Texts {
  networkTitle: string;
  networkDesc: string;
  networkLabel: string;
  networkError: string;
  guardTitle: string;
  guardDesc: string;
  guardCheckbox: string;
  passwordLabel: string;
  passwordNeeded: string;
  badPassword: string;
  createFailed: string;
  created: string;
  manualTitle: string;
  manualSteps: string[];
  uninstallTitle: string;
  uninstallDesc: string;
}

const MANUAL_COMMAND = '/bin/sh /var/packages/zt-syno-net/target/bin/zt-syno-net-guard';

const TEXTS: Record<Lang, Texts> = {
  enu: {
    networkTitle: 'ZeroTier network',
    networkDesc: 'Optional: the 16-character ID of the network to join. You can also join later with zerotier-cli.',
    networkLabel: 'Network ID',
    networkError: 'A network ID is 16 hexadecimal characters',
    guardTitle: 'Automatic start and guard',
    guardDesc: 'DSM 7 does not let third-party packages run as root, and ZeroTier needs a network capability. '
      + 'zt-syno-net solves it without any other package: it creates one boot-up task, run by root, that prepares '
      + 'the system, gives ZeroTier the capability after every install or upgrade, and restarts the service if it '
      + 'stops. DSM asks for your password to create a task that runs as root.',
    guardCheckbox: 'Create the boot-up task now (recommended)',
    passwordLabel: 'Your DSM password',
    passwordNeeded: 'Enter your password, or untick the box to set it up by hand',
    badPassword: 'DSM did not accept the password',
    createFailed: 'DSM did not create the task. Untick the box and follow the manual steps below.',
    created: 'Boot-up task created and started. Press Next to continue.',
    manualTitle: 'Manual setup, only if you untick the box',
    manualSteps: [
      'Control Panel > Task Scheduler > Create > Triggered Task > User-defined script. User: root. Event: Boot-up.',
      `Run command: ${MANUAL_COMMAND}`,
      'Save, select the task, Run.',
    ],
    uninstallTitle: 'Boot-up task',
    uninstallDesc: 'The "zt-syno-net" boot-up task is removed together with the package. '
      + 'The ZeroTier identity and networks stay on the NAS, so a reinstall keeps the same node ID.',
  },
  ita: {
    networkTitle: 'Rete ZeroTier',
    networkDesc: 'Facoltativo: l\'ID di 16 caratteri della rete a cui collegarsi. Puoi collegarti anche dopo con zerotier-cli.',
    networkLabel: 'ID della rete',
    networkError: 'Un ID di rete è composto da 16 caratteri esadecimali',
    guardTitle: 'Avvio automatico e guardia',
    guardDesc: 'DSM 7 non permette ai pacchetti di terze parti di girare come root, e ZeroTier ha bisogno di un '
      + 'permesso di rete. zt-syno-net lo risolve senza altri pacchetti: crea una sola attività all\'avvio, eseguita '
      + 'da root, che prepara il sistema, dà a ZeroTier il permesso dopo ogni installazione o aggiornamento e fa '
      + 'ripartire il servizio se si ferma. DSM chiede la tua password per creare un\'attività che gira come root.',
    guardCheckbox: 'Crea adesso l\'attività all\'avvio (consigliato)',
    passwordLabel: 'La tua password di DSM',
    passwordNeeded: 'Inserisci la password, oppure togli la spunta per configurarla a mano',
    badPassword: 'DSM non ha accettato la password',
    createFailed: 'DSM non ha creato l\'attività. Togli la spunta e segui i passi manuali qui sotto.',
    created: 'Attività all\'avvio creata e avviata. Premi Avanti per continuare.',
    manualTitle: 'Configurazione manuale, solo se togli la spunta',
    manualSteps: [
      'Pannello di controllo > Utilità di pianificazione > Crea > Attività attivata > Script definito dall\'utente. Utente: root. Evento: Avvio.',
      `Comando da eseguire: ${MANUAL_COMMAND}`,
      'Salva, seleziona l\'attività, Esegui.',
    ],
    uninstallTitle: 'Attività all\'avvio',
    uninstallDesc: 'L\'attività all\'avvio "zt-syno-net" viene rimossa insieme al pacchetto. '
      + 'Identità e reti ZeroTier restano sul NAS, così una reinstallazione mantiene lo stesso node ID.',
  },
};

/** Body of the step's deactivate_v2 handler: "(step, wizard, action) { ... }". */
export function createTaskScript(lang: Lang, guard: GuardOptions = SPKFORGE_GUARD): string {
  const t = TEXTS[lang];
  const task = {
    task_name: TASK_NAME,
    owner: { 0: 'root' },
    event: 'bootup',
    enable: true,
    depend_on_task: '',
    notify_enable: false,
    notify_mail: '',
    notify_if_error: false,
    description: `zt-syno-net guard v${GUARD_VERSION}`,
    operation_type: 'script',
    operation: taskOperation(guard),
  };
  return `(step, wizard, action) {
  var owner = step.owner || wizard;
  var title = ${JSON.stringify(t.guardTitle)};
  var show = function (text) {
    try { if (owner.getMsgBox) { owner.getMsgBox().alert(title, text); return; } } catch (ignore) {}
    window.alert(text);
  };
  var idle = function () { try { if (owner.clearStatusBusy) { owner.clearStatusBusy(); } } catch (ignore) {} };
  try {
    if (action !== 'next' || step.ztDone) { return true; }
    var form = step.getForm();
    var box = form.findField('zt_create_task');
    var pwField = form.findField('zt_admin_password');
    if (!box || !box.getValue()) { if (pwField) { pwField.setValue(''); } step.ztDone = true; return true; }
    var pw = pwField ? pwField.getValue() : '';
    if (!pw) { show(${JSON.stringify(t.passwordNeeded)}); return false; }
    pwField.setValue('');
    var request = function (api, method, version, params, cb) {
      var call = { api: api, method: method, version: version, params: params, scope: step,
        callback: function (success, response) {
          try { cb(success, response); } catch (e) { idle(); show(${JSON.stringify(t.createFailed)} + ' (' + e + ')'); }
        } };
      if (owner.sendWebAPI) { owner.sendWebAPI(call); }
      else if (step.sendWebAPI) { step.sendWebAPI(call); }
      else if (window.SYNO && SYNO.API && SYNO.API.Request) { SYNO.API.Request(call); }
      else { throw new Error('no DSM WebAPI client in this window'); }
    };
    var fail = function (text, response) {
      idle();
      var code = response && response.code ? ' [' + response.code + ']' : '';
      show(text + code);
    };
    var task = ${JSON.stringify(task)};
    try { if (owner.setStatusBusy) { owner.setStatusBusy(); } } catch (ignore) {}
    request('SYNO.Core.User.PasswordConfirm', 'auth', 2, { password: pw }, function (ok, res) {
      pw = '';
      if (!ok || !res || !res.SynoConfirmPWToken) { fail(${JSON.stringify(t.badPassword)}, res); return; }
      task.SynoConfirmPWToken = res.SynoConfirmPWToken;
      request('SYNO.Core.EventScheduler', 'get', 1, { task_name: task.task_name }, function (exists) {
        if (exists) { task.old_task_name = task.task_name; }
        request('SYNO.Core.EventScheduler.Root', exists ? 'set' : 'create', 1, task, function (ok2, res2) {
          if (!ok2) { fail(${JSON.stringify(t.createFailed)}, res2); return; }
          request('SYNO.Core.EventScheduler', 'run', 1, { task_name: task.task_name }, function () {
            idle();
            step.ztDone = true;
            show(${JSON.stringify(t.created)});
          });
        });
      });
    });
    return false;
  } catch (e) {
    idle();
    show(${JSON.stringify(t.createFailed)} + ' (' + e + ')');
    return false;
  }
}`;
}

/** Body of the uninstall step's deactivate_v2 handler: removes the boot-up task. */
export function deleteTaskScript(): string {
  return `(step, wizard, action) {
  if (action !== 'next' || step.ztDone) { return true; }
  step.ztDone = true;
  var call = { api: 'SYNO.Core.EventScheduler', method: 'delete', version: 1,
    params: { task_name: ${JSON.stringify(TASK_NAME)} }, callback: function () {}, scope: step };
  if (window.SYNO && SYNO.API && SYNO.API.Request) { SYNO.API.Request(call); } else { (step.owner || wizard).sendWebAPI(call); }
  return true;
}`;
}

function guardStep(lang: Lang, guard: GuardOptions) {
  const t = TEXTS[lang];
  return {
    step_title: t.guardTitle,
    invalid_next_disabled_v2: false,
    items: [
      { desc: t.guardDesc },
      { type: 'multiselect', subitems: [{ key: 'zt_create_task', desc: t.guardCheckbox, defaultValue: true }] },
      { type: 'password', subitems: [{ key: 'zt_admin_password', desc: t.passwordLabel, defaultValue: '', validator: { allowBlank: true } }] },
      { desc: `<b>${t.manualTitle}</b><br>${t.manualSteps.join('<br>')}` },
    ],
    deactivate_v2: createTaskScript(lang, guard),
  };
}

export function installWizard(lang: Lang, guard: GuardOptions = SPKFORGE_GUARD): string {
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
    guardStep(lang, guard),
  ], null, 2);
}

export function upgradeWizard(lang: Lang, guard: GuardOptions = SPKFORGE_GUARD): string {
  return JSON.stringify([guardStep(lang, guard)], null, 2);
}

export function uninstallWizard(lang: Lang): string {
  const t = TEXTS[lang];
  return JSON.stringify([{ step_title: t.uninstallTitle, items: [{ desc: t.uninstallDesc }], deactivate_v2: deleteTaskScript() }], null, 2);
}

/** Every wizard file of the package, keyed by its path inside the SPK. */
export function wizardFiles(guard: GuardOptions = SPKFORGE_GUARD): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [suffix, lang] of [['', 'enu'], ['_enu', 'enu'], ['_ita', 'ita']] as const) {
    files[`WIZARD_UIFILES/install_uifile${suffix}`] = installWizard(lang, guard);
    files[`WIZARD_UIFILES/upgrade_uifile${suffix}`] = upgradeWizard(lang, guard);
    files[`WIZARD_UIFILES/uninstall_uifile${suffix}`] = uninstallWizard(lang);
  }
  return files;
}
