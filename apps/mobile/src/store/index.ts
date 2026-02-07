/**
 * OpenSalesAI Mobile — Combined Zustand Store Exports
 *
 * All Zustand stores are created as individual slices for modularity.
 * Import from this barrel file for convenience.
 */

export { useAuthStore } from './auth-store';
export type { User } from './auth-store';

export { useTaskStore } from './task-store';
export type { Task } from './task-store';

export { useLocationStore } from './location-store';
export type { Coordinates } from './location-store';
