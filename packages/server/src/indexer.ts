// Keep the index in step with the SPK files in the packages directory.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { infoBool, readSpk, validateSpk } from '@spkforge/spk';
import type { Store } from './store.ts';

export const SPK_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,180}\.spk$/;

export interface IndexResult {
  indexed: string[];
  rejected: { fileName: string; problems: { code: string; message: string }[] }[];
  removed: string[];
  unchanged: number;
}

/** Index one file. Returns the problems that kept it out, or an empty list. */
export function indexFile(store: Store, dir: string, fileName: string): { code: string; message: string }[] {
  const path = join(dir, fileName);
  const stat = statSync(path);
  let problems: { code: string; message: string }[];
  try {
    const spk = readSpk(readFileSync(path));
    problems = validateSpk(spk);
    if (problems.length === 0) {
      store.upsertVersion({
        fileName,
        id: spk.id,
        version: spk.version,
        arch: spk.arch,
        info: spk.info,
        size: spk.size,
        md5: spk.md5,
        sha256: spk.sha256,
        channel: infoBool(spk.info.beta) ? 'beta' : 'stable',
        mtimeMs: Math.trunc(stat.mtimeMs),
        indexedAt: Date.now(),
      }, spk.icon, spk.icon256);
      return [];
    }
  } catch (error) {
    problems = [{ code: 'unreadable', message: error instanceof Error ? error.message : String(error) }];
  }
  store.reject(fileName, problems, Math.trunc(stat.mtimeMs));
  return problems;
}

/** Scan the directory: index new or changed files, forget files that are gone. */
export function reindex(store: Store, dir: string, options: { force?: boolean } = {}): IndexResult {
  const result: IndexResult = { indexed: [], rejected: [], removed: [], unchanged: 0 };
  const present = new Set<string>();
  for (const fileName of readdirSync(dir).sort()) {
    if (!SPK_FILE_NAME.test(fileName)) continue;
    present.add(fileName);
    const mtime = Math.trunc(statSync(join(dir, fileName)).mtimeMs);
    if (!options.force && store.indexedMtime(fileName) === mtime) {
      result.unchanged++;
      continue;
    }
    const problems = indexFile(store, dir, fileName);
    if (problems.length === 0) result.indexed.push(fileName);
    else result.rejected.push({ fileName, problems });
  }
  for (const fileName of store.knownFiles()) {
    if (!present.has(fileName)) {
      store.forget(fileName);
      result.removed.push(fileName);
    }
  }
  return result;
}
