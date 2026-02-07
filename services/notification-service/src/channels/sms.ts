/**
 * SMS gateway integration.
 * Supports multiple providers via environment configuration.
 *
 * Supported providers:
 *  - twilio: Twilio SMS API
 *  - msg91: MSG91 (popular in India)
 *  - textlocal: TextLocal (India-focused)
 *  - mock: Development mode (logs to console)
 */

const SMS_PROVIDER = process.env['SMS_PROVIDER'] || 'mock';

// Twilio
const TWILIO_ACCOUNT_SID = process.env['TWILIO_ACCOUNT_SID'] || '';
const TWILIO_AUTH_TOKEN = process.env['TWILIO_AUTH_TOKEN'] || '';
const TWILIO_FROM_NUMBER = process.env['TWILIO_FROM_NUMBER'] || '';

// MSG91
const MSG91_AUTH_KEY = process.env['MSG91_AUTH_KEY'] || '';
const MSG91_SENDER_ID = process.env['MSG91_SENDER_ID'] || 'OSALES';
const MSG91_ROUTE = process.env['MSG91_ROUTE'] || '4'; // transactional

interface SendSMSResult {
  success: boolean;
  message_id: string | null;
  provider: string;
  error: string | null;
}

/**
 * Send an SMS message via the configured provider.
 *
 * @param to - Recipient phone number (Indian format: +91XXXXXXXXXX)
 * @param text - SMS text (max 160 characters for single SMS, 1600 for concatenated)
 */
export async function sendSMS(
  to: string,
  text: string,
): Promise<SendSMSResult> {
  const normalizedTo = normalizePhone(to);

  switch (SMS_PROVIDER) {
    case 'twilio':
      return sendViaTwilio(normalizedTo, text);
    case 'msg91':
      return sendViaMsg91(normalizedTo, text);
    case 'mock':
    default:
      return sendViaMock(normalizedTo, text);
  }
}

/**
 * Send bulk SMS to multiple recipients.
 */
export async function sendBulkSMS(
  recipients: string[],
  text: string,
): Promise<SendSMSResult[]> {
  const results = await Promise.allSettled(
    recipients.map((to) => sendSMS(to, text)),
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      success: false,
      message_id: null,
      provider: SMS_PROVIDER,
      error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
    };
  });
}

/**
 * Send SMS via Twilio API.
 */
async function sendViaTwilio(to: string, text: string): Promise<SendSMSResult> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return {
      success: false,
      message_id: null,
      provider: 'twilio',
      error: 'Twilio credentials not configured',
    };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const body = new URLSearchParams({
      To: to,
      From: TWILIO_FROM_NUMBER,
      Body: text,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await response.json()) as { sid?: string; message?: string; status?: string };

    if (!response.ok) {
      return {
        success: false,
        message_id: null,
        provider: 'twilio',
        error: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      message_id: data.sid || null,
      provider: 'twilio',
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      message_id: null,
      provider: 'twilio',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send SMS via MSG91 API (popular Indian SMS gateway).
 */
async function sendViaMsg91(to: string, text: string): Promise<SendSMSResult> {
  if (!MSG91_AUTH_KEY) {
    return {
      success: false,
      message_id: null,
      provider: 'msg91',
      error: 'MSG91 auth key not configured',
    };
  }

  try {
    const url = 'https://api.msg91.com/api/v5/flow/';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: MSG91_AUTH_KEY,
      },
      body: JSON.stringify({
        sender: MSG91_SENDER_ID,
        route: MSG91_ROUTE,
        country: '91',
        sms: [
          {
            message: text,
            to: [to.replace(/^\+91/, '')],
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await response.json()) as { type?: string; message?: string; request_id?: string };

    if (data.type === 'success') {
      return {
        success: true,
        message_id: data.request_id || null,
        provider: 'msg91',
        error: null,
      };
    }

    return {
      success: false,
      message_id: null,
      provider: 'msg91',
      error: data.message || 'MSG91 API error',
    };
  } catch (error) {
    return {
      success: false,
      message_id: null,
      provider: 'msg91',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Mock SMS sender for development.
 */
async function sendViaMock(to: string, text: string): Promise<SendSMSResult> {
  console.log(`[SMS DEV] To: ${to}\nMessage: ${text}\n`);
  return {
    success: true,
    message_id: `mock-sms-${Date.now()}`,
    provider: 'mock',
    error: null,
  };
}

/**
 * Normalize phone number to E.164 format.
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return `+${cleaned}`;
}
