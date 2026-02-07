# =============================================================================
# OpenSalesAI — eB2B Service Dockerfile (multi-stage)
# =============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY services/eb2b-service/package.json services/eb2b-service/
COPY services/api-gateway/package.json services/api-gateway/
COPY packages/shared/package.json packages/shared/

# Install all workspace dependencies
RUN npm ci --workspace=services/eb2b-service --workspace=packages/shared

# Copy source code
COPY packages/shared/ packages/shared/
COPY services/api-gateway/prisma/ services/api-gateway/prisma/
COPY services/eb2b-service/ services/eb2b-service/

# Build shared package first, then service
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=services/eb2b-service

# Generate Prisma client (schema lives in api-gateway)
RUN npx prisma generate --schema=services/api-gateway/prisma/schema.prisma

# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/eb2b-service/dist ./dist
COPY --from=builder /app/services/eb2b-service/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

EXPOSE 3002

CMD ["node", "dist/index.js"]
