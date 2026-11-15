import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatedFiles, recipeVersion } from '../generate.ts';

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
  assert.ok(setup.includes('SERVICE_COMMAND="/bin/sh ${SYNOPKG_PKGDEST}/bin/zt-syno-net-supervise"'), 'runs under the supervisor');
  assert.ok(readFileSync(join(SRC, 'zt-syno-net-supervise'), 'utf8').includes('"${DAEMON}" -U "${HOME_DIR}"'));
  assert.ok(setup.includes('/run/zt-syno-net.caps'));
  assert.doesNotMatch(setup.replace(/^\s*#.*$/gm, ''), /getcap|setcap/, 'getcap/setcap are root-only on DSM');
  assert.ok(setup.includes('identity.secret" ] && [ ! -r'), 'must refuse to start with an unreadable identity');
  const guard = readFileSync(join(SRC, 'zt-syno-net-guard'), 'utf8');
  assert.match(guard, /^PKG_USER="sc-zt-syno-net"$/m);
  assert.ok(guard.includes('echo "/var/packages/zt-syno-net/target/bin/zerotier-one"'));
  const wizard = JSON.parse(readFileSync(join(SRC, 'wizard', 'install_uifile_ita'), 'utf8'));
  assert.ok(wizard[1].deactivate_v2.includes('sc-zt-syno-net'), 'the task created by the wizard targets the spksrc user');
});

test('the spksrc package ships the same DSM app, versioned with SPK_VERS-SPK_REV', () => {
  const makefile = readFileSync(join(SRC, '..', 'Makefile'), 'utf8');
  assert.match(makefile, /^DSM_UI_DIR = app$/m);
  assert.match(makefile, /^DSM_APP_NAME = SpkForge\.ZtSynoNet\.Instance$/m);
  assert.match(makefile, /chmod 755 \$\(STAGING_DIR\)\/\$\(DSM_UI_DIR\)\/cgi\/api\.cgi/);
  const version = recipeVersion();
  const config = JSON.parse(readFileSync(join(SRC, 'app', 'config'), 'utf8'));
  assert.equal(config['ZtSynoNet.js']['SpkForge.ZtSynoNet.Instance'].version, version);
  assert.ok(readFileSync(join(SRC, 'app', 'index.html'), 'utf8').includes(`app.js?v=${version}`));
  assert.ok(readFileSync(join(SRC, 'app', 'cgi', 'api.cgi'), 'utf8').includes('authenticate.cgi'));
});
