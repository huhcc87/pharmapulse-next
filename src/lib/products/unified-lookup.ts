/**
 * Unified Product Lookup Service
 *
 * Drop-in ES5-safe fix:
 * - Avoids `function` declarations inside blocks (ES5 strict mode error).
 * - Guards `type` (UnifiedBarcodeType | null) before getLookupStrategy().
 * - Keeps `barcodeType` as `UnifiedBarcodeType | undefined` (no null).
 */

import { prisma } from "@/lib/prisma";
import {
  parseUnifiedBarcode,
  getLookupStrategy,
  type UnifiedBarcodeType,
} from "@/lib/barcodes/unified-parser";

export interface ProductLookupResult {
  found: boolean;
  product?: any;
  error?: string;
  barcodeType?: UnifiedBarcodeType; // undefined allowed; null NOT allowed
}

export async function lookupProductByBarcode(
  code: string,
  tenantId: number = 1
): Promise<ProductLookupResult> {
  try {
    const parseResult = parseUnifiedBarcode(code);

    if (!parseResult.ok) {
      return {
        found: false,
        error: parseResult.error,
        barcodeType: undefined,
      };
    }

    const { type, normalized } = parseResult as {
      ok: true;
      type: UnifiedBarcodeType | null;
      normalized: string;
    };

    if (!type) {
      return {
        found: false,
        error: "Unable to determine barcode type",
        barcodeType: undefined,
      };
    }

    const strategy = getLookupStrategy(type);
    const p = prisma as any;

    // Keep select aligned with YOUR Prisma schema.
    // If some fields don't exist in Product, remove them here.
    const productSelect = {
      id: true,
      name: true,
      sku: true,
      internalCode: true,
      barcodeValue: true,
      barcodeTypeEnum: true,
      barcode: true, // legacy
      hsnCode: true,
      gstRate: true,
      gstType: true,
      salePrice: true,
      unitPrice: true,
      mrp: true,
      category: true,
      manufacturer: true,
      stockLevel: true,
      minStock: true,
      composition: true,
      saltComposition: true,
      schedule: true,
      isRx: true,
    };

    // ✅ ES5-safe: arrow function expression (not a function declaration)
    const findProduct = async (where: any) => {
      if (!p?.product?.findFirst) return null;

      // Try tenant-scoped first, fallback if schema doesn't support tenantId
      try {
        return await p.product.findFirst({
          where: { ...where, tenantId, isActive: true },
          select: productSelect,
        });
      } catch {
        return await p.product.findFirst({
          where: { ...where, isActive: true },
          select: productSelect,
        });
      }
    };

    let product: any = null;

    if (type === "HSN") {
      product = await findProduct({ hsnCode: normalized });
    } else if (type === "INMED") {
      product = await findProduct({ internalCode: normalized });
    } else {
      // EAN/UPC/etc — try modern schema first
      try {
        product = await findProduct({
          barcodeTypeEnum: type as any,
          barcodeValue: normalized,
        });
      } catch {
        // Legacy fallback
        product = await findProduct({
          OR: [{ barcode: normalized as any }, { internalCode: normalized }],
        });
      }

      // If still not found, try barcodeValue alone
      if (!product) {
        product = await findProduct({ barcodeValue: normalized });
      }
    }

    if (product) {
      return {
        found: true,
        product,
        barcodeType: type,
      };
    }

    // INMED fallback: DrugLibrary
    if (type === "INMED" && p?.drugLibrary?.findFirst) {
      try {
        const drug = await p.drugLibrary.findFirst({
          where: { qrCode: normalized },
          select: {
            id: true,
            brandName: true,
            manufacturer: true,
            priceInr: true,
            dpcoCeilingPriceInr: true,
            qrCode: true,
            category: true,
            packSize: true,
            salts: true,
            fullComposition: true,
            gstPercent: true,
          },
        });

        if (drug) {
          return {
            found: true,
            product: {
              id: drug.id,
              name: drug.brandName,
              drugLibraryId: drug.id,
              internalCode: drug.qrCode,
              manufacturer: drug.manufacturer,
              category: drug.category,
              packSize: drug.packSize,
              salts: drug.salts,
              fullComposition: drug.fullComposition,
              priceInr: drug.priceInr,
              dpcoCeilingPriceInr: drug.dpcoCeilingPriceInr,
              gstPercent: drug.gstPercent,
              isDrugLibrary: true,
            },
            barcodeType: type,
          };
        }
      } catch (err: any) {
        console.warn("Drug library lookup error:", err);
      }
    }

    return {
      found: false,
      barcodeType: type,
      error: `Product not found for ${strategy.description}: ${normalized}`,
    };
  } catch (error: any) {
    console.error("Product lookup error:", error);
    return {
      found: false,
      error: error.message || "Failed to lookup product",
      barcodeType: undefined,
    };
  }
}

export function validateProductGst(product: any): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!product?.hsnCode) missing.push("HSN Code");
  if (product?.gstRate === null || product?.gstRate === undefined)
    missing.push("GST Rate");
  return { valid: missing.length === 0, missing };
}
