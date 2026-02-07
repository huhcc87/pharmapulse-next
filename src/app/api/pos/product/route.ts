// src/app/api/pos/product/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBarcode } from "@/lib/barcodes/validate";

// Small helper to detect "column does not exist" / schema mismatch at runtime
function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist in the current database") ||
    msg.includes("column") && msg.includes("does not exist") ||
    err?.code === "P2022"
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("barcode") || searchParams.get("code") || "";

    if (!code) {
      return NextResponse.json(
        { found: false, error: "barcode or code parameter required" },
        { status: 200 }
      );
    }

    const v = validateBarcode(code);

    if (!v.ok) {
      return NextResponse.json({ found: false, error: v.error }, { status: 200 });
    }

    // ✅ narrow type for TS + Prisma
    const isInmed = v.type === "INMED";
    const normalized = v.normalized;

    // 1) Try NEW schema first: barcodeTypeEnum + barcodeValue
    //    (will fail on your machine if DB doesn't have barcode_value)
    let product: any = null;

    try {
      product = await prisma.product.findFirst({
        where: {
          isActive: true,
          // If INMED, allow matching internalCode OR barcodeValue (some teams store INMED in internalCode)
          ...(isInmed
            ? {
                OR: [
                  { internalCode: normalized },
                  { barcodeValue: normalized as any },
                ],
              }
            : {
                barcodeTypeEnum: v.type as any,
                barcodeValue: normalized as any,
              }),
        },
        select: {
          id: true,
          name: true,
          internalCode: true,
          barcodeValue: true as any,
          barcodeTypeEnum: true as any,
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
          // legacy field (may exist)
          barcode: true as any,
        },
      });
    } catch (err: any) {
      // If DB is older, fall back below
      if (!isMissingColumnError(err)) throw err;
    }

    // 2) Fallback: LEGACY schema (barcode, internalCode only)
    if (!product) {
      product = await prisma.product.findFirst({
        where: {
          isActive: true,
          OR: [
            // If INMED, internalCode likely contains INMED-000001
            { internalCode: normalized },
            // If EAN/UPC, legacy barcode might contain digits
            { barcode: normalized as any },
          ],
        },
        select: {
          id: true,
          name: true,
          internalCode: true,
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
          // legacy field (may exist)
          barcode: true as any,
        },
      });
    }

    if (!product) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const salePrice = Number(product.salePrice ?? product.unitPrice ?? 0);

    return NextResponse.json({
      found: true,
      product: {
        id: String(product.id),
        name: product.name,

        // pick whichever exists
        barcode:
          (product.barcodeValue as string | undefined) ||
          (product.barcode as string | undefined) ||
          (product.internalCode as string | undefined) ||
          null,

        internalCode: product.internalCode ?? null,
        hsn: product.hsnCode ?? null,
        gstRate: product.gstRate != null ? Number(product.gstRate) : null,
        gstType: (product.gstType as "EXCLUSIVE" | "INCLUSIVE") || "EXCLUSIVE",
        salePrice: Number.isFinite(salePrice) && salePrice > 0 ? salePrice : 0,
        mrp: product.mrp != null ? Number(product.mrp) : null,
        category: product.category ?? null,
        manufacturer: product.manufacturer ?? null,
        stockLevel: product.stockLevel ?? null,
        minStock: product.minStock ?? null,
      },
    });
  } catch (error: any) {
    console.error("Error in /api/pos/product:", error);
    return NextResponse.json(
      { found: false, error: error?.message || "Internal server error" },
      { status: 200 }
    );
  }
}
