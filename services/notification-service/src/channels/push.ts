/**
 * Push notification service using Firebase Cloud Messaging (FCM).
 *
 * Supports:
 *  - Individual device notifications
 *  - Topic-based notifications
 *  - Data-only notifications (silent)
 */

const FCM_SERVER_KEY = process.env['FCM_SERVER_KEY'] || '';
const FCM_PROJECT_ID = process.env['FCM_PROJECT_ID'] || '';

// FCM v1 API URL
const FCM_V1_URL = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

// Legacy FCM URL (fallback)
const FCM_LEGACY_URL = 'https://fcm.googleapis.com/fcm/send';

interface PushResult {
  success: boolean;
  message_id: string | null;
  error: string | null;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  image_url?: string;
  click_action?: string;
  sound?: string;
  badge?: number;
  channel_id?: string;
}

/**
 * Send a push notification to a specific device.
 *
 * @param deviceToken - FCM device registration token
 * @param title - Notification title
 * @param body - Notification body text
 * @param data - Optional key-value data payload
 */
export async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<PushResult> {
  return sendFCMNotification({
    token: deviceToken,
    notification: { title, body },
    data: data || {},
  });
}

/**
 * Send a push notification with rich options.
 */
export async function sendRichPushNotification(
  deviceToken: string,
  payload: PushPayload,
): Promise<PushResult> {
  return sendFCMNotification({
    token: deviceToken,
    notification: {
      title: payload.title,
      body: payload.body,
      image: payload.image_url,
    },
    data: payload.data || {},
    android: {
      notification: {
        channel_id: payload.channel_id || 'opensalesai_default',
        sound: payload.sound || 'default',
        click_action: payload.click_action,
      },
      priority: 'high' as const,
    },
    apns: {
      payload: {
        aps: {
          sound: payload.sound || 'default',
          badge: payload.badge,
        },
      },
    },
  });
}

/**
 * Send a data-only (silent) push notification.
 * Used for background data sync without showing a visible notification.
 */
export async function sendSilentPush(
  deviceToken: string,
  data: Record<string, string>,
): Promise<PushResult> {
  return sendFCMNotification({
    token: deviceToken,
    data,
    android: {
      priority: 'high' as const,
    },
    apns: {
      payload: {
        aps: {
          'content-available': 1,
        },
      },
      headers: {
        'apns-priority': '5',
      },
    },
  });
}

/**
 * Send a push notification to a topic (e.g., all reps in a territory).
 */
export async function sendTopicNotification(
  topic: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<PushResult> {
  return sendFCMNotification({
    topic,
    notification: { title, body },
    data: data || {},
  });
}

/**
 * Send bulk push notifications to multiple devices.
 */
export async function sendBulkPush(
  deviceTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<PushResult[]> {
  const results = await Promise.allSettled(
    deviceTokens.map((token) => sendPushNotification(token, title, body, data)),
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      success: false,
      message_id: null,
      error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
    };
  });
}

/**
 * Core function to send an FCM notification via the legacy HTTP API.
 * Note: In production, consider using FCM v1 API with OAuth2 service account tokens.
 */
async function sendFCMNotification(
  message: Record<string, unknown>,
): Promise<PushResult> {
  if (!FCM_SERVER_KEY) {
    // Development mode
    console.log('[Push DEV]', JSON.stringify(message, null, 2));
    return {
      success: true,
      message_id: `dev-push-${Date.now()}`,
      error: null,
    };
  }

  try {
    // Use legacy API format
    const payload: Record<string, unknown> = {};

    if (message.token) {
      payload['to'] = message.token;
    } else if (message.topic) {
      payload['to'] = `/topics/${message.topic}`;
    }

    if (message.notification) {
      payload['notification'] = message.notification;
    }

    if (message.data) {
      payload['data'] = message.data;
    }

    if (message.android) {
      const android = message.android as Record<string, unknown>;
      if (android.priority) {
        payload['priority'] = android.priority;
      }
    }

    const response = await fetch(FCM_LEGACY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await response.json()) as {
      success?: number;
      failure?: number;
      message_id?: string;
      results?: Array<{ message_id?: string; error?: string }>;
    };

    if (!response.ok) {
      return {
        success: false,
        message_id: null,
        error: `FCM HTTP ${response.status}`,
      };
    }

    if (data.failure && data.failure > 0 && data.results?.[0]?.error) {
      return {
        success: false,
        message_id: null,
        error: data.results[0].error,
      };
    }

    return {
      success: true,
      message_id: data.results?.[0]?.message_id || data.message_id || null,
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
