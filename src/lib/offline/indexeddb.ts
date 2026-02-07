// IndexedDB utilities for offline queue management

const DB_NAME = 'pharmapulse_offline';
const DB_VERSION = 1;

const STORES = {
  INVOICES: 'offline_invoices',
  EVENTS: 'offline_events',
  CACHE: 'inventory_cache',
};

export interface OfflineInvoiceEntry {
  localId: string;
  idempotencyKey: string;
  tenantId: number;
  deviceId: string;
  tokenId: string;
  invoiceData: any;
  status: 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED';
  createdAt: number;
  syncedAt?: number;
  serverInvoiceId?: number;
  conflictDetails?: any;
}

export interface OfflineEventEntry {
  localId: string;
  idempotencyKey: string;
  tenantId: number;
  deviceId: string;
  tokenId: string;
  eventType: 'STOCK_DECREMENT' | 'PAYMENT' | 'CREDIT_LEDGER';
  eventData: any;
  status: 'QUEUED' | 'SYNCING' | 'SYNCED' | 'FAILED';
  createdAt: number;
  syncedAt?: number;
}

/**
 * Initialize IndexedDB
 */
export async function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Offline invoices store
      if (!db.objectStoreNames.contains(STORES.INVOICES)) {
        const invoiceStore = db.createObjectStore(STORES.INVOICES, { keyPath: 'localId' });
        invoiceStore.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        invoiceStore.createIndex('status', 'status', { unique: false });
        invoiceStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Offline events store
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const eventStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'localId' });
        eventStore.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        eventStore.createIndex('status', 'status', { unique: false });
        eventStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Inventory cache store
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'productId' });
        cacheStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
    };
  });
}

/**
 * Save offline invoice to IndexedDB
 */
export async function saveOfflineInvoice(invoice: OfflineInvoiceEntry): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.INVOICES, 'readwrite');
    const store = tx.objectStore(STORES.INVOICES);
    const request = store.put(invoice);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

/**
 * Get all queued invoices
 */
export async function getQueuedInvoices(): Promise<OfflineInvoiceEntry[]> {
  const db = await initIndexedDB();
  const tx = db.transaction(STORES.INVOICES, 'readonly');
  const store = tx.objectStore(STORES.INVOICES);
  const index = store.index('status');
  const request = index.getAll('QUEUED');
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  localId: string,
  status: OfflineInvoiceEntry['status'],
  serverInvoiceId?: number,
  conflictDetails?: any
): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.INVOICES, 'readwrite');
    const store = tx.objectStore(STORES.INVOICES);
    const request = store.get(localId);

    request.onsuccess = () => {
      const invoice = request.result;
      if (invoice) {
        invoice.status = status;
        invoice.syncedAt = Date.now();
        if (serverInvoiceId) invoice.serverInvoiceId = serverInvoiceId;
        if (conflictDetails) invoice.conflictDetails = conflictDetails;
        const updateRequest = store.put(invoice);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve(); // Invoice not found, resolve anyway
      }
    };
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Save offline event to IndexedDB
 */
export async function saveOfflineEvent(event: OfflineEventEntry): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.EVENTS);
    const request = store.put(event);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });
}

/**
 * Get all queued events
 */
export async function getQueuedEvents(): Promise<OfflineEventEntry[]> {
  const db = await initIndexedDB();
  const tx = db.transaction(STORES.EVENTS, 'readonly');
  const store = tx.objectStore(STORES.EVENTS);
  const index = store.index('status');
  const request = index.getAll('QUEUED');
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear synced items
 */
export async function clearSyncedItems(): Promise<void> {
  const db = await initIndexedDB();
  
  return new Promise((resolve, reject) => {
    let completed = 0;
    const checkComplete = () => {
      completed++;
      if (completed === 2) resolve();
    };

    // Clear synced invoices
    const invoiceTx = db.transaction(STORES.INVOICES, 'readwrite');
    const invoiceStore = invoiceTx.objectStore(STORES.INVOICES);
    const invoiceIndex = invoiceStore.index('status');
    const invoiceRequest = invoiceIndex.openCursor('SYNCED');
    
    invoiceRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        invoiceStore.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        checkComplete();
      }
    };
    invoiceRequest.onerror = () => checkComplete();
    invoiceTx.onerror = () => checkComplete();

    // Clear synced events
    const eventTx = db.transaction(STORES.EVENTS, 'readwrite');
    const eventStore = eventTx.objectStore(STORES.EVENTS);
    const eventIndex = eventStore.index('status');
    const eventRequest = eventIndex.openCursor('SYNCED');
    
    eventRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        eventStore.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        checkComplete();
      }
    };
    eventRequest.onerror = () => checkComplete();
    eventTx.onerror = () => checkComplete();
  });
}
