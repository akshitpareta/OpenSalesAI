'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { KPICard } from '@/components/KPICard';
import { RevenueTrendChart } from '@/components/charts/RevenueTrendChart';
import {
  mockKPIs,
  mockAnalytics,
  mockOrders,
  mockStores,
  mockTaskStatusDistribution,
} from '@/lib/mock-data';
import { formatINR, formatCompact, formatRelativeTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Icon components (inline SVGs for each KPI)
// ---------------------------------------------------------------------------

const RupeeIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 8h6m-6 4h6M9 16l3-8m3 8l-3-8M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
    />
  </svg>
);

const BuildingIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const UsersIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const CartIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
    />
  </svg>
);

const SparkleIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
    />
  </svg>
);

const ChartIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M2 12h4l3-9 4 18 3-9h4"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Source badge helper
// ---------------------------------------------------------------------------

const sourceColors: Record<string, string> = {
  WHATSAPP_TEXT:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  WHATSAPP_VOICE:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  WHATSAPP_IMAGE:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  MANUAL:
    'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  PWA:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  VOICE_AGENT:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  MOBILE_APP:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  PERFECT_BASKET:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const sourceLabels: Record<string, string> = {
  WHATSAPP_TEXT: 'WhatsApp',
  WHATSAPP_VOICE: 'WA Voice',
  WHATSAPP_IMAGE: 'WA Image',
  MANUAL: 'Manual',
  PWA: 'PWA',
  VOICE_AGENT: 'Voice AI',
  MOBILE_APP: 'App',
  PERFECT_BASKET: 'AI Basket',
};

function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        sourceColors[source] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {sourceLabels[source] || source}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const coverage = Math.round(
    (mockKPIs.stores_visited / mockKPIs.stores_total) * 100
  );

  const maxTerritoryRevenue = Math.max(
    ...mockAnalytics.territory_performance.map((t) => t.revenue)
  );

  const recentOrders = mockOrders.slice(0, 5);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Welcome back, Rajesh. Here&apos;s your team&apos;s performance.
        </p>
      </div>

      {/* Primary KPIs -- 4-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Revenue Today"
          value={formatINR(mockKPIs.revenue_today)}
          change={12.5}
          changeLabel="vs yesterday"
          icon={<RupeeIcon />}
          trend="up"
        />
        <KPICard
          title="Store Coverage"
          value={`${coverage}% (${mockKPIs.stores_visited}/${mockKPIs.stores_total})`}
          change={3}
          changeLabel="vs last week"
          icon={<BuildingIcon />}
          trend="up"
        />
        <KPICard
          title="Task Completion"
          value={`${mockKPIs.task_completion_rate}%`}
          change={-2}
          changeLabel="vs yesterday"
          icon={<ClipboardIcon />}
          trend="down"
        />
        <KPICard
          title="Active Reps"
          value={`${mockKPIs.active_reps}/${mockKPIs.total_reps}`}
          change={0}
          changeLabel="same as yesterday"
          icon={<UsersIcon />}
          trend="neutral"
        />
      </div>

      {/* Secondary KPIs -- 3-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Orders Today"
          value={mockKPIs.orders_today}
          change={8}
          changeLabel="vs yesterday"
          icon={<CartIcon />}
          trend="up"
        />
        <KPICard
          title="AI Tasks Generated"
          value={mockKPIs.ai_tasks_generated}
          icon={<SparkleIcon />}
          trend="neutral"
        />
        <KPICard
          title="Monthly Revenue"
          value={formatINR(mockKPIs.revenue_month)}
          change={15}
          changeLabel="vs last month"
          icon={<ChartIcon />}
          trend="up"
        />
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Revenue Trend
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last 30 days daily revenue
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This month
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCompact(mockKPIs.revenue_month)}
            </p>
          </div>
        </div>
        <RevenueTrendChart data={[...mockAnalytics.revenue_trend]} height={300} />
      </div>

      {/* Quick Stats Row -- 3 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Performing Territories */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Top Territories
          </h3>
          <div className="space-y-3">
            {mockAnalytics.territory_performance.map((t, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t.territory}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCompact(t.revenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${(t.revenue / maxTerritoryRevenue) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Orders
          </h3>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between"
              >
                <div className="min-w-0 flex-1 mr-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {mockStores.find((s) => s.id === order.store_id)?.name ?? order.order_number}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <SourceBadge source={order.source} />
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(order.created_at)}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {formatINR(order.grand_total)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Task Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Task Distribution
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mockTaskStatusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                  >
                    {mockTaskStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {mockTaskStatusDistribution.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {item.status}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
