"use client";

import { create } from "zustand";
import type { CartItem } from "@/lib/posTypes";

type CartState = {
  items: CartItem[];
  setQty: (id: string, qty: number) => void;
  setPrice: (id: string, unitPrice: number) => void;
  setDiscount: (id: string, discount: number) => void;
  addOrIncrement: (item: Omit<CartItem, "qty" | "discount"> & { qty?: number; discount?: number }) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  setQty: (id, qty) =>
    set({
      items: get().items.map((x) => (x.id === id ? { ...x, qty: Math.max(1, Math.floor(qty || 1)) } : x)),
    }),
  setPrice: (id, unitPrice) =>
    set({
      items: get().items.map((x) => (x.id === id ? { ...x, unitPrice: Math.max(0, Number(unitPrice || 0)) } : x)),
    }),
  setDiscount: (id, discount) =>
    set({
      items: get().items.map((x) => (x.id === id ? { ...x, discount: Math.max(0, Number(discount || 0)) } : x)),
    }),
  addOrIncrement: (item) => {
    const qty = item.qty ?? 1;
    const discount = item.discount ?? 0;
    const existing = get().items.find((x) => x.id === item.id);
    if (existing) {
      set({
        items: get().items.map((x) => (x.id === item.id ? { ...x, qty: x.qty + qty } : x)),
      });
      return;
    }
    set({ items: [...get().items, { ...item, qty, discount }] as CartItem[] });
  },
  remove: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
  clear: () => set({ items: [] }),
}));
