import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { buildSpk } from '../../../recipes/zt-syno-net/build.ts';
import { createSpkForgeServer, type SpkForgeServer } from '../src/index.ts';
import { fakeSpk } from '../../spk/test/fixtures.ts';

const TOKEN = 'test-admin-token-0123456789';
const BIN = new Uint8Array(64 * 1024).fill(0x7f);
const ALL = { x86_64: BIN, armv8: BIN, armv7: BIN, i686: BIN };

let dir: string;
let app: SpkForgeServer;
let base: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'spkforge-test-'));
  mkdirSync(join(dir, 'packages'));
  for (const target of ['x86_64', 'armv8', 'universal'] as const) {
    const spk = buildSpk({ target, binaries: ALL, upstreamVersion: '1.16.2', build: 1 });
    writeFileSync(join(dir, 'packages', spk.fileName), spk.bytes);
  }
  writeFileSync(join(dir, 'packages', 'signed_x86_64_1.0-1.spk'), fakeSpk({ signed: true, info: { package: 'signed' } }));
  writeFileSync(join(dir, 'packages', 'README.txt'), 'ignored');
  app = createSpkForgeServer({ dataDir: dir, adminToken: TOKEN, baseUrl: 'https://spk.example.test/' });
  await new Promise<void>((done) => app.server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

const DS723 = 'unique=synology_geminilake_723p&arch=geminilake&major=7&minor=2&micro=2&build=72806&nano=10&language=ita&package_update_channel=stable&timezone=Rome';

test('Package Center GET gets the newest fitting zt-syno-net, localised', async () => {
  const res = await fetch(`${base}/?${DS723}`);
  assert.equal(res.status, 200);
  const { packages } = await res.json() as { packages: { package: string; version: string; link: string; desc: string }[] };
  assert.equal(packages.length, 1);
  assert.equal(packages[0]!.package, 'zt-syno-net');
  assert.equal(packages[0]!.version, '1.16.2-1');
  assert.match(packages[0]!.desc, /collega il NAS/);
  // Both the x86_64 and the universal file fit; the per-family one is preferred (smaller).
  assert.match(packages[0]!.link, /^https:\/\/spk\.example\.test\/packages\/zt-syno-net\/1\.16\.2-1\/zt-syno-net_(x86_64|universal)_1\.16\.2-1\.spk\?arch=geminilake/);
});

test('Package Center POST works too, and unknown platforms get the universal package', async () => {
  const res = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: DS723.replace('arch=geminilake', 'arch=someplatform2027'),
  });
  const { packages } = await res.json() as { packages: { link: string }[] };
  assert.equal(packages.length, 1);
  assert.match(packages[0]!.link, /zt-syno-net_universal_1\.16\.2-1\.spk/);
});

