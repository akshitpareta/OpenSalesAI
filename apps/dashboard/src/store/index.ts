import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  /** Current theme: 'light' or 'dark' */
  theme: 'light' | 'dark';
  /** Toggle between light and dark theme */
  toggleTheme: () => void;

  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Toggle sidebar collapsed/expanded */
  toggleSidebar: () => void;

  /** Currently selected territory filter (null = all) */
  selectedTerritory: string | null;
  /** Set the territory filter */
  setTerritory: (territory: string | null) => void;

  /** Date range filter */
  dateRange: { start: Date; end: Date };
  /** Set the date range filter */
  setDateRange: (range: { start: Date; end: Date }) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),

      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        })),

      selectedTerritory: null,
      setTerritory: (territory) => set({ selectedTerritory: territory }),

      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      setDateRange: (range) => set({ dateRange: range }),
    }),
    {
      name: 'opensalesai-dashboard',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
