FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /repo

FROM base AS deps
# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspace=apps/web --include-workspace-root

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY apps/web ./apps/web
COPY tsconfig.base.json ./
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo/apps/web
RUN npx next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 velya && \
    adduser --system --uid 1001 velya
# standalone output is relative to the outputFileTracingRoot (/repo)
COPY --from=build --chown=velya:velya /repo/apps/web/.next/standalone ./
COPY --from=build --chown=velya:velya /repo/apps/web/.next/static ./apps/web/.next/static
USER velya
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
