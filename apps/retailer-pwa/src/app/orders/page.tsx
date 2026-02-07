'use client';

import React, { useState } from 'react';
import { Badge } from '@opensalesai/ui';
import type { BadgeVariant } from '@opensalesai/ui';
import { OrderStatus, OrderSource } from '@opensalesai/shared';
import { formatINR, formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { mockOrderHistory } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------

const statusLabels: Record<string, string> = {
  [OrderStatus.DRAFT]: 'Draft',
  [OrderStatus.PENDING]: 'Pending',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PROCESSING]: 'Processing',
  [OrderStatus.DISPATCHED]: 'Dispatched',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.RETURNED]: 'Returned',
  [OrderStatus.PARTIALLY_DELIVERED]: 'Partial',
};

const statusBadgeVariant: Record<string, BadgeVariant> = {
  [OrderStatus.DRAFT]: 'neutral',
  [OrderStatus.PENDING]: 'warning',
  [OrderStatus.CONFIRMED]: 'info',
  [OrderStatus.PROCESSING]: 'info',
  [OrderStatus.DISPATCHED]: 'purple',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.CANCELLED]: 'danger',
  [OrderStatus.RETURNED]: 'danger',
  [OrderStatus.PARTIALLY_DELIVERED]: 'warning',
};

const sourceLabels: Record<string, string> = {
  [OrderSource.MANUAL]: 'Manual',
  [OrderSource.WHATSAPP_TEXT]: 'WhatsApp',
  [OrderSource.WHATSAPP_VOICE]: 'WhatsApp Voice',
  [OrderSource.WHATSAPP_IMAGE]: 'WhatsApp Image',
  [OrderSource.PWA]: 'PWA',
  [OrderSource.MOBILE_APP]: 'Mobile App',
  [OrderSource.VOICE_AGENT]: 'Voice Agent',
  [OrderSource.PERFECT_BASKET]: 'AI Basket',
};

type TabFilter = 'all' | 'active' | 'delivered';

// ---------------------------------------------------------------------------
// Order detail expansion
// ---------------------------------------------------------------------------

interface OrderDetailProps {
  order: (typeof mockOrderHistory)[number];
}

const OrderDetail: React.FC<OrderDetailProps> = ({ order }) => {
  // Simple progress bar
  const statusSteps: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.DISPATCHED,
    OrderStatus.DELIVERED,
  ];
  const currentStepIndex = statusSteps.indexOf(order.status);
  const progressPercent =
    order.status === OrderStatus.DELIVERED
      ? 100
      : currentStepIndex >= 0
        ? ((currentStepIndex + 1) / statusSteps.length) * 100
        : 0;

  return (
    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 space-y-4 animate-fade-in">
      {/* Progress bar */}
      {order.status !== OrderStatus.CANCELLED && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span>Order Progress</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                order.status === OrderStatus.DELIVERED
                  ? 'bg-green-500'
                  : 'bg-primary-500'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            {statusSteps.map((step, i) => (
              <span
                key={step}
                className={cn(
                  'text-[9px]',
                  i <= currentStepIndex
                    ? 'text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-gray-400 dark:text-gray-500'
                )}
              >
                {statusLabels[step]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Items list */}
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Items ({order.items.length})
        </p>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-mono">
                  {item.sku_code.slice(0, 3)}
                </div>
                <div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    {item.product_name}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Qty: {item.quantity} x {formatINR(item.unit_price)}
                  </p>
                </div>
              </div>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatINR(item.net_amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
          <span className="text-gray-700 dark:text-gray-300">
            {formatINR(order.subtotal)}
          </span>
        </div>
        {order.discount_total > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400">Discount</span>
            <span className="text-red-500">
              -{formatINR(order.discount_total)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Tax</span>
          <span className="text-gray-700 dark:text-gray-300">
            +{formatINR(order.tax_total)}
          </span>
        </div>
        <div className="flex justify-between text-sm font-bold border-t border-gray-200 dark:border-gray-700 pt-2">
          <span className="text-gray-900 dark:text-gray-100">Total</span>
          <span className="text-gray-900 dark:text-gray-100">
            {formatINR(order.grand_total)}
          </span>
        </div>
      </div>

      {/* Reorder button */}
      <button className="btn-outline w-full text-xs py-2">
        Reorder Same Items
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main orders page
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const [tab, setTab] = useState<TabFilter>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const filteredOrders = mockOrderHistory.filter((o) => {
    if (tab === 'active') {
      return (
        o.status !== OrderStatus.DELIVERED &&
        o.status !== OrderStatus.CANCELLED &&
        o.status !== OrderStatus.RETURNED
      );
    }
    if (tab === 'delivered') {
      return o.status === OrderStatus.DELIVERED;
    }
    return true;
  });

  const activeCount = mockOrderHistory.filter(
    (o) =>
      o.status !== OrderStatus.DELIVERED &&
      o.status !== OrderStatus.CANCELLED &&
      o.status !== OrderStatus.RETURNED
  ).length;

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          My Orders
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Track and manage your orders
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all' as TabFilter, label: `All (${mockOrderHistory.length})` },
          { key: 'active' as TabFilter, label: `Active (${activeCount})` },
          {
            key: 'delivered' as TabFilter,
            label: `Delivered (${mockOrderHistory.length - activeCount})`,
          },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              tab === t.key
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No orders found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrder === order.id;

            return (
              <div
                key={order.id}
                className="card overflow-hidden"
              >
                {/* Order header (clickable) */}
                <button
                  onClick={() =>
                    setExpandedOrder(isExpanded ? null : order.id)
                  }
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold text-gray-900 dark:text-gray-100">
                          {order.order_number}
                        </span>
                        <Badge
                          variant={
                            statusBadgeVariant[order.status] || 'neutral'
                          }
                          size="sm"
                          dot
                        >
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{order.items.length} items</span>
                        <span className="text-gray-300 dark:text-gray-600">
                          |
                        </span>
                        <span>
                          {sourceLabels[order.source] || order.source}
                        </span>
                        <span className="text-gray-300 dark:text-gray-600">
                          |
                        </span>
                        <span>{formatRelativeTime(order.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatINR(order.grand_total)}
                      </span>
                      <svg
                        className={cn(
                          'h-4 w-4 text-gray-400 transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && <OrderDetail order={order} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
