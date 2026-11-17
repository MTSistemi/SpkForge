// Install, upgrade and uninstall wizards for zt-syno-net, in English and Italian.
// DSM picks WIZARD_UIFILES/<name>_<lang> when it exists, else <name>.
//
// The "automatic start and guard" step creates the root boot-up task itself,
// from the admin's DSM session: it confirms the admin password
// (SYNO.Core.User.PasswordConfirm), creates or updates the task
// (SYNO.Core.EventScheduler.Root), and runs it at once. Package Center runs the
// step's deactivate_v2 code when the admin presses Next. The password is wiped
// from the form right after use, so it never reaches the package scripts.

import { GUARD_VERSION, manualCommand, taskOperation, type GuardOptions } from './guard.ts';

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
  alreadyDone: string;
  manualTitle: string;
  manualSteps: string[];
  uninstallTitle: string;
  uninstallDesc: string;
}

/** Placeholder in manualSteps, replaced by manualCommand() for the package being built. */
const MANUAL_COMMAND = '@MANUAL_COMMAND@';
/** Where a build installs the manual launcher: bin/<package>-guard. */
export function launcherPath(guard: GuardOptions): string {
  return `/var/packages/${guard.pkg}/target/bin/${guard.pkg}-guard`;
}
export const LAUNCHER_PATH = launcherPath(SPKFORGE_GUARD);

/** The texts with the package's own name: they are written for "zt-syno-net". */
function textsFor(lang: Lang, guard: GuardOptions): Texts {
  const named = (s: string) => s.replace(/zt-syno-net/g, guard.pkg);
  const source = TEXTS[lang];
  return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, Array.isArray(v) ? v.map(named) : named(v)])) as unknown as Texts;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    alreadyDone: 'The boot-up task is already in place and up to date: nothing to do here, press Next.',
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
    networkDesc: 'Facoltativo: l\'ID di 16 caratteri della rete a cui collegare il NAS. Il collegamento si può fare anche dopo, dall\'app ZeroTier o con zerotier-cli.',
    networkLabel: 'ID della rete',
    networkError: 'Un ID di rete è composto da 16 caratteri esadecimali',
    guardTitle: 'Avvio automatico e guardiano',
    guardDesc: 'DSM 7 non permette ai pacchetti di terze parti di girare come root, e ZeroTier ha bisogno di un '
      + 'permesso di rete. zt-syno-net lo risolve senza altri pacchetti: crea una sola attività all\'avvio, eseguita '
      + 'da root, che prepara il sistema, dà a ZeroTier il permesso dopo ogni installazione o aggiornamento e fa '
      + 'ripartire il servizio se si ferma. Per creare un\'attività eseguita da root, DSM richiede la password dell\'amministratore.',
    guardCheckbox: 'Creare adesso l\'attività all\'avvio (consigliato)',
    passwordLabel: 'Password DSM dell\'amministratore',
    passwordNeeded: 'Serve la password, oppure va tolta la spunta per la configurazione manuale',
    badPassword: 'DSM non ha accettato la password',
    createFailed: 'DSM non ha creato l\'attività. Togliere la spunta e seguire i passi manuali qui sotto.',
    created: 'Attività all\'avvio creata e avviata. Avanti per continuare.',
    alreadyDone: 'L\'attività all\'avvio esiste già ed è aggiornata: non serve altro, Avanti per continuare.',
    manualTitle: 'Configurazione manuale, solo senza la spunta',
    manualSteps: [
      'Pannello di controllo > Utilità di pianificazione > Crea > Attività attivata > Script definito dall\'utente. Utente: root. Evento: Avvio.',
      `Comando da eseguire: ${MANUAL_COMMAND}`,
      'Salva, poi selezionare l\'attività ed Esegui.',
    ],
    uninstallTitle: 'Attività all\'avvio',
    uninstallDesc: 'L\'attività all\'avvio "zt-syno-net" viene rimossa insieme al pacchetto. '
      + 'Identità e reti ZeroTier restano sul NAS, così una reinstallazione mantiene lo stesso node ID.',
  },
};

/**
 * Body of the step's deactivate_v2 handler. Package Center builds the function
 * with eval(String.format("fn = function(){0};", body)) and calls it as
 * fn(step, wizard, action): the body must be "{ ... }" alone, and the
 * arguments are read from `arguments`.
 */
