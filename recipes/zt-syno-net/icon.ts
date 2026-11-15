// Package icon for zt-syno-net, drawn in code so the repository holds no
// binary art and no third-party logo: three linked black nodes on a warm yellow
// rounded square. Rendered with 4x supersampling and encoded as an RGBA PNG.

import { crc32, deflateSync } from 'node:zlib';

type Rgb = [number, number, number];

const BACKGROUND: Rgb = [255, 189, 46];   // warm yellow
const FOREGROUND: Rgb = [17, 17, 17];     // near black
const SUPERSAMPLE = 4;

function insideRoundedSquare(x: number, y: number, size: number, radius: number): boolean {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Coverage of background and foreground at one point in unit coordinates (0..1). */
function sample(u: number, v: number): { bg: boolean; fg: boolean } {
  const bg = insideRoundedSquare(u, v, 1, 0.2);
  if (!bg) return { bg, fg: false };
  const nodes: [number, number][] = [[0.5, 0.24], [0.25, 0.7], [0.75, 0.7]];
  const nodeRadius = 0.105;
  const lineHalfWidth = 0.035;
  let fg = nodes.some(([x, y]) => Math.hypot(u - x, v - y) <= nodeRadius);
  for (let i = 0; i < nodes.length && !fg; i++) {
    const [ax, ay] = nodes[i]!;
    const [bx, by] = nodes[(i + 1) % nodes.length]!;
    if (distanceToSegment(u, v, ax, ay, bx, by) <= lineHalfWidth) fg = true;
  }
  return { bg, fg };
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function renderIcon(size: number): Uint8Array {
  const rowBytes = size * 4 + 1;
  const raw = new Uint8Array(rowBytes * size);
  const n = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      let bgCount = 0;
      let fgCount = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const s = sample((x + (sx + 0.5) / SUPERSAMPLE) / size, (y + (sy + 0.5) / SUPERSAMPLE) / size);
          if (s.bg) bgCount++;
          if (s.fg) fgCount++;
        }
      }
      const alpha = bgCount / n;
      const mix = bgCount === 0 ? 0 : fgCount / bgCount;
      const offset = y * rowBytes + 1 + x * 4;
      for (let c = 0; c < 3; c++) raw[offset + c] = Math.round(BACKGROUND[c]! * (1 - mix) + FOREGROUND[c]! * mix);
      raw[offset + 3] = Math.round(alpha * 255);
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit, RGBA, deflate, no filter, no interlace
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [signature, chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}
