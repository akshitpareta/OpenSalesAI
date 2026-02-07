import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import orderRoutes from '../src/routes/orders';

// ── Mock Data ────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001';
const STORE_ID = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const REP_ID = '11111111-1111-1111-1111-111111111111';

const mockProducts = [
  {
    id: 'prod-001',
    name: 'Maggi Noodles 2-Min 70g',
    skuCode: 'MGN-070',
    category: 'Noodles',
    companyId: COMPANY_ID,
    distributorPrice: 12.0,
    mrp: 14.0,
    deletedAt: null,
  },
  {
    id: 'prod-002',
    name: 'Parle-G Gold 100g',
    skuCode: 'PLG-100',
    category: 'Biscuits',
    companyId: COMPANY_ID,
    distributorPrice: 8.5,
    mrp: 10.0,
    deletedAt: null,
  },
  {
    id: 'prod-003',
    name: 'Coca-Cola 300ml',
    skuCode: 'CC-300',
    category: 'Beverages',
    companyId: COMPANY_ID,
    distributorPrice: 20.0,
    mrp: 25.0,
    deletedAt: null,
  },
];

let mockOrders: any[] = [];
let orderIdCounter = 1;

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
    rep: {
      findFirst: async ({ where }: any) => {
        if (where.id === REP_ID && where.companyId === COMPANY_ID) {
          return { id: REP_ID, name: 'Rajesh Kumar' };
        }
        return null;
      },
    },
    product: {
      findMany: async ({ where }: any) => {
        const ids = where.id?.in || [];
        return mockProducts.filter(
          (p) => ids.includes(p.id) && p.companyId === where.companyId,
        );
      },
    },
    transaction: {
      findUnique: async ({ where }: any) => {
        const order = mockOrders.find((o) => o.id === where.id);
        if (order) {
          return {
            ...order,
            items: order._items || [],
            storeRef: { id: STORE_ID, name: 'Sharma General Store' },
            rep: { id: REP_ID, name: 'Rajesh Kumar' },
          };
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        return mockOrders.find((o) => o.id === where.id && o.companyId === where.companyId) || null;
      },
      findMany: async () =>
        mockOrders.map((o) => ({
          ...o,
          items: o._items || [],
          storeRef: { id: STORE_ID, name: 'Sharma General Store' },
          rep: { id: REP_ID, name: 'Rajesh Kumar' },
        })),
      count: async () => mockOrders.length,
    },
    transactionItem: {
      createMany: async ({ data }: any) => {
        return { count: data.length };
      },
    },
    $transaction: async (fn: any) => {
      // Simulate a Prisma transaction
      const mockTx = {
        transaction: {
          create: async ({ data }: any) => {
            const order = {
              id: `order-${orderIdCounter++}`,
              ...data,
              _items: [],
              deletedAt: null,
            };
            mockOrders.push(order);
            return order;
          },
        },
        transactionItem: {
          createMany: async ({ data }: any) => {
            const lastOrder = mockOrders[mockOrders.length - 1];
            if (lastOrder) {
              lastOrder._items = data.map((item: any, idx: number) => ({
                id: `item-${idx}`,
                ...item,
                product: mockProducts.find((p) => p.id === item.productId),
              }));
            }
            return { count: data.length };
          },
        },
      };
      return fn(mockTx);
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

  app.register(orderRoutes);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Order Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockOrders = [];
    orderIdCounter = 1;
  });

  describe('POST /orders', () => {
    it('should create an order with line items and calculate totals correctly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          source: 'MANUAL',
          items: [
            { productId: 'prod-001', quantity: 10 }, // 10 * 12.0 = 120.0
            { productId: 'prod-002', quantity: 20 }, // 20 * 8.5  = 170.0
            { productId: 'prod-003', quantity: 5 },  // 5  * 20.0 = 100.0
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      // Total = 120 + 170 + 100 = 390
      expect(body.data.totalValue).toBe(390);
      expect(body.data.orderSource).toBe('MANUAL');
    });

    it('should reject order with no items', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          items: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject order with invalid storeId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: {
          storeId: '99999999-9999-9999-9999-999999999999',
          repId: REP_ID,
          items: [{ productId: 'prod-001', quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('STORE_NOT_FOUND');
    });

    it('should reject order with non-existent product', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          items: [{ productId: '99999999-9999-9999-9999-999999999999', quantity: 1 }],
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('PRODUCTS_NOT_FOUND');
    });

    it('should reject order with zero quantity', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          items: [{ productId: 'prod-001', quantity: 0 }],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should handle order from different sources', async () => {
      for (const source of ['MANUAL', 'EB2B', 'WHATSAPP', 'VOICE'] as const) {
        const res = await app.inject({
          method: 'POST',
          url: '/orders',
          payload: {
            storeId: STORE_ID,
            repId: REP_ID,
            source,
            items: [{ productId: 'prod-001', quantity: 1 }],
          },
        });

        expect(res.statusCode).toBe(201);
        expect(res.json().data.orderSource).toBe(source);
      }
    });

    it('should calculate line totals with proper rounding', async () => {
      // 3 * 8.5 = 25.5 (test decimal precision)
      const res = await app.inject({
        method: 'POST',
        url: '/orders',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          items: [{ productId: 'prod-002', quantity: 3 }],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.totalValue).toBe(25.5);
    });
  });

  describe('GET /orders', () => {
    it('should return an empty list when no orders exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/orders',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should support source filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/orders?source=WHATSAPP',
      });

      expect(res.statusCode).toBe(200);
    });

    it('should support pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/orders?page=1&limit=5',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(5);
    });

    it('should support date range filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/orders?dateFrom=2025-01-01&dateTo=2026-12-31',
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
