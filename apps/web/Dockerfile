FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
# Monorepo: lockfile está na raiz, package.json do app em apps/web/
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=apps/web --include-workspace-root

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY apps/web/ ./apps/web/
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 velya && \
    adduser --system --uid 1001 velya
WORKDIR /app
# public dir is optional (não existe se não há assets estáticos)
COPY --from=build --chown=velya:velya /app/apps/web/.next/standalone ./
COPY --from=build --chown=velya:velya /app/apps/web/.next/static ./.next/static
USER velya
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
