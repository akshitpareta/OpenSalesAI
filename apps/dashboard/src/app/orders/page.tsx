'use client';

import React, { useState, useMemo } from 'react';
import { Badge, Select } from '@opensalesai/ui';
import type { BadgeVariant, SelectOption } from '@opensalesai/ui';
import { OrderSource, OrderStatus, PaymentStatus } from '@opensalesai/shared';
import { DataTable, type Column } from '@/components/DataTable';
import { OrderTimeline } from '@/components/OrderTimeline';
import { formatINR, formatDate, formatRelativeTime } from '@/lib/utils';
import { mockOrders, mockStores, mockReps } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Lookup maps for store name and rep name by ID
// ---------------------------------------------------------------------------

const storeNameMap = new Map(mockStores.map((s) => [s.id, s.name]));
const storeCodeMap = new Map(mockStores.map((s) => [s.id, s.store_code]));
const repNameMap = new Map(mockReps.map((r) => [r.id, r.name]));

// ---------------------------------------------------------------------------
// Row type for the DataTable
// ---------------------------------------------------------------------------

interface OrderRow {
  id: string;
  order_number: string;
  store_name: string;
  store_code: string;
  rep_name: string;
  source: OrderSource;
  status: OrderStatus;
  payment_status: PaymentStatus;
  item_count: number;
  grand_total: number;
  created_at: Date;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Config maps for badges
// ---------------------------------------------------------------------------

const sourceLabels: Record<string, string> = {
  [OrderSource.MANUAL]: 'Manual',
  [OrderSource.WHATSAPP_TEXT]: 'WhatsApp Text',
  [OrderSource.WHATSAPP_VOICE]: 'WhatsApp Voice',
  [OrderSource.WHATSAPP_IMAGE]: 'WhatsApp Image',
  [OrderSource.PWA]: 'PWA',
  [OrderSource.MOBILE_APP]: 'Mobile App',
  [OrderSource.VOICE_AGENT]: 'Voice Agent',
  [OrderSource.PERFECT_BASKET]: 'Perfect Basket',
};

const sourceBadgeVariant: Record<string, BadgeVariant> = {
  [OrderSource.MANUAL]: 'neutral',
  [OrderSource.WHATSAPP_TEXT]: 'success',
  [OrderSource.WHATSAPP_VOICE]: 'success',
  [OrderSource.WHATSAPP_IMAGE]: 'success',
  [OrderSource.PWA]: 'info',
  [OrderSource.MOBILE_APP]: 'purple',
  [OrderSource.VOICE_AGENT]: 'warning',
  [OrderSource.PERFECT_BASKET]: 'purple',
};

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

const paymentLabels: Record<string, string> = {
  [PaymentStatus.UNPAID]: 'Unpaid',
  [PaymentStatus.PARTIALLY_PAID]: 'Partial',
  [PaymentStatus.PAID]: 'Paid',
  [PaymentStatus.OVERDUE]: 'Overdue',
  [PaymentStatus.CREDIT]: 'Credit',
};

const paymentBadgeVariant: Record<string, BadgeVariant> = {
  [PaymentStatus.UNPAID]: 'warning',
  [PaymentStatus.PARTIALLY_PAID]: 'info',
  [PaymentStatus.PAID]: 'success',
  [PaymentStatus.OVERDUE]: 'danger',
  [PaymentStatus.CREDIT]: 'purple',
};

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const sourceOptions: SelectOption[] = [
  { value: '', label: 'All Channels' },
  { value: OrderSource.MANUAL, label: 'Manual' },
  { value: OrderSource.WHATSAPP_TEXT, label: 'WhatsApp Text' },
  { value: OrderSource.WHATSAPP_VOICE, label: 'WhatsApp Voice' },
  { value: OrderSource.WHATSAPP_IMAGE, label: 'WhatsApp Image' },
  { value: OrderSource.PWA, label: 'PWA' },
  { value: OrderSource.MOBILE_APP, label: 'Mobile App' },
  { value: OrderSource.VOICE_AGENT, label: 'Voice Agent' },
  { value: OrderSource.PERFECT_BASKET, label: 'Perfect Basket' },
];

const statusOptions: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: OrderStatus.PENDING, label: 'Pending' },
  { value: OrderStatus.CONFIRMED, label: 'Confirmed' },
  { value: OrderStatus.PROCESSING, label: 'Processing' },
  { value: OrderStatus.DISPATCHED, label: 'Dispatched' },
  { value: OrderStatus.DELIVERED, label: 'Delivered' },
  { value: OrderStatus.CANCELLED, label: 'Cancelled' },
  { value: OrderStatus.RETURNED, label: 'Returned' },
];

