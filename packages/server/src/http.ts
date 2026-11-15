// SpkForge HTTP server: DSM Package Center endpoint, downloads, public API for
// the web interface, admin API, and the static interface itself.
// Plain node:http on purpose: no framework, small attack surface.

import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { compareVersions, familyOf, knownPlatforms, localized, type Family } from '@spkforge/spk';
import { buildCatalog, parseDsmRequest, type CatalogOptions, type Channel } from './catalog.ts';
import { indexFile, reindex, SPK_FILE_NAME } from './indexer.ts';
import { Store, type StoredVersion } from './store.ts';

export interface ServerConfig {
  /** Directory holding packages/ (the .spk files) and spkforge.db. */
  dataDir: string;
  /** Built web interface (index.html + assets); optional. */
  webDir?: string | undefined;
  /** Public base URL with trailing slash; derived from the request when unset. */
  baseUrl?: string | undefined;
  /** Bearer token for /api/admin; admin API disabled when unset. */
  adminToken?: string | undefined;
  distributor?: string;
  distributorUrl?: string;
  /** Largest accepted upload, bytes. */
  maxUploadBytes?: number;
}

export interface SpkForgeServer {
  server: Server;
  store: Store;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: ServerResponse, status: number, body: string | Uint8Array, type: string, extra: Record<string, string> = {}): void {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function json(res: ServerResponse, status: number, value: unknown, extra: Record<string, string> = {}): void {
  send(res, status, JSON.stringify(value), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store', ...extra });
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > limit) throw new HttpError(413, `request body larger than ${limit} bytes`);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function tokenMatches(header: string | undefined, token: string): boolean {
  const presented = /^Bearer\s+(.+)$/i.exec(header ?? '')?.[1] ?? '';
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(token).digest();
  return presented !== '' && timingSafeEqual(a, b);
}

function families(arch: readonly string[]): (Family | 'noarch')[] {
  if (arch.includes('noarch')) return ['noarch'];
  const set = new Set<Family>();
  for (const token of arch) {
    const family = familyOf(token) ?? (['x86_64', 'armv8', 'armv7', 'i686'].includes(token) ? token as Family : undefined);
    if (family) set.add(family);
  }
  return [...set].sort();
}

function text(info: StoredVersion['info'], key: string): { enu: string; ita: string } {
  return { enu: localized(info, key, 'enu') ?? '', ita: localized(info, key, 'ita') ?? '' };
}

function versionView(v: StoredVersion, base: string) {
  const prefix = `${base}packages/${encodeURIComponent(v.id)}/${encodeURIComponent(v.version)}`;
  return {
    version: v.version,
    fileName: v.fileName,
    channel: v.channel,
    arch: v.arch,
    families: families(v.arch),
    osMinVer: v.info.os_min_ver ?? '',
    size: v.size,
    md5: v.md5,
    sha256: v.sha256,
    downloads: v.downloads,
    download: `${prefix}/${encodeURIComponent(v.fileName)}`,
    changelog: text(v.info, 'changelog'),
  };
}

function packageSummaries(versions: StoredVersion[], base: string) {
  const byId = new Map<string, StoredVersion[]>();
  for (const v of versions) byId.set(v.id, [...(byId.get(v.id) ?? []), v]);
  return [...byId.entries()].map(([id, list]) => {
    const sorted = [...list].sort((a, b) => compareVersions(b.version, a.version));
    const latest = sorted.find((v) => v.channel === 'stable') ?? sorted[0]!;
    return {
      id,
      name: text(latest.info, 'displayname'),
      description: text(latest.info, 'description'),
      maintainer: latest.info.maintainer ?? '',
      maintainerUrl: latest.info.maintainer_url ?? '',
      helpUrl: latest.info.helpurl ?? '',
      supportUrl: latest.info.support_url ?? '',
      latestVersion: latest.version,
      hasBeta: sorted.some((v) => v.channel === 'beta' && compareVersions(v.version, latest.version) > 0),
      families: [...new Set(list.flatMap((v) => families(v.arch)))].sort(),
      downloads: list.reduce((sum, v) => sum + v.downloads, 0),
      icon: `${base}packages/${encodeURIComponent(id)}/${encodeURIComponent(latest.version)}/icon_256.png`,
      versions: sorted.map((v) => versionView(v, base)),
    };
  }).sort((a, b) => a.name.enu.localeCompare(b.name.enu));
}

export function createSpkForgeServer(config: ServerConfig): SpkForgeServer {
  const packagesDir = resolve(config.dataDir, 'packages');
  mkdirSync(packagesDir, { recursive: true });
  const store = new Store(join(config.dataDir, 'spkforge.db'));
  reindex(store, packagesDir);
  const maxUpload = config.maxUploadBytes ?? 512 * 1024 * 1024;
  const webDir = config.webDir && existsSync(join(config.webDir, 'index.html')) ? resolve(config.webDir) : undefined;

  function baseUrl(req: IncomingMessage): string {
    if (config.baseUrl) return config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
    const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || 'http';
    const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? 'localhost';
    return `${proto}://${host}/`;
  }

  function catalogOptions(req: IncomingMessage): CatalogOptions {
    return {
      baseUrl: baseUrl(req),
      distributor: config.distributor ?? 'SpkForge',
      distributorUrl: config.distributorUrl ?? 'https://github.com/MTSistemi/SpkForge',
    };
  }

  function serveStatic(res: ServerResponse, urlPath: string): boolean {
    if (!webDir) return false;
    const relative = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
    let path = resolve(webDir, relative);
    if (path !== webDir && !path.startsWith(webDir + sep)) return false;
    if (!existsSync(path) || statSync(path).isDirectory()) path = join(webDir, 'index.html');
    const type = MIME[extname(path)] ?? 'application/octet-stream';
    const immutable = /[/\\]assets[/\\]/.test(path);
    send(res, 200, readFileSync(path), type, {
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    });
    return true;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://local');
    const method = req.method ?? 'GET';
    const path = url.pathname;

    // DSM Package Center: GET or POST on the source URL with NAS parameters.
    if (path === '/' && (method === 'GET' || method === 'POST')) {
      const params = new URLSearchParams(url.search);
      if (method === 'POST') {
        for (const [key, value] of new URLSearchParams((await readBody(req, 64 * 1024)).toString('utf8'))) params.set(key, value);
      }
      if (params.has('arch') || params.has('unique') || params.has('package_update_channel')) {
        json(res, 200, buildCatalog(store.versions(), parseDsmRequest(params), catalogOptions(req)));
        return;
      }
      if (method === 'GET' && serveStatic(res, '/')) return;
      json(res, 200, { name: 'SpkForge', source: baseUrl(req), api: `${baseUrl(req)}api/packages` });
      return;
    }

    // Downloads and icons: /packages/<id>/<version>/<file>
    const pkgMatch = /^\/packages\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(path);
    if (pkgMatch && method === 'GET') {
      const [id, version, file] = pkgMatch.slice(1).map((part) => decodeURIComponent(part)) as [string, string, string];
      if (file === 'icon_72.png' || file === 'icon_256.png') {
        const icon = store.icon(id, version, file === 'icon_72.png' ? 72 : 256);
        if (!icon) throw new HttpError(404, 'no icon');
        send(res, 200, icon, 'image/png', { 'Cache-Control': 'public, max-age=86400' });
        return;
      }
      if (!SPK_FILE_NAME.test(file)) throw new HttpError(404, 'not found');
      const v = store.findVersion(id, version, file);
      if (!v) throw new HttpError(404, 'not found');
      store.recordDownload({
        fileName: v.fileName,
        platform: url.searchParams.get('arch') ?? 'web',
        build: url.searchParams.get('build') ?? '',
        unique: url.searchParams.get('unique') ?? '',
      });
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(v.size),
        'Content-Disposition': `attachment; filename="${v.fileName}"`,
        'X-Checksum-Sha256': v.sha256,
        'Cache-Control': 'public, max-age=3600',
      });
      createReadStream(join(packagesDir, v.fileName)).pipe(res);
      return;
    }

    // Public API for the interface.
    if (path === '/api/info' && method === 'GET') {
      json(res, 200, { name: 'SpkForge', source: baseUrl(req), admin: Boolean(config.adminToken) });
      return;
    }
    if (path === '/api/packages' && method === 'GET') {
      json(res, 200, packageSummaries(store.versions(), baseUrl(req)));
      return;
    }
    const detail = /^\/api\/packages\/([^/]+)$/.exec(path);
    if (detail && method === 'GET') {
      const found = packageSummaries(store.versions(), baseUrl(req)).find((p) => p.id === decodeURIComponent(detail[1]!));
      if (!found) throw new HttpError(404, 'no such package');
      json(res, 200, found);
      return;
    }
    if (path === '/api/platforms' && method === 'GET') {
      json(res, 200, knownPlatforms().map((platform) => ({ platform, family: familyOf(platform) })));
      return;
    }
    if (path === '/api/preview' && method === 'GET') {
      // What a NAS with this platform / DSM build / channel would be offered.
      const params = new URLSearchParams({
        arch: url.searchParams.get('platform') ?? '',
        major: '7',
        minor: url.searchParams.get('minor') ?? '2',
        build: url.searchParams.get('build') ?? '',
        language: url.searchParams.get('language') ?? 'enu',
        package_update_channel: url.searchParams.get('channel') ?? 'stable',
      });
      json(res, 200, buildCatalog(store.versions(), parseDsmRequest(params), catalogOptions(req)));
      return;
    }

    // Admin API.
    if (path.startsWith('/api/admin/')) {
      if (!config.adminToken) throw new HttpError(404, 'admin API disabled');
      if (!tokenMatches(req.headers.authorization, config.adminToken)) {
        throw new HttpError(401, 'missing or wrong admin token');
      }
      const upload = /^\/api\/admin\/packages\/([^/]+)$/.exec(path);
      if (upload && method === 'PUT') {
        const fileName = decodeURIComponent(upload[1]!);
        if (!SPK_FILE_NAME.test(fileName)) throw new HttpError(400, 'file name must look like name_arch_1.0-1.spk');
        const body = await readBody(req, maxUpload);
        const tmp = join(packagesDir, `.${fileName}.upload`);
        writeFileSync(tmp, body);
        renameSync(tmp, join(packagesDir, fileName));
        const problems = indexFile(store, packagesDir, fileName);
        json(res, problems.length === 0 ? 201 : 422, { fileName, published: problems.length === 0, problems });
        return;
      }
      const withdraw = /^\/api\/admin\/packages\/([^/]+)$/.exec(path);
      if (withdraw && method === 'DELETE') {
        const fileName = decodeURIComponent(withdraw[1]!);
        if (!SPK_FILE_NAME.test(fileName) || !existsSync(join(packagesDir, fileName))) throw new HttpError(404, 'no such file');
        mkdirSync(join(config.dataDir, 'withdrawn'), { recursive: true });
        renameSync(join(packagesDir, fileName), join(config.dataDir, 'withdrawn', fileName));
        store.forget(fileName);
        json(res, 200, { fileName, withdrawn: true });
        return;
      }
      const channel = /^\/api\/admin\/packages\/([^/]+)\/channel$/.exec(path);
      if (channel && method === 'POST') {
        const wanted = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}').channel as Channel;
        if (wanted !== 'stable' && wanted !== 'beta') throw new HttpError(400, 'channel must be stable or beta');
        if (!store.setChannel(decodeURIComponent(channel[1]!), wanted)) throw new HttpError(404, 'no such file');
        json(res, 200, { channel: wanted });
        return;
      }
      if (path === '/api/admin/reindex' && method === 'POST') {
        json(res, 200, reindex(store, packagesDir, { force: true }));
        return;
      }
      if (path === '/api/admin/rejected' && method === 'GET') {
        json(res, 200, store.rejected());
        return;
      }
      if (path === '/api/admin/stats' && method === 'GET') {
        json(res, 200, store.downloadStats());
        return;
      }
      throw new HttpError(404, 'not found');
    }

    if (path.startsWith('/api/')) throw new HttpError(404, 'not found');
    if (method === 'GET' && serveStatic(res, path)) return;
    throw new HttpError(404, 'not found');
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      const status = error instanceof HttpError ? error.status : error instanceof SyntaxError ? 400 : 500;
      const message = status === 500 ? 'internal error' : (error as Error).message;
      if (status === 500) console.error(error);
      if (!res.headersSent) json(res, status, { error: message });
      else res.destroy();
    });
  });

  return {
    server,
    store,
    close: () => new Promise((done) => {
      server.close(() => {
        store.close();
        done();
      });
    }),
  };
}

