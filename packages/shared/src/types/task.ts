export enum TaskType {
  VISIT = 'VISIT',
  ORDER = 'ORDER',
  COLLECTION = 'COLLECTION',
  MERCHANDISING = 'MERCHANDISING',
  SURVEY = 'SURVEY',
  PROMOTION = 'PROMOTION',
  NEW_OUTLET = 'NEW_OUTLET',
  COACHING = 'COACHING',
  STOCK_CHECK = 'STOCK_CHECK',
  RELATIONSHIP = 'RELATIONSHIP',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum TaskPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum TaskSource {
  AI_GENERATED = 'AI_GENERATED',
  MANAGER_ASSIGNED = 'MANAGER_ASSIGNED',
  SYSTEM_RULE = 'SYSTEM_RULE',
  SELF_CREATED = 'SELF_CREATED',
}

export interface Task {
  id: string;
  company_id: string;
  rep_id: string;
  store_id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  title: string;
  description: string | null;
  ai_reasoning: string | null;
  action_data: Record<string, unknown> | null;
  priority_score: number;
  estimated_impact: number | null;
  points_reward: number;
  scheduled_date: Date;
  due_date: Date;
  started_at: Date | null;
  completed_at: Date | null;
  completion_notes: string | null;
  visit_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateTaskInput {
  company_id: string;
  rep_id: string;
  store_id: string;
  type: TaskType;
  priority: TaskPriority;
  source: TaskSource;
  title: string;
  description?: string;
  ai_reasoning?: string;
  action_data?: Record<string, unknown>;
  priority_score: number;
  estimated_impact?: number;
  points_reward?: number;
  scheduled_date: Date;
  due_date: Date;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  started_at?: Date;
  completed_at?: Date;
  completion_notes?: string;
  visit_id?: string;
}
