// Hold/Resume sale feature - save and restore cart state
"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "./useCart";

const HOLD_SALES_KEY = "pharmapulse_hold_sales";

export type HoldSale = {
  id: string;
  cartItems: CartItem[];
  customerName?: string;
  createdAt: Date;
  resumedAt?: Date;
};

export function useHoldSale() {
  const [holdSales, setHoldSales] = useState<HoldSale[]>([]);

  useEffect(() => {
    // Load hold sales from localStorage
    try {
      const stored = localStorage.getItem(HOLD_SALES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHoldSales(
          parsed.map((h: any) => ({
            ...h,
            createdAt: new Date(h.createdAt),
            resumedAt: h.resumedAt ? new Date(h.resumedAt) : undefined,
          }))
        );
      }
    } catch (e) {
      console.error("Failed to load hold sales:", e);
    }
  }, []);

  const saveHoldSale = useCallback((cartItems: CartItem[], customerName?: string): string => {
    const holdSale: HoldSale = {
      id: `hold-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      cartItems,
      customerName,
      createdAt: new Date(),
    };

    const updated = [holdSale, ...holdSales];
    setHoldSales(updated);
    localStorage.setItem(HOLD_SALES_KEY, JSON.stringify(updated));
    return holdSale.id;
  }, [holdSales]);

  const removeHoldSale = useCallback((id: string) => {
    const updated = holdSales.filter((h) => h.id !== id);
    setHoldSales(updated);
    localStorage.setItem(HOLD_SALES_KEY, JSON.stringify(updated));
  }, [holdSales]);

  const getHoldSale = useCallback((id: string): HoldSale | undefined => {
    return holdSales.find((h) => h.id === id);
  }, [holdSales]);

  const resumeHoldSale = useCallback((id: string): CartItem[] | null => {
    const holdSale = holdSales.find((h) => h.id === id);
    if (!holdSale) return null;

    // Mark as resumed
    const updated = holdSales.map((h) =>
      h.id === id ? { ...h, resumedAt: new Date() } : h
    );
    setHoldSales(updated);
    localStorage.setItem(HOLD_SALES_KEY, JSON.stringify(updated));

    return holdSale.cartItems;
  }, [holdSales]);

  return {
    holdSales,
    saveHoldSale,
    removeHoldSale,
    getHoldSale,
    resumeHoldSale,
  };
}


