// src/lib/gst/advanced.ts
// Advanced GST computation utilities for India

import { prisma } from "@/server/prisma";
import { calculateGst, type TaxCalculationResult } from "./taxCalculator";

export type SupplyType = "INTRA_STATE" | "INTER_STATE";
export type TaxCategory = "TAXABLE" | "EXEMPT" | "ZERO_RATED";

export interface GstComputationInput {
  sellerStateCode: string;
  buyerStateCode?: string | null;
  placeOfSupplyPolicy?: "CUSTOMER_STATE" | "STORE_STATE";
}

export interface LineItemGstInput {
  productId?: number;
  drugLibraryId?: number;
  batchId?: number;
  hsnCode?: string | null;
  gstRate?: number | null;
  gstType?: "INCLUSIVE" | "EXCLUSIVE";
  isTaxExempt?: boolean;
  taxCategory?: TaxCategory;
  pricePaise: number;
  quantity: number;
  discountPaise?: number;
  discountPercent?: number;
}

/**
 * Determine supply type (intra-state vs inter-state)
 */
export function determineSupplyType(input: GstComputationInput): SupplyType {
  const {
    sellerStateCode,
    buyerStateCode,
    placeOfSupplyPolicy = "CUSTOMER_STATE",
  } = input;

  if (!buyerStateCode) {
    // No customer state - use policy
    if (placeOfSupplyPolicy === "STORE_STATE") return "INTRA_STATE";
    // Default to store state for B2C
    return "INTRA_STATE";
  }

  return sellerStateCode === buyerStateCode ? "INTRA_STATE" : "INTER_STATE";
}

/**
 * Get effective GST rate for a line item
 * Priority: batch override > product rate > HSN default > provided gstRate > default (12)
 */
export async function getEffectiveGstRate(
  input: LineItemGstInput
): Promise<{ hsnCode: string | null; gstRate: number; gstType: "INCLUSIVE" | "EXCLUSIVE" }> {
  const {
    batchId,
    productId,
    // drugLibraryId, // reserved for future use
    hsnCode,
    gstRate,
    gstType,
    isTaxExempt,
    taxCategory,
  } = input;

  // Tax exempt / zero rated
  if (isTaxExempt || taxCategory === "EXEMPT" || taxCategory === "ZERO_RATED") {
    return { hsnCode: hsnCode || null, gstRate: 0, gstType: gstType || "EXCLUSIVE" };
  }

  /**
   * 1) Batch override (if batch exists)
   */
  if (batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { product: true },
    });

    if (batch) {
      const override = batch.saleGstRateOverride;
      if (override !== null && override !== undefined) {
        return {
          hsnCode: batch.product?.hsnCode || hsnCode || null,
          gstRate: Number(override),
          gstType: (batch.product?.gstType || gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
        };
      }
    }
  }

  /**
   * 2) Product-level rate (if product exists)
   */
  let product: any | null = null;
  if (productId) {
    product = await prisma.product.findUnique({ where: { id: productId } });

    if (product?.gstRate !== null && product?.gstRate !== undefined) {
      return {
        hsnCode: product.hsnCode || hsnCode || null,
        gstRate: Number(product.gstRate),
        gstType: (product.gstType || gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
      };
    }
  }

  /**
   * 3) HSN master default (if HSN exists)
   */
  const effectiveHsn: string | null =
    hsnCode || product?.hsnCode || null;

  if (effectiveHsn) {
    // NOTE: your prisma model name might be hsnMaster / HSNMaster / hSNMaster
    // Keep what you have, but if build fails, rename to match schema.
    const hsnMaster = await prisma.hSNMaster.findUnique({
      where: { hsnCode: effectiveHsn },
    });

    if (hsnMaster) {
      return {
        hsnCode: effectiveHsn,
        gstRate: Number(hsnMaster.defaultGstRate),
        gstType: (hsnMaster.gstType || gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
      };
    }
  }

  /**
   * 4) Fallbacks
   * - If caller provided gstRate use it (if > 0)
   * - else default to 12% (common for medicines)
   */
  const fallbackRate =
    gstRate !== null && gstRate !== undefined && gstRate > 0 ? Number(gstRate) : 12;

  return {
    hsnCode: effectiveHsn || null,
    gstRate: fallbackRate,
    gstType: (gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
  };
}

/**
 * Compute GST for a line item with intra/inter-state logic
 */
export async function computeLineItemGst(
  input: LineItemGstInput,
  supplyType: SupplyType
): Promise<TaxCalculationResult & { hsnCode: string | null; gstRate: number }> {
  const effective = await getEffectiveGstRate(input);

  const validGstRate =
    effective.gstRate != null && !Number.isNaN(effective.gstRate)
      ? effective.gstRate
      : 12;

  const taxCalc = calculateGst({
    pricePaise: input.pricePaise,
    gstRate: validGstRate,
    gstType: effective.gstType,
    quantity: input.quantity,
    discountPaise: input.discountPaise,
    discountPercent: input.discountPercent,
  });

  if (supplyType === "INTER_STATE") {
    return {
      ...taxCalc,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: taxCalc.totalGstPaise,
      hsnCode: effective.hsnCode,
      gstRate: validGstRate,
    };
  }

  return {
    ...taxCalc,
    igstPaise: 0,
    hsnCode: effective.hsnCode,
    gstRate: validGstRate,
  };
}

/**
 * Round off amount (Indian rounding rules)
 */
export function roundOff(amountPaise: number): number {
  const rupees = amountPaise / 100;
  const rounded = Math.round(rupees);
  return Math.round((rounded - rupees) * 100);
}
