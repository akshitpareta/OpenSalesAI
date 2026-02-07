'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Store, Task } from '@opensalesai/shared';
import { Badge } from '@opensalesai/ui';
import { KPICard } from '@/components/KPICard';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { cn, formatINR, formatDate, formatRelativeTime } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Inline mock data                                                  */
/* ------------------------------------------------------------------ */

const mockStores: Store[] = [
  {
    id: 'store_001',
    company_id: 'comp_001',
    store_code: 'STR-1247',
    name: 'Krishna General Store',
    owner_name: 'Rajendra Krishna',
    phone: '+91 98765 12345',
    email: 'krishna.store@gmail.com',
    address_line1: '123 MG Road, Andheri West',
    address_line2: 'Near Railway Station',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400058',
    lat: 19.1197,
    lng: 72.8464,
    channel: 'GENERAL_TRADE' as Store['channel'],
    msl_tier: 'GOLD' as Store['msl_tier'],
    territory_id: 'ter_mumbai_west',
    credit_tier: 'A',
    credit_limit: 50000,
    outstanding_balance: 8750,
    is_active: true,
    last_order_date: new Date('2026-02-05'),
    last_visit_date: new Date('2026-02-04'),
    avg_order_value: 12500,
    visit_frequency_days: 3,
    created_at: new Date('2024-06-15'),
    updated_at: new Date('2026-02-05'),
    deleted_at: null,
  },
  {
    id: 'store_002',
    company_id: 'comp_001',
    store_code: 'STR-0893',
    name: 'Patel Supermart',
    owner_name: 'Mahesh Patel',
    phone: '+91 87654 98765',
    email: 'patel.supermart@gmail.com',
    address_line1: '45 Link Road, Malad East',
    address_line2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400097',
    lat: 19.1862,
    lng: 72.8486,
    channel: 'SUPERMARKET' as Store['channel'],
    msl_tier: 'PLATINUM' as Store['msl_tier'],
    territory_id: 'ter_mumbai_east',
    credit_tier: 'A',
    credit_limit: 100000,
    outstanding_balance: 22500,
    is_active: true,
    last_order_date: new Date('2026-02-06'),
    last_visit_date: new Date('2026-02-06'),
    avg_order_value: 28500,
    visit_frequency_days: 2,
    created_at: new Date('2024-03-10'),
    updated_at: new Date('2026-02-06'),
    deleted_at: null,
  },
  {
    id: 'store_003',
    company_id: 'comp_001',
    store_code: 'STR-0721',
    name: 'Gupta Kirana',
    owner_name: 'Suresh Gupta',
    phone: '+91 76543 21098',
    email: null,
    address_line1: '78 Station Road, Vile Parle',
    address_line2: 'Ground Floor',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400057',
    lat: 19.0988,
    lng: 72.8432,
    channel: 'GENERAL_TRADE' as Store['channel'],
    msl_tier: 'SILVER' as Store['msl_tier'],
    territory_id: 'ter_mumbai_west',
    credit_tier: 'B',
    credit_limit: 25000,
    outstanding_balance: 8500,
    is_active: true,
    last_order_date: new Date('2026-01-25'),
    last_visit_date: new Date('2026-01-28'),
    avg_order_value: 6800,
    visit_frequency_days: 7,
    created_at: new Date('2025-01-20'),
    updated_at: new Date('2026-01-28'),
    deleted_at: null,
  },
];

const mockStoreTasks: Task[] = [
  {
    id: 'task_s01',
    company_id: 'comp_001',
    rep_id: 'rep_001',
    store_id: 'store_001',
    type: 'ORDER' as Task['type'],
    status: 'PENDING' as Task['status'],
    priority: 'HIGH' as Task['priority'],
    source: 'AI_GENERATED' as Task['source'],
    title: 'Push Coca-Cola 300ml — 2 cases',
    description: 'Store has not ordered Coca-Cola in 14 days.',
    ai_reasoning: 'Last order was 14 days ago (avg reorder cycle: 7 days). Store typically orders 2 cases weekly.',
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
    id: 'task_s02',
    company_id: 'comp_001',
    rep_id: 'rep_001',
    store_id: 'store_001',
    type: 'MERCHANDISING' as Task['type'],
    status: 'PENDING' as Task['status'],
    priority: 'MEDIUM' as Task['priority'],
    source: 'AI_GENERATED' as Task['source'],
    title: 'Verify MSL compliance — 3 SKUs missing',
    description: 'Last audit showed 3 mandatory SKUs missing from shelf.',
    ai_reasoning: 'MSL compliance dropped from 95% to 82%. Gold tier stores require minimum 90% compliance.',
    action_data: null,
    priority_score: 65,
    estimated_impact: 3500,
    points_reward: 10,
    scheduled_date: new Date('2026-02-06'),
    due_date: new Date('2026-02-07T18:00:00+05:30'),
    started_at: null,
    completed_at: null,
    completion_notes: null,
    visit_id: null,
    created_at: new Date('2026-02-06T02:00:00+05:30'),
    updated_at: new Date('2026-02-06T02:00:00+05:30'),
    deleted_at: null,
  },
];

