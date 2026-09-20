FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core ./packages/core
COPY packages/jev ./packages/jev
COPY apps/scan-worker ./apps/scan-worker
RUN pnpm install --frozen-lockfile --filter @jev-traps/scan-worker... && pnpm --filter @jev-traps/core build && pnpm --filter @jev-traps/jev build
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
CMD ["node", "apps/scan-worker/server.mjs"]
