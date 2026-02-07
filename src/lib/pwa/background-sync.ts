// PWA Background Sync
// Handles background data synchronization when connection is restored

export interface SyncTask {
  id: string;
  type: 'invoice' | 'inventory' | 'prescription' | 'payment' | 'stock';
  data: any;
  timestamp: Date;
  retries: number;
}

export class BackgroundSyncManager {
  private syncQueue: SyncTask[] = [];
  private isOnline: boolean = true;
  private syncHandlers: Map<string, (task: SyncTask) => Promise<void>> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
      this.loadSyncQueue();
    }
  }

  private setupEventListeners() {
    // Online/offline detection
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Service worker sync event
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Listen for sync events from service worker
        (registration as any).addEventListener('sync', (event: any) => {
          if (event.tag === 'background-sync') {
            this.processSyncQueue();
          }
        });
      });
    }
  }

  /**
   * Register sync handler for a task type
   */
  registerHandler(type: SyncTask['type'], handler: (task: SyncTask) => Promise<void>) {
    this.syncHandlers.set(type, handler);
  }

  /**
   * Add task to sync queue
   */
  async addToQueue(task: Omit<SyncTask, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const syncTask: SyncTask = {
      ...task,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retries: 0,
    };

    this.syncQueue.push(syncTask);
    await this.saveSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      await this.processSyncQueue();
    } else {
      // Request background sync from service worker
      await this.requestBackgroundSync();
    }

    return syncTask.id;
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const tasksToProcess = [...this.syncQueue];
    this.syncQueue = [];

    for (const task of tasksToProcess) {
      try {
        const handler = this.syncHandlers.get(task.type);
        if (handler) {
          await handler(task);
          // Remove from queue on success
          await this.removeFromQueue(task.id);
        } else {
          // No handler, keep in queue
          this.syncQueue.push(task);
        }
      } catch (error) {
        console.error(`Error syncing task ${task.id}:`, error);
        task.retries++;
        
        // Retry up to 3 times
        if (task.retries < 3) {
          this.syncQueue.push(task);
        } else {
          // Max retries reached, remove from queue
          console.error(`Task ${task.id} failed after ${task.retries} retries`);
          await this.removeFromQueue(task.id);
        }
      }
    }

    await this.saveSyncQueue();
  }

  /**
   * Request background sync from service worker
   */
  private async requestBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in (ServiceWorkerRegistration.prototype as any)) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('background-sync');
      } catch (error) {
        console.error('Error registering background sync:', error);
      }
    }
  }

  /**
   * Remove task from queue
   */
  private async removeFromQueue(taskId: string): Promise<void> {
    this.syncQueue = this.syncQueue.filter((task) => task.id !== taskId);
    await this.saveSyncQueue();
  }

  /**
   * Get sync queue status
   */
  getQueueStatus(): {
    total: number;
    byType: Record<string, number>;
    oldestTask: Date | null;
  } {
    const byType: Record<string, number> = {};
    let oldestTask: Date | null = null;

    for (const task of this.syncQueue) {
      byType[task.type] = (byType[task.type] || 0) + 1;
      if (!oldestTask || task.timestamp < oldestTask) {
        oldestTask = task.timestamp;
      }
    }

    return {
      total: this.syncQueue.length,
      byType,
      oldestTask,
    };
  }

  /**
   * Save sync queue to IndexedDB
   */
  private async saveSyncQueue(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return;
    }

    try {
      const db = await this.openDB();
      const tx = db.transaction(['syncQueue'], 'readwrite');
      const store = tx.objectStore('syncQueue');
      
      // Clear existing
      await store.clear();
      
      // Add all tasks
      for (const task of this.syncQueue) {
        await store.add(task);
      }
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  /**
   * Load sync queue from IndexedDB
   */
  private async loadSyncQueue(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return;
    }

    try {
      const db = await this.openDB();
      const tx = db.transaction(['syncQueue'], 'readonly');
      const store = tx.objectStore('syncQueue');
      const allTasks = await store.getAll();
      
      this.syncQueue = allTasks.map((task) => ({
        ...task,
        timestamp: new Date(task.timestamp),
      }));
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  /**
   * Open IndexedDB for sync queue
   */
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('pharmapulse-sync', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
}

// Singleton instance
let backgroundSyncInstance: BackgroundSyncManager | null = null;

export function getBackgroundSyncManager(): BackgroundSyncManager {
  if (!backgroundSyncInstance) {
    backgroundSyncInstance = new BackgroundSyncManager();
  }
  return backgroundSyncInstance;
}
