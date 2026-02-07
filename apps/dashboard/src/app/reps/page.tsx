'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '@opensalesai/ui';
import type { BadgeVariant } from '@opensalesai/ui';
import { SkillTier, RepRole } from '@opensalesai/shared';
import { DataTable, type Column } from '@/components/DataTable';
import { formatINR, getInitials, stringToColor } from '@/lib/utils';
import { mockReps } from '@/lib/mock-data';

type FilterTab = 'all' | 'active' | 'inactive';

// Territory ID to human-readable name mapping
const territoryNames: Record<string, string> = {
  'territory-mumbai': 'Mumbai',
  'territory-delhi': 'Delhi',
  'territory-bangalore': 'Bangalore',
  'territory-chennai': 'Chennai',
  'territory-kolkata': 'Kolkata',
};

const getTerritoryName = (id: string | null): string =>
  id ? territoryNames[id] ?? id : 'Unassigned';

// Row type for DataTable
interface RepRow {
  id: string;
  name: string;
  employee_code: string;
  territory: string;
  skill_tier: string;
  role: string;
  points_balance: number;
  is_active: boolean;
  [key: string]: unknown;
}

const skillTierVariant: Record<string, BadgeVariant> = {
  [SkillTier.EXPERT]: 'purple',
  [SkillTier.SENIOR]: 'info',
  [SkillTier.INTERMEDIATE]: 'success',
  [SkillTier.JUNIOR]: 'warning',
  [SkillTier.TRAINEE]: 'neutral',
};

const roleLabels: Record<string, string> = {
  [RepRole.SALES_REP]: 'Sales Rep',
  [RepRole.TEAM_LEAD]: 'Team Lead',
  [RepRole.AREA_MANAGER]: 'Area Manager',
  [RepRole.REGIONAL_MANAGER]: 'Regional Mgr',
};

const columns: Column<RepRow>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    render: (row) => {
      const initials = getInitials(row.name);
      const bgColor = stringToColor(row.name);
      return (
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {row.name}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    key: 'employee_code',
    header: 'Emp Code',
    sortable: true,
    width: '100px',
    render: (row) => (
      <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
        {row.employee_code}
      </span>
    ),
  },
  {
    key: 'territory',
    header: 'Territory',
    sortable: true,
  },
  {
    key: 'skill_tier',
    header: 'Skill Tier',
    sortable: true,
    render: (row) => (
      <Badge variant={skillTierVariant[row.skill_tier] || 'neutral'} size="sm">
        {row.skill_tier}
      </Badge>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {roleLabels[row.role] || row.role}
      </span>
    ),
  },
  {
    key: 'points_balance',
    header: 'Points',
    sortable: true,
    render: (row) => (
      <span className="font-semibold text-amber-600 dark:text-amber-400">
        {row.points_balance.toLocaleString('en-IN')}
      </span>
    ),
    accessor: (row) => row.points_balance,
  },
  {
    key: 'is_active',
    header: 'Status',
    sortable: true,
    render: (row) => (
      <Badge
        variant={row.is_active ? 'success' : 'danger'}
        size="sm"
        dot
      >
        {row.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
    accessor: (row) => (row.is_active ? 1 : 0),
  },
];

export default function RepsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('all');

  const allRows: RepRow[] = useMemo(
    () =>
      mockReps.map((r) => ({
        id: r.id,
        name: r.name,
        employee_code: r.employee_code,
        territory: getTerritoryName(r.territory_id),
        skill_tier: r.skill_tier,
        role: r.role,
        points_balance: r.points_balance,
        is_active: r.is_active,
      })),
    []
  );

  const filteredData = useMemo(() => {
    if (filter === 'active') return allRows.filter((r) => r.is_active);
    if (filter === 'inactive') return allRows.filter((r) => !r.is_active);
    return allRows;
  }, [filter, allRows]);

  const activeCount = allRows.filter((r) => r.is_active).length;
  const inactiveCount = allRows.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title">Sales Reps</h1>
        <p className="page-subtitle">Manage your sales team</p>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === 'all' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({allRows.length})
        </Button>
        <Button
          variant={filter === 'active' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('active')}
        >
          Active ({activeCount})
        </Button>
        <Button
          variant={filter === 'inactive' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setFilter('inactive')}
        >
          Inactive ({inactiveCount})
        </Button>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={filteredData}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => router.push(`/reps/${row.id}`)}
        searchable
        searchPlaceholder="Search reps by name, territory, code..."
        searchKeys={['name', 'territory', 'employee_code', 'skill_tier', 'role']}
        pageSize={10}
      />
    </div>
  );
}
