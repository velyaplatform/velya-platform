FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --production=false

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN ./node_modules/.bin/tsc

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S velya && adduser -S velya -G velya
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER velya
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:${PORT:-3000}/healthz || exit 1
CMD ["node", "dist/main.js"]
