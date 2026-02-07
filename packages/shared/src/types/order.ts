export enum OrderSource {
  MANUAL = 'MANUAL',
  WHATSAPP_TEXT = 'WHATSAPP_TEXT',
  WHATSAPP_VOICE = 'WHATSAPP_VOICE',
  WHATSAPP_IMAGE = 'WHATSAPP_IMAGE',
  PWA = 'PWA',
  MOBILE_APP = 'MOBILE_APP',
  VOICE_AGENT = 'VOICE_AGENT',
  PERFECT_BASKET = 'PERFECT_BASKET',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CREDIT = 'CREDIT',
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  sku_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  net_amount: number;
  created_at: Date;
}

export interface Order {
  id: string;
  company_id: string;
  store_id: string;
  rep_id: string | null;
  order_number: string;
  source: OrderSource;
  status: OrderStatus;
  payment_status: PaymentStatus;
  whatsapp_msg_id: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  notes: string | null;
  delivery_date: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  items: OrderItem[];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateOrderInput {
  company_id: string;
  store_id: string;
  rep_id?: string;
  source: OrderSource;
  whatsapp_msg_id?: string;
  notes?: string;
  delivery_date?: Date;
  items: CreateOrderItemInput[];
}

export interface CreateOrderItemInput {
  product_id: string;
  quantity: number;
  discount_percent?: number;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  payment_status?: PaymentStatus;
  delivery_date?: Date;
  delivered_at?: Date;
  cancelled_at?: Date;
  cancellation_reason?: string;
  notes?: string;
}

export interface ParsedOrderItem {
  product_name: string;
  quantity: number;
  unit: string | null;
  confidence: number;
  matched_product_id: string | null;
  matched_sku_code: string | null;
}

export interface OrderParseResult {
  items: ParsedOrderItem[];
  raw_text: string;
  language_detected: string;
  parse_confidence: number;
}
