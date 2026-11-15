import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { archMatches, parseInfo, readSpk, readTar, validateSpk } from '@spkforge/spk';
import { buildSpk, type BuildTarget } from '../build.ts';
import { renderIcon } from '../icon.ts';
import { installWizard } from '../wizard.ts';

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
  for (const name of ['bin/zerotier-one-x86_64', 'bin/zerotier-cli', 'bin/zt-syno-net-setup']) {
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

test('builds are reproducible byte for byte', () => {
  assert.deepEqual(build().bytes, build().bytes);
});

test('wizards exist in English and Italian and validate the network ID', () => {
  const entries = readTar(build().bytes).map((e) => e.name);
  for (const name of ['install_uifile', 'install_uifile_enu', 'install_uifile_ita', 'upgrade_uifile_ita']) {
    assert.ok(entries.includes(`WIZARD_UIFILES/${name}`), name);
  }
  const it = JSON.parse(installWizard('ita'));
  assert.equal(it[0].items[0].subitems[0].key, 'wizard_network_id');
  assert.match(it[1].step_title, /attività all'avvio/);
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
