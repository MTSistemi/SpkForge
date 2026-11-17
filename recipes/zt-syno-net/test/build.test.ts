import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { archMatches, parseInfo, readSpk, readTar, validateSpk } from '@spkforge/spk';
import { buildSpk, type BuildTarget } from '../build.ts';
import { renderIcon } from '../icon.ts';
import { installWizard, upgradeWizard, uninstallWizard, SPKFORGE_GUARD, LAUNCHER_PATH } from '../wizard.ts';
import { guardScript, manualCommand, taskOperation } from '../guard.ts';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FAKE_BINARY = new Uint8Array(64 * 1024).fill(0x7f);

const ALL = { x86_64: FAKE_BINARY, armv8: FAKE_BINARY, armv7: FAKE_BINARY, i686: FAKE_BINARY };

function build(target: BuildTarget = 'x86_64') {
  return buildSpk({ target, binaries: ALL, upstreamVersion: '1.16.2', build: 1 });
}

test('builds a valid, unsigned SPK that depends on no other package', () => {
  const result = build();
  assert.equal(result.fileName, 'zt-syno-net_x86_64_1.16.2-1.spk');
  const spk = readSpk(result.bytes);
  assert.deepEqual(validateSpk(spk), []);
  assert.equal(spk.id, 'zt-syno-net');
  assert.equal(spk.version, '1.16.2-1');
  assert.equal(spk.signed, false);
  assert.equal(spk.info.install_dep_packages, undefined);
  assert.equal(spk.info.install_dep_services, undefined);
  assert.equal(spk.info.install_conflict_packages, 'zerotier');
  assert.ok(spk.icon && spk.icon256);
});

test('INFO targets the right platforms per family', () => {
  assert.ok(archMatches(readSpk(build('x86_64').bytes).arch, 'geminilake'));
  assert.ok(!archMatches(readSpk(build('x86_64').bytes).arch, 'rtd1619b'));
  assert.ok(archMatches(readSpk(build('armv8').bytes).arch, 'rtd1619b'));
  assert.ok(archMatches(readSpk(build('armv7').bytes).arch, 'armada38x'));
  assert.ok(archMatches(readSpk(build('i686').bytes).arch, 'evansport'));
});

test('universal package is noarch and carries a build for every CPU family', () => {
  const result = build('universal');
  assert.equal(result.fileName, 'zt-syno-net_universal_1.16.2-1.spk');
  const spk = readSpk(result.bytes);
  assert.deepEqual(spk.arch, ['noarch']);
  assert.deepEqual(validateSpk(spk), []);
  for (const platform of ['geminilake', 'v1000', 'epyc7002', 'rtd1619b', 'armada38x', 'evansport', 'some-future-platform']) {
    assert.ok(archMatches(spk.arch, platform), platform);
  }
  const tgz = readTar(result.bytes).find((e) => e.name === 'package.tgz')!;
  const names = readTar(gunzipSync(tgz.data)).map((e) => e.name);
  for (const family of ['x86_64', 'armv8', 'armv7', 'i686']) assert.ok(names.includes(`bin/zerotier-one-${family}`), family);
  assert.ok(names.includes('bin/zt-syno-net-env'));
});

test('payload holds executable binaries and its md5 matches INFO checksum', () => {
  const entries = readTar(build().bytes);
  const tgz = entries.find((e) => e.name === 'package.tgz')!;
  const info = parseInfo(new TextDecoder().decode(entries.find((e) => e.name === 'INFO')!.data));
  assert.equal(info.checksum, createHash('md5').update(tgz.data).digest('hex'));
  const payload = readTar(gunzipSync(tgz.data));
  const byName = new Map(payload.map((e) => [e.name, e]));
  for (const name of ['bin/zerotier-one-x86_64', 'bin/zerotier-cli', 'bin/zt-syno-net-supervise', 'bin/zt-syno-net-guard']) {
    assert.equal(byName.get(name)?.mode, 0o755, name);
  }
  assert.deepEqual(new Uint8Array(byName.get('bin/zerotier-one-x86_64')!.data), FAKE_BINARY);
});

