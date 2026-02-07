import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { authService } from './auth';
import { offlineQueue } from './offline';

/** Base URL — reads from env or defaults to local gateway */
const BASE_URL = 'http://10.0.2.2:3000/api'; // Android emulator → host machine

/** Maximum retry attempts for failed requests */
const MAX_RETRIES = 3;

/** Delay between retries (ms) — exponential backoff base */
const RETRY_DELAY_MS = 1000;

/**
 * Central Axios instance used by all API calls.
 * Includes auth token injection, automatic retry with exponential backoff,
 * token refresh on 401, and offline queue fallback.
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Request interceptor — injects Bearer token from AsyncStorage
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await authService.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

/**
 * Response interceptor — handles 401 token refresh and retry logic
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _retryCount?: number;
    };

    // If no network, queue the request for later
    if (!error.response && error.message === 'Network Error') {
      if (originalRequest.method && ['post', 'put', 'patch', 'delete'].includes(originalRequest.method)) {
        await offlineQueue.enqueue({
          method: originalRequest.method,
          url: originalRequest.url ?? '',
          data: originalRequest.data,
          headers: originalRequest.headers as Record<string, string>,
        });
      }
      return Promise.reject(new Error('Request queued for offline sync'));
    }

    // Handle 401 — attempt token refresh exactly once
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await authService.refreshToken();
        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — force logout
        await authService.logout();
        return Promise.reject(error);
      }
    }

    // Retry on 5xx or network timeout with exponential backoff
    const retryCount = originalRequest._retryCount ?? 0;
    const isServerError = error.response && error.response.status >= 500;
    const isTimeout = error.code === 'ECONNABORTED';

    if ((isServerError || isTimeout) && retryCount < MAX_RETRIES) {
      originalRequest._retryCount = retryCount + 1;
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

// ─── Convenience API Methods ─────────────────────────────────────────────────

/** Generic GET */
export const apiGet = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const response = await apiClient.get<T>(url, { params });
  return response.data;
};

/** Generic POST */
export const apiPost = async <T>(url: string, data?: unknown): Promise<T> => {
  const response = await apiClient.post<T>(url, data);
  return response.data;
};

/** Generic PUT */
export const apiPut = async <T>(url: string, data?: unknown): Promise<T> => {
  const response = await apiClient.put<T>(url, data);
  return response.data;
};

/** Generic PATCH */
export const apiPatch = async <T>(url: string, data?: unknown): Promise<T> => {
  const response = await apiClient.patch<T>(url, data);
  return response.data;
};

/** Generic DELETE */
export const apiDelete = async <T>(url: string): Promise<T> => {
  const response = await apiClient.delete<T>(url);
  return response.data;
};

export { apiClient };
export default apiClient;
