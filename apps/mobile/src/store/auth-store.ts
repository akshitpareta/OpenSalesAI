import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  territory_id: string;
  territory_name: string;
  company_id: string;
  company_name: string;
  skill_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  points_balance: number;
  avatar_url: string | null;
  preferred_language: 'en' | 'hi';
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  updatePoints: (points: number) => void;
  setLanguage: (language: 'en' | 'hi') => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,

  setUser: (user) =>
    set({ user, isAuthenticated: true }),

  setToken: (token) =>
    set({ token }),

  setRefreshToken: (refreshToken) =>
    set({ refreshToken }),

  login: (user, token, refreshToken) =>
    set({
      user,
      token,
      refreshToken,
      isAuthenticated: true,
      isLoading: false,
    }),

  logout: () =>
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    }),

  updatePoints: (points) =>
    set((state) => ({
      user: state.user
        ? { ...state.user, points_balance: state.user.points_balance + points }
        : null,
    })),

  setLanguage: (language) =>
    set((state) => ({
      user: state.user ? { ...state.user, preferred_language: language } : null,
    })),

  setLoading: (isLoading) =>
    set({ isLoading }),
}));
