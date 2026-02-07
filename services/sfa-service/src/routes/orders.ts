import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  HTTP_STATUS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPagination,
} from '@opensalesai/shared';

const CreateOrderItemSchema = z.object({
  productId: z.string().uuid('productId must be a valid UUID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

const CreateOrderSchema = z.object({
  storeId: z.string().uuid('storeId must be a valid UUID'),
  repId: z.string().uuid('repId must be a valid UUID'),
  source: z.enum(['MANUAL', 'EB2B', 'WHATSAPP', 'VOICE']).default('MANUAL'),
  distributorId: z.string().max(100).optional(),
  items: z
    .array(CreateOrderItemSchema)
    .min(1, 'At least one item is required')
    .max(50, 'Maximum 50 items per order'),
});

const ListOrdersQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  repId: z.string().uuid().optional(),
  source: z.enum(['MANUAL', 'EB2B', 'WHATSAPP', 'VOICE']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const orderRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /orders
   * Create a new transaction (order) with line items.
   * Uses the Transaction and TransactionItem models from the Prisma schema.
   */
  fastify.post('/orders', {
    schema: {
      description: 'Create a new order with line items',
      tags: ['Orders'],
      body: {
        type: 'object',
        required: ['storeId', 'repId', 'items'],
        properties: {
          storeId: { type: 'string', format: 'uuid' },
          repId: { type: 'string', format: 'uuid' },
          source: { type: 'string' },
          distributorId: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string', format: 'uuid' },
                quantity: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = CreateOrderSchema.parse(request.body);
    const companyId = request.user.company_id;

    // Verify store exists
    const store = await fastify.prisma.store.findFirst({
      where: { id: body.storeId, companyId, deletedAt: null },
      select: { id: true, name: true },
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

    // Fetch all products for the order items
    const productIds = body.items.map((item) => item.productId);
    const products = await fastify.prisma.product.findMany({
      where: {
        id: { in: productIds },
        companyId,
        deletedAt: null,
      },
    });

    type ProductRecord = typeof products[number];
    const productMap = new Map<string, ProductRecord>();
    for (const p of products) {
      productMap.set(p.id, p);
    }

    // Validate all products exist
    const missingProducts = productIds.filter((pid) => !productMap.has(pid));
    if (missingProducts.length > 0) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: {
          code: 'PRODUCTS_NOT_FOUND',
          message: `Products not found: ${missingProducts.join(', ')}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate line items with pricing
    const transactionItems = body.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = Number(product.distributorPrice);
      const lineTotal = unitPrice * item.quantity;

      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        lineTotal: Math.round(lineTotal * 100) / 100,
      };
    });

    const totalValue = transactionItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const now = new Date();

    // Create transaction with items in a single Prisma transaction
    const transaction = await fastify.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.transaction.create({
        data: {
          companyId,
          storeId: body.storeId,
          repId: body.repId,
          totalValue: Math.round(totalValue * 100) / 100,
          orderSource: body.source,
          distributorId: body.distributorId || null,
          transactionDate: now,
        },
      });

      // Create transaction items
      await tx.transactionItem.createMany({
        data: transactionItems.map((item) => ({
          transactionId: created.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      });

      return created;
    });

    // Fetch complete order with items
    const completeOrder = await fastify.prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, skuCode: true, category: true } },
          },
        },
        storeRef: { select: { id: true, name: true } },
        rep: { select: { id: true, name: true } },
      },
    });

    return reply.status(HTTP_STATUS.CREATED).send({
      success: true,
      data: completeOrder,
      message: 'Order created successfully',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /orders
   * List orders (transactions) with filters.
   */
  fastify.get('/orders', {
    schema: {
      description: 'List orders with filters',
      tags: ['Orders'],
    },
  }, async (request, reply) => {
    const query = ListOrdersQuerySchema.parse(request.query);
    const companyId = request.user.company_id;

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };

    if (query.storeId) where['storeId'] = query.storeId;
    if (query.repId) where['repId'] = query.repId;
    if (query.source) where['orderSource'] = query.source;
    if (query.dateFrom || query.dateTo) {
      where['transactionDate'] = {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      };
    }

    const [orders, total] = await Promise.all([
      fastify.prisma.transaction.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, skuCode: true } },
            },
          },
          storeRef: { select: { id: true, name: true } },
          rep: { select: { id: true, name: true } },
        },
      }),
      fastify.prisma.transaction.count({ where }),
    ]);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: orders,
      pagination: buildPagination(total, query.page, query.limit),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /orders/:id
   * Get a single order (transaction) with items.
   */
  fastify.get('/orders/:id', {
    schema: {
      description: 'Get order by ID with items',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user.company_id;

    const order = await fastify.prisma.transaction.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, skuCode: true, category: true, mrp: true },
            },
          },
        },
        storeRef: { select: { id: true, name: true, address: true, ownerPhone: true } },
        rep: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!order) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: `Order ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: order,
      timestamp: new Date().toISOString(),
    });
  });
};

export default orderRoutes;
