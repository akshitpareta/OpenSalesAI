import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import beatRoutes from '../src/routes/beats';

// ── Mock Prisma Client ──────────────────────────────────────────────────────

const mockRep = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Rajesh Kumar',
  companyId: 'company-001',
};

const mockStores = [
  { id: 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
  { id: 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
  { id: 'aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
];

function createMockPrisma() {
  return {
    rep: {
      findFirst: async ({ where }: any) => {
        if (where.id === mockRep.id && where.companyId === 'company-001') {
          return mockRep;
        }
        return null;
      },
    },
    store: {
      findMany: async ({ where }: any) => {
        const ids: string[] = where.id?.in || [];
        return mockStores.filter((s) => ids.includes(s.id));
      },
    },
  };
}

// ── Test Helpers ─────────────────────────────────────────────────────────────

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  // Register mock Prisma
  app.register(
    fp(async (fastify) => {
      fastify.decorate('prisma', createMockPrisma());
    }),
  );

  // Auth mock: inject user into every request
  app.addHook('preHandler', async (request) => {
    (request as any).user = {
      user_id: 'user-001',
      email: 'test@opensalesai.local',
      username: 'test',
      tenant_id: 'tenant-001',
      company_id: 'company-001',
      roles: ['admin'],
    };
  });

  app.register(beatRoutes);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Beat Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /beats', () => {
    it('should return an empty list initially', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/beats',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(0);
    });

    it('should return paginated results', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/beats?page=1&limit=10',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
    });
  });

  describe('POST /beats', () => {
    it('should create a beat plan with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'Monday South Route',
          dayOfWeek: 1,
          storeIds: [mockStores[0].id, mockStores[1].id],
          sequence: [0, 1],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Monday South Route');
      expect(body.data.dayOfWeek).toBe(1);
      expect(body.data.isActive).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.storeIds).toHaveLength(2);
    });

    it('should reject when repId is not a valid UUID', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: 'not-a-uuid',
          name: 'Invalid Beat',
          dayOfWeek: 1,
          storeIds: [mockStores[0].id],
          sequence: [0],
        },
      });

      // Zod validation error
      expect(res.statusCode).toBe(400);
    });

    it('should reject when dayOfWeek is out of range', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'Invalid Day Beat',
          dayOfWeek: 7, // Invalid: must be 0-6
          storeIds: [mockStores[0].id],
          sequence: [0],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject when storeIds is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'No Stores Beat',
          dayOfWeek: 2,
          storeIds: [],
          sequence: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject when storeIds and sequence lengths differ', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'Mismatched Beat',
          dayOfWeek: 3,
          storeIds: [mockStores[0].id, mockStores[1].id],
          sequence: [0], // Length mismatch
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject when rep does not exist', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: '99999999-9999-9999-9999-999999999999',
          name: 'Ghost Rep Beat',
          dayOfWeek: 4,
          storeIds: [mockStores[0].id],
          sequence: [0],
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('REP_NOT_FOUND');
    });

    it('should reject duplicate beat for same rep on same day', async () => {
      // Create first beat on day 5
      await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'Friday Route A',
          dayOfWeek: 5,
          storeIds: [mockStores[0].id],
          sequence: [0],
        },
      });

      // Try to create second beat on same day for same rep
      const res = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'Friday Route B',
          dayOfWeek: 5,
          storeIds: [mockStores[1].id],
          sequence: [0],
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.error.code).toBe('BEAT_EXISTS');
    });
  });

  describe('PUT /beats/:id', () => {
    it('should update a beat plan name', async () => {
      // Create a beat first
      const createRes = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'Original Name',
          dayOfWeek: 6,
          storeIds: [mockStores[0].id],
          sequence: [0],
        },
      });

      const beatId = createRes.json().data.id;

      const res = await app.inject({
        method: 'PUT',
        url: `/beats/${beatId}`,
        payload: {
          name: 'Updated Name',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Updated Name');
    });

    it('should return 404 for non-existent beat', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/beats/00000000-0000-0000-0000-000000000000',
        payload: {
          name: 'Ghost Update',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('BEAT_NOT_FOUND');
    });
  });

  describe('DELETE /beats/:id (soft delete)', () => {
    it('should soft-delete a beat plan', async () => {
      // Create a beat
      const createRes = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'To Be Deleted',
          dayOfWeek: 0,
          storeIds: [mockStores[2].id],
          sequence: [0],
        },
      });

      const beatId = createRes.json().data.id;

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/beats/${beatId}`,
      });

      expect(deleteRes.statusCode).toBe(200);
      const body = deleteRes.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(beatId);
    });

    it('should return 404 when trying to delete a non-existent beat', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/beats/00000000-0000-0000-0000-000000000000',
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 when trying to delete an already-deleted beat', async () => {
      // Create and delete a beat
      const createRes = await app.inject({
        method: 'POST',
        url: '/beats',
        payload: {
          repId: mockRep.id,
          name: 'Double Delete',
          dayOfWeek: 4,
          storeIds: [mockStores[0].id],
          sequence: [0],
        },
      });

      const beatId = createRes.json().data.id;

      await app.inject({
        method: 'DELETE',
        url: `/beats/${beatId}`,
      });

      // Try deleting again
      const res = await app.inject({
        method: 'DELETE',
        url: `/beats/${beatId}`,
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
