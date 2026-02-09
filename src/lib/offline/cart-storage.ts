// Cart storage for offline cart persistence
// Saves cart to localStorage for restoration

const CART_STORAGE_KEY = "offline_cart_v1";
const CART_META_KEY = "offline_cart_meta_v1";

export interface CartMeta {
  savedAt: number;
  isOffline: boolean;
  customerId?: number | null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Save cart to localStorage
 */
export async function saveCartToStorage(
  items: any[],
  customerId?: number | null
): Promise<void> {
  if (!isBrowser()) return; // SSR / non-browser

  // IMPORTANT: meta must be defined OUTSIDE try so it's in scope for retry too
  const meta: CartMeta = {
    savedAt: Date.now(),
    isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
    customerId: customerId ?? null,
  };

  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items ?? []));
    localStorage.setItem(CART_META_KEY, JSON.stringify(meta));
  } catch (error) {
    console.error("Failed to save cart to storage:", error);

    // Storage might be full - try clearing old data then save again
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_META_KEY);

      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items ?? []));
      localStorage.setItem(CART_META_KEY, JSON.stringify(meta));
    } catch (retryError) {
      console.error("Failed to save cart after retry:", retryError);
    }
  }
}

/**
 * Load cart from localStorage
 */
export async function loadCartFromStorage(): Promise<{
  items: any[];
  meta: CartMeta | null;
}> {
  if (!isBrowser()) return { items: [], meta: null };

  try {
    const itemsJson = localStorage.getItem(CART_STORAGE_KEY);
    const metaJson = localStorage.getItem(CART_META_KEY);

    const parsedItems = itemsJson ? JSON.parse(itemsJson) : [];
    const parsedMeta = metaJson ? (JSON.parse(metaJson) as CartMeta) : null;

    return { items: Array.isArray(parsedItems) ? parsedItems : [], meta: parsedMeta };
  } catch (error) {
    console.error("Failed to load cart from storage:", error);
    return { items: [], meta: null };
  }
}

/**
 * Clear cart from storage
 */
export async function clearCartStorage(): Promise<void> {
  if (!isBrowser()) return;

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
  if (!isBrowser()) return false;

  try {
    return !!localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return false;
  }
}

/**
 * Get cart metadata
 */
export async function getCartMeta(): Promise<CartMeta | null> {
  if (!isBrowser()) return null;

  try {
    const metaJson = localStorage.getItem(CART_META_KEY);
    return metaJson ? (JSON.parse(metaJson) as CartMeta) : null;
  } catch {
    return null;
  }
}
