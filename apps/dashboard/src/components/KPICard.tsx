'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend = 'neutral',
  className,
}) => {
  const trendColor =
    trend === 'up'
      ? 'text-green-600 dark:text-green-400'
      : trend === 'down'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-500 dark:text-gray-400';

  const trendBgColor =
    trend === 'up'
      ? 'bg-green-50 dark:bg-green-900/20'
      : trend === 'down'
        ? 'bg-red-50 dark:bg-red-900/20'
        : 'bg-gray-50 dark:bg-gray-700/30';

  const iconBgColor =
    trend === 'up'
      ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
      : trend === 'down'
        ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {value}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={cn(
                  'inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded-full',
                  trendBgColor,
                  trendColor
                )}
              >
                {trend === 'up' && (
                  <svg
                    className="h-3 w-3 mr-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                )}
                {trend === 'down' && (
                  <svg
                    className="h-3 w-3 mr-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                )}
                {trend === 'neutral' && (
                  <svg
                    className="h-3 w-3 mr-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 12h14"
                    />
                  </svg>
                )}
                {change > 0 ? '+' : ''}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ml-4',
            iconBgColor
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};