export function createTaskScript(lang: Lang, guard: GuardOptions = SPKFORGE_GUARD): string {
  const t = textsFor(lang, guard);
  const task = {
    task_name: guard.pkg,
    owner: { 0: 'root' },
    event: 'bootup',
    enable: true,
    depend_on_task: '',
    notify_enable: false,
    notify_mail: '',
    notify_if_error: false,
    description: `${guard.pkg} guard v${GUARD_VERSION}`,
    operation_type: 'script',
    operation: taskOperation(guard),
  };
  return `{
  var step = arguments[0], wizard = arguments[1], action = arguments[2];
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
    // DSM's WebAPI clients hand errors over either as { code } or as { error: { code } }
    // (SYNO.API.Request on DSM 7.1 does the latter): read both.
    var errOf = function (response) {
      if (!response) { return null; }
      if (response.code) { return response; }
      return response.error && response.error.code ? response.error : null;
    };
    var codeOf = function (response) { var e = errOf(response); return e ? e.code : 0; };
    var fail = function (text, response) {
      idle();
      var e = errOf(response);
      var code = e ? ' [' + e.code + (e.errors ? ' ' + JSON.stringify(e.errors) : '') + ']' : '';
      show(text + code);
    };
    var task = ${JSON.stringify(task)};
    try { if (owner.setStatusBusy) { owner.setStatusBusy(); } } catch (ignore) {}
    // DSM 7.2+ answers version 2 with the token EventScheduler.Root wants. DSM 7.0/7.1
    // only have version 1 (104 on version 2) and no .Root API: there the check proves
    // the password and the task is created without a token (see below).
    var confirm = function (version, cb) { request('SYNO.Core.User.PasswordConfirm', 'auth', version, { password: pw }, cb); };
    // A wrong password fails with a code (3121 on DSM 7.1). Version 1 accepts a good
    // one with success and no data at all, so the answer is judged by the flag only.
    var after = function (ok, res) {
      pw = '';
      if (!ok) { fail(${JSON.stringify(t.badPassword)}, res); return; }
      if (res && res.SynoConfirmPWToken) { task.SynoConfirmPWToken = res.SynoConfirmPWToken; }
      // DSM answers get/set/run on a task that does not exist with success and no
      // data, so "exists" means "get returned the task", and the result is checked
      // with list at the end instead of trusting the success flags.
      request('SYNO.Core.EventScheduler', 'get', 1, { task_name: task.task_name }, function (okGet, found) {
        var exists = !!(okGet && found && found.task_name === task.task_name);
        if (exists) { task.old_task_name = task.task_name; }
        var method = exists ? 'set' : 'create';
        var created = function (ok2, res2) {
          if (!ok2) { fail(${JSON.stringify(t.createFailed)}, res2); return; }
          request('SYNO.Core.EventScheduler', 'list', 1, {}, function (okList, tasks) {
            var present = false;
            if (okList && tasks && tasks.length) {
              for (var i = 0; i < tasks.length; i++) { if (tasks[i].task_name === task.task_name) { present = true; } }
            }
            if (!present) { fail(${JSON.stringify(t.createFailed)}, res2); return; }
            request('SYNO.Core.EventScheduler', 'run', 1, { task_name: task.task_name }, function () {
              idle();
              step.ztDone = true;
              show(${JSON.stringify(t.created)});
            });
          });
        };
        // DSM 7.2 and later create root tasks through EventScheduler.Root, with the
        // password token. DSM 7.0 and 7.1 have no such API and let an administrator
        // create a root task through EventScheduler itself, as their Task Scheduler
        // does. No token means the old password check answered: go there directly.
        // With a token, a missing .Root (102: no such API, 103/104: method or version
        // not there) still falls back.
        var legacyCreate = function () {
          var legacy = {};
          for (var k in task) { if (k !== 'SynoConfirmPWToken') { legacy[k] = task[k]; } }
          request('SYNO.Core.EventScheduler', method, 1, legacy, created);
        };
        if (!task.SynoConfirmPWToken) { legacyCreate(); return; }
        request('SYNO.Core.EventScheduler.Root', method, 1, task, function (ok2, res2) {
          var code = codeOf(res2);
          if (!ok2 && (code === 102 || code === 103 || code === 104)) { legacyCreate(); return; }
          created(ok2, res2);
        });
      });
    };
    confirm(2, function (ok2pw, res2pw) {
      if (!ok2pw && codeOf(res2pw) === 104) { confirm(1, after); return; }
      after(ok2pw, res2pw);
    });
    return false;
  } catch (e) {
    idle();
    show(${JSON.stringify(t.createFailed)} + ' (' + e + ')');
    return false;
  }
}`;
}

