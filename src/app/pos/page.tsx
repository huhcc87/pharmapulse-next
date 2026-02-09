// src/app/pos/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useCart, type CartItem } from "@/hooks/useCart";
import { useBarcodeWedge } from "@/hooks/useBarcodeWedge";
import { playErrorSound, playBeepSound } from "@/lib/scannerFeedback";
import BindBarcodeModal from "@/components/barcode/BindBarcodeModal";
import { useRouter } from "next/navigation";
import DrugLibraryModal from "@/components/DrugLibraryModal";
import { resolveBarcode } from "@/lib/barcode/resolver";
import ScanToInventoryModal from "@/components/ScanToInventoryModal";
import AddProductModal from "@/components/AddProductModal";
import CheckoutModal from "@/components/pos/CheckoutModal";
import HsnQuickFixModal from "@/components/pos/HsnQuickFixModal";
import CustomerDrawer from "@/components/pos/CustomerDrawer";
import AlertsPanel from "@/components/pos/AlertsPanel";
import CartItemGstDetails from "@/components/pos/CartItemGstDetails";
import UpdateGstModal from "@/components/pos/UpdateGstModal";
import ShortcutsHelp from "@/components/pos/ShortcutsHelp";
import FavoritesPanel from "@/components/pos/FavoritesPanel";
import RepeatInvoiceModal from "@/components/pos/RepeatInvoiceModal";
import VideoAssistButton from "@/components/video-assist/VideoAssistButton";
import { useKeyboardShortcuts, type KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { showToast } from "@/lib/toast";
import ScanConfirmation from "@/components/pos/ScanConfirmation";
import { useAuth } from "@/hooks/useAuth";
import OfflineBanner from "@/components/offline/OfflineBanner";
import {
  Search,
  User,
  ShoppingCart,
  Package,
  Gift,
  QrCode,
  RotateCcw,
  Star,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { CustomerDTO, InventoryAlert, DrugInteractionAlert } from "@/lib/types/pos";
import { calculateGst, calculateInvoiceTotals, formatRupees } from "@/lib/gst/taxCalculator";
import { suggestHsnCode } from "@/lib/gst/hsnLookup";

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default function POSPage() {
  const router = useRouter();
  const { items, addItem, addItem: addItemDirect, removeItem, setQty, clear, subtotalPaise } = useCart();
  const { user, isAuthReady } = useAuth();

  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [missingBarcode, setMissingBarcode] = useState("");
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [drugLibraryOpen, setDrugLibraryOpen] = useState(false);
  const [showScanToInventory, setShowScanToInventory] = useState(false);
  const [scannedDrug, setScannedDrug] = useState<any>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);

  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [interactionAlerts, setInteractionAlerts] = useState<DrugInteractionAlert[]>([]);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [updateGstModalOpen, setUpdateGstModalOpen] = useState(false);

  const [productToUpdate, setProductToUpdate] = useState<{
    id: number;
    name: string;
    hsnCode?: string | null;
    gstRate?: number | null;
    gstType?: string | null;
    barcode?: string | null;
  } | null>(null);

  const [productsCache, setProductsCache] = useState<Map<number, any>>(new Map());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [barcodeFirstMode, setBarcodeFirstMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [repeatInvoiceOpen, setRepeatInvoiceOpen] = useState(false);
  const [favoritesPanelOpen, setFavoritesPanelOpen] = useState(false);
  const [favoritesPanelType, setFavoritesPanelType] = useState<"favorites" | "fast-moving">("favorites");

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [hsnFixModalOpen, setHsnFixModalOpen] = useState(false);
  const [hsnIssues, setHsnIssues] = useState<any[]>([]);

  const [lastScannedItem, setLastScannedItem] = useState<{
    key: string;
    productName: string;
    quantity: number;
    price: string;
  } | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [offlineToken, setOfflineToken] = useState<string | null>(null);

  // Offline detection and token check
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const token = localStorage.getItem("offline_token");
    setOfflineToken(token);

    const handleOnline = () => {
      setIsOnline(true);
      if (token) {
        import("@/lib/offline/sync-engine").then(({ syncOfflineQueue }) => {
          syncOfflineQueue().catch((error) => console.error("Auto-sync failed:", error));
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (!token) {
        showToast("Offline mode requires entitlement token. Contact admin.", "error");
      } else {
        showToast("Working in offline mode. Changes will sync when online.", "info");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Add product to cart with GST validation
  async function addProductToCart(product: any) {
    setProductsCache((prev) => new Map(prev).set(product.id, product));

    // Auto-suggest HSN if missing
    if (!product.hsnCode) {
      const suggestedHsn = suggestHsnCode({
        brandName: product.name,
        category: product.category,
        type: product.type,
        composition: product.composition || product.saltComposition,
      });

      product.hsnCode = suggestedHsn.hsnCode;
      if (product.gstRate === null || product.gstRate === undefined) {
        product.gstRate = suggestedHsn.gstRate;
      }

      showToast(
        `HSN ${suggestedHsn.hsnCode} (${suggestedHsn.gstRate}% GST) auto-suggested for ${product.name}`,
        "info"
      );
    }

    // Default GST rate to 12% if missing
    if (product.gstRate === null || product.gstRate === undefined) {
      product.gstRate = 12;
    }

    if (!product.hsnCode) {
      setErr(`HSN code missing for "${product.name}". Please add HSN code before billing.`);
      playErrorSound();
      setProductToUpdate({
        id: product.id,
        name: product.name,
        hsnCode: product.hsnCode,
        gstRate: product.gstRate,
        gstType: product.gstType,
        barcode: product.barcode || product.barcodeValue,
      });
      setUpdateGstModalOpen(true);
      return;
    }

    const pricePaise = Math.round((product.salePrice || product.unitPrice || product.mrp || 0) * 100);

    const gstType = product.gstType || "EXCLUSIVE";
    const gstRate = Number(product.gstRate) || 0;

    const cartItem: CartItem = {
      key: `product-${product.id}`,
      productName: product.name,
      unitPricePaise: pricePaise,
      quantity: 1,
      hsnCode: product.hsnCode,
      gstRate,
      gstType: gstType === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
      gstRateBps: Math.round(gstRate * 100),
      ean: product.barcode || product.barcodeValue || null,
      productId: product.id,
    };

    addItem(cartItem);
    playBeepSound();
    setErr(null);
  }

  // Handle barcode scan
  async function handleScan(code: string) {
    const normalizedCode = code.trim();

    setQ("");
    if (searchInputRef.current) searchInputRef.current.value = "";

    if (process.env.NODE_ENV !== "production") {
      console.log("🔍 Barcode scanned in POS:", normalizedCode);
    }

    // Offline lookup
    if (!navigator.onLine) {
      try {
        const { getCachedProduct } = await import("@/lib/offline/product-cache");
        const cached = await getCachedProduct(normalizedCode);

        if (cached) {
          setProductsCache((prev) => new Map(prev).set(cached.id, cached));

          const hasHsn = !!cached.hsnCode;
          const hasGst = cached.gstRate !== null && cached.gstRate !== undefined;

          if (!hasHsn || !hasGst) {
            playErrorSound();
            setErr(`GST mapping missing for "${cached.name}". Please go online to update.`);
            return;
          }

          await addProductToCart(cached);
          setErr(null);

          const pricePaise = Math.round((cached.salePrice || cached.unitPrice || cached.mrp || 0) * 100);
          const cartKey = `product-${cached.id}`;
          const existingItem = items.find((item) => item.key === cartKey);
          const quantity = existingItem ? existingItem.quantity + 1 : 1;

          setLastScannedItem({
            key: cartKey,
            productName: cached.name,
            quantity,
            price: formatRupees(pricePaise * quantity),
          });

          showToast(`Item added (offline): ${cached.name}`, "success");
          playBeepSound();
          return;
        } else {
          playErrorSound();
          // ✅ FIX: "warning" not allowed by showToast typings
          showToast("Product not in cache. Please go online to sync products.", "info");
          setErr("Product not found in offline cache. Go online to add new products.");
          return;
        }
      } catch (error) {
        console.error("Cache lookup failed:", error);
        showToast("Offline cache lookup failed. Please try again or go online.", "error");
        return;
      }
    }

    // Online lookup
    try {
      const res = await fetch(`/api/products/by-barcode?code=${encodeURIComponent(normalizedCode)}`);
      const data = await res.json();

      if (data.found && data.product) {
        // cache for offline
        try {
          const { cacheProduct } = await import("@/lib/offline/product-cache");
          await cacheProduct(normalizedCode, data.product);
        } catch (cacheError) {
          console.warn("Failed to cache product:", cacheError);
        }

        if (data.product.isDrugLibrary) {
          setMissingBarcode(normalizedCode);
          setBindModalOpen(true);
          playErrorSound();
          showToast("Item found in drug library. Please add to inventory first.", "info");
          return;
        }

        setProductsCache((prev) => new Map(prev).set(data.product.id, data.product));

        const hasHsn = !!data.product.hsnCode;
        const hasGst = data.product.gstRate !== null && data.product.gstRate !== undefined;

        if (!hasHsn || !hasGst) {
          playErrorSound();
          setErr(`GST mapping missing for "${data.product.name}". Click "Update now" to add HSN + GST.`);
          setProductToUpdate({
            id: data.product.id,
            name: data.product.name,
            hsnCode: data.product.hsnCode,
            gstRate: data.product.gstRate,
            gstType: data.product.gstType,
            barcode: data.product.barcode || data.product.barcodeValue || data.product.internalCode,
          });
          setUpdateGstModalOpen(true);
          return;
        }

        await addProductToCart(data.product);
        setErr(null);

        const pricePaise = Math.round((data.product.salePrice || data.product.unitPrice || data.product.mrp || 0) * 100);
        const cartKey = `product-${data.product.id}`;
        const existingItem = items.find((item) => item.key === cartKey);
        const quantity = existingItem ? existingItem.quantity + 1 : 1;

        setLastScannedItem({
          key: cartKey,
          productName: data.product.name,
          quantity,
          price: formatRupees(pricePaise * quantity),
        });

        showToast(`Item added: ${data.product.name}`, "success");
        playBeepSound();

        if (barcodeFirstMode && searchInputRef.current) {
          setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
          }, 100);
        }
      } else {
        // try drug library
        try {
          const resolveResult = await resolveBarcode(normalizedCode, 1, 1);
          if (resolveResult.found === "library") {
            setScannedDrug(resolveResult.drug);
            setShowScanToInventory(true);
            playErrorSound();
            showToast("Found in drug library. Adding to inventory...", "info");
            return;
          }
        } catch (resolveError) {
          console.log("Drug library lookup failed:", resolveError);
        }

        setMissingBarcode(normalizedCode);
        setBindModalOpen(true);
        playErrorSound();
        showToast("Item not found. Please link to existing product or create new.", "error");
      }
    } catch (error) {
      console.error("❌ Barcode scan error:", error);
      playErrorSound();
      setMissingBarcode(normalizedCode);
      setBindModalOpen(true);
    }
  }

  // Setup barcode scanner
  useBarcodeWedge(handleScan, { minLen: 6, timeoutMs: 80 });

  // Save cart to storage when offline or cart changes
  useEffect(() => {
    if (items.length > 0) {
      const { saveCartToStorage } = require("@/lib/offline/cart-storage");
      saveCartToStorage(items, selectedCustomer?.id || null).catch((error: any) => {
        console.warn("Failed to save cart:", error);
      });
    } else {
      const { clearCartStorage } = require("@/lib/offline/cart-storage");
      clearCartStorage().catch((error: any) => {
        console.warn("Failed to clear cart storage:", error);
      });
    }
  }, [items, selectedCustomer?.id]);

  // Load cart from storage on mount if offline
  useEffect(() => {
    if (!navigator.onLine && items.length === 0) {
      const { loadCartFromStorage, hasSavedCart } = require("@/lib/offline/cart-storage");

      hasSavedCart().then((hasCart: boolean) => {
        if (hasCart) {
          loadCartFromStorage().then(({ items: savedItems, meta }: any) => {
            if (savedItems.length > 0) {
              savedItems.forEach((item: any) => {
                try {
                  addItemDirect(item);
                } catch (error) {
                  console.error("Failed to restore cart item:", error);
                }
              });

              if (meta?.customerId) {
                showToast(`Restored cart with ${savedItems.length} items from offline storage`, "info");
              }
            }
          });
        }
      });
    }
  }, []); // mount only

  // Auto-focus search input in barcode-first mode
  useEffect(() => {
    if (
      barcodeFirstMode &&
      searchInputRef.current &&
      !bindModalOpen &&
      !drugLibraryOpen &&
      !updateGstModalOpen
    ) {
      searchInputRef.current.focus();
    }
  }, [barcodeFirstMode, items.length, selectedCustomer, bindModalOpen, drugLibraryOpen, updateGstModalOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInputRef.current && barcodeFirstMode) {
        searchInputRef.current.focus();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const taxCalculations = items.map((item) =>
    calculateGst({
      pricePaise: item.unitPricePaise,
      gstRate: item.gstRate,
      gstType: item.gstType,
      quantity: item.quantity,
      discountPaise: item.discountPaise,
      discountPercent: item.discountPercent,
    })
  );

  const invoiceTotals = calculateInvoiceTotals(taxCalculations, true);
  const totalDiscount = items.reduce((sum, item) => {
    const lineTotal = item.unitPricePaise * item.quantity;
    const discount = item.discountPercent
      ? Math.round((lineTotal * item.discountPercent) / 100)
      : item.discountPaise || 0;
    return sum + discount;
  }, 0);

  const missingGstItems = items.filter((item) => !item.hsnCode || item.gstRate === undefined);
  const finalTotal = invoiceTotals.grandTotalPaise;

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: "F2",
      handler: () => {
        if (searchInputRef.current) searchInputRef.current.focus();
        else setDrugLibraryOpen(true);
      },
      description: "Focus search / Open Drug Library",
    },
    { key: "F3", handler: () => setCustomerDrawerOpen(true), description: "Open Select Customer" },
    {
      key: "F4",
      handler: () => {
        if (items.length > 0 && missingGstItems.length === 0) setCheckoutModalOpen(true);
      },
      description: "Trigger Checkout",
    },
    {
      key: "k",
      ctrlKey: true,
      handler: () => searchInputRef.current?.focus(),
      description: "Focus search input",
    },
    {
      key: "Escape",
      handler: () => {
        if (bindModalOpen) setBindModalOpen(false);
        else if (drugLibraryOpen) setDrugLibraryOpen(false);
        else if (customerDrawerOpen) setCustomerDrawerOpen(false);
        else if (updateGstModalOpen) setUpdateGstModalOpen(false);
        else if (repeatInvoiceOpen) setRepeatInvoiceOpen(false);
        else if (favoritesPanelOpen) setFavoritesPanelOpen(false);
        else if (q) {
          setQ("");
          if (searchInputRef.current) searchInputRef.current.value = "";
        }
      },
      description: "Close modal / Clear search",
    },
    { key: "r", ctrlKey: true, handler: () => setRepeatInvoiceOpen(true), description: "Repeat Last Invoice" },
    { key: "?", shiftKey: true, handler: () => setShowShortcuts(true), description: "Show shortcuts help" },
  ];

  useKeyboardShortcuts(shortcuts, true);

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && q.trim()) {
      const barcodePattern = /^[0-9]{8,14}$|^[A-Z0-9]{6,32}$/i;
      if (barcodePattern.test(q.trim())) {
        e.preventDefault();
        await handleScan(q.trim());
      }
    }
  };

  async function handleCheckout(payments: any[], idempotencyKey: string) {
    if (items.length === 0) {
      setErr("Cart is empty");
      return;
    }

    // Offline checkout -> queue invoice
    if (!navigator.onLine) {
      if (!offlineToken) {
        setErr("Offline mode requires entitlement token. Contact admin.");
        return;
      }

      setIsCheckingOut(true);
      try {
        const { saveOfflineInvoice } = await import("@/lib/offline/indexeddb");

        const taxCalcs = items.map((item) =>
          calculateGst({
            pricePaise: item.unitPricePaise,
            gstRate: item.gstRate,
            gstType: item.gstType,
            quantity: item.quantity,
            discountPaise: item.discountPaise,
            discountPercent: item.discountPercent,
          })
        );
        const totals = calculateInvoiceTotals(taxCalcs, true);

        const deviceId = localStorage.getItem("device_id") || `device-${Date.now()}`;
        if (!localStorage.getItem("device_id")) localStorage.setItem("device_id", deviceId);

        const offlineInvoice = {
          localId: crypto.randomUUID(),
          idempotencyKey,
          tenantId: toInt(user?.tenantId) ?? 1,
          deviceId,
          tokenId: offlineToken,
          invoiceData: {
            customerId: selectedCustomer?.id || null,
            lineItems: items,
            payments,
            totals,
            context: "POS",
          },
          status: "QUEUED" as const,
          createdAt: Date.now(),
        };

        await saveOfflineInvoice(offlineInvoice);

        showToast("Invoice queued for sync. It will be processed when online.", "success");

        clear();
        setSelectedCustomer(null);
        setCheckoutModalOpen(false);

        const { clearCartStorage } = await import("@/lib/offline/cart-storage");
        await clearCartStorage();
      } catch (error: any) {
        console.error("Offline checkout error:", error);
        setErr(error.message || "Failed to queue invoice offline");
      } finally {
        setIsCheckingOut(false);
        setCheckoutModalOpen(false);
      }
      return;
    }

    // Online checkout
    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/pos/issue-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || null,
          lineItems: items,
          payments,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setErr(data.error || "Checkout failed");
        return;
      }

      if (data.invoice) {
        showToast(`Invoice ${data.invoice.invoiceNumber || data.invoice.id} created!`, "success");
        clear();
        setSelectedCustomer(null);
        setCheckoutModalOpen(false);

        const { clearCartStorage } = await import("@/lib/offline/cart-storage");
        await clearCartStorage();

        router.push(`/invoices/${data.invoice.id}/print`);
      } else {
        throw new Error("Invalid response");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      setErr(error.message || "Checkout failed");
    } finally {
      setIsCheckingOut(false);
      setCheckoutModalOpen(false);
    }
  }

  async function handleRepeatInvoice(lineItems: any[], customer: any | null) {
    clear();
    if (customer) setSelectedCustomer(customer);

    for (const item of lineItems) {
      try {
        if (item.productId) {
          const res = await fetch(`/api/products/${item.productId}`);
          if (res.ok) {
            const product = await res.json();
            const availableQty = Math.min(item.quantity, product.stockLevel || 0);
            if (availableQty < item.quantity) {
              showToast(
                `Warning: ${item.productName} - Only ${availableQty} available (requested ${item.quantity})`,
                "info"
              );
            }
            if (availableQty > 0) {
              item.quantity = availableQty;
              await addProductToCart(product);
              if (item.quantity > 1) setQty(`product-${item.productId}`, item.quantity);
            }
          }
        }
      } catch (error) {
        console.error("Error loading item:", error);
      }
    }

    showToast("Last invoice loaded into cart", "success");
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <OfflineBanner
        onSyncClick={async () => {
          try {
            const { syncOfflineQueue } = await import("@/lib/offline/sync-engine");
            await syncOfflineQueue();
            showToast("Sync completed successfully", "success");
          } catch (error: any) {
            console.error("Manual sync failed:", error);
            showToast(error.message || "Sync failed. Please try again.", "error");
          }
        }}
      />

      <div className="flex-1 flex flex-col p-6" style={{ marginTop: isOnline ? "0" : "60px" }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">POS Terminal</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBarcodeFirstMode(!barcodeFirstMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                barcodeFirstMode ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-100 text-gray-700 border-gray-300"
              }`}
              title="Barcode-first mode"
            >
              {barcodeFirstMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <QrCode className="w-4 h-4" />
              <span className="text-sm">Barcode-first</span>
            </button>

            <button
              onClick={() => {
                setFavoritesPanelType("favorites");
                setFavoritesPanelOpen(!favoritesPanelOpen);
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Favorites"
            >
              <Star className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setFavoritesPanelType("fast-moving");
                setFavoritesPanelOpen(!favoritesPanelOpen);
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Fast-moving"
            >
              <TrendingUp className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCustomerDrawerOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                selectedCustomer ? "bg-blue-100 text-blue-700 border border-blue-300" : "bg-gray-100 text-gray-700 border border-gray-300"
              }`}
            >
              <User className="w-4 h-4" />
              {selectedCustomer ? selectedCustomer.name : "Select Customer"}
            </button>

            <button
              onClick={() => setDrugLibraryOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Package className="w-4 h-4" />
              Drug Library
            </button>

            <VideoAssistButton
              context="POS"
              contextData={{
                cartItems: items.map((item) => ({ productName: item.productName, quantity: item.quantity })),
                customerId: selectedCustomer?.id,
                totalAmountPaise: subtotalPaise,
              }}
              tenantId={toInt(user?.tenantId) ?? 1}
              userId={user?.userId || "guest"}
              userRole={user?.role?.toUpperCase() || "OWNER"}
            />

            <button
              onClick={() => setRepeatInvoiceOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Repeat Last Invoice (Ctrl+R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              ref={searchInputRef}
              data-scanner="true"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={barcodeFirstMode ? "Scan barcode (EAN/HSN/INMED)..." : "Search products or scan barcode..."}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                barcodeFirstMode ? "border-blue-400 focus:ring-blue-500 bg-blue-50/50" : "border-gray-300 focus:ring-blue-500"
              }`}
              autoFocus={barcodeFirstMode}
            />
            {barcodeFirstMode && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium">Ready</span>
              </div>
            )}
          </div>

          {err && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center justify-between">
              <span>{err}</span>
              {productToUpdate && (
                <button
                  onClick={() => setUpdateGstModalOpen(true)}
                  className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Update now
                </button>
              )}
            </div>
          )}
        </div>

        {/* Alerts */}
        {(alerts.length > 0 || interactionAlerts.length > 0 || missingGstItems.length > 0) && (
          <div className="mb-4">
            <AlertsPanel alerts={alerts} interactionAlerts={interactionAlerts} />
          </div>
        )}

        {/* Cart */}
        <div className="flex-1 border rounded-lg bg-white p-4 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Cart ({items.length})</h2>
            {items.length > 0 && (
              <button onClick={clear} className="text-sm text-red-600 hover:text-red-700">
                Clear All
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Cart is empty</p>
              <p className="text-sm mt-1">Scan barcode or search to add items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.key} className="p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        ₹{(item.unitPricePaise / 100).toFixed(2)} × {item.quantity}
                        {item.discountPaise && item.discountPaise > 0 && (
                          <span className="text-green-600 ml-2">-₹{(item.discountPaise / 100).toFixed(2)}</span>
                        )}
                      </div>
                      {item.batchNumber && <div className="text-xs text-gray-500 mt-1">Batch: {item.batchNumber}</div>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(item.key, item.quantity - 1)}
                        className="px-2 py-1 border rounded hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.key, item.quantity + 1)}
                        className="px-2 py-1 border rounded hover:bg-gray-100"
                      >
                        +
                      </button>
                      <button onClick={() => removeItem(item.key)} className="px-2 py-1 text-red-600 hover:text-red-700">
                        ×
                      </button>
                    </div>
                  </div>

                  <CartItemGstDetails item={item} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total & Checkout */}
        <div className="mt-4 border-t pt-4 bg-white p-4 rounded-lg">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal (Taxable):</span>
              <span>{formatRupees(invoiceTotals.totalTaxablePaise)}</span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span>-{formatRupees(totalDiscount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span>CGST:</span>
              <span>{formatRupees(invoiceTotals.totalCGSTPaise)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span>SGST:</span>
              <span>{formatRupees(invoiceTotals.totalSGSTPaise)}</span>
            </div>

            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Grand Total:</span>
              <span>{formatRupees(finalTotal)}</span>
            </div>

            {selectedCustomer?.loyaltyPoints && selectedCustomer.loyaltyPoints > 0 && (
              <div className="text-sm text-gray-600 flex items-center gap-1">
                <Gift className="w-4 h-4" />
                Available: {selectedCustomer.loyaltyPoints} points
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                const missingHsn = items.filter((item) => !item.hsnCode);
                if (missingHsn.length > 0) {
                  setHsnIssues(
                    missingHsn.map((item) => ({
                      itemKey: item.key,
                      productName: item.productName,
                      productId: item.productId || undefined,
                      drugLibraryId: item.drugLibraryId || undefined,
                    }))
                  );
                  setHsnFixModalOpen(true);
                } else {
                  setCheckoutModalOpen(true);
                }
              }}
              disabled={items.length === 0 || isCheckingOut || missingGstItems.length > 0}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              {isCheckingOut ? "Processing..." : missingGstItems.length > 0 ? "Fix GST Details First" : "Checkout"}
            </button>

            <button
              onClick={() => setRepeatInvoiceOpen(true)}
              className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Repeat Last Invoice (Ctrl+R)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Favorites/Fast-moving Panel */}
      {favoritesPanelOpen && (
        <div className="w-80 border-l bg-white overflow-auto">
          <FavoritesPanel
            type={favoritesPanelType}
            onSelectItem={async (item) => {
              try {
                if (item.drugLibraryId) {
                  const res = await fetch(
                    `/api/products/by-barcode?code=INMED-${String(item.drugLibraryId).padStart(6, "0")}`
                  );
                  if (res.ok) {
                    const data = await res.json();
                    if (data.found && data.product) await addProductToCart(data.product);
                  }
                } else if (item.productId) {
                  const res = await fetch(`/api/products/${item.productId}`);
                  if (res.ok) {
                    const product = await res.json();
                    await addProductToCart(product);
                  }
                }
              } catch (error) {
                console.error("Error adding item:", error);
                showToast("Failed to add item", "error");
              }
            }}
            onToggleFavorite={async (_itemId, drugLibraryId, productId) => {
              try {
                const res = await fetch("/api/pos/favorites", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ drugLibraryId, productId }),
                });
                if (res.ok) {
                  const data = await res.json();
                  showToast(data.isFavorite ? "Added to favorites" : "Removed from favorites", "success");
                }
              } catch (error) {
                console.error("Error toggling favorite:", error);
              }
            }}
          />
        </div>
      )}

      {/* Modals */}
      <BindBarcodeModal
        open={bindModalOpen}
        barcode={missingBarcode}
        onClose={() => {
          setBindModalOpen(false);
          setMissingBarcode("");
        }}
        onBound={(product) => {
          addProductToCart(product);
          setBindModalOpen(false);
        }}
        onCreateNew={() => {
          setBindModalOpen(false);
          setShowAddProductModal(true);
        }}
      />

      {showScanToInventory && scannedDrug && (
        <ScanToInventoryModal
          isOpen={showScanToInventory}
          drug={scannedDrug}
          onClose={() => {
            setShowScanToInventory(false);
            setScannedDrug(null);
          }}
          onAdd={async (data) => {
            try {
              const response = await fetch("/api/inventory/add-from-qr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ qrCode: scannedDrug.qrCode || scannedDrug.barcode || missingBarcode, ...data }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to add to inventory");
              }

              setShowScanToInventory(false);
              setScannedDrug(null);
              showToast("Product added to inventory! Scan barcode again to add to cart.", "success");
            } catch (error: any) {
              console.error("Error adding to inventory:", error);
              showToast(`Failed to add: ${error?.message || "Unknown error"}`, "error");
            }
          }}
        />
      )}

      {showAddProductModal && (
        <AddProductModal
          isOpen={showAddProductModal}
          scannedBarcode={missingBarcode}
          onClose={() => {
            setShowAddProductModal(false);
            setMissingBarcode("");
          }}
          onAdd={async (product: any) => {
            try {
              const cartProduct = {
                id: (product as any).id || (product as any).productId || null,
                name: product.productName,
                salePrice: product.unitPrice || product.salePrice || 0,
                unitPrice: product.unitPrice || 0,
                mrp: product.mrp || null,
                hsnCode: product.hsnCode || null,
                gstRate: product.gstRate || null,
                gstType: product.gstType || "EXCLUSIVE",
                barcode: product.barcode || missingBarcode,
                category: product.category || "General",
                stockLevel: product.stockLevel || 0,
              };
              await addProductToCart(cartProduct);
              setShowAddProductModal(false);
              setMissingBarcode("");
              showToast(`Product "${product.productName}" created and added to cart!`, "success");
            } catch (error: any) {
              console.error("Error adding product to cart:", error);
              showToast(`Failed to add to cart: ${error?.message || "Unknown error"}`, "error");
            }
          }}
        />
      )}

      <DrugLibraryModal
        isOpen={drugLibraryOpen}
        onClose={() => setDrugLibraryOpen(false)}
        onSelectDrug={async (drug) => {
          try {
            const inventoryResponse = await fetch("/api/inventory/add-from-library", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ drugLibraryId: drug.id, qtyOnHand: 0, tenantId: 1 }),
            });

            let inventoryItem: any = null;

            if (inventoryResponse.ok) {
              const inventoryData = await inventoryResponse.json();
              inventoryItem = inventoryData.inventoryItem;
            } else {
              const error = await inventoryResponse.json().catch(() => ({}));
              if (error.error && String(error.error).includes("already exists")) {
                const itemsResponse = await fetch("/api/inventory/items?tenantId=1");
                if (itemsResponse.ok) {
                  const itemsData = await itemsResponse.json();
                  inventoryItem = itemsData.items?.find((item: any) => item.drugLibraryId === drug.id);
                }
              } else {
                throw new Error(error.error || error.details || "Failed to add drug to inventory");
              }
            }

            const priceInr =
              drug.dpcoCeilingPriceInr ||
              (typeof drug.priceInr === "string" ? parseFloat(drug.priceInr) : drug.priceInr || 0);

            const suggestedHsn = suggestHsnCode({
              brandName: drug.brandName,
              category: drug.category || undefined,
              type: undefined,
              composition: drug.fullComposition || drug.salts || undefined,
            });

            const hsnCode = suggestedHsn.hsnCode;
            const finalGstRate = suggestedHsn.gstRate || drug.gstPercent || 12;

            const productId = inventoryItem?.id || drug.id;

            const productData = {
              id: productId,
              name: drug.brandName,
              salePrice: priceInr,
              unitPrice: priceInr,
              mrp: drug.dpcoCeilingPriceInr || priceInr,
              hsnCode,
              gstRate: finalGstRate,
              gstType: "EXCLUSIVE",
              drugLibraryId: drug.id,
              category: drug.category,
              manufacturer: drug.manufacturer,
              composition: drug.fullComposition || drug.salts,
              saltComposition: drug.salts,
            };

            await addProductToCart(productData);
            showToast(`${drug.brandName} added to cart (HSN: ${hsnCode}, ${finalGstRate}% GST)`, "success");
            setDrugLibraryOpen(false);
          } catch (error: any) {
            console.error("Error adding drug to POS:", error);
            setErr(`Failed to add drug: ${error?.message || "Unknown error"}`);
          }
        }}
      />

      <CheckoutModal isOpen={checkoutModalOpen} items={items} customerId={selectedCustomer?.id || null} onClose={() => setCheckoutModalOpen(false)} onConfirm={handleCheckout} />

      <HsnQuickFixModal
        isOpen={hsnFixModalOpen}
        issues={hsnIssues}
        onClose={() => {
          setHsnFixModalOpen(false);
          setHsnIssues([]);
        }}
        onFixed={async () => {
          setHsnFixModalOpen(false);
          setHsnIssues([]);
          await new Promise((resolve) => setTimeout(resolve, 500));
          setCheckoutModalOpen(true);
        }}
      />

      <CustomerDrawer
        isOpen={customerDrawerOpen}
        onClose={() => setCustomerDrawerOpen(false)}
        onSelect={(customer) => {
          setSelectedCustomer(customer);
          setCustomerDrawerOpen(false);
        }}
        selectedCustomerId={selectedCustomer?.id}
      />

      <UpdateGstModal
        isOpen={updateGstModalOpen}
        product={productToUpdate}
        onClose={() => {
          setUpdateGstModalOpen(false);
          setProductToUpdate(null);
        }}
        onSuccess={async (updatedProduct) => {
          setProductsCache((prev) => new Map(prev).set(updatedProduct.id, updatedProduct));

          const cartItem = items.find((item) => item.productId === updatedProduct.id);
          if (cartItem) {
            removeItem(cartItem.key);

            const pricePaise = Math.round((updatedProduct.salePrice || updatedProduct.unitPrice || updatedProduct.mrp || 0) * 100);

            const updatedCartItem: CartItem = {
              key: `product-${updatedProduct.id}`,
              productName: updatedProduct.name,
              unitPricePaise: pricePaise,
              quantity: cartItem.quantity,
              hsnCode: updatedProduct.hsnCode || "",
              gstRate: updatedProduct.gstRate || 12,
              gstType: (updatedProduct.gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
              gstRateBps: Math.round((updatedProduct.gstRate || 12) * 100),
              ean: updatedProduct.barcode || null,
              productId: updatedProduct.id,
            };

            addItem(updatedCartItem);
          }

          setErr(null);

          if (barcodeFirstMode && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }
        }}
      />

      <RepeatInvoiceModal isOpen={repeatInvoiceOpen} onClose={() => setRepeatInvoiceOpen(false)} onConfirm={handleRepeatInvoice} />

      <ShortcutsHelp />

      {lastScannedItem && (
        <ScanConfirmation
          productName={lastScannedItem.productName}
          quantity={lastScannedItem.quantity}
          price={lastScannedItem.price}
          onAdjustQuantity={(newQty) => {
            setQty(lastScannedItem.key, newQty);
            const item = items.find((i) => i.key === lastScannedItem.key);
            if (item) {
              setLastScannedItem({
                ...lastScannedItem,
                quantity: newQty,
                price: formatRupees(item.unitPricePaise * newQty),
              });
            }
          }}
          onRemove={() => {
            removeItem(lastScannedItem.key);
            setLastScannedItem(null);
          }}
          onConfirm={() => setLastScannedItem(null)}
          autoHideMs={3000}
        />
      )}
    </div>
  );
}
