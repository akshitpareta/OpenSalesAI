'use client';

import React, { useState, useMemo } from 'react';
import { Select, useToast } from '@opensalesai/ui';
import type { SelectOption } from '@opensalesai/ui';
import {
  TaskType,
  TaskStatus,
  TaskPriority,
} from '@opensalesai/shared';
import { TaskCard } from '@/components/TaskCard';
import type { TaskCardTask } from '@/components/TaskCard';
import { mockTasks, mockStores, mockReps } from '@/lib/mock-data';

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

const storeNameMap = new Map(mockStores.map((s) => [s.id, s.name]));
const repNameMap = new Map(mockReps.map((r) => [r.id, r.name]));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatTaskType = (type: TaskType): string =>
  type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const toDateStr = (d: Date): string => {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

type SortKey = 'priority_score' | 'scheduled_date' | 'created_at';

const sortOptions: SelectOption[] = [
  { value: 'priority_score', label: 'Priority Score' },
  { value: 'scheduled_date', label: 'Scheduled Date' },
  { value: 'created_at', label: 'Created Date' },
];

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const statusOptions: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  ...Object.values(TaskStatus).map((s) => ({
    value: s,
    label: s
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  })),
];

const priorityOptions: SelectOption[] = [
  { value: '', label: 'All Priorities' },
  ...Object.values(TaskPriority).map((p) => ({
    value: p,
    label: p.charAt(0) + p.slice(1).toLowerCase(),
  })),
];

const typeOptions: SelectOption[] = [
  { value: '', label: 'All Types' },
  ...Object.values(TaskType).map((t) => ({
    value: t,
    label: formatTaskType(t),
  })),
];

const repOptions: SelectOption[] = [
  { value: '', label: 'All Reps' },
  ...mockReps.map((r) => ({ value: r.id, label: r.name })),
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function TasksPage() {
  const { addToast } = useToast();

  // Local state for task completion (optimistic UI)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [repFilter, setRepFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('priority_score');

  // Compute effective tasks (apply local completions)
  const effectiveTasks = useMemo(() => {
    return mockTasks.map((t) => {
      if (completedIds.has(t.id) && t.status !== TaskStatus.COMPLETED) {
        return { ...t, status: TaskStatus.COMPLETED };
      }
      return t;
    });
  }, [completedIds]);

  // Stats
  const stats = useMemo(() => {
    const total = effectiveTasks.length;
    const completed = effectiveTasks.filter(
      (t) => t.status === TaskStatus.COMPLETED
    ).length;
    const inProgress = effectiveTasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS
    ).length;
    const pending = effectiveTasks.filter(
      (t) => t.status === TaskStatus.PENDING
    ).length;
    return { total, completed, inProgress, pending };
  }, [effectiveTasks]);

  // Filtered + sorted tasks
  const filteredTasks = useMemo(() => {
    let tasks = effectiveTasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (typeFilter && t.type !== typeFilter) return false;
      if (repFilter && t.rep_id !== repFilter) return false;
      return true;
    });

    // Sort
    tasks = [...tasks].sort((a, b) => {
      switch (sortBy) {
        case 'priority_score':
          return b.priority_score - a.priority_score;
        case 'scheduled_date':
          return (
            new Date(b.scheduled_date).getTime() -
            new Date(a.scheduled_date).getTime()
          );
        case 'created_at':
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        default:
          return 0;
      }
    });

    return tasks;
  }, [effectiveTasks, statusFilter, priorityFilter, typeFilter, repFilter, sortBy]);

  // Handle task completion
  const handleComplete = (taskId: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    const task = mockTasks.find((t) => t.id === taskId);
    addToast({
      type: 'success',
      title: 'Task Completed',
      description: task
        ? `"${task.title}" marked as done. +${task.points_reward} points earned!`
        : 'Task marked as completed.',
      duration: 4000,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="page-title">AI Task Management</h1>
        <p className="page-subtitle">
          AI-generated and manager-assigned tasks for your sales team
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card card-padding text-center">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Total Tasks
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {stats.total}
          </p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
            Completed
          </p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
            {stats.completed}
          </p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            In Progress
          </p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
            {stats.inProgress}
          </p>
        </div>
        <div className="card card-padding text-center">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Pending
          </p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {stats.pending}
          </p>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-4">
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
            options={priorityOptions}
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v as string)}
            placeholder="All Priorities"
            label="Priority"
          />
        </div>
        <div className="w-40">
          <Select
            options={typeOptions}
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as string)}
            placeholder="All Types"
            label="Type"
          />
        </div>
        <div className="w-48">
          <Select
            options={repOptions}
            value={repFilter}
            onChange={(v) => setRepFilter(v as string)}
            placeholder="All Reps"
            label="Rep"
          />
        </div>
        <div className="w-44 ml-auto">
          <Select
            options={sortOptions}
            value={sortBy}
            onChange={(v) => setSortBy(v as SortKey)}
            label="Sort By"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredTasks.length} of {stats.total} tasks
        </p>
        {(statusFilter || priorityFilter || typeFilter || repFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
              setTypeFilter('');
              setRepFilter('');
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Task grid */}
      {filteredTasks.length === 0 ? (
        <div className="card card-padding text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            No tasks found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your filters to see more results.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const cardTask: TaskCardTask = {
              id: task.id,
              type: task.type,
              status: task.status,
              priority: task.priority,
              source: task.source,
              title: task.title,
              ai_reasoning: task.ai_reasoning,
              priority_score: task.priority_score,
              points_reward: task.points_reward,
              scheduled_date: toDateStr(task.scheduled_date),
            };

            return (
              <TaskCard
                key={task.id}
                task={cardTask}
                storeName={storeNameMap.get(task.store_id)}
                repName={repNameMap.get(task.rep_id)}
                onComplete={handleComplete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