/**
 * Body of the step's activate_v2 handler: when the boot-up task already exists
 * with exactly this build's command (an upgrade that does not change the
 * guard), mark the step done so Next goes straight on and no password is asked.
 * The whole command is compared, not the version in the description, so any
 * change to the guard updates the task.
 */
export function checkTaskScript(lang: Lang, guard: GuardOptions = SPKFORGE_GUARD): string {
  const t = textsFor(lang, guard);
  return `{
  var step = arguments[0], wizard = arguments[1];
  try {
    var owner = step.owner || wizard;
    var call = { api: 'SYNO.Core.EventScheduler', method: 'get', version: 1,
      params: { task_name: ${JSON.stringify(guard.pkg)} }, scope: step,
      callback: function (ok, found) {
        if (!ok || !found || found.task_name !== ${JSON.stringify(guard.pkg)}) { return; }
        if (found.operation !== ${JSON.stringify(taskOperation(guard))}) { return; }
        step.ztDone = true;
        var form = step.getForm();
        var box = form.findField('zt_create_task');
        var pwField = form.findField('zt_admin_password');
        if (box) { box.setValue(false); box.disable(); }
        if (pwField) { pwField.setValue(''); pwField.disable(); }
        try { owner.getMsgBox().alert(${JSON.stringify(t.guardTitle)}, ${JSON.stringify(t.alreadyDone)}); } catch (ignore) {}
      } };
    if (owner.sendWebAPI) { owner.sendWebAPI(call); }
    else if (window.SYNO && SYNO.API && SYNO.API.Request) { SYNO.API.Request(call); }
  } catch (ignore) {}
}`;
}

/** Body of the uninstall step's deactivate_v2 handler: removes the boot-up task. */
export function deleteTaskScript(guard: GuardOptions = SPKFORGE_GUARD): string {
  return `{
  var step = arguments[0], wizard = arguments[1], action = arguments[2];
  if (action !== 'next' || step.ztDone) { return true; }
  step.ztDone = true;
  var call = { api: 'SYNO.Core.EventScheduler', method: 'delete', version: 1,
    params: { task_name: ${JSON.stringify(guard.pkg)} }, callback: function () {}, scope: step };
  if (window.SYNO && SYNO.API && SYNO.API.Request) { SYNO.API.Request(call); } else { (step.owner || wizard).sendWebAPI(call); }
  return true;
}`;
}

function guardStep(lang: Lang, guard: GuardOptions) {
  const t = textsFor(lang, guard);
  return {
    step_title: t.guardTitle,
    invalid_next_disabled_v2: false,
    items: [
      { desc: t.guardDesc },
      { type: 'multiselect', subitems: [{ key: 'zt_create_task', desc: t.guardCheckbox, defaultValue: true }] },
      { type: 'password', subitems: [{ key: 'zt_admin_password', desc: t.passwordLabel, defaultValue: '', validator: { allowBlank: true } }] },
      {
        desc: `<b>${t.manualTitle}</b><br>${t.manualSteps.join('<br>')}`
          .replace(MANUAL_COMMAND, `<code>${escapeHtml(manualCommand(guard, launcherPath(guard)))}</code>`),
      },
    ],
    activate_v2: checkTaskScript(lang, guard),
    deactivate_v2: createTaskScript(lang, guard),
  };
}

export function installWizard(lang: Lang, guard: GuardOptions = SPKFORGE_GUARD): string {
  const t = textsFor(lang, guard);
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

export function uninstallWizard(lang: Lang, guard: GuardOptions = SPKFORGE_GUARD): string {
  const t = textsFor(lang, guard);
  return JSON.stringify([{ step_title: t.uninstallTitle, items: [{ desc: t.uninstallDesc }], deactivate_v2: deleteTaskScript(guard) }], null, 2);
}

/** Every wizard file of the package, keyed by its path inside the SPK. */
export function wizardFiles(guard: GuardOptions = SPKFORGE_GUARD): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [suffix, lang] of [['', 'enu'], ['_enu', 'enu'], ['_ita', 'ita']] as const) {
    files[`WIZARD_UIFILES/install_uifile${suffix}`] = installWizard(lang, guard);
    files[`WIZARD_UIFILES/upgrade_uifile${suffix}`] = upgradeWizard(lang, guard);
    files[`WIZARD_UIFILES/uninstall_uifile${suffix}`] = uninstallWizard(lang, guard);
  }
  return files;
}
