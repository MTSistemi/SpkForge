// Audit (and optionally clean) the Package Center sources of Synology NAS.
//
// Finds sources that point at closed or untrusted hosts (by default the
// spk7.imnks.com / spk.imnks.com source that shut down on 2026-11-01) and the
// packages that are installed, with their run status.
//
// Read-only unless --remove is given. Credentials come from DSM_USER and
// DSM_PASSWORD; they are never written anywhere.
//
//   node tools/dsm-source-audit/audit.ts hosts.txt
//   node tools/dsm-source-audit/audit.ts --remove http://192.0.2.10:5000
//
// hosts.txt: one base URL per line (http://host:5000 or https://host:5001),
// '#' starts a comment. Self-signed HTTPS needs NODE_TLS_REJECT_UNAUTHORIZED=0.

import { readFileSync } from 'node:fs';

export const DEFAULT_BLOCKED = [/(^|\.)imnks\.com$/i];

export interface Feed { name: string; feed: string }
export interface InstalledPackage { id: string; version: string; status: string }
export interface HostReport {
  host: string;
  ok: boolean;
  error?: string;
  feeds: Feed[];
  blockedFeeds: Feed[];
  packages: InstalledPackage[];
  removed: string[];
}

interface ApiInfo { path: string; minVersion: number; maxVersion: number }
type Json = Record<string, unknown>;

