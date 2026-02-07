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
import PaymentModal from "@/components/pos/PaymentModal";
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
  Search, User, ShoppingCart, Package, Gift, 
  HelpCircle, QrCode, CreditCard, Wallet, Banknote,
  RotateCcw, Star, TrendingUp, ToggleLeft, ToggleRight
} from "lucide-react";
import type { CustomerDTO, InventoryAlert, DrugInteractionAlert } from "@/lib/types/pos";
import { calculateGst, calculateInvoiceTotals, formatRupees } from "@/lib/gst/taxCalculator";
import { suggestHsnCode } from "@/lib/gst/hsnLookup";

export default function POSPage() {
  const router = useRouter();
  const { items, addItem, removeItem, setQty, clear, subtotalPaise } = useCart();
  const { user, isAuthReady } = useAuth();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [missingBarcode, setMissingBarcode] = useState("");
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [drugLibraryOpen, setDrugLibraryOpen] = useState(false);
  const [showScanToInventory, setShowScanToInventory] = useState(false);
  const [scannedDrug, setScannedDrug] = useState<any>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
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
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
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
    // Check initial online status
    setIsOnline(navigator.onLine);
    
    // Check offline token
    const token = localStorage.getItem("offline_token");
    setOfflineToken(token);
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when back online
      if (token) {
        import("@/lib/offline/sync-engine").then(({ syncOfflineQueue }) => {
          syncOfflineQueue().catch((error) => {
            console.error("Auto-sync failed:", error);
          });
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

  // Handle barcode scan
  async function handleScan(code: string) {
    const normalizedCode = code.trim();

    // Immediately clear input to prevent navigation/submit
    setQ("");
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("🔍 Barcode scanned in POS:", normalizedCode);
    }

    // If offline, try cache first
    if (!navigator.onLine) {
      try {
        const { getCachedProduct } = await import("@/lib/offline/product-cache");
        const cached = await getCachedProduct(normalizedCode);
        
        if (cached) {
          // Product found in cache - use it
          setProductsCache((prev) => new Map(prev).set(cached.id, cached));
          
          // Check HSN/GST
          const hasHsn = !!cached.hsnCode;
          const hasGst = cached.gstRate !== null && cached.gstRate !== undefined;

          if (!hasHsn || !hasGst) {
            playErrorSound();
            setErr(
              `GST mapping missing for "${cached.name}". Please go online to update.`
            );
            return;
          }

          // Add to cart from cache
          await addProductToCart(cached);
          setErr(null);
          
          const pricePaise = Math.round(
            (cached.salePrice || cached.unitPrice || cached.mrp || 0) * 100
          );
          const cartKey = `product-${cached.id}`;
          const existingItem = items.find(item => item.key === cartKey);
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
          // Not in cache - show error
          playErrorSound();
          showToast("Product not in cache. Please go online to sync products.", "warning");
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
      // ✅ Use the correct endpoint that supports INMED + EAN/UPC
      const res = await fetch(
        `/api/products/by-barcode?code=${encodeURIComponent(normalizedCode)}`
      );
      const data = await res.json();

      if (data.found && data.product) {
        // Cache product for offline use when online
        try {
          const { cacheProduct } = await import("@/lib/offline/product-cache");
          await cacheProduct(normalizedCode, data.product);
        } catch (cacheError) {
          console.warn("Failed to cache product:", cacheError);
          // Continue even if caching fails
        }
        // Check if it's from drug library (not in inventory yet)
        if (data.product.isDrugLibrary) {
          // Found in drug library but not in inventory - prompt to add
          setMissingBarcode(normalizedCode);
          setBindModalOpen(true);
          playErrorSound();
          showToast("Item found in drug library. Please add to inventory first.", "info");
          return;
        }

        // Cache product for potential updates
        setProductsCache((prev) => new Map(prev).set(data.product.id, data.product));

        // ✅ Prevent wrong GST usage: block if HSN or GST missing
        const hasHsn = !!data.product.hsnCode;
        const hasGst = data.product.gstRate !== null && data.product.gstRate !== undefined;

        if (!hasHsn || !hasGst) {
          playErrorSound();
          setErr(
            `GST mapping missing for "${data.product.name}". Click "Update now" to add HSN + GST.`
          );
          // Store product for update modal
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

        // Product found - add to cart
        await addProductToCart(data.product);
        setErr(null);
        
        // Show inline confirmation
        const pricePaise = Math.round(
          (data.product.salePrice || data.product.unitPrice || data.product.mrp || 0) * 100
        );
        const cartKey = `product-${data.product.id}`;
        const existingItem = items.find(item => item.key === cartKey);
        const quantity = existingItem ? existingItem.quantity + 1 : 1;
        
        setLastScannedItem({
          key: cartKey,
          productName: data.product.name,
          quantity,
          price: formatRupees(pricePaise * quantity),
        });
        
        showToast(`Item added: ${data.product.name}`, "success");
        playBeepSound();
        
        // Auto-focus search in barcode-first mode
        if (barcodeFirstMode && searchInputRef.current) {
          setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select(); // Select text for easy overwrite
          }, 100);
        }
      } else {
        // Product not found - try drug library first
        try {
          const resolveResult = await resolveBarcode(normalizedCode, 1, 1);
          if (resolveResult.found === "library") {
            // Found in drug library - show add to inventory modal
            setScannedDrug(resolveResult.drug);
            setShowScanToInventory(true);
            playErrorSound();
            showToast("Found in drug library. Adding to inventory...", "info");
            return;
          }
        } catch (resolveError) {
          console.log("Drug library lookup failed:", resolveError);
        }
        
        // Not found anywhere - open bind modal (can link to existing or we'll add create option)
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
      // Clear cart storage when empty
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
              // Restore cart items
              savedItems.forEach((item: any) => {
                try {
                  addItem(item);
                } catch (error) {
                  console.error("Failed to restore cart item:", error);
                }
              });
              
              // Restore customer if available
              if (meta?.customerId) {
                // Customer will be restored separately
                // For now, just show a message
                showToast(`Restored cart with ${savedItems.length} items from offline storage`, "info");
              }
            }
          });
        }
      });
    }
  }, []); // Only run on mount

  // Auto-focus search input in barcode-first mode
  useEffect(() => {
    if (barcodeFirstMode && searchInputRef.current && !bindModalOpen && !drugLibraryOpen && !paymentModalOpen && !updateGstModalOpen) {
      searchInputRef.current.focus();
    }
  }, [barcodeFirstMode, items.length, selectedCustomer, paymentModalOpen, bindModalOpen, drugLibraryOpen, updateGstModalOpen]);
  
  // Auto-focus after page load or when switching to POS
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInputRef.current && barcodeFirstMode) {
        searchInputRef.current.focus();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: "F2",
      handler: () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        } else {
          setDrugLibraryOpen(true);
        }
      },
      description: "Focus search / Open Drug Library",
    },
    {
      key: "F3",
      handler: () => setCustomerDrawerOpen(true),
      description: "Open Select Customer",
    },
    {
      key: "F4",
      handler: () => {
        if (items.length > 0 && missingGstItems.length === 0) {
          setPaymentModalOpen(true);
        }
      },
      description: "Trigger Checkout",
    },
    {
      key: "k",
      ctrlKey: true,
      handler: () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      },
      description: "Focus search input",
    },
    {
      key: "Escape",
      handler: () => {
        if (bindModalOpen) {
          setBindModalOpen(false);
        } else if (drugLibraryOpen) {
          setDrugLibraryOpen(false);
        } else if (customerDrawerOpen) {
          setCustomerDrawerOpen(false);
        } else if (paymentModalOpen) {
          setPaymentModalOpen(false);
        } else if (updateGstModalOpen) {
          setUpdateGstModalOpen(false);
        } else if (repeatInvoiceOpen) {
          setRepeatInvoiceOpen(false);
        } else if (favoritesPanelOpen) {
          setFavoritesPanelOpen(false);
        } else if (q) {
          setQ("");
          if (searchInputRef.current) {
            searchInputRef.current.value = "";
          }
        }
      },
      description: "Close modal / Clear search",
    },
    {
      key: "r",
      ctrlKey: true,
      handler: () => setRepeatInvoiceOpen(true),
      description: "Repeat Last Invoice",
    },
    {
      key: "?",
      shiftKey: true,
      handler: () => setShowShortcuts(true),
      description: "Show shortcuts help",
    },
  ];

  useKeyboardShortcuts(shortcuts, true);

  // Handle Enter key in search input
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && q.trim()) {
      // Check if it looks like a barcode (8-14 digits or 6-32 alphanumeric)
      const barcodePattern = /^[0-9]{8,14}$|^[A-Z0-9]{6,32}$/i;
      if (barcodePattern.test(q.trim())) {
        e.preventDefault();
        await handleScan(q.trim());
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      // Navigate suggestions (if implemented)
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      // Navigate suggestions (if implemented)
    }
  };

  // Add product to cart with GST validation
  async function addProductToCart(product: any) {
    // Cache product data for later updates
    setProductsCache((prev) => new Map(prev).set(product.id, product));

    // Auto-suggest HSN if missing (before validation)
    if (!product.hsnCode) {
      const suggestedHsn = suggestHsnCode({
        brandName: product.name,
        category: product.category,
        type: product.type,
        composition: product.composition || product.saltComposition,
      });
      product.hsnCode = suggestedHsn.hsnCode;
      if (!product.gstRate && product.gstRate !== 0) {
        product.gstRate = suggestedHsn.gstRate;
      }
      
      // Show info message that HSN was auto-suggested
      showToast(`HSN ${suggestedHsn.hsnCode} (${suggestedHsn.gstRate}% GST) auto-suggested for ${product.name}`, "info");
    }

    // Default GST rate to 12% if missing (common for medicines)
    if (!product.gstRate && product.gstRate !== 0) {
      product.gstRate = 12; // Default GST rate for medicines
    }

    // Now validate - HSN should always be present after auto-suggestion
    if (!product.hsnCode) {
      setErr(`HSN code missing for "${product.name}". Please add HSN code before billing.`);
      playErrorSound();
      // Store product for update modal
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

    const pricePaise = Math.round(
      (product.salePrice || product.unitPrice || product.mrp || 0) * 100
    );

    // Get GST type (INCLUSIVE or EXCLUSIVE)
    const gstType = product.gstType || "EXCLUSIVE";
    const gstRate = Number(product.gstRate) || 0;

    const cartItem: CartItem = {
      key: `product-${product.id}`,
      productName: product.name,
      unitPricePaise: pricePaise,
      quantity: 1,
      hsnCode: product.hsnCode, // Required
      gstRate: gstRate, // GST rate as percentage
      gstType: gstType === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE",
      gstRateBps: Math.round(gstRate * 100), // Legacy: in basis points
      ean: product.barcode || product.barcodeValue || null,
      productId: product.id,
    };

    addItem(cartItem);
    playBeepSound();
    setErr(null);
  }

  // Handle checkout with payments (new flow)
  async function handleCheckout(payments: any[], idempotencyKey: string) {
    if (items.length === 0) {
      setErr("Cart is empty");
      return;
    }

    // If offline, queue invoice instead of creating it
    if (!navigator.onLine) {
      if (!offlineToken) {
        setErr("Offline mode requires entitlement token. Contact admin.");
        return;
      }

      setIsCheckingOut(true);
      try {
        const { saveOfflineInvoice } = await import("@/lib/offline/indexeddb");
        const { calculateInvoiceTotals } = await import("@/lib/gst/taxCalculator");
        
        // Calculate totals
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
        const totals = calculateInvoiceTotals(taxCalculations, true);

        // Create offline invoice entry
        const deviceId = localStorage.getItem("device_id") || `device-${Date.now()}`;
        if (!localStorage.getItem("device_id")) {
          localStorage.setItem("device_id", deviceId);
        }

        const offlineInvoice = {
          localId: crypto.randomUUID(),
          idempotencyKey,
          tenantId: user?.tenantId || 1,
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

        // Generate offline receipt PDF
        try {
          const { generateOfflineReceiptPDF, downloadReceiptPDF, storeReceiptPDF } = await import("@/lib/receipt/pdf-generator");
          
          const pdfData = {
            invoiceNumber: `OFFLINE-${offlineInvoice.localId.substring(0, 8)}`,
            invoiceDate: new Date(),
            customerName: selectedCustomer?.name || null,
            buyerGstin: selectedCustomer?.gstin || null,
            sellerGstin: "27AAAAA0000A1Z5", // TODO: Get from settings
            placeOfSupply: selectedCustomer?.stateCode || null,
            lineItems: items.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              unitPricePaise: item.unitPricePaise,
              hsnCode: item.hsnCode || null,
              gstRate: item.gstRate || null,
              cgstPaise: taxCalculations.find((_, idx) => idx === items.indexOf(item))?.cgstPaise || 0,
              sgstPaise: taxCalculations.find((_, idx) => idx === items.indexOf(item))?.sgstPaise || 0,
              igstPaise: 0,
              taxableValuePaise: taxCalculations.find((_, idx) => idx === items.indexOf(item))?.taxableValuePaise || 0,
              lineTotalPaise: taxCalculations.find((_, idx) => idx === items.indexOf(item))?.lineTotalPaise || item.unitPricePaise * item.quantity,
            })),
            totals,
            paymentMethod: payments[0]?.method || "CASH",
            paidAmountPaise: payments.reduce((sum, p) => sum + p.amountPaise, 0),
          };

          const pdfBlob = await generateOfflineReceiptPDF(pdfData);
          
          // Store PDF for offline access
          await storeReceiptPDF(offlineInvoice.localId, pdfBlob);
          
          // Offer to download
          downloadReceiptPDF(pdfBlob, `invoice-offline-${offlineInvoice.localId.substring(0, 8)}.pdf`);
        } catch (pdfError) {
          console.error("Failed to generate offline receipt PDF:", pdfError);
          // Don't block - PDF generation is optional
        }

        showToast("Invoice queued for sync. Receipt downloaded. It will be processed when online.", "success");

        // Clear cart
        clear();
        setSelectedCustomer(null);
        setCheckoutModalOpen(false);

        // Clear cart storage
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
        // Check if it's a permission error
        if (data.code === "FORBIDDEN") {
          setErr(`Permission denied: ${data.message}`);
        } else {
          setErr(data.error || "Checkout failed");
        }
        setIsCheckingOut(false);
        return;
      }

      if (data.invoice) {
        showToast(`Invoice ${data.invoice.invoiceNumber || data.invoice.id} created!`, "success");

        // Clear cart
        clear();
        setSelectedCustomer(null);
        setCheckoutModalOpen(false);

        // Clear cart storage
        const { clearCartStorage } = await import("@/lib/offline/cart-storage");
        await clearCartStorage();
        
        // Redirect to invoice
        const invoiceId = data.invoice.id;
        router.push(`/invoices/${invoiceId}/print`);
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

  // Calculate GST totals using tax calculator
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

  const invoiceTotals = calculateInvoiceTotals(taxCalculations, true); // Intra-state (CGST+SGST)

  const totalDiscount = items.reduce((sum, item) => {
    const lineTotal = item.unitPricePaise * item.quantity;
    const discount = item.discountPercent 
      ? Math.round((lineTotal * item.discountPercent) / 100)
      : (item.discountPaise || 0);
    return sum + discount;
  }, 0);

  // Check for missing GST fields
  const missingGstItems = items.filter(
    (item) => !item.hsnCode || item.gstRate === undefined
  );

  const finalTotal = invoiceTotals.grandTotalPaise;

  // Handle repeat invoice
  async function handleRepeatInvoice(lineItems: any[], customer: any | null) {
    clear();
    if (customer) {
      setSelectedCustomer(customer);
    }
    
    // Add items to cart with stock validation
    for (const item of lineItems) {
      try {
        // Check stock availability
        if (item.productId) {
          const res = await fetch(`/api/products/${item.productId}`);
          if (res.ok) {
            const product = await res.json();
            const availableQty = Math.min(item.quantity, product.stockLevel || 0);
            if (availableQty < item.quantity) {
              showToast(`Warning: ${item.productName} - Only ${availableQty} available (requested ${item.quantity})`, "info");
            }
            if (availableQty > 0) {
              item.quantity = availableQty;
              await addProductToCart(product);
              // Update quantity if different
              if (item.quantity > 1) {
                const cartKey = `product-${item.productId}`;
                setQty(cartKey, item.quantity);
              }
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
      {/* Offline Banner */}
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
      
      {/* Left: Product Search & Cart */}
      <div className="flex-1 flex flex-col p-6" style={{ marginTop: isOnline ? '0' : '60px' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">POS Terminal</h1>
          <div className="flex items-center gap-2">
            {/* Barcode-first mode toggle */}
            <button
              onClick={() => setBarcodeFirstMode(!barcodeFirstMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                barcodeFirstMode
                  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : "bg-gray-100 text-gray-700 border-gray-300"
              }`}
              title="Barcode-first mode"
            >
              {barcodeFirstMode ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
              <QrCode className="w-4 h-4" />
              <span className="text-sm">Barcode-first</span>
            </button>
            
            {/* Favorites/Fast-moving panel toggle */}
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
                selectedCustomer
                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                  : "bg-gray-100 text-gray-700 border border-gray-300"
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
            
            {/* Video Assist Button - Only for Pharmacist and Owner */}
            <VideoAssistButton
              context="POS"
              contextData={{
                cartItems: items.map(item => ({
                  productName: item.productName,
                  quantity: item.quantity,
                })),
                customerId: selectedCustomer?.id,
                totalAmountPaise: subtotalPaise,
              }}
              tenantId={user ? (parseInt(user.tenantId) || 1) : 1}
              userId={user?.userId || "guest"}
              userRole={user?.role?.toUpperCase() || "OWNER"}
            />
            
            {/* Repeat last invoice */}
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              ref={searchInputRef}
              data-scanner="true"
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={barcodeFirstMode ? "Scan barcode (EAN/HSN/INMED)..." : "Search products or scan barcode..."}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                barcodeFirstMode 
                  ? "border-blue-400 focus:ring-blue-500 bg-blue-50/50" 
                  : "border-gray-300 focus:ring-blue-500"
              }`}
              autoFocus={barcodeFirstMode}
            />
            {barcodeFirstMode && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
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
            {missingGstItems.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <div className="font-medium mb-2">⚠️ GST Details Missing</div>
                <div className="text-sm mb-3">
                  The following items are missing HSN code or GST rate:
                  <ul className="list-disc list-inside mt-1">
                    {missingGstItems.map((item) => (
                      <li key={item.key}>{item.productName}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  {missingGstItems.map((item) => {
                    const product = productsCache.get(Number(item.productId));
                    if (!product) return null;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          setProductToUpdate({
                            id: product.id,
                            name: product.name,
                            hsnCode: product.hsnCode,
                            gstRate: product.gstRate,
                            gstType: product.gstType,
                            barcode: product.barcode || product.barcodeValue,
                          });
                          setUpdateGstModalOpen(true);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Update {item.productName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cart */}
        <div className="flex-1 border rounded-lg bg-white p-4 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Cart ({items.length})</h2>
            {items.length > 0 && (
              <button
                onClick={clear}
                className="text-sm text-red-600 hover:text-red-700"
              >
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
                          <span className="text-green-600 ml-2">
                            -₹{(item.discountPaise / 100).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {item.batchNumber && (
                        <div className="text-xs text-gray-500 mt-1">
                          Batch: {item.batchNumber}
                        </div>
                      )}
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
                      <button
                        onClick={() => removeItem(item.key)}
                        className="px-2 py-1 text-red-600 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {/* GST Details */}
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
              // Check for HSN issues first
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
                  const res = await fetch(`/api/products/by-barcode?code=INMED-${String(item.drugLibraryId).padStart(6, "0")}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.found && data.product) {
                      await addProductToCart(data.product);
                    }
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
            onToggleFavorite={async (itemId, drugLibraryId, productId) => {
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
                body: JSON.stringify({
                  qrCode: scannedDrug.qrCode || scannedDrug.barcode || missingBarcode,
                  ...data,
                }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to add to inventory");
              }
              
              // After adding to inventory, try to scan again to add to cart
              setShowScanToInventory(false);
              setScannedDrug(null);
              showToast("Product added to inventory! Scan barcode again to add to cart.", "success");
              // Optionally auto-scan again
              // handleScan(missingBarcode);
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
              // Product already created by AddProductModal
              // Now add it to cart
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
            // First, add drug to inventory if not already there
            const inventoryResponse = await fetch("/api/inventory/add-from-library", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                drugLibraryId: drug.id,
                qtyOnHand: 0, // Default quantity
                tenantId: 1, // Default tenant ID
              }),
            });

            let inventoryItem = null;
            if (inventoryResponse.ok) {
              const inventoryData = await inventoryResponse.json();
              inventoryItem = inventoryData.inventoryItem;
            } else {
              const error = await inventoryResponse.json().catch(() => ({}));
              // If already exists, try to fetch it
              if (error.error && error.error.includes("already exists")) {
                // Item already exists, fetch it from inventory
                const itemsResponse = await fetch("/api/inventory/items?tenantId=1");
                if (itemsResponse.ok) {
                  const itemsData = await itemsResponse.json();
                  inventoryItem = itemsData.items?.find((item: any) => item.drugLibraryId === drug.id);
                }
              } else {
                throw new Error(error.error || error.details || "Failed to add drug to inventory");
              }
            }

            // Add to cart with proper GST data
            const priceInr = drug.dpcoCeilingPriceInr || (typeof drug.priceInr === 'string' ? parseFloat(drug.priceInr) : (drug.priceInr || 0));
            const gstRate = drug.gstPercent || 12; // Default to 12% if not specified

            // Use inventory item ID if available, otherwise use drug ID
            const productId = inventoryItem?.id || drug.id;

            // Get HSN code - suggest from drug library data
            // Note: InventoryItem doesn't have hsnCode, so we suggest from drug library
            const suggestedHsn = suggestHsnCode({
              brandName: drug.brandName,
              category: drug.category || undefined,
              type: undefined, // DrugLibraryResult doesn't have type field
              composition: drug.fullComposition || drug.salts || undefined,
            });
            const hsnCode = suggestedHsn.hsnCode; // Defaults to 3004 for medicines
            const finalGstRate = suggestedHsn.gstRate || gstRate;

            // Prepare product data for cart
            const productData = {
              id: productId,
              name: drug.brandName,
              salePrice: priceInr,
              unitPrice: priceInr,
              mrp: drug.dpcoCeilingPriceInr || priceInr,
              hsnCode: hsnCode,
              gstRate: finalGstRate,
              gstType: "EXCLUSIVE",
              drugLibraryId: drug.id,
              category: drug.category,
              manufacturer: drug.manufacturer,
              composition: drug.fullComposition || drug.salts,
              saltComposition: drug.salts,
            };

            // Add to cart
            await addProductToCart(productData);
            
            // Show success message
            showToast(`${drug.brandName} added to cart (HSN: ${hsnCode}, ${finalGstRate}% GST)`, "success");
            setDrugLibraryOpen(false);
          } catch (error: any) {
            console.error("Error adding drug to POS:", error);
            setErr(`Failed to add drug: ${error?.message || "Unknown error"}`);
          }
        }}
      />

      <CheckoutModal
        isOpen={checkoutModalOpen}
        items={items}
        customerId={selectedCustomer?.id || null}
        onClose={() => setCheckoutModalOpen(false)}
        onConfirm={handleCheckout}
      />

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
          // Re-validate and open checkout
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
          // Update product cache
          setProductsCache((prev) => new Map(prev).set(updatedProduct.id, updatedProduct));

          // If this product is in cart, update the cart item
          const cartItem = items.find(
            (item) => item.productId === updatedProduct.id
          );
          if (cartItem) {
            // Remove old item and add updated one
            removeItem(cartItem.key);
            
            // Re-add with updated GST data
            const pricePaise = Math.round(
              (updatedProduct.salePrice || updatedProduct.unitPrice || updatedProduct.mrp || 0) * 100
            );
            
            const updatedCartItem: CartItem = {
              key: `product-${updatedProduct.id}`,
              productName: updatedProduct.name,
              unitPricePaise: pricePaise,
              quantity: cartItem.quantity, // Preserve quantity
              hsnCode: updatedProduct.hsnCode || "",
              gstRate: updatedProduct.gstRate || 12,
              gstType: (updatedProduct.gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
              gstRateBps: Math.round((updatedProduct.gstRate || 12) * 100),
              ean: updatedProduct.barcode || null,
              productId: updatedProduct.id,
            };
            
            addItem(updatedCartItem);
          }

          // Clear error
          setErr(null);
          
          // Auto-focus search in barcode-first mode
          if (barcodeFirstMode && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }
        }}
      />

      <RepeatInvoiceModal
        isOpen={repeatInvoiceOpen}
        onClose={() => setRepeatInvoiceOpen(false)}
        onConfirm={handleRepeatInvoice}
      />

      <ShortcutsHelp />
      
      {/* Scan Confirmation */}
      {lastScannedItem && (
        <ScanConfirmation
          productName={lastScannedItem.productName}
          quantity={lastScannedItem.quantity}
          price={lastScannedItem.price}
          onAdjustQuantity={(newQty) => {
            setQty(lastScannedItem.key, newQty);
            const item = items.find(i => i.key === lastScannedItem.key);
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
