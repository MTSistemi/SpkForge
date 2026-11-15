// Fill a data directory with demo packages for local development of the web
// interface: the real zt-syno-net SPKs, built with placeholder binaries, plus a
// beta build and one rejected (signed) file.
//
//   node packages/server/scripts/seed-demo.ts .demo-data

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSpk } from '../../../recipes/zt-syno-net/build.ts';
import { fakeSpk } from '../../spk/test/fixtures.ts';

const dir = process.argv[2] ?? '.demo-data';
const packages = join(dir, 'packages');
mkdirSync(packages, { recursive: true });

const placeholder = new Uint8Array(256 * 1024).fill(0x7f);
const binaries = { x86_64: placeholder, armv8: placeholder, armv7: placeholder, i686: placeholder };

for (const target of ['x86_64', 'armv8', 'armv7', 'i686', 'universal'] as const) {
  const spk = buildSpk({ target, binaries, upstreamVersion: '1.16.2', build: 1 });
  writeFileSync(join(packages, spk.fileName), spk.bytes);
}
const older = buildSpk({ target: 'universal', binaries, upstreamVersion: '1.14.2', build: 1 });
writeFileSync(join(packages, older.fileName), older.bytes);
writeFileSync(join(packages, 'signed_x86_64_1.0-1.spk'), fakeSpk({ signed: true, info: { package: 'signed' } }));

console.log(`demo packages written to ${packages}`);
