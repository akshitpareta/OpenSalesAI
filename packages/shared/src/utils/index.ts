import { EARTH_RADIUS_METERS, CURRENCY_CODE, LOCALE, TIMEZONE } from '../constants/index';

/**
 * Calculate the Haversine distance between two GPS coordinates.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRadians = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Format a number as Indian Rupees currency string.
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY_CODE,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Convert a Date to IST timezone string.
 */
export function toIST(date: Date): string {
  return date.toLocaleString(LOCALE, { timeZone: TIMEZONE });
}

/**
 * Get a Date object representing the current time in IST.
 */
export function nowIST(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: TIMEZONE }),
  );
}

/**
 * Get the start of today in IST as a UTC Date.
 */
export function todayStartIST(): Date {
  const ist = nowIST();
  ist.setHours(0, 0, 0, 0);
  return ist;
}

/**
 * Get the end of today in IST as a UTC Date.
 */
export function todayEndIST(): Date {
  const ist = nowIST();
  ist.setHours(23, 59, 59, 999);
  return ist;
}

/**
 * Generate a sequential order number with prefix.
 * Format: ORD-YYYYMMDD-XXXXX
 */
export function generateOrderNumber(sequenceNumber: number): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seqPart = String(sequenceNumber).padStart(5, '0');
  return `ORD-${datePart}-${seqPart}`;
}

/**
 * Validate an Indian phone number.
 * Accepts formats: +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX
 */
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-()]/g, '');
  return /^(\+?91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Normalize an Indian phone number to +91XXXXXXXXXX format.
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-()]/g, '');
  const match = cleaned.match(/^(\+?91)?([6-9]\d{9})$/);
  if (!match) {
    throw new Error(`Invalid Indian phone number: ${phone}`);
  }
  return `+91${match[2]}`;
}

/**
 * Calculate the difference between two dates in minutes.
 */
export function diffMinutes(start: Date, end: Date): number {
  return Math.abs(end.getTime() - start.getTime()) / (1000 * 60);
}

/**
 * Mask PII data for logging and LLM calls.
 * Replaces phone numbers and email-like patterns.
 */
export function maskPII(text: string): string {
  let masked = text;
  // Mask phone numbers
  masked = masked.replace(/(\+?91)?[6-9]\d{9}/g, (match) => {
    return match.slice(0, -4).replace(/\d/g, 'X') + match.slice(-4);
  });
  // Mask emails
  masked = masked.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (_, local: string) => {
      const maskedLocal = local.slice(0, 2) + '***';
      return `${maskedLocal}@***.***`;
    },
  );
  return masked;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a correlation ID for request tracing across services.
 */
export function createCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Safely parse a JSON string, returning null on failure.
 */
export function safeParseJSON<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Clamp a number between min and max values.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Build pagination metadata from total count, page, and limit.
 */
export function buildPagination(total: number, page: number, limit: number) {
  const total_pages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}
