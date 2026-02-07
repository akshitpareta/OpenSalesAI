import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HTTP_STATUS, WHATSAPP_API_VERSION, WHATSAPP_BASE_URL } from '@opensalesai/shared';
import { parseOrderFromText, parseOrderFromAudio, parseOrderFromImage } from '../services/order-parser.js';
import { fuzzyMatchProducts, allItemsConfident, getLowConfidenceItems } from '../services/catalog-matcher.js';

const VERIFY_TOKEN = process.env['WHATSAPP_VERIFY_TOKEN'] || 'opensalesai-verify-token';
const WHATSAPP_TOKEN = process.env['WHATSAPP_ACCESS_TOKEN'] || '';
const PHONE_NUMBER_ID = process.env['WHATSAPP_PHONE_NUMBER_ID'] || '';

const WebhookVerifySchema = z.object({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

const whatsappRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * GET /whatsapp/webhook
   * Meta webhook verification endpoint.
   * Returns hub.challenge when verify_token matches.
   */
  fastify.get('/whatsapp/webhook', {
    schema: {
      description: 'WhatsApp webhook verification',
      tags: ['WhatsApp'],
      querystring: {
        type: 'object',
        properties: {
          'hub.mode': { type: 'string' },
          'hub.verify_token': { type: 'string' },
          'hub.challenge': { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as Record<string, string>;

    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      fastify.log.info('WhatsApp webhook verified successfully');
      return reply.status(200).send(challenge);
    }

    fastify.log.warn({ mode, token }, 'WhatsApp webhook verification failed');
    return reply.status(403).send({
      success: false,
      error: {
        code: 'WEBHOOK_VERIFY_FAILED',
        message: 'Verification token mismatch',
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /whatsapp/webhook
   * Receive WhatsApp messages. Routes by message type:
   *  - text: Direct to AI order parser
   *  - audio: STT transcription then parser
   *  - image: Vision/OCR then parser
   *  - interactive: Handle button/list replies
   */
  fastify.post('/whatsapp/webhook', {
    schema: {
      description: 'Receive WhatsApp webhook messages',
      tags: ['WhatsApp'],
    },
  }, async (request, reply) => {
    // Immediately respond 200 to WhatsApp (required within 5 seconds)
    reply.status(200).send({ status: 'received' });

    const body = request.body as Record<string, unknown>;

    try {
      const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
      if (!entry) {
        request.log.warn('WhatsApp webhook: no entry found');
        return;
      }

      const changes = (entry.changes as Array<Record<string, unknown>>)?.[0];
      if (!changes) {
        request.log.warn('WhatsApp webhook: no changes found');
        return;
      }

      const value = changes.value as Record<string, unknown>;
      if (!value) return;

      const messages = value.messages as Array<Record<string, unknown>>;
      if (!messages || messages.length === 0) {
        // This is a status update, not a message
        request.log.debug('WhatsApp webhook: status update received');
        return;
      }

      const metadata = value.metadata as { phone_number_id: string; display_phone_number: string };
      const contacts = value.contacts as Array<{ profile: { name: string }; wa_id: string }>;

      for (const message of messages) {
        const from = message.from as string;
        const msgId = message.id as string;
        const msgType = message.type as string;
        const contactName = contacts?.[0]?.profile?.name || 'Customer';

        request.log.info(
          { from, msgId, msgType, contactName },
          'Processing WhatsApp message',
        );

        // Look up the store by owner phone number
        // Match on last 10 digits to handle country code variations
        const store = await fastify.prisma.store.findFirst({
          where: {
            ownerPhone: { contains: from.slice(-10) },
            deletedAt: null,
          },
          select: { id: true, name: true, companyId: true },
        });

        if (!store) {
          request.log.warn({ from }, 'WhatsApp message from unknown phone number');
          await sendWhatsAppText(
            from,
            `Hi ${contactName}! Your phone number is not registered in our system. Please contact your sales representative to get registered.`,
          );
          return;
        }

        const companyId = store.companyId;

        try {
          switch (msgType) {
            case 'text': {
              const textBody = (message.text as { body: string })?.body;
              if (!textBody) break;

              await handleTextOrder(fastify, from, contactName, textBody, store, companyId, msgId);
              break;
            }

            case 'audio': {
              const audio = message.audio as { id: string; mime_type: string };
              if (!audio) break;

              await handleAudioOrder(fastify, from, contactName, audio, store, companyId, msgId);
              break;
            }

            case 'image': {
              const image = message.image as { id: string; mime_type: string; caption?: string };
              if (!image) break;

              await handleImageOrder(fastify, from, contactName, image, store, companyId, msgId);
              break;
            }

            case 'interactive': {
              const interactive = message.interactive as {
                type: string;
                button_reply?: { id: string; title: string };
                list_reply?: { id: string; title: string };
              };
              if (!interactive) break;

              await handleInteractiveReply(fastify, from, interactive, store, companyId);
              break;
            }

            default:
              request.log.info({ msgType }, 'Unsupported WhatsApp message type');
              await sendWhatsAppText(
                from,
                `Hi ${contactName}! I can process orders from text messages, voice notes, and photos. Please send your order in one of these formats.`,
              );
          }
        } catch (error) {
          request.log.error({ error, from, msgType }, 'Error processing WhatsApp message');
          await sendWhatsAppText(
            from,
            `Sorry ${contactName}, I had trouble processing your message. Please try again or call your sales representative for assistance.`,
          );
        }
      }
    } catch (error) {
      request.log.error({ error }, 'Error handling WhatsApp webhook');
    }
  });
};

/**
 * Handle a text-based order from WhatsApp.
 */
async function handleTextOrder(
  fastify: FastifyInstance,
  from: string,
  contactName: string,
  text: string,
  store: { id: string; name: string; companyId: string },
  companyId: string,
  msgId: string,
): Promise<void> {
  // Check for greeting/help messages
  const lowerText = text.toLowerCase().trim();
  if (['hi', 'hello', 'hey', 'help', 'menu'].includes(lowerText)) {
    await sendWhatsAppText(from, formatHelpMessage(contactName, store.name));
    return;
  }

  // Parse the order
  const parseResult = await parseOrderFromText({
    text,
    company_id: companyId,
    store_id: store.id,
  });

  if (parseResult.items.length === 0) {
    await sendWhatsAppText(
      from,
      `Hi ${contactName}, I couldn't identify any products from your message. Could you please list the products with quantities? Example: "2 cases Coca-Cola, 5 packs Lays Classic"`,
    );
    return;
  }

  // Match products against catalog
  const matches = await fuzzyMatchProducts(
    parseResult.items,
    companyId,
    fastify.prisma,
  );

  if (allItemsConfident(matches)) {
    // All items matched with high confidence -- create the order
    await createOrderFromMatches(fastify, from, contactName, matches, store, companyId, msgId);
  } else {
    // Some items have low confidence -- ask for clarification
    const lowConfidence = getLowConfidenceItems(matches);
    const clarificationMsg = formatClarificationMessage(contactName, lowConfidence);
    await sendWhatsAppText(from, clarificationMsg);
  }
}

/**
 * Handle an audio (voice note) order from WhatsApp.
 */
async function handleAudioOrder(
  fastify: FastifyInstance,
  from: string,
  contactName: string,
  audio: { id: string; mime_type: string },
  store: { id: string; name: string; companyId: string },
  companyId: string,
  msgId: string,
): Promise<void> {
  await sendWhatsAppText(from, `Processing your voice note, ${contactName}. This may take a moment...`);

  // Download media
  const mediaUrl = await getWhatsAppMediaUrl(audio.id);

  const parseResult = await parseOrderFromAudio(mediaUrl, companyId, store.id);

  if (parseResult.items.length === 0) {
    await sendWhatsAppText(
      from,
      `Sorry ${contactName}, I couldn't identify any products from your voice note. Could you please try sending a text message instead?`,
    );
    return;
  }

  const matches = await fuzzyMatchProducts(parseResult.items, companyId, fastify.prisma);

  if (allItemsConfident(matches)) {
    await createOrderFromMatches(fastify, from, contactName, matches, store, companyId, msgId);
  } else {
    const lowConfidence = getLowConfidenceItems(matches);
    await sendWhatsAppText(from, formatClarificationMessage(contactName, lowConfidence));
  }
}

/**
 * Handle an image-based order from WhatsApp.
 */
async function handleImageOrder(
  fastify: FastifyInstance,
  from: string,
  contactName: string,
  image: { id: string; mime_type: string; caption?: string },
  store: { id: string; name: string; companyId: string },
  companyId: string,
  msgId: string,
): Promise<void> {
  await sendWhatsAppText(from, `Processing your image, ${contactName}. This may take a moment...`);

  const mediaUrl = await getWhatsAppMediaUrl(image.id);
  const parseResult = await parseOrderFromImage(mediaUrl, companyId, store.id);

  if (parseResult.items.length === 0) {
    await sendWhatsAppText(
      from,
      `Sorry ${contactName}, I couldn't read any products from your image. Please ensure the text is clear and try again, or send a text message with your order.`,
    );
    return;
  }

  const matches = await fuzzyMatchProducts(parseResult.items, companyId, fastify.prisma);

  if (allItemsConfident(matches)) {
    await createOrderFromMatches(fastify, from, contactName, matches, store, companyId, msgId);
  } else {
    const lowConfidence = getLowConfidenceItems(matches);
    await sendWhatsAppText(from, formatClarificationMessage(contactName, lowConfidence));
  }
}

/**
 * Handle interactive button/list replies.
 */
async function handleInteractiveReply(
  fastify: FastifyInstance,
  from: string,
  interactive: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } },
  store: { id: string; name: string; companyId: string },
  _companyId: string,
): Promise<void> {
  const replyId = interactive.button_reply?.id || interactive.list_reply?.id;
  const replyTitle = interactive.button_reply?.title || interactive.list_reply?.title;

  if (replyId === 'confirm_order') {
    await sendWhatsAppText(from, `Your order has been confirmed! You will receive a confirmation with delivery details shortly.`);
  } else if (replyId === 'cancel_order') {
    await sendWhatsAppText(from, `Your order has been cancelled. Feel free to place a new order anytime!`);
  } else if (replyId === 'repeat_last') {
    // Find the last eB2B order for this store
    const lastOrder = await fastify.prisma.orderEb2b.findFirst({
      where: { storeId: store.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (lastOrder) {
      // Items are stored as JSON in the OrderEb2b model
      const items = lastOrder.items as Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;

      if (items && items.length > 0) {
        const itemsSummary = items
          .map((item) => `${item.quantity}x ${item.productName}`)
          .join('\n');
        await sendWhatsAppText(
          from,
          `Your last order was:\n${itemsSummary}\n\nWould you like to place this order again?`,
        );
      } else {
        await sendWhatsAppText(from, `No items found in your last order.`);
      }
    } else {
      await sendWhatsAppText(from, `No previous orders found for your store.`);
    }
  } else {
    fastify.log.info({ replyId, replyTitle }, 'Unhandled interactive reply');
  }
}

/**
 * Create an eB2B order from matched products and send confirmation via WhatsApp.
 * Uses the OrderEb2b model with items stored as JSON.
 */
async function createOrderFromMatches(
  fastify: FastifyInstance,
  from: string,
  contactName: string,
  matches: Array<{
    original_name: string;
    matched_product_id: string | null;
    matched_product_name: string | null;
    matched_sku_code: string | null;
    quantity: number;
    unit_price: number | null;
    confidence: number;
  }>,
  store: { id: string; name: string; companyId: string },
  companyId: string,
  msgId: string,
): Promise<void> {
  const validItems = matches.filter((m) => m.matched_product_id && m.unit_price);

  if (validItems.length === 0) {
    await sendWhatsAppText(
      from,
      `Sorry ${contactName}, none of the items could be matched to products in your catalog.`,
    );
    return;
  }

  // Build items JSON for the OrderEb2b.items field
  const orderItemsJson = validItems.map((item) => ({
    productId: item.matched_product_id!,
    productName: item.matched_product_name || item.original_name,
    skuCode: item.matched_sku_code || '',
    quantity: item.quantity,
    unitPrice: item.unit_price!,
    totalPrice: Math.round(item.unit_price! * item.quantity * 100) / 100,
  }));

  const totalValue = orderItemsJson.reduce((sum, item) => sum + item.totalPrice, 0);

  try {
    const order = await fastify.prisma.orderEb2b.create({
      data: {
        companyId,
        storeId: store.id,
        items: orderItemsJson,
        totalValue: Math.round(totalValue * 100) / 100,
        status: 'PENDING',
        channel: 'WHATSAPP',
        whatsappMsgId: msgId,
      },
    });

    // Send confirmation
    const itemsList = orderItemsJson
      .map((item) => `  ${item.quantity}x ${item.productName} - Rs.${item.totalPrice.toFixed(2)}`)
      .join('\n');

    const confirmationMsg = [
      `Order confirmed! ${contactName}`,
      ``,
      `Order ID: ${order.id.slice(0, 8)}...`,
      `Store: ${store.name}`,
      ``,
      `Items:`,
      itemsList,
      ``,
      `Total: Rs.${totalValue.toFixed(2)}`,
      ``,
      `Your order is being processed. You'll receive a delivery update soon!`,
    ].join('\n');

    await sendWhatsAppText(from, confirmationMsg);
  } catch (error) {
    fastify.log.error({ error, store: store.id }, 'Failed to create WhatsApp order');
    await sendWhatsAppText(
      from,
      `Sorry ${contactName}, there was an issue creating your order. Please try again or contact your sales representative.`,
    );
  }
}

/**
 * Send a text message via WhatsApp Business Cloud API.
 */
async function sendWhatsAppText(to: string, text: string): Promise<void> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    // Log the message if WhatsApp is not configured (development mode)
    console.log(`[WhatsApp] To: ${to}\n${text}\n`);
    return;
  }

  try {
    await fetch(
      `${WHATSAPP_BASE_URL}/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      },
    );
  } catch (error) {
    console.error(`[WhatsApp] Failed to send message to ${to}:`, error);
  }
}

/**
 * Get the download URL for a WhatsApp media file.
 */
async function getWhatsAppMediaUrl(mediaId: string): Promise<string> {
  if (!WHATSAPP_TOKEN) {
    throw new Error('WhatsApp access token not configured');
  }

  const response = await fetch(
    `${WHATSAPP_BASE_URL}/${WHATSAPP_API_VERSION}/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get media URL: ${response.status}`);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

/**
 * Format a help/menu message for new WhatsApp conversations.
 */
function formatHelpMessage(contactName: string, storeName: string): string {
  return [
    `Hi ${contactName}! Welcome to OpenSalesAI ordering for ${storeName}.`,
    ``,
    `You can place orders by:`,
    `1. Sending a text message with items, e.g.:`,
    `   "2 cases Coca-Cola, 5 packs Lays, 1 dozen Dairy Milk"`,
    ``,
    `2. Sending a voice note describing your order`,
    ``,
    `3. Sending a photo of a handwritten order list`,
    ``,
    `I'll confirm your order and you'll receive delivery updates!`,
    ``,
    `Type "repeat" to reorder your last order.`,
  ].join('\n');
}

/**
 * Format a clarification message for low-confidence product matches.
 */
function formatClarificationMessage(
  contactName: string,
  lowConfidence: Array<{ original_name: string; matched_product_name: string | null; confidence: number }>,
): string {
  const items = lowConfidence.map((item) => {
    if (item.matched_product_name) {
      return `  - "${item.original_name}" -> Did you mean "${item.matched_product_name}"?`;
    }
    return `  - "${item.original_name}" -> Product not found in catalog`;
  });

  return [
    `${contactName}, I need help with some items:`,
    ``,
    ...items,
    ``,
    `Please reply with the correct product names so I can complete your order.`,
  ].join('\n');
}

export default whatsappRoutes;
