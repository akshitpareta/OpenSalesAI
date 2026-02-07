/**
 * Integration test: End-to-end order flow
 *
 * Simulates the complete order lifecycle:
 *   1. Create a store (mock)
 *   2. Create a rep (mock)
 *   3. Create a beat plan assigning rep to store
 *   4. Check in at store (GPS validated)
 *   5. Place an order with line items
 *   6. Verify order totals and data in mock DB
 *   7. Check out from store
 *
 * All external dependencies (Prisma, Keycloak) are mocked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import beatRoutes from '../../src/routes/beats';
import visitRoutes from '../../src/routes/visits';
import orderRoutes from '../../src/routes/orders';

// ── Mock State ───────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-integration';
const STORE_ID = 'store-int-001';
const REP_ID = 'rep-int-001';
const STORE_LAT = 19.076;
const STORE_LNG = 72.8777;

const mockProducts = [
  {
    id: 'prod-int-001',
    name: 'Maggi Noodles 2-Min 70g',
    skuCode: 'MGN-070',
    category: 'Noodles',
    companyId: COMPANY_ID,
    distributorPrice: 12.0,
    mrp: 14.0,
    deletedAt: null,
  },
  {
    id: 'prod-int-002',
    name: 'Lays Classic 50g',
    skuCode: 'LAYS-50',
    category: 'Snacks',
    companyId: COMPANY_ID,
    distributorPrice: 16.0,
    mrp: 20.0,
    deletedAt: null,
  },
];

let mockVisits: any[] = [];
let mockOrders: any[] = [];
let visitCounter = 1;
let orderCounter = 1;

function createMockPrisma() {
  return {
    store: {
      findFirst: async ({ where }: any) => {
        if (where.id === STORE_ID && where.companyId === COMPANY_ID) {
          return {
            id: STORE_ID,
            name: 'Integration Test Store',
            lat: STORE_LAT,
            lng: STORE_LNG,
            companyId: COMPANY_ID,
          };
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        const ids: string[] = where.id?.in || [];
        if (ids.includes(STORE_ID)) {
          return [{ id: STORE_ID }];
        }
        return [];
      },
      update: async () => ({}),
    },
    rep: {
      findFirst: async ({ where }: any) => {
        if (where.id === REP_ID && where.companyId === COMPANY_ID) {
          return { id: REP_ID, name: 'Integration Rep' };
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
    visit: {
      findFirst: async ({ where }: any) => {
        if (where.checkOutTime === null && where.repId) {
          return (
            mockVisits.find(
              (v) =>
                v.repId === where.repId &&
                v.companyId === where.companyId &&
                v.checkOutTime === null &&
                !v.deletedAt,
            ) || null
          );
        }
        if (where.id) {
          return mockVisits.find((v) => v.id === where.id && !v.deletedAt) || null;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const visit = {
          id: `visit-int-${visitCounter++}`,
          ...data,
          checkOutTime: null,
          photos: [],
          deletedAt: null,
          storeRef: { id: STORE_ID, name: 'Integration Test Store' },
          rep: { id: REP_ID, name: 'Integration Rep' },
        };
        mockVisits.push(visit);
        return visit;
      },
      update: async ({ where, data }: any) => {
        const visit = mockVisits.find((v) => v.id === where.id);
        if (visit) {
          Object.assign(visit, data);
          visit.storeRef = { id: STORE_ID, name: 'Integration Test Store' };
          visit.rep = { id: REP_ID, name: 'Integration Rep' };
        }
        return visit;
      },
      findMany: async () => mockVisits,
      count: async () => mockVisits.length,
    },
    transaction: {
      findUnique: async ({ where }: any) => {
        const order = mockOrders.find((o) => o.id === where.id);
        if (order) {
          return {
            ...order,
            items: order._items || [],
            storeRef: { id: STORE_ID, name: 'Integration Test Store' },
            rep: { id: REP_ID, name: 'Integration Rep' },
          };
        }
        return null;
      },
      findMany: async () => mockOrders,
      count: async () => mockOrders.length,
    },
    transactionItem: {
      createMany: async () => ({ count: 0 }),
    },
    $transaction: async (fn: any) => {
      const tx = {
        transaction: {
          create: async ({ data }: any) => {
            const order = {
              id: `order-int-${orderCounter++}`,
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
              lastOrder._items = data.map((item: any, i: number) => ({
                id: `item-int-${i}`,
                ...item,
                product: mockProducts.find((p) => p.id === item.productId),
              }));
            }
            return { count: data.length };
          },
        },
      };
      return fn(tx);
    },
  };
}

// ── App Setup ────────────────────────────────────────────────────────────────

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(
    fp(async (fastify) => {
      fastify.decorate('prisma', createMockPrisma());
    }),
  );

  app.addHook('preHandler', async (request) => {
    (request as any).user = {
      user_id: 'user-int-001',
      email: 'integration@opensalesai.local',
      username: 'integration',
      tenant_id: 'tenant-int',
      company_id: COMPANY_ID,
      roles: ['admin'],
    };
  });

  app.register(beatRoutes);
  app.register(visitRoutes);
  app.register(orderRoutes);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Integration: End-to-End Order Flow', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockVisits = [];
    mockOrders = [];
    visitCounter = 1;
    orderCounter = 1;
  });

  it('should complete the full order lifecycle: beat -> check-in -> order -> checkout', async () => {
    // ── Step 1: Create a beat plan assigning rep to store ──
    const beatRes = await app.inject({
      method: 'POST',
      url: '/beats',
      payload: {
        repId: REP_ID,
        name: 'Integration Test Route',
        dayOfWeek: new Date().getDay(), // Today
        storeIds: [STORE_ID],
        sequence: [0],
      },
    });

    expect(beatRes.statusCode).toBe(201);
    const beat = beatRes.json();
    expect(beat.success).toBe(true);
    expect(beat.data.storeIds).toContain(STORE_ID);

    // ── Step 2: Check in at the store (within 100m) ──
    const checkinRes = await app.inject({
      method: 'POST',
      url: '/visits',
      payload: {
        storeId: STORE_ID,
        repId: REP_ID,
        lat: STORE_LAT + 0.00005, // ~5.5m away
        lng: STORE_LNG,
      },
    });

    expect(checkinRes.statusCode).toBe(201);
    const visit = checkinRes.json();
    expect(visit.success).toBe(true);
    const visitId = visit.data.id;

    // ── Step 3: Place an order with line items ──
    const orderRes = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {
        storeId: STORE_ID,
        repId: REP_ID,
        source: 'MANUAL',
        items: [
          { productId: 'prod-int-001', quantity: 10 }, // 10 * 12 = 120
          { productId: 'prod-int-002', quantity: 5 },  // 5  * 16 = 80
        ],
      },
    });

    expect(orderRes.statusCode).toBe(201);
    const order = orderRes.json();
    expect(order.success).toBe(true);
    expect(order.data.totalValue).toBe(200); // 120 + 80
    expect(order.data.orderSource).toBe('MANUAL');

    // ── Step 4: Verify order exists in mock storage ──
    expect(mockOrders.length).toBe(1);
    expect(mockOrders[0].storeId).toBe(STORE_ID);
    expect(mockOrders[0].repId).toBe(REP_ID);
    expect(mockOrders[0].totalValue).toBe(200);

    // ── Step 5: Check out (after simulating 10-minute visit) ──
    // Manually backdate the visit check-in time for the mock
    const targetVisit = mockVisits.find((v) => v.id === visitId);
    if (targetVisit) {
      targetVisit.checkInTime = new Date(Date.now() - 10 * 60 * 1000);
    }

    const checkoutRes = await app.inject({
      method: 'PUT',
      url: `/visits/${visitId}/checkout`,
      payload: {
        lat: STORE_LAT,
        lng: STORE_LNG,
        notes: 'Placed order for Maggi and Lays. Store owner interested in promo.',
      },
    });

    expect(checkoutRes.statusCode).toBe(200);
    const checkoutData = checkoutRes.json();
    expect(checkoutData.success).toBe(true);
  });

  it('should prevent order if GPS check-in fails', async () => {
    // Try to check in from 2km away
    const checkinRes = await app.inject({
      method: 'POST',
      url: '/visits',
      payload: {
        storeId: STORE_ID,
        repId: REP_ID,
        lat: STORE_LAT + 0.02, // ~2.2km away
        lng: STORE_LNG,
      },
    });

    expect(checkinRes.statusCode).toBe(400);
    expect(checkinRes.json().error.code).toBe('TOO_FAR_FROM_STORE');

    // No visit should exist
    expect(mockVisits.length).toBe(0);
  });

  it('should handle concurrent order and visit in sequence', async () => {
    // Check in
    const checkinRes = await app.inject({
      method: 'POST',
      url: '/visits',
      payload: {
        storeId: STORE_ID,
        repId: REP_ID,
        lat: STORE_LAT,
        lng: STORE_LNG,
      },
    });
    expect(checkinRes.statusCode).toBe(201);

    // Place order while checked in
    const orderRes = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: {
        storeId: STORE_ID,
        repId: REP_ID,
        items: [{ productId: 'prod-int-001', quantity: 3 }],
      },
    });
    expect(orderRes.statusCode).toBe(201);
    expect(orderRes.json().data.totalValue).toBe(36); // 3 * 12
  });
});
