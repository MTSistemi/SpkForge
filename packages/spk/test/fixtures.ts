// Builders for synthetic SPKs used across the test suites.

import { writeTar, type TarInput } from '../src/tar-write.ts';

export interface FakeSpkOptions {
  info?: Record<string, string>;
  signed?: boolean;
  payload?: boolean;
  extra?: TarInput[];
}

export const BASE_INFO: Record<string, string> = {
  package: 'zerotier',
  version: '1.16.2-1',
  arch: 'x86_64',
  displayname: 'ZeroTier',
  displayname_ita: 'ZeroTier',
  description: 'Secure network overlay.',
  description_ita: 'Rete overlay sicura.',
  maintainer: 'MTSistemi',
  os_min_ver: '7.0-40000',
};

export function infoText(info: Record<string, string>): string {
  return Object.entries(info)
    .map(([key, value]) => `${key}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join('\n') + '\n';
}

export function fakeSpk(options: FakeSpkOptions = {}): Uint8Array {
  const info = { ...BASE_INFO, ...options.info };
  const entries: TarInput[] = [{ name: 'INFO', data: infoText(info) }];
  if (options.payload !== false) entries.push({ name: 'package.tgz', data: new Uint8Array([0x1f, 0x8b, 0, 0]) });
  entries.push({ name: 'scripts', mode: 0o755 }, { name: 'scripts/start-stop-status', data: '#!/bin/sh\nexit 0\n', mode: 0o755 });
  entries.push({ name: 'PACKAGE_ICON.PNG', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) });
  if (options.signed) entries.push({ name: 'syno_signature.asc', data: '-----BEGIN PGP SIGNATURE-----\n' });
  entries.push(...(options.extra ?? []));
  return writeTar(entries);
}
