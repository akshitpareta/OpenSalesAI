import { WHATSAPP_API_VERSION, WHATSAPP_BASE_URL } from '@opensalesai/shared';

const ACCESS_TOKEN = process.env['WHATSAPP_ACCESS_TOKEN'] || '';
const PHONE_NUMBER_ID = process.env['WHATSAPP_PHONE_NUMBER_ID'] || '';
const API_URL = `${WHATSAPP_BASE_URL}/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

interface WhatsAppApiResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

interface SendResult {
  success: boolean;
  message_id: string | null;
  error: string | null;
}

/**
 * Send a template message via WhatsApp Business Cloud API.
 * Templates must be pre-approved by Meta.
 *
 * @param to - Recipient phone number in international format (e.g., "919876543210")
 * @param templateName - Approved template name (e.g., "order_confirmation")
 * @param params - Template parameter values keyed by component type
 * @param languageCode - Template language (default: "en")
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  params: Record<string, string>,
  languageCode: string = 'en',
): Promise<SendResult> {
  // Build template components from params
  const components: Array<Record<string, unknown>> = [];

  const bodyParams = Object.entries(params).map(([, value], index) => ({
    type: 'text',
    text: value,
  }));

  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams,
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizePhoneForWhatsApp(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  return sendWhatsAppRequest(payload);
}

/**
 * Send a plain text message via WhatsApp.
 *
 * @param to - Recipient phone number
 * @param text - Message text (max 4096 characters)
 */
export async function sendTextMessage(
  to: string,
  text: string,
): Promise<SendResult> {
  if (text.length > 4096) {
    text = text.slice(0, 4093) + '...';
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizePhoneForWhatsApp(to),
    type: 'text',
    text: {
      preview_url: false,
      body: text,
    },
  };

  return sendWhatsAppRequest(payload);
}

/**
 * Send an interactive message with buttons.
 *
 * @param to - Recipient phone number
 * @param body - Message body text
 * @param buttons - Array of buttons (max 3, each with id and title)
 * @param header - Optional header text
 * @param footer - Optional footer text
 */
export async function sendInteractiveMessage(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  header?: string,
  footer?: string,
): Promise<SendResult> {
  if (buttons.length > 3) {
    throw new Error('WhatsApp interactive messages support a maximum of 3 buttons');
  }

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: body },
    action: {
      buttons: buttons.map((btn) => ({
        type: 'reply',
        reply: {
          id: btn.id,
          title: btn.title.slice(0, 20), // Max 20 chars per button title
        },
      })),
    },
  };

  if (header) {
    interactive['header'] = { type: 'text', text: header };
  }

  if (footer) {
    interactive['footer'] = { text: footer };
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizePhoneForWhatsApp(to),
    type: 'interactive',
    interactive,
  };

  return sendWhatsAppRequest(payload);
}

/**
 * Send an interactive list message.
 *
 * @param to - Recipient phone number
 * @param body - Message body text
 * @param buttonText - Text on the list button
 * @param sections - List sections with rows
 */
export async function sendListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>,
): Promise<SendResult> {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizePhoneForWhatsApp(to),
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map((section) => ({
          title: section.title.slice(0, 24),
          rows: section.rows.map((row) => ({
            id: row.id,
            title: row.title.slice(0, 24),
            description: row.description?.slice(0, 72),
          })),
        })),
      },
    },
  };

  return sendWhatsAppRequest(payload);
}

/**
 * Mark a message as read (blue ticks).
 */
export async function markAsRead(messageId: string): Promise<void> {
  await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

/**
 * Core function to send a request to the WhatsApp Cloud API.
 */
async function sendWhatsAppRequest(payload: Record<string, unknown>): Promise<SendResult> {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    // Development mode: log the message
    console.log('[WhatsApp DEV]', JSON.stringify(payload, null, 2));
    return {
      success: true,
      message_id: `dev-${Date.now()}`,
      error: null,
    };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await response.json()) as WhatsAppApiResponse;

    if (!response.ok || data.error) {
      return {
        success: false,
        message_id: null,
        error: data.error?.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      message_id: data.messages?.[0]?.id || null,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      message_id: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Normalize a phone number for WhatsApp API (remove + prefix, spaces, dashes).
 */
function normalizePhoneForWhatsApp(phone: string): string {
  return phone.replace(/[\s\-+()]/g, '');
}
