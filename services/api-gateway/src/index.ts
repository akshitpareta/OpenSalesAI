import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import healthRoutes from './routes/health.js';
import { SERVICE_PORTS, RATE_LIMIT } from '@opensalesai/shared';

const PORT = parseInt(process.env['PORT'] || String(SERVICE_PORTS.API_GATEWAY), 10);
const HOST = process.env['HOST'] || '0.0.0.0';
const NODE_ENV = process.env['NODE_ENV'] || 'development';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] || 'info',
      transport:
        NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    requestId: true,
    genReqId: () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).slice(2, 10);
      return `${timestamp}-${random}`;
    },
  });

  // ------- Global Plugins -------

  // CORS
  await fastify.register(cors, {
    origin: process.env['CORS_ORIGINS']?.split(',') || ['http://localhost:3000', 'http://localhost:3100'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Tenant-Id'],
    exposedHeaders: ['X-Correlation-Id', 'X-Request-Id'],
  });

  // Rate Limiting
  await fastify.register(rateLimit, {
    max: RATE_LIMIT.AUTH_MAX,
    timeWindow: RATE_LIMIT.AUTH_WINDOW_MS,
    keyGenerator: (request) => {
      // Rate limit by user_id if authenticated, otherwise by IP
      return (request as Record<string, unknown>).user
        ? ((request as Record<string, unknown>).user as { user_id: string }).user_id
        : request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Max ${context.max} requests per ${context.after}`,
      },
      timestamp: new Date().toISOString(),
    }),
  });

  // Swagger API Documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'OpenSalesAI API Gateway',
        description: 'AI-powered Route-to-Market intelligence platform for CPG/FMCG',
        version: '0.1.0',
      },
      servers: [
        { url: `http://localhost:${PORT}`, description: 'Local development' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // ------- Service Plugins -------

  // Prisma (database)
  await fastify.register(prismaPlugin);

  // JWKS Auth (Keycloak)
  await fastify.register(authPlugin);

  // ------- Routes -------

  // Public routes (no auth required)
  await fastify.register(healthRoutes);

  // ------- Global Hooks -------

  // Add correlation ID to all responses
  fastify.addHook('onRequest', async (request, reply) => {
    const correlationId =
      (request.headers['x-correlation-id'] as string) || request.id;
    reply.header('X-Correlation-Id', correlationId);
    reply.header('X-Request-Id', request.id);
  });

  // Structured error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    request.log.error(
      {
        err: error,
        url: request.url,
        method: request.method,
        statusCode: error.statusCode,
      },
      'Request error',
    );

    const statusCode = error.statusCode || 500;

    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message:
          statusCode === 500
            ? 'An internal server error occurred'
            : error.message,
        ...(NODE_ENV === 'development' && { stack: error.stack }),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
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
    server.log.info(
      { port: PORT, env: NODE_ENV },
      'OpenSalesAI API Gateway started',
    );
  } catch (err) {
    server.log.fatal(err, 'Failed to start API Gateway');
    process.exit(1);
  }

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    server.log.info({ signal }, 'Received shutdown signal');
    try {
      await server.close();
      server.log.info('Server closed gracefully');
      process.exit(0);
    } catch (err) {
      server.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main();

export { buildServer };
