FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx nest build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 velya && \
    adduser --system --uid 1001 velya
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER velya
EXPOSE 3000
CMD ["node", "dist/main"]
