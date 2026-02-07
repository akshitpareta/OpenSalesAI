import { FastifyInstance, FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /health
   * Health check endpoint — no authentication required.
   * Returns service status, uptime, and database connectivity.
   */
  fastify.get('/health', {
    schema: {
      description: 'Service health check',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded', 'error'] },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            uptime: { type: 'number' },
            services: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'error'] },
                    latency_ms: { type: 'number' },
                  },
                },
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'error'] },
                    latency_ms: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    const services: Record<string, { status: 'ok' | 'error'; latency_ms?: number }> = {};

    // Check database connectivity
    const dbStart = Date.now();
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      services['database'] = {
        status: 'ok',
        latency_ms: Date.now() - dbStart,
      };
    } catch {
      services['database'] = {
        status: 'error',
        latency_ms: Date.now() - dbStart,
      };
    }

    const allHealthy = Object.values(services).every((s) => s.status === 'ok');
    const anyHealthy = Object.values(services).some((s) => s.status === 'ok');

    let status: 'ok' | 'degraded' | 'error';
    if (allHealthy) {
      status = 'ok';
    } else if (anyHealthy) {
      status = 'degraded';
    } else {
      status = 'error';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env['APP_VERSION'] || '0.1.0',
      uptime: process.uptime(),
      services,
    };
  });

  /**
   * GET /ready
   * Readiness check — returns 200 only when the service is fully ready to serve traffic.
   */
  fastify.get('/ready', {
    schema: {
      description: 'Service readiness check',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            timestamp: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      return {
        ready: true,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return reply.status(503).send({
        ready: false,
        timestamp: new Date().toISOString(),
        reason: 'Database not reachable',
      });
    }
  });
};

export default healthRoutes;
