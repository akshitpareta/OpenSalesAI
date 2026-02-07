'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  mockKPIs,
  mockAnalytics,
  mockOrders,
  mockStores,
  mockReps,
  mockTasks,
  mockTaskStatusDistribution,
} from '@/lib/mock-data';
import { formatINR, formatCompact, formatRelativeTime, getInitials, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Time range selector
// ---------------------------------------------------------------------------

type TimeRange = 'today' | 'week' | 'month';

// ---------------------------------------------------------------------------
// Tooltip for charts
// ---------------------------------------------------------------------------

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
  payload: { date: string; revenue: number };
}

const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl px-4 py-3">
      <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-0.5">
        {label ? formatShortDate(label) : ''}
      </p>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
        {formatINR(payload[0].value)}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Territory colors
// ---------------------------------------------------------------------------

const territoryColors = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6'];

// ---------------------------------------------------------------------------
// Source badge config
// ---------------------------------------------------------------------------

const sourceConfig: Record<string, { label: string; color: string; bg: string }> = {
  WHATSAPP_TEXT: { label: 'WhatsApp', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  WHATSAPP_VOICE: { label: 'WA Voice', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  WHATSAPP_IMAGE: { label: 'WA Image', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  MANUAL: { label: 'Manual', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700/40' },
  PWA: { label: 'PWA', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  VOICE_AGENT: { label: 'Voice AI', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  MOBILE_APP: { label: 'App', color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  PERFECT_BASKET: { label: 'AI Basket', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
};

// ---------------------------------------------------------------------------
// Rep leaderboard computation
// ---------------------------------------------------------------------------

const repLeaderboard = mockReps
  .filter((r) => r.is_active)
  .map((rep) => {
    const repOrders = mockOrders.filter((o) => o.rep_id === rep.id);
    const revenue = repOrders.reduce((s, o) => s + o.grand_total, 0);
    const tasks = mockTasks.filter((t) => t.rep_id === rep.id);
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    const total = tasks.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { ...rep, revenue, orderCount: repOrders.length, completed, total, completionRate };
  })
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 5);

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  const coverage = Math.round(
    (mockKPIs.stores_visited / mockKPIs.stores_total) * 100
  );

  const totalTerritoryRevenue = mockAnalytics.territory_performance.reduce(
    (s, t) => s + t.revenue,
    0
  );

  // Compute top rep (most points)
  const topRep = [...mockReps].sort(
    (a, b) => b.total_points_earned - a.total_points_earned
  )[0];

  // Compute best order
  const bestOrder = [...mockOrders].sort(
    (a, b) => b.grand_total - a.grand_total
  )[0];
  const bestOrderStore = mockStores.find((s) => s.id === bestOrder.store_id);

  // Previous month revenue (simulated)
  const prevMonthRevenue = Math.round(mockKPIs.revenue_month * 0.87);
  const revenueGrowth = Math.round(
    ((mockKPIs.revenue_month - prevMonthRevenue) / prevMonthRevenue) * 100 * 10
  ) / 10;
  const revenueDelta = mockKPIs.revenue_month - prevMonthRevenue;

  const recentOrders = mockOrders.slice(0, 6);

  // Top products for bar chart
  const topProducts = mockAnalytics.top_products.slice(0, 6).map((p) => ({
    name: p.name.length > 14 ? p.name.slice(0, 14) + '...' : p.name,
    revenue: p.revenue,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header row */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">
            Dashboard
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
            Welcome back, Rajesh. Here&apos;s your team&apos;s performance.
          </p>
        </div>
        {/* Time range pills */}
        <div className="flex items-center rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {(['today', 'week', 'month'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all',
                timeRange === range
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Hero Revenue Card */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm overflow-hidden">
        <div className="p-6 pb-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Revenue</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
              {formatINR(mockKPIs.revenue_month)}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {revenueGrowth}%
            </span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              +{formatINR(revenueDelta)}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            vs prev. {formatINR(prevMonthRevenue)} &middot; Jan 1 &ndash; Feb 7, 2026
          </p>
        </div>

        {/* Territory distribution bar */}
        <div className="px-6 pb-5">
          <div className="h-2.5 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-700 mt-1">
            {mockAnalytics.territory_performance.map((t, i) => (
              <div
                key={t.territory}
                className="h-full transition-all duration-500"
                style={{
                  width: `${(t.revenue / totalTerritoryRevenue) * 100}%`,
                  backgroundColor: territoryColors[i],
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {mockAnalytics.territory_performance.map((t, i) => {
              const pct = ((t.revenue / totalTerritoryRevenue) * 100).toFixed(1);
              return (
                <div key={t.territory} className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: territoryColors[i] }}
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {formatCompact(t.revenue)}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{pct}%</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{t.territory}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Highlight cards row */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Top rep */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-4 hover:shadow-md transition-shadow">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Top Rep</p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-50">{topRep.total_points_earned.toLocaleString('en-IN')}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                {getInitials(topRep.name)}
              </span>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
              {topRep.name}
            </span>
          </div>
        </div>

        {/* Best order */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30 shadow-sm p-4 hover:shadow-md transition-shadow">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-2">Best Order</p>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-50">{formatINR(bestOrder.grand_total)}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-2 truncate">
            {bestOrderStore?.name ?? bestOrder.order_number}
          </p>
        </div>

        {/* Orders today */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-4 hover:shadow-md transition-shadow">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Orders</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-50">{mockKPIs.orders_today}</p>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+8%</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">today vs yesterday</p>
        </div>

        {/* Task completion */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-4 hover:shadow-md transition-shadow">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Tasks</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-50">{mockKPIs.task_completion_rate}%</p>
            <span className="text-xs font-semibold text-rose-500 dark:text-rose-400">-2%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
              style={{ width: `${mockKPIs.task_completion_rate}%` }}
            />
          </div>
        </div>

        {/* Coverage / Active reps */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-4 hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Coverage</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-50">{coverage}%</p>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+3%</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {mockKPIs.stores_visited}/{mockKPIs.stores_total} stores &middot; {mockKPIs.active_reps}/{mockKPIs.total_reps} reps
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Revenue Trend Chart */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Revenue Trend
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Last 30 days daily revenue
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCompact(mockKPIs.revenue_month)}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">this month</p>
          </div>
        </div>
        <div className="mt-4 -mx-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={mockAnalytics.revenue_trend}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f3f4f6"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: '#6366f1',
                  stroke: '#fff',
                  strokeWidth: 2.5,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Three-column: Channel Revenue / Top Products / Rep Leaderboard */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Channel Revenue */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Channel Revenue
            </h3>
            <Link
              href="/analytics"
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Details
            </Link>
          </div>
          <div className="space-y-4">
            {mockAnalytics.channel_split.map((ch, i) => {
              const colors = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6'];
              return (
                <div key={ch.channel} className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${colors[i]}15` }}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colors[i] }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {ch.channel}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 ml-2">
                        {formatCompact(ch.revenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="h-1 flex-1 rounded-full bg-gray-100 dark:bg-gray-700 mr-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${ch.percentage}%`,
                            backgroundColor: colors[i],
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {ch.percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Products (bar chart) */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Top Products
            </h3>
            <Link
              href="/analytics"
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View All
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              data={topProducts}
              layout="vertical"
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                formatter={(value: number) => [formatCompact(value), 'Revenue']}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #f3f4f6',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="revenue"
                fill="#6366f1"
                radius={[0, 6, 6, 0]}
                barSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rep Leaderboard */}
        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Rep Leaderboard
            </h3>
            <Link
              href="/reps"
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {repLeaderboard.map((rep, i) => {
              const badgeColors = [
                'bg-amber-400 text-white',
                'bg-gray-300 text-gray-700',
                'bg-orange-400 text-white',
                'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
              ];
              return (
                <div key={rep.id} className="flex items-center gap-3">
                  {/* Rank badge */}
                  <div
                    className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                      badgeColors[i]
                    )}
                  >
                    {i + 1}
                  </div>
                  {/* Avatar */}
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
                    style={{ backgroundColor: `hsl(${(i * 72 + 220) % 360}, 55%, 55%)` }}
                  >
                    {getInitials(rep.name)}
                  </div>
                  {/* Name + territory */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {rep.name}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {(rep.territory_id ?? '').replace('territory-', '').replace(/^\w/, (c) => c.toUpperCase())}
                    </p>
                  </div>
                  {/* Revenue */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatCompact(rep.revenue)}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{rep.orderCount} orders</p>
                  </div>
                  {/* Completion badge */}
                  <div
                    className={cn(
                      'h-7 min-w-[44px] rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                      rep.completionRate >= 70
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : rep.completionRate >= 50
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                    )}
                  >
                    {rep.completionRate}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom row: Recent Orders / AI Tasks / Task Distribution */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recent Orders (span 3) */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Recent Orders
            </h3>
            <Link
              href="/orders"
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-6 pb-3">
                    Store
                  </th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 pb-3">
                    Channel
                  </th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 pb-3">
                    Status
                  </th>
                  <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-6 pb-3">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const store = mockStores.find((s) => s.id === order.store_id);
                  const src = sourceConfig[order.source] ?? {
                    label: order.source,
                    color: 'text-gray-600',
                    bg: 'bg-gray-50',
                  };
                  const statusColors: Record<string, string> = {
                    CONFIRMED: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
                    DELIVERED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
                    PROCESSING: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
                    PENDING: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                    DISPATCHED: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
                  };
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {store?.name ?? order.order_number}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            {formatRelativeTime(order.created_at)}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                            src.bg,
                            src.color
                          )}
                        >
                          {src.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize',
                            statusColors[order.status] ?? 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {order.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          {formatINR(order.grand_total)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Distribution + AI Stats (span 2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* AI Tasks card */}
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-sm p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">AI Tasks Generated</p>
                <p className="text-3xl font-extrabold mt-1">{mockKPIs.ai_tasks_generated}</p>
                <p className="text-indigo-200 text-xs mt-1">across {mockKPIs.total_reps} reps today</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center">
                <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Task distribution */}
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Task Distribution
            </h3>
            {/* Horizontal stacked bar */}
            <div className="h-3 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-700">
              {mockTaskStatusDistribution.map((item) => {
                const total = mockTaskStatusDistribution.reduce((s, x) => s + x.count, 0);
                return (
                  <div
                    key={item.status}
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${(item.count / total) * 100}%`,
                      backgroundColor: item.color,
                    }}
                  />
                );
              })}
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {mockTaskStatusDistribution.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {item.status}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 tabular-nums">
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
