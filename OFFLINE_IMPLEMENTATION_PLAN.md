# Offline POS Implementation - Detailed Plan

## Status: In Progress

### ✅ **Completed**
1. **gstRate null error fix** - Added null checks in CheckoutModal.tsx

### 🚧 **In Progress**
1. **Offline detection integration in POS page**
2. **Offline barcode scanning with product cache**
3. **Offline cart persistence**
4. **Offline invoice queueing**
5. **Offline payment tracking**

---

## Implementation Details

### **Step 1: Offline Detection in POS Page** (Next)

**File:** `src/app/pos/page.tsx`

**Changes:**
1. Import `OfflineBanner` component
2. Add offline state detection using `navigator.onLine`
3. Show `OfflineBanner` at top of page
4. Check for offline token in localStorage
5. Detect online/offline status changes

**Code:**
```typescript
import OfflineBanner from "@/components/offline/OfflineBanner";
import { syncOfflineQueue } from "@/lib/offline/sync-engine";

// In component:
const [isOnline, setIsOnline] = useState(navigator.onLine);
const [offlineToken, setOfflineToken] = useState<string | null>(null);

useEffect(() => {
  // Check offline token
  const token = localStorage.getItem("offline_token");
  setOfflineToken(token);
  
  // Listen for online/offline events
  const handleOnline = () => {
    setIsOnline(true);
    // Auto-sync when back online
    if (token) {
      syncOfflineQueue().catch(console.error);
    }
  };
  const handleOffline = () => {
    setIsOnline(false);
    if (!token) {
      showToast("Offline mode requires entitlement token. Contact admin.", "error");
    }
  };
  
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);

// In JSX:
<OfflineBanner onSyncClick={async () => {
  await syncOfflineQueue();
}} />
```

---

### **Step 2: Offline Barcode Scanning with Product Cache**

**File:** `src/lib/offline/product-cache.ts` (NEW)

**Create product cache manager:**
- Store products in IndexedDB with barcode as key
- Sync cache when online
- Look up products offline

**File:** `src/app/pos/page.tsx`

**Modify `handleScan` function:**
```typescript
async function handleScan(code: string) {
  const normalizedCode = code.trim();
  
  // If offline, try cache first
  if (!navigator.onLine) {
    try {
      const { getCachedProduct } = await import("@/lib/offline/product-cache");
      const cached = await getCachedProduct(normalizedCode);
      if (cached) {
        await addProductToCart(cached);
        return;
      } else {
        showToast("Product not in cache. Please go online to sync products.", "warning");
        return;
      }
    } catch (error) {
      console.error("Cache lookup failed:", error);
    }
  }
  
  // Online lookup (existing code)
  try {
    const res = await fetch(`/api/products/by-barcode?code=${encodeURIComponent(normalizedCode)}`);
    const data = await res.json();
    
    if (data.found && data.product) {
      // Cache product for offline use
      if (navigator.onLine) {
        const { cacheProduct } = await import("@/lib/offline/product-cache");
        await cacheProduct(normalizedCode, data.product);
      }
      
      // Rest of existing logic...
    }
  } catch (error) {
    // Handle error
  }
}
```

---

### **Step 3: Offline Cart Persistence**

**File:** `src/lib/offline/cart-storage.ts` (NEW)

**Create cart storage utility:**
```typescript
const CART_STORAGE_KEY = 'offline_cart_v1';

export async function saveCartToStorage(items: CartItem[]): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }
}

export async function loadCartFromStorage(): Promise<CartItem[]> {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }
  return [];
}

export async function clearCartStorage(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(CART_STORAGE_KEY);
  }
}
```

**File:** `src/app/pos/page.tsx`

**Modify cart operations:**
```typescript
// Save cart when offline
useEffect(() => {
  if (!navigator.onLine && items.length > 0) {
    const { saveCartToStorage } = require("@/lib/offline/cart-storage");
    saveCartToStorage(items);
  }
}, [items, navigator.onLine]);

// Load cart on mount if offline
useEffect(() => {
  if (!navigator.onLine) {
    const { loadCartFromStorage } = require("@/lib/offline/cart-storage");
    loadCartFromStorage().then((savedItems: CartItem[]) => {
      if (savedItems.length > 0) {
        // Restore cart items
        savedItems.forEach(item => {
          // Add items back to cart
        });
      }
    });
  }
}, []);
```

---

### **Step 4: Offline Invoice Queueing**

**File:** `src/app/pos/page.tsx`

**Modify checkout handler:**
```typescript
async function handleCheckout(payments: any[], idempotencyKey: string) {
  if (!navigator.onLine) {
    // Save invoice to offline queue
    const { saveOfflineInvoice } = await import("@/lib/offline/indexeddb");
    
    const offlineInvoice = {
      localId: crypto.randomUUID(),
      idempotencyKey,
      tenantId: user?.tenantId || 1,
      deviceId: localStorage.getItem("device_id") || "unknown",
      tokenId: offlineToken || "",
      invoiceData: {
        lineItems: items,
        customerId: selectedCustomer?.id,
        payments,
        totals: calculateInvoiceTotals(items),
      },
      status: "QUEUED" as const,
      createdAt: Date.now(),
    };
    
    await saveOfflineInvoice(offlineInvoice);
    
    showToast("Invoice queued for sync. It will be processed when online.", "success");
    clear(); // Clear cart
    return;
  }
  
  // Online checkout (existing code)
  // ...
}
```

---

### **Step 5: Offline Payment Tracking**

**File:** `src/lib/offline/payment-storage.ts` (NEW)

**Create payment storage utility** (similar to invoice storage)

**File:** `src/app/pos/page.tsx`

**Modify payment handler:**
```typescript
// Record offline payments to IndexedDB
// Sync when online
```

---

## Testing Checklist

### **Offline Mode:**
- [ ] Offline banner appears when connection lost
- [ ] Offline token check works
- [ ] Products can be scanned offline (from cache)
- [ ] Cart persists when offline
- [ ] Invoices queue when offline
- [ ] Payments record offline
- [ ] Auto-sync when connection restored
- [ ] Manual sync button works

---

## Next Steps

1. Implement Step 1 (Offline Detection) - **START HERE**
2. Implement Step 2 (Product Cache)
3. Implement Step 3 (Cart Persistence)
4. Implement Step 4 (Invoice Queueing)
5. Implement Step 5 (Payment Tracking)
6. Test all offline features
7. Update documentation

---

**Last Updated:** January 2026
