// Minimal, dependency-free reader for uncompressed tar archives.
// An .spk file is a plain (not gzipped) tar; this is all we need to index one.
// Supports ustar, GNU long names ('L') and pax extended headers ('x', 'g').

const BLOCK = 512;

export interface TarEntry {
  /** Path inside the archive, without a leading "./". */
  name: string;
  /** "file", "directory", "symlink" or "other". */
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  /** File contents; empty for anything that is not a regular file. */
  data: Uint8Array;
}

export class TarError extends Error {
  override name = 'TarError';
}

const decoder = new TextDecoder('utf-8');

function readString(block: Uint8Array, offset: number, length: number): string {
  const slice = block.subarray(offset, offset + length);
  const end = slice.indexOf(0);
  return decoder.decode(end === -1 ? slice : slice.subarray(0, end));
}

function readOctal(block: Uint8Array, offset: number, length: number): number {
  const first = block[offset];
  if (first !== undefined && (first & 0x80) !== 0) {
    // GNU base-256 encoding, used for sizes above 8 GiB.
    let value = first & 0x7f;
    for (let i = 1; i < length; i++) value = value * 256 + (block[offset + i] ?? 0);
    return value;
  }
  const text = readString(block, offset, length).trim();
  if (text === '') return 0;
  if (!/^[0-7]+$/.test(text)) throw new TarError(`invalid octal field: ${JSON.stringify(text)}`);
  return parseInt(text, 8);
}

function checksumMatches(block: Uint8Array): boolean {
  const stored = readOctal(block, 148, 8);
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : (block[i] ?? 0);
  return sum === stored;
}

function isZeroBlock(block: Uint8Array): boolean {
  for (const byte of block) if (byte !== 0) return false;
  return true;
}

function parsePax(data: Uint8Array): Map<string, string> {
  // Records look like "<length> <key>=<value>\n", length counted in bytes.
  const records = new Map<string, string>();
  let pos = 0;
  while (pos < data.length) {
    const space = data.indexOf(0x20, pos);
    if (space === -1) break;
    const length = parseInt(decoder.decode(data.subarray(pos, space)), 10);
    if (!Number.isFinite(length) || length <= 0) throw new TarError('invalid pax record');
    const record = decoder.decode(data.subarray(space + 1, pos + length - 1));
    const eq = record.indexOf('=');
    if (eq > 0) records.set(record.slice(0, eq), record.slice(eq + 1));
    pos += length;
  }
  return records;
}

export function normalizeName(name: string): string {
  let result = name.replace(/\\/g, '/');
  while (result.startsWith('./')) result = result.slice(2);
  return result.replace(/^\/+/, '');
}

/** Read every entry of a tar archive held in memory. */
export function readTar(archive: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let longName: string | undefined;
  let pax: Map<string, string> | undefined;

  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (isZeroBlock(header)) break;
    if (!checksumMatches(header)) throw new TarError(`bad header checksum at offset ${offset}`);

    const typeFlag = String.fromCharCode(header[156] ?? 0);
    let size = readOctal(header, 124, 12);
    if (pax?.has('size')) size = Number(pax.get('size'));
    const dataStart = offset + BLOCK;
    const dataEnd = dataStart + size;
    if (dataEnd > archive.length) throw new TarError('archive is truncated');
    const data = archive.subarray(dataStart, dataEnd);
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;

    if (typeFlag === 'L') {
      longName = decoder.decode(data).replace(/\0+$/, '');
      continue;
    }
    if (typeFlag === 'x') {
      pax = parsePax(data);
      continue;
    }
    if (typeFlag === 'g') continue; // global pax header: nothing we need from it

    let name = readString(header, 0, 100);
    const magic = readString(header, 257, 6);
    if (magic.startsWith('ustar')) {
      const prefix = readString(header, 345, 155);
      if (prefix) name = `${prefix}/${name}`;
    }
    if (longName !== undefined) name = longName;
    if (pax?.has('path')) name = pax.get('path') ?? name;
    longName = undefined;
    pax = undefined;

    let type: TarEntry['type'];
    if (typeFlag === '0' || typeFlag === '\0' || typeFlag === '7') type = 'file';
    else if (typeFlag === '5') type = 'directory';
    else if (typeFlag === '2') type = 'symlink';
    else type = 'other';

    entries.push({
      name: normalizeName(name),
      type,
      size: type === 'file' ? size : 0,
      data: type === 'file' ? data : new Uint8Array(0),
    });
  }
  return entries;
}
