/**
 * GPS and geolocation constants.
 */
export const GPS_RADIUS_METERS = 100;
export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Visit validation constants.
 */
export const MIN_VISIT_MINUTES = 5;
export const MAX_VISIT_HOURS = 4;

/**
 * Pagination defaults.
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Order constants.
 */
export const MAX_ORDER_ITEMS = 50;
export const ORDER_NUMBER_PREFIX = 'ORD';
export const MIN_ORDER_CONFIDENCE = 0.8;

/**
 * Task constants.
 */
export const MAX_TASKS_PER_REP_PER_DAY = 25;
export const DEFAULT_TASK_POINTS = 10;
export const TASK_EXPIRY_HOURS = 24;

/**
 * Credit and payment.
 */
export const DEFAULT_CREDIT_LIMIT = 50000;
export const CREDIT_TIERS = {
  A: { min_score: 80, credit_multiplier: 2.0 },
  B: { min_score: 60, credit_multiplier: 1.5 },
  C: { min_score: 40, credit_multiplier: 1.0 },
  D: { min_score: 0, credit_multiplier: 0.5 },
} as const;

/**
 * WhatsApp constants.
 */
export const WHATSAPP_API_VERSION = 'v21.0';
export const WHATSAPP_BASE_URL = 'https://graph.facebook.com';
export const WHATSAPP_MESSAGE_TYPES = ['text', 'audio', 'image', 'interactive', 'button'] as const;

/**
 * AI service endpoints (internal).
 */
export const AI_SERVICE_URL = 'http://localhost:8000';
export const AI_ENDPOINTS = {
  TASK_GENERATE: '/tasks/generate',
  TASK_TODAY: '/tasks',
  ORDER_PARSE: '/orders/parse',
  DEMAND_FORECAST: '/predictions/demand',
  STOCKOUT_PREDICT: '/predictions/stockout',
  AGENT_CHAT: '/agent/chat',
  RAG_QUERY: '/rag/query',
  STT_TRANSCRIBE: '/stt/transcribe',
  VISION_PARSE: '/vision/parse',
} as const;

/**
 * Service ports.
 */
export const SERVICE_PORTS = {
  API_GATEWAY: 3000,
  SFA_SERVICE: 3001,
  EB2B_SERVICE: 3002,
  NOTIFICATION_SERVICE: 3003,
  AI_SERVICE: 8000,
  N8N: 5678,
} as const;

/**
 * Rate limiting defaults.
 */
export const RATE_LIMIT = {
  PUBLIC_MAX: 100,
  PUBLIC_WINDOW_MS: 60_000,
  AUTH_MAX: 500,
  AUTH_WINDOW_MS: 60_000,
  WEBHOOK_MAX: 1000,
  WEBHOOK_WINDOW_MS: 60_000,
} as const;

/**
 * Indian locale constants.
 */
export const CURRENCY_CODE = 'INR';
export const CURRENCY_SYMBOL = '\u20B9';
export const TIMEZONE = 'Asia/Kolkata';
export const LOCALE = 'en-IN';
export const COUNTRY_CODE = '+91';

/**
 * Days of week for beat plans.
 */
export const DAYS_OF_WEEK = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

/**
 * HTTP status codes for consistent usage.
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
