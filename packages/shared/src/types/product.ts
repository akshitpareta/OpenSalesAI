export enum ProductCategory {
  BEVERAGES = 'BEVERAGES',
  SNACKS = 'SNACKS',
  DAIRY = 'DAIRY',
  PERSONAL_CARE = 'PERSONAL_CARE',
  HOME_CARE = 'HOME_CARE',
  PACKAGED_FOOD = 'PACKAGED_FOOD',
  CONFECTIONERY = 'CONFECTIONERY',
  FROZEN = 'FROZEN',
  HEALTH = 'HEALTH',
  OTHER = 'OTHER',
}

export enum ProductUnit {
  PIECES = 'PIECES',
  CASES = 'CASES',
  DOZENS = 'DOZENS',
  KG = 'KG',
  LITERS = 'LITERS',
  PACKS = 'PACKS',
}

export interface Product {
  id: string;
  company_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  sub_category: string | null;
  brand: string;
  unit: ProductUnit;
  units_per_case: number;
  mrp: number;
  selling_price: number;
  retailer_margin: number;
  distributor_margin: number;
  weight_grams: number | null;
  image_url: string | null;
  is_active: boolean;
  is_msl: boolean;
  min_order_qty: number;
  max_order_qty: number;
  current_stock: number;
  reorder_level: number;
  lead_time_days: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateProductInput {
  company_id: string;
  sku_code: string;
  name: string;
  description?: string;
  category: ProductCategory;
  sub_category?: string;
  brand: string;
  unit: ProductUnit;
  units_per_case: number;
  mrp: number;
  selling_price: number;
  retailer_margin: number;
  distributor_margin?: number;
  weight_grams?: number;
  image_url?: string;
  is_msl?: boolean;
  min_order_qty?: number;
  max_order_qty?: number;
  current_stock?: number;
  reorder_level?: number;
  lead_time_days?: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: ProductCategory;
  sub_category?: string;
  brand?: string;
  unit?: ProductUnit;
  units_per_case?: number;
  mrp?: number;
  selling_price?: number;
  retailer_margin?: number;
  distributor_margin?: number;
  weight_grams?: number;
  image_url?: string;
  is_active?: boolean;
  is_msl?: boolean;
  min_order_qty?: number;
  max_order_qty?: number;
  current_stock?: number;
  reorder_level?: number;
  lead_time_days?: number;
}
