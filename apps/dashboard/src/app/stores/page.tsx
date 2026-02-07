'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Select } from '@opensalesai/ui';
import type { BadgeVariant, SelectOption } from '@opensalesai/ui';
import { StoreChannel, MslTier } from '@opensalesai/shared';
import { DataTable, type Column } from '@/components/DataTable';
import { formatINR, formatRelativeTime } from '@/lib/utils';
import { mockStores } from '@/lib/mock-data';

// Row type for DataTable
interface StoreRow {
  id: string;
  store_code: string;
  name: string;
  owner_name: string;
  city: string;
  state: string;
  channel: string;
  msl_tier: string;
  credit_tier: string;
  avg_order_value: number;
  last_visit_date: Date | null;
  is_active: boolean;
  [key: string]: unknown;
}

const channelLabels: Record<string, string> = {
  [StoreChannel.GENERAL_TRADE]: 'General Trade',
  [StoreChannel.MODERN_TRADE]: 'Modern Trade',
  [StoreChannel.SUPERMARKET]: 'Supermarket',
  [StoreChannel.CHEMIST]: 'Chemist',
  [StoreChannel.PAN_SHOP]: 'Pan Shop',
  [StoreChannel.E_COMMERCE]: 'E-Commerce',
  [StoreChannel.HORECA]: 'HoReCa',
  [StoreChannel.INSTITUTIONAL]: 'Institutional',
};

const channelBadgeVariant: Record<string, BadgeVariant> = {
  [StoreChannel.GENERAL_TRADE]: 'neutral',
  [StoreChannel.MODERN_TRADE]: 'info',
  [StoreChannel.SUPERMARKET]: 'success',
  [StoreChannel.CHEMIST]: 'purple',
  [StoreChannel.PAN_SHOP]: 'warning',
  [StoreChannel.E_COMMERCE]: 'info',
  [StoreChannel.HORECA]: 'warning',
  [StoreChannel.INSTITUTIONAL]: 'purple',
};

const mslTierVariant: Record<string, BadgeVariant> = {
  [MslTier.PLATINUM]: 'purple',
  [MslTier.GOLD]: 'warning',
  [MslTier.SILVER]: 'neutral',
  [MslTier.BRONZE]: 'info',
};

const creditTierVariant: Record<string, BadgeVariant> = {
  A: 'success',
  B: 'info',
  C: 'warning',
  D: 'danger',
};

// Filter option sets
const channelOptions: SelectOption[] = [
  { value: '', label: 'All Channels' },
  ...Object.values(StoreChannel).map((ch) => ({
    value: ch,
    label: channelLabels[ch] || ch,
  })),
];

const mslTierOptions: SelectOption[] = [
  { value: '', label: 'All MSL Tiers' },
  ...Object.values(MslTier).map((t) => ({
    value: t,
    label: t.charAt(0) + t.slice(1).toLowerCase(),
  })),
];

const columns: Column<StoreRow>[] = [
  {
    key: 'store_code',
    header: 'Code',
    sortable: true,
    width: '100px',
    render: (row) => (
      <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
        {row.store_code}
      </span>
    ),
  },
  {
    key: 'name',
    header: 'Store',
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">
          {row.name}
        </p>
        {row.owner_name && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.owner_name}
          </p>
        )}
      </div>
    ),
  },
  {
    key: 'city',
    header: 'Location',
    sortable: true,
    render: (row) => (
      <span className="text-sm">
        {row.city}, {row.state}
      </span>
    ),
  },
  {
    key: 'channel',
    header: 'Channel',
    sortable: true,
    render: (row) => (
      <Badge
        variant={channelBadgeVariant[row.channel] || 'neutral'}
        size="sm"
      >
        {channelLabels[row.channel] || row.channel}
      </Badge>
    ),
  },
  {
    key: 'msl_tier',
    header: 'MSL Tier',
    sortable: true,
    render: (row) => (
      <Badge variant={mslTierVariant[row.msl_tier] || 'neutral'} size="sm">
        {row.msl_tier}
      </Badge>
    ),
  },
  {
    key: 'credit_tier',
    header: 'Credit',
    sortable: true,
    render: (row) => (
      <Badge
        variant={creditTierVariant[row.credit_tier] || 'neutral'}
        size="sm"
      >
        Tier {row.credit_tier}
      </Badge>
    ),
  },
  {
    key: 'avg_order_value',
    header: 'Avg Order',
    sortable: true,
    render: (row) => (
      <span className="font-medium">{formatINR(row.avg_order_value)}</span>
    ),
    accessor: (row) => row.avg_order_value,
  },
  {
    key: 'last_visit_date',
    header: 'Last Visit',
    sortable: true,
    render: (row) => {
      if (!row.last_visit_date) {
        return <span className="text-gray-400">Never</span>;
      }
      return (
        <span className="text-gray-600 dark:text-gray-400">
          {formatRelativeTime(row.last_visit_date)}
        </span>
      );
    },
    accessor: (row) =>
      row.last_visit_date ? new Date(row.last_visit_date).getTime() : 0,
  },
  {
    key: 'is_active',
    header: 'Status',
    render: (row) => (
      <Badge
        variant={row.is_active ? 'success' : 'danger'}
        size="sm"
        dot
      >
        {row.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

export default function StoresPage() {
  const router = useRouter();
  const [channelFilter, setChannelFilter] = useState('');
  const [mslFilter, setMslFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  // Build city options dynamically from store data
  const cityOptions: SelectOption[] = useMemo(() => {
    const cities = Array.from(new Set(mockStores.map((s) => s.city))).sort();
    return [
      { value: '', label: 'All Cities' },
      ...cities.map((c) => ({ value: c, label: c })),
    ];
  }, []);

  // Map Store objects to flat rows and apply filters
  const filteredData: StoreRow[] = useMemo(() => {
    return mockStores
      .filter((s) => {
        if (channelFilter && s.channel !== channelFilter) return false;
        if (mslFilter && s.msl_tier !== mslFilter) return false;
        if (cityFilter && s.city !== cityFilter) return false;
        return true;
      })
      .map((s) => ({
        id: s.id,
        store_code: s.store_code,
        name: s.name,
        owner_name: s.owner_name ?? '',
        city: s.city,
        state: s.state,
        channel: s.channel,
        msl_tier: s.msl_tier,
        credit_tier: s.credit_tier ?? '-',
        avg_order_value: s.avg_order_value,
        last_visit_date: s.last_visit_date,
        is_active: s.is_active,
      }));
  }, [channelFilter, mslFilter, cityFilter]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title">Store Directory</h1>
        <p className="page-subtitle">All retail outlets in your territory</p>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <Select
            options={channelOptions}
            value={channelFilter}
            onChange={(v) => setChannelFilter(v as string)}
            placeholder="All Channels"
            label="Channel"
          />
        </div>
        <div className="w-40">
          <Select
            options={mslTierOptions}
            value={mslFilter}
            onChange={(v) => setMslFilter(v as string)}
            placeholder="All MSL Tiers"
            label="MSL Tier"
          />
        </div>
        <div className="w-40">
          <Select
            options={cityOptions}
            value={cityFilter}
            onChange={(v) => setCityFilter(v as string)}
            placeholder="All Cities"
            label="City"
          />
        </div>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={filteredData}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => router.push(`/stores/${row.id}`)}
        searchable
        searchPlaceholder="Search stores by name, code, city..."
        searchKeys={['name', 'store_code', 'city', 'state', 'channel', 'owner_name']}
        pageSize={10}
      />
    </div>
  );
}
