import type { Product, Order, OrderItem } from '@opensalesai/shared';
import {
  ProductCategory,
  ProductUnit,
  OrderSource,
  OrderStatus,
  PaymentStatus,
} from '@opensalesai/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_ID = 'c0000000-0000-0000-0000-000000000001';
const STORE_ID = 'sto-0000-0000-0000-000000000001';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function uid(prefix: string, index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `${prefix}-0000-0000-0000-${hex}`;
}

// ---------------------------------------------------------------------------
// Products (Indian CPG brands)
// ---------------------------------------------------------------------------

export const mockProducts: Product[] = [
  {
    id: uid('prd', 1), company_id: COMPANY_ID, sku_code: 'BEV-CC-300', name: 'Coca-Cola 300ml',
    description: 'Coca-Cola Classic carbonated drink 300ml PET bottle', category: ProductCategory.BEVERAGES,
    sub_category: 'Carbonated Drinks', brand: 'Coca-Cola', unit: ProductUnit.CASES, units_per_case: 24,
    mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 300,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 50,
    current_stock: 480, reorder_level: 100, lead_time_days: 2,
    created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null,
  },
  {
    id: uid('prd', 2), company_id: COMPANY_ID, sku_code: 'BEV-TU-250', name: 'Thums Up 250ml',
    description: 'Thums Up strong carbonated drink 250ml', category: ProductCategory.BEVERAGES,
    sub_category: 'Carbonated Drinks', brand: 'Thums Up', unit: ProductUnit.CASES, units_per_case: 24,
    mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 250,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 50,
    current_stock: 360, reorder_level: 80, lead_time_days: 2,
    created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null,
  },
  {
    id: uid('prd', 3), company_id: COMPANY_ID, sku_code: 'SNK-MG-70', name: 'Maggi 2-Minute Noodles 70g',
    description: 'Maggi masala instant noodles 70g single pack', category: ProductCategory.SNACKS,
    sub_category: 'Instant Noodles', brand: 'Maggi', unit: ProductUnit.DOZENS, units_per_case: 12,
    mrp: 14, selling_price: 12, retailer_margin: 14.3, distributor_margin: 7, weight_grams: 70,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 100,
    current_stock: 1200, reorder_level: 200, lead_time_days: 3,
    created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null,
  },
  {
    id: uid('prd', 4), company_id: COMPANY_ID, sku_code: 'SNK-LY-52', name: 'Lays Classic Salted 52g',
    description: 'Lays classic salted potato chips 52g', category: ProductCategory.SNACKS,
    sub_category: 'Chips', brand: 'Lays', unit: ProductUnit.DOZENS, units_per_case: 12,
    mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 52,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 80,
    current_stock: 960, reorder_level: 150, lead_time_days: 3,
    created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null,
  },
  {
    id: uid('prd', 5), company_id: COMPANY_ID, sku_code: 'SNK-PG-82', name: 'Parle-G Glucose Biscuit 82g',
    description: 'Parle-G original glucose biscuit 82g', category: ProductCategory.SNACKS,
    sub_category: 'Biscuits', brand: 'Parle', unit: ProductUnit.DOZENS, units_per_case: 12,
    mrp: 10, selling_price: 8.5, retailer_margin: 15, distributor_margin: 7, weight_grams: 82,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 200,
    current_stock: 2400, reorder_level: 400, lead_time_days: 2,
    created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null,
  },
  {
    id: uid('prd', 6), company_id: COMPANY_ID, sku_code: 'DRY-AM-500', name: 'Amul Taaza Milk 500ml',
    description: 'Amul Taaza toned milk 500ml tetra pack', category: ProductCategory.DAIRY,
    sub_category: 'Milk', brand: 'Amul', unit: ProductUnit.CASES, units_per_case: 12,
    mrp: 27, selling_price: 24, retailer_margin: 11, distributor_margin: 5, weight_grams: 500,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 30,
    current_stock: 180, reorder_level: 50, lead_time_days: 1,
    created_at: daysAgo(365), updated_at: daysAgo(1), deleted_at: null,
  },
  {
    id: uid('prd', 7), company_id: COMPANY_ID, sku_code: 'DRY-AB-100', name: 'Amul Butter 100g',
    description: 'Amul pasteurized butter 100g', category: ProductCategory.DAIRY,
    sub_category: 'Butter', brand: 'Amul', unit: ProductUnit.DOZENS, units_per_case: 12,
    mrp: 56, selling_price: 50, retailer_margin: 10.7, distributor_margin: 5, weight_grams: 100,
    image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 50,
    current_stock: 240, reorder_level: 60, lead_time_days: 1,
    created_at: daysAgo(300), updated_at: daysAgo(2), deleted_at: null,
  },
  {
    id: uid('prd', 8), company_id: COMPANY_ID, sku_code: 'PC-SE-1K', name: 'Surf Excel Easy Wash 1kg',
    description: 'Surf Excel Easy Wash detergent powder 1kg', category: ProductCategory.HOME_CARE,
    sub_category: 'Detergent', brand: 'Surf Excel', unit: ProductUnit.PIECES, units_per_case: 1,
    mrp: 270, selling_price: 240, retailer_margin: 11, distributor_margin: 6, weight_grams: 1000,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 20,
    current_stock: 80, reorder_level: 20, lead_time_days: 3,
    created_at: daysAgo(365), updated_at: daysAgo(3), deleted_at: null,
  },
  {
    id: uid('prd', 9), company_id: COMPANY_ID, sku_code: 'PC-CP-175', name: 'Clinic Plus Shampoo 175ml',
    description: 'Clinic Plus strong & long shampoo 175ml', category: ProductCategory.PERSONAL_CARE,
    sub_category: 'Shampoo', brand: 'Clinic Plus', unit: ProductUnit.PIECES, units_per_case: 1,
    mrp: 180, selling_price: 160, retailer_margin: 11, distributor_margin: 6, weight_grams: 175,
    image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 30,
    current_stock: 120, reorder_level: 30, lead_time_days: 3,
    created_at: daysAgo(300), updated_at: daysAgo(4), deleted_at: null,
  },
  {
    id: uid('prd', 10), company_id: COMPANY_ID, sku_code: 'BEV-LM-250', name: 'Limca 250ml',
    description: 'Limca lemon lime sparkling drink 250ml', category: ProductCategory.BEVERAGES,
    sub_category: 'Carbonated Drinks', brand: 'Limca', unit: ProductUnit.CASES, units_per_case: 24,
    mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 250,
    image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 50,
    current_stock: 240, reorder_level: 60, lead_time_days: 2,
    created_at: daysAgo(300), updated_at: daysAgo(2), deleted_at: null,
  },
  {
    id: uid('prd', 11), company_id: COMPANY_ID, sku_code: 'SNK-KK-150', name: 'Kurkure Masala Munch 94g',
    description: 'Kurkure masala munch puffed corn snack 94g', category: ProductCategory.SNACKS,
    sub_category: 'Puffed Snacks', brand: 'Kurkure', unit: ProductUnit.DOZENS, units_per_case: 12,
    mrp: 20, selling_price: 17, retailer_margin: 15, distributor_margin: 8, weight_grams: 94,
    image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 60,
    current_stock: 600, reorder_level: 100, lead_time_days: 3,
    created_at: daysAgo(250), updated_at: daysAgo(2), deleted_at: null,
  },
  {
    id: uid('prd', 12), company_id: COMPANY_ID, sku_code: 'PF-MTR-300', name: 'MTR Ready Meals Poha 300g',
    description: 'MTR ready-to-eat poha 300g', category: ProductCategory.PACKAGED_FOOD,
    sub_category: 'Ready Meals', brand: 'MTR', unit: ProductUnit.PIECES, units_per_case: 1,
    mrp: 80, selling_price: 70, retailer_margin: 12.5, distributor_margin: 6, weight_grams: 300,
    image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 40,
    current_stock: 160, reorder_level: 30, lead_time_days: 4,
    created_at: daysAgo(200), updated_at: daysAgo(5), deleted_at: null,
  },
  {
    id: uid('prd', 13), company_id: COMPANY_ID, sku_code: 'CNF-CD-44', name: 'Cadbury Dairy Milk 44g',
    description: 'Cadbury Dairy Milk chocolate bar 44g', category: ProductCategory.CONFECTIONERY,
    sub_category: 'Chocolate', brand: 'Cadbury', unit: ProductUnit.DOZENS, units_per_case: 12,
    mrp: 40, selling_price: 35, retailer_margin: 12.5, distributor_margin: 6, weight_grams: 44,
    image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 50,
    current_stock: 360, reorder_level: 60, lead_time_days: 3,
    created_at: daysAgo(300), updated_at: daysAgo(3), deleted_at: null,
  },
  {
    id: uid('prd', 14), company_id: COMPANY_ID, sku_code: 'HC-VIM-500', name: 'Vim Dishwash Bar 500g',
    description: 'Vim dishwash bar lemon 500g', category: ProductCategory.HOME_CARE,
    sub_category: 'Dishwash', brand: 'Vim', unit: ProductUnit.PIECES, units_per_case: 1,
    mrp: 48, selling_price: 42, retailer_margin: 12.5, distributor_margin: 6, weight_grams: 500,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 50,
    current_stock: 200, reorder_level: 40, lead_time_days: 3,
    created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null,
  },
  {
    id: uid('prd', 15), company_id: COMPANY_ID, sku_code: 'BEV-FS-200', name: 'Frooti Mango 200ml',
    description: 'Frooti mango drink 200ml tetra pack', category: ProductCategory.BEVERAGES,
    sub_category: 'Juices', brand: 'Frooti', unit: ProductUnit.CASES, units_per_case: 27,
    mrp: 10, selling_price: 8.5, retailer_margin: 15, distributor_margin: 8, weight_grams: 200,
    image_url: null, is_active: true, is_msl: false, min_order_qty: 1, max_order_qty: 60,
    current_stock: 540, reorder_level: 100, lead_time_days: 2,
    created_at: daysAgo(250), updated_at: daysAgo(1), deleted_at: null,
  },
  {
    id: uid('prd', 16), company_id: COMPANY_ID, sku_code: 'PC-LX-75', name: 'Lux Soft Glow Soap 75g',
    description: 'Lux soft glow beauty soap 75g', category: ProductCategory.PERSONAL_CARE,
    sub_category: 'Soap', brand: 'Lux', unit: ProductUnit.DOZENS, units_per_case: 12,
    mrp: 35, selling_price: 30, retailer_margin: 14.3, distributor_margin: 6, weight_grams: 75,
    image_url: null, is_active: true, is_msl: true, min_order_qty: 1, max_order_qty: 60,
    current_stock: 480, reorder_level: 80, lead_time_days: 3,
    created_at: daysAgo(365), updated_at: daysAgo(2), deleted_at: null,
  },
];

