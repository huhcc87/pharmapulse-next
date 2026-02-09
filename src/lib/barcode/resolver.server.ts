// src/lib/barcode/resolver.server.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { validateBarcode } from "@/lib/barcodes/validate";

export interface ResolveBarcodeResult {
  found: "inventory" | "library" | "none";
  product?: any;
  drug?: any;
  error?: string;
}

/**
 * Server-only barcode resolver (uses Prisma)
 */
export async function resolveBarcodeServer(
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
        // Try new schema first (your existing code)
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

        // Fallback to legacy barcode field if needed
        if (!product) {
          product = await prisma.product.findFirst({
            where: {
              barcode: normalized,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              barcode: true,
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
    } catch (err) {
      // ignore and continue to library
    }

    if (product) {
      return { found: "inventory", product };
    }

    // 2) Try to find in Drug Library
    // NOTE: keep your existing library lookup logic here if your schema differs.
    // I’m using "drugLibrary" as a common table name; adjust if your model is different.
    const drug = await (prisma as any).drugLibrary?.findFirst?.({
      where: {
        OR: [
          { barcode: normalized },
          { ean: normalized },
          { gtin: normalized },
        ],
      },
      select: {
        id: true,
        name: true,
        manufacturer: true,
        composition: true,
        hsnCode: true,
        gstRate: true,
        mrp: true,
      },
    });

    if (drug) {
      return { found: "library", drug };
    }

    return { found: "none" };
  } catch (error: any) {
    return { found: "none", error: error?.message ?? "Resolve failed" };
  }
}