test('signed SPKs are rejected and never offered', async () => {
  const { packages } = await (await fetch(`${base}/?${DS723}`)).json() as { packages: { package: string }[] };
  assert.ok(!packages.some((p) => p.package === 'signed'));
  const rejected = await (await fetch(`${base}/api/admin/rejected`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json() as { fileName: string; problems: { code: string }[] }[];
  assert.deepEqual(rejected.map((r) => [r.fileName, r.problems.map((p) => p.code)]), [['signed_x86_64_1.0-1.spk', ['dsm-signature']]]);
});

test('download serves the exact file, counts it, and icons are PNGs', async () => {
  const api = await (await fetch(`${base}/api/packages/zt-syno-net`)).json() as { versions: { fileName: string; sha256: string; download: string }[] };
  const universal = api.versions.find((v) => v.fileName.includes('universal'))!;
  const path = new URL(universal.download).pathname;
  const res = await fetch(`${base}${path}?arch=geminilake&build=72806`);
  assert.equal(res.status, 200);
  const body = new Uint8Array(await res.arrayBuffer());
  assert.equal(createHash('sha256').update(body).digest('hex'), universal.sha256);
  assert.equal(res.headers.get('x-checksum-sha256'), universal.sha256);
  const after = await (await fetch(`${base}/api/packages/zt-syno-net`)).json() as { downloads: number };
  assert.ok(after.downloads >= 1);
  const icon = await fetch(`${base}/packages/zt-syno-net/1.16.2-1/icon_256.png`);
  assert.equal(icon.headers.get('content-type'), 'image/png');
  assert.deepEqual([...new Uint8Array(await icon.arrayBuffer()).subarray(1, 4)], [0x50, 0x4e, 0x47]);
});

test('public API lists packages with families, versions and platforms', async () => {
  const list = await (await fetch(`${base}/api/packages`)).json() as { id: string; families: string[]; versions: unknown[]; name: { ita: string } }[];
  assert.deepEqual(list.map((p) => p.id), ['zt-syno-net']);
  assert.deepEqual(list[0]!.families, ['armv8', 'noarch', 'x86_64']);
  assert.equal(list[0]!.versions.length, 3);
  const platforms = await (await fetch(`${base}/api/platforms`)).json() as { platform: string; family: string }[];
  assert.ok(platforms.some((p) => p.platform === 'rtd1619b' && p.family === 'armv8'));
  const preview = await (await fetch(`${base}/api/preview?platform=rtd1619b&build=72806`)).json() as { packages: { link: string }[] };
  assert.match(preview.packages[0]!.link, /zt-syno-net_(armv8|universal)_/);
});

test('admin API needs the token; uploads are validated and indexed', async () => {
  assert.equal((await fetch(`${base}/api/admin/rejected`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/rejected`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);

  const armv7 = buildSpk({ target: 'armv7', binaries: ALL, upstreamVersion: '1.16.2', build: 1 });
  const ok = await fetch(`${base}/api/admin/packages/${armv7.fileName}`, { method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}` }, body: new Uint8Array(armv7.bytes) });
  assert.equal(ok.status, 201);
  const list = await (await fetch(`${base}/api/packages`)).json() as { families: string[] }[];
  assert.ok(list[0]!.families.includes('armv7'));

  const bad = await fetch(`${base}/api/admin/packages/bad_x86_64_1.0-1.spk`, { method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}` }, body: new Uint8Array(fakeSpk({ payload: false, info: { package: 'bad' } })) });
  assert.equal(bad.status, 422);
  assert.deepEqual((await bad.json() as { problems: { code: string }[] }).problems.map((p) => p.code), ['missing-payload']);

  const traversal = await fetch(`${base}/api/admin/packages/..%2F..%2Fevil.spk`, { method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}` }, body: new Uint8Array(armv7.bytes) });
  assert.equal(traversal.status, 400);
});

test('beta channel: promoted versions are offered only to beta subscribers', async () => {
  const beta = buildSpk({ target: 'x86_64', binaries: ALL, upstreamVersion: '1.16.2', build: 2 });
  await fetch(`${base}/api/admin/packages/${beta.fileName}`, { method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}` }, body: new Uint8Array(beta.bytes) });
  const set = await fetch(`${base}/api/admin/packages/${beta.fileName}/channel`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ channel: 'beta' }) });
  assert.equal(set.status, 200);
  const stable = await (await fetch(`${base}/?${DS723}`)).json() as { packages: { version: string }[] };
  assert.equal(stable.packages[0]!.version, '1.16.2-1');
  const betaRes = await (await fetch(`${base}/?${DS723.replace('channel=stable', 'channel=beta')}`)).json() as { packages: { version: string; beta: boolean }[] };
  assert.equal(betaRes.packages[0]!.version, '1.16.2-2');
  assert.equal(betaRes.packages[0]!.beta, true);
});

test('unknown paths and bad files are 404, never a crash', async () => {
  assert.equal((await fetch(`${base}/packages/zt-syno-net/1.16.2-1/..%2F..%2Fspkforge.db`)).status, 404);
  assert.equal((await fetch(`${base}/packages/zt-syno-net/9.9.9-1/zt-syno-net_x86_64_9.9.9-1.spk`)).status, 404);
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  const root = await (await fetch(`${base}/`)).json() as { name: string };
  assert.equal(root.name, 'SpkForge');
});
