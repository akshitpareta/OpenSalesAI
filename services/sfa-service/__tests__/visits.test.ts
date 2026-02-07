import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import visitRoutes from '../src/routes/visits';

// ── Mock Data ────────────────────────────────────────────────────────────────

const STORE_LAT = 19.076;
const STORE_LNG = 72.8777;
const COMPANY_ID = 'company-001';
const STORE_ID = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const REP_ID = '11111111-1111-1111-1111-111111111111';

const mockStore = {
  id: STORE_ID,
  name: 'Sharma General Store',
  companyId: COMPANY_ID,
  lat: STORE_LAT,
  lng: STORE_LNG,
};

const mockRep = {
  id: REP_ID,
  name: 'Rajesh Kumar',
  companyId: COMPANY_ID,
};

// In-memory visit storage for mocking
let mockVisits: any[] = [];
let visitIdCounter = 1;

function createMockPrisma() {
  return {
    store: {
      findFirst: async ({ where }: any) => {
        if (where.id === STORE_ID && where.companyId === COMPANY_ID) {
          return mockStore;
        }
        return null;
      },
      update: async () => mockStore,
    },
    rep: {
      findFirst: async ({ where }: any) => {
        if (where.id === REP_ID && where.companyId === COMPANY_ID) {
          return mockRep;
        }
        return null;
      },
    },
    visit: {
      findFirst: async ({ where }: any) => {
        if (where.checkOutTime === null && where.repId) {
          // Check for active visit
          return mockVisits.find(
            (v) =>
              v.repId === where.repId &&
              v.companyId === where.companyId &&
              v.checkOutTime === null &&
              v.deletedAt === null,
          ) || null;
        }
        if (where.id) {
          return mockVisits.find(
            (v) => v.id === where.id && v.companyId === where.companyId && !v.deletedAt,
          ) || null;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const visit = {
          id: `visit-${visitIdCounter++}`,
          ...data,
          checkOutTime: null,
          checkOutLat: null,
          checkOutLng: null,
          durationMinutes: null,
          notes: null,
          deletedAt: null,
          storeRef: { id: STORE_ID, name: 'Sharma General Store' },
          rep: { id: REP_ID, name: 'Rajesh Kumar' },
        };
        mockVisits.push(visit);
        return visit;
      },
      update: async ({ where, data }: any) => {
        const visit = mockVisits.find((v) => v.id === where.id);
        if (visit) {
          Object.assign(visit, data);
          visit.storeRef = { id: STORE_ID, name: 'Sharma General Store' };
          visit.rep = { id: REP_ID, name: 'Rajesh Kumar' };
        }
        return visit;
      },
      findMany: async () => mockVisits.filter((v) => !v.deletedAt),
      count: async () => mockVisits.filter((v) => !v.deletedAt).length,
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

  app.register(visitRoutes);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Visit Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /visits (check-in)', () => {
    it('should check in successfully when within 100m of store', async () => {
      // Reset visits
      mockVisits = [];

      const res = await app.inject({
        method: 'POST',
        url: '/visits',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          lat: STORE_LAT + 0.0001, // ~11m away
          lng: STORE_LNG,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.storeId).toBe(STORE_ID);
      expect(body.data.repId).toBe(REP_ID);
    });

    it('should reject check-in when beyond 100m from store', async () => {
      mockVisits = [];

      const res = await app.inject({
        method: 'POST',
        url: '/visits',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          lat: STORE_LAT + 0.01, // ~1.1km away
          lng: STORE_LNG,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.code).toBe('TOO_FAR_FROM_STORE');
      expect(body.error.details.distance_meters).toBeGreaterThan(100);
    });

    it('should reject when store does not exist', async () => {
      mockVisits = [];

      const res = await app.inject({
        method: 'POST',
        url: '/visits',
        payload: {
          storeId: '99999999-9999-9999-9999-999999999999',
          repId: REP_ID,
          lat: STORE_LAT,
          lng: STORE_LNG,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('STORE_NOT_FOUND');
    });

    it('should reject when rep does not exist', async () => {
      mockVisits = [];

      const res = await app.inject({
        method: 'POST',
        url: '/visits',
        payload: {
          storeId: STORE_ID,
          repId: '99999999-9999-9999-9999-999999999999',
          lat: STORE_LAT,
          lng: STORE_LNG,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('REP_NOT_FOUND');
    });

    it('should reject when rep already has an active visit', async () => {
      mockVisits = [];

      // First check-in (succeeds)
      await app.inject({
        method: 'POST',
        url: '/visits',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          lat: STORE_LAT,
          lng: STORE_LNG,
        },
      });

      // Second check-in without checkout (should fail)
      const res = await app.inject({
        method: 'POST',
        url: '/visits',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          lat: STORE_LAT,
          lng: STORE_LNG,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.error.code).toBe('ACTIVE_VISIT_EXISTS');
    });

    it('should reject invalid GPS coordinates', async () => {
      mockVisits = [];

      const res = await app.inject({
        method: 'POST',
        url: '/visits',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          lat: 91, // Invalid: max is 90
          lng: STORE_LNG,
        },
      });

      // Zod validation rejects lat > 90
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /visits/:id/checkout', () => {
    it('should reject checkout if visit duration is less than 5 minutes', async () => {
      mockVisits = [];

      // Create a visit that was just checked in (now)
      const createRes = await app.inject({
        method: 'POST',
        url: '/visits',
        payload: {
          storeId: STORE_ID,
          repId: REP_ID,
          lat: STORE_LAT,
          lng: STORE_LNG,
        },
      });

      const visitId = createRes.json().data.id;

      // Try to checkout immediately (< 5 minutes)
      const res = await app.inject({
        method: 'PUT',
        url: `/visits/${visitId}/checkout`,
        payload: {
          lat: STORE_LAT,
          lng: STORE_LNG,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.code).toBe('VISIT_TOO_SHORT');
      expect(body.error.details.minimum_minutes).toBe(5);
    });

    it('should allow checkout when visit duration is >= 5 minutes', async () => {
      mockVisits = [];

      // Create a visit with check-in time 10 minutes ago
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      mockVisits.push({
        id: 'visit-checkout-test',
        companyId: COMPANY_ID,
        repId: REP_ID,
        storeId: STORE_ID,
        checkInTime: tenMinutesAgo,
        checkInLat: STORE_LAT,
        checkInLng: STORE_LNG,
        checkOutTime: null,
        photos: [],
        deletedAt: null,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/visits/visit-checkout-test/checkout',
        payload: {
          lat: STORE_LAT + 0.0001,
          lng: STORE_LNG,
          notes: 'Good visit, placed order for Maggi and Lays',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
    });

    it('should return 404 for non-existent visit', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/visits/00000000-0000-0000-0000-000000000000/checkout',
        payload: {
          lat: STORE_LAT,
          lng: STORE_LNG,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('VISIT_NOT_FOUND');
    });

    it('should reject checkout for already checked-out visit', async () => {
      mockVisits = [];

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      mockVisits.push({
        id: 'visit-already-out',
        companyId: COMPANY_ID,
        repId: REP_ID,
        storeId: STORE_ID,
        checkInTime: tenMinutesAgo,
        checkInLat: STORE_LAT,
        checkInLng: STORE_LNG,
        checkOutTime: new Date(), // Already checked out
        photos: [],
        deletedAt: null,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/visits/visit-already-out/checkout',
        payload: {
          lat: STORE_LAT,
          lng: STORE_LNG,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error.code).toBe('ALREADY_CHECKED_OUT');
    });
  });
});
