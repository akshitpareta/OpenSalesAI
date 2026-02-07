import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  HTTP_STATUS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPagination,
} from '@opensalesai/shared';

/**
 * Beat plans are stored in-memory for now since the Prisma schema does not
 * include a beats table. In production, beats would be a first-class entity
 * in the database. For this implementation, we store beat plans as JSON
 * inside a Redis cache or a simple in-memory map keyed by company_id.
 *
 * Structure: Map<company_id, Map<beat_id, Beat>>
 */

interface BeatPlan {
  id: string;
  companyId: string;
  repId: string;
  name: string;
  dayOfWeek: number;
  storeIds: string[];
  sequence: number[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const beatStore = new Map<string, Map<string, BeatPlan>>();

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getCompanyBeats(companyId: string): Map<string, BeatPlan> {
  if (!beatStore.has(companyId)) {
    beatStore.set(companyId, new Map());
  }
  return beatStore.get(companyId)!;
}

const CreateBeatSchema = z.object({
  repId: z.string().uuid('repId must be a valid UUID'),
  name: z.string().min(1, 'Beat name is required').max(200),
  dayOfWeek: z
    .number()
    .int()
    .min(0, 'dayOfWeek must be 0 (Sunday) to 6 (Saturday)')
    .max(6, 'dayOfWeek must be 0 (Sunday) to 6 (Saturday)'),
  storeIds: z
    .array(z.string().uuid())
    .min(1, 'At least one store is required')
    .max(50, 'Maximum 50 stores per beat'),
  sequence: z
    .array(z.number().int().min(0))
    .min(1, 'Sequence is required'),
});

const UpdateBeatSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  storeIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  sequence: z.array(z.number().int().min(0)).optional(),
  isActive: z.boolean().optional(),
});

