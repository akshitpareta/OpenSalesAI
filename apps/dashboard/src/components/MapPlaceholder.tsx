'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface MapPlaceholderProps {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
}

export const MapPlaceholder: React.FC<MapPlaceholderProps> = ({
  lat,
  lng,
  label,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-8',
        className
      )}
    >
      {/* Map Pin Icon */}
      <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        <svg
          className="h-8 w-8 text-blue-500 dark:text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>

      {label && (
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 text-center">
          {label}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <span>Lat: {lat.toFixed(4)}</span>
        <span className="h-3 w-px bg-gray-300 dark:bg-gray-600" />
        <span>Lng: {lng.toFixed(4)}</span>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Map view requires Mapbox API key
      </p>
    </div>
  );
};

MapPlaceholder.displayName = 'MapPlaceholder';