const paymentOptions: SelectOption[] = [
  { value: '', label: 'All Payments' },
  { value: PaymentStatus.UNPAID, label: 'Unpaid' },
  { value: PaymentStatus.PARTIALLY_PAID, label: 'Partially Paid' },
  { value: PaymentStatus.PAID, label: 'Paid' },
  { value: PaymentStatus.OVERDUE, label: 'Overdue' },
  { value: PaymentStatus.CREDIT, label: 'Credit' },
];

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const columns: Column<OrderRow>[] = [
  {
    key: 'order_number',
    header: 'Order #',
    sortable: true,
    width: '130px',
    render: (row) => (
      <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
        {row.order_number}
      </span>
    ),
  },
  {
    key: 'store_name',
    header: 'Store',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
          {row.store_name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {row.store_code}
        </p>
      </div>
    ),
  },
  {
    key: 'rep_name',
    header: 'Rep',
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {row.rep_name}
      </span>
    ),
  },
  {
    key: 'source',
    header: 'Channel',
    sortable: true,
    render: (row) => (
      <Badge variant={sourceBadgeVariant[row.source] || 'neutral'} size="sm">
        {sourceLabels[row.source] || row.source}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => (
      <Badge
        variant={statusBadgeVariant[row.status] || 'neutral'}
        size="sm"
        dot
      >
        {statusLabels[row.status] || row.status}
      </Badge>
    ),
  },
  {
    key: 'payment_status',
    header: 'Payment',
    sortable: true,
    render: (row) => (
      <Badge
        variant={paymentBadgeVariant[row.payment_status] || 'neutral'}
        size="sm"
      >
        {paymentLabels[row.payment_status] || row.payment_status}
      </Badge>
    ),
  },
  {
    key: 'item_count',
    header: 'Items',
    sortable: true,
    width: '70px',
    render: (row) => (
      <span className="text-sm text-gray-600 dark:text-gray-400 text-center block">
        {row.item_count}
      </span>
    ),
    accessor: (row) => row.item_count,
  },
  {
    key: 'grand_total',
    header: 'Total',
    sortable: true,
    render: (row) => (
      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
        {formatINR(row.grand_total)}
      </span>
    ),
    accessor: (row) => row.grand_total,
  },
  {
    key: 'created_at',
    header: 'Date',
    sortable: true,
    render: (row) => (
      <div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {formatDate(row.created_at)}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {formatRelativeTime(row.created_at)}
        </p>
      </div>
    ),
    accessor: (row) => new Date(row.created_at).getTime(),
  },
];

// ---------------------------------------------------------------------------
// Expanded order detail panel
// ---------------------------------------------------------------------------

interface OrderDetailProps {
  order: (typeof mockOrders)[number];
  storeName: string;
}

