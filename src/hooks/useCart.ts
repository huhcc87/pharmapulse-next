// src/hooks/useCart.ts
"use client";

import { useCallback, useMemo, useState } from "react";

export type CartItem = {
  key: string; // must be unique
  productName: string;
  unitPricePaise: number;
  quantity: number;
  unitType?: string; // PIECE, BOX, STRIP, BOTTLE, etc.

  // GST fields (required for compliance - validated in POS)
  hsnCode: string; // Required (validated before adding to cart)
  gstRate: number; // GST rate as percentage (e.g., 12 for 12%)
  gstType: "INCLUSIVE" | "EXCLUSIVE";
  gstRateBps?: number | null; // Legacy: GST rate in basis points
  ean?: string | null; // EAN/GTIN barcode
  
  discountPaise?: number;
  discountPercent?: number;

  batchNumber?: string | null;
  expiryDate?: string | null;

  drugLibraryId?: number | string | null;
  productId?: number | string | null;
};

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    const qty = item.quantity ?? 1;

    setItems((prev) => {
      const existing = prev.find((x) => x.key === item.key);
      if (existing) {
        return prev.map((x) =>
          x.key === item.key ? { ...x, quantity: x.quantity + qty } : x
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((x) => x.key !== key));
  }, []);

  const setQty = useCallback((key: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((x) => x.key !== key);
      return prev.map((x) => (x.key === key ? { ...x, quantity } : x));
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotalPaise = useMemo(() => {
    return items.reduce((sum, x) => {
      const lineTotal = x.unitPricePaise * x.quantity;
      const discount = x.discountPercent 
        ? Math.round((lineTotal * x.discountPercent) / 100)
        : (x.discountPaise ?? 0);
      return sum + lineTotal - discount;
    }, 0);
  }, [items]);

  const updateItem = useCallback((key: string, updates: Partial<CartItem>) => {
    setItems((prev) =>
      prev.map((x) => (x.key === key ? { ...x, ...updates } : x))
    );
  }, []);

  return {
    items,
    addItem,
    removeItem,
    setQty,
    updateItem,
    clear,
    subtotalPaise,
  };
}
