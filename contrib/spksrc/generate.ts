// Generate the binary and derived files of the spksrc recipe from the same
// sources as the SpkForge package, so the two cannot drift apart:
//   spk/zt-syno-net/src/zt-syno-net.png   512x512 icon (spksrc scales it down)
//   spk/zt-syno-net/src/wizard/*          install/upgrade wizards, EN + IT
//
//   node contrib/spksrc/generate.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIcon } from '../../recipes/zt-syno-net/icon.ts';
import { installWizard, upgradeWizard } from '../../recipes/zt-syno-net/wizard.ts';

const SRC = join(dirname(fileURLToPath(import.meta.url)), 'spk', 'zt-syno-net', 'src');

export function generatedFiles(): Record<string, string | Uint8Array> {
  return {
    'zt-syno-net.png': renderIcon(512),
    'wizard/install_uifile': installWizard('enu'),
    'wizard/install_uifile_ita': installWizard('ita'),
    'wizard/upgrade_uifile': upgradeWizard('enu'),
    'wizard/upgrade_uifile_ita': upgradeWizard('ita'),
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
