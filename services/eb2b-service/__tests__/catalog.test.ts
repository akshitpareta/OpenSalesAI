import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import catalogRoutes from '../src/routes/catalog';

// ── Mock Data ────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001';

const mockProducts = [
  {
    id: 'prod-001',
    skuCode: 'MGN-070',
    name: 'Maggi Noodles 2-Min 70g',
    category: 'Noodles',
    subCategory: 'Instant Noodles',
    mrp: 14.0,
    distributorPrice: 12.0,
    marginPct: 14.3,
    packSize: '70g',
    shelfLifeDays: 180,
    isFocus: true,
    launchDate: new Date('2024-01-01'),
    companyId: COMPANY_ID,
    deletedAt: null,
    createdAt: new Date(),
  },
  {
    id: 'prod-002',
    skuCode: 'PLG-100',
    name: 'Parle-G Gold 100g',
    category: 'Biscuits',
    subCategory: 'Glucose Biscuits',
    mrp: 10.0,
    distributorPrice: 8.5,
    marginPct: 15.0,
    packSize: '100g',
    shelfLifeDays: 270,
    isFocus: false,
    launchDate: new Date('2023-06-15'),
    companyId: COMPANY_ID,
    deletedAt: null,
    createdAt: new Date(),
  },
  {
    id: 'prod-003',
    skuCode: 'CC-300',
    name: 'Coca-Cola 300ml',
    category: 'Beverages',
    subCategory: 'Carbonated Drinks',
    mrp: 25.0,
    distributorPrice: 20.0,
    marginPct: 20.0,
    packSize: '300ml',
    shelfLifeDays: 365,
    isFocus: true,
    launchDate: new Date('2023-03-01'),
    companyId: COMPANY_ID,
    deletedAt: null,
    createdAt: new Date(),
  },
  {
    id: 'prod-004',
    skuCode: 'LAYS-CLS-50',
    name: 'Lays Classic Salted 50g',
    category: 'Snacks',
    subCategory: 'Potato Chips',
    mrp: 20.0,
    distributorPrice: 16.0,
    marginPct: 20.0,
    packSize: '50g',
    shelfLifeDays: 90,
    isFocus: false,
    launchDate: new Date('2024-02-01'),
    companyId: COMPANY_ID,
    deletedAt: null,
    createdAt: new Date(),
  },
];

function createMockPrisma() {
  return {
    product: {
      findMany: async ({ where, skip, take, orderBy, select }: any) => {
        let filtered = mockProducts.filter(
          (p) => p.companyId === where.companyId && !p.deletedAt,
        );

        // Handle text search (OR condition)
        if (where.OR) {
          const searchConditions = where.OR as Array<Record<string, any>>;
          filtered = filtered.filter((p) =>
            searchConditions.some((cond) => {
              for (const [key, rule] of Object.entries(cond)) {
                const val = (p as any)[key];
                if (
                  rule.contains &&
                  typeof val === 'string' &&
                  val.toLowerCase().includes(rule.contains.toLowerCase())
                ) {
                  return true;
                }
              }
              return false;
            }),
          );
        }

        if (where.category) {
          filtered = filtered.filter((p) => p.category === where.category);
        }

        if (where.isFocus !== undefined) {
          filtered = filtered.filter((p) => p.isFocus === where.isFocus);
        }

        if (where.mrp) {
          if (where.mrp.gte !== undefined) {
            filtered = filtered.filter((p) => p.mrp >= where.mrp.gte);
          }
          if (where.mrp.lte !== undefined) {
            filtered = filtered.filter((p) => p.mrp <= where.mrp.lte);
          }
        }

        // Pagination
        const start = skip || 0;
        const end = start + (take || filtered.length);
        return filtered.slice(start, end);
      },
      count: async ({ where }: any) => {
        let filtered = mockProducts.filter(
          (p) => p.companyId === where.companyId && !p.deletedAt,
        );

        if (where.OR) {
          const searchConditions = where.OR as Array<Record<string, any>>;
          filtered = filtered.filter((p) =>
            searchConditions.some((cond) => {
              for (const [key, rule] of Object.entries(cond)) {
                const val = (p as any)[key];
                if (
                  rule.contains &&
                  typeof val === 'string' &&
                  val.toLowerCase().includes(rule.contains.toLowerCase())
                ) {
                  return true;
                }
              }
              return false;
            }),
          );
        }

        if (where.category) {
          filtered = filtered.filter((p) => p.category === where.category);
        }

        if (where.isFocus !== undefined) {
          filtered = filtered.filter((p) => p.isFocus === where.isFocus);
        }

        return filtered.length;
      },
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

  app.register(catalogRoutes);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Catalog Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /catalog', () => {
    it('should return all products with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(4);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(4);
    });

    it('should support text search by product name', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog?query=maggi',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data[0].name).toContain('Maggi');
    });

    it('should support search by SKU code', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog?query=PLG',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by category', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog?category=Beverages',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.every((p: any) => p.category === 'Beverages')).toBe(true);
    });

    it('should filter by focus products', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog?isFocus=true',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.every((p: any) => p.isFocus === true)).toBe(true);
    });

    it('should support pagination with page and limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog?page=1&limit=2',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(2);
    });

    it('should return empty when search matches nothing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog?query=nonexistentproduct',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBe(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  describe('GET /catalog/:id', () => {
    it('should return a product by ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog/prod-001',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('prod-001');
      expect(body.data.name).toBe('Maggi Noodles 2-Min 70g');
    });

    it('should return 404 for non-existent product', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog/00000000-0000-0000-0000-000000000000',
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });
});
