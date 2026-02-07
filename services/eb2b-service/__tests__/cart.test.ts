import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cartRoutes from '../src/routes/cart';

// ── Mock Data ────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001';
const STORE_ID = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockProducts = [
  {
    id: 'prod-001',
    name: 'Maggi Noodles 2-Min 70g',
    skuCode: 'MGN-070',
    distributorPrice: 12.0,
    companyId: COMPANY_ID,
    deletedAt: null,
  },
  {
    id: 'prod-002',
    name: 'Parle-G Gold 100g',
    skuCode: 'PLG-100',
    distributorPrice: 8.5,
    companyId: COMPANY_ID,
    deletedAt: null,
  },
];

function createMockPrisma() {
  return {
    store: {
      findFirst: async ({ where }: any) => {
        if (where.id === STORE_ID && where.companyId === COMPANY_ID) {
          return { id: STORE_ID, name: 'Sharma General Store' };
        }
        return null;
      },
    },
    product: {
      findFirst: async ({ where }: any) => {
        return (
          mockProducts.find(
            (p) => p.id === where.id && p.companyId === where.companyId && !p.deletedAt,
          ) || null
        );
      },
    },
  };
}

// ── App Builder ──────────────────────────────────────────────────────────────

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(
    fp(async (fastify) => {
      fastify.decorate('prisma', createMockPrisma());
    }),
  );

  app.addHook('preHandler', async (request) => {
    (request as any).user = {
      user_id: 'user-001',
      email: 'test@opensalesai.local',
      username: 'test',
      tenant_id: 'tenant-001',
      company_id: COMPANY_ID,
      roles: ['admin'],
    };
  });

  app.register(cartRoutes);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Cart Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /cart (add item)', () => {
    it('should add an item to the cart', async () => {
      // Clear cart first
      await app.inject({ method: 'DELETE', url: `/cart/${STORE_ID}` });

      const res = await app.inject({
        method: 'POST',
        url: '/cart',
        payload: {
          storeId: STORE_ID,
          productId: 'prod-001',
          quantity: 5,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBe(1);
      expect(body.data.items[0].productId).toBe('prod-001');
      expect(body.data.items[0].quantity).toBe(5);
      expect(body.data.items[0].unitPrice).toBe(12.0);
      expect(body.data.items[0].totalPrice).toBe(60.0);
      expect(body.data.subtotal).toBe(60.0);
      expect(body.data.itemCount).toBe(1);
    });

    it('should increment quantity when adding same product again', async () => {
      await app.inject({ method: 'DELETE', url: `/cart/${STORE_ID}` });

      // Add 5 units
      await app.inject({
        method: 'POST',
        url: '/cart',
        payload: { storeId: STORE_ID, productId: 'prod-001', quantity: 5 },
      });

      // Add 3 more units
      const res = await app.inject({
        method: 'POST',
        url: '/cart',
        payload: { storeId: STORE_ID, productId: 'prod-001', quantity: 3 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.items[0].quantity).toBe(8);
      expect(body.data.items[0].totalPrice).toBe(96.0);
    });

    it('should reject when store does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/cart',
        payload: {
          storeId: '99999999-9999-9999-9999-999999999999',
          productId: 'prod-001',
          quantity: 1,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('STORE_NOT_FOUND');
    });

    it('should reject when product does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/cart',
        payload: {
          storeId: STORE_ID,
          productId: '99999999-9999-9999-9999-999999999999',
          quantity: 1,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('should reject negative quantities via Zod validation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/cart',
        payload: {
          storeId: STORE_ID,
          productId: 'prod-001',
          quantity: -3,
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject zero quantity via Zod validation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/cart',
        payload: {
          storeId: STORE_ID,
          productId: 'prod-001',
          quantity: 0,
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /cart/:storeId/items/:productId (update quantity)', () => {
    it('should update item quantity', async () => {
      await app.inject({ method: 'DELETE', url: `/cart/${STORE_ID}` });
      await app.inject({
        method: 'POST',
        url: '/cart',
        payload: { storeId: STORE_ID, productId: 'prod-001', quantity: 5 },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/cart/${STORE_ID}/items/prod-001`,
        payload: { quantity: 10 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.items[0].quantity).toBe(10);
      expect(body.data.items[0].totalPrice).toBe(120.0);
    });

    it('should return 404 for item not in cart', async () => {
      await app.inject({ method: 'DELETE', url: `/cart/${STORE_ID}` });

      const res = await app.inject({
        method: 'PUT',
        url: `/cart/${STORE_ID}/items/prod-999`,
        payload: { quantity: 5 },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('CART_ITEM_NOT_FOUND');
    });
  });

  describe('DELETE /cart/:storeId/items/:productId (remove item)', () => {
    it('should remove a specific item from the cart', async () => {
      await app.inject({ method: 'DELETE', url: `/cart/${STORE_ID}` });

      // Add two items
      await app.inject({
        method: 'POST',
        url: '/cart',
        payload: { storeId: STORE_ID, productId: 'prod-001', quantity: 5 },
      });
      await app.inject({
        method: 'POST',
        url: '/cart',
        payload: { storeId: STORE_ID, productId: 'prod-002', quantity: 3 },
      });

      // Remove first item
      const res = await app.inject({
        method: 'DELETE',
        url: `/cart/${STORE_ID}/items/prod-001`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.items.length).toBe(1);
      expect(body.data.items[0].productId).toBe('prod-002');
    });

    it('should return 404 when removing non-existent item', async () => {
      await app.inject({ method: 'DELETE', url: `/cart/${STORE_ID}` });

      const res = await app.inject({
        method: 'DELETE',
        url: `/cart/${STORE_ID}/items/prod-999`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /cart/:storeId (clear cart)', () => {
    it('should clear all items from the cart', async () => {
      // Add items
      await app.inject({
        method: 'POST',
        url: '/cart',
        payload: { storeId: STORE_ID, productId: 'prod-001', quantity: 5 },
      });

      // Clear cart
      const res = await app.inject({
        method: 'DELETE',
        url: `/cart/${STORE_ID}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.items).toEqual([]);
      expect(body.data.subtotal).toBe(0);
      expect(body.data.itemCount).toBe(0);
    });
  });

  describe('GET /cart/:storeId (get cart)', () => {
    it('should return empty cart for new store', async () => {
      const newStoreId = 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const res = await app.inject({
        method: 'GET',
        url: `/cart/${newStoreId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.items).toEqual([]);
      expect(body.data.subtotal).toBe(0);
    });
  });
});
