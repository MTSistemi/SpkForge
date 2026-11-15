import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  readTar, writeTar, TarError, parseInfo, localized, infoBool, InfoError,
  compareVersions, parseDsmVersion, compareDsm, archMatches, parseArchList, familyOf,
  knownPlatforms, readSpk, validateSpk, SpkError,
} from '../src/index.ts';
import { fakeSpk } from './fixtures.ts';

test('tar round trip keeps names, types, modes and contents', () => {
  const longName = `${'deep/'.repeat(30)}file.txt`;
  const archive = writeTar([
    { name: 'INFO', data: 'package="x"\n' },
    { name: 'scripts' },
    { name: './scripts/run', data: 'echo', mode: 0o755 },
    { name: longName, data: 'long' },
  ]);
  const entries = readTar(archive);
  assert.deepEqual(entries.map((e) => [e.name, e.type, e.size]), [
    ['INFO', 'file', 12],
    ['scripts/', 'directory', 0],
    ['scripts/run', 'file', 4],
    [longName, 'file', 4],
  ]);
  assert.equal(new TextDecoder().decode(entries[3]?.data), 'long');
});

test('tar reader rejects corrupted and truncated archives', () => {
  const archive = writeTar([{ name: 'a', data: 'x'.repeat(600) }]);
  const corrupted = archive.slice();
  corrupted[0] = 0x7a;
  assert.throws(() => readTar(corrupted), TarError);
  assert.throws(() => readTar(archive.subarray(0, 700)), /truncated/);
});

test('INFO parser handles quotes, escapes, unquoted values and comments', () => {
  const info = parseInfo('﻿# comment\npackage="zerotier"\nversion=1.16.2-1\r\ndescription="Say \\"hi\\" \\\\ bye"\n\n');
  assert.deepEqual(info, { package: 'zerotier', version: '1.16.2-1', description: 'Say "hi" \\ bye' });
  assert.throws(() => parseInfo('broken line'), InfoError);
  assert.throws(() => parseInfo('a="unterminated'), /closing quote/);
  assert.throws(() => parseInfo('a="x" y'), /after closing quote/);
});

test('localized values fall back to English, then to the plain key', () => {
  const info = { displayname: 'Plain', displayname_enu: 'English', displayname_ita: 'Italiano' };
  assert.equal(localized(info, 'displayname', 'ita'), 'Italiano');
  assert.equal(localized(info, 'displayname', 'ger'), 'English');
  assert.equal(localized({ displayname: 'Plain' }, 'displayname', 'ita'), 'Plain');
  assert.equal(infoBool('yes'), true);
  assert.equal(infoBool('no', true), false);
  assert.equal(infoBool(undefined, true), true);
});

test('package versions sort the Synology way', () => {
  assert.ok(compareVersions('1.16.2-3', '1.16.2-2') > 0);
  assert.ok(compareVersions('1.16.2-1', '1.14.2-10') > 0);
  assert.ok(compareVersions('1.10.0-1', '1.9.9-1') > 0);
  assert.ok(compareVersions('1.0-1', '1.0beta-1') > 0);
  assert.ok(compareVersions('2.0', '2.0.1') < 0);
  assert.equal(compareVersions('1.16.2-1', '1.16.2-1'), 0);
  const sorted = ['1.14.2-1', '1.16.2-2', '1.16.0-5', '1.16.2-10'].sort(compareVersions);
  assert.deepEqual(sorted, ['1.14.2-1', '1.16.0-5', '1.16.2-2', '1.16.2-10']);
});

test('DSM versions compare by build when both have one', () => {
  const nas = parseDsmVersion('7.2.2-72806');
  assert.deepEqual(nas, { major: 7, minor: 2, micro: 2, build: 72806 });
  assert.ok(nas);
  assert.ok(compareDsm(nas, parseDsmVersion('7.0-40000')!) > 0);
  assert.ok(compareDsm(nas, parseDsmVersion('7.3-80000')!) < 0);
  assert.ok(compareDsm(nas, parseDsmVersion('7.2')!) > 0);
  assert.equal(compareDsm(parseDsmVersion('7.2')!, parseDsmVersion('7.2')!), 0);
  assert.equal(parseDsmVersion('seven'), undefined);
  assert.equal(parseDsmVersion(undefined), undefined);
});

test('architecture matching covers platforms, families, aliases and noarch', () => {
  assert.equal(familyOf('geminilake'), 'x86_64');
  assert.equal(familyOf('rtd1619b'), 'armv8');
  assert.ok(archMatches(parseArchList('x86_64'), 'geminilake'));
  assert.ok(archMatches(parseArchList('x64'), 'apollolake'));
  assert.ok(archMatches(parseArchList('aarch64'), 'rtd1296'));
  assert.ok(archMatches(parseArchList('geminilake apollolake'), 'geminilake'));
  assert.ok(archMatches(parseArchList('noarch'), 'whatever'));
  assert.ok(!archMatches(parseArchList('armv8'), 'geminilake'));
  assert.ok(!archMatches(parseArchList('x86_64'), 'unknownplatform'));
  assert.ok(archMatches(parseArchList('unknownplatform'), 'UnknownPlatform'));
  assert.ok(knownPlatforms().includes('geminilake'));
  assert.ok(!knownPlatforms().includes('x86_64'));
});

test('readSpk extracts INFO, icons, files and checksums', () => {
  const bytes = fakeSpk();
  const spk = readSpk(bytes);
  assert.equal(spk.id, 'zerotier');
  assert.equal(spk.version, '1.16.2-1');
  assert.deepEqual(spk.arch, ['x86_64']);
  assert.equal(spk.signed, false);
  assert.equal(spk.size, bytes.length);
  assert.equal(spk.md5, createHash('md5').update(bytes).digest('hex'));
  assert.equal(spk.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.ok(spk.icon && spk.icon.length === 4);
  assert.equal(spk.icon256, undefined);
  assert.ok(spk.files.some((f) => f.name === 'scripts/start-stop-status'));
  assert.deepEqual(validateSpk(spk), []);
});

test('validateSpk refuses DSM signatures, missing payload and missing fields', () => {
  const signed = validateSpk(readSpk(fakeSpk({ signed: true })));
  assert.deepEqual(signed.map((p) => p.code), ['dsm-signature']);
  const empty = validateSpk(readSpk(fakeSpk({ payload: false, info: { maintainer: '', package: 'bad id!' } })));
  assert.deepEqual(empty.map((p) => p.code).sort(), ['bad-id', 'missing-field', 'missing-payload']);
  assert.throws(() => readSpk(writeTar([{ name: 'README', data: 'x' }])), SpkError);
});
