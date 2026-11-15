// Formatting helpers shared by the public pages and the admin area.

import type { Family } from './api.ts';
import type { Lang } from './i18n.tsx';

export const FAMILY_ORDER: Family[] = ['x86_64', 'armv8', 'armv7', 'i686', 'noarch'];

export function formatBytes(bytes: number, lang: Lang): string {
  const locale = lang === 'it' ? 'it-IT' : 'en-GB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

/** "92e5636e…ce9baf3": enough to compare at a glance, full value one click away. */
export function shortHash(hash: string, head = 8, tail = 6): string {
  return hash.length <= head + tail + 1 ? hash : `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

/** DSM "7.0-40000" → "7.0". */
export function dsmShort(osMinVer: string): string {
  return osMinVer.split('-')[0] || osMinVer || '—';
}

export function formatDate(ms: number, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}
