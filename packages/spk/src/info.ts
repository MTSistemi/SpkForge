// Parser for the INFO file at the root of every SPK.
// Format: one `key="value"` per line. Values may also be unquoted; inside quotes,
// backslash escapes \" and \\ are honoured. Blank lines and lines starting with
// '#' are ignored.

export type InfoMap = Record<string, string>;

export class InfoError extends Error {
  override name = 'InfoError';
}

export function parseInfo(text: string): InfoMap {
  const info: InfoMap = {};
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq <= 0) throw new InfoError(`INFO line ${index + 1}: expected key="value"`);
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z0-9_.-]+$/.test(key)) throw new InfoError(`INFO line ${index + 1}: invalid key ${JSON.stringify(key)}`);
    info[key] = unquote(line.slice(eq + 1).trim(), index + 1);
  });
  return info;
}

function unquote(value: string, lineNumber: number): string {
  if (!value.startsWith('"')) return value;
  let result = '';
  for (let i = 1; i < value.length; i++) {
    const ch = value[i];
    if (ch === '\\' && i + 1 < value.length) {
      result += value[++i];
    } else if (ch === '"') {
      if (value.slice(i + 1).trim() !== '') throw new InfoError(`INFO line ${lineNumber}: text after closing quote`);
      return result;
    } else {
      result += ch;
    }
  }
  throw new InfoError(`INFO line ${lineNumber}: missing closing quote`);
}

/** Synology three-letter language codes accepted by Package Center. */
export const DSM_LANGUAGES = [
  'enu', 'ita', 'chs', 'cht', 'csy', 'dan', 'fre', 'ger', 'hun', 'jpn', 'krn',
  'nld', 'nor', 'plk', 'ptb', 'ptg', 'rus', 'spn', 'sve', 'tha', 'trk',
] as const;

/**
 * Value of a localisable INFO key (displayname, description...) for a language,
 * falling back to English and then to the plain key.
 */
export function localized(info: InfoMap, key: string, language: string): string | undefined {
  return info[`${key}_${language}`] ?? info[`${key}_enu`] ?? info[key];
}

export function infoBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return /^(yes|true|1)$/i.test(value.trim());
}
