// src/lib/inventory/fefo.ts
// FEFO (First Expiry First Out) logic for pharmacy inventory

import { prisma } from "@/server/prisma";

export interface BatchWithExpiry {
  id: number;
  batchCode: string;
  expiryDate: Date;
  quantityOnHand: number;
  daysToExpiry: number;
  isExpired: boolean;
  isNearExpiry: boolean;
  nearExpiryDays: number | null;
  mrp?: number | null;
  saleGstRateOverride?: number | null;
  nearExpiryDiscountPct?: number | null;
}

/**
 * Prisma Decimal → number | null helper
 */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  // Prisma.Decimal has toNumber()
  const anyVal = value as any;
  if (typeof anyVal?.toNumber === "function") return anyVal.toNumber();

  // Sometimes values may already be number/string
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

/**
 * Calculate days until expiry
 */
export function calculateDaysToExpiry(expiryDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if batch is expired
 */
export function isExpired(expiryDate: Date): boolean {
  return calculateDaysToExpiry(expiryDate) < 0;
}

/**
 * Check if batch is near expiry
 */
export function isNearExpiry(expiryDate: Date, thresholdDays: number = 90): boolean {
  const daysToExpiry = calculateDaysToExpiry(expiryDate);
  return daysToExpiry >= 0 && daysToExpiry <= thresholdDays;
}

/**
 * Get expiry warning level
 */
export function getExpiryWarning(expiryDate: Date): {
  level: "SAFE" | "NEAR" | "SOON" | "CRITICAL" | "EXPIRED";
  days: number;
  message: string;
} {
  const days = calculateDaysToExpiry(expiryDate);

  if (days < 0) return { level: "EXPIRED", days, message: "Expired" };
  if (days <= 30) return { level: "CRITICAL", days, message: `Expiring in ${days} days (Critical)` };
  if (days <= 60) return { level: "SOON", days, message: `Expiring soon (${days} days)` };
  if (days <= 90) return { level: "NEAR", days, message: `Near expiry (${days} days)` };
  return { level: "SAFE", days, message: "Safe" };
}

/**
 * Get FEFO-ordered batches for a product
 */
export async function getFefoBatches(
  productId: number,
  tenantId: number = 1,
  _branchId?: number | null
): Promise<BatchWithExpiry[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      batches: {
        where: { quantityOnHand: { gt: 0 } },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!product?.batches?.length) return [];

  return product.batches.map((batch) => {
    const daysToExpiry = calculateDaysToExpiry(batch.expiryDate);

    return {
      id: batch.id,
      batchCode: batch.batchCode,
      expiryDate: batch.expiryDate,
      quantityOnHand: batch.quantityOnHand,
      daysToExpiry,
      isExpired: daysToExpiry < 0,
      isNearExpiry: daysToExpiry >= 0 && daysToExpiry <= 90,
      nearExpiryDays: daysToExpiry <= 90 ? daysToExpiry : null,
      saleGstRateOverride:
        batch.saleGstRateOverride !== null && batch.saleGstRateOverride !== undefined
          ? Number(batch.saleGstRateOverride)
          : null,
      nearExpiryDiscountPct:
        batch.nearExpiryDiscountPct !== null && batch.nearExpiryDiscountPct !== undefined
          ? Number(batch.nearExpiryDiscountPct)
          : null,
    };
  });
}

/**
 * Get FEFO-ordered batches for drug library item
 */
export async function getFefoBatchesForDrug(
  drugLibraryId: number,
  tenantId: number = 1,
  branchId?: number | null
): Promise<BatchWithExpiry[]> {
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: {
      drugLibraryId,
      tenantId,
      branchId: branchId ?? undefined,
      qtyOnHand: { gt: 0 },
      batchId: { not: null },
    },
    include: { batch: true },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });

  return inventoryItems
    .filter((item) => item.batch)
    .map((item) => {
      const batch = item.batch!;
      const daysToExpiry = calculateDaysToExpiry(batch.expiryDate);

      return {
        id: batch.id,
        batchCode: batch.batchCode,
        expiryDate: batch.expiryDate,
        quantityOnHand: item.qtyOnHand,
        daysToExpiry,
        isExpired: daysToExpiry < 0,
        isNearExpiry: daysToExpiry >= 0 && daysToExpiry <= 90,
        nearExpiryDays: daysToExpiry <= 90 ? daysToExpiry : null,

        // ✅ FIX: Decimal -> number
        mrp: toNumberOrNull(item.mrp),

        saleGstRateOverride:
          batch.saleGstRateOverride !== null && batch.saleGstRateOverride !== undefined
            ? Number(batch.saleGstRateOverride)
            : null,
        nearExpiryDiscountPct:
          batch.nearExpiryDiscountPct !== null && batch.nearExpiryDiscountPct !== undefined
            ? Number(batch.nearExpiryDiscountPct)
            : null,
      };
    });
}

/**
 * Select best batch for item (FEFO)
 */
export async function selectBestBatch(
  productId?: number,
  drugLibraryId?: number,
  quantity: number = 1,
  tenantId: number = 1,
  branchId?: number | null
): Promise<BatchWithExpiry | null> {
  let batches: BatchWithExpiry[] = [];

  if (productId) batches = await getFefoBatches(productId, tenantId, branchId);
  else if (drugLibraryId) batches = await getFefoBatchesForDrug(drugLibraryId, tenantId, branchId);

  if (!batches.length) return null;

  for (const batch of batches) {
    if (batch.isExpired) continue;
    if (batch.quantityOnHand >= quantity) return batch;
  }

  return batches.find((b) => !b.isExpired && b.quantityOnHand > 0) || null;
}

/**
 * Get suggested discount for near-expiry batch
 */
export function getSuggestedDiscount(
  daysToExpiry: number,
  nearExpiryDiscountPct?: number | null
): { discountPercent: number; reason: string } | null {
  if (daysToExpiry > 90 || daysToExpiry < 0) return null;

  if (nearExpiryDiscountPct !== null && nearExpiryDiscountPct !== undefined) {
    return { discountPercent: Number(nearExpiryDiscountPct), reason: `Near expiry (${daysToExpiry} days)` };
  }

  if (daysToExpiry <= 30) return { discountPercent: 10, reason: `Critical expiry (${daysToExpiry} days)` };
  if (daysToExpiry <= 60) return { discountPercent: 5, reason: `Expiring soon (${daysToExpiry} days)` };

  return null;
}
