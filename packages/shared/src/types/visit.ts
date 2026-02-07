export enum VisitStatus {
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  MISSED = 'MISSED',
  CANCELLED = 'CANCELLED',
}

export interface Visit {
  id: string;
  company_id: string;
  rep_id: string;
  store_id: string;
  beat_id: string | null;
  status: VisitStatus;
  checkin_lat: number;
  checkin_lng: number;
  checkin_time: Date;
  checkout_lat: number | null;
  checkout_lng: number | null;
  checkout_time: Date | null;
  duration_minutes: number | null;
  distance_from_store_meters: number;
  notes: string | null;
  photos: string[];
  orders_placed: number;
  order_value: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateVisitInput {
  company_id: string;
  rep_id: string;
  store_id: string;
  beat_id?: string;
  lat: number;
  lng: number;
}

export interface CheckoutVisitInput {
  lat: number;
  lng: number;
  notes?: string;
  photos?: string[];
}

export interface Beat {
  id: string;
  company_id: string;
  rep_id: string;
  name: string;
  day_of_week: number;
  store_ids: string[];
  sequence: number[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateBeatInput {
  company_id: string;
  rep_id: string;
  name: string;
  day_of_week: number;
  store_ids: string[];
  sequence: number[];
}

export interface UpdateBeatInput {
  name?: string;
  day_of_week?: number;
  store_ids?: string[];
  sequence?: number[];
  is_active?: boolean;
}
