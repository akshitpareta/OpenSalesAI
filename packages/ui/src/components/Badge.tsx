'use client';

import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'purple';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  danger:
    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  warning:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  info:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  neutral:
    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  purple:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

const dotVariantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-500',
  danger: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-500',
  purple: 'bg-purple-500',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className = '',
}) => {
  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={`mr-1.5 h-1.5 w-1.5 rounded-full ${dotVariantClasses[variant]}`}
        />
      )}
      {children}
    </span>
  );
};

Badge.displayName = 'Badge';
