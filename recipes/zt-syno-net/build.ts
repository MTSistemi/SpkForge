// Assemble zt-syno-net SPKs from zerotier-one builds.
//
// One package per CPU family (smaller; the catalog serves the right one), plus
// a universal noarch package holding every build, which installs on any DSM 7
// model, including platforms not listed anywhere. Intel and AMD share x86_64.
//
//   node recipes/zt-syno-net/build.ts --version 1.16.2 --build 1 --out dist \
//        --x86_64 bin/x86_64 --armv8 bin/armv8 --armv7 bin/armv7 --i686 bin/i686
//
// writes zt-syno-net_<family>_<version>.spk for each given build and, when all
// four are given, zt-syno-net_universal_<version>.spk.
// Output is reproducible: fixed timestamps and owners in both tar layers, gzip
// without a timestamp. The SPK carries no syno_signature.asc and depends on no
// other package.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { platformsOf, writeTar, type Family, type TarInput } from '@spkforge/spk';
import { renderIcon } from './icon.ts';
import { wizardFiles } from './wizard.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = join(HERE, 'spk');
export const FAMILIES: readonly Family[] = ['x86_64', 'armv8', 'armv7', 'i686'];
const LIFECYCLE_NOOP = ['preinst', 'preuninst', 'postuninst', 'preupgrade', 'postupgrade'];

export const PACKAGE = 'zt-syno-net';

export type BuildTarget = Family | 'universal';

export interface BuildOptions {
  /** One CPU family, or 'universal' for a noarch package with every build. */
  target: BuildTarget;
  /** zerotier-one executables per family; the universal package needs all four. */
  binaries: Partial<Record<Family, Uint8Array>>;
  /** Upstream ZeroTier One version, e.g. "1.16.2". */
  upstreamVersion: string;
  /** Package build number for this upstream version, starting at 1. */
  build: number;
}

export interface BuildResult {
  fileName: string;
  version: string;
  bytes: Uint8Array;
  info: Record<string, string>;
}

function asset(path: string): string {
  return readFileSync(join(FILES, path), 'utf8');
}

