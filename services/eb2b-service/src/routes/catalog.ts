import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  HTTP_STATUS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPagination,
} from '@opensalesai/shared';

const ListCatalogQuerySchema = z.object({
  query: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  isFocus: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const catalogRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /catalog
   * Browse product catalog with search, filters, and pagination.
   */
  fastify.get('/catalog', {
    schema: {
      description: 'Browse product catalog',
      tags: ['Catalog'],
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search by product name or SKU' },
          category: { type: 'string' },
          brand: { type: 'string' },
          isFocus: { type: 'boolean' },
          minPrice: { type: 'number', minimum: 0 },
          maxPrice: { type: 'number', minimum: 0 },
          page: { type: 'integer', minimum: 1, default: DEFAULT_PAGE },
          limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
        },
      },
    },
  }, async (request, reply) => {
    const params = ListCatalogQuerySchema.parse(request.query);
    const companyId = request.user.company_id;

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };

    // Text search across name, skuCode
    if (params.query) {
      where['OR'] = [
        { name: { contains: params.query, mode: 'insensitive' } },
        { skuCode: { contains: params.query, mode: 'insensitive' } },
        { category: { contains: params.query, mode: 'insensitive' } },
      ];
    }

    if (params.category) {
      where['category'] = params.category;
    }

    if (params.isFocus !== undefined) {
      where['isFocus'] = params.isFocus;
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where['mrp'] = {
        ...(params.minPrice !== undefined && { gte: params.minPrice }),
        ...(params.maxPrice !== undefined && { lte: params.maxPrice }),
      };
    }

    const [products, total] = await Promise.all([
      fastify.prisma.product.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: [
          { isFocus: 'desc' },
          { name: 'asc' },
        ],
        select: {
          id: true,
          skuCode: true,
          name: true,
          category: true,
          subCategory: true,
          mrp: true,
          distributorPrice: true,
          marginPct: true,
          packSize: true,
          shelfLifeDays: true,
          isFocus: true,
          launchDate: true,
          createdAt: true,
        },
      }),
      fastify.prisma.product.count({ where }),
    ]);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: products,
      pagination: buildPagination(total, params.page, params.limit),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /catalog/:id
   * Get a single product detail by ID.
   */
  fastify.get('/catalog/:id', {
    schema: {
      description: 'Get product detail',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user.company_id;

    const product = await fastify.prisma.product.findFirst({
      where: { id, companyId, deletedAt: null },
    });

    if (!product) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: product,
      timestamp: new Date().toISOString(),
    });
  });
};

export default catalogRoutes;
