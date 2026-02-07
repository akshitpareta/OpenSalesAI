'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Rep, RepDashboard, Task } from '@opensalesai/shared';
import { Badge } from '@opensalesai/ui';
import { KPICard } from '@/components/KPICard';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { cn, formatINR, formatRelativeTime, getInitials, stringToColor } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Inline mock data                                                  */
/* ------------------------------------------------------------------ */

const mockReps: Rep[] = [
  {
    id: 'rep_001',
    company_id: 'comp_001',
    employee_code: 'EMP-1001',
    user_id: 'usr_r01',
    name: 'Amit Sharma',
    email: 'amit.sharma@opensalesai.com',
    phone: '+91 98765 43210',
    role: 'SALES_REP' as Rep['role'],
    skill_tier: 'SENIOR' as Rep['skill_tier'],
    territory_id: 'ter_mumbai_west',
    manager_id: 'rep_010',
    points_balance: 1240,
    total_points_earned: 8750,
    is_active: true,
    last_active_at: new Date('2026-02-06T09:30:00+05:30'),
    device_token: null,
    current_lat: 19.076,
    current_lng: 72.8777,
    created_at: new Date('2025-03-15'),
    updated_at: new Date('2026-02-06'),
    deleted_at: null,
  },
  {
    id: 'rep_002',
    company_id: 'comp_001',
    employee_code: 'EMP-1002',
    user_id: 'usr_r02',
    name: 'Priya Patel',
    email: 'priya.patel@opensalesai.com',
    phone: '+91 87654 32109',
    role: 'SALES_REP' as Rep['role'],
    skill_tier: 'INTERMEDIATE' as Rep['skill_tier'],
    territory_id: 'ter_mumbai_east',
    manager_id: 'rep_010',
    points_balance: 890,
    total_points_earned: 5420,
    is_active: true,
    last_active_at: new Date('2026-02-06T10:15:00+05:30'),
    device_token: null,
    current_lat: 19.0596,
    current_lng: 72.8295,
    created_at: new Date('2025-06-01'),
    updated_at: new Date('2026-02-06'),
    deleted_at: null,
  },
  {
    id: 'rep_003',
    company_id: 'comp_001',
    employee_code: 'EMP-1003',
    user_id: 'usr_r03',
    name: 'Vikram Singh',
    email: 'vikram.singh@opensalesai.com',
    phone: '+91 76543 21098',
    role: 'TEAM_LEAD' as Rep['role'],
    skill_tier: 'EXPERT' as Rep['skill_tier'],
    territory_id: 'ter_delhi_south',
    manager_id: null,
    points_balance: 2100,
    total_points_earned: 14200,
    is_active: true,
    last_active_at: new Date('2026-02-06T08:45:00+05:30'),
    device_token: null,
    current_lat: 28.5355,
    current_lng: 77.391,
    created_at: new Date('2024-11-10'),
    updated_at: new Date('2026-02-06'),
    deleted_at: null,
  },
];

const mockRepDashboards: Record<string, RepDashboard> = {
  rep_001: {
    rep_id: 'rep_001',
    rep_name: 'Amit Sharma',
    tasks_completed: 8,
    tasks_pending: 4,
    tasks_total: 12,
    task_completion_rate: 66.7,
    orders_placed_today: 5,
    orders_placed_month: 87,
    revenue_today: 42500,
    revenue_month: 685000,
    points_balance: 1240,
    stores_visited_today: 6,
    stores_assigned: 25,
    coverage_rate: 24.0,
    avg_visit_duration_minutes: 18,
  },
  rep_002: {
    rep_id: 'rep_002',
    rep_name: 'Priya Patel',
    tasks_completed: 10,
    tasks_pending: 2,
    tasks_total: 12,
    task_completion_rate: 83.3,
    orders_placed_today: 7,
    orders_placed_month: 102,
    revenue_today: 56800,
    revenue_month: 820000,
    points_balance: 890,
    stores_visited_today: 8,
    stores_assigned: 22,
    coverage_rate: 36.4,
    avg_visit_duration_minutes: 22,
  },
  rep_003: {
    rep_id: 'rep_003',
    rep_name: 'Vikram Singh',
    tasks_completed: 6,
    tasks_pending: 6,
    tasks_total: 12,
    task_completion_rate: 50.0,
    orders_placed_today: 3,
    orders_placed_month: 64,
    revenue_today: 31200,
    revenue_month: 540000,
    points_balance: 2100,
    stores_visited_today: 4,
    stores_assigned: 30,
    coverage_rate: 13.3,
    avg_visit_duration_minutes: 15,
  },
};

