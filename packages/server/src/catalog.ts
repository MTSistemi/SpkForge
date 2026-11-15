// The DSM Package Center protocol: parse the request a NAS sends to a package
// source and answer with the packages that fit it.

import {
  archMatches, compareDsm, compareVersions, infoBool, localized, parseDsmVersion,
  type DsmVersion, type InfoMap,
} from '@spkforge/spk';

export type Channel = 'stable' | 'beta';

/** One published version of a package for a given set of architectures. */
export interface CatalogVersion {
  id: string;
  version: string;
  arch: readonly string[];
  info: InfoMap;
  /** File name the SPK is served under. */
  fileName: string;
  size: number;
  md5: string;
  channel: Channel;
  hasIcon256: boolean;
  downloads: number;
  recentDownloads: number;
}

/** What a NAS tells us about itself. */
export interface DsmRequest {
  platform: string;
  /** Model hint, e.g. "synology_geminilake_723p"; empty when not sent. */
  unique: string;
  dsm: DsmVersion | undefined;
  language: string;
  channel: Channel;
}

export interface CatalogOptions {
  /** Public base URL of this source, with trailing slash. */
  baseUrl: string;
  distributor: string;
  distributorUrl: string;
}

/** Entry shape Package Center expects in `packages`. */
export interface CatalogEntry {
  package: string;
  version: string;
  dname: string;
  desc: string;
  changelog: string;
  link: string;
  md5: string;
  size: number;
  thumbnail: string[];
  thumbnail_retina: string[];
  snapshot: string[];
  qinst: boolean;
  qstart: boolean;
  qupgrade: boolean;
  deppkgs: string | null;
  conflictpkgs: string | null;
  startable: 'yes' | 'no';
  maintainer: string;
  maintainer_url: string;
  distributor: string;
  distributor_url: string;
  support_url: string;
  download_count: number;
  recent_download_count: number;
  beta: boolean;
}

const LANGUAGE_PATTERN = /^[a-z]{3}$/;

/** Read a Package Center request from query string or form body parameters. */
export function parseDsmRequest(params: URLSearchParams): DsmRequest {
  const platform = (params.get('arch') ?? '').trim().toLowerCase();
  const major = params.get('major');
  const build = params.get('build');
  let dsm: DsmVersion | undefined;
  if (major !== null && /^\d+$/.test(major)) {
    const version = `${major}.${params.get('minor') ?? 0}.${params.get('micro') ?? 0}`;
    dsm = parseDsmVersion(build && /^\d+$/.test(build) ? `${version}-${build}` : version);
  }
  const language = (params.get('language') ?? '').trim().toLowerCase();
  return {
    platform,
    unique: (params.get('unique') ?? '').trim(),
    dsm,
    language: LANGUAGE_PATTERN.test(language) ? language : 'enu',
    channel: params.get('package_update_channel') === 'beta' ? 'beta' : 'stable',
  };
}

/** True when this version may be offered to this NAS. */
export function fits(version: CatalogVersion, request: DsmRequest): boolean {
  if (!request.platform || !archMatches(version.arch, request.platform)) return false;
  if (version.channel === 'beta' && request.channel !== 'beta') return false;
  if (request.dsm) {
    const min = parseDsmVersion(version.info.os_min_ver);
    if (min && compareDsm(request.dsm, min) < 0) return false;
    const max = parseDsmVersion(version.info.os_max_ver);
    if (max && compareDsm(request.dsm, max) > 0) return false;
  }
  return true;
}

/** Newest fitting version per package id, ordered by display name. */
export function selectVersions(versions: readonly CatalogVersion[], request: DsmRequest): CatalogVersion[] {
  const best = new Map<string, CatalogVersion>();
  for (const candidate of versions) {
    if (!fits(candidate, request)) continue;
    const current = best.get(candidate.id);
    if (!current || compareVersions(candidate.version, current.version) > 0) best.set(candidate.id, candidate);
  }
  return [...best.values()].sort((a, b) =>
    (localized(a.info, 'displayname', 'enu') ?? a.id).localeCompare(localized(b.info, 'displayname', 'enu') ?? b.id));
}

function nullable(value: string | undefined): string | null {
  return value && value.trim() !== '' ? value : null;
}

export function toEntry(version: CatalogVersion, request: DsmRequest, options: CatalogOptions): CatalogEntry {
  const { info } = version;
  const lang = request.language;
  const base = `${options.baseUrl}packages/${encodeURIComponent(version.id)}/${encodeURIComponent(version.version)}`;
  const query = new URLSearchParams({ arch: request.platform });
  if (request.dsm?.build !== undefined) query.set('build', String(request.dsm.build));
  if (request.unique) query.set('unique', request.unique);
  const icon72 = `${base}/icon_72.png`;
  const icon256 = version.hasIcon256 ? `${base}/icon_256.png` : icon72;
  const startable = info.startable !== undefined
    ? (infoBool(info.startable, true) ? 'yes' : 'no')
    : (info.ctl_stop !== undefined && !infoBool(info.ctl_stop, true) ? 'no' : 'yes');
  const silentInstall = infoBool(info.silent_install);
  return {
    package: version.id,
    version: version.version,
    dname: localized(info, 'displayname', lang) ?? version.id,
    desc: localized(info, 'description', lang) ?? '',
    changelog: localized(info, 'changelog', lang) ?? '',
    link: `${base}/${encodeURIComponent(version.fileName)}?${query}`,
    md5: version.md5,
    size: version.size,
    thumbnail: [icon72, icon256],
    thumbnail_retina: [icon256, icon256],
    snapshot: [],
    qinst: silentInstall,
    qstart: silentInstall && startable === 'yes',
    qupgrade: infoBool(info.silent_upgrade),
    deppkgs: nullable(info.install_dep_packages),
    conflictpkgs: nullable(info.install_conflict_packages),
    startable,
    maintainer: info.maintainer ?? options.distributor,
    maintainer_url: info.maintainer_url ?? options.distributorUrl,
    distributor: info.distributor ?? options.distributor,
    distributor_url: info.distributor_url ?? options.distributorUrl,
    support_url: info.support_url ?? options.distributorUrl,
    download_count: version.downloads,
    recent_download_count: version.recentDownloads,
    beta: version.channel === 'beta',
  };
}

/** Full Package Center answer for one request. */
export function buildCatalog(
  versions: readonly CatalogVersion[],
  request: DsmRequest,
  options: CatalogOptions,
): { packages: CatalogEntry[] } {
  return { packages: selectVersions(versions, request).map((version) => toEntry(version, request, options)) };
}
