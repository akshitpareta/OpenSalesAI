import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import whatsappRoutes from '../src/routes/whatsapp';

// ── Mock Environment ─────────────────────────────────────────────────────────

vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'test-verify-token');
vi.stubEnv('WHATSAPP_ACCESS_TOKEN', ''); // Empty = dev mode, no real API calls
vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '');

// ── Mock dependencies that whatsapp.ts imports ───────────────────────────────

vi.mock('../src/services/order-parser', () => ({
  parseOrderFromText: vi.fn().mockResolvedValue({
    items: [{ name: 'Maggi Noodles', quantity: 2 }],
  }),
  parseOrderFromAudio: vi.fn().mockResolvedValue({ items: [] }),
  parseOrderFromImage: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../src/services/catalog-matcher', () => ({
  fuzzyMatchProducts: vi.fn().mockResolvedValue([
    {
      original_name: 'Maggi Noodles',
      matched_product_id: 'prod-001',
      matched_product_name: 'Maggi Noodles 2-Min 70g',
      matched_sku_code: 'MGN-070',
      quantity: 2,
      unit_price: 12.0,
      confidence: 0.95,
    },
  ]),
  allItemsConfident: vi.fn().mockReturnValue(true),
  getLowConfidenceItems: vi.fn().mockReturnValue([]),
}));

// ── Mock Data ────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001';

function createMockPrisma() {
  return {
    store: {
      findFirst: async ({ where }: any) => {
        if (where.ownerPhone?.contains === '9876543210') {
          return { id: 'store-001', name: 'Sharma General Store', companyId: COMPANY_ID };
        }
        return null;
      },
    },
    orderEb2b: {
      create: async ({ data }: any) => ({
        id: 'order-wa-001',
        ...data,
        createdAt: new Date(),
      }),
      findFirst: async () => null,
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

  // The whatsapp webhook GET is public; POST sets a system user
  app.addHook('preHandler', async (request) => {
    (request as any).user = {
      user_id: 'whatsapp-webhook',
      email: 'webhook@opensalesai.local',
      username: 'whatsapp',
      tenant_id: 'default',
      company_id: 'default',
      roles: ['webhook'],
    };
  });

  app.register(whatsappRoutes);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WhatsApp Webhook Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /whatsapp/webhook (Meta Verification)', () => {
    it('should return the challenge when verify token matches', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=test-challenge-string',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('test-challenge-string');
    });

    it('should return 403 when verify token does not match', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge',
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.error.code).toBe('WEBHOOK_VERIFY_FAILED');
    });

    it('should return 403 when mode is not subscribe', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=test-verify-token&hub.challenge=challenge',
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /whatsapp/webhook (Message Routing)', () => {
    it('should return 200 immediately for any webhook POST', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp/webhook',
        payload: {
          entry: [
            {
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '15551234567',
                      phone_number_id: '123456',
                    },
                    contacts: [
                      { profile: { name: 'Ramesh' }, wa_id: '919876543210' },
                    ],
                    messages: [
                      {
                        from: '919876543210',
                        id: 'wamid.test123',
                        type: 'text',
                        text: { body: '2 cases Maggi, 5 packets Parle-G' },
                        timestamp: '1706000000',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      });

      // WhatsApp requires immediate 200 response
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('received');
    });

    it('should handle status update (no messages) gracefully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp/webhook',
        payload: {
          entry: [
            {
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '15551234567', phone_number_id: '123456' },
                    statuses: [
                      { id: 'wamid.test', status: 'delivered', timestamp: '1706000000' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should handle empty body gracefully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp/webhook',
        payload: {},
      });

      expect(res.statusCode).toBe(200);
    });

    it('should handle audio message type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp/webhook',
        payload: {
          entry: [
            {
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '15551234567',
                      phone_number_id: '123456',
                    },
                    contacts: [
                      { profile: { name: 'Ramesh' }, wa_id: '919876543210' },
                    ],
                    messages: [
                      {
                        from: '919876543210',
                        id: 'wamid.audio123',
                        type: 'audio',
                        audio: { id: 'audio-media-id-123', mime_type: 'audio/ogg' },
                        timestamp: '1706000000',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should handle image message type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/whatsapp/webhook',
        payload: {
          entry: [
            {
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '15551234567',
                      phone_number_id: '123456',
                    },
                    contacts: [
                      { profile: { name: 'Ramesh' }, wa_id: '919876543210' },
                    ],
                    messages: [
                      {
                        from: '919876543210',
                        id: 'wamid.image123',
                        type: 'image',
                        image: {
                          id: 'image-media-id-123',
                          mime_type: 'image/jpeg',
                          caption: 'Order photo',
                        },
                        timestamp: '1706000000',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