// ---------------------------------------------------------------------------
// Perfect Basket recommendations (AI-generated suggestions for this store)
// ---------------------------------------------------------------------------

export interface PerfectBasketItem {
  product: Product;
  recommended_qty: number;
  reason: string;
  confidence: number;
  estimated_margin: number;
}

export const mockPerfectBasket: PerfectBasketItem[] = [
  {
    product: mockProducts[0],
    recommended_qty: 5,
    reason: 'Your best-selling beverage. Based on recent sales velocity, 5 cases will cover demand for the next 7 days.',
    confidence: 0.95,
    estimated_margin: 1275,
  },
  {
    product: mockProducts[2],
    recommended_qty: 8,
    reason: 'High demand item - your stock is predicted to run out in 3 days at current rate.',
    confidence: 0.92,
    estimated_margin: 1372,
  },
  {
    product: mockProducts[3],
    recommended_qty: 4,
    reason: 'Trending snack in your area. Similar stores order 4-6 dozen per week.',
    confidence: 0.88,
    estimated_margin: 1020,
  },
  {
    product: mockProducts[5],
    recommended_qty: 3,
    reason: 'Daily essential with consistent demand. 3 cases covers your typical weekly sales.',
    confidence: 0.94,
    estimated_margin: 792,
  },
  {
    product: mockProducts[4],
    recommended_qty: 10,
    reason: 'Top-selling biscuit brand in your territory. High volume, reliable margin.',
    confidence: 0.91,
    estimated_margin: 1275,
  },
  {
    product: mockProducts[12],
    recommended_qty: 3,
    reason: 'Impulse purchase item. Stores near you that stock this SKU see 8% higher basket value.',
    confidence: 0.78,
    estimated_margin: 450,
  },
];

