// Read an .spk into everything the index needs: INFO, icons, file list, checksums,
// and the problems that keep a package out of the catalog.

import { createHash } from 'node:crypto';
import { readTar, type TarEntry } from './tar.ts';
import { parseInfo, type InfoMap } from './info.ts';
import { parseArchList } from './arch.ts';

export const SIGNATURE_FILE = 'syno_signature.asc';

export interface SpkFile {
  name: string;
  type: TarEntry['type'];
  size: number;
}

export interface SpkPackage {
  info: InfoMap;
  /** Package id (INFO `package`). */
  id: string;
  version: string;
  arch: string[];
  files: SpkFile[];
  /** 72x72 icon (PACKAGE_ICON.PNG), when present. */
  icon: Uint8Array | undefined;
  /** 256x256 icon (PACKAGE_ICON_256.PNG), when present. */
  icon256: Uint8Array | undefined;
  size: number;
  md5: string;
  sha256: string;
  /** True when the SPK carries a DSM codesign signature (see docs: we refuse those). */
  signed: boolean;
}

export interface SpkProblem {
  code: 'missing-info' | 'missing-field' | 'missing-payload' | 'dsm-signature' | 'bad-id';
  message: string;
}

export class SpkError extends Error {
  override name = 'SpkError';
}

const decoder = new TextDecoder('utf-8');

export function readSpk(bytes: Uint8Array): SpkPackage {
  const entries = readTar(bytes);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const infoEntry = byName.get('INFO');
  if (!infoEntry) throw new SpkError('not an SPK: INFO is missing');
  const info = parseInfo(decoder.decode(infoEntry.data));
  return {
    info,
    id: info.package ?? '',
    version: info.version ?? '',
    arch: parseArchList(info.arch),
    files: entries.map(({ name, type, size }) => ({ name, type, size })),
    icon: byName.get('PACKAGE_ICON.PNG')?.data.slice(),
    icon256: byName.get('PACKAGE_ICON_256.PNG')?.data.slice(),
    size: bytes.length,
    md5: createHash('md5').update(bytes).digest('hex'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    signed: byName.has(SIGNATURE_FILE),
  };
}

const REQUIRED_FIELDS = ['package', 'version', 'arch', 'displayname', 'description', 'maintainer', 'os_min_ver'] as const;

/** Reasons a package may not be published. An empty list means it can be indexed. */
export function validateSpk(spk: SpkPackage): SpkProblem[] {
  const problems: SpkProblem[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!spk.info[field]) problems.push({ code: 'missing-field', message: `INFO has no "${field}"` });
  }
  if (spk.id && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(spk.id)) {
    problems.push({ code: 'bad-id', message: `package id ${JSON.stringify(spk.id)} has invalid characters` });
  }
  if (!spk.files.some((file) => file.name === 'package.tgz')) {
    problems.push({ code: 'missing-payload', message: 'package.tgz is missing' });
  }
  if (spk.signed) {
    problems.push({
      code: 'dsm-signature',
      message: `${SIGNATURE_FILE} present: DSM 7 deprecated SPK codesign, so it adds no trust; we ship packages without it`,
    });
  }
  return problems;
}
