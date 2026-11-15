import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, parseDsmRequest, selectVersions, type CatalogVersion } from '../src/index.ts';

const OPTIONS = { baseUrl: 'https://spk.example.test/', distributor: 'MTSistemi', distributorUrl: 'https://github.com/MTSistemi' };

// Exactly what a DS723+ on DSM 7.2.2-72806 Update 10 sends (observed against public sources).
const DS723 = 'unique=synology_geminilake_723p&arch=geminilake&major=7&minor=2&micro=2&build=72806&nano=10&language=ita&package_update_channel=stable&timezone=Rome';

function version(overrides: Partial<CatalogVersion> & { info?: Record<string, string> }): CatalogVersion {
  const info = {
    package: 'zerotier', displayname: 'ZeroTier', displayname_ita: 'ZeroTier (it)',
    description: 'Overlay network.', description_ita: 'Rete overlay.', maintainer: 'MTSistemi',
    os_min_ver: '7.0-40000', ...overrides.info,
  };
  return {
    id: info.package, version: '1.16.2-1', arch: ['x86_64'], fileName: 'zerotier-x86_64-1.16.2-1.spk',
    size: 1234, md5: 'd41d8cd98f00b204e9800998ecf8427e', channel: 'stable', hasIcon256: true,
    downloads: 10, recentDownloads: 2, ...overrides, info,
  };
}

test('parses a real DSM 7.2 request', () => {
  const request = parseDsmRequest(new URLSearchParams(DS723));
  assert.equal(request.platform, 'geminilake');
  assert.equal(request.unique, 'synology_geminilake_723p');
  assert.deepEqual(request.dsm, { major: 7, minor: 2, micro: 2, build: 72806 });
  assert.equal(request.language, 'ita');
  assert.equal(request.channel, 'stable');
});

test('falls back sanely on missing or odd parameters', () => {
  const request = parseDsmRequest(new URLSearchParams('arch=GeminiLake&language=../../etc&package_update_channel=nightly'));
  assert.equal(request.platform, 'geminilake');
  assert.equal(request.dsm, undefined);
  assert.equal(request.language, 'enu');
  assert.equal(request.channel, 'stable');
  assert.deepEqual(buildCatalog([version({})], parseDsmRequest(new URLSearchParams('')), OPTIONS), { packages: [] });
});

test('offers the newest version that fits architecture, DSM and channel', () => {
  const versions = [
    version({ version: '1.14.2-1' }),
    version({ version: '1.16.2-1' }),
    version({ version: '1.16.2-2', channel: 'beta' }),
    version({ version: '1.16.2-3', arch: ['armv8'] }),
    version({ version: '1.17.0-1', info: { os_min_ver: '7.3-80000' } }),
    version({ version: '1.13.0-1', info: { os_max_ver: '7.1-42661' } }),
    version({ version: '1.0-1', info: { package: 'other', displayname: 'Another' } }),
  ];
  const stable = parseDsmRequest(new URLSearchParams(DS723));
  assert.deepEqual(selectVersions(versions, stable).map((v) => `${v.id} ${v.version}`), ['other 1.0-1', 'zerotier 1.16.2-1']);

  const beta = parseDsmRequest(new URLSearchParams(DS723.replace('channel=stable', 'channel=beta')));
  assert.deepEqual(selectVersions(versions, beta).map((v) => v.version), ['1.0-1', '1.16.2-2']);

  const arm = parseDsmRequest(new URLSearchParams(DS723.replace('arch=geminilake', 'arch=rtd1619b')));
  assert.deepEqual(selectVersions(versions, arm).map((v) => v.version), ['1.16.2-3']);
});

test('builds entries Package Center understands, localised', () => {
  const request = parseDsmRequest(new URLSearchParams(DS723));
  const { packages } = buildCatalog([version({ info: { silent_install: 'yes', install_dep_packages: '' } })], request, OPTIONS);
  assert.equal(packages.length, 1);
  const entry = packages[0]!;
  assert.equal(entry.dname, 'ZeroTier (it)');
  assert.equal(entry.desc, 'Rete overlay.');
  assert.equal(entry.link, 'https://spk.example.test/packages/zerotier/1.16.2-1/zerotier-x86_64-1.16.2-1.spk?arch=geminilake&build=72806&unique=synology_geminilake_723p');
  assert.deepEqual(entry.thumbnail, ['https://spk.example.test/packages/zerotier/1.16.2-1/icon_72.png', 'https://spk.example.test/packages/zerotier/1.16.2-1/icon_256.png']);
  assert.equal(entry.qinst, true);
  assert.equal(entry.qstart, true);
  assert.equal(entry.qupgrade, false);
  assert.equal(entry.deppkgs, null);
  assert.equal(entry.startable, 'yes');
  assert.equal(entry.distributor, 'MTSistemi');
  assert.equal(entry.beta, false);
  // Same set of keys as a live SynoCommunity answer, plus our extras.
  for (const key of ['changelog', 'conflictpkgs', 'deppkgs', 'desc', 'distributor', 'distributor_url', 'dname', 'download_count', 'link', 'maintainer', 'maintainer_url', 'md5', 'package', 'qinst', 'qstart', 'qupgrade', 'recent_download_count', 'size', 'snapshot', 'startable', 'thumbnail', 'thumbnail_retina', 'version']) {
    assert.ok(key in entry, `missing ${key}`);
  }
});

test('ctl_stop="no" makes a package non-startable; no 256 icon reuses the 72 one', () => {
  const request = parseDsmRequest(new URLSearchParams(DS723));
  const entry = buildCatalog([version({ hasIcon256: false, info: { ctl_stop: 'no', silent_install: 'yes' } })], request, OPTIONS).packages[0]!;
  assert.equal(entry.startable, 'no');
  assert.equal(entry.qstart, false);
  assert.deepEqual(entry.thumbnail_retina, [entry.thumbnail[0], entry.thumbnail[0]]);
});
