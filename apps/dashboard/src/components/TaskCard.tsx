'use client';

import React from 'react';
import { Badge } from '@opensalesai/ui';
import type { BadgeVariant } from '@opensalesai/ui';
import {
  TaskType,
  TaskStatus,
  TaskPriority,
  TaskSource,
} from '@opensalesai/shared';
import { cn } from '@/lib/utils';

export interface TaskCardTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  title: string;
  ai_reasoning: string | null;
  priority_score: number;
  points_reward: number;
  scheduled_date: string;
}

export interface TaskCardProps {
  task: TaskCardTask;
  storeName?: string;
  repName?: string;
  onComplete?: (id: string) => void;
}

const priorityBorderColor: Record<TaskPriority, string> = {
  [TaskPriority.CRITICAL]: 'border-l-red-500',
  [TaskPriority.HIGH]: 'border-l-orange-500',
  [TaskPriority.MEDIUM]: 'border-l-blue-500',
  [TaskPriority.LOW]: 'border-l-gray-400',
};

const priorityBadgeVariant: Record<TaskPriority, BadgeVariant> = {
  [TaskPriority.CRITICAL]: 'danger',
  [TaskPriority.HIGH]: 'warning',
  [TaskPriority.MEDIUM]: 'info',
  [TaskPriority.LOW]: 'neutral',
};

const taskTypeBadgeVariant: Record<TaskType, BadgeVariant> = {
  [TaskType.VISIT]: 'info',
  [TaskType.ORDER]: 'success',
  [TaskType.COLLECTION]: 'danger',
  [TaskType.MERCHANDISING]: 'purple',
  [TaskType.SURVEY]: 'neutral',
  [TaskType.PROMOTION]: 'warning',
  [TaskType.NEW_OUTLET]: 'success',
  [TaskType.COACHING]: 'purple',
  [TaskType.STOCK_CHECK]: 'warning',
  [TaskType.RELATIONSHIP]: 'info',
};

const statusBadgeVariant: Record<TaskStatus, BadgeVariant> = {
  [TaskStatus.PENDING]: 'warning',
  [TaskStatus.IN_PROGRESS]: 'info',
  [TaskStatus.COMPLETED]: 'success',
  [TaskStatus.SKIPPED]: 'neutral',
  [TaskStatus.CANCELLED]: 'danger',
  [TaskStatus.EXPIRED]: 'danger',
};

const formatTaskType = (type: TaskType): string =>
  type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatStatus = (status: TaskStatus): string =>
  status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  storeName,
  repName,
  onComplete,
}) => {
  const canComplete =
    task.status === TaskStatus.PENDING ||
    task.status === TaskStatus.IN_PROGRESS;

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm',
        'border-l-4',
        priorityBorderColor[task.priority],
        'hover:shadow-md transition-shadow'
      )}
    >
      <div className="p-4 space-y-3">
        {/* Top row: badges */}
        <div className="flex items-center flex-wrap gap-2">
          <Badge variant={taskTypeBadgeVariant[task.type]} size="sm">
            {formatTaskType(task.type)}
          </Badge>
          <Badge variant={priorityBadgeVariant[task.priority]} size="sm">
            {task.priority}
          </Badge>
          <Badge variant="success" size="sm">
            +{task.points_reward} pts
          </Badge>
          {task.source === TaskSource.AI_GENERATED && (
            <Badge variant="purple" size="sm">
              AI
            </Badge>
          )}
          <div className="ml-auto">
            <Badge variant={statusBadgeVariant[task.status]} size="sm" dot>
              {formatStatus(task.status)}
            </Badge>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
          {task.title}
        </h3>

        {/* AI Reasoning */}
        {task.ai_reasoning && (
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            {/* Sparkle icon */}
            <svg
              className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
            </svg>
            <p className="text-xs italic text-gray-600 dark:text-gray-400 leading-relaxed">
              {task.ai_reasoning}
            </p>
          </div>
        )}

        {/* Bottom row: meta info */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {storeName && (
            <span className="flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              {storeName}
            </span>
          )}
          {repName && (
            <span className="flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {repName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {task.scheduled_date}
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            Score: {task.priority_score}
          </span>
        </div>

        {/* Complete button */}
        {canComplete && onComplete && (
          <div className="pt-1">
            <button
              onClick={() => onComplete(task.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

TaskCard.displayName = 'TaskCard';