test('control scripts are executable, privilege file runs as package user', () => {
  const entries = readTar(build().bytes);
  const byName = new Map(entries.map((e) => [e.name, e]));
  for (const name of ['start-stop-status', 'postinst', 'preinst', 'preuninst', 'postuninst', 'preupgrade', 'postupgrade']) {
    assert.equal(byName.get(`scripts/${name}`)?.mode, 0o755, name);
  }
  const privilege = JSON.parse(new TextDecoder().decode(byName.get('conf/privilege')!.data));
  assert.equal(privilege.defaults['run-as'], 'package');
  assert.ok(!entries.some((e) => /spm|SimplePermission/i.test(e.name)));
  const allText = entries.filter((e) => e.type === 'file' && !e.name.endsWith('.PNG') && e.name !== 'package.tgz')
    .map((e) => new TextDecoder().decode(e.data)).join('\n');
  assert.ok(!/spm-exec|SimplePermissionManager/.test(allText.replace(/not SPM|no privilege broker/g, '')));
});

test('package-user scripts use no root-only tools (getcap/setcap are mode 0700 on DSM)', () => {
  const entries = readTar(build().bytes);
  const startScript = new TextDecoder().decode(entries.find((e) => e.name === 'scripts/start-stop-status')!.data);
  assert.doesNotMatch(startScript.replace(/^\s*#.*$/gm, ''), /getcap|setcap/);
  assert.ok(startScript.includes('CAPS_MARK="/run/zt-syno-net.caps"'), 'reads the root-owned marker in /run');
  assert.match(startScript, /identity\.secret" \] && \[ ! -r /, 'must refuse to start with an unreadable identity');
});

test('the root guard never follows symlinks or recurses into package-owned paths', () => {
  const guard = guardScript(SPKFORGE_GUARD);
  assert.match(guard, /^PKG_USER="zt-syno-net"$/m);
  assert.doesNotMatch(guard, /chown -R|cp -p|rm -rf/);
  assert.match(guard, /plain_file\(\) \{ \[ -f "\$1" \] && \[ ! -L "\$1" \]; \}/);
  assert.match(guard, /install -o "\$PKG_USER" -g "\$g" -m 0600 "\$old\/identity\.secret"/);
  assert.match(guard, /chown -h /);
  assert.match(guard, /MARK="\/run\/\$PKG\.caps"/);
  assert.match(guard, /setcap -r/, 'removes the capability again if the file changed under it');
  assert.ok(guard.indexOf('chmod 0700 "$d"') < guard.indexOf('setcap cap_net_admin'), 'only the package user may run the capable binary');
});

test('the guard leaves the cgroup of whoever started it before its loop', () => {
  // Seen on DSM: a guard started from a service's process tree died when systemd
  // stopped that service (setsid does not change the cgroup).
  const guard = guardScript(SPKFORGE_GUARD);
  const move = guard.indexOf('cgroup.procs');
  assert.ok(move > 0, 'moves itself to the root cgroups');
  assert.match(guard, /for r in \$\(awk '\$3 == "cgroup" \{ print \$2 \}' \/proc\/mounts\); do echo \$\$ > "\$r\/cgroup\.procs" 2>\/dev\/null; done/);
  assert.ok(move > guard.indexOf('echo $$ > "$PIDF"') && move < guard.indexOf('while :; do'), 'after the handover, before the loop');
  assert.ok(!taskOperation(SPKFORGE_GUARD).includes('%'));
});

test('the package never starts while an old identity waits to be migrated', () => {
  const guard = guardScript(SPKFORGE_GUARD);
  assert.match(guard, /^MIGRATING="\/run\/\$PKG\.migrating"$/m);
  // Matched on process name and executable: the shell running the boot-up task
  // has the whole guard text, "zerotier-one" included, on its command line.
  assert.match(guard, /for c in \/proc\/\[0-9\]\*\/comm; do/);
  assert.doesNotMatch(guard, /ps -eo args/);
  assert.match(guard, /ensure_running\(\) \{[\s\S]*?\[ -e "\$MIGRATING" \] && return[\s\S]*?synopkg start/);
  const loop = guard.slice(guard.indexOf('while :; do'));
  assert.ok(loop.indexOf('migrate') < loop.indexOf('ensure_caps'), 'the marker exists before the capability lets the package start');
  const sss = readFileSync(new URL('../spk/scripts/start-stop-status', import.meta.url), 'utf8');
  assert.match(sss, /^MIGRATING="\/run\/zt-syno-net\.migrating"$/m);
  assert.ok(sss.indexOf('migration_pending; then') > sss.indexOf('caps_ready; then'), 'start checks the migration after the capability');
});

test('start waits for the guard to load tun before failing (first install races the guard)', () => {
  // Package Center starts the package right after installing it; the guard loads tun on its
  // next round, up to 5 seconds later. Seen on DSM 7.3: "/dev/net/tun is not ready" at install.
  const sss = readFileSync(new URL('../spk/scripts/start-stop-status', import.meta.url), 'utf8');
  const wait = sss.indexOf('tun_ready && caps_ready && break');
  assert.ok(wait > 0, 'start waits for both tun and the capability');
  assert.ok(sss.indexOf('/dev/net/tun is not ready') > wait, 'the tun error comes only after the wait');
  assert.match(sss, /\[ \$i -ge 15 \] && ! guard_running && break/);
  const svc = readFileSync(new URL('../../../contrib/spksrc/spk/zerotier-one/src/service-setup.sh', import.meta.url), 'utf8');
  const svcWait = svc.indexOf('zt_tun_ready && zt_caps_ready && break');
  assert.ok(svcWait > 0, 'the spksrc service setup waits as well');
  assert.ok(svc.indexOf('/dev/net/tun is not ready') > svcWait);
});

test('guard behaviour: migrates past a task shell, waits for a real zerotier-one', { skip: process.platform !== 'linux' && 'needs Linux /proc' }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'zt-guard-'));
  const user = spawnSync('id', ['-un']).stdout.toString().trim();
  const sh = (cmd: string) => spawnSync('sh', ['-c', cmd], { stdio: 'pipe' });
  const pkg = join(root, 'pkg');
  const daemon = join(pkg, 'target/bin/zerotier-one');
  sh(`mkdir -p ${pkg}/target/bin ${pkg}/var ${root}/old/networks.d ${root}/run ${root}/stub ${root}/fake
      touch ${pkg}/INFO ${pkg}/enabled; cp "$(command -v sleep)" ${daemon}
      printf 'pub' > ${root}/old/identity.public; printf 'sec' > ${root}/old/identity.secret
      : > ${root}/old/networks.d/0123456789abcdef.conf
      cp "$(command -v sleep)" ${root}/fake/zerotier-one`);
  const stub = (name: string, body: string) => {
    writeFileSync(join(root, 'stub', name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  };
  stub('synopkg', `echo "$*" >> ${root}/synopkg.calls; echo '{"status":"stop"}'`);
  stub('setcap', 'exit 0');
  stub('getcap', 'echo "$1 cap_net_admin,cap_net_raw=ep"');
  stub('lsmod', 'echo tun');
  for (const t of ['insmod', 'modprobe', 'mknod']) stub(t, 'exit 0');
  const script = guardScript({ pkg: 'zt-syno-net', user, daemon })
    .replace('PKG_DIR="/var/packages/$PKG"', `PKG_DIR="${pkg}"`)
    .replace(/^OLD_DIRS=.*$/m, `OLD_DIRS="${root}/old"`)
    .replace(/"\/run\//g, `"${root}/run/`)
    .replace(/^LOG=.*$/m, `LOG="${root}/guard.log"`)
    .replace(/^export PATH=.*$/m, `export PATH=${root}/stub:$PATH`);
  writeFileSync(join(root, 'guard.sh'), script);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const { spawn } = await import('node:child_process');
  const procs: Array<ReturnType<typeof spawn>> = [];
  const run = (cmd: string, args: string[]) => { const p = spawn(cmd, args, { stdio: 'ignore' }); procs.push(p); return p; };
  try {
    // 1. Only a shell whose command line mentions zerotier-one (the task runner): migrate at once.
    run('sh', ['-c', 'sleep 20 # cat > /run/zt-syno-net-guard.sh ... zerotier-one-x86_64 ...']);
    const g1 = run('sh', [join(root, 'guard.sh')]);
    await wait(1500);
    assert.equal(readFileSync(join(pkg, 'var/identity.secret'), 'utf8'), 'sec', 'migrated despite the task shell');
    assert.equal(sh(`test -f ${pkg}/var/networks.d/0123456789abcdef.conf`).status, 0, 'networks moved too');
    assert.equal(sh(`test -e ${root}/run/zt-syno-net.migrating`).status, 1, 'no marker after the migration');
    g1.kill('SIGKILL');
    // 2. A real other zerotier-one runs: the guard waits, keeps the marker and does not start the package.
    sh(`rm -rf ${pkg}/var/* ${root}/synopkg.calls ${root}/run/*`);
    const other = run(join(root, 'fake/zerotier-one'), ['30']);
    run('sh', [join(root, 'guard.sh')]);
    await wait(1500);
    assert.equal(sh(`test -e ${pkg}/var/identity.secret`).status, 1, 'no migration while the old daemon runs');
    assert.equal(sh(`test -e ${root}/run/zt-syno-net.migrating`).status, 0, 'marker tells the package to wait');
    const calls = sh(`cat ${root}/synopkg.calls 2>/dev/null`).stdout.toString();
    assert.doesNotMatch(calls, /start/, 'the guard does not start the package while the migration waits');
    other.kill('SIGKILL');
    await wait(6500);
    assert.equal(readFileSync(join(pkg, 'var/identity.secret'), 'utf8'), 'sec', 'migrated once the old daemon stopped');
    assert.equal(sh(`test -e ${root}/run/zt-syno-net.migrating`).status, 1, 'marker removed');
    assert.equal(sh(`grep -c 'migration waits' ${root}/guard.log`).stdout.toString().trim(), '1', 'the wait is logged once');
  } finally {
    for (const p of procs) p.kill('SIGKILL');
    rmSync(root, { recursive: true, force: true });
  }
});

test('the boot-up task embeds the guard and stays under DSM limits', () => {
  const op = taskOperation(SPKFORGE_GUARD);
  assert.ok(op.length < 8192, `task command is ${op.length} characters, DSM allows 8192`);
  assert.ok(!op.includes('%'), 'DSM rejects task commands containing a percent sign (error 117)');
  assert.ok(op.includes(guardScript(SPKFORGE_GUARD).trimEnd()), 'the guard text is inside the task, not read from the package');
  assert.match(op, /setsid \/bin\/sh \/run\/zt-syno-net-guard\.sh/);
  const guard = guardScript(SPKFORGE_GUARD);
  assert.ok(guard.includes(`tr '\\000' ' ' < "/proc/$old/cmdline"`), 'a guard of another build is replaced only after /proc confirms it is a guard');
  assert.ok(guard.indexOf('kill "$old"') > guard.indexOf('/proc/$old/cmdline'));
  for (const lang of ['enu', 'ita'] as const) {
    const step = JSON.parse(upgradeWizard(lang))[0];
    assert.ok(step.activate_v2.includes(JSON.stringify(op)), `${lang}: the task counts as up to date only with this exact command`);
  }
});

test('shell scripts parse (sh -n)', { skip: spawnSync('sh', ['-c', 'exit 0']).status !== 0 && 'no sh' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'zt-sh-'));
  const tgz = readTar(build().bytes).find((e) => e.name === 'package.tgz')!;
  const scripts: Record<string, string> = { 'guard.sh': taskOperation(SPKFORGE_GUARD), 'guard-body.sh': guardScript(SPKFORGE_GUARD) };
  for (const e of readTar(gunzipSync(tgz.data))) if (e.name.startsWith('bin/zt-') || e.name === 'bin/zerotier-cli') scripts[e.name.replace('bin/', '')] = new TextDecoder().decode(e.data);
  for (const e of readTar(build().bytes)) if (e.name.startsWith('scripts/')) scripts[e.name.replace('scripts/', 'script-')] = new TextDecoder().decode(e.data);
  for (const [name, text] of Object.entries(scripts)) {
    const path = join(dir, name);
    writeFileSync(path, text);
    const r = spawnSync('sh', ['-n', path], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${name}: ${r.stderr}`);
  }
  rmSync(dir, { recursive: true, force: true });
});

test('wizard JavaScript is valid and wipes the password before any request', () => {
  for (const lang of ['enu', 'ita'] as const) {
    const install = JSON.parse(installWizard(lang));
    const step = install[1];
    for (const [key, body] of [['create', step.deactivate_v2], ['check', step.activate_v2], ['delete', JSON.parse(uninstallWizard(lang))[0].deactivate_v2]] as const) {
      // Exactly how Package Center builds it: eval(String.format('fn = function(){0};', body)).
      const source = 'fn = function(){0};'.replace('{0}', body);
      let fn: unknown;
      assert.doesNotThrow(() => { fn = new Function(`let fn; ${source} return fn;`)(); }, `${lang} ${key}`);
      assert.equal(typeof fn, 'function', `${lang} ${key}`);
      assert.ok(body.startsWith('{') && body.endsWith('}'), 'body only, no parameter list');
    }
    const body = step.deactivate_v2 as string;
    assert.ok(body.indexOf("pwField.setValue('')") < body.indexOf('var request'), 'password cleared before any request is built');
    assert.match(body, /SYNO\.Core\.EventScheduler\.Root/);
    assert.match(body, /SYNO\.Core\.User\.PasswordConfirm/);
    const keys = step.items.flatMap((i: { subitems?: { key: string }[] }) => (i.subitems ?? []).map((s) => s.key));
    assert.deepEqual(keys, ['zt_create_task', 'zt_admin_password']);
    assert.match(body, /owner\.sendWebAPI/, 'uses the wizard window WebAPI client first');
    assert.match(body, /catch \(e\)/, 'errors are shown, never swallowed');
    assert.match(body, /found\.task_name === task\.task_name/, 'get succeeds even for a missing task: check its data');
    assert.ok(body.indexOf("'list'") < body.indexOf("'run'"), 'verify the task exists before reporting success');
    assert.equal(JSON.parse(upgradeWizard(lang))[0].deactivate_v2, body);
  }
});

test('wizard creates the task on DSM 7.2+ (EventScheduler.Root) and on DSM 7.0/7.1 (no .Root API)', () => {
  // Runs the install step's handler against a fake DSM. DSM 7.1 answers 102 (no such API)
  // for SYNO.Core.EventScheduler.Root and creates root tasks through EventScheduler itself.
  const run = (hasRoot: boolean) => {
    const body = JSON.parse(installWizard('enu'))[1].deactivate_v2 as string;
    const fn = new Function(`let fn; ${'fn = function(){0};'.replace('{0}', body)} return fn;`)() as (...a: unknown[]) => unknown;
    const calls: { api: string; method: string; version: number; params: Record<string, unknown> }[] = [];
    let created = false;
    const fields: Record<string, { v: unknown; getValue(): unknown; setValue(x: unknown): void }> = {};
    for (const [k, v] of [['zt_create_task', true], ['zt_admin_password', 'secret']] as const) {
      fields[k] = { v, getValue() { return this.v; }, setValue(x) { this.v = x; } };
    }
    const messages: string[] = [];
    const owner = {
      getMsgBox: () => ({ alert: (_t: string, m: string) => messages.push(m) }),
      sendWebAPI(c: { api: string; method: string; version: number; params: Record<string, unknown>; callback: (ok: boolean, r: unknown) => void }) {
        calls.push({ api: c.api, method: c.method, version: c.version, params: c.params });
        const reply = (ok: boolean, r: unknown) => c.callback(ok, r);
        // DSM 7.1: PasswordConfirm has version 1 only, and its answer carries no token.
        if (c.api === 'SYNO.Core.User.PasswordConfirm') {
          if (!hasRoot) return c.version === 1 ? reply(true, {}) : reply(false, { code: 104 });
          return reply(true, { SynoConfirmPWToken: 'tok' });
        }
        if (c.api === 'SYNO.Core.EventScheduler.Root') {
          if (!hasRoot) return reply(false, { code: 102 });
          created = true; return reply(true, {});
        }
        if (c.method === 'get') return reply(true, {});
        if (c.method === 'create') { created = true; return reply(true, {}); }
        if (c.method === 'list') return reply(true, created ? [{ task_name: 'zt-syno-net' }] : []);
        return reply(true, {});
      },
    };
    const step = { owner, getForm: () => ({ findField: (k: string) => fields[k] }) } as Record<string, unknown>;
    fn(step, {}, 'next');
    return { calls, step, messages };
  };
  const legacy = run(false);
  const create = legacy.calls.find((c) => c.api === 'SYNO.Core.EventScheduler' && c.method === 'create');
  assert.deepEqual(legacy.calls.filter((c) => c.api === 'SYNO.Core.User.PasswordConfirm').map((c) => c.version), [2, 1], 'password checked with version 1 after 104');
  assert.ok(create, 'falls back to EventScheduler.create');
  assert.deepEqual(create.params.owner, { 0: 'root' });
  assert.equal(create.params.SynoConfirmPWToken, undefined, 'no password token to the old API');
  assert.equal(typeof create.params.operation, 'string');
  assert.equal(legacy.step.ztDone, true, 'task verified with list and run');
  assert.ok(legacy.calls.some((c) => c.method === 'run'));
  const current = run(true);
  assert.ok(!current.calls.some((c) => c.api === 'SYNO.Core.EventScheduler' && c.method === 'create'), 'DSM 7.2 uses .Root only');
  assert.equal(current.calls.find((c) => c.api === 'SYNO.Core.EventScheduler.Root')!.params.SynoConfirmPWToken, 'tok');
  assert.equal(current.step.ztDone, true);
});

test('firewall rule lives inside the payload, where conf/resource points', () => {
  const entries = readTar(build().bytes);
  const resource = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === 'conf/resource')!.data));
  const protocolFile = resource['port-config']['protocol-file'] as string;
  const payload = readTar(gunzipSync(entries.find((e) => e.name === 'package.tgz')!.data)).map((e) => e.name);
  assert.ok(payload.includes(protocolFile), `${protocolFile} must be inside package.tgz`);
  assert.deepEqual(resource['usr-local-linker'].bin, ['bin/zerotier-cli']);
  assert.ok(payload.includes('bin/zerotier-cli'));
  assert.ok(!entries.some((e) => e.name.endsWith('.sc')), 'no .sc at the SPK root');
});

test('the DSM app is registered, served by DSM and admin-only', () => {
  const entries = readTar(build().bytes);
  const info = parseInfo(new TextDecoder().decode(entries.find((e) => e.name === 'INFO')!.data));
  assert.equal(info.dsmuidir, 'app');
  const payload = readTar(gunzipSync(entries.find((e) => e.name === 'package.tgz')!.data));
  const byName = new Map(payload.map((e) => [e.name, e]));
  const config = JSON.parse(new TextDecoder().decode(byName.get('app/config')!.data));
  // DSM 7 opens "legacy"/"url" apps in a separate tab without the DSM session:
  // the app must be a real DSM window.
  const app = config['ZtSynoNet.js'][info.dsmappname!];
  assert.ok(app, 'dsmappname matches the app key in app/config');
  assert.equal(app.type, 'app');
  assert.equal(app.allUsers, false);
  assert.ok(config['ZtSynoNet.js'][app.appWindow], 'the app window is declared');
  const windowJs = new TextDecoder().decode(byName.get('app/ZtSynoNet.js')!.data);
  assert.doesNotThrow(() => new Function(windowJs));
  assert.ok(windowJs.includes(`Ext.define('${info.dsmappname}'`), 'the app instance is defined');
  assert.ok(windowJs.includes(`Ext.define('${app.appWindow}'`), 'the app window is defined');
  // Every link carries the package version, so an upgrade is never served from the browser cache.
  assert.ok(windowJs.includes(`src: '/webman/3rdparty/zt-syno-net/index.html?v=${info.version}'`));
  assert.equal(app.version, info.version);
  const html = new TextDecoder().decode(byName.get('app/index.html')!.data);
  assert.ok(html.includes(`app.js?v=${info.version}`) && html.includes(`app.css?v=${info.version}`));
  for (const e of payload) if (e.data) assert.ok(!new TextDecoder().decode(e.data).includes('@VERSION@'), `${e.name} still has a placeholder`);
  for (const lang of ['enu', 'ita']) {
    assert.match(new TextDecoder().decode(byName.get(`app/texts/${lang}/strings`)!.data), /^\[app\]\napp_name = "ZeroTier"/);
  }
  for (const size of [16, 24, 32, 48, 64, 72, 256]) assert.ok(byName.has(`app/images/icon_${size}.png`), `icon ${size}`);
  for (const file of ['app/index.html', 'app/app.js', 'app/app.css']) assert.ok(byName.has(file), file);
  assert.equal(byName.get('app/cgi/api.cgi')?.mode, 0o755);
  const cgi = new TextDecoder().decode(byName.get('app/cgi/api.cgi')!.data);
  assert.match(cgi, /authenticate\.cgi/);
  assert.match(cgi, /administrators/);
  assert.match(cgi, /\[ "\$\{REQUEST_METHOD\}" = "POST" \]/, 'join/leave only by POST');
  assert.match(cgi, /\^\[0-9a-f\]\{16\}\$/, 'network id validated');
  const resource = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === 'conf/resource')!.data));
  // dsmuidir alone publishes app/ under /webman/3rdparty/. A webservice section
  // would make DSM restart its web server on every install and upgrade, which
  // breaks the open DSM session (Package Center then fails with a script error).
  assert.equal(resource.webservice, undefined);
});

test('the DSM app script parses and has both languages', () => {
  const js = readFileSync(new URL('../spk/app/app.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(js));
  const keys = (lang: string) => [...js.matchAll(new RegExp(`${lang}: \\{([\\s\\S]*?)\\n    \\}`, 'g'))]
    .flatMap((m) => [...m[1]!.matchAll(/(\w+):\s*'/g)].map((k) => k[1]));
  assert.deepEqual(keys('ita').sort(), keys('enu').sort());
});

test('the manual setup runs only a verified root-owned copy of the launcher', () => {
  const payload = readTar(gunzipSync(readTar(build().bytes).find((e) => e.name === 'package.tgz')!.data));
  const launcher = payload.find((e) => e.name === 'bin/zt-syno-net-guard')!.data;
  const sha = createHash('sha256').update(launcher).digest('hex');
  const cmd = manualCommand(SPKFORGE_GUARD, LAUNCHER_PATH);
  assert.ok(cmd.includes(`echo "${sha}  /run/zt-syno-net-launch.sh" | sha256sum -c --status && /bin/sh /run/zt-syno-net-launch.sh`));
  assert.ok(!cmd.includes('%'), 'DSM refuses a percent sign in a task command');
  assert.ok(!/\/bin\/sh \/var\/packages/.test(cmd), 'root never runs the package file in place');
  for (const lang of ['enu', 'ita'] as const) {
    const wizard = installWizard(lang);
    assert.ok(wizard.includes(sha), `${lang} wizard shows the command of this build`);
    assert.ok(!wizard.includes('@MANUAL_COMMAND@'));
  }
});

test('builds are reproducible byte for byte', () => {
  assert.deepEqual(build().bytes, build().bytes);
});

test('wizards exist in English and Italian and validate the network ID', () => {
  const entries = readTar(build().bytes).map((e) => e.name);
  for (const name of ['install_uifile', 'install_uifile_enu', 'install_uifile_ita', 'upgrade_uifile_ita', 'uninstall_uifile', 'uninstall_uifile_ita']) {
    assert.ok(entries.includes(`WIZARD_UIFILES/${name}`), name);
  }
  const it = JSON.parse(installWizard('ita'));
  assert.equal(it[0].items[0].subitems[0].key, 'wizard_network_id');
  assert.equal(it[1].step_title, 'Avvio automatico e guardiano');
  const regex = it[0].items[0].subitems[0].validator.regex.expr.slice(1, -1);
  assert.ok(new RegExp(regex).test('abcdef0123456789'));
  assert.ok(!new RegExp(regex).test('abcdef012345678'));
});

test('icon is a well-formed PNG of the requested size', () => {
  const png = renderIcon(72);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(png.buffer, png.byteOffset);
  assert.equal(view.getUint32(16), 72);
  assert.equal(view.getUint32(20), 72);
});

test('rejects bad input', () => {
  assert.throws(() => buildSpk({ target: 'x86_64', binaries: { x86_64: new Uint8Array(10) }, upstreamVersion: '1.16.2', build: 1 }), /empty/);
  assert.throws(() => buildSpk({ target: 'x86_64', binaries: ALL, upstreamVersion: '1.16', build: 1 }), /version/);
  assert.throws(() => buildSpk({ target: 'x86_64', binaries: ALL, upstreamVersion: '1.16.2', build: 0 }), /build/);
  assert.throws(() => buildSpk({ target: 'mips' as never, binaries: ALL, upstreamVersion: '1.16.2', build: 1 }), /family/);
  assert.throws(() => buildSpk({ target: 'universal', binaries: { x86_64: FAKE_BINARY }, upstreamVersion: '1.16.2', build: 1 }), /missing.*armv8/);
});
