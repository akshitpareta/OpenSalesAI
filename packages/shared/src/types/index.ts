export * from './store';
export * from './product';
export * from './rep';
export * from './task';
export * from './order';
export * from './visit';
export * from './prediction';

/**
 * Common API response types used across all services.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
  services?: Record<string, {
    status: 'ok' | 'error';
    latency_ms?: number;
  }>;
}

/**
 * Auth context extracted from JWT tokens.
 */
export interface AuthContext {
  user_id: string;
  tenant_id: string;
  company_id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Common query filter types.
 */
export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * WhatsApp webhook types.
 */
export interface WhatsAppMessage {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages: Array<{
    from: string;
    id: string;
    timestamp: string;
    type: 'text' | 'audio' | 'image' | 'interactive' | 'button';
    text?: { body: string };
    audio?: { id: string; mime_type: string };
    image?: { id: string; mime_type: string; caption?: string };
    interactive?: {
      type: string;
      button_reply?: { id: string; title: string };
      list_reply?: { id: string; title: string; description: string };
    };
  }>;
}

/**
 * Notification types.
 */
export interface NotificationPayload {
  to: string;
  channel: 'whatsapp' | 'sms' | 'push';
  template_name?: string;
  template_params?: Record<string, string>;
  text?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  device_token?: string;
}

export interface BulkNotificationPayload {
  recipients: string[];
  channel: 'whatsapp' | 'sms' | 'push';
  template_name?: string;
  template_params?: Record<string, string>;
  text?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Cart types for eB2B.
 */
export interface CartItem {
  product_id: string;
  product_name: string;
  sku_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url: string | null;
}

export interface Cart {
  store_id: string;
  company_id: string;
  items: CartItem[];
  subtotal: number;
  item_count: number;
  updated_at: Date;
}
