import type { GstType } from "@/lib/gst";

export type CartItem = {
  id: string; // productId or temp id
  name: string;
  barcode?: string | null;
  hsn?: string | null;
  gstRate?: number | null;
  gstType: GstType;
  qty: number;
  unitPrice: number;
  discount: number;
};