// ---------------------------------------------------------------------------
// Order history for this retailer
// ---------------------------------------------------------------------------

const orderStatuses: OrderStatus[] = [
  OrderStatus.DELIVERED, OrderStatus.DELIVERED, OrderStatus.PROCESSING,
  OrderStatus.CONFIRMED, OrderStatus.DISPATCHED, OrderStatus.DELIVERED,
  OrderStatus.PENDING, OrderStatus.DELIVERED,
];

export const mockOrderHistory: Order[] = Array.from({ length: 8 }, (_, i) => {
  const status = orderStatuses[i];
  const itemCount = 2 + (i % 3);

  const items: OrderItem[] = Array.from({ length: itemCount }, (_, j) => {
    const prod = mockProducts[(i * 3 + j) % mockProducts.length];
    const qty = 1 + ((i + j) % 5);
    const unitPrice = prod.selling_price;
    const totalPrice = unitPrice * qty;
    const discountPct = j === 0 ? 5 : 0;
    const discountAmt = Math.round(totalPrice * discountPct / 100);
    const taxPct = 18;
    const taxAmt = Math.round((totalPrice - discountAmt) * taxPct / 100);
    const netAmt = totalPrice - discountAmt + taxAmt;

    return {
      id: uid('oit', i * 10 + j + 1),
      order_id: uid('rord', i + 1),
      product_id: prod.id,
      product_name: prod.name,
      sku_code: prod.sku_code,
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice,
      discount_percent: discountPct,
      discount_amount: discountAmt,
      tax_percent: taxPct,
      tax_amount: taxAmt,
      net_amount: netAmt,
      created_at: daysAgo(i * 3),
    };
  });

  const subtotal = items.reduce((s, it) => s + it.total_price, 0);
  const discountTotal = items.reduce((s, it) => s + it.discount_amount, 0);
  const taxTotal = items.reduce((s, it) => s + it.tax_amount, 0);
  const grandTotal = subtotal - discountTotal + taxTotal;

  const sources: OrderSource[] = [
    OrderSource.WHATSAPP_TEXT, OrderSource.PWA, OrderSource.MANUAL,
    OrderSource.PERFECT_BASKET, OrderSource.PWA, OrderSource.WHATSAPP_VOICE,
    OrderSource.PWA, OrderSource.MANUAL,
  ];

  return {
    id: uid('rord', i + 1),
    company_id: COMPANY_ID,
    store_id: STORE_ID,
    rep_id: null,
    order_number: `ORD-2026-${String(2000 + i).padStart(5, '0')}`,
    source: sources[i],
    status,
    payment_status: status === OrderStatus.DELIVERED ? PaymentStatus.PAID : PaymentStatus.UNPAID,
    whatsapp_msg_id: sources[i].startsWith('WHATSAPP') ? `wamid.ret${i}abc` : null,
    subtotal,
    discount_total: discountTotal,
    tax_total: taxTotal,
    grand_total: grandTotal,
    notes: null,
    delivery_date: daysAgo(i * 3 > 2 ? i * 3 - 2 : -1),
    delivered_at: status === OrderStatus.DELIVERED ? daysAgo(i * 3 - 1) : null,
    cancelled_at: null,
    cancellation_reason: null,
    items,
    created_at: daysAgo(i * 3),
    updated_at: daysAgo(Math.max(i * 3 - 1, 0)),
    deleted_at: null,
  };
});
