import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HTTP_STATUS } from '@opensalesai/shared';

/**
 * Cart is stored in-memory since the Prisma schema does not include a cart table.
 * In production, this would be backed by Redis for persistence across restarts.
 *
 * Structure: Map<"companyId:storeId", CartItem[]>
 */

interface CartItemData {
  productId: string;
  productName: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedAt: Date;
}

const cartStore = new Map<string, CartItemData[]>();

function cartKey(companyId: string, storeId: string): string {
  return `${companyId}:${storeId}`;
}

function getCart(companyId: string, storeId: string): CartItemData[] {
  const key = cartKey(companyId, storeId);
  if (!cartStore.has(key)) {
    cartStore.set(key, []);
  }
  return cartStore.get(key)!;
}

function buildCartResponse(storeId: string, companyId: string, items: CartItemData[]) {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  return {
    storeId,
    companyId,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    itemCount: items.length,
  };
}

const AddToCartSchema = z.object({
  storeId: z.string().uuid('storeId must be a valid UUID'),
  productId: z.string().uuid('productId must be a valid UUID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

const cartRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /cart
   * Add an item to a store's cart.
   */
  fastify.post('/cart', {
    schema: {
      description: 'Add item to cart',
      tags: ['Cart'],
    },
  }, async (request, reply) => {
    const body = AddToCartSchema.parse(request.body);
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

    // Verify product exists
    const product = await fastify.prisma.product.findFirst({
      where: { id: body.productId, companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        skuCode: true,
        distributorPrice: true,
      },
    });

    if (!product) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: `Product ${body.productId} not found` },
        timestamp: new Date().toISOString(),
      });
    }

    const items = getCart(companyId, body.storeId);
    const unitPrice = Number(product.distributorPrice);

    // Check if product already in cart
    const existingIdx = items.findIndex((item) => item.productId === body.productId);

    if (existingIdx >= 0) {
      const existing = items[existingIdx];
      existing.quantity += body.quantity;
      existing.totalPrice = Math.round(unitPrice * existing.quantity * 100) / 100;
    } else {
      items.push({
        productId: product.id,
        productName: product.name,
        skuCode: product.skuCode,
        quantity: body.quantity,
        unitPrice,
        totalPrice: Math.round(unitPrice * body.quantity * 100) / 100,
        addedAt: new Date(),
      });
    }

    const cart = buildCartResponse(body.storeId, companyId, items);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: cart,
      message: `Added ${body.quantity}x ${product.name} to cart`,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /cart/:storeId
   * Get the current cart contents for a store.
   */
  fastify.get('/cart/:storeId', {
    schema: {
      description: 'Get cart contents for a store',
      tags: ['Cart'],
      params: {
        type: 'object',
        properties: { storeId: { type: 'string', format: 'uuid' } },
        required: ['storeId'],
      },
    },
  }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const companyId = request.user.company_id;
    const items = getCart(companyId, storeId);
    const cart = buildCartResponse(storeId, companyId, items);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: cart,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * PUT /cart/:storeId/items/:productId
   * Update quantity for a cart item.
   */
  fastify.put('/cart/:storeId/items/:productId', {
    schema: {
      description: 'Update cart item quantity',
      tags: ['Cart'],
    },
  }, async (request, reply) => {
    const { storeId, productId } = request.params as { storeId: string; productId: string };
    const body = UpdateCartItemSchema.parse(request.body);
    const companyId = request.user.company_id;

    const items = getCart(companyId, storeId);
    const itemIdx = items.findIndex((item) => item.productId === productId);

    if (itemIdx < 0) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'CART_ITEM_NOT_FOUND', message: 'Item not found in cart' },
        timestamp: new Date().toISOString(),
      });
    }

    items[itemIdx].quantity = body.quantity;
    items[itemIdx].totalPrice = Math.round(items[itemIdx].unitPrice * body.quantity * 100) / 100;

    const cart = buildCartResponse(storeId, companyId, items);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: cart,
      message: `Updated quantity to ${body.quantity}`,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * DELETE /cart/:storeId/items/:productId
   * Remove an item from the cart.
   */
  fastify.delete('/cart/:storeId/items/:productId', {
    schema: {
      description: 'Remove item from cart',
      tags: ['Cart'],
    },
  }, async (request, reply) => {
    const { storeId, productId } = request.params as { storeId: string; productId: string };
    const companyId = request.user.company_id;

    const items = getCart(companyId, storeId);
    const itemIdx = items.findIndex((item) => item.productId === productId);

    if (itemIdx < 0) {
      return reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: { code: 'CART_ITEM_NOT_FOUND', message: 'Item not found in cart' },
        timestamp: new Date().toISOString(),
      });
    }

    items.splice(itemIdx, 1);
    const cart = buildCartResponse(storeId, companyId, items);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: cart,
      message: 'Item removed from cart',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * DELETE /cart/:storeId
   * Clear all items from a store's cart.
   */
  fastify.delete('/cart/:storeId', {
    schema: {
      description: 'Clear cart for a store',
      tags: ['Cart'],
    },
  }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const companyId = request.user.company_id;

    const key = cartKey(companyId, storeId);
    cartStore.set(key, []);

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: { storeId, items: [], subtotal: 0, itemCount: 0 },
      message: 'Cart cleared',
      timestamp: new Date().toISOString(),
    });
  });
};

export default cartRoutes;

/**
 * Exported for use by the orders route when converting cart to order.
 */
export { getCart, cartKey, cartStore, type CartItemData };
