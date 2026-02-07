import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import type { User } from '../store/auth-store';

const STORAGE_KEYS = {
  TOKEN: '@opensalesai:token',
  REFRESH_TOKEN: '@opensalesai:refresh_token',
  USER: '@opensalesai:user',
} as const;

/** Base URL for auth endpoints */
const AUTH_BASE_URL = 'http://10.0.2.2:3000/api/auth';

export interface LoginRequest {
  phone: string;
  otp: string;
  company_code?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refresh_token: string;
  expires_in: number;
}

export interface OTPRequest {
  phone: string;
}

class AuthService {
  /**
   * Request OTP to be sent to phone number.
   */
  async requestOTP(phone: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post<{ success: boolean; message: string }>(
        `${AUTH_BASE_URL}/otp/request`,
        { phone }
      );
      return response.data;
    } catch (error) {
      throw new Error('Failed to send OTP. Please try again.');
    }
  }

  /**
   * Verify OTP and log in. Stores token and user in AsyncStorage.
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${AUTH_BASE_URL}/otp/verify`,
        request
      );

      const { user, token, refresh_token } = response.data;

      // Persist session
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
      ]);

      return response.data;
    } catch (error) {
      throw new Error('Invalid OTP. Please try again.');
    }
  }

  /**
   * Keycloak SSO login (alternative to OTP).
   */
  async loginWithKeycloak(authCode: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${AUTH_BASE_URL}/keycloak/callback`,
        { code: authCode }
      );

      const { user, token, refresh_token } = response.data;

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user)),
      ]);

      return response.data;
    } catch (error) {
      throw new Error('SSO login failed. Please try again.');
    }
  }

  /**
   * Refresh expired access token using the stored refresh token.
   * Returns the new access token or null if refresh fails.
   */
  async refreshToken(): Promise<string | null> {
    try {
      const storedRefresh = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!storedRefresh) return null;

      const response = await axios.post<{ token: string; refresh_token: string }>(
        `${AUTH_BASE_URL}/token/refresh`,
        { refresh_token: storedRefresh }
      );

      const { token, refresh_token } = response.data;

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token),
      ]);

      return token;
    } catch {
      // Refresh failed — clear all auth data
      await this.logout();
      return null;
    }
  }

  /**
   * Get the stored access token.
   */
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  /**
   * Get the stored user profile.
   */
  async getStoredUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userJson ? (JSON.parse(userJson) as User) : null;
    } catch {
      return null;
    }
  }

  /**
   * Update stored user profile (e.g., after points change).
   */
  async updateStoredUser(user: User): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  /**
   * Clear all auth data from AsyncStorage and revoke server session.
   */
  async logout(): Promise<void> {
    try {
      const token = await this.getToken();
      if (token) {
        await axios.post(
          `${AUTH_BASE_URL}/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {
          // Server logout failure is non-blocking
        });
      }
    } finally {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER,
      ]);
    }
  }

  /**
   * Check if a valid token exists (does NOT validate expiry — server does that).
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }
}

export const authService = new AuthService();