const OrderDetail: React.FC<OrderDetailProps> = ({ order, storeName }) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mt-2 space-y-4">
      {/* Two-column layout: Items + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items list */}
        <div className="lg:col-span-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Order Items
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Product
                  </th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                    SKU
                  </th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Qty
                  </th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Unit Price
                  </th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Discount
                  </th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 dark:border-gray-700/50"
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-gray-100 font-medium">
                      {item.product_name}
                    </td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {item.sku_code}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {item.quantity}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {formatINR(item.unit_price)}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-500 dark:text-gray-400">
                      {item.discount_percent > 0
                        ? `${item.discount_percent}% (-${formatINR(item.discount_amount)})`
                        : '-'}
                    </td>
                    <td className="py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                      {formatINR(item.net_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                  <td
                    colSpan={5}
                    className="py-2 text-right text-xs text-gray-500 dark:text-gray-400"
                  >
                    Subtotal
                  </td>
                  <td className="py-2 text-right text-sm text-gray-700 dark:text-gray-300">
                    {formatINR(order.subtotal)}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={5}
                    className="py-1 text-right text-xs text-gray-500 dark:text-gray-400"
                  >
                    Discount
                  </td>
                  <td className="py-1 text-right text-sm text-red-600 dark:text-red-400">
                    -{formatINR(order.discount_total)}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={5}
                    className="py-1 text-right text-xs text-gray-500 dark:text-gray-400"
                  >
                    Tax (GST)
                  </td>
                  <td className="py-1 text-right text-sm text-gray-700 dark:text-gray-300">
                    +{formatINR(order.tax_total)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-700">
                  <td
                    colSpan={5}
                    className="py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Grand Total
                  </td>
                  <td className="py-2 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatINR(order.grand_total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Timeline + metadata */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Order Progress
          </h4>
          <OrderTimeline
            order={{
              status: order.status,
              created_at:
                order.created_at instanceof Date
                  ? order.created_at.toISOString()
                  : String(order.created_at),
              cancelled_at: order.cancelled_at
                ? order.cancelled_at instanceof Date
                  ? order.cancelled_at.toISOString()
                  : String(order.cancelled_at)
                : null,
              delivered_at: order.delivered_at
                ? order.delivered_at instanceof Date
                  ? order.delivered_at.toISOString()
                  : String(order.delivered_at)
                : null,
            }}
          />

          {/* Metadata */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Store</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {storeName}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Channel</span>
              <Badge
                variant={sourceBadgeVariant[order.source] || 'neutral'}
                size="sm"
              >
                {sourceLabels[order.source] || order.source}
              </Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Payment</span>
              <Badge
                variant={
                  paymentBadgeVariant[order.payment_status] || 'neutral'
                }
                size="sm"
              >
                {paymentLabels[order.payment_status] || order.payment_status}
              </Badge>
            </div>
            {order.delivery_date && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  Expected Delivery
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatDate(order.delivery_date)}
                </span>
              </div>
            )}
            {order.whatsapp_msg_id && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  WhatsApp Msg ID
                </span>
                <span className="font-mono text-gray-600 dark:text-gray-400 text-[10px]">
                  {order.whatsapp_msg_id}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Summary stats
  const totalRevenue = mockOrders.reduce((s, o) => s + o.grand_total, 0);
  const deliveredCount = mockOrders.filter(
    (o) => o.status === OrderStatus.DELIVERED
  ).length;
  const pendingCount = mockOrders.filter(
    (o) =>
      o.status === OrderStatus.PENDING || o.status === OrderStatus.CONFIRMED
  ).length;
  const whatsappCount = mockOrders.filter((o) =>
    o.source.startsWith('WHATSAPP')
  ).length;

  // Map and filter
  const filteredRows: OrderRow[] = useMemo(() => {
    return mockOrders
      .filter((o) => {
        if (sourceFilter && o.source !== sourceFilter) return false;
        if (statusFilter && o.status !== statusFilter) return false;
        if (paymentFilter && o.payment_status !== paymentFilter) return false;
        return true;
      })
      .map((o) => ({
        id: o.id,
        order_number: o.order_number,
        store_name: storeNameMap.get(o.store_id) ?? 'Unknown Store',
        store_code: storeCodeMap.get(o.store_id) ?? '-',
        rep_name: o.rep_id ? repNameMap.get(o.rep_id) ?? 'Unknown' : 'N/A',
        source: o.source,
        status: o.status,
        payment_status: o.payment_status,
        item_count: o.items.length,
        grand_total: o.grand_total,
        created_at: o.created_at,
        delivered_at: o.delivered_at,
        cancelled_at: o.cancelled_at,
      }));
  }, [sourceFilter, statusFilter, paymentFilter]);

  // Lookup helper to find original mock order
  const getOriginalOrder = (id: string) =>
    mockOrders.find((o) => o.id === id) ?? null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title">Order Management</h1>
        <p className="page-subtitle">
          Track and manage orders from all channels
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card card-padding text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Orders
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {mockOrders.length}
          </p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Revenue
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {formatINR(totalRevenue)}
          </p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Delivered
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {deliveredCount}
          </p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            WhatsApp Orders
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {whatsappCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <Select
            options={sourceOptions}
            value={sourceFilter}
            onChange={(v) => setSourceFilter(v as string)}
            placeholder="All Channels"
            label="Channel"
          />
        </div>
        <div className="w-40">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as string)}
            placeholder="All Statuses"
            label="Status"
          />
        </div>
        <div className="w-40">
          <Select
            options={paymentOptions}
            value={paymentFilter}
            onChange={(v) => setPaymentFilter(v as string)}
            placeholder="All Payments"
            label="Payment"
          />
        </div>
        {(sourceFilter || statusFilter || paymentFilter) && (
          <button
            onClick={() => {
              setSourceFilter('');
              setStatusFilter('');
              setPaymentFilter('');
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline pb-1"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Data table with expandable rows */}
      <DataTable
        columns={columns}
        data={filteredRows}
        keyExtractor={(row) => row.id}
        onRowClick={(row) =>
          setExpandedOrder(expandedOrder === row.id ? null : row.id)
        }
        searchable
        searchPlaceholder="Search orders by number, store, rep..."
        searchKeys={[
          'order_number',
          'store_name',
          'store_code',
          'rep_name',
          'source',
        ]}
        pageSize={10}
        renderExpandedRow={(row) => {
          if (expandedOrder !== row.id) return null;
          const original = getOriginalOrder(row.id);
          if (!original) return null;
          return (
            <OrderDetail order={original} storeName={row.store_name} />
          );
        }}
      />
    </div>
  );
}
