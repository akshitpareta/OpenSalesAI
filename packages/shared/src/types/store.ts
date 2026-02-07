export enum StoreChannel {
  GENERAL_TRADE = 'GENERAL_TRADE',
  MODERN_TRADE = 'MODERN_TRADE',
  SUPERMARKET = 'SUPERMARKET',
  CHEMIST = 'CHEMIST',
  PAN_SHOP = 'PAN_SHOP',
  E_COMMERCE = 'E_COMMERCE',
  HORECA = 'HORECA',
  INSTITUTIONAL = 'INSTITUTIONAL',
}

export enum MslTier {
  PLATINUM = 'PLATINUM',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  BRONZE = 'BRONZE',
}

export interface Store {
  id: string;
  company_id: string;
  store_code: string;
  name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  channel: StoreChannel;
  msl_tier: MslTier;
  territory_id: string | null;
  credit_tier: string | null;
  credit_limit: number;
  outstanding_balance: number;
  is_active: boolean;
  last_order_date: Date | null;
  last_visit_date: Date | null;
  avg_order_value: number;
  visit_frequency_days: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateStoreInput {
  company_id: string;
  store_code: string;
  name: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  channel: StoreChannel;
  msl_tier?: MslTier;
  territory_id?: string;
  credit_limit?: number;
}

export interface UpdateStoreInput {
  name?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  channel?: StoreChannel;
  msl_tier?: MslTier;
  territory_id?: string;
  credit_limit?: number;
  is_active?: boolean;
}
