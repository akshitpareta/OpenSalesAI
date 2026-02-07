import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  HTTP_STATUS,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPagination,
} from '@opensalesai/shared';
import { getCart, cartKey, cartStore } from './cart.js';

const CreateOrderFromCartSchema = z.object({
  storeId: z.string().uuid('storeId must be a valid UUID'),
  channel: z.enum(['WHATSAPP', 'PWA', 'APP', 'VOICE']).default('PWA'),
});

const ListOrdersQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED']).optional(),
  channel: z.enum(['WHATSAPP', 'PWA', 'APP', 'VOICE']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const eb2bOrderRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /orders
   * Create an eB2B order from the current cart contents.
   * Uses the OrderEb2b model with items stored as JSON.
   */
  fastify.post('/orders', {
    schema: {
      description: 'Create order from cart',
      tags: ['eB2B Orders'],
    },
  }, async (request, reply) => {
    const body = CreateOrderFromCartSchema.parse(request.body);
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

    // Fetch cart items
    const cartItems = getCart(companyId, body.storeId);

    if (cartItems.length === 0) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send({
        success: false,
        error: { code: 'EMPTY_CART', message: 'Cart is empty. Add items before placing an order.' },
        timestamp: new Date().toISOString(),
      });
    }

    // Build items JSON for the OrderEb2b.items field
    const orderItemsJson = cartItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      skuCode: item.skuCode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    const totalValue = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // Create the eB2B order
    const order = await fastify.prisma.orderEb2b.create({
      data: {
        companyId,
        storeId: body.storeId,
        items: orderItemsJson,
        totalValue: Math.round(totalValue * 100) / 100,
        status: 'PENDING',
        channel: body.channel,
      },
      include: {
        store: { select: { id: true, name: true } },
      },
    });

    // Clear the cart
    const key = cartKey(companyId, body.storeId);
    cartStore.set(key, []);

    return reply.status(HTTP_STATUS.CREATED).send({
      success: true,
      data: order,
      message: 'Order placed successfully',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /orders
   * List eB2B orders with filters.
   */
  fastify.get('/orders', {
    schema: {
      description: 'List eB2B orders',
      tags: ['eB2B Orders'],
    },
  }, async (request, reply) => {
    const query = ListOrdersQuerySchema.parse(request.query);
    const companyId = request.user.company_id;

    const where: Record<string, unknown> = {
      companyId,
      deletedAt: null,
    };

    if (query.storeId) where['storeId'] = query.storeId;
    if (query.status) where['status'] = query.status;
    if (query.channel) where['channel'] = query.channel;
    if (query.dateFrom || query.dateTo) {
      where['createdAt'] = {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      };
    }

    const [orders, total] = await Promise.all([
      fastify.prisma.orderEb2b.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          store: { select: { id: true, name: true } },
        },
      }),
      fastify.prisma.orderEb2b.count({ where }),
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
   * Get eB2B order detail with status timeline.
   */
  fastify.get('/orders/:id', {
    schema: {
      description: 'Get eB2B order detail',
      tags: ['eB2B Orders'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const companyId = request.user.company_id;

    const order = await fastify.prisma.orderEb2b.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        store: { select: { id: true, name: true, ownerPhone: true, address: true } },
      },
    });

    if (!order) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: `Order ${id} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    // Build status timeline
    const timeline = [
      { status: 'PENDING', label: 'Order Placed', completed: true, timestamp: order.createdAt },
      { status: 'CONFIRMED', label: 'Confirmed', completed: ['CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED'].includes(order.status), timestamp: null },
      { status: 'PROCESSING', label: 'Processing', completed: ['PROCESSING', 'DISPATCHED', 'DELIVERED'].includes(order.status), timestamp: null },
      { status: 'DISPATCHED', label: 'Dispatched', completed: ['DISPATCHED', 'DELIVERED'].includes(order.status), timestamp: null },
      { status: 'DELIVERED', label: 'Delivered', completed: order.status === 'DELIVERED', timestamp: order.deliveryEta },
    ];

    if (order.status === 'CANCELLED') {
      timeline.push({ status: 'CANCELLED', label: 'Cancelled', completed: true, timestamp: order.updatedAt });
    }

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: { ...order, timeline },
      timestamp: new Date().toISOString(),
    });
  });
};

export default eb2bOrderRoutes;
