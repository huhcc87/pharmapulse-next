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
export function isNearExpiry(
  expiryDate: Date,
  thresholdDays: number = 90
): boolean {
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

  if (days < 0) {
    return { level: "EXPIRED", days, message: "Expired" };
  } else if (days <= 30) {
    return { level: "CRITICAL", days, message: `Expiring in ${days} days (Critical)` };
  } else if (days <= 60) {
    return { level: "SOON", days, message: `Expiring soon (${days} days)` };
  } else if (days <= 90) {
    return { level: "NEAR", days, message: `Near expiry (${days} days)` };
  } else {
    return { level: "SAFE", days, message: "Safe" };
  }
}

/**
 * Get FEFO-ordered batches for a product
 */
export async function getFefoBatches(
  productId: number,
  tenantId: number = 1,
  branchId?: number | null
): Promise<BatchWithExpiry[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      batches: {
        where: {
          quantityOnHand: { gt: 0 },
        },
        orderBy: [
          { expiryDate: "asc" }, // FEFO: earliest expiry first
          { createdAt: "asc" }, // FIFO tie-breaker: oldest first
        ],
      },
    },
  });

  if (!product || !product.batches || product.batches.length === 0) {
    return [];
  }

  const now = new Date();
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
      saleGstRateOverride: batch.saleGstRateOverride
        ? Number(batch.saleGstRateOverride)
        : undefined,
      nearExpiryDiscountPct: batch.nearExpiryDiscountPct
        ? Number(batch.nearExpiryDiscountPct)
        : undefined,
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
  // Get inventory items with batches
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: {
      drugLibraryId,
      tenantId,
      branchId: branchId || undefined,
      qtyOnHand: { gt: 0 },
      batchId: { not: null },
    },
    include: {
      batch: true,
    },
    orderBy: [
      { expiryDate: "asc" }, // FEFO
      { createdAt: "asc" }, // FIFO tie-breaker
    ],
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
        mrp: item.mrp || null,
        saleGstRateOverride: batch.saleGstRateOverride
          ? Number(batch.saleGstRateOverride)
          : undefined,
        nearExpiryDiscountPct: batch.nearExpiryDiscountPct
          ? Number(batch.nearExpiryDiscountPct)
          : undefined,
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

  if (productId) {
    batches = await getFefoBatches(productId, tenantId, branchId);
  } else if (drugLibraryId) {
    batches = await getFefoBatchesForDrug(drugLibraryId, tenantId, branchId);
  }

  if (batches.length === 0) {
    return null;
  }

  // Find first batch with enough stock
  for (const batch of batches) {
    if (batch.isExpired) {
      continue; // Skip expired batches
    }
    if (batch.quantityOnHand >= quantity) {
      return batch;
    }
  }

  // If no single batch has enough, return first available (for split batch handling)
  return batches.find((b) => !b.isExpired && b.quantityOnHand > 0) || null;
}

/**
 * Get suggested discount for near-expiry batch
 */
export function getSuggestedDiscount(
  daysToExpiry: number,
  nearExpiryDiscountPct?: number | null
): { discountPercent: number; reason: string } | null {
  if (daysToExpiry > 90 || daysToExpiry < 0) {
    return null;
  }

  // Use configured discount if available
  if (nearExpiryDiscountPct) {
    return {
      discountPercent: Number(nearExpiryDiscountPct),
      reason: `Near expiry (${daysToExpiry} days)`,
    };
  }

  // Default discount rules
  if (daysToExpiry <= 30) {
    return { discountPercent: 10, reason: `Critical expiry (${daysToExpiry} days)` };
  } else if (daysToExpiry <= 60) {
    return { discountPercent: 5, reason: `Expiring soon (${daysToExpiry} days)` };
  }

  return null;
}
