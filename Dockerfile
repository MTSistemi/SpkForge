# SpkForge server and web interface.
#
#   docker build -t spkforge .
#   docker run -p 8080:8080 -v spkforge-data:/data -e SPKFORGE_ADMIN_TOKEN=... spkforge
#
# The server has no third-party runtime dependency: Node 24 runs its
# TypeScript directly and keeps the index in node:sqlite.

FROM node:24-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages packages
RUN npm ci --no-audit --no-fund \
 && npm run build -w @spkforge/web \
 && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim
LABEL org.opencontainers.image.title="SpkForge" \
      org.opencontainers.image.description="Package source for Synology DSM 7, with web interface" \
      org.opencontainers.image.source="https://github.com/MTSistemi/SpkForge" \
      org.opencontainers.image.vendor="MTSistemi" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
ENV NODE_ENV=production \
    SPKFORGE_DATA=/data \
    SPKFORGE_PORT=8080 \
    SPKFORGE_HOST=0.0.0.0
WORKDIR /app
COPY --from=build /src/package.json ./
COPY --from=build /src/node_modules node_modules
COPY --from=build /src/packages/spk packages/spk
COPY --from=build /src/packages/server/package.json packages/server/package.json
COPY --from=build /src/packages/server/src packages/server/src
COPY --from=build /src/packages/web/package.json packages/web/package.json
COPY --from=build /src/packages/web/dist packages/web/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.SPKFORGE_PORT+'/api/packages').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "packages/server/src/main.ts"]
