// Cart storage for offline cart persistence
// Saves cart to localStorage for restoration

const CART_STORAGE_KEY = 'offline_cart_v1';
const CART_META_KEY = 'offline_cart_meta_v1';

interface CartMeta {
  savedAt: number;
  isOffline: boolean;
  customerId?: number | null;
}

/**
 * Save cart to localStorage
 */
export async function saveCartToStorage(items: any[], customerId?: number | null): Promise<void> {
  if (typeof localStorage === 'undefined') {
    return; // SSR
  }

  try {
    const meta: CartMeta = {
      savedAt: Date.now(),
      isOffline: !navigator.onLine,
      customerId: customerId || null,
    };
    
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    localStorage.setItem(CART_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.error("Failed to save cart to storage:", error);
    // Storage might be full - try clearing old data
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_META_KEY);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      localStorage.setItem(CART_META_KEY, JSON.stringify(meta));
    } catch (retryError) {
      console.error("Failed to save cart after retry:", retryError);
    }
  }
}

/**
 * Load cart from localStorage
 */
export async function loadCartFromStorage(): Promise<{ items: any[]; meta: CartMeta | null }> {
  if (typeof localStorage === 'undefined') {
    return { items: [], meta: null };
  }

  try {
    const itemsJson = localStorage.getItem(CART_STORAGE_KEY);
    const metaJson = localStorage.getItem(CART_META_KEY);
    
    const items = itemsJson ? JSON.parse(itemsJson) : [];
    const meta = metaJson ? JSON.parse(metaJson) : null;
    
    return { items: Array.isArray(items) ? items : [], meta };
  } catch (error) {
    console.error("Failed to load cart from storage:", error);
    return { items: [], meta: null };
  }
}

/**
 * Clear cart from storage
 */
export async function clearCartStorage(): Promise<void> {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(CART_META_KEY);
  } catch (error) {
    console.error("Failed to clear cart storage:", error);
  }
}

/**
 * Check if there's a saved cart
 */
export async function hasSavedCart(): Promise<boolean> {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  try {
    const itemsJson = localStorage.getItem(CART_STORAGE_KEY);
    return !!itemsJson;
  } catch (error) {
    return false;
  }
}

/**
 * Get cart metadata
 */
export async function getCartMeta(): Promise<CartMeta | null> {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const metaJson = localStorage.getItem(CART_META_KEY);
    return metaJson ? JSON.parse(metaJson) : null;
  } catch (error) {
    return null;
  }
}
