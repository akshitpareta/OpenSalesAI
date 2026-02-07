export enum SkillTier {
  TRAINEE = 'TRAINEE',
  JUNIOR = 'JUNIOR',
  INTERMEDIATE = 'INTERMEDIATE',
  SENIOR = 'SENIOR',
  EXPERT = 'EXPERT',
}

export enum RepRole {
  SALES_REP = 'SALES_REP',
  TEAM_LEAD = 'TEAM_LEAD',
  AREA_MANAGER = 'AREA_MANAGER',
  REGIONAL_MANAGER = 'REGIONAL_MANAGER',
}

export interface Rep {
  id: string;
  company_id: string;
  employee_code: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  role: RepRole;
  skill_tier: SkillTier;
  territory_id: string | null;
  manager_id: string | null;
  points_balance: number;
  total_points_earned: number;
  is_active: boolean;
  last_active_at: Date | null;
  device_token: string | null;
  current_lat: number | null;
  current_lng: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateRepInput {
  company_id: string;
  employee_code: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  role?: RepRole;
  skill_tier?: SkillTier;
  territory_id?: string;
  manager_id?: string;
}

export interface UpdateRepInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: RepRole;
  skill_tier?: SkillTier;
  territory_id?: string;
  manager_id?: string;
  is_active?: boolean;
  device_token?: string;
  current_lat?: number;
  current_lng?: number;
}

export interface RepDashboard {
  rep_id: string;
  rep_name: string;
  tasks_completed: number;
  tasks_pending: number;
  tasks_total: number;
  task_completion_rate: number;
  orders_placed_today: number;
  orders_placed_month: number;
  revenue_today: number;
  revenue_month: number;
  points_balance: number;
  stores_visited_today: number;
  stores_assigned: number;
  coverage_rate: number;
  avg_visit_duration_minutes: number;
}