const purchaseHistoryData = [
  { month: 'Sep', value: 38000 },
  { month: 'Oct', value: 42000 },
  { month: 'Nov', value: 55000 },
  { month: 'Dec', value: 48000 },
  { month: 'Jan', value: 52000 },
  { month: 'Feb', value: 35000 },
];

const recentOrders = [
  { order_number: 'ORD-2024-1247', date: '2026-02-05', grand_total: 15200, status: 'CONFIRMED', source: 'WHATSAPP_TEXT' },
  { order_number: 'ORD-2024-1198', date: '2026-02-01', grand_total: 12800, status: 'DELIVERED', source: 'MANUAL' },
  { order_number: 'ORD-2024-1145', date: '2026-01-28', grand_total: 9500, status: 'DELIVERED', source: 'WHATSAPP_VOICE' },
  { order_number: 'ORD-2024-1089', date: '2026-01-24', grand_total: 18200, status: 'DELIVERED', source: 'PWA' },
  { order_number: 'ORD-2024-1034', date: '2026-01-20', grand_total: 11300, status: 'DELIVERED', source: 'MANUAL' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const channelLabels: Record<string, string> = {
  GENERAL_TRADE: 'General Trade',
  MODERN_TRADE: 'Modern Trade',
  SUPERMARKET: 'Supermarket',
  CHEMIST: 'Chemist',
  PAN_SHOP: 'Pan Shop',
  E_COMMERCE: 'E-Commerce',
  HORECA: 'HoReCa',
  INSTITUTIONAL: 'Institutional',
};

const channelBadgeVariant = (channel: string) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'purple' | 'neutral'> = {
    GENERAL_TRADE: 'info',
    MODERN_TRADE: 'purple',
    SUPERMARKET: 'success',
    CHEMIST: 'warning',
    PAN_SHOP: 'neutral',
    E_COMMERCE: 'info',
    HORECA: 'purple',
    INSTITUTIONAL: 'neutral',
  };
  return map[channel] || 'neutral';
};

const mslTierVariant = (tier: string) => {
  const map: Record<string, 'purple' | 'warning' | 'neutral' | 'info'> = {
    PLATINUM: 'purple',
    GOLD: 'warning',
    SILVER: 'neutral',
    BRONZE: 'info',
  };
  return map[tier] || 'neutral';
};

const creditTierVariant = (tier: string | null) => {
  if (!tier) return 'neutral' as const;
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
    A: 'success',
    B: 'info',
    C: 'warning',
    D: 'danger',
  };
  return map[tier] || 'neutral';
};

const orderSourceLabels: Record<string, string> = {
  MANUAL: 'Manual',
  WHATSAPP_TEXT: 'WhatsApp',
  WHATSAPP_VOICE: 'WhatsApp Voice',
  WHATSAPP_IMAGE: 'WhatsApp Image',
  PWA: 'PWA',
  MOBILE_APP: 'Mobile App',
  VOICE_AGENT: 'Voice Agent',
  PERFECT_BASKET: 'Perfect Basket',
};

const orderStatusVariant = (status: string) => {
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
    DELIVERED: 'success',
    CONFIRMED: 'info',
    PROCESSING: 'info',
    DISPATCHED: 'purple' as 'info',
    PENDING: 'warning',
    CANCELLED: 'danger',
    RETURNED: 'danger',
    DRAFT: 'neutral',
  };
  return map[status] || 'neutral';
};

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
};

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */

