// SQLite index of the published packages, rejected uploads and downloads.
// Uses the built-in node:sqlite, so there is no native module to compile.

import { DatabaseSync } from 'node:sqlite';
import type { InfoMap } from '@spkforge/spk';
import type { CatalogVersion, Channel } from './catalog.ts';

export interface StoredVersion extends CatalogVersion {
  sha256: string;
  mtimeMs: number;
  indexedAt: number;
}

export interface RejectedFile {
  fileName: string;
  problems: { code: string; message: string }[];
  indexedAt: number;
}

export interface DownloadEvent {
  fileName: string;
  platform: string;
  build: string;
  unique: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS versions (
  file_name   TEXT PRIMARY KEY,
  id          TEXT NOT NULL,
  version     TEXT NOT NULL,
  arch        TEXT NOT NULL,
  info        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  md5         TEXT NOT NULL,
  sha256      TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'stable',
  icon72      BLOB,
  icon256     BLOB,
  mtime_ms    INTEGER NOT NULL,
  indexed_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS versions_id ON versions(id);
CREATE TABLE IF NOT EXISTS rejected (
  file_name   TEXT PRIMARY KEY,
  problems    TEXT NOT NULL,
  mtime_ms    INTEGER NOT NULL,
  indexed_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS downloads (
  file_name   TEXT NOT NULL,
  at          INTEGER NOT NULL,
  platform    TEXT NOT NULL,
  build       TEXT NOT NULL,
  model       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS downloads_file ON downloads(file_name, at);
`;

const RECENT_MS = 30 * 24 * 3600 * 1000;

interface VersionRow {
  file_name: string;
  id: string;
  version: string;
  arch: string;
  info: string;
  size: number;
  md5: string;
  sha256: string;
  channel: string;
  has_icon256: number;
  mtime_ms: number;
  indexed_at: number;
  downloads: number;
  recent: number;
}

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  upsertVersion(v: Omit<StoredVersion, 'downloads' | 'recentDownloads' | 'hasIcon256'>, icon72: Uint8Array | undefined, icon256: Uint8Array | undefined): void {
    this.db.prepare(`
      INSERT INTO versions (file_name, id, version, arch, info, size, md5, sha256, channel, icon72, icon256, mtime_ms, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_name) DO UPDATE SET
        id = excluded.id, version = excluded.version, arch = excluded.arch, info = excluded.info,
        size = excluded.size, md5 = excluded.md5, sha256 = excluded.sha256, icon72 = excluded.icon72,
        icon256 = excluded.icon256, mtime_ms = excluded.mtime_ms, indexed_at = excluded.indexed_at
    `).run(v.fileName, v.id, v.version, v.arch.join(' '), JSON.stringify(v.info), v.size, v.md5, v.sha256, v.channel,
      icon72 ?? null, icon256 ?? null, v.mtimeMs, v.indexedAt);
    this.db.prepare('DELETE FROM rejected WHERE file_name = ?').run(v.fileName);
  }

  reject(fileName: string, problems: RejectedFile['problems'], mtimeMs: number): void {
    this.db.prepare(`
      INSERT INTO rejected (file_name, problems, mtime_ms, indexed_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(file_name) DO UPDATE SET problems = excluded.problems, mtime_ms = excluded.mtime_ms, indexed_at = excluded.indexed_at
    `).run(fileName, JSON.stringify(problems), mtimeMs, Date.now());
    this.db.prepare('DELETE FROM versions WHERE file_name = ?').run(fileName);
  }

  /** mtime of what is indexed for a file (published or rejected), to skip unchanged files. */
  indexedMtime(fileName: string): number | undefined {
    const row = this.db.prepare(`
      SELECT mtime_ms FROM versions WHERE file_name = ? UNION ALL SELECT mtime_ms FROM rejected WHERE file_name = ?
    `).get(fileName, fileName) as { mtime_ms: number } | undefined;
    return row?.mtime_ms;
  }

  forget(fileName: string): void {
    this.db.prepare('DELETE FROM versions WHERE file_name = ?').run(fileName);
    this.db.prepare('DELETE FROM rejected WHERE file_name = ?').run(fileName);
  }

  knownFiles(): string[] {
    const rows = this.db.prepare('SELECT file_name FROM versions UNION SELECT file_name FROM rejected').all() as { file_name: string }[];
    return rows.map((row) => row.file_name);
  }

  setChannel(fileName: string, channel: Channel): boolean {
    return this.db.prepare('UPDATE versions SET channel = ? WHERE file_name = ?').run(channel, fileName).changes > 0;
  }

  versions(): StoredVersion[] {
    const since = Date.now() - RECENT_MS;
    const rows = this.db.prepare(`
      SELECT v.file_name, v.id, v.version, v.arch, v.info, v.size, v.md5, v.sha256, v.channel,
             v.icon256 IS NOT NULL AS has_icon256, v.mtime_ms, v.indexed_at,
             (SELECT COUNT(*) FROM downloads d WHERE d.file_name = v.file_name) AS downloads,
             (SELECT COUNT(*) FROM downloads d WHERE d.file_name = v.file_name AND d.at >= ?) AS recent
      FROM versions v ORDER BY v.id, v.file_name
    `).all(since) as unknown as VersionRow[];
    return rows.map((row) => ({
      fileName: row.file_name,
      id: row.id,
      version: row.version,
      arch: row.arch.split(' ').filter(Boolean),
      info: JSON.parse(row.info) as InfoMap,
      size: row.size,
      md5: row.md5,
      sha256: row.sha256,
      channel: row.channel === 'beta' ? 'beta' : 'stable',
      hasIcon256: row.has_icon256 === 1,
      downloads: row.downloads,
      recentDownloads: row.recent,
      mtimeMs: row.mtime_ms,
      indexedAt: row.indexed_at,
    }));
  }

  findVersion(id: string, version: string, fileName: string): StoredVersion | undefined {
    return this.versions().find((v) => v.id === id && v.version === version && v.fileName === fileName);
  }

  icon(id: string, version: string, size: 72 | 256): Uint8Array | undefined {
    const row = this.db.prepare(`
      SELECT icon72, icon256 FROM versions WHERE id = ? AND version = ?
      ORDER BY (icon256 IS NULL), file_name LIMIT 1
    `).get(id, version) as { icon72: Uint8Array | null; icon256: Uint8Array | null } | undefined;
    if (!row) return undefined;
    return (size === 256 ? row.icon256 ?? row.icon72 : row.icon72 ?? row.icon256) ?? undefined;
  }

  rejected(): RejectedFile[] {
    const rows = this.db.prepare('SELECT file_name, problems, indexed_at FROM rejected ORDER BY file_name').all() as
      { file_name: string; problems: string; indexed_at: number }[];
    return rows.map((row) => ({ fileName: row.file_name, problems: JSON.parse(row.problems), indexedAt: row.indexed_at }));
  }

  recordDownload(event: DownloadEvent): void {
    this.db.prepare('INSERT INTO downloads (file_name, at, platform, build, model) VALUES (?, ?, ?, ?, ?)')
      .run(event.fileName, Date.now(), event.platform.slice(0, 40), event.build.slice(0, 12), event.unique.slice(0, 80));
  }

  downloadStats(): { byPackage: { id: string; downloads: number }[]; byPlatform: { platform: string; downloads: number }[] } {
    const byPackage = this.db.prepare(`
      SELECT v.id AS id, COUNT(d.at) AS downloads FROM versions v LEFT JOIN downloads d ON d.file_name = v.file_name
      GROUP BY v.id ORDER BY downloads DESC
    `).all() as { id: string; downloads: number }[];
    const byPlatform = this.db.prepare(`
      SELECT platform, COUNT(*) AS downloads FROM downloads GROUP BY platform ORDER BY downloads DESC
    `).all() as { platform: string; downloads: number }[];
    return { byPackage, byPlatform };
  }
}
