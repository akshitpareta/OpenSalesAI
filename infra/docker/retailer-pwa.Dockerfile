# =============================================================================
# OpenSalesAI — Retailer PWA Dockerfile (Next.js standalone build, multi-stage)
# =============================================================================

FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/retailer-pwa/package.json apps/retailer-pwa/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/

# Install all workspace dependencies
RUN npm ci --workspace=apps/retailer-pwa --workspace=packages/shared --workspace=packages/ui

# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/retailer-pwa/node_modules ./apps/retailer-pwa/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules

# Copy source code
COPY package.json ./
COPY packages/shared/ packages/shared/
COPY packages/ui/ packages/ui/
COPY apps/retailer-pwa/ apps/retailer-pwa/

# Build shared packages first
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/ui

# Build the Next.js app in standalone mode
# next.config.js must include: output: 'standalone'
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/retailer-pwa && npx next build

# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3011
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/retailer-pwa/.next/standalone ./
COPY --from=builder /app/apps/retailer-pwa/.next/static ./apps/retailer-pwa/.next/static
COPY --from=builder /app/apps/retailer-pwa/public ./apps/retailer-pwa/public

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3011/ || exit 1

EXPOSE 3011

CMD ["node", "apps/retailer-pwa/server.js"]
