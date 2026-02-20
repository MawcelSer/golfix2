# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

# Copy workspace config + lockfile (for cache-friendly installs)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install all dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
COPY tsconfig.base.json ./

# Build shared first (API depends on it), then API
RUN pnpm --filter @golfix/shared build && pnpm --filter @golfix/api build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

# Copy workspace config for pnpm workspace resolution
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist

# Copy migrations (needed for db:migrate at deploy time)
COPY apps/api/src/db/migrations apps/api/src/db/migrations
COPY apps/api/drizzle.config.ts apps/api/drizzle.config.ts

EXPOSE 3000
ENV NODE_ENV=production

WORKDIR /app/apps/api
CMD ["node", "--import", "tsx", "dist/server.js"]
