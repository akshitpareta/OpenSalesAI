'use client';

import React from 'react';
import { OrderStatus } from '@opensalesai/shared';
import { cn, formatDateTime } from '@/lib/utils';

export interface OrderTimelineOrder {
  status: OrderStatus;
  created_at: string;
  cancelled_at?: string | null;
  delivered_at?: string | null;
}

export interface OrderTimelineProps {
  order: OrderTimelineOrder;
  className?: string;
}

interface StepDef {
  key: OrderStatus;
  label: string;
}

const stepSequence: StepDef[] = [
  { key: OrderStatus.PENDING, label: 'Created' },
  { key: OrderStatus.CONFIRMED, label: 'Confirmed' },
  { key: OrderStatus.PROCESSING, label: 'Processing' },
  { key: OrderStatus.DISPATCHED, label: 'Dispatched' },
  { key: OrderStatus.DELIVERED, label: 'Delivered' },
];

const statusIndex: Record<string, number> = {
  [OrderStatus.DRAFT]: -1,
  [OrderStatus.PENDING]: 0,
  [OrderStatus.CONFIRMED]: 1,
  [OrderStatus.PROCESSING]: 2,
  [OrderStatus.DISPATCHED]: 3,
  [OrderStatus.DELIVERED]: 4,
  [OrderStatus.PARTIALLY_DELIVERED]: 4,
  [OrderStatus.CANCELLED]: -2,
  [OrderStatus.RETURNED]: 5,
};

export const OrderTimeline: React.FC<OrderTimelineProps> = ({
  order,
  className = '',
}) => {
  const currentIdx = statusIndex[order.status] ?? -1;
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isReturned = order.status === OrderStatus.RETURNED;

  if (isCancelled) {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Created step */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-green-600">
              <svg
                className="h-3.5 w-3.5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="w-0.5 h-6 bg-red-300 dark:bg-red-700" />
          </div>
          <div className="pt-0.5">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Created
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDateTime(order.created_at)}
            </p>
          </div>
        </div>

        {/* Cancelled step */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-red-600">
              <svg
                className="h-3.5 w-3.5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>
          <div className="pt-0.5">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Cancelled
            </p>
            {order.cancelled_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(order.cancelled_at)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {stepSequence.map((step, index) => {
        const isCompleted = index < currentIdx;
        const isCurrent = index === currentIdx;
        const isFuture = index > currentIdx;
        const isLast = index === stepSequence.length - 1;

        let dateStr: string | null = null;
        if (index === 0 && (isCompleted || isCurrent)) {
          dateStr = order.created_at;
        } else if (index === 4 && isCompleted && order.delivered_at) {
          dateStr = order.delivered_at;
        }

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {/* Circle indicator */}
              <div
                className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-full flex-shrink-0',
                  isCompleted && 'bg-green-600 dark:bg-green-500',
                  isCurrent &&
                    'bg-blue-600 dark:bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/40',
                  isFuture &&
                    'border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                )}
              >
                {isCompleted && (
                  <svg
                    className="h-3.5 w-3.5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {isCurrent && (
                  <div className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
                )}
                {isFuture && (
                  <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 h-8',
                    index < currentIdx
                      ? 'bg-green-400 dark:bg-green-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  )}
                />
              )}
            </div>

            {/* Label + date */}
            <div className={cn('pt-0.5', isLast ? 'pb-0' : 'pb-1')}>
              <p
                className={cn(
                  'text-sm font-medium',
                  isCompleted && 'text-green-700 dark:text-green-400',
                  isCurrent && 'text-blue-700 dark:text-blue-400',
                  isFuture && 'text-gray-400 dark:text-gray-500'
                )}
              >
                {step.label}
                {isReturned && index === 4 && (
                  <span className="ml-2 text-xs text-red-500">(Returned)</span>
                )}
              </p>
              {dateStr && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(dateStr)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

OrderTimeline.displayName = 'OrderTimeline';
