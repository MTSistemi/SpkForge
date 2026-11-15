// Minimal ustar writer, the counterpart of readTar. Used to assemble SPKs
// (outer tar) in the package recipes and to build fixtures in tests.
// Names longer than ustar allows get a pax 'path' record.

const BLOCK = 512;
const encoder = new TextEncoder();

export interface TarInput {
  name: string;
  /** Omit for a directory. */
  data?: Uint8Array | string;
  /** Unix permission bits; defaults to 0o644 for files, 0o755 for directories. */
  mode?: number;
  /** Seconds since the epoch; defaults to 0 so builds are reproducible. */
  mtime?: number;
}

function writeString(block: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = encoder.encode(value);
  if (bytes.length > length) throw new RangeError(`tar field too long: ${value}`);
  block.set(bytes, offset);
}

function writeOctal(block: Uint8Array, offset: number, length: number, value: number): void {
  writeString(block, offset, length, value.toString(8).padStart(length - 1, '0') + '\0');
}

function header(name: string, size: number, typeFlag: string, mode: number, mtime: number): Uint8Array {
  const block = new Uint8Array(BLOCK);
  writeString(block, 0, 100, name);
  writeOctal(block, 100, 8, mode);
  writeOctal(block, 108, 8, 0); // uid
  writeOctal(block, 116, 8, 0); // gid
  writeOctal(block, 124, 12, size);
  writeOctal(block, 136, 12, mtime);
  block.fill(0x20, 148, 156); // checksum placeholder: spaces
  writeString(block, 156, 1, typeFlag);
  writeString(block, 257, 6, 'ustar\0');
  writeString(block, 263, 2, '00');
  writeString(block, 265, 32, 'root');
  writeString(block, 297, 32, 'root');
  let sum = 0;
  for (const byte of block) sum += byte;
  writeString(block, 148, 8, sum.toString(8).padStart(6, '0') + '\0 ');
  return block;
}

function padded(data: Uint8Array): Uint8Array[] {
  const remainder = data.length % BLOCK;
  return remainder === 0 ? [data] : [data, new Uint8Array(BLOCK - remainder)];
}

function paxRecord(key: string, value: string): string {
  const body = ` ${key}=${value}\n`;
  let length = encoder.encode(body).length;
  length += String(length).length;
  if (String(length).length !== String(length - String(length).length).length) length += 1;
  return `${length}${body}`;
}

export function writeTar(inputs: readonly TarInput[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const input of inputs) {
    const isDirectory = input.data === undefined;
    const data = typeof input.data === 'string' ? encoder.encode(input.data) : (input.data ?? new Uint8Array(0));
    const name = isDirectory && !input.name.endsWith('/') ? `${input.name}/` : input.name;
    const mode = input.mode ?? (isDirectory ? 0o755 : 0o644);
    const mtime = input.mtime ?? 0;
    let headerName = name;
    if (encoder.encode(name).length > 100) {
      const pax = encoder.encode(paxRecord('path', name));
      parts.push(header('PaxHeader', pax.length, 'x', 0o644, mtime), ...padded(pax));
      headerName = name.slice(0, 99);
    }
    parts.push(header(headerName, data.length, isDirectory ? '5' : '0', mode, mtime));
    if (data.length > 0) parts.push(...padded(data));
  }
  parts.push(new Uint8Array(BLOCK * 2));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const archive = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    archive.set(part, offset);
    offset += part.length;
  }
  return archive;
}