const mockTasks: Task[] = [
  {
    id: 'task_001',
    company_id: 'comp_001',
    rep_id: 'rep_001',
    store_id: 'store_001',
    type: 'ORDER' as Task['type'],
    status: 'PENDING' as Task['status'],
    priority: 'HIGH' as Task['priority'],
    source: 'AI_GENERATED' as Task['source'],
    title: 'Push Coca-Cola 300ml — 2 cases',
    description: 'Store has not ordered Coca-Cola in 14 days.',
    ai_reasoning: 'Last order was 14 days ago (avg reorder cycle: 7 days). Store typically orders 2 cases. Current stock likely depleted based on sell-through rate.',
    action_data: { product_id: 'prod_001', suggested_qty: 2 },
    priority_score: 85,
    estimated_impact: 1200,
    points_reward: 15,
    scheduled_date: new Date('2026-02-06'),
    due_date: new Date('2026-02-06T18:00:00+05:30'),
    started_at: null,
    completed_at: null,
    completion_notes: null,
    visit_id: null,
    created_at: new Date('2026-02-06T02:00:00+05:30'),
    updated_at: new Date('2026-02-06T02:00:00+05:30'),
    deleted_at: null,
  },
  {
    id: 'task_002',
    company_id: 'comp_001',
    rep_id: 'rep_001',
    store_id: 'store_002',
    type: 'VISIT' as Task['type'],
    status: 'COMPLETED' as Task['status'],
    priority: 'MEDIUM' as Task['priority'],
    source: 'AI_GENERATED' as Task['source'],
    title: 'Visit and check MSL compliance',
    description: 'Monthly MSL audit for Gold tier store.',
    ai_reasoning: 'Store is Gold MSL tier. Last compliance audit was 32 days ago. Scheduled monthly check to maintain shelf presence.',
    action_data: null,
    priority_score: 60,
    estimated_impact: 800,
    points_reward: 10,
    scheduled_date: new Date('2026-02-06'),
    due_date: new Date('2026-02-06T18:00:00+05:30'),
    started_at: new Date('2026-02-06T10:00:00+05:30'),
    completed_at: new Date('2026-02-06T10:25:00+05:30'),
    completion_notes: 'All MSL items in place. Added 1 new SKU to shelf.',
    visit_id: 'visit_001',
    created_at: new Date('2026-02-06T02:00:00+05:30'),
    updated_at: new Date('2026-02-06T10:25:00+05:30'),
    deleted_at: null,
  },
  {
    id: 'task_003',
    company_id: 'comp_001',
    rep_id: 'rep_001',
    store_id: 'store_003',
    type: 'COLLECTION' as Task['type'],
    status: 'PENDING' as Task['status'],
    priority: 'CRITICAL' as Task['priority'],
    source: 'SYSTEM_RULE' as Task['source'],
    title: 'Collect outstanding payment of Rs 8,500',
    description: 'Outstanding balance exceeds credit limit. Overdue by 12 days.',
    ai_reasoning: 'Outstanding balance: Rs 8,500 against credit limit of Rs 5,000. Payment overdue by 12 days. Credit tier at risk of downgrade from B to C.',
    action_data: { outstanding: 8500, credit_limit: 5000, days_overdue: 12 },
    priority_score: 95,
    estimated_impact: 8500,
    points_reward: 25,
    scheduled_date: new Date('2026-02-06'),
    due_date: new Date('2026-02-06T18:00:00+05:30'),
    started_at: null,
    completed_at: null,
    completion_notes: null,
    visit_id: null,
    created_at: new Date('2026-02-06T02:00:00+05:30'),
    updated_at: new Date('2026-02-06T02:00:00+05:30'),
    deleted_at: null,
  },
  {
    id: 'task_004',
    company_id: 'comp_001',
    rep_id: 'rep_001',
    store_id: 'store_004',
    type: 'PROMOTION' as Task['type'],
    status: 'IN_PROGRESS' as Task['status'],
    priority: 'MEDIUM' as Task['priority'],
    source: 'MANAGER_ASSIGNED' as Task['source'],
    title: 'Place new Lays Wafers display stand',
    description: 'Install the new promotional stand at store entrance.',
    ai_reasoning: null,
    action_data: null,
    priority_score: 55,
    estimated_impact: 2000,
    points_reward: 20,
    scheduled_date: new Date('2026-02-06'),
    due_date: new Date('2026-02-07T18:00:00+05:30'),
    started_at: new Date('2026-02-06T11:00:00+05:30'),
    completed_at: null,
    completion_notes: null,
    visit_id: null,
    created_at: new Date('2026-02-05T14:00:00+05:30'),
    updated_at: new Date('2026-02-06T11:00:00+05:30'),
    deleted_at: null,
  },
  {
    id: 'task_005',
    company_id: 'comp_001',
    rep_id: 'rep_001',
    store_id: 'store_005',
    type: 'NEW_OUTLET' as Task['type'],
    status: 'PENDING' as Task['status'],
    priority: 'LOW' as Task['priority'],
    source: 'AI_GENERATED' as Task['source'],
    title: 'Onboard new store — Sharma General Store',
    description: 'Potential new outlet identified in territory. High foot traffic area.',
    ai_reasoning: 'New retail location detected via geo-intelligence. High foot traffic area with no existing coverage within 500m radius. Estimated monthly potential: Rs 45,000.',
    action_data: { potential_revenue: 45000 },
    priority_score: 40,
    estimated_impact: 45000,
    points_reward: 50,
    scheduled_date: new Date('2026-02-06'),
    due_date: new Date('2026-02-08T18:00:00+05:30'),
    started_at: null,
    completed_at: null,
    completion_notes: null,
    visit_id: null,
    created_at: new Date('2026-02-06T02:00:00+05:30'),
    updated_at: new Date('2026-02-06T02:00:00+05:30'),
    deleted_at: null,
  },
];

