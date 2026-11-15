// Vite configuration for the SpkForge web interface.
// The API server serves dist/ (index.html at "/", hashed files under /assets/),
// so the build must not depend on any external host: the server's CSP forbids it.

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const api = 'http://127.0.0.1:8080';
const outDir = fileURLToPath(new URL('./dist', import.meta.url));

/** Delete old files but keep the directories themselves. */
function removeFiles(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) removeFiles(path);
    else rmSync(path, { force: true });
  }
}

/**
 * Vite's own emptyOutDir removes dist/assets as a directory, which fails with
 * EPERM on Windows while a sync client (Dropbox here) or the running server
 * holds a handle on it. Removing only the files avoids that.
 */
function cleanOutDir(): Plugin {
  return { name: 'spkforge:clean-out-dir', apply: 'build', buildStart: () => removeFiles(outDir) };
}

export default defineConfig({
  plugins: [react(), cleanOutDir()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': api,
      '/packages': api,
    },
  },
  build: {
    outDir,
    assetsDir: 'assets',
    target: 'es2022',
    // Inlining fonts or icons as data: URIs would bloat the CSS; keep them as files.
    assetsInlineLimit: 0,
    emptyOutDir: false,
  },
});
