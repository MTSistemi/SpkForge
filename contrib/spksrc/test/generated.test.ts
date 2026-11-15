import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedFiles } from '../generate.ts';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'spk', 'zt-syno-net', 'src');

test('generated spksrc files are in sync with the SpkForge sources (run contrib/spksrc/generate.ts)', () => {
  for (const [name, expected] of Object.entries(generatedFiles())) {
    const actual = readFileSync(join(SRC, name));
    const wanted = typeof expected === 'string' ? Buffer.from(expected, 'utf8') : Buffer.from(expected);
    assert.ok(actual.equals(wanted), `${name} is stale`);
  }
});

test('the spksrc package depends on no other package and runs as the package user', () => {
  const makefile = readFileSync(join(SRC, '..', 'Makefile'), 'utf8');
  assert.match(makefile, /^SERVICE_USER = auto$/m);
  assert.match(makefile, /^DEPENDS = cross\/zerotier$/m);
  assert.doesNotMatch(makefile, /SPK_DEPENDS|INSTALL_DEP|SimplePermission/i);
  const setup = readFileSync(join(SRC, 'service-setup.sh'), 'utf8');
  assert.ok(setup.includes('SERVICE_COMMAND="${ZEROTIER} -U '), 'daemon must run with -U as the package user');
});
