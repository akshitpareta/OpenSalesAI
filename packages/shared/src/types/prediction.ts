export enum PredictionType {
  DEMAND_FORECAST = 'DEMAND_FORECAST',
  STOCKOUT_RISK = 'STOCKOUT_RISK',
  CREDIT_SCORE = 'CREDIT_SCORE',
  ATTRITION_RISK = 'ATTRITION_RISK',
  ROUTE_OPTIMIZATION = 'ROUTE_OPTIMIZATION',
}

export enum CreditTier {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export interface Prediction {
  id: string;
  company_id: string;
  type: PredictionType;
  store_id: string | null;
  product_id: string | null;
  rep_id: string | null;
  prediction_date: Date;
  horizon_days: number;
  value: number;
  confidence: number;
  model_version: string;
  features_used: Record<string, unknown>;
  explanation: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DemandForecastResult {
  store_id: string;
  product_id: string;
  forecast_7d: number;
  forecast_14d: number;
  forecast_30d: number;
  confidence: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  seasonality_factor: number;
}

export interface StockoutPrediction {
  store_id: string;
  product_id: string;
  current_stock: number;
  consumption_rate: number;
  lead_time_days: number;
  stockout_probability: number;
  estimated_stockout_date: Date | null;
  suggested_reorder_qty: number;
}

export interface CreditScoreResult {
  store_id: string;
  credit_tier: CreditTier;
  score: number;
  payment_history_score: number;
  order_consistency_score: number;
  outstanding_ratio: number;
  recommended_credit_limit: number;
}

export interface AttritionPrediction {
  store_id: string;
  churn_probability: number;
  risk_factors: string[];
  days_since_last_order: number;
  order_trend: 'INCREASING' | 'STABLE' | 'DECREASING' | 'INACTIVE';
  recommended_action: string;
}

export interface Incentive {
  id: string;
  company_id: string;
  rep_id: string;
  task_id: string | null;
  type: string;
  points: number;
  description: string;
  earned_at: Date;
  expires_at: Date | null;
  is_redeemed: boolean;
  redeemed_at: Date | null;
  created_at: Date;
}
