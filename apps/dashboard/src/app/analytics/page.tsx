'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { KPICard } from '@/components/KPICard';
import { RevenueTrendChart } from '@/components/charts/RevenueTrendChart';
import { ChannelPieChart } from '@/components/charts/ChannelPieChart';
import { TerritoryBarChart } from '@/components/charts/TerritoryBarChart';
import { mockKPIs, mockAnalytics, mockOrders, mockReps } from '@/lib/mock-data';
import { formatINR, formatCompact } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DateRange = 'today' | 'week' | 'month' | '30days' | 'custom';

// ---------------------------------------------------------------------------
// Top products horizontal bar chart tooltip
// ---------------------------------------------------------------------------

interface ProductTooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload: { name: string; revenue: number; units: number };
}

interface ProductTooltipProps {
  active?: boolean;
  payload?: ProductTooltipPayloadItem[];
}

const ProductTooltip: React.FC<ProductTooltipProps> = ({
  active,
  payload,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {item.name}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Revenue: <span className="font-medium">{formatINR(item.revenue)}</span>
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Units: <span className="font-medium">{item.units.toLocaleString('en-IN')}</span>
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// KPI icons
// ---------------------------------------------------------------------------

const AvgOrderIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const OrderPerRepIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

const RevenuePerStoreIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30days');

  // Derived metrics
  const avgOrderValue =
    mockOrders.reduce((sum, o) => sum + o.grand_total, 0) / mockOrders.length;
  const activeReps = mockReps.filter((r) => r.is_active);
  const ordersPerRep =
    activeReps.length > 0
      ? (mockKPIs.orders_today / activeReps.length).toFixed(1)
      : '0';
  const revenuePerStore =
    mockKPIs.stores_visited > 0
      ? Math.round(mockKPIs.revenue_today / mockKPIs.stores_visited)
      : 0;

  // Top products data prepared for horizontal bar chart (reversed for bottom-up display)
  const topProductsData = [...mockAnalytics.top_products].reverse();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header + date selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sales performance insights and trends
          </p>
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          className="w-full sm:w-48 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="30days">Last 30 Days</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Revenue Trend
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Daily revenue for the selected period
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatINR(mockKPIs.revenue_month)}
            </p>
          </div>
        </div>
        <RevenueTrendChart data={[...mockAnalytics.revenue_trend]} height={350} />
      </div>

      {/* Two-column: Products + Channel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products -- Horizontal Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Top Products by Revenue
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Top 10 SKUs ranked by total revenue
            </p>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={topProductsData}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatCompact(v)}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip content={<ProductTooltip />} />
              <Bar
                dataKey="revenue"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Order Channel Distribution
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Breakdown of orders by source channel
            </p>
          </div>
          <ChannelPieChart
            data={mockAnalytics.channel_split.map((c) => ({
              channel: c.channel,
              count: c.count,
              percentage: c.percentage,
            }))}
          />
          {/* Channel detail table below chart */}
          <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
              <span>Channel</span>
              <span className="text-center">Orders</span>
              <span className="text-right">Share</span>
            </div>
            {mockAnalytics.channel_split.map((ch, idx) => (
              <div
                key={idx}
                className="grid grid-cols-3 gap-2 text-sm py-1.5 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {ch.channel}
                </span>
                <span className="text-center text-gray-900 dark:text-gray-100 font-medium">
                  {ch.count}
                </span>
                <span className="text-right text-gray-500 dark:text-gray-400">
                  {ch.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Territory Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Territory Performance
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Revenue and orders comparison across territories
            </p>
          </div>
        </div>
        <TerritoryBarChart
          data={mockAnalytics.territory_performance.map((t) => ({
            territory: t.territory,
            revenue: t.revenue,
            orders: t.orders,
            coverage: t.coverage,
          }))}
        />
        {/* Territory detail cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          {mockAnalytics.territory_performance.map((t, idx) => (
            <div
              key={idx}
              className="rounded-lg bg-gray-50 dark:bg-gray-700/30 p-3"
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">
                {t.territory}
              </p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {formatCompact(t.revenue)}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t.orders} orders
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t.coverage}% coverage
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Avg Order Value"
          value={formatINR(Math.round(avgOrderValue))}
          change={5.2}
          changeLabel="vs last period"
          icon={<AvgOrderIcon />}
          trend="up"
        />
        <KPICard
          title="Orders per Rep"
          value={ordersPerRep}
          change={3.1}
          changeLabel="vs last period"
          icon={<OrderPerRepIcon />}
          trend="up"
        />
        <KPICard
          title="Revenue per Store"
          value={formatINR(revenuePerStore)}
          change={-1.4}
          changeLabel="vs last period"
          icon={<RevenuePerStoreIcon />}
          trend="down"
        />
      </div>
    </div>
  );
}