function infoText(info: Record<string, string>): string {
  return Object.entries(info)
    .map(([key, value]) => `${key}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join('\n') + '\n';
}

function licenseText(upstreamVersion: string): string {
  return `zt-syno-net — ZeroTier One ${upstreamVersion} for Synology DSM 7, packaged by MTSistemi (SpkForge).

ZeroTier One is Copyright (c) ZeroTier, Inc. The zerotier-one program in this package is built,
unmodified, from the open-source part of https://github.com/zerotier/ZeroTierOne (tag
${upstreamVersion}) and is distributed under the Mozilla Public License 2.0:
https://mozilla.org/MPL/2.0/ . Source: https://github.com/zerotier/ZeroTierOne/tree/${upstreamVersion}

ZeroTier is a trademark of ZeroTier, Inc. This package is not made or endorsed by ZeroTier, Inc.

Packaging scripts: Copyright (C) 2026 MTSistemi, GNU Affero General Public License v3.0 or later,
https://github.com/MTSistemi/SpkForge
`;
}

export function buildSpk(options: BuildOptions): BuildResult {
  const { target, binaries, upstreamVersion, build } = options;
  if (target !== 'universal' && !FAMILIES.includes(target)) throw new Error(`unsupported family: ${target}`);
  if (!/^\d+\.\d+\.\d+$/.test(upstreamVersion)) throw new Error(`bad upstream version: ${upstreamVersion}`);
  if (!Number.isInteger(build) || build < 1) throw new Error(`bad build number: ${build}`);
  const families = target === 'universal' ? FAMILIES : [target];
  for (const family of families) {
    const binary = binaries[family];
    if (!binary) throw new Error(`missing zerotier-one build for ${family}`);
    if (binary.length < 1024) throw new Error(`zerotier-one build for ${family} looks empty`);
  }

  const version = `${upstreamVersion}-${build}`;
  const payload = writeTar([
    { name: 'bin' },
    ...families.map((family) => ({ name: `bin/zerotier-one-${family}`, data: binaries[family]!, mode: 0o755 })),
    { name: 'bin/zt-syno-net-env', data: asset('bin/zt-syno-net-env'), mode: 0o644 },
    { name: 'bin/zerotier-cli', data: asset('bin/zerotier-cli'), mode: 0o755 },
    { name: 'bin/zt-syno-net-setup', data: asset('bin/zt-syno-net-setup'), mode: 0o755 },
  ]);
  const packageTgz = gzipSync(payload, { level: 9 });

  const info: Record<string, string> = {
    package: PACKAGE,
    version,
    os_min_ver: '7.0-40000',
    arch: target === 'universal' ? 'noarch' : [...platformsOf(target), target].join(' '),
    displayname: 'ZeroTier (zt-syno-net)',
    displayname_enu: 'ZeroTier (zt-syno-net)',
    displayname_ita: 'ZeroTier (zt-syno-net)',
    description: `ZeroTier One ${upstreamVersion}: join this NAS to your ZeroTier networks. Runs without root and needs no other package; a one-time boot-up task prepares the system (see the install wizard).`,
    description_enu: `ZeroTier One ${upstreamVersion}: join this NAS to your ZeroTier networks. Runs without root and needs no other package; a one-time boot-up task prepares the system (see the install wizard).`,
    description_ita: `ZeroTier One ${upstreamVersion}: collega questo NAS alle tue reti ZeroTier. Gira senza root e non richiede altri pacchetti; un'attività all'avvio, da creare una volta, prepara il sistema (vedi la procedura di installazione).`,
    changelog: `ZeroTier One ${upstreamVersion}.`,
    changelog_ita: `ZeroTier One ${upstreamVersion}.`,
    maintainer: 'MTSistemi',
    maintainer_url: 'https://github.com/MTSistemi',
    distributor: 'SpkForge',
    distributor_url: 'https://github.com/MTSistemi/SpkForge',
    support_url: 'https://github.com/MTSistemi/SpkForge/issues',
    helpurl: 'https://github.com/MTSistemi/SpkForge/blob/main/docs/en/zt-syno-net.md',
    install_conflict_packages: 'zerotier',
    thirdparty: 'yes',
    ctl_stop: 'yes',
    checksum: createHash('md5').update(packageTgz).digest('hex'),
    extractsize: String(Math.ceil(payload.length / 1024)),
  };

  const entries: TarInput[] = [
    { name: 'INFO', data: infoText(info) },
    { name: 'package.tgz', data: packageTgz },
    { name: 'LICENSE', data: licenseText(upstreamVersion) },
    { name: 'PACKAGE_ICON.PNG', data: renderIcon(72) },
    { name: 'PACKAGE_ICON_256.PNG', data: renderIcon(256) },
    { name: 'conf' },
    { name: 'conf/privilege', data: asset('conf/privilege') },
    { name: 'conf/resource', data: asset('conf/resource') },
    { name: 'conf/zt-syno-net.sc', data: asset('conf/zt-syno-net.sc') },
    { name: 'scripts' },
    { name: 'scripts/start-stop-status', data: asset('scripts/start-stop-status'), mode: 0o755 },
    { name: 'scripts/postinst', data: asset('scripts/postinst'), mode: 0o755 },
    ...LIFECYCLE_NOOP.map((name) => ({ name: `scripts/${name}`, data: asset('scripts/noop'), mode: 0o755 })),
    { name: 'WIZARD_UIFILES' },
    ...Object.entries(wizardFiles()).map(([name, data]) => ({ name, data })),
  ];

  return {
    fileName: `${PACKAGE}_${target}_${version}.spk`,
    version,
    bytes: writeTar(entries),
    info,
  };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      build: { type: 'string', default: '1' },
      out: { type: 'string', default: 'dist' },
      x86_64: { type: 'string' },
      armv8: { type: 'string' },
      armv7: { type: 'string' },
      i686: { type: 'string' },
    },
  });
  const binaries: Partial<Record<Family, Uint8Array>> = {};
  for (const family of FAMILIES) {
    const path = values[family];
    if (path) binaries[family] = readFileSync(path);
  }
  if (!values.version || Object.keys(binaries).length === 0) {
    process.stderr.write('usage: build.ts --version <x.y.z> [--build N] [--out dir] --x86_64 <bin> --armv8 <bin> --armv7 <bin> --i686 <bin>\n');
    process.exit(2);
  }
  const targets: BuildTarget[] = FAMILIES.filter((family) => binaries[family]);
  if (targets.length === FAMILIES.length) targets.push('universal');
  mkdirSync(values.out, { recursive: true });
  for (const target of targets) {
    const result = buildSpk({ target, binaries, upstreamVersion: values.version, build: Number(values.build) });
    const path = join(values.out, result.fileName);
    writeFileSync(path, result.bytes);
    const sha256 = createHash('sha256').update(result.bytes).digest('hex');
    process.stdout.write(`${path}  ${result.bytes.length} bytes  sha256 ${sha256}\n`);
  }
}

if (import.meta.main) main();
