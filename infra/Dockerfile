FROM node:24-bookworm-slim AS app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --no-audit
COPY --chown=node:node . .
RUN npm run build && mkdir -p /data/storage /app/.local && chown -R node:node /data /app/.local
USER node
EXPOSE 3001
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]

FROM app AS documents
USER root
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-core && rm -rf /var/lib/apt/lists/*
ENV PDF_CHROMIUM_PATH=/usr/bin/chromium
USER node
CMD ["node", "--import", "tsx", "apps/worker/src/documents-server.ts"]

FROM caddy:2-alpine AS web
COPY --from=app /app/dist/web /srv
COPY infra/Caddyfile /etc/caddy/Caddyfile

FROM postgres:18-bookworm AS backup
COPY --from=app /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=app --chown=postgres:postgres /app /app
ENV PG_BIN=/usr/lib/postgresql/18/bin
USER postgres
CMD ["node", "--import", "tsx", "scripts/backup-scheduler.ts"]
