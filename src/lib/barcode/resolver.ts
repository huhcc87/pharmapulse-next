// src/lib/barcode/resolver.ts
import { prisma } from "@/lib/prisma";
import { validateBarcode } from "@/lib/barcodes/validate";

export interface ResolveBarcodeResult {
  found: "inventory" | "library" | "none";
  product?: any;
  drug?: any;
  error?: string;
}

/**
 * Resolves a barcode to either an inventory product or a drug library entry
 * @param code - The barcode to resolve
 * @param tenantId - Tenant ID (default: 1)
 * @param branchId - Branch ID (default: 1)
 * @returns ResolveBarcodeResult
 */
export async function resolveBarcode(
  code: string,
  tenantId: number = 1,
  branchId: number = 1
): Promise<ResolveBarcodeResult> {
  try {
    const v = validateBarcode(code);
    
    if (!v.ok) {
      return { found: "none", error: v.error };
    }

    const normalized = v.normalized;
    const isInmed = v.type === "INMED";

    // 1) Try to find in Inventory (Product table)
    let product: any = null;

    try {
      if (isInmed) {
        product = await prisma.product.findFirst({
          where: {
            internalCode: normalized,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            internalCode: true,
            hsnCode: true,
            gstRate: true,
            salePrice: true,
            unitPrice: true,
            mrp: true,
            category: true,
            manufacturer: true,
            stockLevel: true,
          },
        });
      } else {
        // Try new schema first
        product = await (prisma.product as any).findFirst({
          where: {
            barcodeTypeEnum: v.type,
            barcodeValue: normalized,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            barcodeValue: true,
            barcodeTypeEnum: true,
            internalCode: true,
            hsnCode: true,
            gstRate: true,
            salePrice: true,
            unitPrice: true,
            mrp: true,
            category: true,
            manufacturer: true,
            stockLevel: true,
          },
        });

        // Fallback to legacy schema
        if (!product) {
          product = await prisma.product.findFirst({
            where: {
              OR: [
                { internalCode: normalized },
                { barcode: normalized as any },
              ],
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              internalCode: true,
              hsnCode: true,
              gstRate: true,
              salePrice: true,
              unitPrice: true,
              mrp: true,
              category: true,
              manufacturer: true,
              stockLevel: true,
            },
          });
        }
      }
    } catch (err: any) {
      // Schema mismatch - continue to drug library
      console.warn("Product lookup error (schema mismatch?):", err);
    }

    if (product) {
      return { found: "inventory", product };
    }

    // 2) Try Drug Library (for INMED codes or if product not found)
    if (isInmed) {
      try {
        const drug = await (prisma.drugLibrary as any).findFirst({
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
            qrPayload: true,
            hsnCode: true,
            gstRate: true,
            category: true,
            packSize: true,
            salts: true,
            fullComposition: true,
          },
        });

        if (drug) {
          return { found: "library", drug };
        }
      } catch (err: any) {
        console.warn("Drug library lookup error:", err);
      }
    }

    return { found: "none", error: "Barcode not found in inventory or drug library" };
  } catch (error: any) {
    console.error("resolveBarcode error:", error);
    return { found: "none", error: error.message || "Failed to resolve barcode" };
  }
}


