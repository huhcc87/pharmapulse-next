/**
 * Unified Product Lookup Service
 * 
 * Shared product lookup logic for POS and Inventory modules
 * Supports EAN, HSN, and INMED code lookups
 */

import { prisma } from "@/lib/prisma";
import { parseUnifiedBarcode, getLookupStrategy, type UnifiedBarcodeType } from "@/lib/barcodes/unified-parser";

export interface ProductLookupResult {
  found: boolean;
  product?: any;
  error?: string;
  barcodeType?: UnifiedBarcodeType;
}

/**
 * Unified product lookup by barcode (EAN, HSN, or INMED)
 */
export async function lookupProductByBarcode(
  code: string,
  tenantId: number = 1
): Promise<ProductLookupResult> {
  try {
    // Parse the barcode to determine type
    const parseResult = parseUnifiedBarcode(code);

    if (!parseResult.ok) {
      return {
        found: false,
        error: parseResult.error,
        barcodeType: null,
      };
    }

    const { type, normalized } = parseResult;
    const strategy = getLookupStrategy(type!);

    // Build query based on barcode type
    let product: any = null;

    if (type === "HSN") {
      // Lookup by HSN code
      product = await prisma.product.findFirst({
        where: {
          hsnCode: normalized,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          internalCode: true,
          barcodeValue: true,
          barcodeTypeEnum: true,
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
        },
      });
    } else if (type === "INMED") {
      // Lookup by internal code
      product = await prisma.product.findFirst({
        where: {
          internalCode: normalized,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          internalCode: true,
          barcodeValue: true,
          barcodeTypeEnum: true,
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
        },
      });
    } else {
      // Lookup by EAN/UPC barcode
      try {
        product = await prisma.product.findFirst({
          where: {
            barcodeTypeEnum: type as any,
            barcodeValue: normalized,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            internalCode: true,
            barcodeValue: true,
            barcodeTypeEnum: true,
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
          },
        });
      } catch (err: any) {
        // Fallback to legacy schema
        if (err.code === "P2022" || err.message?.includes("column")) {
          product = await prisma.product.findFirst({
            where: {
              OR: [
                { barcode: normalized as any },
                { internalCode: normalized },
              ],
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              sku: true,
              internalCode: true,
              barcode: true,
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
            },
          });
        } else {
          throw err;
        }
      }
    }

    if (product) {
      return {
        found: true,
        product,
        barcodeType: type!,
      };
    }

    // For INMED codes, also check DrugLibrary if not found in Product
    if (type === "INMED") {
      try {
        const drug = await prisma.drugLibrary.findFirst({
          where: {
            qrCode: normalized,
          },
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
          // Return as drug library item (not in inventory yet)
          return {
            found: true,
            product: {
              id: drug.id,
              name: drug.brandName,
              drugLibraryId: drug.id,
              internalCode: drug.qrCode,
              manufacturer: drug.manufacturer,
              category: drug.category,
              priceInr: drug.priceInr,
              dpcoCeilingPriceInr: drug.dpcoCeilingPriceInr,
              gstPercent: drug.gstPercent,
              isDrugLibrary: true, // Flag to indicate it's from drug library
            },
            barcodeType: type!,
          };
        }
      } catch (err: any) {
        console.warn("Drug library lookup error:", err);
      }
    }

    return {
      found: false,
      barcodeType: type!,
      error: `Product not found for ${strategy.description}: ${normalized}`,
    };
  } catch (error: any) {
    console.error("Product lookup error:", error);
    return {
      found: false,
      error: error.message || "Failed to lookup product",
    };
  }
}

/**
 * Validate product has required GST fields
 */
export function validateProductGst(product: any): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!product.hsnCode) {
    missing.push("HSN Code");
  }

  if (product.gstRate === null || product.gstRate === undefined) {
    missing.push("GST Rate");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
