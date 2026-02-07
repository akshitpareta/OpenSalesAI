import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import axios from 'axios';

const QUEUE_STORAGE_KEY = '@opensalesai:offline_queue';
const SYNC_STATUS_KEY = '@opensalesai:sync_status';

export interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  data?: unknown;
  headers?: Record<string, string>;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  pendingCount: number;
  isSyncing: boolean;
  lastError: string | null;
}

/**
 * Generates a simple UUID-like ID for queued requests.
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * OfflineQueue manages API requests that fail due to network unavailability.
 * Requests are persisted in AsyncStorage and automatically flushed
 * when connectivity is restored.
 */
class OfflineQueue {
  private isProcessing = false;
  private unsubscribeNetInfo: (() => void) | null = null;

  /**
   * Initialize listeners for connectivity changes and app state changes.
   * Call this once at app startup.
   */
  init(): void {
    // Listen for network connectivity changes
    this.unsubscribeNetInfo = NetInfo.addEventListener(
      (state: NetInfoState) => {
        if (state.isConnected && state.isInternetReachable) {
          this.flush();
        }
      }
    );

    // Listen for app coming to foreground
    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        this.flush();
      }
    });
  }

  /**
   * Tear down listeners. Call on app shutdown or unmount.
   */
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
  }

  /**
   * Add a request to the offline queue.
   */
  async enqueue(request: {
    method: string;
    url: string;
    data?: unknown;
    headers?: Record<string, string>;
  }): Promise<void> {
    const queue = await this.getQueue();

    const queuedRequest: QueuedRequest = {
      id: generateId(),
      method: request.method,
      url: request.url,
      data: request.data,
      headers: request.headers,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 5,
    };

    queue.push(queuedRequest);
    await this.saveQueue(queue);
    await this.updateSyncStatus({ pendingCount: queue.length });
  }

  /**
   * Process all queued requests in order (FIFO).
   * Failed requests are re-queued with incremented retry count.
   */
  async flush(): Promise<void> {
    if (this.isProcessing) return;

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) return;

    this.isProcessing = true;
    await this.updateSyncStatus({ isSyncing: true, lastError: null });

    try {
      const queue = await this.getQueue();
      if (queue.length === 0) {
        this.isProcessing = false;
        await this.updateSyncStatus({ isSyncing: false });
        return;
      }

      const failedRequests: QueuedRequest[] = [];

      for (const request of queue) {
        try {
          await axios({
            method: request.method,
            url: request.url,
            data: request.data,
            headers: {
              ...request.headers,
              'X-Offline-Queued': 'true',
              'X-Offline-Timestamp': request.timestamp,
            },
            timeout: 30000,
          });
        } catch (error) {
          if (request.retryCount < request.maxRetries) {
            failedRequests.push({
              ...request,
              retryCount: request.retryCount + 1,
            });
          }
          // Exceeded max retries — drop the request silently
        }
      }

      await this.saveQueue(failedRequests);
      await this.updateSyncStatus({
        lastSyncAt: new Date().toISOString(),
        pendingCount: failedRequests.length,
        isSyncing: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      await this.updateSyncStatus({
        isSyncing: false,
        lastError: message,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get the current queue from AsyncStorage.
   */
  async getQueue(): Promise<QueuedRequest[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get the current sync status.
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const raw = await AsyncStorage.getItem(SYNC_STATUS_KEY);
      if (raw) return JSON.parse(raw) as SyncStatus;
    } catch {
      // Fall through to default
    }
    return {
      lastSyncAt: null,
      pendingCount: 0,
      isSyncing: false,
      lastError: null,
    };
  }

  /**
   * Get count of pending queued requests.
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Clear the entire offline queue (e.g., on logout).
   */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    await this.updateSyncStatus({
      pendingCount: 0,
      isSyncing: false,
      lastError: null,
    });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async saveQueue(queue: QueuedRequest[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }

  private async updateSyncStatus(partial: Partial<SyncStatus>): Promise<void> {
    const current = await this.getSyncStatus();
    const updated = { ...current, ...partial };
    await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updated));
  }
}

export const offlineQueue = new OfflineQueue();
