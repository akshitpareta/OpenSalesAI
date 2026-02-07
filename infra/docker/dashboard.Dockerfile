# =============================================================================
# OpenSalesAI — Dashboard Dockerfile (Next.js standalone build, multi-stage)
# =============================================================================

FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/

# Install all workspace dependencies
RUN npm ci --workspace=apps/dashboard --workspace=packages/shared --workspace=packages/ui

# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules

# Copy source code
COPY package.json ./
COPY packages/shared/ packages/shared/
COPY packages/ui/ packages/ui/
COPY apps/dashboard/ apps/dashboard/

# Build shared packages first
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/ui

# Build the Next.js app in standalone mode
# next.config.js must include: output: 'standalone'
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/dashboard && npx next build

# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3010/ || exit 1

EXPOSE 3010

CMD ["node", "apps/dashboard/server.js"]
