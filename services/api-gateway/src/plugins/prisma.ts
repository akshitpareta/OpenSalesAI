import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

  prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
    fastify.log.debug({
      query: e.query,
      params: e.params,
      duration: e.duration,
    }, 'Prisma query executed');
  });

  await prisma.$connect();
  fastify.log.info('Prisma client connected to database');

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    fastify.log.info('Disconnecting Prisma client');
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin, {
  name: 'prisma',
});