const ListBeatsQuerySchema = z.object({
  repId: z.string().uuid().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const beatRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /beats
   * List beat plans with optional filters.
   */
  fastify.get('/beats', {
    schema: {
      description: 'List beat plans',
      tags: ['Beats'],
      querystring: {
        type: 'object',
        properties: {
          repId: { type: 'string', format: 'uuid' },
          dayOfWeek: { type: 'integer', minimum: 0, maximum: 6 },
          isActive: { type: 'boolean' },
          page: { type: 'integer', minimum: 1, default: DEFAULT_PAGE },
          limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
        },
      },
    },
  }, async (request, reply) => {
    const query = ListBeatsQuerySchema.parse(request.query);
    const companyId = request.user.company_id;
    const beats = getCompanyBeats(companyId);

    let filtered = Array.from(beats.values()).filter((b) => !b.deletedAt);

    if (query.repId) {
      filtered = filtered.filter((b) => b.repId === query.repId);
    }
    if (query.dayOfWeek !== undefined) {
      filtered = filtered.filter((b) => b.dayOfWeek === query.dayOfWeek);
    }
    if (query.isActive !== undefined) {
      filtered = filtered.filter((b) => b.isActive === query.isActive);
    }

    filtered.sort((a, b) => a.dayOfWeek - b.dayOfWeek || b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const start = (query.page - 1) * query.limit;
    const paged = filtered.slice(start, start + query.limit);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: paged,
      pagination: buildPagination(total, query.page, query.limit),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /beats/:id
   */
  fastify.get('/beats/:id', {
    schema: {
      description: 'Get beat plan by ID',
      tags: ['Beats'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user.company_id;
    const beats = getCompanyBeats(companyId);
    const beat = beats.get(id);

    if (!beat || beat.deletedAt) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'BEAT_NOT_FOUND', message: `Beat plan ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: beat,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /beats
   * Create a new beat plan.
   */
  fastify.post('/beats', {
    schema: {
      description: 'Create a new beat plan',
      tags: ['Beats'],
    },
  }, async (request, reply) => {
    const body = CreateBeatSchema.parse(request.body);
    const companyId = request.user.company_id;

    if (body.storeIds.length !== body.sequence.length) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'storeIds and sequence arrays must have the same length',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Verify rep exists
    const rep = await fastify.prisma.rep.findFirst({
      where: { id: body.repId, companyId, deletedAt: null },
    });

    if (!rep) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'REP_NOT_FOUND', message: `Rep ${body.repId} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    // Verify all stores exist
    const stores = await fastify.prisma.store.findMany({
      where: { id: { in: body.storeIds }, companyId, deletedAt: null },
      select: { id: true },
    });

    const foundIds = new Set(stores.map((s: { id: string }) => s.id));
    const missingIds = body.storeIds.filter((sid) => !foundIds.has(sid));

    if (missingIds.length > 0) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: {
          code: 'STORES_NOT_FOUND',
          message: `Stores not found: ${missingIds.join(', ')}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Check for duplicate beat on same day
    const beats = getCompanyBeats(companyId);
    const existing = Array.from(beats.values()).find(
      (b) => b.repId === body.repId && b.dayOfWeek === body.dayOfWeek && b.isActive && !b.deletedAt,
    );

    if (existing) {
      return reply.status(HTTP_STATUS.CONFLICT).send({
        success: false,
        error: {
          code: 'BEAT_EXISTS',
          message: `Rep already has an active beat plan for day ${body.dayOfWeek}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const now = new Date();
    const beat: BeatPlan = {
      id: generateUUID(),
      companyId,
      repId: body.repId,
      name: body.name,
      dayOfWeek: body.dayOfWeek,
      storeIds: body.storeIds,
      sequence: body.sequence,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    beats.set(beat.id, beat);

    return reply.status(HTTP_STATUS.CREATED).send({
      success: true,
      data: beat,
      message: 'Beat plan created successfully',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * PUT /beats/:id
   */
  fastify.put('/beats/:id', {
    schema: {
      description: 'Update a beat plan',
      tags: ['Beats'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateBeatSchema.parse(request.body);
    const companyId = request.user.company_id;
    const beats = getCompanyBeats(companyId);
    const beat = beats.get(id);

    if (!beat || beat.deletedAt) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'BEAT_NOT_FOUND', message: `Beat plan ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    if (body.storeIds) {
      const stores = await fastify.prisma.store.findMany({
        where: { id: { in: body.storeIds }, companyId, deletedAt: null },
        select: { id: true },
      });
      const foundIds = new Set(stores.map((s: { id: string }) => s.id));
      const missingIds = body.storeIds.filter((sid) => !foundIds.has(sid));
      if (missingIds.length > 0) {
        return reply.status(HTTP_STATUS.NOT_FOUND).send({
          success: false,
          error: { code: 'STORES_NOT_FOUND', message: `Stores not found: ${missingIds.join(', ')}` },
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (body.name !== undefined) beat.name = body.name;
    if (body.dayOfWeek !== undefined) beat.dayOfWeek = body.dayOfWeek;
    if (body.storeIds !== undefined) beat.storeIds = body.storeIds;
    if (body.sequence !== undefined) beat.sequence = body.sequence;
    if (body.isActive !== undefined) beat.isActive = body.isActive;
    beat.updatedAt = new Date();

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: beat,
      message: 'Beat plan updated successfully',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * DELETE /beats/:id — Soft delete
   */
  fastify.delete('/beats/:id', {
    schema: {
      description: 'Soft delete a beat plan',
      tags: ['Beats'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user.company_id;
    const beats = getCompanyBeats(companyId);
    const beat = beats.get(id);

    if (!beat || beat.deletedAt) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'BEAT_NOT_FOUND', message: `Beat plan ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    beat.deletedAt = new Date();
    beat.isActive = false;
    beat.updatedAt = new Date();

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: { id },
      message: 'Beat plan deleted successfully',
      timestamp: new Date().toISOString(),
    });
  });
};

export default beatRoutes;
