import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  HTTP_STATUS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_VISIT_MINUTES,
  buildPagination,
} from '@opensalesai/shared';
import { validateProximity, isValidCoordinates } from '../services/gps-validator.js';

const CreateVisitSchema = z.object({
  storeId: z.string().uuid('storeId must be a valid UUID'),
  repId: z.string().uuid('repId must be a valid UUID'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const CheckoutVisitSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().max(2000).optional(),
  photos: z.array(z.string().url()).max(10).optional(),
});

const ListVisitsQuerySchema = z.object({
  repId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const visitRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /visits
   * Check in to a store visit. Validates GPS proximity (must be within 100m of store).
   */
  fastify.post('/visits', {
    schema: {
      description: 'Check in to a store visit',
      tags: ['Visits'],
      body: {
        type: 'object',
        required: ['storeId', 'repId', 'lat', 'lng'],
        properties: {
          storeId: { type: 'string', format: 'uuid' },
          repId: { type: 'string', format: 'uuid' },
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
      },
    },
  }, async (request, reply) => {
    const body = CreateVisitSchema.parse(request.body);
    const companyId = request.user.company_id;

    if (!isValidCoordinates(body.lat, body.lng)) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Latitude must be between -90 and 90, longitude between -180 and 180',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Verify store exists and belongs to this company
    const store = await fastify.prisma.store.findFirst({
      where: { id: body.storeId, companyId, deletedAt: null },
      select: { id: true, name: true, lat: true, lng: true },
    });

    if (!store) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'STORE_NOT_FOUND', message: `Store ${body.storeId} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    // Verify rep exists
    const rep = await fastify.prisma.rep.findFirst({
      where: { id: body.repId, companyId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!rep) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'REP_NOT_FOUND', message: `Rep ${body.repId} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    // Validate GPS proximity to store (must be within 100 meters)
    const storeLat = Number(store.lat);
    const storeLng = Number(store.lng);
    const proximity = validateProximity(body.lat, body.lng, storeLat, storeLng);

    if (!proximity.valid) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'TOO_FAR_FROM_STORE',
          message: `You are ${proximity.distance_meters}m from the store. Must be within ${proximity.max_distance_meters}m to check in.`,
          details: {
            distance_meters: proximity.distance_meters,
            max_distance_meters: proximity.max_distance_meters,
            store_lat: storeLat,
            store_lng: storeLng,
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Check if there's already an active (not checked-out) visit for this rep
    const activeVisit = await fastify.prisma.visit.findFirst({
      where: {
        repId: body.repId,
        companyId,
        checkOutTime: null,
        deletedAt: null,
      },
      select: { id: true, storeId: true },
    });

    if (activeVisit) {
      return reply.status(HTTP_STATUS.CONFLICT).send({
        success: false,
        error: {
          code: 'ACTIVE_VISIT_EXISTS',
          message: 'Rep already has an active visit. Please check out first.',
          details: { active_visit_id: activeVisit.id, active_store_id: activeVisit.storeId },
        },
        timestamp: new Date().toISOString(),
      });
    }

    const now = new Date();

    const visit = await fastify.prisma.visit.create({
      data: {
        companyId,
        repId: body.repId,
        storeId: body.storeId,
        checkInTime: now,
        checkInLat: body.lat,
        checkInLng: body.lng,
        photos: [],
      },
      include: {
        storeRef: { select: { id: true, name: true } },
        rep: { select: { id: true, name: true } },
      },
    });

    // Update store's last visit date
    await fastify.prisma.store.update({
      where: { id: body.storeId },
      data: { lastVisitDate: now },
    });

    return reply.status(HTTP_STATUS.CREATED).send({
      success: true,
      data: visit,
      message: `Checked in to ${store.name} (${proximity.distance_meters}m from store)`,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * PUT /visits/:id/checkout
   * Check out from a store visit. Validates minimum 5-minute visit duration.
   */
  fastify.put('/visits/:id/checkout', {
    schema: {
      description: 'Check out from a store visit',
      tags: ['Visits'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          notes: { type: 'string' },
          photos: { type: 'array', items: { type: 'string', format: 'uri' } },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = CheckoutVisitSchema.parse(request.body);
    const companyId = request.user.company_id;

    const visit = await fastify.prisma.visit.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!visit) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'VISIT_NOT_FOUND', message: `Visit ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    if (visit.checkOutTime) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'ALREADY_CHECKED_OUT',
          message: 'This visit has already been checked out',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const now = new Date();
    const durationMinutes = (now.getTime() - visit.checkInTime.getTime()) / (1000 * 60);

    // Validate minimum visit duration (5 minutes)
    if (durationMinutes < MIN_VISIT_MINUTES) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'VISIT_TOO_SHORT',
          message: `Visit duration must be at least ${MIN_VISIT_MINUTES} minutes. Current: ${durationMinutes.toFixed(1)} minutes.`,
          details: {
            minimum_minutes: MIN_VISIT_MINUTES,
            current_minutes: Math.round(durationMinutes * 10) / 10,
            checkInTime: visit.checkInTime.toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

    const existingPhotos = Array.isArray(visit.photos) ? (visit.photos as string[]) : [];
    const mergedPhotos = [...existingPhotos, ...(body.photos || [])];

    const updated = await fastify.prisma.visit.update({
      where: { id },
      data: {
        checkOutTime: now,
        checkOutLat: body.lat,
        checkOutLng: body.lng,
        durationMinutes: Math.round(durationMinutes),
        notes: body.notes || null,
        photos: mergedPhotos,
      },
      include: {
        storeRef: { select: { id: true, name: true } },
        rep: { select: { id: true, name: true } },
      },
    });

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: updated,
      message: `Checked out after ${Math.round(durationMinutes)} minutes`,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /visits
   * List visits with filters.
   */
  fastify.get('/visits', {
    schema: {
      description: 'List visits',
      tags: ['Visits'],
      querystring: {
        type: 'object',
        properties: {
          repId: { type: 'string', format: 'uuid' },
          storeId: { type: 'string', format: 'uuid' },
          dateFrom: { type: 'string', format: 'date-time' },
          dateTo: { type: 'string', format: 'date-time' },
          page: { type: 'integer', minimum: 1, default: DEFAULT_PAGE },
          limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
        },
      },
    },
  }, async (request, reply) => {
    const query = ListVisitsQuerySchema.parse(request.query);
    const companyId = request.user.company_id;

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };

    if (query.repId) where['repId'] = query.repId;
    if (query.storeId) where['storeId'] = query.storeId;
    if (query.dateFrom || query.dateTo) {
      where['checkInTime'] = {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      };
    }

    const [visits, total] = await Promise.all([
      fastify.prisma.visit.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { checkInTime: 'desc' },
        include: {
          storeRef: { select: { id: true, name: true } },
          rep: { select: { id: true, name: true } },
        },
      }),
      fastify.prisma.visit.count({ where }),
    ]);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: visits,
      pagination: buildPagination(total, query.page, query.limit),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /visits/:id
   */
  fastify.get('/visits/:id', {
    schema: {
      description: 'Get visit by ID',
      tags: ['Visits'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user.company_id;

    const visit = await fastify.prisma.visit.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        storeRef: { select: { id: true, name: true, address: true } },
        rep: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!visit) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'VISIT_NOT_FOUND', message: `Visit ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: visit,
      timestamp: new Date().toISOString(),
    });
  });
};

export default visitRoutes;