export class DsmClient {
  private sid: string | undefined;
  private apis: Record<string, ApiInfo> = {};
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(base: string, fetchImpl: typeof fetch = fetch) {
    this.base = base.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  private async call(api: string, method: string, params: Record<string, string> = {}, wanted?: number): Promise<Json> {
    const info = api === 'SYNO.API.Info' ? { path: 'query.cgi', minVersion: 1, maxVersion: 1 } : this.apis[api];
    if (!info) throw new Error(`${api} is not available on this NAS`);
    const version = Math.max(info.minVersion, Math.min(info.maxVersion, wanted ?? info.maxVersion));
    const body = new URLSearchParams({ api, method, version: String(version), ...params });
    if (this.sid) body.set('_sid', this.sid);
    const response = await this.fetchImpl(`${this.base}/webapi/${info.path}`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`${api}.${method}: HTTP ${response.status}`);
    const json = (await response.json()) as Json;
    if (json.success !== true) {
      const code = (json.error as Json | undefined)?.code;
      throw new Error(`${api}.${method}: DSM error ${String(code ?? 'unknown')}`);
    }
    return (json.data ?? {}) as Json;
  }

  async login(account: string, password: string): Promise<void> {
    this.apis = (await this.call('SYNO.API.Info', 'query', { query: 'SYNO.API.Auth,SYNO.Core.Package,SYNO.Core.Package.Feed' })) as unknown as Record<string, ApiInfo>;
    const data = await this.call('SYNO.API.Auth', 'login', { account, passwd: password, session: 'PackageCenter', format: 'sid' }, 6);
    if (typeof data.sid !== 'string') throw new Error('login returned no session id');
    this.sid = data.sid;
  }

  async logout(): Promise<void> {
    if (!this.sid) return;
    try { await this.call('SYNO.API.Auth', 'logout', { session: 'PackageCenter' }); } catch { /* best effort */ }
    this.sid = undefined;
  }

  async feeds(): Promise<Feed[]> {
    const data = await this.call('SYNO.Core.Package.Feed', 'list');
    return ((data.items ?? []) as Json[]).map((item) => ({ name: String(item.name ?? ''), feed: String(item.feed ?? '') }));
  }

  async removeFeeds(urls: string[]): Promise<void> {
    await this.call('SYNO.Core.Package.Feed', 'delete', { list: JSON.stringify(urls) });
  }

  async packages(): Promise<InstalledPackage[]> {
    const data = await this.call('SYNO.Core.Package', 'list', { additional: JSON.stringify(['status']) });
    return ((data.packages ?? []) as Json[]).map((item) => ({
      id: String(item.id ?? ''),
      version: String(item.version ?? ''),
      status: String(((item.additional as Json | undefined)?.status as string | undefined) ?? ''),
    }));
  }
}

export function isBlocked(feedUrl: string, blocked: RegExp[] = DEFAULT_BLOCKED): boolean {
  try {
    const host = new URL(feedUrl).hostname;
    return blocked.some((pattern) => pattern.test(host));
  } catch {
    return false;
  }
}

export async function auditHost(
  host: string,
  credentials: { user: string; password: string },
  options: { remove?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<HostReport> {
  const report: HostReport = { host, ok: false, feeds: [], blockedFeeds: [], packages: [], removed: [] };
  const client = new DsmClient(host, options.fetchImpl);
  try {
    await client.login(credentials.user, credentials.password);
    report.feeds = await client.feeds();
    report.blockedFeeds = report.feeds.filter((feed) => isBlocked(feed.feed));
    report.packages = await client.packages();
    if (options.remove && report.blockedFeeds.length > 0) {
      const urls = report.blockedFeeds.map((feed) => feed.feed);
      await client.removeFeeds(urls);
      const after = await client.feeds();
      report.removed = urls.filter((url) => !after.some((feed) => feed.feed === url));
    }
    report.ok = true;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    await client.logout();
  }
  return report;
}

export type Language = 'en' | 'it';

const MESSAGES = {
  en: {
    error: 'ERROR', sources: 'sources', none: 'none', noneParen: '(none)',
    blocked: 'closed/untrusted sources', removed: 'REMOVED', unknownStatus: 'unknown status',
    notInstalled: 'not installed', packages: 'packages',
    usage: 'usage: audit.ts [--remove] <hosts.txt | http://host:5000> ...',
    credentials: 'set DSM_USER and DSM_PASSWORD in the environment',
  },
  it: {
    error: 'ERRORE', sources: 'sorgenti', none: 'nessuna', noneParen: '(nessuna)',
    blocked: 'sorgenti chiuse/non affidabili', removed: 'RIMOSSE', unknownStatus: 'stato sconosciuto',
    notInstalled: 'non installato', packages: 'pacchetti',
    usage: 'uso: audit.ts [--remove] <hosts.txt | http://host:5000> ...',
    credentials: 'imposta DSM_USER e DSM_PASSWORD nelle variabili d\'ambiente',
  },
} as const;

/** Italian when the locale says so (AUDIT_LANG, LC_ALL, LANG, then the OS locale), else English. */
export function detectLanguage(env: NodeJS.ProcessEnv = process.env): Language {
  const hint = env.AUDIT_LANG || env.LC_ALL || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale;
  return /^it/i.test(hint ?? '') ? 'it' : 'en';
}

export function formatReport(report: HostReport, language: Language = 'en'): string {
  const m = MESSAGES[language];
  if (!report.ok) return `${report.host}\n  ${m.error}: ${report.error}\n`;
  const lines = [report.host];
  lines.push(`  ${m.sources}: ${report.feeds.length === 0 ? m.noneParen : report.feeds.map((f) => `${f.name} <${f.feed}>`).join(', ')}`);
  lines.push(`  ${m.blocked}: ${report.blockedFeeds.length === 0 ? m.none : report.blockedFeeds.map((f) => f.feed).join(', ')}`);
  if (report.removed.length > 0) lines.push(`  ${m.removed}: ${report.removed.join(', ')}`);
  const zt = report.packages.find((p) => p.id.toLowerCase() === 'zerotier');
  lines.push(`  zerotier: ${zt ? `${zt.version} (${zt.status || m.unknownStatus})` : m.notInstalled}`);
  lines.push(`  ${m.packages}: ${report.packages.map((p) => `${p.id} ${p.version}${p.status && p.status !== 'running' ? ` [${p.status}]` : ''}`).join(', ')}`);
  return `${lines.join('\n')}\n`;
}

export function parseHostList(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.replace(/#.*/, '').trim()).filter((line) => line !== '');
}

async function main(argv: string[]): Promise<number> {
  const language = detectLanguage();
  const m = MESSAGES[language];
  const remove = argv.includes('--remove');
  const args = argv.filter((arg) => arg !== '--remove');
  if (args.length === 0) {
    process.stderr.write(`${m.usage}\n`);
    return 2;
  }
  const user = process.env.DSM_USER;
  const password = process.env.DSM_PASSWORD;
  if (!user || !password) {
    process.stderr.write(`${m.credentials}\n`);
    return 2;
  }
  const hosts = args.flatMap((arg) => (/^https?:\/\//.test(arg) ? [arg] : parseHostList(readFileSync(arg, 'utf8'))));
  let failures = 0;
  for (const host of hosts) {
    const report = await auditHost(host, { user, password }, { remove });
    if (!report.ok) failures++;
    process.stdout.write(formatReport(report, language));
  }
  return failures === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
