'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, type User } from '@/lib/store';
import api from '@/lib/api';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  user: User;
  token: string;
}

export function useAuth() {
  const router = useRouter();
  const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await api.post<LoginResponse>(
        '/api/v1/auth/login',
        credentials
      );
      setAuth(response.user, response.token);
      router.push('/');
    },
    [setAuth, router]
  );

  const loginWithKeycloak = useCallback(() => {
    const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080';
    const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'opensalesai';
    const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'dashboard';
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/api/auth/callback`
    );

    window.location.href = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid profile email`;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    router.push('/login');
  }, [clearAuth, router]);

  const refreshToken = useCallback(async () => {
    try {
      const response = await api.post<LoginResponse>('/api/v1/auth/refresh');
      setAuth(response.user, response.token);
    } catch {
      clearAuth();
      router.push('/login');
    }
  }, [setAuth, clearAuth, router]);

  return {
    user,
    token,
    isAuthenticated,
    login,
    loginWithKeycloak,
    logout,
    refreshToken,
  };
}
