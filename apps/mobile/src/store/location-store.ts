import { create } from 'zustand';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface LocationState {
  currentLocation: Coordinates | null;
  isTracking: boolean;
  watchId: number | null;
  lastError: string | null;
  locationHistory: Coordinates[];

  setCurrentLocation: (location: Coordinates) => void;
  setTracking: (isTracking: boolean) => void;
  setWatchId: (watchId: number | null) => void;
  setError: (error: string | null) => void;
  addToHistory: (location: Coordinates) => void;
  clearHistory: () => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: null,
  isTracking: false,
  watchId: null,
  lastError: null,
  locationHistory: [],

  setCurrentLocation: (location) =>
    set({ currentLocation: location, lastError: null }),

  setTracking: (isTracking) =>
    set({ isTracking }),

  setWatchId: (watchId) =>
    set({ watchId }),

  setError: (lastError) =>
    set({ lastError }),

  addToHistory: (location) =>
    set((state) => ({
      locationHistory: [...state.locationHistory.slice(-99), location],
    })),

  clearHistory: () =>
    set({ locationHistory: [] }),

  reset: () =>
    set({
      currentLocation: null,
      isTracking: false,
      watchId: null,
      lastError: null,
      locationHistory: [],
    }),
}));
