// Product cache for offline barcode scanning
// Stores products in IndexedDB with barcode as key

const DB_NAME = 'pharmapulse_offline';
const STORE_NAME = 'product_cache';

interface CachedProduct {
  barcode: string;
  product: any;
  cachedAt: number;
  lastUpdated: number;
}

/**
 * Initialize IndexedDB and ensure product cache store exists
 */
async function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      
      // Check if store exists, create if not
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const version = db.version + 1;
        db.close();
        
        const upgradeRequest = indexedDB.open(DB_NAME, version);
        upgradeRequest.onupgradeneeded = (event) => {
          const upgradeDb = (event.target as IDBOpenDBRequest).result;
          if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
            const store = upgradeDb.createObjectStore(STORE_NAME, { keyPath: 'barcode' });
            store.createIndex('cachedAt', 'cachedAt', { unique: false });
            store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
          }
        };
        
        upgradeRequest.onsuccess = () => resolve(upgradeRequest.result);
        upgradeRequest.onerror = () => reject(upgradeRequest.error);
      } else {
        resolve(db);
      }
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'barcode' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
        store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
    };
  });
}

/**
 * Cache a product for offline lookup
 */
export async function cacheProduct(barcode: string, product: any): Promise<void> {
  if (typeof window === 'undefined' || !indexedDB) {
    return; // SSR or no IndexedDB support
  }

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const cached: CachedProduct = {
      barcode: barcode.trim(),
      product,
      cachedAt: Date.now(),
      lastUpdated: Date.now(),
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(cached);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Failed to cache product:", error);
    // Don't throw - caching is best effort
  }
}

/**
 * Get a cached product by barcode
 */
export async function getCachedProduct(barcode: string): Promise<any | null> {
  if (typeof window === 'undefined' || !indexedDB) {
    return null; // SSR or no IndexedDB support
  }

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.get(barcode.trim());
      request.onsuccess = () => {
        const cached = request.result as CachedProduct | undefined;
        if (cached && cached.product) {
          resolve(cached.product);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get cached product:", error);
    return null;
  }
}

/**
 * Bulk cache products (for pre-loading cache)
 */
export async function cacheProducts(products: Array<{ barcode: string; product: any }>): Promise<void> {
  if (typeof window === 'undefined' || !indexedDB) {
    return;
  }

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const now = Date.now();
    
    for (const { barcode, product } of products) {
      const cached: CachedProduct = {
        barcode: barcode.trim(),
        product,
        cachedAt: now,
        lastUpdated: now,
      };
      store.put(cached);
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Failed to bulk cache products:", error);
  }
}

/**
 * Clear old cache entries (older than maxAge ms)
 */
export async function clearOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  if (typeof window === 'undefined' || !indexedDB) {
    return;
  }

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('lastUpdated');
    
    const cutoff = Date.now() - maxAge;
    const range = IDBKeyRange.upperBound(cutoff);
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Failed to clear old cache:", error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; oldestCachedAt: number | null }> {
  if (typeof window === 'undefined' || !indexedDB) {
    return { count: 0, oldestCachedAt: null };
  }

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      let oldestCachedAt: number | null = null;
      
      const indexRequest = store.index('cachedAt').openCursor(null, 'next');
      
      indexRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (oldestCachedAt === null) {
            oldestCachedAt = cursor.value.cachedAt;
          }
          cursor.continue();
        } else {
          request.onsuccess = () => {
            resolve({
              count: request.result,
              oldestCachedAt,
            });
          };
        }
      };
      
      request.onerror = () => reject(request.error);
      indexRequest.onerror = () => reject(indexRequest.error);
    });
  } catch (error) {
    console.error("Failed to get cache stats:", error);
    return { count: 0, oldestCachedAt: null };
  }
}