const mockStoreNames: Record<string, string> = {
  store_001: 'Krishna General Store',
  store_002: 'Patel Supermart',
  store_003: 'Gupta Kirana',
  store_004: 'Mumbai Fresh Mart',
  store_005: 'Sharma General Store',
};

const performanceData = [
  { day: 'Mon', orders: 4, revenue: 28000 },
  { day: 'Tue', orders: 6, revenue: 42000 },
  { day: 'Wed', orders: 5, revenue: 35000 },
  { day: 'Thu', orders: 8, revenue: 56000 },
  { day: 'Fri', orders: 7, revenue: 48000 },
  { day: 'Sat', orders: 3, revenue: 21000 },
  { day: 'Sun', orders: 5, revenue: 42500 },
];

/* ------------------------------------------------------------------ */
/*  Helper: priority and status badge colors                          */
/* ------------------------------------------------------------------ */

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  SKIPPED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  EXPIRED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

function InlineTaskCard({ task, storeName }: { task: Task; storeName?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
                priorityColors[task.priority] || priorityColors.MEDIUM
              )}
            >
              {task.priority}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
                statusColors[task.status] || statusColors.PENDING
              )}
            >
              {task.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {task.type.replace('_', ' ')}
            </span>
          </div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5">
            {task.title}
          </h4>
          {storeName && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {storeName}
            </p>
          )}
          {task.ai_reasoning && (
            <div className="mt-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
              <div className="flex items-start gap-1.5">
                <svg
                  className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  {task.ai_reasoning}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            +{task.points_reward} pts
          </p>
          {task.estimated_impact !== null && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Impact: {formatINR(task.estimated_impact)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */

export default function RepDetailPage() {
  const params = useParams();
  const repId = params.id as string;

  const rep = useMemo(
    () => mockReps.find((r) => r.id === repId) || mockReps[0],
    [repId]
  );

  const dashboard = useMemo(
    () => mockRepDashboards[rep.id] || Object.values(mockRepDashboards)[0],
    [rep.id]
  );

  const repTasks = useMemo(
    () => mockTasks.filter((t) => t.rep_id === rep.id).slice(0, 5),
    [rep.id]
  );

  const avatarColor = stringToColor(rep.name);

  const skillTierVariant = (tier: string) => {
    const map: Record<string, 'success' | 'info' | 'warning' | 'purple' | 'neutral'> = {
      EXPERT: 'purple',
      SENIOR: 'success',
      INTERMEDIATE: 'info',
      JUNIOR: 'warning',
      TRAINEE: 'neutral',
    };
    return map[tier] || 'neutral';
  };

  const roleLabel = (role: string) =>
    role
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');

  return (
    <div className="space-y-6">
      {/* Header — Back button */}
      <div className="flex items-center gap-4">
        <Link
          href="/reps"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Reps
        </Link>
      </div>

      {/* Rep Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(rep.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {rep.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={skillTierVariant(rep.skill_tier)}>
                  {rep.skill_tier}
                </Badge>
                <Badge variant="info">{roleLabel(rep.role)}</Badge>
                <Badge variant={rep.is_active ? 'success' : 'danger'} dot>
                  {rep.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
                <span>{rep.employee_code}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="truncate">{rep.email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{rep.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Territory: {rep.territory_id || 'Unassigned'}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                  {rep.points_balance.toLocaleString('en-IN')} points
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({rep.total_points_earned.toLocaleString('en-IN')} lifetime)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tasks Completed"
          value={`${dashboard.tasks_completed}/${dashboard.tasks_total}`}
          change={dashboard.task_completion_rate > 70 ? 5.2 : -3.1}
          changeLabel="vs yesterday"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        />
        <KPICard
          title="Orders Today"
          value={dashboard.orders_placed_today.toString()}
          change={12.5}
          changeLabel="vs avg"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          }
        />
        <KPICard
          title="Revenue Today"
          value={formatINR(dashboard.revenue_today)}
          change={8.3}
          changeLabel="vs avg"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KPICard
          title="Coverage Rate"
          value={`${dashboard.coverage_rate.toFixed(1)}%`}
          change={dashboard.coverage_rate > 25 ? 4.1 : -2.0}
          changeLabel="vs target"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          }
        />
      </div>

      {/* Two columns: Chart + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Last 7 Days Performance
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Revenue') return [formatINR(value), 'Revenue'];
                    return [value, 'Orders'];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="orders"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Orders"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Current Location
          </h3>
          <MapPlaceholder
            lat={rep.current_lat || 19.076}
            lng={rep.current_lng || 72.8777}
            label="Current Location: Mumbai, Maharashtra"
            className="h-48"
          />
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Last active:{' '}
              {rep.last_active_at
                ? formatRelativeTime(rep.last_active_at)
                : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Monthly Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Orders This Month</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {dashboard.orders_placed_month}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Revenue This Month</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {formatINR(dashboard.revenue_month)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Stores Assigned</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {dashboard.stores_assigned}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Visit Duration</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {dashboard.avg_visit_duration_minutes} min
            </p>
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recent Tasks
        </h3>
        {repTasks.length > 0 ? (
          <div className="space-y-3">
            {repTasks.map((task) => (
              <InlineTaskCard
                key={task.id}
                task={task}
                storeName={mockStoreNames[task.store_id]}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No tasks assigned to this rep today.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
