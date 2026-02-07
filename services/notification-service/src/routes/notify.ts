import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HTTP_STATUS } from '@opensalesai/shared';
import {
  sendTemplate,
  sendTextMessage,
  sendInteractiveMessage,
} from '../channels/whatsapp.js';
import { sendSMS, sendBulkSMS } from '../channels/sms.js';
import {
  sendPushNotification,
  sendBulkPush,
  sendTopicNotification,
} from '../channels/push.js';

// ---- Zod Schemas ----

const WhatsAppNotifySchema = z.object({
  to: z.string().min(10, 'Phone number is required'),
  type: z.enum(['template', 'text', 'interactive']).default('text'),
  template_name: z.string().optional(),
  template_params: z.record(z.string()).optional(),
  language_code: z.string().default('en'),
  text: z.string().max(4096).optional(),
  body: z.string().max(1024).optional(),
  buttons: z
    .array(z.object({
      id: z.string(),
      title: z.string().max(20),
    }))
    .max(3)
    .optional(),
  header: z.string().max(60).optional(),
  footer: z.string().max(60).optional(),
});

const SMSNotifySchema = z.object({
  to: z.string().min(10, 'Phone number is required'),
  text: z.string().min(1).max(1600, 'SMS text too long'),
});

const PushNotifySchema = z.object({
  device_token: z.string().min(1, 'Device token is required'),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  data: z.record(z.string()).optional(),
  topic: z.string().optional(),
});

const BulkNotifySchema = z.object({
  channel: z.enum(['whatsapp', 'sms', 'push']),
  recipients: z.array(z.string()).min(1).max(1000, 'Maximum 1000 recipients per bulk send'),
  // For WhatsApp
  template_name: z.string().optional(),
  template_params: z.record(z.string()).optional(),
  // For SMS and WhatsApp text
  text: z.string().max(4096).optional(),
  // For push
  title: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
  data: z.record(z.string()).optional(),
});

const notifyRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /notify/whatsapp
   * Send a WhatsApp message (template, text, or interactive).
   */
  fastify.post('/notify/whatsapp', {
    schema: {
      description: 'Send a WhatsApp message',
      tags: ['Notifications'],
      body: {
        type: 'object',
        required: ['to'],
        properties: {
          to: { type: 'string' },
          type: { type: 'string', enum: ['template', 'text', 'interactive'] },
          template_name: { type: 'string' },
          template_params: { type: 'object' },
          language_code: { type: 'string' },
          text: { type: 'string' },
          body: { type: 'string' },
          buttons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
          },
          header: { type: 'string' },
          footer: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = WhatsAppNotifySchema.parse(request.body);

    let result;

    switch (body.type) {
      case 'template': {
        if (!body.template_name) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            error: {
              code: 'MISSING_TEMPLATE',
              message: 'template_name is required for template messages',
            },
            timestamp: new Date().toISOString(),
          });
        }
        result = await sendTemplate(
          body.to,
          body.template_name,
          body.template_params || {},
          body.language_code,
        );
        break;
      }

      case 'text': {
        if (!body.text) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            error: {
              code: 'MISSING_TEXT',
              message: 'text is required for text messages',
            },
            timestamp: new Date().toISOString(),
          });
        }
        result = await sendTextMessage(body.to, body.text);
        break;
      }

      case 'interactive': {
        if (!body.body || !body.buttons || body.buttons.length === 0) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            error: {
              code: 'MISSING_INTERACTIVE_DATA',
              message: 'body and buttons are required for interactive messages',
            },
            timestamp: new Date().toISOString(),
          });
        }
        result = await sendInteractiveMessage(
          body.to,
          body.body,
          body.buttons,
          body.header,
          body.footer,
        );
        break;
      }
    }

    if (result.success) {
      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: {
          channel: 'whatsapp',
          to: body.to,
          message_id: result.message_id,
        },
        message: 'WhatsApp message sent successfully',
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(HTTP_STATUS.INTERNAL_ERROR).send({
      success: false,
      error: {
        code: 'WHATSAPP_SEND_FAILED',
        message: result.error || 'Failed to send WhatsApp message',
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /notify/sms
   * Send an SMS message.
   */
  fastify.post('/notify/sms', {
    schema: {
      description: 'Send an SMS message',
      tags: ['Notifications'],
      body: {
        type: 'object',
        required: ['to', 'text'],
        properties: {
          to: { type: 'string' },
          text: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = SMSNotifySchema.parse(request.body);

    const result = await sendSMS(body.to, body.text);

    if (result.success) {
      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: {
          channel: 'sms',
          to: body.to,
          message_id: result.message_id,
          provider: result.provider,
        },
        message: 'SMS sent successfully',
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(HTTP_STATUS.INTERNAL_ERROR).send({
      success: false,
      error: {
        code: 'SMS_SEND_FAILED',
        message: result.error || 'Failed to send SMS',
        details: { provider: result.provider },
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /notify/push
   * Send a push notification.
   */
  fastify.post('/notify/push', {
    schema: {
      description: 'Send a push notification',
      tags: ['Notifications'],
      body: {
        type: 'object',
        required: ['title', 'body'],
        properties: {
          device_token: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          data: { type: 'object' },
          topic: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = PushNotifySchema.parse(request.body);

    let result;

    if (body.topic) {
      result = await sendTopicNotification(
        body.topic,
        body.title,
        body.body,
        body.data,
      );
    } else {
      if (!body.device_token) {
        return reply.status(HTTP_STATUS.BAD_REQUEST).send({
          success: false,
          error: {
            code: 'MISSING_TARGET',
            message: 'Either device_token or topic is required',
          },
          timestamp: new Date().toISOString(),
        });
      }
      result = await sendPushNotification(
        body.device_token,
        body.title,
        body.body,
        body.data,
      );
    }

    if (result.success) {
      return reply.status(HTTP_STATUS.OK).send({
        success: true,
        data: {
          channel: 'push',
          message_id: result.message_id,
        },
        message: 'Push notification sent successfully',
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(HTTP_STATUS.INTERNAL_ERROR).send({
      success: false,
      error: {
        code: 'PUSH_SEND_FAILED',
        message: result.error || 'Failed to send push notification',
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /notify/bulk
   * Send notifications to multiple recipients.
   * Supports WhatsApp, SMS, and Push channels.
   */
  fastify.post('/notify/bulk', {
    schema: {
      description: 'Send bulk notifications',
      tags: ['Notifications'],
      body: {
        type: 'object',
        required: ['channel', 'recipients'],
        properties: {
          channel: { type: 'string', enum: ['whatsapp', 'sms', 'push'] },
          recipients: { type: 'array', items: { type: 'string' } },
          template_name: { type: 'string' },
          template_params: { type: 'object' },
          text: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          data: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const body = BulkNotifySchema.parse(request.body);

    const results: Array<{ recipient: string; success: boolean; error: string | null }> = [];

    switch (body.channel) {
      case 'whatsapp': {
        const text = body.text || '';
        if (!text && !body.template_name) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            error: {
              code: 'MISSING_CONTENT',
              message: 'text or template_name is required for WhatsApp bulk send',
            },
            timestamp: new Date().toISOString(),
          });
        }

        for (const recipient of body.recipients) {
          let result;
          if (body.template_name) {
            result = await sendTemplate(
              recipient,
              body.template_name,
              body.template_params || {},
            );
          } else {
            result = await sendTextMessage(recipient, text);
          }
          results.push({
            recipient,
            success: result.success,
            error: result.error,
          });
        }
        break;
      }

      case 'sms': {
        if (!body.text) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            error: {
              code: 'MISSING_TEXT',
              message: 'text is required for SMS bulk send',
            },
            timestamp: new Date().toISOString(),
          });
        }

        const smsResults = await sendBulkSMS(body.recipients, body.text);
        for (let i = 0; i < body.recipients.length; i++) {
          results.push({
            recipient: body.recipients[i],
            success: smsResults[i]?.success || false,
            error: smsResults[i]?.error || null,
          });
        }
        break;
      }

      case 'push': {
        if (!body.title || !body.body) {
          return reply.status(HTTP_STATUS.BAD_REQUEST).send({
            success: false,
            error: {
              code: 'MISSING_CONTENT',
              message: 'title and body are required for push bulk send',
            },
            timestamp: new Date().toISOString(),
          });
        }

        const pushResults = await sendBulkPush(
          body.recipients,
          body.title,
          body.body,
          body.data,
        );
        for (let i = 0; i < body.recipients.length; i++) {
          results.push({
            recipient: body.recipients[i],
            success: pushResults[i]?.success || false,
            error: pushResults[i]?.error || null,
          });
        }
        break;
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return reply.status(HTTP_STATUS.OK).send({
      success: true,
      data: {
        channel: body.channel,
        total: body.recipients.length,
        success_count: successCount,
        failure_count: failureCount,
        results,
      },
      message: `Bulk ${body.channel} sent: ${successCount} succeeded, ${failureCount} failed`,
      timestamp: new Date().toISOString(),
    });
  });
};

export default notifyRoutes;