export default function StoreDetailPage() {
  const params = useParams();
  const storeId = params.id as string;

  const store = useMemo(
    () => mockStores.find((s) => s.id === storeId) || mockStores[0],
    [storeId]
  );

  const storeTasks = useMemo(
    () => mockStoreTasks.filter((t) => t.store_id === store.id),
    [store.id]
  );

  const fullAddress = [
    store.address_line1,
    store.address_line2,
    store.city,
    store.state,
    store.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      {/* Header — Back button */}
      <div className="flex items-center gap-4">
        <Link
          href="/stores"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Stores
        </Link>
      </div>

      {/* Store Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            {/* Store name + status */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {store.name}
              </h1>
              <Badge variant={store.is_active ? 'success' : 'danger'} dot>
                {store.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            {/* Owner + code */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {store.owner_name && (
                <span className="font-medium">{store.owner_name}</span>
              )}
              {store.owner_name && ' | '}
              <span className="text-gray-500 dark:text-gray-500">
                Code: {store.store_code}
              </span>
            </p>

            {/* Address */}
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
              <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{fullAddress}</span>
            </div>

            {/* Contact */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
              {store.phone && (
                <div className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{store.phone}</span>
                </div>
              )}
              {store.email && (
                <div className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{store.email}</span>
                </div>
              )}
            </div>

            {/* Badges: Channel, MSL, Credit */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={channelBadgeVariant(store.channel)}>
                {channelLabels[store.channel] || store.channel}
              </Badge>
              <Badge variant={mslTierVariant(store.msl_tier)}>
                {store.msl_tier} MSL
              </Badge>
              <Badge variant={creditTierVariant(store.credit_tier)}>
                Credit {store.credit_tier || 'N/A'}
              </Badge>
            </div>
          </div>

          {/* Credit info panel */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 min-w-[200px]">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Credit Information
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Limit</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatINR(store.credit_limit)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Outstanding</span>
                <span className={cn(
                  'font-medium',
                  store.outstanding_balance > store.credit_limit * 0.8
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-gray-100'
                )}>
                  {formatINR(store.outstanding_balance)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Available</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatINR(Math.max(0, store.credit_limit - store.outstanding_balance))}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-1">
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      store.outstanding_balance / store.credit_limit > 0.8
                        ? 'bg-red-500'
                        : store.outstanding_balance / store.credit_limit > 0.5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    )}
                    style={{
                      width: `${Math.min(100, (store.outstanding_balance / store.credit_limit) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {((store.outstanding_balance / store.credit_limit) * 100).toFixed(0)}% utilized
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Average Order Value"
          value={formatINR(store.avg_order_value)}
          change={5.2}
          changeLabel="vs last month"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          }
        />
        <KPICard
          title="Last Order"
          value={store.last_order_date ? formatRelativeTime(store.last_order_date) : 'Never'}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <KPICard
          title="Last Visit"
          value={store.last_visit_date ? formatRelativeTime(store.last_visit_date) : 'Never'}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <KPICard
          title="Visit Frequency"
          value={`Every ${store.visit_frequency_days} days`}
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
      </div>

      {/* Two columns: Purchase History Chart + Current Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Purchase History Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Purchase History (Last 6 Months)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={purchaseHistoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
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
                  formatter={(value: number) => [formatINR(value), 'Order Value']}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Order Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Current Tasks */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Current Tasks
          </h3>
          {storeTasks.length > 0 ? (
            <div className="space-y-3">
              {storeTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
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
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {task.title}
                  </h4>
                  {task.ai_reasoning && (
                    <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                      <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        {task.ai_reasoning}
                      </p>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>+{task.points_reward} pts</span>
                    {task.estimated_impact !== null && (
                      <span>Impact: {formatINR(task.estimated_impact)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No active tasks for this store.
            </p>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recent Orders
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentOrders.map((order) => (
                <tr
                  key={order.order_number}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-medium text-blue-600 dark:text-blue-400">
                    {order.order_number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(order.date)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatINR(order.grand_total)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={orderStatusVariant(order.status)} size="sm" dot>
                      {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        order.source.startsWith('WHATSAPP')
                          ? 'success'
                          : order.source === 'PWA'
                            ? 'info'
                            : 'neutral'
                      }
                      size="sm"
                    >
                      {orderSourceLabels[order.source] || order.source}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Store Location */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Store Location
        </h3>
        <MapPlaceholder
          lat={store.lat}
          lng={store.lng}
          label={fullAddress}
          className="h-56"
        />
      </div>
    </div>
  );
}
