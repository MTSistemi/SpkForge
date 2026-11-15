import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { archMatches, parseInfo, readSpk, readTar, validateSpk } from '@spkforge/spk';
import { buildSpk, type BuildTarget } from '../build.ts';
import { renderIcon } from '../icon.ts';
import { installWizard, upgradeWizard, uninstallWizard, SPKFORGE_GUARD } from '../wizard.ts';
import { guardScript, taskOperation } from '../guard.ts';
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

test('the boot-up task embeds the guard and stays under DSM limits', () => {
  const op = taskOperation(SPKFORGE_GUARD);
  assert.ok(op.length < 8192, `task command is ${op.length} characters, DSM allows 8192`);
  assert.ok(!op.includes('%'), 'DSM rejects task commands containing a percent sign (error 117)');
  assert.ok(op.includes(guardScript(SPKFORGE_GUARD).trimEnd()), 'the guard text is inside the task, not read from the package');
  assert.match(op, /setsid \/bin\/sh \/run\/zt-syno-net-guard\.sh/);
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
  const app = config['.url'][info.dsmappname!];
  assert.ok(app, 'dsmappname matches the app key in app/config');
  assert.equal(app.allUsers, false);
  assert.equal(app.url, '/webman/3rdparty/zt-syno-net/index.html');
  for (const size of [16, 24, 32, 48, 64, 72, 256]) assert.ok(byName.has(`app/images/icon_${size}.png`), `icon ${size}`);
  for (const file of ['app/index.html', 'app/app.js', 'app/app.css']) assert.ok(byName.has(file), file);
  assert.equal(byName.get('app/cgi/api.cgi')?.mode, 0o755);
  const cgi = new TextDecoder().decode(byName.get('app/cgi/api.cgi')!.data);
  assert.match(cgi, /authenticate\.cgi/);
  assert.match(cgi, /administrators/);
  assert.match(cgi, /\[ "\$\{REQUEST_METHOD\}" = "POST" \]/, 'join/leave only by POST');
  assert.match(cgi, /\^\[0-9a-f\]\{16\}\$/, 'network id validated');
  const resource = JSON.parse(new TextDecoder().decode(entries.find((e) => e.name === 'conf/resource')!.data));
  assert.equal(resource.webservice.pkg_dir_prepare[0].source, '/var/packages/zt-syno-net/target/app');
  assert.equal(resource.webservice.pkg_dir_prepare[0].target, 'zt-syno-net');
});

test('the DSM app script parses and has both languages', () => {
  const js = readFileSync(new URL('../spk/app/app.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Function(js));
  const keys = (lang: string) => [...js.matchAll(new RegExp(`${lang}: \\{([\\s\\S]*?)\\n    \\}`, 'g'))]
    .flatMap((m) => [...m[1]!.matchAll(/(\w+):\s*'/g)].map((k) => k[1]));
  assert.deepEqual(keys('ita').sort(), keys('enu').sort());
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
  assert.equal(it[1].step_title, 'Avvio automatico e guardia');
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
