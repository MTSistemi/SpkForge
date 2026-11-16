// Generate the derived files of the spksrc recipe from the same sources as the
// SpkForge package, so the two cannot drift apart:
//   spk/zerotier-one/src/zerotier-one.png      512x512 icon (spksrc scales it down)
//   spk/zerotier-one/src/wizard/*              install/upgrade/uninstall wizards, EN + IT
//   spk/zerotier-one/src/zerotier-one-guard    manual fallback launcher of the root guard
//   spk/zerotier-one/src/app/*                 the DSM app (window, page, CGI), versioned
//                                              with SPK_VERS-SPK_REV from the Makefile
//
// In SynoCommunity the package is "zerotier-one": a name of its own, so it never
// meets the old community "zerotier" package nor the SpkForge build "zt-syno-net"
// in Package Center. All three hand their node identity over to each other.
//
//   node contrib/spksrc/generate.ts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIcon } from '../../recipes/zt-syno-net/icon.ts';
import { launcherFile, type GuardOptions } from '../../recipes/zt-syno-net/guard.ts';
import { installWizard, uninstallWizard, upgradeWizard } from '../../recipes/zt-syno-net/wizard.ts';
import { appFiles, type AppIdentity } from '../../recipes/zt-syno-net/build.ts';

const SPK = join(dirname(fileURLToPath(import.meta.url)), 'spk', 'zerotier-one');
const SRC = join(SPK, 'src');

/** SPK_VERS-SPK_REV, the version DSM shows, read from the recipe's Makefile. */
export function recipeVersion(): string {
  const make = readFileSync(join(SPK, 'Makefile'), 'utf8');
  const field = (name: string) => make.match(new RegExp(`^${name}\\s*=\\s*(\\S+)`, 'm'))?.[1];
  const vers = field('SPK_VERS');
  const rev = field('SPK_REV');
  if (!vers || !rev) throw new Error('SPK_VERS or SPK_REV missing from the Makefile');
  return `${vers}-${rev}`;
}

/** spksrc runs DSM 7 services as sc-<package>, with one binary per build. */
export const SPKSRC_GUARD: GuardOptions = {
  pkg: 'zerotier-one',
  user: 'sc-zerotier-one',
  daemon: '/var/packages/zerotier-one/target/bin/zerotier-one',
};

export const SPKSRC_APP: AppIdentity = { pkg: 'zerotier-one', ns: 'SynoCommunity.ZeroTierOne' };

export function generatedFiles(): Record<string, string | Uint8Array> {
  return {
    'zerotier-one.png': renderIcon(512),
    'zerotier-one-guard': launcherFile(SPKSRC_GUARD),
    'wizard/install_uifile': installWizard('enu', SPKSRC_GUARD),
    'wizard/install_uifile_ita': installWizard('ita', SPKSRC_GUARD),
    'wizard/upgrade_uifile': upgradeWizard('enu', SPKSRC_GUARD),
    'wizard/upgrade_uifile_ita': upgradeWizard('ita', SPKSRC_GUARD),
    'wizard/uninstall_uifile': uninstallWizard('enu', SPKSRC_GUARD),
    'wizard/uninstall_uifile_ita': uninstallWizard('ita', SPKSRC_GUARD),
    ...Object.fromEntries(appFiles(recipeVersion(), SPKSRC_APP).filter((f) => f.data !== undefined).map((f) => [f.name, f.data!])),
  };
}

if (import.meta.main) {
  for (const [name, content] of Object.entries(generatedFiles())) {
    const path = join(SRC, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    console.log(path);
  }
}
