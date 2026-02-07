# =============================================================================
# OpenSalesAI — Notification Service Dockerfile (multi-stage)
# =============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY services/notification-service/package.json services/notification-service/
COPY packages/shared/package.json packages/shared/

# Install all workspace dependencies
RUN npm ci --workspace=services/notification-service --workspace=packages/shared

# Copy source code
COPY packages/shared/ packages/shared/
COPY services/notification-service/ services/notification-service/

# Build shared package first, then service
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=services/notification-service

# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/notification-service/dist ./dist
COPY --from=builder /app/services/notification-service/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

EXPOSE 3003

CMD ["node", "dist/index.js"]
