// src/app/pos/page-enhanced.tsx
// Enhanced POS Terminal with India-first features
"use client";

import { useState, useRef, useEffect } from "react";
import { useCart, type CartItem } from "@/hooks/useCart";
import { useBarcodeWedge } from "@/hooks/useBarcodeWedge";
import { playErrorSound, playBeepSound } from "@/lib/scannerFeedback";
import BindBarcodeModal from "@/components/barcode/BindBarcodeModal";
import DrugLibraryModal from "@/components/DrugLibraryModal";
import PaymentModal from "@/components/pos/PaymentModal";
import CustomerDrawer from "@/components/pos/CustomerDrawer";
import AlertsPanel from "@/components/pos/AlertsPanel";
import { useRouter } from "next/navigation";
import { 
  Search, User, ShoppingCart, Package, AlertTriangle, 
  Gift, History, Receipt, Printer, Mail, MessageSquare,
  HelpCircle, X
} from "lucide-react";
import type { CustomerDTO, InventoryAlert, DrugInteractionAlert, SuggestedAddOn, RefillReminder } from "@/lib/types/pos";

export default function EnhancedPOSPage() {
  const router = useRouter();
  const { items, addItem, removeItem, setQty, clear, subtotalPaise, updateItem } = useCart();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [missingBarcode, setMissingBarcode] = useState("");
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [drugLibraryOpen, setDrugLibraryOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [interactionAlerts, setInteractionAlerts] = useState<DrugInteractionAlert[]>([]);
  const [suggestedAddOns, setSuggestedAddOns] = useState<SuggestedAddOn[]>([]);
  const [refillReminders, setRefillReminders] = useState<RefillReminder[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle barcode scan
  async function handleScan(code: string) {
    const normalizedCode = code.trim();
    setQ("");
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }

    try {
      const res = await fetch(`/api/products/by-barcode?code=${encodeURIComponent(normalizedCode)}`);
      const data = await res.json();

      if (data.found && data.product) {
        const hasHsn = !!data.product.hsnCode;
        const hasGst = data.product.gstRate !== null && data.product.gstRate !== undefined;

        if (!hasHsn || !hasGst) {
          playErrorSound();
          setErr(`GST mapping missing for "${data.product.name}". Please map HSN + GST before billing.`);
          return;
        }

        await addProductToCart(data.product);
        setErr(null);
      } else {
        setMissingBarcode(normalizedCode);
        setBindModalOpen(true);
        playErrorSound();
      }
    } catch (error) {
      console.error("❌ Barcode scan error:", error);
      playErrorSound();
      setMissingBarcode(normalizedCode);
      setBindModalOpen(true);
    }
  }

  useBarcodeWedge(handleScan, { minLen: 6, timeoutMs: 80 });

  // Add product to cart with inventory check
  async function addProductToCart(product: any) {
    // Check inventory availability
    try {
      if (product.id) {
        const inventoryRes = await fetch(`/api/inventory/check?productId=${product.id}`);
        const invData = await inventoryRes.json();
        
        if (invData.availableQty !== undefined && invData.availableQty < 1) {
          setErr(`Insufficient stock for ${product.name}`);
          playErrorSound();
          return;
        }

        // Check for alerts
        if (invData.isLowStock) {
          setAlerts((prev) => [...prev, {
            type: "LOW_STOCK",
            productId: product.id,
            productName: product.name,
            message: `${product.name} is low on stock`,
            severity: "WARNING",
            currentStock: invData.availableQty,
            reorderLevel: invData.reorderLevel,
          }]);
        }
      }
    } catch (error) {
      console.warn("Inventory check failed:", error);
    }

    const pricePaise = Math.round((product.salePrice || product.unitPrice || product.mrp || 0) * 100);
    
    // Get GST rate as percentage (not bps) - ensure it's a number
    const gstRate = Number(product.gstRate) || 0; // GST rate as percentage (e.g., 12 for 12%)
    
    // Default GST type to EXCLUSIVE if not specified
    const gstType: "INCLUSIVE" | "EXCLUSIVE" = product.gstType || "EXCLUSIVE";
    
    // Ensure hsnCode is always a string (required field)
    const hsnCode = product.hsnCode || "";

    const cartItem: CartItem = {
      key: `product-${product.id}`,
      productName: product.name,
      unitPricePaise: pricePaise,
      quantity: 1,
      hsnCode: hsnCode,
      gstRate: gstRate,
      gstType: gstType,
      productId: product.id,
      drugLibraryId: product.drugLibraryId || null,
    };

    addItem(cartItem);
    playBeepSound();
    setErr(null);

    // Check for drug interactions if customer has allergies
    if (selectedCustomer?.allergies && selectedCustomer.allergies.length > 0) {
      // Simplified interaction check (in production, use a drug interaction API)
      checkDrugInteractions(cartItem);
    }

    // Load suggestions
    loadSuggestions();
  }

  // Check drug interactions
  function checkDrugInteractions(item: CartItem) {
    // Simplified check - in production, use a proper drug interaction database
    const rxItems = items.filter((i) => i.productName.toLowerCase().includes("paracetamol") || 
                                      i.productName.toLowerCase().includes("acetaminophen"));
    
    if (rxItems.length > 0 && selectedCustomer?.allergies?.some((a: string) => 
        a.toLowerCase().includes("paracetamol") || a.toLowerCase().includes("acetaminophen"))) {
      setInteractionAlerts([{
        severity: "ERROR",
        message: "Customer has allergy to Paracetamol. Do not dispense.",
        interactingDrugs: [item.productName, ...rxItems.map((i) => i.productName)],
        acknowledged: false,
      }]);
    }
  }

  // Load suggested add-ons
  async function loadSuggestions() {
    // Simplified - in production, use sales history and category mapping
    if (items.length > 0) {
      // Example: if cough syrup, suggest lozenges
      const hasCoughSyrup = items.some((i) => 
        i.productName.toLowerCase().includes("cough") || 
        i.productName.toLowerCase().includes("syrup")
      );
      
      if (hasCoughSyrup) {
        setSuggestedAddOns([{
          productName: "Halls Lozenges",
          reason: "Frequently bought together",
          pricePaise: 2000, // ₹20
        }]);
      }
    }
  }

  // Load refill reminders
  useEffect(() => {
    if (selectedCustomer?.id) {
      // Check for refill reminders (simplified)
      // In production, check purchase history
      setRefillReminders([]);
    }
  }, [selectedCustomer]);

  // Handle checkout
  async function handleCheckout(payments: any[]) {
    if (items.length === 0) {
      setErr("Cart is empty");
      return;
    }

    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || null,
          lineItems: items,
          payments,
          discounts: {},
        }),
      });

      const data = await res.json();
      if (data.invoice) {
        // Show success and redirect
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        successMsg.innerHTML = `✓ Invoice created! ${data.loyaltyPointsEarned ? `Earned ${data.loyaltyPointsEarned} points` : ''}`;
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);

        // Redirect to invoice or stay on POS
        setTimeout(() => {
          router.push(`/dashboard/invoices/${data.invoice.id}`);
        }, 1000);
      } else {
        throw new Error("Invalid response");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      setErr(error.message || "Checkout failed");
    } finally {
      setIsCheckingOut(false);
      setPaymentModalOpen(false);
    }
  }

  const totalDiscount = items.reduce((sum, item) => {
    const lineTotal = item.unitPricePaise * item.quantity;
    const discount = item.discountPercent 
      ? Math.round((lineTotal * item.discountPercent) / 100)
      : (item.discountPaise || 0);
    return sum + discount;
  }, 0);

  const finalTotal = subtotalPaise - totalDiscount;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left: Product Search & Cart */}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">POS Terminal</h1>
          <div className="flex items-center gap-2">
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
              placeholder="Search products or scan barcode..."
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          {err && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {err}
            </div>
          )}
        </div>

        {/* Alerts */}
        {(alerts.length > 0 || interactionAlerts.length > 0) && (
          <div className="mb-4">
            <AlertsPanel alerts={alerts} interactionAlerts={interactionAlerts} />
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
                <div key={item.key} className="flex justify-between items-start p-3 border rounded-lg hover:bg-gray-50">
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
              ))}
            </div>
          )}
        </div>

        {/* Suggested Add-ons */}
        {suggestedAddOns.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm font-medium text-blue-900 mb-2">Suggested Add-ons</div>
            <div className="space-y-1">
              {suggestedAddOns.map((suggestion, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{suggestion.productName}</span>
                  <span className="text-blue-700">₹{(suggestion.pricePaise / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refill Reminders */}
        {refillReminders.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm font-medium text-yellow-900 mb-2">Refill Due</div>
            {refillReminders.map((reminder, idx) => (
              <div key={idx} className="text-sm">
                {reminder.productName} - Last purchased {reminder.daysSinceLastPurchase} days ago
              </div>
            ))}
          </div>
        )}

        {/* Total & Checkout */}
        <div className="mt-4 border-t pt-4 bg-white p-4 rounded-lg">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>₹{(subtotalPaise / 100).toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount:</span>
                <span>-₹{(totalDiscount / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>₹{(finalTotal / 100).toFixed(2)}</span>
            </div>
            {selectedCustomer?.loyaltyPoints && selectedCustomer.loyaltyPoints > 0 && (
              <div className="text-sm text-gray-600 flex items-center gap-1">
                <Gift className="w-4 h-4" />
                Available: {selectedCustomer.loyaltyPoints} points
              </div>
            )}
          </div>
          <button
            onClick={() => setPaymentModalOpen(true)}
            disabled={items.length === 0 || isCheckingOut}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
          >
            {isCheckingOut ? "Processing..." : "Checkout"}
          </button>
        </div>
      </div>

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
      />

      <DrugLibraryModal
        isOpen={drugLibraryOpen}
        onClose={() => setDrugLibraryOpen(false)}
        onSelectDrug={(drug) => {
          addProductToCart({
            id: drug.id,
            name: drug.brandName,
            salePrice: (drug as any).dpcoCeilingPriceInr || parseFloat((drug as any).priceInr || "0"),
            hsnCode: (drug as any).hsnCode,
            gstRate: (drug as any).gstRate,
            drugLibraryId: drug.id,
          });
          setDrugLibraryOpen(false);
        }}
      />

      <PaymentModal
        isOpen={paymentModalOpen}
        totalPaise={finalTotal}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handleCheckout}
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
    </div>
  );
}


