import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import notifyRoutes from './routes/notify.js';
import { SERVICE_PORTS, RATE_LIMIT, HTTP_STATUS } from '@opensalesai/shared';

const PORT = parseInt(process.env['PORT'] || String(SERVICE_PORTS.NOTIFICATION_SERVICE), 10);
const HOST = process.env['HOST'] || '0.0.0.0';
const NODE_ENV = process.env['NODE_ENV'] || 'development';

// ---- Auth types ----
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      user_id: string;
      email: string;
      username: string;
      tenant_id: string;
      company_id: string;
      roles: string[];
    };
  }
}

// ---- Auth Middleware (service-to-service) ----
async function authMiddleware(
  request: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Internal service-to-service auth
    const internalKey = request.headers['x-internal-key'] as string | undefined;
    const expectedKey = process.env['INTERNAL_SERVICE_KEY'];

    if (internalKey && expectedKey && internalKey === expectedKey) {
      request.user = {
        user_id: (request.headers['x-user-id'] as string) || 'system',
        email: (request.headers['x-user-email'] as string) || 'system@opensalesai.local',
        username: 'system',
        tenant_id: (request.headers['x-tenant-id'] as string) || 'default',
        company_id: (request.headers['x-company-id'] as string) || 'default',
        roles: ['service'],
      };
      return;
    }

    return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      error: { code: 'MISSING_AUTH', message: 'Authorization required' },
      timestamp: new Date().toISOString(),
    });
  }

  const token = authHeader.slice(7);

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) throw new Error('Invalid token format');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));

    request.user = {
      user_id: payload.sub || '',
      email: payload.email || '',
      username: payload.preferred_username || '',
      tenant_id: payload.tenant_id || 'default',
      company_id: payload.company_id || payload.tenant_id || 'default',
      roles: payload.realm_access?.roles || [],
    };
  } catch {
    return reply.status(HTTP_STATUS.UNAUTHORIZED).send({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' },
      timestamp: new Date().toISOString(),
    });
  }
}

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] || 'info',
      transport:
        NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    genReqId: () => {
      const ts = Date.now().toString(36);
      const rand = Math.random().toString(36).slice(2, 10);
      return `notify-${ts}-${rand}`;
    },
  });

  // CORS
  await fastify.register(cors, { origin: true, credentials: true });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: RATE_LIMIT.AUTH_MAX,
    timeWindow: RATE_LIMIT.AUTH_WINDOW_MS,
  });

  // Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'OpenSalesAI Notification Service',
        description: 'WhatsApp, SMS, and Push notification delivery',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await fastify.register(swaggerUi, { routePrefix: '/docs' });

  // Health check (public)
  fastify.get('/health', async () => ({
    status: 'ok',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: process.uptime(),
    channels: {
      whatsapp: !!process.env['WHATSAPP_ACCESS_TOKEN'],
      sms: !!process.env['SMS_PROVIDER'] && process.env['SMS_PROVIDER'] !== 'mock',
      push: !!process.env['FCM_SERVER_KEY'],
    },
  }));

  // Auth middleware
  fastify.addHook('preHandler', async (request, reply) => {
    if (
      request.url === '/health' ||
      request.url.startsWith('/docs') ||
      request.url === '/ready'
    ) {
      return;
    }
    await authMiddleware(request, reply);
  });

  // Register routes
  await fastify.register(notifyRoutes);

  // Global error handler
  fastify.setErrorHandler(async (error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Request error');

    if (error.name === 'ZodError') {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: JSON.parse(error.message),
        },
        timestamp: new Date().toISOString(),
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'Internal server error' : error.message,
      },
      timestamp: new Date().toISOString(),
    });
  });

  fastify.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return fastify;
}

async function main() {
  const server = await buildServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info({ port: PORT, env: NODE_ENV }, 'Notification Service started');
  } catch (err) {
    server.log.fatal(err, 'Failed to start Notification Service');
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, 'Shutting down Notification Service');
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();

export { buildServer };
