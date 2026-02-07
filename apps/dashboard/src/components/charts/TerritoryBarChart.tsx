'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatINR, formatCompact } from '@/lib/utils';

export interface TerritoryBarChartProps {
  data: Array<{
    territory: string;
    revenue: number;
    orders: number;
    coverage: number;
  }>;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {label}
      </p>
      {payload.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
              {item.name}
            </span>
          </div>
          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
            {item.dataKey === 'revenue'
              ? formatINR(item.value)
              : item.value.toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  );
};

interface LegendPayloadItem {
  value: string;
  color: string;
}

const CustomLegend: React.FC<{ payload?: LegendPayloadItem[] }> = ({
  payload,
}) => {
  if (!payload) return null;

  return (
    <div className="flex justify-center gap-6 mt-2">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const TerritoryBarChart: React.FC<TerritoryBarChartProps> = ({
  data,
}) => {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        barGap={4}
        barCategoryGap="25%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e5e7eb"
          vertical={false}
        />
        <XAxis
          dataKey="territory"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis
          yAxisId="revenue"
          tickFormatter={(v: number) => formatCompact(v)}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={55}
        />
        <YAxis
          yAxisId="orders"
          orientation="right"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
        <Bar
          yAxisId="revenue"
          dataKey="revenue"
          name="Revenue"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Bar
          yAxisId="orders"
          dataKey="orders"
          name="Orders"
          fill="#f97316"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};
