// Start SpkForge from environment variables.
//
//   SPKFORGE_DATA         data directory (packages/, spkforge.db)   default ./data
//   SPKFORGE_PORT         listen port                               default 8080
//   SPKFORGE_HOST         listen address                            default 0.0.0.0
//   SPKFORGE_BASE_URL     public URL, e.g. https://spk.example.com/ default: from the request
//   SPKFORGE_ADMIN_TOKEN  bearer token for /api/admin               default: admin API off
//   SPKFORGE_WEB          built web interface directory             default packages/web/dist

import { fileURLToPath } from 'node:url';
import { createSpkForgeServer } from './http.ts';

const webDefault = fileURLToPath(new URL('../../web/dist', import.meta.url));
const env = process.env;

const app = createSpkForgeServer({
  dataDir: env.SPKFORGE_DATA ?? 'data',
  webDir: env.SPKFORGE_WEB ?? webDefault,
  baseUrl: env.SPKFORGE_BASE_URL,
  adminToken: env.SPKFORGE_ADMIN_TOKEN,
});

const port = Number(env.SPKFORGE_PORT ?? 8080);
const host = env.SPKFORGE_HOST ?? '0.0.0.0';
app.server.listen(port, host, () => {
  const count = app.store.versions().length;
  console.log(`SpkForge listening on http://${host}:${port}/ — ${count} package file(s) indexed`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
