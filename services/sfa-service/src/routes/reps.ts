import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  HTTP_STATUS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPagination,
  formatINR,
} from '@opensalesai/shared';

const ListRepsQuerySchema = z.object({
  territory: z.string().max(100).optional(),
  skillTier: z.enum(['A', 'B', 'C']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const repRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /reps
   * List sales reps with filters.
   */
  fastify.get('/reps', {
    schema: {
      description: 'List sales reps',
      tags: ['Reps'],
      querystring: {
        type: 'object',
        properties: {
          territory: { type: 'string' },
          skillTier: { type: 'string', enum: ['A', 'B', 'C'] },
          isActive: { type: 'boolean' },
          search: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: DEFAULT_PAGE },
          limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
        },
      },
    },
  }, async (request, reply) => {
    const query = ListRepsQuerySchema.parse(request.query);
    const companyId = request.user.company_id;

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };

    if (query.territory) where['territory'] = query.territory;
    if (query.skillTier) where['skillTier'] = query.skillTier;
    if (query.isActive !== undefined) where['isActive'] = query.isActive;
    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [reps, total] = await Promise.all([
      fastify.prisma.rep.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          territory: true,
          dailyTarget: true,
          monthlyQuota: true,
          pointsBalance: true,
          skillTier: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      fastify.prisma.rep.count({ where }),
    ]);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: reps,
      pagination: buildPagination(total, query.page, query.limit),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /reps/:id
   * Get rep detail.
   */
  fastify.get('/reps/:id', {
    schema: {
      description: 'Get rep detail by ID',
      tags: ['Reps'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user.company_id;

    const rep = await fastify.prisma.rep.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        assignedStores: {
          where: { deletedAt: null },
          select: { id: true, name: true, channelType: true },
          take: 50,
        },
      },
    });

    if (!rep) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'REP_NOT_FOUND', message: `Rep ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: rep,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /reps/:id/dashboard
   * Get comprehensive KPIs for a sales rep.
   */
  fastify.get('/reps/:id/dashboard', {
    schema: {
      description: 'Get rep dashboard KPIs',
      tags: ['Reps'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user.company_id;

    // Verify rep exists
    const rep = await fastify.prisma.rep.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        pointsBalance: true,
        dailyTarget: true,
        monthlyQuota: true,
        territory: true,
      },
    });

    if (!rep) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'REP_NOT_FOUND', message: `Rep ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Run all queries in parallel
    const [
      tasksCompleted,
      tasksPending,
      tasksTotal,
      ordersTodayCount,
      ordersMonthCount,
      revenueTodayAgg,
      revenueMonthAgg,
      visitsToday,
      storesAssigned,
      visitDurationAgg,
    ] = await Promise.all([
      // Tasks completed today
      fastify.prisma.task.count({
        where: {
          repId: id,
          companyId,
          status: 'COMPLETED',
          taskDate: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
      }),
      // Tasks pending today
      fastify.prisma.task.count({
        where: {
          repId: id,
          companyId,
          status: 'PENDING',
          taskDate: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
      }),
      // Total tasks today
      fastify.prisma.task.count({
        where: {
          repId: id,
          companyId,
          taskDate: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
      }),
      // Orders placed today
      fastify.prisma.transaction.count({
        where: {
          repId: id,
          companyId,
          transactionDate: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
      }),
      // Orders placed this month
      fastify.prisma.transaction.count({
        where: {
          repId: id,
          companyId,
          transactionDate: { gte: monthStart },
          deletedAt: null,
        },
      }),
      // Revenue today
      fastify.prisma.transaction.aggregate({
        where: {
          repId: id,
          companyId,
          transactionDate: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
        _sum: { totalValue: true },
      }),
      // Revenue this month
      fastify.prisma.transaction.aggregate({
        where: {
          repId: id,
          companyId,
          transactionDate: { gte: monthStart },
          deletedAt: null,
        },
        _sum: { totalValue: true },
      }),
      // Stores visited today (distinct)
      fastify.prisma.visit.findMany({
        where: {
          repId: id,
          companyId,
          checkInTime: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
        select: { storeId: true },
        distinct: ['storeId'],
      }),
      // Total stores assigned to this rep
      fastify.prisma.store.count({
        where: {
          assignedRepId: id,
          companyId,
          deletedAt: null,
        },
      }),
      // Average visit duration today
      fastify.prisma.visit.aggregate({
        where: {
          repId: id,
          companyId,
          checkOutTime: { not: null },
          checkInTime: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
        _avg: { durationMinutes: true },
      }),
    ]);

    const storesVisitedCount = visitsToday.length;
    const coverageRate = storesAssigned > 0
      ? Math.round((storesVisitedCount / storesAssigned) * 10000) / 100
      : 0;

    const taskCompletionRate = tasksTotal > 0
      ? Math.round((tasksCompleted / tasksTotal) * 10000) / 100
      : 0;

    const revenueToday = Number(revenueTodayAgg._sum.totalValue || 0);
    const revenueMonth = Number(revenueMonthAgg._sum.totalValue || 0);

    const dashboard = {
      repId: rep.id,
      repName: rep.name,
      territory: rep.territory,
      tasksCompleted,
      tasksPending,
      tasksTotal,
      taskCompletionRate,
      dailyTarget: rep.dailyTarget,
      ordersPlacedToday: ordersTodayCount,
      ordersPlacedMonth: ordersMonthCount,
      revenueToday,
      revenueTodayFormatted: formatINR(revenueToday),
      revenueMonth,
      revenueMonthFormatted: formatINR(revenueMonth),
      monthlyQuota: Number(rep.monthlyQuota),
      quotaAchievementRate: Number(rep.monthlyQuota) > 0
        ? Math.round((revenueMonth / Number(rep.monthlyQuota)) * 10000) / 100
        : 0,
      pointsBalance: rep.pointsBalance,
      storesVisitedToday: storesVisitedCount,
      storesAssigned,
      coverageRate,
      avgVisitDurationMinutes: Math.round(visitDurationAgg._avg.durationMinutes || 0),
    };

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString(),
    });
  });
};

export default repRoutes;
