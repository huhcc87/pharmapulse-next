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
  const { sellerStateCode, buyerStateCode, placeOfSupplyPolicy = "CUSTOMER_STATE" } = input;

  if (!buyerStateCode) {
    // No customer state - use policy
    if (placeOfSupplyPolicy === "STORE_STATE") {
      return "INTRA_STATE";
    }
    // Default to store state for B2C
    return "INTRA_STATE";
  }

  // Compare states
  if (sellerStateCode === buyerStateCode) {
    return "INTRA_STATE";
  }

  return "INTER_STATE";
}

/**
 * Get effective GST rate for a line item
 * Priority: batch override > product rate > HSN default > 0
 */
export async function getEffectiveGstRate(
  input: LineItemGstInput
): Promise<{ hsnCode: string | null; gstRate: number; gstType: "INCLUSIVE" | "EXCLUSIVE" }> {
  const { batchId, productId, drugLibraryId, hsnCode, gstRate, gstType, isTaxExempt, taxCategory } = input;

  // Tax exempt
  if (isTaxExempt || taxCategory === "EXEMPT" || taxCategory === "ZERO_RATED") {
    return { hsnCode: hsnCode || null, gstRate: 0, gstType: gstType || "EXCLUSIVE" };
  }

  // Check batch override first
  if (batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: { product: true },
    });

    if (batch?.saleGstRateOverride !== null && batch.saleGstRateOverride !== undefined) {
      return {
        hsnCode: batch.product?.hsnCode || hsnCode || null,
        gstRate: Number(batch.saleGstRateOverride),
        gstType: batch.product?.gstType || gstType || "EXCLUSIVE",
      };
    }
  }

  // Use product rate if available
  if (productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (product?.gstRate !== null && product.gstRate !== undefined) {
      return {
        hsnCode: product.hsnCode || hsnCode || null,
        gstRate: Number(product.gstRate),
        gstType: (product.gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
      };
    }
  }

  // Check HSN master
  const effectiveHsn = hsnCode || (productId ? (await prisma.product.findUnique({ where: { id: productId } }))?.hsnCode : null);
  if (effectiveHsn) {
    const hsnMaster = await prisma.hSNMaster.findUnique({ where: { hsnCode: effectiveHsn } });
    if (hsnMaster) {
      return {
        hsnCode: effectiveHsn,
        gstRate: Number(hsnMaster.defaultGstRate),
        gstType: (hsnMaster.gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
      };
    }
  }

  // Default - ensure we always return a valid GST rate (default to 12% for medicines)
  const defaultGstRate = gstRate && gstRate > 0 ? Number(gstRate) : 12;
  return {
    hsnCode: hsnCode || null,
    gstRate: defaultGstRate,
    gstType: gstType || "EXCLUSIVE",
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
  
  // Ensure gstRate is always a valid number (never null/undefined)
  const validGstRate = effective.gstRate != null && !isNaN(effective.gstRate) ? effective.gstRate : 12;

  const taxCalc = calculateGst({
    pricePaise: input.pricePaise,
    gstRate: validGstRate,
    gstType: effective.gstType,
    quantity: input.quantity,
    discountPaise: input.discountPaise,
    discountPercent: input.discountPercent,
  });

  // Adjust for inter-state (IGST) vs intra-state (CGST+SGST)
  if (supplyType === "INTER_STATE") {
    return {
      ...taxCalc,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: taxCalc.totalGstPaise,
      hsnCode: effective.hsnCode,
      gstRate: validGstRate, // Always return valid number
    };
  }

  return {
    ...taxCalc,
    igstPaise: 0,
    hsnCode: effective.hsnCode,
    gstRate: validGstRate, // Always return valid number
  };
}

/**
 * Round off amount (Indian rounding rules)
 */
export function roundOff(amountPaise: number): number {
  const rupees = amountPaise / 100;
  const rounded = Math.round(rupees);
  const roundOffPaise = Math.round((rounded - rupees) * 100);
  return roundOffPaise;
}
